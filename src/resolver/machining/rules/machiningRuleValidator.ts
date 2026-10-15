import type {
  Piece,
  Material,
  CustomPieceOperation,
  DrillOperation,
  MachiningConfig,
} from '../../../model';
import { customHoleSeriesToDrillOperations } from '../../../model/operation';
import { DEFAULT_MACHINING_SHOP_VALUES } from '../../machining';
import { calculatePocketCornerRelief } from './cornerRelief';

export interface MachiningValidationIssue {
  id: string;
  level: 'error' | 'warning' | 'info';
  category: 'material-tolerance' | 'boundary' | 'joint-collision' | 'tool-geometry';
  code: string;
  pieceId: string;
  operationId?: string;
  message: string;
}

export interface MachiningValidationContext {
  piece: Piece | (Piece & { dimensionsMm?: { width: number; height: number } });
  material?: Material | null;
  customOperations: CustomPieceOperation[];
  derivedOperations?: DrillOperation[];
  config?: Partial<MachiningConfig>;
  minResidualThicknessMm?: number;
  jointClearanceMm?: number;
}

export function extractPieceDimensions(
  piece: Piece | (Piece & { dimensionsMm?: { width: number; height: number } }),
): { width: number; height: number; thickness: number } {
  if ('dimensionsMm' in piece && piece.dimensionsMm) {
    return {
      width: piece.dimensionsMm.width,
      height: piece.dimensionsMm.height,
      thickness: piece.thicknessMm,
    };
  }
  const xs = piece.contour.points.map((p) => p.x);
  const ys = piece.contour.points.map((p) => p.y);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 1);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 1);
  return {
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
    thickness: piece.thicknessMm,
  };
}

function isFaceVisible(piece: Piece, faceType: 'face-A' | 'face-B' | 'edge'): boolean {
  const matched = piece.faces.find((f) => f.id === faceType);
  if (matched !== undefined) {
    return matched.visible;
  }
  // If not explicitly named, check if face-A is visible
  if (faceType === 'face-A') {
    return piece.faces.some((f) => f.visible);
  }
  return false;
}

/**
 * Validates custom and joint machining operations on a piece according to workshop rules:
 * 1. Rule 8.1: Material Milling Tolerance (visible face chipping, structural panel limits).
 * 2. Boundary & Residual Thickness Checks (operations out of bounds, insufficient margin or residual thickness).
 * 3. Joint / Fastener Collisions (custom operations overlapping structural joint holes).
 * 4. Tool Geometry Validations (cutout corner radius vs tool diameter).
 */
