import { type Piece, type Joint } from '../../../model';
import { createJoint } from '../../joint';
import { type PlacementNode } from '../../tree';
import { normalizeDoorMountType } from '../../templates/door';
import { buildShelf } from '../../templates/shelf';
import { buildDoorsForBay } from './doorsHelper';
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

    const doorsResult = buildDoorsForBay({
      bay,
      materials,
      options,
      count,
      hingeSide,
      mountType: normMount,
      hingeType: content.hingeType,
      doorThicknessMm: content.doorThicknessMm,
      catchType: content.catchType,
      handle: content.handle,
    });

    pieces.push(...doorsResult.pieces);
    joints.push(...doorsResult.joints);
    placementNodes.push(...doorsResult.placementNodes);

    return { pieces, joints, placementNodes, subAssemblies: [] };
  }
}
