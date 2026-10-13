import {
  type Module,
  type Piece,
  type Joint,
  type Material,
  type EdgeBand,
  type SubAssembly,
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

/**
 * Slide clearance total in millimeters (both sides).
 * Marked TO_CONFIRM.
 */
export const DEFAULT_DRAWER_SLIDE_CLEARANCE_MM = 25.4;

/**
 * Reveal gap between drawer fronts in millimeters.
 * Marked TO_CONFIRM.
 */
export const DEFAULT_DRAWER_GAP_MM = 3.0;

export interface DrawerUnitParams {
  width: number;
  height: number;
  depth: number;
  drawerCount?: number;
  slideClearanceMm?: number;
  gapMm?: number;
}

export const DEFAULT_DRAWER_UNIT_PARAMS: DrawerUnitParams = {
  width: 600,
  height: 800,
  depth: 560,
  drawerCount: 3,
};

/**
 * Drawer Unit template:
 * - Carcase: two sides, bottom, front/back rails, back panel
 * - N Drawer Sub-Assemblies: each with front, two box sides, box front, box back, and bottom
 */
export function buildDrawerUnit(
  params: DrawerUnitParams,
  material: Material,
  edgeBands: EdgeBand[] = [],
  edgeBandId?: string,
): {
  module: Module;
  placementTree: PlacementTree;
  resolvedPieces: ResolvedPieceWithCutSize[];
} {
  const widthMm = params.width;
  const heightMm = params.height;
  const depthMm = params.depth;
  const drawerCount = params.drawerCount ?? 3;
  const slideClearance = params.slideClearanceMm ?? DEFAULT_DRAWER_SLIDE_CLEARANCE_MM;
  const gap = params.gapMm ?? DEFAULT_DRAWER_GAP_MM;
  const T = typeof material.thicknessMm === 'number' ? material.thicknessMm : 18;
  const materialId = material.id;

  // 1. Carcase Sides
  const sideLeft = createPiece({
    id: 'drawer-side-left',
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
    id: 'drawer-side-right',
    role: 'side-right',
    materialId,
    contour: createRectangularContour(depthMm, heightMm),
    thicknessMm: T,
  });
  if (edgeBandId) {
    const f = sideRight.faces.find((face) => face.id === 'right-edge');
    if (f) f.edgeBandId = edgeBandId;
  }

  // 2. Carcase Bottom
  const bottom = createPiece({
    id: 'drawer-carcase-bottom',
    role: 'bottom',
    materialId,
    contour: createRectangularContour(widthMm - 2 * T, depthMm),
    thicknessMm: T,
  });
  if (edgeBandId) {
    const f = bottom.faces.find((face) => face.id === 'right-edge');
    if (f) f.edgeBandId = edgeBandId;
  }

  // 3. Carcase Rails
  const railFront = createPiece({
    id: 'drawer-rail-front',
    role: 'rail-front',
    materialId,
    contour: createRectangularContour(widthMm - 2 * T, 100),
    thicknessMm: T,
  });

  const railBack = createPiece({
    id: 'drawer-rail-back',
    role: 'rail-back',
    materialId,
    contour: createRectangularContour(widthMm - 2 * T, 100),
    thicknessMm: T,
  });

  // 4. Carcase Back
  const back = createPiece({
    id: 'drawer-carcase-back',
    role: 'back',
    materialId,
    contour: createRectangularContour(widthMm - 2 * T, heightMm - T),
    thicknessMm: T,
    structural: false,
  });

  const carcasePieces: Piece[] = [sideLeft, sideRight, bottom, railFront, railBack, back];

  const joints: Joint[] = [
    createJoint({
      a: { pieceId: 'drawer-side-left', faceId: 'inner' },
      b: { pieceId: 'drawer-carcase-bottom', faceId: 'left-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'drawer-side-right', faceId: 'inner' },
      b: { pieceId: 'drawer-carcase-bottom', faceId: 'right-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'drawer-side-left', faceId: 'inner' },
      b: { pieceId: 'drawer-rail-front', faceId: 'left-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'drawer-side-right', faceId: 'inner' },
      b: { pieceId: 'drawer-rail-front', faceId: 'right-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'drawer-side-left', faceId: 'inner' },
      b: { pieceId: 'drawer-rail-back', faceId: 'left-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'drawer-side-right', faceId: 'inner' },
      b: { pieceId: 'drawer-rail-back', faceId: 'right-edge' },
      kind: 'confirmat',
    }),
  ];

  const placementTree = new PlacementTree('drawer-side-left');
  placementTree.setNode({
    pieceId: 'drawer-side-right',
    parentPieceId: 'drawer-side-left',
    relativeOffset: { x: widthMm - T, y: 0, z: 0 },
  });
  placementTree.setNode({
    pieceId: 'drawer-carcase-bottom',
    parentPieceId: 'drawer-side-left',
    relativeOffset: { x: T, y: 0, z: 0 },
  });
  placementTree.setNode({
    pieceId: 'drawer-rail-front',
    parentPieceId: 'drawer-side-left',
    relativeOffset: { x: T, y: heightMm - T, z: 0 },
  });
  placementTree.setNode({
    pieceId: 'drawer-rail-back',
    parentPieceId: 'drawer-side-left',
    relativeOffset: { x: T, y: heightMm - T, z: depthMm - 100 },
  });
  placementTree.setNode({
    pieceId: 'drawer-carcase-back',
    parentPieceId: 'drawer-side-left',
    relativeOffset: { x: T, y: T, z: depthMm - T },
  });

  // 5. Drawer Sub-Assemblies
  const innerWidth = widthMm - 2 * T;
  const drawerBoxWidth = Math.round(innerWidth - slideClearance);
  const drawerBoxDepth = Math.max(300, depthMm - 50);

  const availableHeight = heightMm - T - 100;
  const drawerFrontHeight = Math.round((availableHeight - (drawerCount + 1) * gap) / drawerCount);
  const boxHeight = Math.max(80, drawerFrontHeight - 50);

  const subAssemblies: SubAssembly[] = [];
  const drawerPieces: Piece[] = [];

  for (let i = 0; i < drawerCount; i++) {
    const drawerIndex = i + 1;
    const subPieceIds: string[] = [];
    const frontY = T + gap + i * (drawerFrontHeight + gap);

    // Drawer Front
    const front = createPiece({
      id: `drawer-front-${drawerIndex}`,
      role: 'drawer-front',
      materialId,
      contour: createRectangularContour(widthMm - 2 * gap, drawerFrontHeight),
      thicknessMm: T,
    });
    if (edgeBandId) {
      for (const f of front.faces) {
        if (f.id.endsWith('-edge')) f.edgeBandId = edgeBandId;
      }
    }
    drawerPieces.push(front);
    subPieceIds.push(front.id);

    placementTree.setNode({
      pieceId: front.id,
      parentPieceId: 'drawer-side-left',
      relativeOffset: { x: gap, y: frontY, z: -T },
    });

    // Drawer Box Sides (Left & Right)
    const boxSideL = createPiece({
      id: `drawer-box-side-l-${drawerIndex}`,
      role: 'drawer-side',
      materialId,
      contour: createRectangularContour(drawerBoxDepth, boxHeight),
      thicknessMm: T,
    });
    const boxSideR = createPiece({
      id: `drawer-box-side-r-${drawerIndex}`,
      role: 'drawer-side',
      materialId,
      contour: createRectangularContour(drawerBoxDepth, boxHeight),
      thicknessMm: T,
    });
    drawerPieces.push(boxSideL, boxSideR);
    subPieceIds.push(boxSideL.id, boxSideR.id);

    const boxX = T + Math.round(slideClearance / 2);
    placementTree.setNode({
      pieceId: boxSideL.id,
      parentPieceId: 'drawer-side-left',
      relativeOffset: { x: boxX, y: frontY + 15, z: 10 },
    });
    placementTree.setNode({
      pieceId: boxSideR.id,
      parentPieceId: 'drawer-side-left',
      relativeOffset: { x: boxX + drawerBoxWidth - T, y: frontY + 15, z: 10 },
    });

    // Drawer Box Front & Back
    const boxFront = createPiece({
      id: `drawer-box-front-${drawerIndex}`,
      role: 'drawer-box-front',
      materialId,
      contour: createRectangularContour(drawerBoxWidth - 2 * T, boxHeight),
      thicknessMm: T,
    });
    const boxBack = createPiece({
      id: `drawer-box-back-${drawerIndex}`,
      role: 'drawer-box-back',
      materialId,
      contour: createRectangularContour(drawerBoxWidth - 2 * T, boxHeight),
      thicknessMm: T,
    });
    drawerPieces.push(boxFront, boxBack);
    subPieceIds.push(boxFront.id, boxBack.id);

    placementTree.setNode({
      pieceId: boxFront.id,
      parentPieceId: 'drawer-side-left',
      relativeOffset: { x: boxX + T, y: frontY + 15, z: 10 },
    });
    placementTree.setNode({
      pieceId: boxBack.id,
      parentPieceId: 'drawer-side-left',
      relativeOffset: { x: boxX + T, y: frontY + 15, z: 10 + drawerBoxDepth - T },
    });

    // Drawer Bottom
    const boxBottom = createPiece({
      id: `drawer-box-bottom-${drawerIndex}`,
      role: 'drawer-bottom',
      materialId,
      contour: createRectangularContour(drawerBoxWidth - 2 * T, drawerBoxDepth),
      thicknessMm: T,
    });
    drawerPieces.push(boxBottom);
    subPieceIds.push(boxBottom.id);

    placementTree.setNode({
      pieceId: boxBottom.id,
      parentPieceId: 'drawer-side-left',
      relativeOffset: { x: boxX + T, y: frontY + 15, z: 10 },
    });

    // Sub-Assembly registration
    subAssemblies.push({
      id: `sub-drawer-${drawerIndex}`,
      templateId: 'drawer',
      parameters: {
        index: drawerIndex,
        boxWidth: drawerBoxWidth,
        boxDepth: drawerBoxDepth,
        boxHeight,
      },
      pieceIds: subPieceIds,
    });
  }

  const allPieces = [...carcasePieces, ...drawerPieces];

  const module: Module = {
    schemaVersion: 1,
    id: 'module-drawer-unit',
    parameters: {
      width: widthMm,
      height: heightMm,
      depth: depthMm,
      drawerCount,
    },
    rootPieceId: 'drawer-side-left',
    pieces: allPieces,
    joints,
    subAssemblies,
    overrides: {},
  };

  const resolved = resolveModule({ module, placementTree });
  const resolvedPieces = resolved.pieces.map((p) =>
    applyEdgeBandRule(p, edgeBands),
  );

  return {
    module,
    placementTree,
    resolvedPieces,
  };
}