export function validatePieceMachiningRules(context: MachiningValidationContext): MachiningValidationIssue[] {
  const {
    piece,
    material,
    customOperations,
    derivedOperations = [],
    config = DEFAULT_MACHINING_SHOP_VALUES,
    minResidualThicknessMm = 3.0,
    jointClearanceMm,
  } = context;

  const effectiveConfig = {
    ...DEFAULT_MACHINING_SHOP_VALUES,
    ...config,
  };
  const effectiveJointClearance = jointClearanceMm ?? Math.min(10.0, effectiveConfig.jointDrillMarginMm * 0.2);

  const issues: MachiningValidationIssue[] = [];
  const dims = extractPieceDimensions(piece);
  let issueIdx = 1;
  const nextId = () => `issue-${piece.id}-${issueIdx++}`;

  const isMillingOp = (kind: string) =>
    kind === 'groove' || kind === 'rebate' || kind === 'cutout' || kind === 'edge-profile';

  // 1. Material Milling Tolerance Checks (Rule 8.1)
  if (material?.milling) {
    const milling = material.milling;

    for (const op of customOperations) {
      if (isMillingOp(op.kind)) {
        // Visible Face Check
        const onVisible = isFaceVisible(piece, op.faceType);
        if (onVisible) {
          if (milling.visible === 'no') {
            issues.push({
              id: nextId(),
              level: 'warning',
              category: 'material-tolerance',
              code: 'RULE_8_1_VISIBLE_FACE',
              pieceId: piece.id,
              operationId: op.id,
              message: `El material "${material.name}" no tolera fresados en caras visibles (${op.faceType}). Riesgo de astillado o núcleo expuesto en mecanizado tipo ${op.kind}.`,
            });
          } else if (milling.visible === 'with-accessory') {
            issues.push({
              id: nextId(),
              level: 'info',
              category: 'material-tolerance',
              code: 'RULE_8_1_WITH_ACCESSORY',
              pieceId: piece.id,
              operationId: op.id,
              message: `El material "${material.name}" requiere disco incisor o fresa de diamante para mecanizados visibles (${op.faceType}).`,
            });
          }
        }

        // Structural Piece Check
        if (piece.structural) {
          if (milling.onStructuralPiece === 'no') {
            issues.push({
              id: nextId(),
              level: 'error',
              category: 'material-tolerance',
              code: 'RULE_8_1_STRUCTURAL_PROHIBITED',
              pieceId: piece.id,
              operationId: op.id,
              message: `El material "${material.name}" no admite ranurados ni cajeados en piezas estructurales (rol: ${piece.role}). Compromete la resistencia de la estructura.`,
            });
          } else if (milling.onStructuralPiece === 'limited') {
            // Check confirmed depth limit
            const depth = 'depthMm' in op ? op.depthMm : 0;
            if (typeof milling.maxDepthMm === 'number' && depth > milling.maxDepthMm) {
              issues.push({
                id: nextId(),
                level: 'error',
                category: 'material-tolerance',
                code: 'RULE_8_1_STRUCTURAL_DEPTH_EXCEEDED',
                pieceId: piece.id,
                operationId: op.id,
                message: `La profundidad de ${depth}mm en ${op.kind} excede el límite máximo estructural permitido por el material (${milling.maxDepthMm}mm).`,
              });
            } else if (depth > dims.thickness * 0.67) {
              issues.push({
                id: nextId(),
                level: 'warning',
                category: 'material-tolerance',
                code: 'RULE_8_1_STRUCTURAL_DEPTH_WARNING',
                pieceId: piece.id,
                operationId: op.id,
                message: `La profundidad de ${depth}mm supera 2/3 del espesor en pieza estructural (${dims.thickness}mm). Puede debilitar el ensamble.`,
              });
            }
          }
        }
      }
    }
  }

  // 2. Boundary and Residual Thickness Checks
  for (const op of customOperations) {
    switch (op.kind) {
      case 'drill': {
        // Coordinate bounds
        if (op.xMm < 0 || op.xMm > dims.width || op.yMm < 0 || op.yMm > dims.height) {
          issues.push({
            id: nextId(),
            level: 'error',
            category: 'boundary',
            code: 'OUT_OF_BOUNDS',
            pieceId: piece.id,
            operationId: op.id,
            message: `Perforación Ø${op.diameterMm}mm en (${op.xMm}, ${op.yMm}) fuera de los límites de la pieza (${dims.width}x${dims.height}mm).`,
          });
        }

        // Edge intersection margin
        const radius = op.diameterMm / 2;
        const distLeft = op.xMm;
        const distRight = dims.width - op.xMm;
        const distBottom = op.yMm;
        const distTop = dims.height - op.yMm;
        const minDistToEdge = Math.min(distLeft, distRight, distBottom, distTop);

        if (minDistToEdge < radius) {
          issues.push({
            id: nextId(),
            level: 'error',
            category: 'boundary',
            code: 'EDGE_INTERSECT',
            pieceId: piece.id,
            operationId: op.id,
            message: `La perforación Ø${op.diameterMm}mm corta el borde de la pieza (distancia al canto: ${round(minDistToEdge)}mm < radio ${radius}mm).`,
          });
        }

        // Residual thickness
        if (!op.isThrough) {
          if (op.depthMm >= dims.thickness) {
            issues.push({
              id: nextId(),
              level: 'error',
              category: 'boundary',
              code: 'BLIND_OPERATION_THROUGH',
              pieceId: piece.id,
              operationId: op.id,
              message: `Perforación ciega de ${op.depthMm}mm alcanza o excede el espesor de la pieza (${dims.thickness}mm).`,
            });
          } else if (dims.thickness - op.depthMm < minResidualThicknessMm) {
            issues.push({
              id: nextId(),
              level: 'warning',
              category: 'boundary',
              code: 'RESIDUAL_THICKNESS_TOO_THIN',
              pieceId: piece.id,
              operationId: op.id,
              message: `Espesor residual peligroso (${round(dims.thickness - op.depthMm)}mm < ${minResidualThicknessMm}mm) en perforación de ${op.depthMm}mm.`,
            });
          }
        }
        break;
      }

      case 'hole-series': {
        const expandedDrills = customHoleSeriesToDrillOperations(op);
        const radius = op.diameterMm / 2;

        for (let i = 0; i < expandedDrills.length; i++) {
          const d = expandedDrills[i];
          if (!d) continue;
          const { x, y } = d.positionMm;
          if (x < 0 || x > dims.width || y < 0 || y > dims.height) {
            issues.push({
              id: nextId(),
              level: 'error',
              category: 'boundary',
              code: 'OUT_OF_BOUNDS',
              pieceId: piece.id,
              operationId: op.id,
              message: `Agujero #${i + 1} de la serie Sistema 32 en (${x}, ${y}) fuera de límites (${dims.width}x${dims.height}mm).`,
            });
            break; // Report once per series
          }

          const distLeft = x;
          const distRight = dims.width - x;
          const distBottom = y;
          const distTop = dims.height - y;
          const minDist = Math.min(distLeft, distRight, distBottom, distTop);
          if (minDist < radius) {
            issues.push({
              id: nextId(),
              level: 'error',
              category: 'boundary',
              code: 'EDGE_INTERSECT',
              pieceId: piece.id,
              operationId: op.id,
              message: `Agujero #${i + 1} de la serie corta el canto (distancia ${round(minDist)}mm < radio ${radius}mm).`,
            });
            break;
          }
        }

        if (!op.isThrough) {
          if (op.depthMm >= dims.thickness) {
            issues.push({
              id: nextId(),
              level: 'error',
              category: 'boundary',
              code: 'BLIND_OPERATION_THROUGH',
              pieceId: piece.id,
              operationId: op.id,
              message: `Serie de agujeros con profundidad (${op.depthMm}mm) igual o superior al espesor (${dims.thickness}mm).`,
            });
          } else if (dims.thickness - op.depthMm < minResidualThicknessMm) {
            issues.push({
              id: nextId(),
              level: 'warning',
              category: 'boundary',
              code: 'RESIDUAL_THICKNESS_TOO_THIN',
              pieceId: piece.id,
              operationId: op.id,
              message: `Espesor residual de serie (${round(dims.thickness - op.depthMm)}mm) menor a ${minResidualThicknessMm}mm.`,
            });
          }
        }
        break;
      }

      case 'groove': {
        const maxSpan = op.axis === 'x' ? dims.height : dims.width;
        if (op.offsetMm < 0 || op.offsetMm + op.widthMm > maxSpan) {
          issues.push({
            id: nextId(),
            level: 'error',
            category: 'boundary',
            code: 'OUT_OF_BOUNDS',
            pieceId: piece.id,
            operationId: op.id,
            message: `Ranura en eje ${op.axis.toUpperCase()} con offset ${op.offsetMm}mm y ancho ${op.widthMm}mm excede la pieza (${maxSpan}mm).`,
          });
        }

        if (op.depthMm >= dims.thickness) {
          issues.push({
            id: nextId(),
            level: 'error',
            category: 'boundary',
            code: 'BLIND_OPERATION_THROUGH',
            pieceId: piece.id,
            operationId: op.id,
            message: `Profundidad de ranura (${op.depthMm}mm) igual o superior al espesor (${dims.thickness}mm). Cortaría la pieza en dos.`,
          });
        } else if (dims.thickness - op.depthMm < minResidualThicknessMm) {
          issues.push({
            id: nextId(),
            level: 'warning',
            category: 'boundary',
            code: 'RESIDUAL_THICKNESS_TOO_THIN',
            pieceId: piece.id,
            operationId: op.id,
            message: `Espesor residual de ranura (${round(dims.thickness - op.depthMm)}mm) menor al mínimo (${minResidualThicknessMm}mm).`,
          });
        }
        break;
      }

      case 'rebate': {
        const edgeSpan =
          op.edge === 'top' || op.edge === 'bottom' ? dims.height : dims.width;
        if (op.widthMm >= edgeSpan) {
          issues.push({
            id: nextId(),
            level: 'error',
            category: 'boundary',
            code: 'OUT_OF_BOUNDS',
            pieceId: piece.id,
            operationId: op.id,
            message: `Ancho del rebaje (${op.widthMm}mm) igual o mayor a la longitud de la pieza (${edgeSpan}mm).`,
          });
        }

        if (op.depthMm >= dims.thickness) {
          issues.push({
            id: nextId(),
            level: 'error',
            category: 'boundary',
            code: 'REBATE_DEPTH_EXCEEDS_THICKNESS',
            pieceId: piece.id,
            operationId: op.id,
            message: `Profundidad del rebaje (${op.depthMm}mm) supera o iguala el espesor (${dims.thickness}mm).`,
          });
        }
        break;
      }

      case 'cutout': {
        // Strict boundary check
        if (
          op.xMm < 0 ||
          op.yMm < 0 ||
          op.xMm + op.widthMm > dims.width ||
          op.yMm + op.heightMm > dims.height
        ) {
          issues.push({
            id: nextId(),
            level: 'error',
            category: 'boundary',
            code: 'OUT_OF_BOUNDS',
            pieceId: piece.id,
            operationId: op.id,
            message: `Cajeado (${op.widthMm}x${op.heightMm}mm) en (${op.xMm}, ${op.yMm}) excede los límites de la pieza (${dims.width}x${dims.height}mm).`,
          });
        }

        // Corner Relief Tool Geometry Validation
        const r = op.cornerRadiusMm ?? 0;
        const pocketResult = calculatePocketCornerRelief({
          xMm: op.xMm,
          yMm: op.yMm,
          widthMm: op.widthMm,
          heightMm: op.heightMm,
          cornerRadiusMm: r,
          cornerTreatment: op.cornerTreatment,
        });

        if (!pocketResult.valid) {
          for (const err of pocketResult.errors) {
            issues.push({
              id: nextId(),
              level: 'error',
              category: 'tool-geometry',
              code: 'TOOL_TOO_LARGE_FOR_POCKET',
              pieceId: piece.id,
              operationId: op.id,
              message: err,
            });
          }
        }

        // Residual thickness if blind pocket
        if (!op.isThrough) {
          if (op.depthMm >= dims.thickness) {
            issues.push({
              id: nextId(),
              level: 'error',
              category: 'boundary',
              code: 'BLIND_OPERATION_THROUGH',
              pieceId: piece.id,
              operationId: op.id,
              message: `Cajeado no pasante con profundidad (${op.depthMm}mm) excede espesor (${dims.thickness}mm).`,
            });
          } else if (dims.thickness - op.depthMm < minResidualThicknessMm) {
            issues.push({
              id: nextId(),
              level: 'warning',
              category: 'boundary',
              code: 'RESIDUAL_THICKNESS_TOO_THIN',
              pieceId: piece.id,
              operationId: op.id,
              message: `Espesor residual de cajeado (${round(dims.thickness - op.depthMm)}mm) menor a ${minResidualThicknessMm}mm.`,
            });
          }
        }
        break;
      }

      case 'edge-profile': {
        if (op.depthMm >= dims.thickness) {
          issues.push({
            id: nextId(),
            level: 'error',
            category: 'boundary',
            code: 'PROFILE_DEPTH_EXCEEDS_THICKNESS',
            pieceId: piece.id,
            operationId: op.id,
            message: `Profundidad del perfil (${op.depthMm}mm) igual o superior al espesor (${dims.thickness}mm).`,
          });
        }
        break;
      }
    }
  }

  // 3. Collision Checks with Joint Fasteners
  if (derivedOperations.length > 0) {
    const jointDrillsForPiece = derivedOperations.filter((d) => d.pieceId === piece.id);

    for (const op of customOperations) {
      if (op.kind === 'drill') {
        for (const jd of jointDrillsForPiece) {
          if (jd.faceType === op.faceType) {
            const dx = op.xMm - jd.positionMm.x;
            const dy = op.yMm - jd.positionMm.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const reqDist = (op.diameterMm + jd.diameterMm) / 2 + effectiveJointClearance;

            if (dist < reqDist) {
              issues.push({
                id: nextId(),
                level: 'warning',
                category: 'joint-collision',
                code: 'COLLISION_WITH_JOINT',
                pieceId: piece.id,
                operationId: op.id,
                message: `Perforación manual en (${op.xMm}, ${op.yMm}) colisiona o está muy cerca del ensamble ${jd.sourceJointKind ?? 'estructural'} en (${jd.positionMm.x}, ${jd.positionMm.y}) [distancia: ${round(dist)}mm < requerida: ${reqDist}mm].`,
              });
            }
          }
        }
      } else if (op.kind === 'hole-series') {
        const expandedDrills = customHoleSeriesToDrillOperations(op);
        for (let i = 0; i < expandedDrills.length; i++) {
          const ed = expandedDrills[i];
          if (!ed) continue;
          for (const jd of jointDrillsForPiece) {
            if (jd.faceType === op.faceType) {
              const dx = ed.positionMm.x - jd.positionMm.x;
              const dy = ed.positionMm.y - jd.positionMm.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const reqDist = (op.diameterMm + jd.diameterMm) / 2 + effectiveJointClearance;

              if (dist < reqDist) {
                issues.push({
                  id: nextId(),
                  level: 'warning',
                  category: 'joint-collision',
                  code: 'COLLISION_WITH_JOINT',
                  pieceId: piece.id,
                  operationId: op.id,
                  message: `Agujero #${i + 1} de la serie en (${ed.positionMm.x}, ${ed.positionMm.y}) colisiona con el ensamble en (${jd.positionMm.x}, ${jd.positionMm.y}).`,
                });
                break;
              }
            }
          }
        }
      } else if (op.kind === 'cutout') {
        for (const jd of jointDrillsForPiece) {
          if (jd.faceType === op.faceType) {
            const insideX =
              jd.positionMm.x >= op.xMm - effectiveJointClearance &&
              jd.positionMm.x <= op.xMm + op.widthMm + effectiveJointClearance;
            const insideY =
              jd.positionMm.y >= op.yMm - effectiveJointClearance &&
              jd.positionMm.y <= op.yMm + op.heightMm + effectiveJointClearance;

            if (insideX && insideY) {
              issues.push({
                id: nextId(),
                level: 'warning',
                category: 'joint-collision',
                code: 'COLLISION_WITH_JOINT',
                pieceId: piece.id,
                operationId: op.id,
                message: `El cajeado (${op.widthMm}x${op.heightMm}mm) corta o interfiere con el mecanizado de ensamble en (${jd.positionMm.x}, ${jd.positionMm.y}).`,
              });
            }
          }
        }
      }
    }
  }

  return issues;
}

function round(val: number): number {
  return Math.round(val * 10) / 10;
}
