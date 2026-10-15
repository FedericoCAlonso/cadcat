import type { Module, Piece } from '../../model';
import { validateModule } from '../../model/module';
import { createPiece, createRectangularContour } from '../piece';
import { PlacementTree } from '../tree';
import { solveBrackets } from './bracketSolver';
import type {
  InstallationPoint,
  WallShelvingDefinition,
  WallShelvingHardwareItem,
  WallShelvingOutput,
} from './types';
import type {
  CustomDrillOperation,
  CustomGrooveOperation,
  CustomRebateOperation,
  CustomPocketOperation,
} from '../../model/operation';

type AnyOperation =
  | CustomDrillOperation
  | CustomGrooveOperation
  | CustomRebateOperation
  | CustomPocketOperation;

/**
 * Builds a complete wall shelving module with resolved pieces, edge banding,
 * bracket mechanics, hardware BOM, machinings and installation points.
 */
export function buildWallShelving(
  def: WallShelvingDefinition,
  elasticModulusMPa: number = 3000,
): WallShelvingOutput {
  const {
    id,
    widthMm,
    depthMm,
    thicknessMm,
    shelfCount,
    verticalSpacingMm,
    bracketType,
    boundaryCondition,
    materialId,
    edgeBandId,
    baseElevationYMm = 800,
  } = def;

  // 1. Solve brackets and mechanics
  const bracketCalc = solveBrackets(def, elasticModulusMPa);

  // 2. Determine effective shelf dimensions
  // When between walls (in a niche), deduct 3mm clearance to prevent wall scraping
  const widthDeductionMm = boundaryCondition === 'between-walls' ? 3.0 : 0.0;
  const effectiveWidthMm = Math.max(100, Math.round(widthMm - widthDeductionMm));
  const effectiveDepthMm = Math.max(50, depthMm);

  const pieces: Piece[] = [];
  const operations: AnyOperation[] = [];
  const installationPoints: InstallationPoint[] = [];

  const rootPieceId = `${id}-shelf-0`;
  const placementTree = new PlacementTree(rootPieceId);

  // 3. Generate each shelf piece
  for (let sIdx = 0; sIdx < shelfCount; sIdx++) {
    const shelfId = `${id}-shelf-${sIdx}`;
    const contour = createRectangularContour(effectiveWidthMm, effectiveDepthMm);

    const piece = createPiece({
      id: shelfId,
      role: 'wall-shelf',
      materialId,
      contour,
      thicknessMm,
      structural: false,
      referenceFace: 'A',
    });

    // Apply edge banding according to boundary condition:
    // Seg 0 (bottom-edge): FRONT edge
    // Seg 1 (right-edge): RIGHT edge
    // Seg 2 (top-edge): REAR edge (against wall)
    // Seg 3 (left-edge): LEFT edge
    if (edgeBandId) {
      // Front is always banded
      const frontFace = piece.faces.find((f) => f.id === 'bottom-edge');
      if (frontFace) {
        frontFace.edgeBandId = edgeBandId;
      }

      if (boundaryCondition === 'free-ends') {
        // Left and right ends exposed
        const leftFace = piece.faces.find((f) => f.id === 'left-edge');
        const rightFace = piece.faces.find((f) => f.id === 'right-edge');
        if (leftFace) leftFace.edgeBandId = edgeBandId;
        if (rightFace) rightFace.edgeBandId = edgeBandId;
      }
      // Rear (top-edge) stays raw against the wall
    }

    pieces.push(piece);

    // Placement in 3D:
    // Root shelf (sIdx === 0) at origin (0, 0, 0)
    // Subsequent shelves stacked vertically at relative Y
    if (sIdx > 0) {
      placementTree.setNode({
        pieceId: shelfId,
        parentPieceId: rootPieceId,
        relativeOffset: {
          x: 0,
          y: sIdx * verticalSpacingMm,
          z: 0,
        },
      });
    }

    // Elevation for wall installation marking
    const shelfElevationY = baseElevationYMm + sIdx * verticalSpacingMm;

    // 4. Generate machinings and installation points per bracket
    bracketCalc.bracketPositionsMm.forEach((xPos, bIdx) => {
      installationPoints.push({
        shelfIndex: sIdx,
        bracketIndex: bIdx,
        xMm: xPos,
        yMm: shelfElevationY,
      });

      if (bracketType === 'floating-pin') {
        // Deep bore holes in the rear edge (top-edge) to house invisible pin rods
        operations.push({
          kind: 'drill',
          id: `${shelfId}-floating-pin-${bIdx}`,
          pieceId: shelfId,
          faceType: 'edge',
          xMm: xPos,
          yMm: effectiveDepthMm, // at rear edge
          diameterMm: 12.0,
          depthMm: 120.0,
          isThrough: false,
          description: `Perforación para perno flotante invisible Ø12x120mm`,
        });
      } else if (bracketType === 'l-bracket' || bracketType === 'track-bracket') {
        // Pilot screw holes on underside (face-b) to secure shelf to bracket
        operations.push(
          {
            kind: 'drill',
            id: `${shelfId}-screw-front-${bIdx}`,
            pieceId: shelfId,
            faceType: 'face-B',
            xMm: xPos,
            yMm: Math.round(effectiveDepthMm * 0.35),
            diameterMm: 3.0,
            depthMm: Math.min(12, Math.max(8, thicknessMm - 4)),
            isThrough: false,
            description: `Agujero guía tornillo 4x16mm fijación a ménsula`,
          },
          {
            kind: 'drill',
            id: `${shelfId}-screw-rear-${bIdx}`,
            pieceId: shelfId,
            faceType: 'face-B',
            xMm: xPos,
            yMm: Math.round(effectiveDepthMm * 0.75),
            diameterMm: 3.0,
            depthMm: Math.min(12, Math.max(8, thicknessMm - 4)),
            isThrough: false,
            description: `Agujero guía tornillo 4x16mm fijación a ménsula`,
          },
        );
      }
    });
  }

  // 5. Generate Hardware BOM
  const hardwareBOM: WallShelvingHardwareItem[] = [];
  const totalBrackets = bracketCalc.totalBrackets;

  if (bracketType === 'l-bracket') {
    const legLengthMm = Math.round(effectiveDepthMm * 0.7);
    hardwareBOM.push({
      id: 'hw-l-bracket',
      name: `Ménsula Metálica en L ${legLengthMm}x${legLengthMm} mm`,
      quantity: totalBrackets,
      unit: 'u.',
      purpose: 'Soportes de apoyo a pared para estantería',
    });
    hardwareBOM.push({
      id: 'hw-shelf-screws',
      name: `Tornillo Autorroscante 4x16 mm`,
      quantity: totalBrackets * 2,
      unit: 'u.',
      purpose: 'Fijación de estantes a las ménsulas',
    });
  } else if (bracketType === 'floating-pin') {
    hardwareBOM.push({
      id: 'hw-floating-pin-12',
      name: `Soporte Invisible / Perno Flotante Ø12x120 mm con Pletina`,
      quantity: totalBrackets,
      unit: 'u.',
      purpose: 'Soportes embutidos ocultos de alta carga',
    });
  } else if (bracketType === 'track-bracket') {
    const totalTrackHeight = (shelfCount - 1) * verticalSpacingMm + 250;
    hardwareBOM.push({
      id: 'hw-track-rail',
      name: `Cremallera Vertical Doble Ranura ${totalTrackHeight} mm`,
      quantity: bracketCalc.bracketCountPerShelf,
      unit: 'u.',
      purpose: 'Rieles verticales de pared para ménsulas regulables',
    });
    hardwareBOM.push({
      id: 'hw-track-arm',
      name: `Brazo Ménsula Encastrable ${effectiveDepthMm} mm`,
      quantity: totalBrackets,
      unit: 'u.',
      purpose: 'Ménsulas regulables encastrables en cremallera',
    });
    hardwareBOM.push({
      id: 'hw-shelf-screws',
      name: `Tornillo Autorroscante 4x16 mm`,
      quantity: totalBrackets * 2,
      unit: 'u.',
      purpose: 'Fijación de estantes a los brazos de cremallera',
    });
  }

  // Wall anchors & wall screws
  const wallScrewsPerBracket = bracketType === 'track-bracket' ? Math.max(3, Math.ceil(shelfCount * 1.2)) : 2;
  const totalWallAnchors =
    bracketType === 'track-bracket'
      ? bracketCalc.bracketCountPerShelf * wallScrewsPerBracket
      : totalBrackets * wallScrewsPerBracket;

  hardwareBOM.push({
    id: 'hw-wall-anchor',
    name: `${bracketCalc.recommendedAnchor.brandModel} + Tornillo ${bracketCalc.recommendedAnchor.screwDiameterMm}x${bracketCalc.recommendedAnchor.screwLengthMm} mm`,
    quantity: totalWallAnchors,
    unit: 'u.',
    purpose: `Fijación segura de pared (${def.wallType}) - ${bracketCalc.recommendedAnchor.notes}`,
  });

  const moduleObj: Module = {
    schemaVersion: 1,
    id: def.id,
    parameters: {
      width: def.widthMm,
      height: (def.shelfCount - 1) * def.verticalSpacingMm + def.thicknessMm,
      depth: def.depthMm,
      shelfCount: def.shelfCount,
      verticalSpacingMm: def.verticalSpacingMm,
    },
    rootPieceId,
    pieces,
    joints: [],
    subAssemblies: [],
    overrides: {},
  };

  return {
    module: validateModule(moduleObj),
    bracketCalculation: bracketCalc,
    placementTree,
    operations,
    hardwareBOM,
    installationPoints,
  };
}
