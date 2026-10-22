import { type Piece, type Joint, type JointKind, type SubAssembly } from '../../model';
import { createPiece, createRectangularContour } from '../piece';
import { createJoint } from '../joint';
import { type PlacementNode } from '../tree';
import defaultProjectConfigJson from '../../config/defaultProjectConfig.json';

export type DrawerSlideType = 'telescopic' | 'undermount' | 'metal-box' | 'roller' | 'wood-runner';
export type DrawerFrontMount = 'applied' | 'inset';
export type DrawerType = 'standard' | 'simple-interior';
export type DrawerBottomMount = 'grooved' | 'bottom-screwed' | 'flush-thick';

export const DRAWER_SLIDE_CLEARANCES_MM: Record<DrawerSlideType, number> = {
  telescopic: defaultProjectConfigJson.hardware.slideClearanceTelescopicMm ?? 25.4,
  undermount: defaultProjectConfigJson.hardware.slideClearanceUndermountMm ?? 10.0,
  'metal-box': defaultProjectConfigJson.hardware.slideClearanceMetalBoxMm ?? 31.0,
  roller: defaultProjectConfigJson.hardware.slideClearanceRollerMm ?? 25.0,
  'wood-runner': 4.0,
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
  frontThicknessMm?: number;
  boxJointKind?: JointKind;
  slideType: DrawerSlideType;
  frontMount?: DrawerFrontMount;
  customSlideClearanceMm?: number;
  edgeBandId?: string;
  gapMm?: number;
  boxFrontOffsetMm?: number;
  boxBottomClearanceMm?: number;
  drawerType?: DrawerType;
  bottomMount?: DrawerBottomMount;
  topPullGapMm?: number;
  boxSideHeightOffsetMm?: number;
  bottomThicknessMm?: number;
  backingMaterialId?: string;
  backingThicknessMm?: number;
  bottomScrewedDeductionWidthMm?: number;
  bottomScrewedDeductionDepthMm?: number;
  grooveOffsetMm?: number;
  grooveDepthMm?: number;
}

export interface DrawerSubAssemblyResult {
  subAssembly: SubAssembly;
  pieces: Piece[];
  joints: Joint[];
  placementNodes: PlacementNode[];
  slideClearanceMm: number;
}

