import { jsPDF } from 'jspdf';
import { translateAssemblyPhase, translateHardwareType } from '../i18n';
import { translateRoleKey } from '../locales';
import type { ResolvedModule, ResolvedPiece } from './resolver';
import type { Joint, MachiningConfig } from '../model';
import { getHardwareCountForJoint } from './bom';
import { deriveAssemblyGauges, type AssemblyGauge } from './gauges';
import { determinePieceSpatialSize } from './spatial3d';
import type { PieceMachiningSheet } from './machiningSheet';

export interface AssemblyHardwareRequirement {
  type: 'confirmat' | 'minifix' | 'dowel' | 'euro-screw' | 'wood-screw' | 'slide' | 'hinge-plate' | 'shelf-pin' | 'bracket';
  label: string;
  quantity: number;
  toolRequired?: string;
  pilotDrillMm?: number;
}

export interface AssemblyStep {
  stepNumber: number;
  phase: 'preparation' | 'pre-assembly' | 'carcass' | 'shelves' | 'rails' | 'squaring' | 'drawers' | 'doors' | 'inspection';
  title: string;
  instruction: string;
  piecesInvolved: string[];
  basePieceIds?: string[];
  gaugesInvolved: string[];
  hardwareRequirements: AssemblyHardwareRequirement[];
  hardwareSummary?: string;
  toolsRequired: string[];
  criticalDimensionMm?: {
    label: string;
    valueMm: number;
    toleranceMm: number;
  };
  workshopTips?: string[];
  referenceEdge?: 'front' | 'back' | 'top' | 'bottom';
  notes?: string;
}

export interface ExplodedPieceMapItem {
  referenceNumber: number;
  pieceId: string;
  role: string;
  name: string;
  dimensionsMm: { width: number; height: number; thickness: number };
  materialId?: string;
  bandedEdgesSummary: string;
  hardwarePreparedCount: number;
  displacementOffsetMm: { x: number; y: number; z: number };
}

export interface PanelDetailItem {
  pieceId: string;
  referenceNumber: number;
  role: string;
  name: string;
  dimensionsMm: { width: number; height: number; thickness: number };
  bandedEdges: { top: boolean; bottom: boolean; left: boolean; right: boolean };
  datumNotes: string;
  hardwareInstalled: AssemblyHardwareRequirement[];
  operations: {
    yFromBottomMm: number;
    xFromFrontMm: number;
    description: string;
    hardwareType: string;
    drillSpecs?: string;
  }[];
}

export interface AssemblySheet {
  moduleId: string;
  title: string;
  moduleDimensionsMm: { width: number; height: number; depth: number };
  squaringDiagonalMm: number;
  steps: AssemblyStep[];
  gauges: AssemblyGauge[];
  totalSteps: number;
  explodedMap: ExplodedPieceMapItem[];
  panelDetails: PanelDetailItem[];
  totalHardwareBOM: AssemblyHardwareRequirement[];
}

export interface GenerateAssemblySheetInput {
  module: ResolvedModule | { moduleId: string; pieces: ResolvedPiece[]; joints: Joint[] };
  moduleName?: string;
  gauges?: AssemblyGauge[];
  machiningConfig?: MachiningConfig;
  machiningSheets?: PieceMachiningSheet[];
  moduleDimensions?: { width: number; height: number; depth: number };
}

export function getFriendlyPieceName(role: string): string {
  const direct = translateRoleKey(role);
  if (direct !== role && direct !== role.replace(/^\[[^\]]+\]\s*/, '').trim()) {
    return direct;
  }

  const r = role.toLowerCase();
  // 1. Drawer-specific compound roles fallback
  if (r.includes('drawer-front')) return translateRoleKey('drawer-front');
  if (r.includes('drawer-box-front')) return translateRoleKey('drawer-box-front');
  if (r.includes('drawer') && r.includes('side-left')) return translateRoleKey('drawer-box-side-left');
  if (r.includes('drawer') && r.includes('side-right')) return translateRoleKey('drawer-box-side-right');
  if (r.includes('drawer-box-side') || (r.includes('drawer') && r.includes('side'))) return translateRoleKey('drawer-side');
  if (r.includes('drawer-box-back') || (r.includes('drawer') && (r.includes('back') || r.includes('counterfront')))) return translateRoleKey('drawer-box-back');
  if (r.includes('drawer-box-bottom') || (r.includes('drawer') && (r.includes('bottom') || r.includes('base')))) return translateRoleKey('drawer-bottom');
  if (r.includes('drawer')) return 'Cajón';

  // 2. Cabinet body compound roles fallback
  if (r.includes('side-left') || (r.includes('side') && r.includes('1'))) return translateRoleKey('side-left');
  if (r.includes('side-right') || (r.includes('side') && r.includes('2'))) return translateRoleKey('side-right');
  if (r.includes('side')) return translateRoleKey('side');
  if (r.includes('bottom') || r.includes('base') || r.includes('piso')) return translateRoleKey('bottom');
  if (r.includes('top') && !r.includes('rail')) return translateRoleKey('top');
  if (r.includes('rail')) return translateRoleKey('rail');
  if (r.includes('shelf')) return translateRoleKey('shelf');
  if (r.includes('partition') || r.includes('divider')) return translateRoleKey('partition');
  if (r.includes('back')) return translateRoleKey('back');
  if (r.includes('door-left') || r.endsWith('door-l')) return translateRoleKey('door-left');
  if (r.includes('door-right') || r.endsWith('door-r')) return translateRoleKey('door-right');
  if (r.includes('door')) return translateRoleKey('door');
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/**
 * Maps a single structural/hardware Joint into AssemblyHardwareRequirement items
 * using the exact same counting rules as generateBOMHardware in bom.ts (SSOT).
 */
