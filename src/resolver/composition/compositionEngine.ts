import {
  type Module,
  type Piece,
  type Joint,
  type SubAssembly,
  type EdgeBand,
} from '../../model';
import { PlacementTree } from '../tree';
import { resolveModule } from '../resolver';
import { applyEdgeBandRule, type ResolvedPieceWithCutSize } from '../edgeBand';
import {
  type ModularModuleDefinition,
  type BayBoundingBox,
} from './types';
import { resolveCarcass } from './anchorSolver';
import { subdivideBay } from './gridSolver';
import { resolveBayContent } from './componentSolver';

export interface ModularBuildOptions {
  carcassThicknessMm?: number;
  frontThicknessMm?: number;
  boxThicknessMm?: number;
  backingThicknessMm?: number;
  drawerBottomScrewedDeductionWidthMm?: number;
  drawerBottomScrewedDeductionDepthMm?: number;
  edgeBands?: EdgeBand[];
}

export interface ModularEngineOutput {
  module: Module;
  placementTree: PlacementTree;
  resolvedPieces: ResolvedPieceWithCutSize[];
  bayBoxes: BayBoundingBox[];
}

/**
 * Builds and resolves a complete furniture module from a modular composition definition.
 */
export function buildModularModule(
  definition: ModularModuleDefinition,
  options: ModularBuildOptions = {},
): ModularEngineOutput {
  const {
    carcassThicknessMm = 18,
    frontThicknessMm = 18,
    boxThicknessMm = 15,
    backingThicknessMm = definition.carcass.backingThicknessMm ?? 3,
    drawerBottomScrewedDeductionWidthMm,
    drawerBottomScrewedDeductionDepthMm,
    edgeBands = [],
  } = options;

  const {
    id,
    carcass,
    grid,
    bays,
    materials,
    edgeBandId,
  } = definition;

  // 1. Solve Carcass Geometry & Boundary Cavity
  const carcassResult = resolveCarcass({
    carcass,
    carcassMaterialId: materials.carcassMaterialId,
    carcassThicknessMm,
    backingMaterialId: materials.backingsMaterialId,
    backingThicknessMm: carcass.backingThicknessMm ?? 3,
    edgeBandId,
    idPrefix: `${id}-carcass`,
  });

  const pieces: Piece[] = [...carcassResult.pieces];
  const joints: Joint[] = [...carcassResult.joints];
  const placementNodes = [...carcassResult.placementNodes];
  const subAssemblies: SubAssembly[] = [];

  const rootPieceId = carcassResult.rootPieceId;

  // 2. Initial Interior Cavity Bay
  const rootBay: BayBoundingBox = {
    bayIndex: 0,
    x: carcassResult.interior.x,
    y: carcassResult.interior.y,
    z: carcassResult.interior.z,
    width: carcassResult.interior.width,
    height: carcassResult.interior.height,
    depth: carcassResult.interior.depth,
    leftPieceId: carcassResult.leftPieceId,
    rightPieceId: carcassResult.rightPieceId,
    bottomPieceId: carcassResult.bottomPieceId,
    topPieceId: carcassResult.topPieceId,
  };

  // 3. Grid Subdivision
  let resolvedBays: BayBoundingBox[] = [rootBay];

  if (grid && grid.tracks.length > 1) {
    const dividerT = grid.dividerThicknessMm ?? carcassThicknessMm;
    const subResult = subdivideBay(
      rootBay,
      grid,
      materials.carcassMaterialId,
      dividerT,
      edgeBandId,
      `${id}-div`,
    );

    pieces.push(...subResult.dividerPieces);
    joints.push(...subResult.dividerJoints);
    placementNodes.push(...subResult.dividerPlacements);
    resolvedBays = subResult.bayBoxes;
  }

  // 4. Equipment of each Bay
  for (let i = 0; i < resolvedBays.length; i++) {
    const bay = resolvedBays[i]!;
    const content = bays[i] ?? { type: 'empty' };

    const compResult = resolveBayContent(
      bay,
      content,
      materials,
      {
        carcassThicknessMm,
        frontThicknessMm,
        boxThicknessMm,
        backingThicknessMm,
        drawerBottomScrewedDeductionWidthMm,
        drawerBottomScrewedDeductionDepthMm,
        edgeBandId,
        rootPieceId,
        idPrefix: `${id}-bay-${i + 1}`,
      },
    );

    pieces.push(...compResult.pieces);
    joints.push(...compResult.joints);
    placementNodes.push(...compResult.placementNodes);
    subAssemblies.push(...compResult.subAssemblies);
  }

  // 5. Apply Manual Piece Material, Thickness, and EdgeBand Overrides if defined
  if (materials.pieceOverrides) {
    for (const piece of pieces) {
      const overrideMat = materials.pieceOverrides[piece.id];
      if (overrideMat) {
        piece.materialId = overrideMat;
      }
    }
  }

  if (materials.pieceThicknessOverrides) {
    for (const piece of pieces) {
      const overrideT = materials.pieceThicknessOverrides[piece.id];
      if (overrideT && overrideT > 0) {
        piece.thicknessMm = overrideT;
      }
    }
  }

  if (materials.pieceEdgeBandOverrides) {
    for (const piece of pieces) {
      const ebOverride = materials.pieceEdgeBandOverrides[piece.id];
      if (ebOverride) {
        const bandId = ebOverride.edgeBandId ?? edgeBandId;
        for (const face of piece.faces) {
          const fId = face.id.toLowerCase();
          if (fId.includes('top')) face.edgeBandId = ebOverride.top ? bandId : undefined;
          if (fId.includes('bottom')) face.edgeBandId = ebOverride.bottom ? bandId : undefined;
          if (fId.includes('left')) face.edgeBandId = ebOverride.left ? bandId : undefined;
          if (fId.includes('right')) face.edgeBandId = ebOverride.right ? bandId : undefined;
        }
      }
    }
  }

  // 6. Assemble PlacementTree
  const placementTree = new PlacementTree(rootPieceId);
  for (const node of placementNodes) {
    placementTree.setNode(node);
  }

  // 7. Assemble Module
  const module: Module = {
    schemaVersion: 1,
    id,
    parameters: {
      width: carcass.width,
      height: carcass.height,
      depth: carcass.depth,
    },
    rootPieceId,
    pieces,
    joints,
    subAssemblies,
    overrides: {},
  };

  // 8. Resolve Module Positions and Cut Sizes
  const resolved = resolveModule({ module, placementTree });
  const resolvedPieces = resolved.pieces.map((p) =>
    applyEdgeBandRule(p, edgeBands),
  );

  return {
    module,
    placementTree,
    resolvedPieces,
    bayBoxes: resolvedBays,
  };
}