/**
 * Builds a drawer sub-assembly with configurable construction:
 * - standard (double-front: decorative front + box front) or simple-interior (single inset front for wardrobes)
 * - flush direct contact between decorative front and inner box (boxFrontOffsetMm = 0)
 * - configurable bottom construction: grooved (thin), bottom-screwed, or flush-thick (heavy-duty)
 * - optional top hand-pull gap (uñero) and differential side heights
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
    frontMount,
    customSlideClearanceMm,
    edgeBandId,
    gapMm = 2.0,
    boxFrontOffsetMm = 0,
    boxBottomClearanceMm = 15,
    drawerType,
    bottomMount = 'bottom-screwed',
    topPullGapMm = 0,
    boxSideHeightOffsetMm = 0,
    bottomThicknessMm,
    backingMaterialId,
    backingThicknessMm,
    bottomScrewedDeductionWidthMm,
    bottomScrewedDeductionDepthMm,
    grooveOffsetMm = 10,
    grooveDepthMm = 7,
  } = config;

  const actualFrontMount = frontMount ?? (slideType === 'wood-runner' ? 'inset' : 'applied');
  const actualDrawerType = drawerType ?? (slideType === 'wood-runner' ? 'simple-interior' : 'standard');

  const actualFrontMaterialId = frontMaterialId ?? materialId;
  const actualBoxMaterialId = boxMaterialId ?? materialId;
  const actualBoxT = boxThicknessMm ?? T;

  const isThickBottom = bottomMount === 'flush-thick';
  const actualBottomMaterialId = isThickBottom
    ? actualBoxMaterialId
    : (backingMaterialId ?? materialId);
  const actualBottomThickness = isThickBottom
    ? (bottomThicknessMm ?? actualBoxT)
    : (bottomThicknessMm ?? backingThicknessMm ?? 3);

  const slideClearance = customSlideClearanceMm ?? DRAWER_SLIDE_CLEARANCES_MM[slideType] ?? 25.4;
  const innerWidth = openingWidthMm;
  const drawerBoxWidth = Math.round(innerWidth - slideClearance);
  const defaultBoxDepth = depthMm <= 350 ? Math.max(50, depthMm - 20) : Math.max(300, depthMm - 50);
  const boxDepth = config.boxDepthMm ?? defaultBoxDepth;

  const subPieceIds: string[] = [];
  const pieces: Piece[] = [];
  const placementNodes: PlacementNode[] = [];
  const joints: Joint[] = [];

  const isSimpleInterior = actualDrawerType === 'simple-interior';
  const isInset = isSimpleInterior || actualFrontMount === 'inset';
  const actualFrontT = config.frontThicknessMm ?? T;

  // Effective box side & back height (can be lower than front)
  const effectiveBoxSideHeight = Math.max(
    50,
    boxSideHeightOffsetMm > 0 ? boxHeightMm - boxSideHeightOffsetMm : boxHeightMm,
  );

  // 1. Drawer Front
  const frontWidth = isInset
    ? Math.round(openingWidthMm - 2 * gapMm)
    : Math.round(openingWidthMm + 2 * T - 2 * gapMm);

  const effectiveTopPullGap = isSimpleInterior ? (topPullGapMm ?? 0) : 0;
  const frontHeight = isInset
    ? Math.round(frontHeightMm - 2 * gapMm - effectiveTopPullGap)
    : frontHeightMm;

  const frontOffsetX = isInset ? T + gapMm : gapMm;
  const frontOffsetY = isInset ? baseYMm + gapMm : baseYMm;
  const frontOffsetZ = isInset ? 0 : -actualFrontT;

  const front = createPiece({
    id: `${idPrefix}-front-${index}`,
    role: 'drawer-front',
    materialId: actualFrontMaterialId,
    contour: createRectangularContour(frontWidth, frontHeight),
    thicknessMm: actualFrontT,
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
  // boxFrontOffsetMm defaults to 0 so front and box are in flush direct contact
  const boxOffsetZ = isInset ? actualFrontT + boxFrontOffsetMm : boxFrontOffsetMm;
  const boxY = baseYMm + boxBottomClearanceMm;
  const boxX = T + Math.round(slideClearance / 2);

  // 2. Drawer Box Sides
  const boxSideL = createPiece({
    id: `${idPrefix}-box-side-l-${index}`,
    role: 'drawer-side',
    materialId: actualBoxMaterialId,
    contour: createRectangularContour(boxDepth, effectiveBoxSideHeight),
    thicknessMm: actualBoxT,
  });
  const boxSideR = createPiece({
    id: `${idPrefix}-box-side-r-${index}`,
    role: 'drawer-side',
    materialId: actualBoxMaterialId,
    contour: createRectangularContour(boxDepth, effectiveBoxSideHeight),
    thicknessMm: actualBoxT,
  });
  pieces.push(boxSideL, boxSideR);
  subPieceIds.push(boxSideL.id, boxSideR.id);

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

  // 3. Drawer Box Front (only if standard double-front) & Box Back
  let boxFront: Piece | null = null;

  if (!isSimpleInterior) {
    boxFront = createPiece({
      id: `${idPrefix}-box-front-${index}`,
      role: 'drawer-box-front',
      materialId: actualBoxMaterialId,
      contour: createRectangularContour(drawerBoxWidth - 2 * actualBoxT, boxHeightMm),
      thicknessMm: actualBoxT,
    });
    pieces.push(boxFront);
    subPieceIds.push(boxFront.id);

    placementNodes.push({
      pieceId: boxFront.id,
      parentPieceId,
      relativeOffset: { x: boxX + actualBoxT, y: boxY, z: boxOffsetZ },
    });
  }

  const boxBack = createPiece({
    id: `${idPrefix}-box-back-${index}`,
    role: 'drawer-box-back',
    materialId: actualBoxMaterialId,
    contour: createRectangularContour(drawerBoxWidth - 2 * actualBoxT, effectiveBoxSideHeight),
    thicknessMm: actualBoxT,
  });
  pieces.push(boxBack);
  subPieceIds.push(boxBack.id);

  placementNodes.push({
    pieceId: boxBack.id,
    parentPieceId,
    relativeOffset: { x: boxX + actualBoxT, y: boxY, z: boxOffsetZ + boxDepth - actualBoxT },
  });

  // 4. Drawer Bottom Construction
  // For thin box walls (<= 9mm, e.g. 6mm organizer drawers), bottom-screwed is avoided because screws into 6mm edges will burst the board.
  // We use grooved or flush-thick (glued).
  const isThinBox = actualBoxT <= 9;
  const effectiveBottomMount = isThinBox && bottomMount === 'bottom-screwed' ? 'grooved' : bottomMount;
  const effectiveGrooveDepth = isThinBox ? Math.min(grooveDepthMm, Math.max(2, Math.floor(actualBoxT / 2))) : grooveDepthMm;
  const effectiveGrooveOffset = isThinBox ? Math.min(grooveOffsetMm, 4) : grooveOffsetMm;

  let bottomWidth: number;
  let bottomDepth: number;
  let bottomThickness = isThinBox ? (bottomThicknessMm ?? Math.min(actualBoxT, 6)) : actualBottomThickness;
  let bottomOffsetX: number;
  let bottomOffsetY: number;
  let bottomOffsetZ: number;

  if (effectiveBottomMount === 'grooved') {
    bottomWidth = Math.round(drawerBoxWidth - 2 * actualBoxT + 2 * effectiveGrooveDepth - 1);
    bottomDepth = Math.round(boxDepth - 2 * actualBoxT + 2 * effectiveGrooveDepth - 1);
    bottomOffsetX = boxX + actualBoxT - effectiveGrooveDepth + 0.5;
    bottomOffsetY = boxY + effectiveGrooveOffset;
    bottomOffsetZ = boxOffsetZ + (isSimpleInterior ? 0 : actualBoxT) - effectiveGrooveDepth + 0.5;
  } else if (effectiveBottomMount === 'bottom-screwed') {
    const defaultDeductionW = defaultProjectConfigJson.hardware.drawerBottomScrewedDeductionWidthMm ?? 2.0;
    const defaultDeductionD = defaultProjectConfigJson.hardware.drawerBottomScrewedDeductionDepthMm ?? 2.0;
    const dedW = bottomScrewedDeductionWidthMm ?? defaultDeductionW;
    const dedD = bottomScrewedDeductionDepthMm ?? defaultDeductionD;

    bottomWidth = Math.round(drawerBoxWidth - dedW);
    bottomDepth = Math.round(boxDepth - dedD);
    bottomOffsetX = boxX + Math.round(dedW / 2);
    bottomOffsetY = boxY - bottomThickness;
    bottomOffsetZ = boxOffsetZ + Math.round(dedD / 2);
  } else {
    // flush-thick (default, 15/18mm)
    bottomWidth = drawerBoxWidth - 2 * actualBoxT;
    bottomDepth = boxDepth;
    bottomOffsetX = boxX + actualBoxT;
    bottomOffsetY = boxY;
    bottomOffsetZ = boxOffsetZ;
  }

  const boxBottom = createPiece({
    id: `${idPrefix}-box-bottom-${index}`,
    role: 'drawer-bottom',
    materialId: actualBottomMaterialId,
    contour: createRectangularContour(bottomWidth, bottomDepth),
    thicknessMm: bottomThickness,
    structural: false,
  });
  pieces.push(boxBottom);
  subPieceIds.push(boxBottom.id);

  placementNodes.push({
    pieceId: boxBottom.id,
    parentPieceId,
    relativeOffset: { x: bottomOffsetX, y: bottomOffsetY, z: bottomOffsetZ },
  });

  // 5. Box Joints
  // If box walls are thin (<= 9mm, e.g. 6mm or 9mm craft/organizer drawers), joints are glued ('glue') or rebated ('rebate'), NEVER confirmat or screw drilled into edges!
  const effectiveBoxJointKind: JointKind = config.boxJointKind ?? (isThinBox ? 'glue' : 'confirmat');
  const frontToSideJointKind: JointKind = (isThinBox || actualFrontT <= 9) ? (config.boxJointKind ?? 'glue') : 'confirmat';

  if (boxFront) {
    joints.push(
      createJoint({
        a: { pieceId: boxSideL.id, faceId: 'inner' },
        b: { pieceId: boxFront.id, faceId: 'left-edge' },
        kind: effectiveBoxJointKind,
      }),
      createJoint({
        a: { pieceId: boxSideR.id, faceId: 'inner' },
        b: { pieceId: boxFront.id, faceId: 'right-edge' },
        kind: effectiveBoxJointKind,
      }),
    );
  } else {
    // Simple-interior: sides connect directly to single front
    joints.push(
      createJoint({
        a: { pieceId: front.id, faceId: 'inner' },
        b: { pieceId: boxSideL.id, faceId: 'front-edge' },
        kind: frontToSideJointKind,
      }),
      createJoint({
        a: { pieceId: front.id, faceId: 'inner' },
        b: { pieceId: boxSideR.id, faceId: 'front-edge' },
        kind: frontToSideJointKind,
      }),
    );
  }

  joints.push(
    createJoint({
      a: { pieceId: boxSideL.id, faceId: 'inner' },
      b: { pieceId: boxBack.id, faceId: 'left-edge' },
      kind: effectiveBoxJointKind,
    }),
    createJoint({
      a: { pieceId: boxSideR.id, faceId: 'inner' },
      b: { pieceId: boxBack.id, faceId: 'right-edge' },
      kind: effectiveBoxJointKind,
    }),
    createJoint({
      a: { pieceId: boxSideL.id, faceId: 'inner' },
      b: { pieceId: boxBottom.id, faceId: 'left-edge' },
      kind: effectiveBottomMount === 'grooved' ? 'groove' : (isThinBox ? 'glue' : 'rebate'),
    }),
    createJoint({
      a: { pieceId: boxSideR.id, faceId: 'inner' },
      b: { pieceId: boxBottom.id, faceId: 'right-edge' },
      kind: effectiveBottomMount === 'grooved' ? 'groove' : (isThinBox ? 'glue' : 'rebate'),
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
      isSimpleInterior: isSimpleInterior ? 1 : 0,
      topPullGapMm: effectiveTopPullGap,
      boxSideHeightOffsetMm,
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