function mapJointToHardwareRequirements(
  joint: Joint,
  jointStrategy?: string,
): AssemblyHardwareRequirement[] {
  const effectiveKind =
    joint.kind === 'confirmat' && jointStrategy ? jointStrategy : joint.kind;
  const contactLengthMm = joint.region ? joint.region.end - joint.region.start : undefined;

  if (effectiveKind === 'dowel-and-confirmat') {
    const units = getHardwareCountForJoint('confirmat', contactLengthMm);
    const dowelUnits = Math.min(2, units);
    const items: AssemblyHardwareRequirement[] = [];
    if (units > 0) {
      items.push({
        type: 'confirmat',
        label: 'Tornillo Confirmat 7×50 mm',
        quantity: units,
        toolRequired: 'Llave Allen 4 mm / Mecha 5 mm',
        pilotDrillMm: 5.0,
      });
    }
    if (dowelUnits > 0) {
      items.push({
        type: 'dowel',
        label: 'Tarugo de Madera 8×35 mm',
        quantity: dowelUnits,
        toolRequired: 'Martillo de goma y cola vinílica D3',
        pilotDrillMm: 8.0,
      });
    }
    return items;
  }

  const units = getHardwareCountForJoint(effectiveKind, contactLengthMm);
  if (units <= 0) return [];

  switch (effectiveKind) {
    case 'confirmat':
      return [{
        type: 'confirmat',
        label: 'Tornillo Confirmat 7×50 mm',
        quantity: units,
        toolRequired: 'Llave Allen 4 mm / Mecha 5 mm',
        pilotDrillMm: 5.0,
      }];
    case 'cam-dowel':
      return [{
        type: 'minifix',
        label: 'Minifix Ø15 mm + Perno',
        quantity: units,
        toolRequired: 'Destornillador PZ2 / Mecha Forstner 15 mm',
        pilotDrillMm: 5.0,
      }];
    case 'dowel':
      return [{
        type: 'dowel',
        label: 'Tarugo de Madera 8×35 mm',
        quantity: units,
        toolRequired: 'Martillo de goma y cola vinílica D3',
        pilotDrillMm: 8.0,
      }];
    case 'screw':
      return [{
        type: 'wood-screw',
        label: 'Tornillo Madera / Armado 4×40 mm',
        quantity: units,
        toolRequired: 'Destornillador PZ2 / Mecha 3 mm',
        pilotDrillMm: 3.0,
      }];
    case 'shelf-pin':
      return [{
        type: 'shelf-pin',
        label: 'Soporte / Pin de Estante Ø5 mm',
        quantity: units,
        toolRequired: 'Mecha 5 mm (System 32)',
        pilotDrillMm: 5.0,
      }];
    case 'slide':
      return [{
        type: 'slide',
        label: 'Corredera Telescópica (guía lateral; 2 = 1 par)',
        quantity: units,
        toolRequired: 'Destornillador PH2 / Tornillos 3.5×16 mm',
      }];
    case 'hinge':
      return [{
        type: 'hinge-plate',
        label: 'Bisagra Cazoleta Ø35 mm',
        quantity: units,
        toolRequired: 'Mecha Forstner 35 mm / Destornillador PH2',
      }];
    case 'butt-hinge':
      return [{
        type: 'hinge-plate',
        label: 'Bisagra Libro / Pomela',
        quantity: units,
        toolRequired: 'Destornillador PH2',
      }];
    case 'piano-hinge':
      return [{
        type: 'hinge-plate',
        label: 'Bisagra Piano Continua',
        quantity: units,
        toolRequired: 'Destornillador PH2',
      }];
    case 'handle':
      return [{
        type: 'bracket',
        label: 'Tirador / Manija con Tornillos M4',
        quantity: units,
        toolRequired: 'Mecha 4.5 mm / Destornillador PH2',
        pilotDrillMm: 4.5,
      }];
    case 'magnetic-catch':
      return [{
        type: 'bracket',
        label: 'Retén Magnético con Contraplaca',
        quantity: units,
        toolRequired: 'Destornillador PH2',
      }];
    case 'push-catch':
      return [{
        type: 'bracket',
        label: 'Expulsor Push-to-Open',
        quantity: units,
        toolRequired: 'Destornillador PH2',
      }];
    case 'roller-catch':
      return [{
        type: 'bracket',
        label: 'Retén a Rodillo',
        quantity: units,
        toolRequired: 'Destornillador PH2',
      }];
    default:
      return [];
  }
}

function mergeHardwareRequirements(
  items: AssemblyHardwareRequirement[],
): AssemblyHardwareRequirement[] {
  const map = new Map<string, AssemblyHardwareRequirement>();
  for (const h of items) {
    const existing = map.get(h.label);
    if (existing) {
      existing.quantity += h.quantity;
    } else {
      map.set(h.label, { ...h });
    }
  }
  return Array.from(map.values());
}

function summarizeHardwareList(items: AssemblyHardwareRequirement[], fallback: string): string {
  if (items.length === 0) return fallback;
  return items.map((h) => `${h.quantity}× ${h.label}`).join(' + ');
}

/**
 * Resolves the 2D planar cut dimensions for a piece.
 * Consumes the exact cut dimensions (Cut Width x Cut Height x Thickness) identical to the Cut List CSV.
 * Preserves 0.1 mm decimal precision so 0.8 mm edgeband deductions stay aligned across CSV, PieceList, Labels and Guide.
 */
export function getPieceCutDimensions(
  piece: ResolvedPiece | { dimensionsMm?: { width: number; height: number }; cutDimensionsMm?: { width: number; height: number }; thicknessMm?: number; contour: { points: { x: number; y: number }[] } },
): {
  width: number;
  height: number;
  thickness: number;
} {
  const thickness = piece.thicknessMm ?? 18;
  const round1 = (v: number) => Math.round(v * 10) / 10;

  if ('cutDimensionsMm' in piece && piece.cutDimensionsMm) {
    return {
      width: round1(piece.cutDimensionsMm.width),
      height: round1(piece.cutDimensionsMm.height),
      thickness,
    };
  }

  if ('dimensionsMm' in piece && piece.dimensionsMm) {
    return {
      width: round1(piece.dimensionsMm.width),
      height: round1(piece.dimensionsMm.height),
      thickness,
    };
  }

  const polyMinX = Math.min(...piece.contour.points.map((pt) => pt.x));
  const polyMaxX = Math.max(...piece.contour.points.map((pt) => pt.x));
  const polyMinY = Math.min(...piece.contour.points.map((pt) => pt.y));
  const polyMaxY = Math.max(...piece.contour.points.map((pt) => pt.y));

  return {
    width: round1(Math.max(1, polyMaxX - polyMinX)),
    height: round1(Math.max(1, polyMaxY - polyMinY)),
    thickness,
  };
}

/**
 * Generate sequential assembly steps for the manual workshop.
 * Computes exact squaring diagonals, exploded mapping, panel pre-assembly details,
 * and uses assembly gauges (e.g., G1, G2) for precise shelf and divider placement without measuring.
 */
