import { type Piece, type Joint, type MachiningConfig } from '../../model';
import { type ResolvedPiece } from '../resolver';
import { determinePieceSpatialSize } from '../spatial3d';

/**
 * Derives spacing intervals along a joint of length L using configurable thresholds.
 * 2 points for <= maxSpanWithoutCenterMm, 3 points for > maxSpanWithoutCenterMm.
 * Short pieces use proportional margins to avoid overlap.
 */
export function calculateJointDrillSpacings(
  contactLengthMm: number,
  endSetbackMm = 50,
  maxSpanWithoutCenterMm = 600,
  shortThresholdMm = 110,
  shortMarginMm = 25,
  minJointLengthMm = 50,
): number[] {
  if (contactLengthMm <= minJointLengthMm) {
    return [Math.round(contactLengthMm / 2)];
  }
  if (contactLengthMm <= shortThresholdMm) {
    const margin = Math.min(shortMarginMm, Math.floor(contactLengthMm / 3));
    return [margin, contactLengthMm - margin];
  }
  if (contactLengthMm <= maxSpanWithoutCenterMm) {
    return [endSetbackMm, contactLengthMm - endSetbackMm];
  }
  return [
    endSetbackMm,
    Math.round(contactLengthMm / 2),
    contactLengthMm - endSetbackMm,
  ];
}

/**
 * Helper to get drill spacings using values from MachiningConfig.
 */
export function calculateDrillSpacingsFromConfig(
  contactLengthMm: number,
  config: MachiningConfig,
): number[] {
  return calculateJointDrillSpacings(
    contactLengthMm,
    config.jointDrillMarginMm ?? 50,
    config.maxSpanWithoutCenterDrillMm ?? 600,
    config.shortPieceThresholdMm ?? 110,
    config.shortPieceMaxMarginMm ?? 25,
    config.minJointLengthMm ?? 50,
  );
}

export interface ContactGeometry {
  yContact: number;
  zStart: number;
  contactLen: number;
  axis: 'along-x' | 'along-y';
  getPieceAPosition: (offset: number) => { x: number; y: number };
}

/**
 * Derives the spatial contact line between two joined pieces:
 * - Computes orientation-aware 2D coordinates on pieceA's local face coordinate
 * - Supports both horizontal contacts (along-x) and vertical contacts (along-y)
 * - yContact / zStart preserved for backwards compatibility
 * - contactLen: length of contact interface along contact axis
 * - getPieceAPosition(offset): exact 2D (x, y) coordinates on pieceA
 */
