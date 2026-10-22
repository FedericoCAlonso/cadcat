import { type Piece, type Joint } from '../../../model';
import { createPiece, createRectangularContour } from '../../piece';
import { createJoint } from '../../joint';
import { type PlacementNode } from '../../tree';
import {
  buildDoorSubAssembly,
  normalizeDoorMountType,
  calculateHingeCount,
  calculateHingePositions,
} from '../../templates/door';
import { type BayBoundingBox, type DoorMountType } from '../types';

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
}

export function buildDoorsForBay(params: BuildDoorsForBayParams): {
  pieces: Piece[];
  joints: Joint[];
  placementNodes: PlacementNode[];
} {
  const { bay, materials, options, count = 1, hingeSide = 'left', mountType = 'full-overlay' } = params;
  const {
    carcassThicknessMm: T,
    frontThicknessMm = T,
    edgeBandId,
    rootPieceId,
    idPrefix = `bay-${bay.bayIndex}`,
  } = options;

  const pieces: Piece[] = [];
  const joints: Joint[] = [];
  const placementNodes: PlacementNode[] = [];

  const normMount = normalizeDoorMountType(mountType);

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
        doorThicknessMm: frontThicknessMm,
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

    for (const posMm of doorResult.hingePositionsMm) {
      joints.push(
        createJoint({
          a: { pieceId: doorResult.doorPiece.id, faceId: 'inner' },
          b: {
            pieceId: hingeSide === 'left' ? bay.leftPieceId : bay.rightPieceId,
            faceId: 'inner',
          },
          kind: 'hinge',
          offsetMm: doorBottomY + posMm,
          doorOffsetMm: posMm,
          hingeSide,
          hingeCrank: normMount,
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
      doorZ = bay.z - frontThicknessMm;
    } else {
      // Full overlay (codo-0)
      const totalOverlayWidth = bay.width + 2 * T - 2 * revealMm;
      singleDoorWidth = Math.round((totalOverlayWidth - gapMm) / 2);
      doorHeight = Math.round(bay.height + 2 * T - 2 * revealMm);
      leftDoorX = bay.x - T + revealMm;
      rightDoorX = leftDoorX + singleDoorWidth + gapMm;
      doorY = bay.y - T + revealMm;
      doorZ = bay.z - frontThicknessMm;
    }

    const leftDoorPiece = createPiece({
      id: `${idPrefix}-door-l`,
      role: 'door-left',
      materialId: materials.frontsMaterialId,
      contour: createRectangularContour(singleDoorWidth, doorHeight),
      thicknessMm: frontThicknessMm,
      structural: false,
    });

    const rightDoorPiece = createPiece({
      id: `${idPrefix}-door-r`,
      role: 'door-right',
      materialId: materials.frontsMaterialId,
      contour: createRectangularContour(singleDoorWidth, doorHeight),
      thicknessMm: frontThicknessMm,
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
    const hingePositionsMm = calculateHingePositions(doorHeight, hingeCount, 100);

    for (const posMm of hingePositionsMm) {
      joints.push(
        createJoint({
          a: { pieceId: leftDoorPiece.id, faceId: 'inner' },
          b: { pieceId: bay.leftPieceId, faceId: 'inner' },
          kind: 'hinge',
          offsetMm: doorY + posMm,
          doorOffsetMm: posMm,
          hingeSide: 'left',
          hingeCrank: normMount,
        }),
        createJoint({
          a: { pieceId: rightDoorPiece.id, faceId: 'inner' },
          b: { pieceId: bay.rightPieceId, faceId: 'inner' },
          kind: 'hinge',
          offsetMm: doorY + posMm,
          doorOffsetMm: posMm,
          hingeSide: 'right',
          hingeCrank: normMount,
        }),
      );
    }
  }

  return { pieces, joints, placementNodes };
}
