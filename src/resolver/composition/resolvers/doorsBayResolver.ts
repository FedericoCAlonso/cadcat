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
import { buildShelf } from '../../templates/shelf';
import {
  type IBayContentResolver,
  type BayResolutionContext,
  type ComponentSolverResult,
} from './types';
import { type BayContentDoors } from '../types';

export class DoorsBayResolver implements IBayContentResolver<BayContentDoors> {
  public readonly type = 'doors' as const;

  public resolve(context: BayResolutionContext<BayContentDoors>): ComponentSolverResult {
    const { bay, content, materials, options } = context;
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

    const {
      count = 1,
      hingeSide = 'left',
      mountType = 'full-overlay',
      interiorShelvesCount = 0,
      shelfType = 'adjustable',
      shelvesSetbackMm = 20,
    } = content;

    const normMount = normalizeDoorMountType(mountType);
    const isInset = normMount === 'codo-18';

    // Resolve interior shelves behind the doors
    // For inset doors, shelves must start behind the door (frontThicknessMm + setback)
    if (interiorShelvesCount > 0) {
      const stepY = bay.height / (interiorShelvesCount + 1);
      const shelfFrontOffset = (isInset ? frontThicknessMm : 0) + shelvesSetbackMm;

      for (let i = 0; i < interiorShelvesCount; i++) {
        const shelfElevationY = bay.y + Math.round((i + 1) * stepY - T / 2);
        const shelfId = `${idPrefix}-door-shelf-${i + 1}`;

        const shelfRes = buildShelf(
          {
            id: shelfId,
            openingWidthMm: bay.width,
            depthMm: bay.depth,
            elevationYMm: shelfElevationY,
            carcaseThicknessMm: T,
            materialId: materials.carcassMaterialId,
            thicknessMm: T,
            mountType: shelfType,
            edgeBandId,
            setbackMm: shelfFrontOffset,
            frontOffsetMm: shelfFrontOffset,
          },
          rootPieceId,
        );

        shelfRes.placementNode.relativeOffset.x =
          bay.x + (shelfType === 'adjustable' ? 1 : 0);
        shelfRes.placementNode.relativeOffset.z = bay.z + shelfFrontOffset;

        pieces.push(shelfRes.piece);
        placementNodes.push(shelfRes.placementNode);

        const jointKind = shelfType === 'fixed' ? 'confirmat' : 'shelf-pin';
        joints.push(
          createJoint({
            a: { pieceId: bay.leftPieceId, faceId: 'inner' },
            b: { pieceId: shelfId, faceId: 'left-edge' },
            kind: jointKind,
            offsetMm: shelfElevationY,
          }),
          createJoint({
            a: { pieceId: bay.rightPieceId, faceId: 'inner' },
            b: { pieceId: shelfId, faceId: 'right-edge' },
            kind: jointKind,
            offsetMm: shelfElevationY,
          }),
        );
      }
    }

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

      for (const posMm of doorResult.hingePositionsMm) {
        joints.push(
          createJoint({
            a: { pieceId: doorResult.doorPiece.id, faceId: 'inner' },
            b: {
              pieceId: hingeSide === 'left' ? bay.leftPieceId : bay.rightPieceId,
              faceId: 'inner',
            },
            kind: 'hinge',
            offsetMm: bay.y + posMm,
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
            offsetMm: bay.y + posMm,
            hingeCrank: normMount,
          }),
          createJoint({
            a: { pieceId: rightDoorPiece.id, faceId: 'inner' },
            b: { pieceId: bay.rightPieceId, faceId: 'inner' },
            kind: 'hinge',
            offsetMm: bay.y + posMm,
            hingeCrank: normMount,
          }),
        );
      }
    }

    return { pieces, joints, placementNodes, subAssemblies: [] };
  }
}
