import {
  type Module,
  type Piece,
  type Joint,
  type Material,
  type EdgeBand,
} from '../../model';
import {
  createPiece,
  createJoint,
  createRectangularContour,
  PlacementTree,
  resolveModule,
  applyEdgeBandRule,
  type ResolvedPieceWithCutSize,
} from '../index';

export interface BaseCabinetParams {
  width: number;
  height: number;
  depth: number;
  shelfOffset?: number;
}

export const DEFAULT_BASE_CABINET_PARAMS: BaseCabinetParams = {
  width: 600,
  height: 800,
  depth: 560,
};

/**
 * Base Cabinet template:
 * - Two sides (side-left, side-right)
 * - Bottom panel (bottom)
 * - Top rails (rail-front, rail-back)
 * - Back panel (back)
 * - One shelf (shelf-1)
 */
export function buildBaseCabinet(
  params: BaseCabinetParams,
  material: Material,
  edgeBands: EdgeBand[] = [],
  edgeBandId?: string,
): {
  module: Module;
  resolvedPieces: ResolvedPieceWithCutSize[];
} {
  const widthMm = params.width;
  const heightMm = params.height;
  const depthMm = params.depth;
  const T = typeof material.thicknessMm === 'number' ? material.thicknessMm : 18;
  const materialId = material.id;
  const shelfY = params.shelfOffset ?? Math.round(heightMm / 2);

  // 1. Sides
  const sideLeft = createPiece({
    id: 'base-side-left',
    role: 'side-left',
    materialId,
    contour: createRectangularContour(depthMm, heightMm),
    thicknessMm: T,
  });
  if (edgeBandId) {
    const f = sideLeft.faces.find((face) => face.id === 'right-edge');
    if (f) f.edgeBandId = edgeBandId;
  }

  const sideRight = createPiece({
    id: 'base-side-right',
    role: 'side-right',
    materialId,
    contour: createRectangularContour(depthMm, heightMm),
    thicknessMm: T,
  });
  if (edgeBandId) {
    const f = sideRight.faces.find((face) => face.id === 'right-edge');
    if (f) f.edgeBandId = edgeBandId;
  }

  // 2. Bottom
  const bottom = createPiece({
    id: 'base-bottom',
    role: 'bottom',
    materialId,
    contour: createRectangularContour(widthMm - 2 * T, depthMm),
    thicknessMm: T,
  });
  if (edgeBandId) {
    const f = bottom.faces.find((face) => face.id === 'right-edge');
    if (f) f.edgeBandId = edgeBandId;
  }

  // 3. One shelf
  const shelf = createPiece({
    id: 'base-shelf-1',
    role: 'shelf',
    materialId,
    contour: createRectangularContour(widthMm - 2 * T, depthMm - 20),
    thicknessMm: T,
  });
  if (edgeBandId) {
    const f = shelf.faces.find((face) => face.id === 'right-edge');
    if (f) f.edgeBandId = edgeBandId;
  }

  // 4. Rails (front and back)
  const railFront = createPiece({
    id: 'base-rail-front',
    role: 'rail-front',
    materialId,
    contour: createRectangularContour(widthMm - 2 * T, 100),
    thicknessMm: T,
  });

  const railBack = createPiece({
    id: 'base-rail-back',
    role: 'rail-back',
    materialId,
    contour: createRectangularContour(widthMm - 2 * T, 100),
    thicknessMm: T,
  });

  // 5. Back panel
  const back = createPiece({
    id: 'base-back',
    role: 'back',
    materialId,
    contour: createRectangularContour(widthMm - 2 * T, heightMm - T),
    thicknessMm: T,
    structural: false,
  });

  const pieces: Piece[] = [sideLeft, sideRight, bottom, shelf, railFront, railBack, back];

  const joints: Joint[] = [
    createJoint({
      a: { pieceId: 'base-side-left', faceId: 'inner' },
      b: { pieceId: 'base-bottom', faceId: 'left-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'base-side-right', faceId: 'inner' },
      b: { pieceId: 'base-bottom', faceId: 'right-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'base-side-left', faceId: 'inner' },
      b: { pieceId: 'base-shelf-1', faceId: 'left-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'base-side-right', faceId: 'inner' },
      b: { pieceId: 'base-shelf-1', faceId: 'right-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'base-side-left', faceId: 'inner' },
      b: { pieceId: 'base-rail-front', faceId: 'left-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'base-side-right', faceId: 'inner' },
      b: { pieceId: 'base-rail-front', faceId: 'right-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'base-side-left', faceId: 'inner' },
      b: { pieceId: 'base-rail-back', faceId: 'left-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'base-side-right', faceId: 'inner' },
      b: { pieceId: 'base-rail-back', faceId: 'right-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'base-bottom', faceId: 'rear-edge' },
      b: { pieceId: 'base-back', faceId: 'bottom-edge' },
      kind: 'rebate',
    }),
  ];

  const placementTree = new PlacementTree('base-side-left');
  placementTree.setNode({
    pieceId: 'base-side-right',
    parentPieceId: 'base-side-left',
    relativeOffset: { x: widthMm - T, y: 0, z: 0 },
  });
  placementTree.setNode({
    pieceId: 'base-bottom',
    parentPieceId: 'base-side-left',
    relativeOffset: { x: T, y: 0, z: 0 },
  });
  placementTree.setNode({
    pieceId: 'base-shelf-1',
    parentPieceId: 'base-side-left',
    relativeOffset: { x: T, y: shelfY, z: 0 },
  });
  placementTree.setNode({
    pieceId: 'base-rail-front',
    parentPieceId: 'base-side-left',
    relativeOffset: { x: T, y: heightMm - T, z: 0 },
  });
  placementTree.setNode({
    pieceId: 'base-rail-back',
    parentPieceId: 'base-side-left',
    relativeOffset: { x: T, y: heightMm - T, z: depthMm - 100 },
  });
  placementTree.setNode({
    pieceId: 'base-back',
    parentPieceId: 'base-side-left',
    relativeOffset: { x: T, y: T, z: depthMm - T },
  });

  const module: Module = {
    schemaVersion: 1,
    id: 'module-base-cabinet',
    parameters: {
      width: widthMm,
      height: heightMm,
      depth: depthMm,
      shelfOffset: shelfY,
    },
    rootPieceId: 'base-side-left',
    pieces,
    joints,
    subAssemblies: [],
    overrides: {},
  };

  const resolved = resolveModule({ module, placementTree });
  const resolvedPieces = resolved.pieces.map((p) =>
    applyEdgeBandRule(p, edgeBands),
  );

  return {
    module,
    resolvedPieces,
  };
}
