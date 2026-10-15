import { type Piece, type Joint } from '../../../model';
import { createJoint } from '../../joint';
import { type PlacementNode } from '../../tree';
import { buildDoorSubAssembly } from '../../templates/door';
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

    // Resolve interior shelves behind the doors
    if (interiorShelvesCount > 0) {
      const stepY = bay.height / (interiorShelvesCount + 1);
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
            setbackMm: shelvesSetbackMm,
          },
          rootPieceId,
        );

        shelfRes.placementNode.relativeOffset.x =
          bay.x + (shelfType === 'adjustable' ? 1 : 0);

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
          mountType,
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
          }),
        );
      }
    } else {
      // Double door (pair)
      const halfWidth = Math.round((bay.width - 4) / 2);

      const leftDoorResult = buildDoorSubAssembly(
        {
          id: `${idPrefix}-door-l`,
          side: 'left',
          mountType: mountType === 'full-overlay' ? 'full-overlay' : mountType,
          openingWidthMm: halfWidth,
          openingHeightMm: bay.height,
          carcaseThicknessMm: T,
          materialId: materials.frontsMaterialId,
          doorThicknessMm: frontThicknessMm,
          edgeBandId,
        },
        rootPieceId,
      );

      const rightDoorResult = buildDoorSubAssembly(
        {
          id: `${idPrefix}-door-r`,
          side: 'right',
          mountType: mountType === 'full-overlay' ? 'full-overlay' : mountType,
          openingWidthMm: halfWidth,
          openingHeightMm: bay.height,
          carcaseThicknessMm: T,
          materialId: materials.frontsMaterialId,
          doorThicknessMm: frontThicknessMm,
          edgeBandId,
        },
        rootPieceId,
      );

      leftDoorResult.placementNode.relativeOffset.x += (bay.x - T);
      leftDoorResult.placementNode.relativeOffset.y += (bay.y - T);

      rightDoorResult.placementNode.relativeOffset.x += (bay.x - T + halfWidth + 4);
      rightDoorResult.placementNode.relativeOffset.y += (bay.y - T);

      pieces.push(leftDoorResult.doorPiece, rightDoorResult.doorPiece);
      placementNodes.push(leftDoorResult.placementNode, rightDoorResult.placementNode);

      for (const posMm of leftDoorResult.hingePositionsMm) {
        joints.push(
          createJoint({
            a: { pieceId: leftDoorResult.doorPiece.id, faceId: 'inner' },
            b: { pieceId: bay.leftPieceId, faceId: 'inner' },
            kind: 'hinge',
            offsetMm: bay.y + posMm,
          }),
        );
      }

      for (const posMm of rightDoorResult.hingePositionsMm) {
        joints.push(
          createJoint({
            a: { pieceId: rightDoorResult.doorPiece.id, faceId: 'inner' },
            b: { pieceId: bay.rightPieceId, faceId: 'inner' },
            kind: 'hinge',
            offsetMm: bay.y + posMm,
          }),
        );
      }
    }

    return { pieces, joints, placementNodes, subAssemblies: [] };
  }
}