export function generateAssemblySheet(input: GenerateAssemblySheetInput): AssemblySheet {
  const { module } = input;
  const pieces = module.pieces.filter((p) => !p.isAuxiliary);
  const joints = module.joints;
  const gauges = input.gauges ?? deriveAssemblyGauges({ pieces, joints }, input.machiningConfig);
  const machiningSheets = input.machiningSheets ?? [];

  // Calculate overall bounding box dimensions
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const p of pieces) {
    const pos = p.positionMm ?? { x: 0, y: 0, z: 0 };
    const size = determinePieceSpatialSize(p);
    minX = Math.min(minX, pos.x);
    maxX = Math.max(maxX, pos.x + size.x);
    minY = Math.min(minY, pos.y);
    maxY = Math.max(maxY, pos.y + size.y);
    minZ = Math.min(minZ, pos.z);
    maxZ = Math.max(maxZ, pos.z + size.z);
  }

  const modWidth = input.moduleDimensions?.width ??
    (Number.isFinite(maxX - minX) && (maxX - minX) > 0 ? Math.round(maxX - minX) : 600);
  const modHeight = input.moduleDimensions?.height ??
    (Number.isFinite(maxY - minY) && (maxY - minY) > 0 ? Math.round(maxY - minY) : 800);
  const modDepth = input.moduleDimensions?.depth ??
    (Number.isFinite(maxZ - minZ) && (maxZ - minZ) > 0 ? Math.round(maxZ - minZ) : 550);

  // Exact squaring diagonal calculation (Pythagoras theorem on frontal carcass rectangle)
  const squaringDiagonalMm = Math.round(Math.hypot(modWidth, modHeight) * 10) / 10;

  // Gauge lookup map by lower & upper piece ids
  const gaugeByPair = new Map<string, string>();
  for (const g of gauges) {
    for (const occ of g.occurrences) {
      gaugeByPair.set(`${occ.lowerPieceId}->${occ.upperPieceId}`, g.label);
    }
  }

  // Identify key carcass pieces
  const sideLeft = pieces.find((p) => p.role.includes('side-left') || (p.role.includes('side') && p.role.includes('1')));
  const sideRight = pieces.find((p) => p.role.includes('side-right') || (p.role.includes('side') && p.role.includes('2')));
  const bottom = pieces.find((p) => p.role.includes('bottom'));
  const back = pieces.find((p) => p.role.includes('back'));
  const rails = pieces.filter((p) => p.role.includes('rail'));
  const top = pieces.find((p) => p.role.includes('top') && !p.role.includes('rail'));
  const shelves = pieces
    .filter((p) => p.role.includes('shelf'))
    .sort((a, b) => a.positionMm.y - b.positionMm.y);
  const partitions = pieces
    .filter((p) => p.role.includes('partition') || p.role.includes('divider'))
    .sort((a, b) => a.positionMm.x - b.positionMm.x);
  const drawers = pieces.filter((p) => p.role.includes('drawer'));
  const doors = pieces.filter((p) => p.role.includes('door'));

  // 1. Build Exploded Piece Mapping (#1, #2, #3...)
  const sortedPiecesForExplosion = [
    ...(sideLeft ? [sideLeft] : []),
    ...(sideRight && sideRight.id !== sideLeft?.id ? [sideRight] : []),
    ...(bottom ? [bottom] : []),
    ...(top ? [top] : []),
    ...rails,
    ...shelves,
    ...partitions,
    ...(back ? [back] : []),
    ...doors,
    ...drawers,
  ];

  // Append any pieces not yet categorized
  for (const p of pieces) {
    if (!sortedPiecesForExplosion.some((sp) => sp.id === p.id)) {
      sortedPiecesForExplosion.push(p);
    }
  }

  const pieceRefMap = new Map<string, number>();
  const explodedMap: ExplodedPieceMapItem[] = [];

  sortedPiecesForExplosion.forEach((p, idx) => {
    const refNum = idx + 1;
    pieceRefMap.set(p.id, refNum);
    const cutDims = getPieceCutDimensions(p);

    // Compute exploded visual displacement offset
    let dx = 0;
    let dy = 0;
    let dz = 0;
    const r = p.role.toLowerCase();

    if (r.includes('side-left') || (r.includes('side') && r.includes('1'))) {
      dx = -140;
    } else if (r.includes('side-right') || (r.includes('side') && r.includes('2'))) {
      dx = 140;
    } else if (r.includes('bottom')) {
      dy = -100;
    } else if (r.includes('top') || r.includes('rail')) {
      dy = 100;
    } else if (r.includes('back')) {
      dz = -160;
    } else if (r.includes('door') || r.includes('drawer-front')) {
      dz = 160;
    } else if (r.includes('shelf')) {
      dy = 0;
    }

    // Determine real edge band summary from piece faces / bandedEdges
    const rawBandedList = ('bandedEdges' in p && Array.isArray((p as { bandedEdges?: Array<{ faceId: string; thicknessMm: number }> }).bandedEdges))
      ? (p as { bandedEdges: Array<{ faceId: string; thicknessMm: number }> }).bandedEdges
      : (p.faces ?? [])
          .filter((f) => Boolean(f.edgeBandId))
          .map((f) => ({ faceId: f.id, thicknessMm: 0 }));

    let bandedSummary = 'Sin tapacantos';
    if (rawBandedList.length > 0) {
      const edgeNameMap: Record<string, string> = {
        'top-edge': 'Sup',
        'bottom-edge': 'Inf',
        'left-edge': 'Izq',
        'right-edge': 'Der',
      };
      const names = rawBandedList.map((b) => {
        const label = edgeNameMap[b.faceId] ?? b.faceId;
        return b.thicknessMm > 0 ? `${label} (${b.thicknessMm} mm)` : label;
      });
      bandedSummary = names.length === 4 ? `4 cantos${rawBandedList[0]?.thicknessMm ? ` (${rawBandedList[0].thicknessMm} mm)` : ''}` : names.join(' · ');
    }

    // Count prepared hardware for this piece
    const pieceSheet = machiningSheets.find((s) => s.pieceId === p.id);
    const preparedCount = pieceSheet?.totalOperations ?? 0;

    explodedMap.push({
      referenceNumber: refNum,
      pieceId: p.id,
      role: p.role,
      name: getFriendlyPieceName(p.role),
      dimensionsMm: cutDims,
      materialId: p.materialId,
      bandedEdgesSummary: bandedSummary,
      hardwarePreparedCount: preparedCount,
      displacementOffsetMm: { x: dx, y: dy, z: dz },
    });
  });

  // 2. Build Panel Pre-assembly Detail Views (Sides, Partitions, Bottom, Doors)
  const panelDetails: PanelDetailItem[] = [];
  const panelsRequiringDetail = pieces.filter((p) => {
    const r = p.role.toLowerCase();
    return (
      r.includes('side') ||
      r.includes('partition') ||
      r.includes('divider') ||
      (r.includes('bottom') && joints.some((j) => j.a.pieceId === p.id || j.b.pieceId === p.id)) ||
      r.includes('door') ||
      r.includes('drawer-front')
    );
  });

  for (const panel of panelsRequiringDetail) {
    const refNum = pieceRefMap.get(panel.id) ?? 1;
    const cutDims = getPieceCutDimensions(panel);
    const panelSheet = machiningSheets.find((s) => s.pieceId === panel.id);
    const panelOps: PanelDetailItem['operations'] = [];
    const panelHardware: AssemblyHardwareRequirement[] = [];

    // Extract operations from machining sheets if available (1:1 parity with PieceMachiningSheet.totalOperations)
    if (panelSheet && panelSheet.totalOperations > 0) {
      // Exclude synthetic mirrored through-hole duplicates (-through-A / -through-B) so each physical hole counts once
      const primaryFaceOps = [
        ...panelSheet.faceAOperations.filter((op) => !op.id.endsWith('-through-A')),
        ...panelSheet.faceBOperations.filter((op) => !op.id.endsWith('-through-B')),
      ];

      for (const op of primaryFaceOps) {
        panelOps.push({
          yFromBottomMm: Math.round(op.distFromBottomMm),
          xFromFrontMm: Math.round(op.distFromLeftMm),
          description: op.description,
          hardwareType: op.sourceJointKind ?? 'drill',
          drillSpecs: `ø${op.diameterMm} × ${op.depthMm} mm`,
        });
      }

      // Include edge operations (confirmat/dowel/minifix edge cores)
      for (const op of panelSheet.edgeOperations) {
        panelOps.push({
          yFromBottomMm: Math.round(op.distFromBottomMm),
          xFromFrontMm: Math.round(op.distFromLeftMm),
          description: op.description,
          hardwareType: op.sourceJointKind ?? 'edge-drill',
          drillSpecs: `Canto ø${op.diameterMm} × ${op.depthMm} mm`,
        });
      }

      // Include non-drill custom operations (grooves, rebates, pockets, edge profiles)
      for (const cop of panelSheet.customOperations ?? []) {
        if (cop.kind === 'drill') continue;
        if (cop.kind === 'groove') {
          panelOps.push({
            yFromBottomMm: Math.round(cop.axis === 'x' ? cop.offsetMm : (cop.startMm ?? 0)),
            xFromFrontMm: Math.round(cop.axis === 'y' ? cop.offsetMm : (cop.startMm ?? 0)),
            description: cop.description ?? `Ranura ${cop.widthMm}×${cop.depthMm} mm`,
            hardwareType: 'groove',
            drillSpecs: `Ranura ${cop.widthMm} × ${cop.depthMm} mm`,
          });
        } else if (cop.kind === 'rebate') {
          panelOps.push({
            yFromBottomMm: 0,
            xFromFrontMm: 0,
            description: cop.description ?? `Rebaje ${cop.widthMm}×${cop.depthMm} mm`,
            hardwareType: 'rebate',
            drillSpecs: `Rebaje ${cop.widthMm} × ${cop.depthMm} mm`,
          });
        } else {
          panelOps.push({
            yFromBottomMm: 0,
            xFromFrontMm: 0,
            description: cop.description ?? `Mecanizado especial (${cop.kind})`,
            hardwareType: cop.kind,
            drillSpecs: cop.kind,
          });
        }
      }
    } else {
      // Fallback: derive operations from module geometry and joints
      const panelHeight = cutDims.height;
      const panelDepth = cutDims.width > 0 ? cutDims.width : modDepth;

      // Bottom joint
      if (panel.role.includes('side')) {
        panelOps.push({
          yFromBottomMm: 9,
          xFromFrontMm: 50,
          description: 'Orificio confirmat unión con base/piso',
          hardwareType: 'confirmat',
          drillSpecs: 'ø5 x 50 mm (pasante)',
        });
        panelOps.push({
          yFromBottomMm: 9,
          xFromFrontMm: Math.max(50, panelDepth - 50),
          description: 'Orificio confirmat unión con base/piso',
          hardwareType: 'confirmat',
          drillSpecs: 'ø5 x 50 mm (pasante)',
        });

        // Top joint
        panelOps.push({
          yFromBottomMm: Math.max(9, panelHeight - 9),
          xFromFrontMm: 50,
          description: 'Orificio confirmat unión con techo/faja',
          hardwareType: 'confirmat',
          drillSpecs: 'ø5 x 50 mm (pasante)',
        });
        panelOps.push({
          yFromBottomMm: Math.max(9, panelHeight - 9),
          xFromFrontMm: Math.max(50, panelDepth - 50),
          description: 'Orificio confirmat unión con techo/faja',
          hardwareType: 'confirmat',
          drillSpecs: 'ø5 x 50 mm (pasante)',
        });

        // Shelf joints
        for (const shelf of shelves) {
          const shelfRelY = Math.round(shelf.positionMm.y + 9);
          panelOps.push({
            yFromBottomMm: shelfRelY,
            xFromFrontMm: 50,
            description: `Fijación estante ${shelf.id}`,
            hardwareType: 'confirmat',
            drillSpecs: 'ø5 x 50 mm',
          });
          panelOps.push({
            yFromBottomMm: shelfRelY,
            xFromFrontMm: Math.max(50, panelDepth - 50),
            description: `Fijación estante ${shelf.id}`,
            hardwareType: 'confirmat',
            drillSpecs: 'ø5 x 50 mm',
          });
        }
      }
    }

    // Hardware summary for this panel (accurate across all joint strategies)
    const confirmatOps = panelOps.filter(
      (o) =>
        (o.hardwareType === 'confirmat' ||
          (o.hardwareType === 'dowel-and-confirmat' && !o.description.toLowerCase().includes('tarugo'))),
    );
    if (confirmatOps.length > 0) {
      panelHardware.push({
        type: 'confirmat',
        label: 'Tornillo Confirmat 7×50 mm',
        quantity: confirmatOps.length,
        toolRequired: 'Llave Allen 4 mm / Mecha 5 mm',
        pilotDrillMm: 5.0,
      });
    }

    const minifixOps = panelOps.filter(
      (o) => o.hardwareType === 'cam-dowel' || o.hardwareType.includes('minifix'),
    );
    if (minifixOps.length > 0) {
      panelHardware.push({
        type: 'minifix',
        label: 'Minifix Ø15 mm + Perno',
        quantity: minifixOps.length,
        toolRequired: 'Destornillador PZ2 / Mecha Forstner 15 mm',
        pilotDrillMm: 5.0,
      });
    }

    const dowelOps = panelOps.filter(
      (o) =>
        o.hardwareType === 'dowel' ||
        (o.hardwareType === 'dowel-and-confirmat' && o.description.toLowerCase().includes('tarugo')),
    );
    if (dowelOps.length > 0) {
      panelHardware.push({
        type: 'dowel',
        label: 'Tarugo de Madera 8×35 mm',
        quantity: dowelOps.length,
        toolRequired: 'Martillo de goma y cola vinílica D3',
        pilotDrillMm: 8.0,
      });
    }

    const screwOps = panelOps.filter((o) => o.hardwareType === 'screw');
    if (screwOps.length > 0) {
      panelHardware.push({
        type: 'wood-screw',
        label: 'Tornillo Madera / Armado 4×40 mm',
        quantity: screwOps.length,
        toolRequired: 'Destornillador PZ2 / Mecha 3 mm',
        pilotDrillMm: 3.0,
      });
    }

    const shelfPinOps = panelOps.filter((o) => o.hardwareType === 'shelf-pin');
    if (shelfPinOps.length > 0) {
      panelHardware.push({
        type: 'shelf-pin',
        label: 'Soporte / Pin de Estante Ø5 mm',
        quantity: shelfPinOps.length,
        toolRequired: 'Mecha 5 mm (System 32)',
        pilotDrillMm: 5.0,
      });
    }

    const panelHingeJointCount = joints.filter(
      (j) => (j.kind === 'hinge' || j.kind === 'butt-hinge' || j.kind === 'piano-hinge') &&
        (j.a.pieceId === panel.id || j.b.pieceId === panel.id),
    ).length;
    if (panelHingeJointCount > 0 && panel.role.includes('side')) {
      panelHardware.push({
        type: 'hinge-plate',
        label: 'Bases de bisagra cazoleta (System 32)',
        quantity: panelHingeJointCount,
        toolRequired: 'Destornillador PH2 / Tornillos 3.5x16 mm',
      });
    }

    const realPanelBanded = panelSheet?.bandedEdges ?? {
      top: (panel.faces ?? []).some((f) => f.id.includes('top') && Boolean(f.edgeBandId)),
      bottom: (panel.faces ?? []).some((f) => f.id.includes('bottom') && Boolean(f.edgeBandId)),
      left: (panel.faces ?? []).some((f) => f.id.includes('left') && Boolean(f.edgeBandId)),
      right: (panel.faces ?? []).some((f) => f.id.includes('right') && Boolean(f.edgeBandId)),
    };

    panelDetails.push({
      pieceId: panel.id,
      referenceNumber: refNum,
      role: panel.role,
      name: getFriendlyPieceName(panel.role),
      dimensionsMm: cutDims,
      bandedEdges: realPanelBanded,
      datumNotes: 'Origen Datum (0,0): Esquina inferior frontal. Todas las cotas medidas en mm desde esta referencia.',
      hardwareInstalled: panelHardware,
      operations: panelOps,
    });
  }

  // 3. Sequential Assembly Steps with Exact Metrics & SSOT Hardware derived from module.joints
  const steps: AssemblyStep[] = [];
  let stepNumber = 1;
  const effectiveJointStrategy = input.machiningConfig?.jointStrategy;
  const consumedJointIndices = new Set<number>();

  const consumeJointHardware = (predicate: (j: Joint) => boolean): AssemblyHardwareRequirement[] => {
    const collected: AssemblyHardwareRequirement[] = [];
    joints.forEach((joint, idx) => {
      if (consumedJointIndices.has(idx)) return;
      if (!predicate(joint)) return;
      consumedJointIndices.add(idx);
      collected.push(...mapJointToHardwareRequirements(joint, effectiveJointStrategy));
    });
    return mergeHardwareRequirements(collected);
  };

  const formatPieceRef = (piece: ResolvedPiece): string => {
    const ref = pieceRefMap.get(piece.id);
    const label = getFriendlyPieceName(piece.role);
    return ref ? `${label} (#${ref})` : label;
  };

  // Detect real edge band thicknesses present in the module (no hardcoded "2 mm")
  const distinctBandThicknesses = new Set<number>();
  for (const p of pieces) {
    if ('bandedEdges' in p && Array.isArray((p as { bandedEdges?: Array<{ thicknessMm: number }> }).bandedEdges)) {
      for (const b of (p as { bandedEdges: Array<{ thicknessMm: number }> }).bandedEdges) {
        if (b.thicknessMm > 0) distinctBandThicknesses.add(b.thicknessMm);
      }
    }
  }
  const frontBandTip =
    distinctBandThicknesses.size > 0
      ? `Identificar los cantos con tapacanto aplicado (${Array.from(distinctBandThicknesses)
          .sort((a, b) => a - b)
          .map((t) => `${t} mm`)
          .join(' / ')}) para mantener la cara frontal orientada hacia el frente de trabajo.`
      : 'Identificar la cara frontal de cada panel para mantener la alineación del frente durante el armado.';

  // Step 1: Preparation & Verification
  const gaugeSummary = gauges.length > 0
    ? gauges.map((g) => `${g.label} (${g.clearSpanMm} mm)`).join(', ')
    : 'Ninguno requerido';

  const toolsPreparation = [
    'Cinta métrica metálica',
    'Escuadra de comprobación 90°',
    'Llave Allen 4 mm o punta hexagonal 4 mm',
    'Destornillador punta PZ2 / PH2',
    'Mecha escalonada para confirmat 5x7 mm',
    'Martillo de goma con taco mártir de madera',
    'Prensas sargento (mínimo 2 unidades)',
  ];

  steps.push({
    stepNumber: stepNumber++,
    phase: 'preparation',
    title: 'Preparación y Verificación de Calibres',
    instruction: `Disponer todos los paneles cortados (#1 a #${explodedMap.length}) sobre el banco de trabajo limpio. Verificar calibres de montaje: ${gaugeSummary}. Inspeccionar cantos y perforaciones.`,
    piecesInvolved: pieces.map((p) => p.id),
    gaugesInvolved: gauges.map((g) => g.label),
    hardwareRequirements: [],
    hardwareSummary: 'Verificación visual de tornillería y calibres',
    toolsRequired: toolsPreparation,
    workshopTips: [
      'Asegurar que el banco de trabajo esté libre de aserrín o virutas para prevenir rayaduras en la melamina.',
      frontBandTip,
    ],
    notes: 'Asegurar que el banco de trabajo esté limpio y plano para prevenir rayaduras en las superficies.',
  });

  // Step 2: Pre-machining and Hardware on Flat Panels (slides mounted on sides/partitions before assembly)
  const sideIds = [sideLeft?.id, sideRight?.id].filter((id): id is string => Boolean(id));
  if (sideIds.length > 0) {
    const preAssemblyHardware = consumeJointHardware((j) => j.kind === 'slide');

    steps.push({
      stepNumber: stepNumber++,
      phase: 'pre-assembly',
      title: 'Pre-mecanizado e Inserción de Herrajes en Banco',
      instruction: 'Colocar tarugos, pernos minifix, guías de cajón o bases de bisagra en los laterales en plano sobre el banco de trabajo según las cotas milimétricas del plano de detalle.',
      piecesInvolved: sideIds,
      gaugesInvolved: [],
      hardwareRequirements: preAssemblyHardware,
      hardwareSummary: summarizeHardwareList(
        preAssemblyHardware,
        `${joints.length} conexiones de unión planificadas`,
      ),
      toolsRequired: ['Destornillador PZ2 / PH2', 'Martillo de goma', 'Cola vinílica'],
      workshopTips: [
        'Montar herrajes sobre paneles en plano en el banco es 4 veces más rápido y previene desalineaciones durante el ensamble del casco.',
        'No introducir los tarugos a golpes secos directos: use siempre taco mártir para no dañar los cantos melamínicos.',
      ],
      notes: 'Montar herrajes sobre paneles en plano es más rápido y previene desalineaciones durante el ensamble del casco.',
    });
  }

  // Step 3: Base Carcass Assembly (Bottom + Left Side)
  if (bottom && sideLeft) {
    const bottomLeftHardware = consumeJointHardware(
      (j) =>
        (j.a.pieceId === bottom.id && j.b.pieceId === sideLeft.id) ||
        (j.a.pieceId === sideLeft.id && j.b.pieceId === bottom.id),
    );

    steps.push({
      stepNumber: stepNumber++,
      phase: 'carcass',
      title: 'Ensamblar Base con Lateral Izquierdo',
      instruction: `Posicionar ${formatPieceRef(bottom)} contra ${formatPieceRef(sideLeft)}. Enrasar cantos y fijar uniones firmemente.`,
      piecesInvolved: [bottom.id, sideLeft.id],
      gaugesInvolved: [],
      hardwareRequirements: bottomLeftHardware,
      hardwareSummary: summarizeHardwareList(bottomLeftHardware, 'Unión de casco base-lateral'),
      toolsRequired: ['Prensa escuadra a 90°', 'Llave Allen 4 mm', 'Mecha piloto 5 mm'],
      referenceEdge: 'front',
      criticalDimensionMm: {
        label: 'Alineación de canto frontal',
        valueMm: 0.0,
        toleranceMm: 0.5,
      },
      workshopTips: [
        'Alinear los cantos frontales a ras absoluto (0.0 mm) antes de apretar.',
        back
          ? `Verificar la alineación posterior para el fondo de ${back.thicknessMm} mm antes del apriete definitivo.`
          : 'Verificar el escuadrado a 90° entre base y lateral antes del apriete definitivo.',
      ],
    });
  }

  // Step 4: Base Carcass Assembly (Bottom + Right Side)
  if (bottom && sideRight && sideRight.id !== sideLeft?.id) {
    const bottomRightHardware = consumeJointHardware(
      (j) =>
        (j.a.pieceId === bottom.id && j.b.pieceId === sideRight.id) ||
        (j.a.pieceId === sideRight.id && j.b.pieceId === bottom.id),
    );

    steps.push({
      stepNumber: stepNumber++,
      phase: 'carcass',
      title: 'Ensamblar Base con Lateral Derecho',
      instruction: `Posicionar ${formatPieceRef(sideRight)} contra ${formatPieceRef(bottom)}. Enrasar cantos y fijar uniones.`,
      piecesInvolved: [bottom.id, sideRight.id],
      gaugesInvolved: [],
      hardwareRequirements: bottomRightHardware,
      hardwareSummary: summarizeHardwareList(bottomRightHardware, 'Unión de casco base-lateral'),
      toolsRequired: ['Prensa escuadra a 90°', 'Llave Allen 4 mm'],
      referenceEdge: 'front',
      criticalDimensionMm: {
        label: 'Alineación de canto frontal',
        valueMm: 0.0,
        toleranceMm: 0.5,
      },
      workshopTips: [
        'Mantener el módulo apoyado sobre el lateral izquierdo mientras se monta el lateral derecho.',
      ],
    });
  }

  // Step 4b: Vertical Partitions (if present)
  if (partitions.length > 0) {
    const partitionIdSet = new Set(partitions.map((p) => p.id));
    const shelfIdSetForFilter = new Set(shelves.map((s) => s.id));
    const drawerIdSetForFilter = new Set(drawers.map((d) => d.id));
    const doorIdSetForFilter = new Set(doors.map((d) => d.id));
    const partitionHardware = consumeJointHardware(
      (j) =>
        (partitionIdSet.has(j.a.pieceId) || partitionIdSet.has(j.b.pieceId)) &&
        !shelfIdSetForFilter.has(j.a.pieceId) &&
        !shelfIdSetForFilter.has(j.b.pieceId) &&
        !drawerIdSetForFilter.has(j.a.pieceId) &&
        !drawerIdSetForFilter.has(j.b.pieceId) &&
        !doorIdSetForFilter.has(j.a.pieceId) &&
        !doorIdSetForFilter.has(j.b.pieceId) &&
        j.kind !== 'shelf-pin' &&
        j.kind !== 'hinge' &&
        j.kind !== 'slide',
    );

    if (partitionHardware.length > 0 || partitions.length > 0) {
      const partNames = partitions.map((p) => formatPieceRef(p)).join(', ');
      steps.push({
        stepNumber: stepNumber++,
        phase: 'carcass',
        title: 'Instalar Divisiones Verticales',
        instruction: `Posicionar ${partNames} en las cotas proyectadas sobre la base y fijar uniones estructurales.`,
        piecesInvolved: partitions.map((p) => p.id),
        gaugesInvolved: [],
        hardwareRequirements: partitionHardware,
        hardwareSummary: summarizeHardwareList(partitionHardware, 'Fijación de divisiones verticales'),
        toolsRequired: ['Prensa escuadra a 90°', 'Llave Allen 4 mm'],
        referenceEdge: 'front',
      });
    }
  }

  // Step 5: Sequential Shelves Installation using Gauges
  let previousHorizontalPiece = bottom;

  for (let i = 0; i < shelves.length; i++) {
    const shelf = shelves[i]!;
    const shelfRef = pieceRefMap.get(shelf.id);
    const shelfName = shelfRef ? `estante ${i + 1} (#${shelfRef})` : `estante ${i + 1}`;
    const prevName = previousHorizontalPiece ? formatPieceRef(previousHorizontalPiece) : 'panel inferior (piso)';

    let matchedGaugeLabel: string | undefined;
    if (previousHorizontalPiece) {
      matchedGaugeLabel = gaugeByPair.get(`${previousHorizontalPiece.id}->${shelf.id}`);
    }

    if (!matchedGaugeLabel && gauges.length > 0) {
      const prevThickness = previousHorizontalPiece ? (previousHorizontalPiece.thicknessMm ?? 18) : 18;
      const spanMm = previousHorizontalPiece
        ? shelf.positionMm.y - (previousHorizontalPiece.positionMm.y + prevThickness)
        : shelf.positionMm.y;
      const matched = gauges.find((g) => Math.abs(g.clearSpanMm - spanMm) <= 2.0);
      if (matched) matchedGaugeLabel = matched.label;
    }

    const shelfHardware = consumeJointHardware(
      (j) => j.a.pieceId === shelf.id || j.b.pieceId === shelf.id,
    );
    const isAdjustableShelf = shelfHardware.some((h) => h.type === 'shelf-pin');

    if (matchedGaugeLabel) {
      const matchedGauge = gauges.find((g) => g.label === matchedGaugeLabel);
      const spanVal = matchedGauge?.clearSpanMm ?? 320;

      steps.push({
        stepNumber: stepNumber++,
        phase: 'shelves',
        title: `Instalar ${shelfName} con Calibre ${matchedGaugeLabel}`,
        instruction: `Apoyar el calibre ${matchedGaugeLabel} sobre ${prevName}. Colocar ${shelfName} sobre el calibre ${matchedGaugeLabel}. ${isAdjustableShelf ? 'Insertar los soportes de estante Ø5 mm y apoyar el estante.' : 'Fijar uniones.'}`,
        piecesInvolved: [shelf.id, ...(previousHorizontalPiece ? [previousHorizontalPiece.id] : [])],
        gaugesInvolved: [matchedGaugeLabel],
        hardwareRequirements: shelfHardware,
        hardwareSummary: summarizeHardwareList(
          shelfHardware,
          isAdjustableShelf ? 'Soportes de estante regulable' : 'Fijación estructural de estante',
        ),
        toolsRequired: [
          `Calibre auxiliar ${matchedGaugeLabel}`,
          isAdjustableShelf ? 'Pines de estante Ø5 mm' : 'Llave Allen 4 mm',
        ],
        criticalDimensionMm: {
          label: `Luz libre de vano calibre ${matchedGaugeLabel}`,
          valueMm: spanVal,
          toleranceMm: 0.5,
        },
        workshopTips: [
          `El calibre ${matchedGaugeLabel} garantiza paralelismo exacto sin acumular errores de lectura con cinta métrica.`,
          'Deslizar el calibre suavemente hacia afuera una vez asegurada la primera fijación de cada lado.',
        ],
        notes: `El calibre ${matchedGaugeLabel} garantiza paralelismo exacto sin usar cinta métrica.`,
      });
    } else {
      steps.push({
        stepNumber: stepNumber++,
        phase: 'shelves',
        title: `Instalar ${shelfName}`,
        instruction: `Posicionar ${shelfName} a la altura proyectada sobre ${prevName}. Verificar nivel y ${isAdjustableShelf ? 'apoyar sobre los pines Ø5 mm' : 'fijar uniones'}.`,
        piecesInvolved: [shelf.id],
        gaugesInvolved: [],
        hardwareRequirements: shelfHardware,
        hardwareSummary: summarizeHardwareList(
          shelfHardware,
          isAdjustableShelf ? 'Soportes de estante Ø5 mm' : 'Fijación de estante',
        ),
        toolsRequired: ['Cinta métrica', 'Nivel de burbuja', isAdjustableShelf ? 'Pines de estante Ø5 mm' : 'Llave Allen 4 mm'],
      });
    }

    previousHorizontalPiece = shelf;
  }

  // Step 6: Rails / Top Panel Installation
  if (rails.length > 0) {
    const railIds = rails.map((r) => r.id);
    const railIdSet = new Set(railIds);
    const railHardware = consumeJointHardware(
      (j) => railIdSet.has(j.a.pieceId) || railIdSet.has(j.b.pieceId),
    );
    const railNames = rails.map((r) => formatPieceRef(r)).join(', ');

    steps.push({
      stepNumber: stepNumber++,
      phase: 'rails',
      title: 'Instalar Fajas / Travesaños Superiores',
      instruction: `Posicionar las fajas superiores (${railNames}). Enrasar con el borde superior de los laterales y asegurar uniones firmemente.`,
      piecesInvolved: railIds,
      gaugesInvolved: [],
      hardwareRequirements: railHardware,
      hardwareSummary: summarizeHardwareList(railHardware, 'Fijación de fajas superiores'),
      toolsRequired: ['Prensas sargento', 'Llave Allen 4 mm'],
      workshopTips: [
        'Las fajas delanteras y traseras evitan que el casco sufra deformaciones por alabeo antes de colocar la cubierta o mesada.',
      ],
    });
  } else if (top) {
    const topHardware = consumeJointHardware(
      (j) => j.a.pieceId === top.id || j.b.pieceId === top.id,
    );

    steps.push({
      stepNumber: stepNumber++,
      phase: 'carcass',
      title: 'Instalar Tapa Superior',
      instruction: `Posicionar ${formatPieceRef(top)} enrasada con el borde superior del mueble. Asegurar uniones.`,
      piecesInvolved: [top.id],
      gaugesInvolved: [],
      hardwareRequirements: topHardware,
      hardwareSummary: summarizeHardwareList(topHardware, 'Fijación de tapa superior'),
      toolsRequired: ['Prensas sargento', 'Llave Allen 4 mm'],
      referenceEdge: 'top',
    });
  }

  // Step 7: Squaring and Back Panel (Mathematical Squaring)
  if (back) {
    const backJoints = joints.filter((j) => j.a.pieceId === back.id || j.b.pieceId === back.id);
    const isGroovedBack = backJoints.some((j) => j.kind === 'groove');
    const backHardware = consumeJointHardware(
      (j) => j.a.pieceId === back.id || j.b.pieceId === back.id,
    );

    steps.push({
      stepNumber: stepNumber++,
      phase: 'squaring',
      title: 'Escuadrar Casco y Colocar Fondo',
      instruction: isGroovedBack
        ? `Medir ambas diagonales entre esquinas opuestas del mueble. Verificar que coincidan con tolerancia ≤ 1 mm (valor teórico calculado: ${squaringDiagonalMm} mm). Deslizar ${formatPieceRef(back)} de ${back.thicknessMm} mm por las ranuras perimetrales.`
        : `Medir ambas diagonales entre esquinas opuestas del mueble. Verificar que coincidan con tolerancia ≤ 1 mm (valor teórico calculado: ${squaringDiagonalMm} mm). Colocar y fijar ${formatPieceRef(back)} de ${back.thicknessMm} mm.`,
      piecesInvolved: [back.id],
      gaugesInvolved: [],
      hardwareRequirements: backHardware,
      hardwareSummary: isGroovedBack
        ? `Encastre en ranura perimetral (${back.thicknessMm} mm)`
        : summarizeHardwareList(backHardware, 'Fijación perimetral de fondo'),
      toolsRequired: ['Cinta métrica metálica', 'Destornillador PZ2', 'Prensas de apriete cruzado'],
      criticalDimensionMm: {
        label: 'Diagonal de escuadra teórica calculada (D1 = D2)',
        valueMm: squaringDiagonalMm,
        toleranceMm: 1.0,
      },
      workshopTips: [
        `Comprobar que Diagonal A-D = Diagonal B-C = ${squaringDiagonalMm} mm. Si difieren, ejercer presión diagonal con la prensa sargento hasta igualarlas.`,
        'El fondo rigidiza y bloquea la escuadra permanente del mueble; nunca fijarlo si las diagonales difieren más de 1 mm.',
      ],
      notes: 'El casco debe estar perfectamente a escuadra antes de fijar el fondo.',
    });
  } else {
    steps.push({
      stepNumber: stepNumber++,
      phase: 'squaring',
      title: 'Escuadrar Casco Estructural',
      instruction: `Medir ambas diagonales entre esquinas opuestas del mueble. Verificar que coincidan con tolerancia ≤ 1 mm (valor teórico calculado: ${squaringDiagonalMm} mm). Ajustar prensas sargento hasta igualar diagonales y apretar definitivamente todas las uniones.`,
      piecesInvolved: pieces.filter((p) => p.role.includes('side') || p.role.includes('bottom') || p.role.includes('top')).map((p) => p.id),
      gaugesInvolved: [],
      hardwareRequirements: [],
      hardwareSummary: 'Verificación de escuadra con cinta métrica',
      toolsRequired: ['Cinta métrica metálica', 'Prensas de apriete cruzado'],
      criticalDimensionMm: {
        label: 'Diagonal de escuadra teórica calculada (D1 = D2)',
        valueMm: squaringDiagonalMm,
        toleranceMm: 1.0,
      },
      workshopTips: [
        `Comprobar que Diagonal A-D = Diagonal B-C = ${squaringDiagonalMm} mm. Ambas lecturas deben ser idénticas antes de retirar las prensas.`,
      ],
      notes: 'El casco debe estar perfectamente a escuadra antes del apriete final.',
    });
  }

  // Step 8: Sub-assemblies (Drawers & Doors) + any remaining joints
  const drawerAndDoorIds = new Set([...drawers.map((d) => d.id), ...doors.map((d) => d.id)]);
  if (drawers.length > 0 || doors.length > 0) {
    const subAssemblyHardware = consumeJointHardware(
      (j) =>
        drawerAndDoorIds.has(j.a.pieceId) ||
        drawerAndDoorIds.has(j.b.pieceId) ||
        j.kind === 'hinge' ||
        j.kind === 'butt-hinge' ||
        j.kind === 'piano-hinge' ||
        j.kind === 'handle',
    );

    steps.push({
      stepNumber: stepNumber++,
      phase: 'drawers',
      title: 'Armado y Montaje de Cajones, Frentes y Puertas',
      instruction: 'Armar las cajas de cajón, deslizarlas sobre sus guías telescópicas y montar las puertas con sus bisagras. Calibrar las luces perimetrales de 2.0 mm mediante regulación tridimensional.',
      piecesInvolved: [...drawers.map((d) => d.id), ...doors.map((d) => d.id)],
      gaugesInvolved: [],
      hardwareRequirements: subAssemblyHardware,
      hardwareSummary: summarizeHardwareList(subAssemblyHardware, 'Herrajes móviles de apertura'),
      toolsRequired: ['Destornillador PH2', 'Espaciadores de 2 mm para luz de frente'],
      criticalDimensionMm: {
        label: 'Luz perimetral entre frentes y casco',
        valueMm: 2.0,
        toleranceMm: 0.5,
      },
      workshopTips: [
        'Utilizar espaciadores de 2 mm en los laterales y base del frente para mantener separación uniforme.',
        'Ajustar el tornillo de profundidad de la bisagra antes de apretar la altura.',
      ],
    });
  }

  // Catch any remaining unconsumed joints (e.g. plinth, middle brace, transoms, hanging rail, pull-out trays)
  const remainingHardware = consumeJointHardware(() => true);
  if (remainingHardware.length > 0) {
    const extraStepTarget =
      steps.find((s) => s.phase === 'rails') ??
      steps.find((s) => s.phase === 'carcass') ??
      steps[steps.length - 1];
    if (extraStepTarget) {
      extraStepTarget.hardwareRequirements = mergeHardwareRequirements([
        ...extraStepTarget.hardwareRequirements,
        ...remainingHardware,
      ]);
      extraStepTarget.hardwareSummary = summarizeHardwareList(
        extraStepTarget.hardwareRequirements,
        extraStepTarget.hardwareSummary ?? 'Fijaciones complementarias',
      );
    }
  }

  // Step 9: Final Quality Inspection
  steps.push({
    stepNumber: stepNumber++,
    phase: 'inspection',
    title: 'Inspección Final de Calidad',
    instruction: 'Retirar todas las tiras de calibre auxiliares del interior del mueble. Verificar apriete de tornillos y limpiar superficies.',
    piecesInvolved: [],
    gaugesInvolved: gauges.map((g) => g.label),
    hardwareRequirements: [],
    hardwareSummary: 'Tapas embellecedoras autoadhesivas',
    toolsRequired: ['Paño de microfibra', 'Solución limpiadora de melamina', 'Tapas cubre-tornillo'],
    workshopTips: [
      'Colocar tapas cubre-tornillo del color exacto de la placa sobre las cabezas de tornillos visibles.',
      'Comprobar la apertura fluida y suave de cajones y puertas sin roces mecánicos.',
    ],
    notes: 'Confirmar que el ancho, alto y profundidad exteriores del módulo cumplan con las especificaciones del diseño.',
  });

  // Calculate Total Hardware BOM across all steps (guaranteed 100% consistent with bom.ts)
  const totalHardwareBOM = mergeHardwareRequirements(
    steps.flatMap((step) => step.hardwareRequirements),
  );

  const displayTitle = input.moduleName?.trim()
    ? `Guía de Armado — ${input.moduleName.trim()}`
    : `Guía de Armado — Módulo ${modWidth}×${modHeight}×${modDepth} mm`;

  return {
    moduleId: module.moduleId,
    title: displayTitle,
    moduleDimensionsMm: {
      width: modWidth,
      height: modHeight,
      depth: modDepth,
    },
    squaringDiagonalMm,
    steps,
    gauges,
    totalSteps: steps.length,
    explodedMap,
    panelDetails,
    totalHardwareBOM,
  };
}

