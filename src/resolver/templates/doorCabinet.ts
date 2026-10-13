import {
  type Material,
  type EdgeBand,
  type Module,
  type Piece,
  type Joint,
} from '../../model';
import { createPiece, createRectangularContour } from '../piece';
import { createJoint } from '../joint';
import { PlacementTree } from '../tree';
import { resolveModule } from '../resolver';
import { applyEdgeBandRule, type ResolvedPieceWithCutSize } from '../edgeBand';
import { buildDoorSubAssembly } from './door';
import { buildShelf } from './shelf';

export interface DoorCabinetParams {
  width: number;
  height: number;
  depth: number;
  doorMountType?: 'overlay' | 'inset';
  shelfOffset?: number;
}

export const DEFAULT_DOOR_CABINET_PARAMS: DoorCabinetParams = {
  width: 600,
  height: 800,
  depth: 560,
  doorMountType: 'overlay',
};

export interface DoorCabinetResult {
  module: Module;
  placementTree: PlacementTree;
  resolvedPieces: ResolvedPieceWithCutSize[];
}

/**
 * Builds a Base Cabinet with Hinged Door(s) and an adjustable shelf.
 */
export function buildDoorCabinet(
  params: DoorCabinetParams,
  material: Material,
  edgeBands: EdgeBand[] = [],
  edgeBandId?: string,
): DoorCabinetResult {
  const widthMm = params.width;
  const heightMm = params.height;
  const depthMm = params.depth;
  const mountType = params.doorMountType ?? 'overlay';
  const T = typeof material.thicknessMm === 'number' ? material.thicknessMm : 18;
  const materialId = material.id;

  const innerWidth = widthMm - 2 * T;
  const innerHeight = heightMm - 2 * T;

  // 1. Carcase Sides
  const sideLeft = createPiece({
    id: 'door-cab-side-left',
    role: 'side-left',
    materialId,
    contour: createRectangularContour(depthMm, heightMm),
    thicknessMm: T,
  });
  const sideRight = createPiece({
    id: 'door-cab-side-right',
    role: 'side-right',
    materialId,
    contour: createRectangularContour(depthMm, heightMm),
    thicknessMm: T,
  });
  if (edgeBandId) {
    const fL = sideLeft.faces.find((f) => f.id === 'right-edge');
    if (fL) fL.edgeBandId = edgeBandId;
    const fR = sideRight.faces.find((f) => f.id === 'right-edge');
    if (fR) fR.edgeBandId = edgeBandId;
  }

  // 2. Carcase Bottom
  const bottom = createPiece({
    id: 'door-cab-bottom',
    role: 'bottom',
    materialId,
    contour: createRectangularContour(innerWidth, depthMm),
    thicknessMm: T,
  });
  if (edgeBandId) {
    const f = bottom.faces.find((face) => face.id === 'right-edge');
    if (f) f.edgeBandId = edgeBandId;
  }

  // 3. Rails (top front and top back)
  const railFront = createPiece({
    id: 'door-cab-rail-front',
    role: 'rail-front',
    materialId,
    contour: createRectangularContour(innerWidth, 100),
    thicknessMm: T,
  });
  const railBack = createPiece({
    id: 'door-cab-rail-back',
    role: 'rail-back',
    materialId,
    contour: createRectangularContour(innerWidth, 100),
    thicknessMm: T,
  });

  // 4. Back Panel
  const back = createPiece({
    id: 'door-cab-back',
    role: 'back',
    materialId,
    contour: createRectangularContour(innerWidth, heightMm - T),
    thicknessMm: T,
    structural: false,
  });

  const pieces: Piece[] = [sideLeft, sideRight, bottom, railFront, railBack, back];

  const joints: Joint[] = [
    createJoint({
      a: { pieceId: 'door-cab-side-left', faceId: 'inner' },
      b: { pieceId: 'door-cab-bottom', faceId: 'left-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'door-cab-side-right', faceId: 'inner' },
      b: { pieceId: 'door-cab-bottom', faceId: 'right-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'door-cab-side-left', faceId: 'inner' },
      b: { pieceId: 'door-cab-rail-front', faceId: 'left-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'door-cab-side-right', faceId: 'inner' },
      b: { pieceId: 'door-cab-rail-front', faceId: 'right-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'door-cab-side-left', faceId: 'inner' },
      b: { pieceId: 'door-cab-rail-back', faceId: 'left-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'door-cab-side-right', faceId: 'inner' },
      b: { pieceId: 'door-cab-rail-back', faceId: 'right-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'door-cab-bottom', faceId: 'rear-edge' },
      b: { pieceId: 'door-cab-back', faceId: 'bottom-edge' },
      kind: 'rebate',
    }),
  ];

  const placementTree = new PlacementTree('door-cab-side-left');
  placementTree.setNode({
    pieceId: 'door-cab-side-right',
    parentPieceId: 'door-cab-side-left',
    relativeOffset: { x: widthMm - T, y: 0, z: 0 },
  });
  placementTree.setNode({
    pieceId: 'door-cab-bottom',
    parentPieceId: 'door-cab-side-left',
    relativeOffset: { x: T, y: 0, z: 0 },
  });
  placementTree.setNode({
    pieceId: 'door-cab-rail-front',
    parentPieceId: 'door-cab-side-left',
    relativeOffset: { x: T, y: heightMm - T, z: 0 },
  });
  placementTree.setNode({
    pieceId: 'door-cab-rail-back',
    parentPieceId: 'door-cab-side-left',
    relativeOffset: { x: T, y: heightMm - T, z: depthMm - 100 },
  });
  placementTree.setNode({
    pieceId: 'door-cab-back',
    parentPieceId: 'door-cab-side-left',
    relativeOffset: { x: T, y: T, z: depthMm - T },
  });

  // 5. Adjustable Shelf
  const shelfY = params.shelfOffset ?? Math.round(heightMm / 2);
  const shelfRes = buildShelf(
    {
      id: 'door-cab-shelf-1',
      openingWidthMm: innerWidth,
      depthMm: depthMm - 20,
      elevationYMm: shelfY,
      carcaseThicknessMm: T,
      materialId,
      mountType: 'adjustable',
      edgeBandId,
    },
    'door-cab-side-left',
  );
  pieces.push(shelfRes.piece);
  joints.push(...shelfRes.joints);
  placementTree.setNode(shelfRes.placementNode);

  // 6. Door(s) with Hinges
  const isDoubleDoor = widthMm > 600;
  if (!isDoubleDoor) {
    const doorRes = buildDoorSubAssembly(
      {
        id: 'door-single',
        side: 'left',
        mountType,
        openingWidthMm: innerWidth,
        openingHeightMm: innerHeight,
        carcaseThicknessMm: T,
        materialId,
        edgeBandId,
      },
      'door-cab-side-left',
    );
    pieces.push(doorRes.doorPiece);
    joints.push(...doorRes.joints);
    placementTree.setNode(doorRes.placementNode);
  } else {
    const singleOpeningWidth = Math.round((innerWidth - 2) / 2);
    const doorLeftRes = buildDoorSubAssembly(
      {
        id: 'door-left',
        side: 'left',
        mountType,
        openingWidthMm: singleOpeningWidth,
        openingHeightMm: innerHeight,
        carcaseThicknessMm: T,
        materialId,
        edgeBandId,
      },
      'door-cab-side-left',
    );
    const doorRightRes = buildDoorSubAssembly(
      {
        id: 'door-right',
        side: 'right',
        mountType,
        openingWidthMm: singleOpeningWidth,
        openingHeightMm: innerHeight,
        carcaseThicknessMm: T,
        materialId,
        edgeBandId,
      },
      'door-cab-side-right',
    );
    doorRightRes.placementNode.relativeOffset.x = widthMm - doorRightRes.doorPiece.contour.points[1]!.x - 1.5;

    pieces.push(doorLeftRes.doorPiece, doorRightRes.doorPiece);
    joints.push(...doorLeftRes.joints, ...doorRightRes.joints);
    placementTree.setNode(doorLeftRes.placementNode);
    placementTree.setNode(doorRightRes.placementNode);
  }

  const module: Module = {
    schemaVersion: 1,
    id: 'module-door-cabinet',
    parameters: {
      width: widthMm,
      height: heightMm,
      depth: depthMm,
    },
    rootPieceId: 'door-cab-side-left',
    pieces,
    joints,
    subAssemblies: [],
    overrides: {},
  };

  const resolved = resolveModule({ module, placementTree });
  const resolvedPieces = resolved.pieces.map((p) => applyEdgeBandRule(p, edgeBands));

  return {
    module,
    placementTree,
    resolvedPieces,
  };
}
