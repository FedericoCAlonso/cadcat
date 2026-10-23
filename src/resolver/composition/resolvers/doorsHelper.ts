import { type Piece, type Joint, type JointKind } from '../../../model';
import { createPiece, createRectangularContour } from '../../piece';
import { createJoint } from '../../joint';
import { type PlacementNode } from '../../tree';
import {
  buildDoorSubAssembly,
  normalizeDoorMountType,
  calculateHingeCount,
  calculateHingePositions,
} from '../../templates/door';
import {
  type BayBoundingBox,
  type DoorMountType,
  type DoorHingeType,
  type DoorCatchType,
  type HandleConfig,
} from '../types';

export interface BuildDoorsForBayParams {
  bay: BayBoundingBox;
  materials: { frontsMaterialId: string; carcassMaterialId: string };
  options: {
    carcassThicknessMm: number;
    frontThicknessMm?: number;
    edgeBandId?: string;
    rootPieceId: string;
    idPrefix?: string;
  };
  count?: 1 | 2;
  hingeSide?: 'left' | 'right';
  mountType?: DoorMountType;
  hingeType?: DoorHingeType;
  doorThicknessMm?: number;
  catchType?: DoorCatchType;
  handle?: HandleConfig;
}

export function buildDoorsForBay(params: BuildDoorsForBayParams): {
  pieces: Piece[];
  joints: Joint[];
  placementNodes: PlacementNode[];
} {
  const {
    bay,
    materials,
    options,
    count = 1,
    hingeSide = 'left',
    mountType = 'full-overlay',
    hingeType = 'concealed-cup',
    doorThicknessMm,
    catchType,
    handle,
  } = params;
  const {
    carcassThicknessMm: T,
    frontThicknessMm = T,
    edgeBandId,
    rootPieceId,
    idPrefix = `bay-${bay.bayIndex}`,
  } = options;

  const actualDoorT = doorThicknessMm ?? frontThicknessMm;
  const pieces: Piece[] = [];
  const joints: Joint[] = [];
  const placementNodes: PlacementNode[] = [];

  const normMount = normalizeDoorMountType(mountType);
  const effectiveHingeKind: JointKind =
    hingeType === 'butt-hinge'
      ? 'butt-hinge'
      : hingeType === 'piano' || hingeType === 'piano-hinge'
        ? 'piano-hinge'
        : 'hinge';

  if (count === 1) {
    const doorResult = buildDoorSubAssembly(
      {
        id: `${idPrefix}-door`,
        side: hingeSide,
        mountType: normMount,
        openingWidthMm: bay.width,
        openingHeightMm: bay.height,
        carcaseThicknessMm: T,
        materialId: materials.frontsMaterialId,
        doorThicknessMm: actualDoorT,
        edgeBandId,
      },
      rootPieceId,
    );

    doorResult.placementNode.relativeOffset.x += (bay.x - T);
    doorResult.placementNode.relativeOffset.y += (bay.y - T);
    doorResult.placementNode.relativeOffset.z += bay.z;

    pieces.push(doorResult.doorPiece);
    placementNodes.push(doorResult.placementNode);

    const doorBottomY = doorResult.placementNode.relativeOffset.y;

    const hingePositions =
      effectiveHingeKind === 'piano-hinge'
        ? [Math.round(bay.height / 2)]
        : doorResult.hingePositionsMm;

    for (const posMm of hingePositions) {
      joints.push(
        createJoint({
          a: { pieceId: doorResult.doorPiece.id, faceId: 'inner' },
          b: {
            pieceId: hingeSide === 'left' ? bay.leftPieceId : bay.rightPieceId,
            faceId: 'inner',
          },
          kind: effectiveHingeKind,
          offsetMm: doorBottomY + posMm,
          doorOffsetMm: posMm,
          hingeSide,
          hingeCrank: normMount,
        }),
      );
    }

    // Optional catch / latch
    if (catchType && catchType !== 'none') {
      const catchKind: JointKind =
        catchType === 'magnetic' || catchType === 'magnetic-catch'
          ? 'magnetic-catch'
          : catchType === 'roller' || catchType === 'roller-catch'
            ? 'roller-catch'
            : 'push-catch';
      joints.push(
        createJoint({
          a: { pieceId: doorResult.doorPiece.id, faceId: 'inner' },
          b: { pieceId: hingeSide === 'left' ? bay.rightPieceId : bay.leftPieceId, faceId: 'inner' },
          kind: catchKind,
          offsetMm: doorBottomY + Math.round(bay.height / 2),
        }),
      );
    }

    // Optional handle
    if (handle && handle.type && handle.type !== 'none' && handle.type !== 'push-to-open' && handle.type !== 'integrated-groove') {
      const pitch = handle.type === 'knob' ? 0 : (handle.centerToCenterMm ?? 128);
      joints.push(
        createJoint({
          a: { pieceId: doorResult.doorPiece.id, faceId: 'inner' },
          b: { pieceId: doorResult.doorPiece.id, faceId: 'inner' },
          kind: 'handle',
          offsetMm: pitch,
          hingeSide,
        }),
      );
    }
  } else {
    // Double door (pair)
    const gapMm = 2;
    const revealMm = 1.5;

    let singleDoorWidth: number;
    let leftDoorX: number;
    let rightDoorX: number;
    let doorHeight: number;
    let doorY: number;
    let doorZ: number;

    if (normMount === 'codo-18') {
      // Both doors fit inside the bay opening
      singleDoorWidth = Math.round((bay.width - 3 * gapMm) / 2);
      doorHeight = Math.round(bay.height - 2 * gapMm);
      leftDoorX = bay.x + gapMm;
      rightDoorX = bay.x + gapMm + singleDoorWidth + gapMm;
      doorY = bay.y + gapMm;
      doorZ = bay.z;
    } else if (normMount === 'codo-9') {
      // Half overlay on side edges
      const totalOverlayWidth = bay.width + T - 2 * revealMm;
      singleDoorWidth = Math.round((totalOverlayWidth - gapMm) / 2);
      doorHeight = Math.round(bay.height + 2 * T - 2 * revealMm);
      leftDoorX = bay.x - T / 2 + revealMm;
      rightDoorX = leftDoorX + singleDoorWidth + gapMm;
      doorY = bay.y - T + revealMm;
      doorZ = bay.z - actualDoorT;
    } else {
      // Full overlay (codo-0)
      const totalOverlayWidth = bay.width + 2 * T - 2 * revealMm;
      singleDoorWidth = Math.round((totalOverlayWidth - gapMm) / 2);
      doorHeight = Math.round(bay.height + 2 * T - 2 * revealMm);
      leftDoorX = bay.x - T + revealMm;
      rightDoorX = leftDoorX + singleDoorWidth + gapMm;
      doorY = bay.y - T + revealMm;
      doorZ = bay.z - actualDoorT;
    }

    const leftDoorPiece = createPiece({
      id: `${idPrefix}-door-l`,
      role: 'door-left',
      materialId: materials.frontsMaterialId,
      contour: createRectangularContour(singleDoorWidth, doorHeight),
      thicknessMm: actualDoorT,
      structural: false,
    });

    const rightDoorPiece = createPiece({
      id: `${idPrefix}-door-r`,
      role: 'door-right',
      materialId: materials.frontsMaterialId,
      contour: createRectangularContour(singleDoorWidth, doorHeight),
      thicknessMm: actualDoorT,
      structural: false,
    });

    if (edgeBandId) {
      for (const p of [leftDoorPiece, rightDoorPiece]) {
        for (const f of p.faces) {
          if (f.id.endsWith('-edge')) f.edgeBandId = edgeBandId;
        }
      }
    }

    pieces.push(leftDoorPiece, rightDoorPiece);

    placementNodes.push(
      {
        pieceId: leftDoorPiece.id,
        parentPieceId: rootPieceId,
        relativeOffset: { x: leftDoorX, y: doorY, z: doorZ },
      },
      {
        pieceId: rightDoorPiece.id,
        parentPieceId: rootPieceId,
        relativeOffset: { x: rightDoorX, y: doorY, z: doorZ },
      },
    );

    const hingeCount = calculateHingeCount(doorHeight);
    const hingePositionsMm =
      effectiveHingeKind === 'piano-hinge'
        ? [Math.round(doorHeight / 2)]
        : calculateHingePositions(doorHeight, hingeCount, 100);

    for (const posMm of hingePositionsMm) {
      joints.push(
        createJoint({
          a: { pieceId: leftDoorPiece.id, faceId: 'inner' },
          b: { pieceId: bay.leftPieceId, faceId: 'inner' },
          kind: effectiveHingeKind,
          offsetMm: doorY + posMm,
          doorOffsetMm: posMm,
          hingeSide: 'left',
          hingeCrank: normMount,
        }),
        createJoint({
          a: { pieceId: rightDoorPiece.id, faceId: 'inner' },
          b: { pieceId: bay.rightPieceId, faceId: 'inner' },
          kind: effectiveHingeKind,
          offsetMm: doorY + posMm,
          doorOffsetMm: posMm,
          hingeSide: 'right',
          hingeCrank: normMount,
        }),
      );
    }

    // Optional catch for double door
    if (catchType && catchType !== 'none') {
      const catchKind: JointKind =
        catchType === 'magnetic' || catchType === 'magnetic-catch'
          ? 'magnetic-catch'
          : catchType === 'roller' || catchType === 'roller-catch'
            ? 'roller-catch'
            : 'push-catch';
      joints.push(
        createJoint({
          a: { pieceId: leftDoorPiece.id, faceId: 'inner' },
          b: { pieceId: bay.leftPieceId, faceId: 'inner' },
          kind: catchKind,
          offsetMm: doorY + Math.round(doorHeight / 2),
        }),
        createJoint({
          a: { pieceId: rightDoorPiece.id, faceId: 'inner' },
          b: { pieceId: bay.rightPieceId, faceId: 'inner' },
          kind: catchKind,
          offsetMm: doorY + Math.round(doorHeight / 2),
        }),
      );
    }

    // Optional handles for double doors
    if (handle && handle.type && handle.type !== 'none' && handle.type !== 'push-to-open' && handle.type !== 'integrated-groove') {
      const pitch = handle.type === 'knob' ? 0 : (handle.centerToCenterMm ?? 128);
      joints.push(
        createJoint({
          a: { pieceId: leftDoorPiece.id, faceId: 'inner' },
          b: { pieceId: leftDoorPiece.id, faceId: 'inner' },
          kind: 'handle',
          offsetMm: pitch,
          hingeSide: 'left',
        }),
        createJoint({
          a: { pieceId: rightDoorPiece.id, faceId: 'inner' },
          b: { pieceId: rightDoorPiece.id, faceId: 'inner' },
          kind: 'handle',
          offsetMm: pitch,
          hingeSide: 'right',
        }),
      );
    }
  }

  return { pieces, joints, placementNodes };
}
