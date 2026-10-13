import {
  type Module,
  type Piece,
  type Joint,
} from '../model';
import {
  createPiece,
  createJoint,
  createRectangularContour,
  PlacementTree,
  resolveModule,
  applyEdgeBandRule,
  type ResolvedPieceWithCutSize,
} from './index';
import { type EdgeBand } from '../model';

export interface BaseCabinetInput {
  widthMm: number;
  heightMm: number;
  depthMm: number;
  materialId: string;
  materialThicknessMm: number;
  edgeBandId?: string;
}

/**
 * Build and resolve a standard base cabinet module with sides, bottom, shelf, and top rail.
 */
export function buildBaseCabinetModule(
  input: BaseCabinetInput,
  edgeBands: EdgeBand[] = [],
): {
  module: Module;
  resolvedPieces: ResolvedPieceWithCutSize[];
} {
  const {
    widthMm,
    heightMm,
    depthMm,
    materialId,
    materialThicknessMm,
    edgeBandId,
  } = input;

  const sideLeft = createPiece({
    id: 'piece-side-left',
    role: 'side-left',
    materialId,
    contour: createRectangularContour(depthMm, heightMm),
    thicknessMm: materialThicknessMm,
  });
  if (edgeBandId) {
    const frontFace = sideLeft.faces.find((f) => f.id === 'right-edge');
    if (frontFace) frontFace.edgeBandId = edgeBandId;
  }

  const sideRight = createPiece({
    id: 'piece-side-right',
    role: 'side-right',
    materialId,
    contour: createRectangularContour(depthMm, heightMm),
    thicknessMm: materialThicknessMm,
  });
  if (edgeBandId) {
    const frontFace = sideRight.faces.find((f) => f.id === 'right-edge');
    if (frontFace) frontFace.edgeBandId = edgeBandId;
  }

  const bottom = createPiece({
    id: 'piece-bottom',
    role: 'bottom',
    materialId,
    contour: createRectangularContour(widthMm - 2 * materialThicknessMm, depthMm),
    thicknessMm: materialThicknessMm,
  });
  if (edgeBandId) {
    const frontFace = bottom.faces.find((f) => f.id === 'right-edge');
    if (frontFace) frontFace.edgeBandId = edgeBandId;
  }

  const shelf = createPiece({
    id: 'piece-shelf-1',
    role: 'shelf',
    materialId,
    contour: createRectangularContour(widthMm - 2 * materialThicknessMm, depthMm),
    thicknessMm: materialThicknessMm,
  });
  if (edgeBandId) {
    const frontFace = shelf.faces.find((f) => f.id === 'right-edge');
    if (frontFace) frontFace.edgeBandId = edgeBandId;
  }

  const rail = createPiece({
    id: 'piece-rail-top',
    role: 'rail',
    materialId,
    contour: createRectangularContour(widthMm - 2 * materialThicknessMm, 100),
    thicknessMm: materialThicknessMm,
  });

  const pieces: Piece[] = [sideLeft, sideRight, bottom, shelf, rail];

  const joints: Joint[] = [
    createJoint({
      a: { pieceId: 'piece-side-left', faceId: 'inner' },
      b: { pieceId: 'piece-bottom', faceId: 'left-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'piece-side-right', faceId: 'inner' },
      b: { pieceId: 'piece-bottom', faceId: 'right-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'piece-side-left', faceId: 'inner' },
      b: { pieceId: 'piece-shelf-1', faceId: 'left-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'piece-side-right', faceId: 'inner' },
      b: { pieceId: 'piece-shelf-1', faceId: 'right-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'piece-side-left', faceId: 'inner' },
      b: { pieceId: 'piece-rail-top', faceId: 'left-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'piece-side-right', faceId: 'inner' },
      b: { pieceId: 'piece-rail-top', faceId: 'right-edge' },
      kind: 'confirmat',
    }),
  ];

  const placementTree = new PlacementTree('piece-side-left');
  placementTree.setNode({
    pieceId: 'piece-side-right',
    parentPieceId: 'piece-side-left',
    relativeOffset: { x: widthMm - materialThicknessMm, y: 0, z: 0 },
  });
  placementTree.setNode({
    pieceId: 'piece-bottom',
    parentPieceId: 'piece-side-left',
    relativeOffset: { x: materialThicknessMm, y: 0, z: 0 },
  });
  placementTree.setNode({
    pieceId: 'piece-shelf-1',
    parentPieceId: 'piece-side-left',
    relativeOffset: { x: materialThicknessMm, y: Math.round(heightMm / 2), z: 0 },
  });
  placementTree.setNode({
    pieceId: 'piece-rail-top',
    parentPieceId: 'piece-side-left',
    relativeOffset: { x: materialThicknessMm, y: heightMm - materialThicknessMm, z: 0 },
  });

  const module: Module = {
    schemaVersion: 1,
    id: 'base-cabinet-standard',
    parameters: { width: widthMm, height: heightMm, depth: depthMm },
    rootPieceId: 'piece-side-left',
    pieces,
    joints,
    subAssemblies: [],
    overrides: {},
  };

  const resolved = resolveModule({ module, placementTree });
  const resolvedPiecesWithCutSize = resolved.pieces.map((p) =>
    applyEdgeBandRule(p, edgeBands),
  );

  return {
    module,
    resolvedPieces: resolvedPiecesWithCutSize,
  };
}