export function deriveContactGeometry(
  pieceA: Piece | ResolvedPiece,
  pieceB: Piece | ResolvedPiece,
  joint: Joint,
): ContactGeometry {
  const sizeA = determinePieceSpatialSize(pieceA);
  const sizeB = determinePieceSpatialSize(pieceB);

  const posA = 'positionMm' in pieceA && pieceA.positionMm ? pieceA.positionMm : undefined;
  const posB = 'positionMm' in pieceB && pieceB.positionMm ? pieceB.positionMm : undefined;

  let yContact: number;
  let zStart: number;
  let contactLen: number;
  let axis: 'along-x' | 'along-y' = 'along-x';
  let getPieceAPosition: (offset: number) => { x: number; y: number };

  if (posA && posB) {
    // Determine 3D face axes for Piece A
    const { x: sxA, y: syA, z: szA } = sizeA;
    let uAxis: 'x' | 'y' | 'z';
    let vAxis: 'x' | 'y' | 'z';

    if (sxA <= syA && sxA <= szA) {
      // Standing in YZ plane (vertical side / partition)
      uAxis = 'z'; // 2D X is depth along Z
      vAxis = 'y'; // 2D Y is height along Y
    } else if (syA <= sxA && syA <= szA) {
      // Lying in XZ plane (shelf / bottom / roof)
      uAxis = 'x'; // 2D X is width along X
      vAxis = 'z'; // 2D Y is depth along Z
    } else {
      // Standing in XY plane (doors, back panel, plinth, drawer-front, drawer-box-front)
      uAxis = 'x'; // 2D X is width along X
      vAxis = 'y'; // 2D Y is height along Y
    }

    const dimB_U = sizeB[uAxis];
    const dimB_V = sizeB[vAxis];

    // Check whether the contact interface extends along Piece A's horizontal axis (uAxis)
    // or vertical axis (vAxis).
    if (dimB_V > dimB_U) {
      // Joint runs along Piece A's vertical face axis (vAxis)
      axis = 'along-y';
      contactLen = Math.round(dimB_V);
      const startV = Math.max(0, Math.round(posB[vAxis] - posA[vAxis]));
      const centerU = Math.round(posB[uAxis] - posA[uAxis] + dimB_U / 2);

      yContact = startV;
      zStart = centerU;
      getPieceAPosition = (off: number) => ({
        x: centerU,
        y: startV + off,
      });
    } else {
      // Joint runs along Piece A's horizontal face axis (uAxis)
      axis = 'along-x';
      contactLen = Math.round(dimB_U);
      if (contactLen <= 0) {
        contactLen = Math.round(sizeB.z > 0 ? sizeB.z : sizeB.x);
      }
      const startU = Math.max(0, Math.round(posB[uAxis] - posA[uAxis]));
      const centerV = Math.round(posB[vAxis] - posA[vAxis] + dimB_V / 2);

      yContact = centerV;
      zStart = startU;
      getPieceAPosition = (off: number) => ({
        x: startU + off,
        y: centerV,
      });
    }
  } else {
    // Fallback derivation based on piece contour points and semantic roles
    const aPoints = pieceA.contour.points;
    const aHeight = Math.abs(aPoints[2]?.y ?? 0);
    const aWidth = Math.abs(aPoints[1]?.x ?? 0);

    const bPoints = pieceB.contour.points;
    const bWidth = Math.abs(bPoints[1]?.x ?? 0);
    const bHeight = Math.abs(bPoints[2]?.y ?? 0);

    const aRole = pieceA.role.toLowerCase();
    const bRole = pieceB.role.toLowerCase();
    const bId = pieceB.id.toLowerCase();

    if (aRole.includes('front') || aRole.includes('door') || aRole.includes('back')) {
      // Piece A in XY plane
      if (bRole.includes('side')) {
        // Vertical side piece contacting drawer front or back panel
        axis = 'along-y';
        contactLen = bHeight > 0 ? bHeight : Math.round(pieceA.thicknessMm * 8);
        const isRight = bId.includes('-r-') || bId.includes('right') || bRole.includes('right');
        const sideT = pieceB.thicknessMm > 0 ? pieceB.thicknessMm : 18;
        const centerU = isRight
          ? Math.round(aWidth - sideT * 1.5)
          : Math.round(sideT * 1.5);
        const startV = 0;
        yContact = startV;
        zStart = centerU;
        getPieceAPosition = (off: number) => ({
          x: centerU,
          y: startV + off,
        });
      } else {
        // Horizontal piece (rail, bottom, shelf, roof) contacting back panel
        axis = 'along-x';
        contactLen = bWidth > 0 ? bWidth : aWidth;
        const startU = 0;
        const isTop = bRole.includes('roof') || bRole.includes('top') || bRole.includes('rail-back');
        const centerV = isTop
          ? Math.round(aHeight - pieceB.thicknessMm / 2)
          : Math.round(pieceB.thicknessMm / 2);
        yContact = centerV;
        zStart = startU;
        getPieceAPosition = (off: number) => ({
          x: startU + off,
          y: centerV,
        });
      }
    } else if (
      aRole.includes('roof') ||
      aRole.includes('top') ||
      aRole.includes('bottom') ||
      aRole.includes('shelf')
    ) {
      // Piece A in XZ plane (horizontal roof, bottom, shelf)
      if (bRole.includes('side') || bRole.includes('partition')) {
        axis = 'along-y';
        const isRight = bId.includes('-r-') || bId.includes('right') || bRole.includes('right');
        const sideT = pieceB.thicknessMm > 0 ? pieceB.thicknessMm : 18;
        const centerU = isRight
          ? Math.round(aWidth - sideT / 2)
          : Math.round(sideT / 2);
        const isVerticalEdge = joint.b.faceId.includes('left') || joint.b.faceId.includes('right');
        contactLen = isVerticalEdge ? bHeight : bWidth;
        if (contactLen <= 0) contactLen = aHeight;
        yContact = 0;
        zStart = centerU;
        getPieceAPosition = (off: number) => ({
          x: centerU,
          y: off,
        });
      } else {
        axis = 'along-x';
        contactLen = bWidth > 0 ? bWidth : aWidth;
        yContact = Math.round(pieceB.thicknessMm / 2);
        zStart = 0;
        getPieceAPosition = (off: number) => ({
          x: off,
          y: yContact,
        });
      }
    } else {
      // Piece A in YZ plane (carcase side / vertical partition)
      const isVerticalEdge = joint.b.faceId.includes('left') || joint.b.faceId.includes('right');
      contactLen = isVerticalEdge ? bHeight : bWidth;
      if (contactLen <= 0) {
        contactLen = Math.max(bWidth, bHeight, aWidth, aHeight, pieceB.thicknessMm);
      }

      if (bRole.includes('roof') || bRole.includes('top')) {
        yContact = Math.round(aHeight - pieceB.thicknessMm / 2);
        zStart = bRole.includes('rail-back') ? Math.max(0, Math.round(aWidth - contactLen)) : 0;
      } else if (bRole.includes('shelf')) {
        yContact = joint.offsetMm ?? Math.round(aHeight / 2);
        zStart = 0;
      } else {
        yContact = Math.round(pieceB.thicknessMm / 2);
        zStart = 0;
      }
      axis = 'along-x';
      getPieceAPosition = (off: number) => ({
        x: zStart + off,
        y: yContact,
      });
    }
  }

  return { yContact, zStart, contactLen, axis, getPieceAPosition };
}

