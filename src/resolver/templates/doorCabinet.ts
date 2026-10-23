import {
  type Material,
  type EdgeBand,
  type Module,
  type Piece,
  type Joint,
  type ProjectConfig,
} from '../../model';
import { createPiece, createRectangularContour } from '../piece';
import { createJoint } from '../joint';
import { PlacementTree } from '../tree';
import { resolveModule } from '../resolver';
import { applyEdgeBandRule, type ResolvedPieceWithCutSize } from '../edgeBand';
import { buildDoorSubAssembly, type DoorMountType } from './door';
import { buildShelf } from './shelf';
import { applyFrontEdgeBand } from '../frontEdge';

export interface DoorCabinetParams {
  width: number;
  height: number;
  depth: number;
  doorMountType?: DoorMountType;
  shelfOffset?: number;
  doorGapMm?: number;
  doorRevealMm?: number;
  hingeSetbackFromEndMm?: number;
  backingType?: 'overlay' | 'groove' | 'rebate' | 'none';
  backingThicknessMm?: number;
}

export const DEFAULT_DOOR_CABINET_PARAMS: DoorCabinetParams = {
  width: 600,
  height: 800,
  depth: 560,
  doorMountType: 'full-overlay',
};

export interface DoorCabinetResult {
  module: Module;
  placementTree: PlacementTree;
  resolvedPieces: ResolvedPieceWithCutSize[];
}

/**
 * Builds a Base Cabinet with Hinged Door(s) and an adjustable shelf.
 * Supports full-overlay, half-overlay, and inset door mount variants.
 */
export function buildDoorCabinet(
  params: DoorCabinetParams,
  material: Material,
  edgeBands: EdgeBand[] = [],
  edgeBandId?: string,
  projectConfig?: ProjectConfig,
): DoorCabinetResult {
  const widthMm = params.width;
  const heightMm = params.height;
  const depthMm = params.depth;
  const mountType: DoorMountType = params.doorMountType ?? 'full-overlay';
  const T = typeof material.thicknessMm === 'number' ? material.thicknessMm : 18;
  const materialId = material.id;

  const hw = projectConfig?.hardware;
  const mach = projectConfig?.machining;
  const gapMm = params.doorGapMm ?? hw?.doorInsetGapMm ?? 2.0;
  const revealMm =
    params.doorRevealMm ??
    (mountType === 'half-overlay' ? hw?.doorHalfOverlayRevealMm : hw?.doorOverlayRevealMm) ??
    1.5;
  const hingeSetbackFromEndMm = params.hingeSetbackFromEndMm ?? hw?.doorHingeMarginMm ?? 100.0;
  const hingeCupEdgeSetbackMm = mach?.hingeCupEdgeSetbackMm ?? 21.5;

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
    applyFrontEdgeBand(sideLeft, edgeBandId);
    applyFrontEdgeBand(sideRight, edgeBandId);
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
    applyFrontEdgeBand(bottom, edgeBandId);
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
  const isBackOverlay = params.backingType === 'overlay';
  const backThickness = params.backingThicknessMm ?? (isBackOverlay ? 3 : T);
  const backWidth = isBackOverlay ? widthMm : innerWidth;
  const backHeight = isBackOverlay ? heightMm : heightMm - T;

  const back = createPiece({
    id: 'door-cab-back',
    role: 'back',
    materialId,
    contour: createRectangularContour(backWidth, backHeight),
    thicknessMm: backThickness,
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
  ];

  if (isBackOverlay) {
    joints.push(
      createJoint({
        a: { pieceId: 'door-cab-side-left', faceId: 'rear-edge' },
        b: { pieceId: 'door-cab-back', faceId: 'inner' },
        kind: 'screw',
      }),
      createJoint({
        a: { pieceId: 'door-cab-side-right', faceId: 'rear-edge' },
        b: { pieceId: 'door-cab-back', faceId: 'inner' },
        kind: 'screw',
      }),
      createJoint({
        a: { pieceId: 'door-cab-bottom', faceId: 'rear-edge' },
        b: { pieceId: 'door-cab-back', faceId: 'inner' },
        kind: 'screw',
      }),
      createJoint({
        a: { pieceId: 'door-cab-rail-back', faceId: 'rear-edge' },
        b: { pieceId: 'door-cab-back', faceId: 'inner' },
        kind: 'screw',
      }),
    );
  } else {
    joints.push(
      createJoint({
        a: { pieceId: 'door-cab-bottom', faceId: 'rear-edge' },
        b: { pieceId: 'door-cab-back', faceId: 'bottom-edge' },
        kind: 'rebate',
      }),
    );
  }

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

  if (isBackOverlay) {
    placementTree.setNode({
      pieceId: 'door-cab-back',
      parentPieceId: 'door-cab-side-left',
      relativeOffset: { x: 0, y: 0, z: depthMm },
    });
  } else {
    placementTree.setNode({
      pieceId: 'door-cab-back',
      parentPieceId: 'door-cab-side-left',
      relativeOffset: { x: T, y: T, z: depthMm - T },
    });
  }

  // 5. Adjustable Shelf
  const shelfY = params.shelfOffset ?? Math.round(heightMm / 2);
  const isInsetMount = mountType === 'inset' || mountType === 'codo-18';
  const shelfFrontOffset = (isInsetMount ? T : 0) + 20;
  const availableInteriorDepth = depthMm - (isBackOverlay ? 0 : T);
  const shelfRes = buildShelf(
    {
      id: 'door-cab-shelf-1',
      openingWidthMm: innerWidth,
      depthMm: availableInteriorDepth,
      elevationYMm: shelfY,
      carcaseThicknessMm: T,
      materialId,
      mountType: 'adjustable',
      edgeBandId,
      setbackMm: shelfFrontOffset,
      frontOffsetMm: shelfFrontOffset,
    },
    'door-cab-side-left',
  );
  shelfRes.placementNode.relativeOffset.z = shelfFrontOffset;
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
        gapMm,
        revealMm,
        hingeSetbackFromEndMm,
        hingeCupEdgeSetbackMm,
      },
      'door-cab-side-left',
    );
    pieces.push(doorRes.doorPiece);
    joints.push(...doorRes.joints);
    placementTree.setNode(doorRes.placementNode);
  } else {
    const isInsetMount = mountType === 'inset';
    const singleOpeningWidth = isInsetMount
      ? Math.round((innerWidth - 3 * gapMm) / 2)
      : Math.round((innerWidth - 2) / 2);

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
        gapMm,
        revealMm,
        hingeSetbackFromEndMm,
        hingeCupEdgeSetbackMm,
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
        gapMm,
        revealMm,
        hingeSetbackFromEndMm,
        hingeCupEdgeSetbackMm,
      },
      'door-cab-side-left',
    );
    for (const j of doorRightRes.joints) {
      j.b.pieceId = 'door-cab-side-right';
    }

    if (isInsetMount) {
      doorRightRes.placementNode.relativeOffset.x =
        widthMm - T - gapMm - doorRightRes.doorPiece.contour.points[1]!.x;
    } else if (mountType === 'half-overlay' || mountType === 'codo-9') {
      doorRightRes.placementNode.relativeOffset.x =
        widthMm - doorRightRes.doorPiece.contour.points[1]!.x - (T / 2 + revealMm);
    } else {
      doorRightRes.placementNode.relativeOffset.x =
        widthMm - doorRightRes.doorPiece.contour.points[1]!.x - revealMm;
    }

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
