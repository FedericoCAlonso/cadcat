import { type Piece, type Joint, type SubAssembly } from '../../model';
import { createPiece, createRectangularContour } from '../piece';
import { createJoint } from '../joint';
import { type PlacementNode } from '../tree';

export type DrawerSlideType = 'telescopic' | 'undermount' | 'metal-box' | 'roller';
export type DrawerFrontMount = 'applied' | 'inset';

export const DRAWER_SLIDE_CLEARANCES_MM: Record<DrawerSlideType, number> = {
  telescopic: 25.4, // 12.7 mm per side
  undermount: 10.0, // 5.0 mm per side
  'metal-box': 31.0, // 15.5 mm per side
  roller: 25.0,     // 12.5 mm per side
};

export interface DrawerConfig {
  idPrefix: string;
  index: number;
  openingWidthMm: number;
  depthMm: number;
  frontHeightMm: number;
  boxHeightMm: number;
  boxDepthMm?: number;
  baseYMm: number;
  carcaseThicknessMm: number;
  materialId: string;
  frontMaterialId?: string;
  boxMaterialId?: string;
  boxThicknessMm?: number;
  slideType: DrawerSlideType;
  frontMount?: DrawerFrontMount;
  customSlideClearanceMm?: number;
  edgeBandId?: string;
  gapMm?: number;
  boxFrontOffsetMm?: number;
  boxBottomClearanceMm?: number;
}

export interface DrawerSubAssemblyResult {
  subAssembly: SubAssembly;
  pieces: Piece[];
  joints: Joint[];
  placementNodes: PlacementNode[];
  slideClearanceMm: number;
}

/**
 * Builds a drawer sub-assembly with 6 pieces and slide joints.
 * Supports applied (overlay) and inset front mounts, and slide clearance variants.
 */