/**
 * Determines whether a given face identifier maps to Face A, Face B, or an Edge.
 * For doors and front panels, Face A is the visible exterior and Face B is the interior.
 */
export function deriveFaceType(faceId: string, role?: string): 'face-A' | 'face-B' | 'edge' {
  const lower = faceId.toLowerCase();
  if (lower.includes('edge')) {
    return 'edge';
  }
  if (role) {
    const r = role.toLowerCase();
    if (
      r.includes('door') ||
      r.includes('front') ||
      r.includes('puerta') ||
      r.includes('frente') ||
      r.includes('leaf')
    ) {
      if (
        lower === 'inner' ||
        lower === 'face-b' ||
        lower === 'back' ||
        lower === 'rear-face' ||
        lower === 'interior'
      ) {
        return 'face-B';
      }
      return 'face-A';
    }
  }
  if (
    lower === 'face-b' ||
    lower === 'outer' ||
    lower === 'bottom' ||
    lower === 'bottom-face' ||
    lower === 'rear-face' ||
    lower === 'back'
  ) {
    return 'face-B';
  }
  return 'face-A';
}

export interface PieceBEdgeGeometry {
  edgePosition: { x: number; y: number };
  getPocketPosition: (setbackMm: number) => { x: number; y: number };
  faceType: 'edge';
  edgeFaceTypeForPocket: 'face-A' | 'face-B';
}

/**
 * Derives orientation-aware 2D coordinates on Piece B for edge drill holes
 * and face pockets (such as Minifix cams) based on the joined edge.
 *
 * Coordinates follow Datum (0,0) at bottom-left corner of Piece B:
 * - left-edge: X = 0, Y = offset along edge. Cam pocket at X = setbackMm, Y = offset.
 * - right-edge: X = width, Y = offset along edge. Cam pocket at X = width - setbackMm, Y = offset.
 * - bottom-edge / front-edge: X = offset along edge, Y = 0. Cam pocket at X = offset, Y = setbackMm.
 * - top-edge / rear-edge / back-edge: X = offset along edge, Y = height. Cam pocket at X = offset, Y = height - setbackMm.
 */
export function derivePieceBJointPositions(
  pieceB: Piece | ResolvedPiece,
  faceId: string,
  offsetAlongEdge: number,
  preferredPocketFace?: 'face-A' | 'face-B',
): PieceBEdgeGeometry {
  const points = pieceB.contour.points;
  const w = Math.abs(points[1]?.x ?? 0);
  const h = Math.abs(points[2]?.y ?? 0);
  const lower = faceId.toLowerCase();
  const role = pieceB.role?.toLowerCase() ?? '';

  // For roof/top panels, pocket is on underside (face-B). For bottoms/shelves, on top (face-A).
  const defaultPocketFace: 'face-A' | 'face-B' =
    role.includes('roof') || role.includes('top') ? 'face-B' : 'face-A';
  const pocketFace = preferredPocketFace ?? defaultPocketFace;

  if (lower.includes('left')) {
    return {
      edgePosition: { x: 0, y: offsetAlongEdge },
      getPocketPosition: (setbackMm: number) => ({ x: setbackMm, y: offsetAlongEdge }),
      faceType: 'edge',
      edgeFaceTypeForPocket: pocketFace,
    };
  }

  if (lower.includes('right')) {
    return {
      edgePosition: { x: w, y: offsetAlongEdge },
      getPocketPosition: (setbackMm: number) => ({
        x: Math.max(0, w - setbackMm),
        y: offsetAlongEdge,
      }),
      faceType: 'edge',
      edgeFaceTypeForPocket: pocketFace,
    };
  }

  if (lower.includes('top') || lower.includes('rear') || lower.includes('back')) {
    return {
      edgePosition: { x: offsetAlongEdge, y: h },
      getPocketPosition: (setbackMm: number) => ({
        x: offsetAlongEdge,
        y: Math.max(0, h - setbackMm),
      }),
      faceType: 'edge',
      edgeFaceTypeForPocket: pocketFace,
    };
  }

  // Default: bottom-edge or front-edge
  return {
    edgePosition: { x: offsetAlongEdge, y: 0 },
    getPocketPosition: (setbackMm: number) => ({
      x: offsetAlongEdge,
      y: setbackMm,
    }),
    faceType: 'edge',
    edgeFaceTypeForPocket: pocketFace,
  };
}