/**
 * Export assembly sheet guide as a clean, printable workshop PDF.
 * Generates an engineering-grade manual with cover specifications,
 * exploded parts map, panel pre-machining Datum details, and sequential checklist.
 */
export function exportAssemblyGuidePdf(
  sheet: AssemblySheet,
  moduleTitle?: string,
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 16;

  // -------------------------------------------------------------
  // PÁGINA 1: Carátula, Especificaciones, BOM y Mapa Explotado
  // -------------------------------------------------------------
  // Header banner
  doc.setFillColor(86, 112, 95); // CadCat Salvia (#56705F)
  doc.rect(margin, y, pageWidth - 2 * margin, 18, 'F');

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('CADCAT — MANUAL TÉCNICO DE ARMADO EN TALLER', margin + 4, y + 8);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const displayModuleBanner = (moduleTitle ?? sheet.title).replace(/^Guía de Armado\s*[—-]\s*/i, '');
  doc.text(`Módulo: ${displayModuleBanner} | Dimensiones: ${sheet.moduleDimensionsMm.width} × ${sheet.moduleDimensionsMm.height} × ${sheet.moduleDimensionsMm.depth} mm | Diagonal Escuadra: ${sheet.squaringDiagonalMm} mm`, margin + 4, y + 14);

  y += 24;
  doc.setTextColor(31, 38, 34); // CadCat Text (#1F2622)

  // Subtitle
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(moduleTitle ?? sheet.title, margin, y);
  y += 7;

  // Total Hardware BOM Table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Cómputo Total de Herrajes y Fijaciones (BOM)', margin, y);
  y += 5;

  doc.setFillColor(237, 232, 220); // CadCat Surface-2 (#EDE8DC)
  doc.rect(margin, y, pageWidth - 2 * margin, 6, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Cant.', margin + 3, y + 4.2);
  doc.text('Herraje / Fijación', margin + 18, y + 4.2);
  doc.text('Herramienta / Broca', margin + 95, y + 4.2);
  doc.text('Fase de Uso', margin + 145, y + 4.2);
  y += 7;

  doc.setFont('helvetica', 'normal');
  for (const h of sheet.totalHardwareBOM) {
    doc.text(`${h.quantity} un.`, margin + 3, y + 3.5);
    doc.text(h.label, margin + 18, y + 3.5);
    doc.text(h.toolRequired ?? 'Punta estándar', margin + 95, y + 3.5);
    doc.text(translateHardwareType(h.type), margin + 145, y + 3.5);
    y += 5.5;
  }
  y += 4;

  // Exploded Piece Map Table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Mapa de Referencias de Piezas (#1, #2...)', margin, y);
  y += 5;

  doc.setFillColor(237, 232, 220);
  doc.rect(margin, y, pageWidth - 2 * margin, 6, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('#Ref', margin + 3, y + 4.2);
  doc.text('Nombre / Rol', margin + 18, y + 4.2);
  doc.text('Medidas Corte (Ancho x Alto x Esp)', margin + 70, y + 4.2);
  doc.text('Especificación de Cantos', margin + 125, y + 4.2);
  y += 7;

  doc.setFont('helvetica', 'normal');
  for (const p of sheet.explodedMap) {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 16;
    }
    doc.setFont('helvetica', 'bold');
    doc.text(`#${p.referenceNumber}`, margin + 3, y + 3.5);
    doc.setFont('helvetica', 'normal');
    doc.text(p.name, margin + 18, y + 3.5);
    doc.text(`${p.dimensionsMm.width} x ${p.dimensionsMm.height} x ${p.dimensionsMm.thickness} mm`, margin + 70, y + 3.5);
    doc.text(p.bandedEdgesSummary, margin + 125, y + 3.5);
    y += 5.2;
  }

  // -------------------------------------------------------------
  // PÁGINA 2: Calibres de Montaje y Pre-mecanizado Datum
  // -------------------------------------------------------------
  doc.addPage();
  y = 16;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('3. Calibres de Montaje Derivados (Tiras Auxiliares de Vano)', margin, y);
  y += 6;

  if (sheet.gauges.length === 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('No se requieren calibres de montaje especiales para este módulo.', margin, y);
    y += 8;
  } else {
    doc.setFillColor(237, 232, 220);
    doc.rect(margin, y, pageWidth - 2 * margin, 6, 'F');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Calibre', margin + 3, y + 4.2);
    doc.text('Luz Libre (Largo)', margin + 25, y + 4.2);
    doc.text('Ancho Tira', margin + 65, y + 4.2);
    doc.text('Cantidad Usos', margin + 95, y + 4.2);
    doc.text('Material / Origen', margin + 130, y + 4.2);
    y += 7;

    doc.setFont('helvetica', 'normal');
    for (const g of sheet.gauges) {
      doc.text(g.label, margin + 3, y + 3.5);
      doc.text(`${g.clearSpanMm} mm`, margin + 25, y + 3.5);
      doc.text(`${g.widthMm} mm`, margin + 65, y + 3.5);
      doc.text(`${g.spansCount} unión(es)`, margin + 95, y + 3.5);
      doc.text('Retazo Auxiliar de Taller', margin + 130, y + 3.5);
      y += 5.5;
    }
    y += 6;
  }

  // Panel Pre-machining Datum Table
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('4. Cotas de Pre-mecanizado en Banco (Datum X=0 Frente, Y=0 Base)', margin, y);
  y += 6;

  for (const pDetail of sheet.panelDetails) {
    if (y > pageHeight - 35) {
      doc.addPage();
      y = 16;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Panel #${pDetail.referenceNumber}: ${pDetail.name} (${pDetail.dimensionsMm.width} x ${pDetail.dimensionsMm.height} x ${pDetail.dimensionsMm.thickness} mm)`, margin, y);
    y += 4.5;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(92, 101, 95);
    doc.text(pDetail.datumNotes, margin, y);
    doc.setTextColor(31, 38, 34);
    y += 4.5;

    if (pDetail.operations.length > 0) {
      doc.setFillColor(245, 243, 236);
      doc.rect(margin, y, pageWidth - 2 * margin, 5, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Cota Y (Base)', margin + 3, y + 3.5);
      doc.text('Cota X (Frente)', margin + 32, y + 3.5);
      doc.text('Mecanizado / Broca', margin + 65, y + 3.5);
      doc.text('Descripción de Operación', margin + 110, y + 3.5);
      y += 6;

      doc.setFont('helvetica', 'normal');
      for (const op of pDetail.operations) {
        if (y > pageHeight - 20) {
          doc.addPage();
          y = 16;
        }
        doc.text(`${op.yFromBottomMm} mm`, margin + 3, y + 3.2);
        doc.text(`${op.xFromFrontMm} mm`, margin + 32, y + 3.2);
        doc.text(op.drillSpecs ?? op.hardwareType, margin + 65, y + 3.2);
        doc.text(op.description, margin + 110, y + 3.2);
        y += 4.8;
      }
    }
    y += 5;
  }

  // -------------------------------------------------------------
  // PÁGINA 3+: Pasos Secuenciales con Diagonales y Checklists
  // -------------------------------------------------------------
  doc.addPage();
  y = 16;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('5. Secuencia de Armado Paso a Paso (Checklist de Taller)', margin, y);
  y += 7;

  for (const step of sheet.steps) {
    if (y > pageHeight - 35) {
      doc.addPage();
      y = 16;
    }

    // Step Header with Box
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`[ ] Paso ${step.stepNumber}: ${step.title}`, margin, y);

    // Phase Tag
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(86, 112, 95);
    doc.text(`[Fase: ${translateAssemblyPhase(step.phase)}]`, pageWidth - margin - 35, y);
    doc.setTextColor(31, 38, 34);
    y += 5;

    // Step Instruction
    doc.setFontSize(9);
    const instructionLines = doc.splitTextToSize(step.instruction, pageWidth - 2 * margin - 6);
    doc.text(instructionLines, margin + 4, y);
    y += instructionLines.length * 4.2;

    // Hardware Requirements callout
    if (step.hardwareRequirements.length > 0) {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      const hwStr = step.hardwareRequirements.map((h) => `${h.quantity}x ${h.label}`).join(' + ');
      doc.text(`→ Fijaciones: ${hwStr}`, margin + 4, y);
      y += 4.2;
    }

    // Critical dimensions
    if (step.criticalDimensionMm) {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(179, 65, 47); // CadCat Danger
      doc.text(`★ COTA CRÍTICA: ${step.criticalDimensionMm.label} = ${step.criticalDimensionMm.valueMm} mm (Tol: ±${step.criticalDimensionMm.toleranceMm} mm)`, margin + 4, y);
      doc.setTextColor(31, 38, 34);
      y += 4.2;
    }

    // Gauges callout
    if (step.gaugesInvolved.length > 0) {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(63, 125, 78); // CadCat Success
      doc.text(`→ Calibres Requeridos: ${step.gaugesInvolved.join(', ')}`, margin + 4, y);
      doc.setTextColor(31, 38, 34);
      y += 4.2;
    }

    // Workshop Tips
    if (step.workshopTips && step.workshopTips.length > 0) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(92, 101, 95);
      for (const tip of step.workshopTips) {
        const tipLines = doc.splitTextToSize(`💡 Tip: ${tip}`, pageWidth - 2 * margin - 6);
        doc.text(tipLines, margin + 4, y);
        y += tipLines.length * 3.8;
      }
      doc.setTextColor(31, 38, 34);
    } else if (step.notes) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(92, 101, 95);
      doc.text(`Nota: ${step.notes}`, margin + 4, y);
      doc.setTextColor(31, 38, 34);
      y += 4;
    }

    y += 3.5;
  }

  return doc;
}