export function buildDrawerSubAssembly(
  config: DrawerConfig,
  parentPieceId: string,
): DrawerSubAssemblyResult {
  const {
    idPrefix,
    index,
    openingWidthMm,
    depthMm,
    frontHeightMm,
    boxHeightMm,
    baseYMm,
    carcaseThicknessMm: T,
    materialId,
    frontMaterialId,
    boxMaterialId,
    boxThicknessMm,
    slideType,
    frontMount = 'applied',
    customSlideClearanceMm,
    edgeBandId,
    gapMm = 2.0,
    boxFrontOffsetMm = 10,
    boxBottomClearanceMm = 15,
  } = config;

  const actualFrontMaterialId = frontMaterialId ?? materialId;
  const actualBoxMaterialId = boxMaterialId ?? materialId;
  const actualBoxT = boxThicknessMm ?? T;

  const slideClearance = customSlideClearanceMm ?? DRAWER_SLIDE_CLEARANCES_MM[slideType] ?? 25.4;
  const innerWidth = openingWidthMm;
  const drawerBoxWidth = Math.round(innerWidth - slideClearance);
  const boxDepth = config.boxDepthMm ?? Math.max(300, depthMm - 50);

  const subPieceIds: string[] = [];
  const pieces: Piece[] = [];
  const placementNodes: PlacementNode[] = [];
  const joints: Joint[] = [];

  // 1. Drawer Front
  const isInset = frontMount === 'inset';
  const frontWidth = isInset
    ? Math.round(openingWidthMm - 2 * gapMm)
    : Math.round(openingWidthMm + 2 * T - 2 * gapMm);
  const frontHeight = isInset
    ? Math.round(frontHeightMm - 2 * gapMm)
    : frontHeightMm;
  const frontOffsetX = isInset ? T + gapMm : gapMm;
  const frontOffsetY = isInset ? baseYMm + gapMm : baseYMm;
  const frontOffsetZ = isInset ? 0 : -T;

  const front = createPiece({
    id: `${idPrefix}-front-${index}`,
    role: 'drawer-front',
    materialId: actualFrontMaterialId,
    contour: createRectangularContour(frontWidth, frontHeight),
    thicknessMm: T,
    structural: false,
  });
  if (edgeBandId) {
    for (const f of front.faces) {
      if (f.id.endsWith('-edge')) f.edgeBandId = edgeBandId;
    }
  }
  pieces.push(front);
  subPieceIds.push(front.id);

  placementNodes.push({
    pieceId: front.id,
    parentPieceId,
    relativeOffset: { x: frontOffsetX, y: frontOffsetY, z: frontOffsetZ },
  });

  // Box offset in Z: behind carcase face if applied, behind inset front if inset
  const boxOffsetZ = isInset ? T + boxFrontOffsetMm : boxFrontOffsetMm;
  const boxY = baseYMm + boxBottomClearanceMm;

  // 2. Drawer Box Sides
  const boxSideL = createPiece({
    id: `${idPrefix}-box-side-l-${index}`,
    role: 'drawer-side',
    materialId: actualBoxMaterialId,
    contour: createRectangularContour(boxDepth, boxHeightMm),
    thicknessMm: actualBoxT,
  });
  const boxSideR = createPiece({
    id: `${idPrefix}-box-side-r-${index}`,
    role: 'drawer-side',
    materialId: actualBoxMaterialId,
    contour: createRectangularContour(boxDepth, boxHeightMm),
    thicknessMm: actualBoxT,
  });
  pieces.push(boxSideL, boxSideR);
  subPieceIds.push(boxSideL.id, boxSideR.id);

  const boxX = T + Math.round(slideClearance / 2);
  placementNodes.push({
    pieceId: boxSideL.id,
    parentPieceId,
    relativeOffset: { x: boxX, y: boxY, z: boxOffsetZ },
  });
  placementNodes.push({
    pieceId: boxSideR.id,
    parentPieceId,
    relativeOffset: { x: boxX + drawerBoxWidth - actualBoxT, y: boxY, z: boxOffsetZ },
  });

  // 3. Drawer Box Front & Back
  const boxFront = createPiece({
    id: `${idPrefix}-box-front-${index}`,
    role: 'drawer-box-front',
    materialId: actualBoxMaterialId,
    contour: createRectangularContour(drawerBoxWidth - 2 * actualBoxT, boxHeightMm),
    thicknessMm: actualBoxT,
  });
  const boxBack = createPiece({
    id: `${idPrefix}-box-back-${index}`,
    role: 'drawer-box-back',
    materialId: actualBoxMaterialId,
    contour: createRectangularContour(drawerBoxWidth - 2 * actualBoxT, boxHeightMm),
    thicknessMm: actualBoxT,
  });
  pieces.push(boxFront, boxBack);
  subPieceIds.push(boxFront.id, boxBack.id);

  placementNodes.push({
    pieceId: boxFront.id,
    parentPieceId,
    relativeOffset: { x: boxX + actualBoxT, y: boxY, z: boxOffsetZ },
  });
  placementNodes.push({
    pieceId: boxBack.id,
    parentPieceId,
    relativeOffset: { x: boxX + actualBoxT, y: boxY, z: boxOffsetZ + boxDepth - actualBoxT },
  });

  // 4. Drawer Bottom
  const boxBottom = createPiece({
    id: `${idPrefix}-box-bottom-${index}`,
    role: 'drawer-bottom',
    materialId: actualBoxMaterialId,
    contour: createRectangularContour(drawerBoxWidth - 2 * actualBoxT, boxDepth),
    thicknessMm: actualBoxT,
    structural: false,
  });
  pieces.push(boxBottom);
  subPieceIds.push(boxBottom.id);

  placementNodes.push({
    pieceId: boxBottom.id,
    parentPieceId,
    relativeOffset: { x: boxX + T, y: boxY, z: boxOffsetZ },
  });

  // Box joints
  joints.push(
    createJoint({
      a: { pieceId: boxSideL.id, faceId: 'inner' },
      b: { pieceId: boxFront.id, faceId: 'left-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: boxSideR.id, faceId: 'inner' },
      b: { pieceId: boxFront.id, faceId: 'right-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: boxSideL.id, faceId: 'inner' },
      b: { pieceId: boxBack.id, faceId: 'left-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: boxSideR.id, faceId: 'inner' },
      b: { pieceId: boxBack.id, faceId: 'right-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: boxSideL.id, faceId: 'inner' },
      b: { pieceId: boxBottom.id, faceId: 'left-edge' },
      kind: 'rebate',
    }),
    createJoint({
      a: { pieceId: boxSideR.id, faceId: 'inner' },
      b: { pieceId: boxBottom.id, faceId: 'right-edge' },
      kind: 'rebate',
    }),
    // Slide hardware joints connecting drawer sides to cabinet side
    createJoint({
      a: { pieceId: boxSideL.id, faceId: 'outer' },
      b: { pieceId: parentPieceId, faceId: 'inner' },
      kind: 'slide',
    }),
  );

  const subAssembly: SubAssembly = {
    id: `${idPrefix}-subassembly-${index}`,
    templateId: 'drawer-box',
    parameters: {
      width: drawerBoxWidth,
      height: boxHeightMm,
      depth: boxDepth,
      slideClearance,
    },
    pieceIds: subPieceIds,
  };

  return {
    subAssembly,
    pieces,
    joints,
    placementNodes,
    slideClearanceMm: slideClearance,
  };
}
