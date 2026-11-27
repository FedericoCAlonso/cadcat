import { type Piece, type Joint } from '../../../model';
import { createPiece, createRectangularContour } from '../../piece';
import { createJoint } from '../../joint';
import { type PlacementNode } from '../../tree';
import { buildShelf } from '../../templates/shelf';
import { resolveTracks } from '../gridSolver';
import { buildDoorsForBay } from './doorsHelper';
import {
  type IBayContentResolver,
  type BayResolutionContext,
  type ComponentSolverResult,
} from './types';
import { type BayContentShelves } from '../types';

export class ShelvesBayResolver implements IBayContentResolver<BayContentShelves> {
  public readonly type = 'shelves' as const;

  public resolve(context: BayResolutionContext<BayContentShelves>): ComponentSolverResult {
    const { bay, content, materials, options } = context;
    const {
      carcassThicknessMm: T,
      edgeBandId,
      rootPieceId,
      idPrefix = `bay-${bay.bayIndex}`,
    } = options;

    const pieces: Piece[] = [];
    const joints: Joint[] = [];
    const placementNodes: PlacementNode[] = [];

    const {
      count,
      shelfType,
      setbackMm = 20,
      hasAntiSagBrace = false,
      shelfTracks,
      hasDoors = false,
      doorCount = 2,
      doorMountType = 'full-overlay',
      doorHingeSide = 'left',
    } = content;

    const isInsetDoor = hasDoors && (doorMountType === 'codo-18' || doorMountType === 'inset');
    const effectiveSetback = (isInsetDoor ? (options.frontThicknessMm ?? T) : 0) + setbackMm;

    if (count <= 0 && (!shelfTracks || shelfTracks.length < 2)) {
      if (hasDoors) {
        const doorsOnly = buildDoorsForBay({
          bay,
          materials,
          options,
          count: doorCount,
          hingeSide: doorHingeSide,
          mountType: doorMountType,
        });
        return {
          pieces: doorsOnly.pieces,
          joints: doorsOnly.joints,
          placementNodes: doorsOnly.placementNodes,
          subAssemblies: [],
        };
      }
      return { pieces, joints, placementNodes, subAssemblies: [] };
    }

    const effectiveTracks =
      shelfTracks && shelfTracks.length > 1
        ? shelfTracks
        : Array.from({ length: Math.max(1, count) + 1 }, () => ({ type: 'fractional' as const, valueFr: 1 }));

    const resolved = resolveTracks(bay.height, effectiveTracks, T);
    const effectiveCount = resolved.dividers.length;

    if (effectiveCount <= 0 && !hasDoors) {
      return { pieces, joints, placementNodes, subAssemblies: [] };
    }

    for (let i = 0; i < effectiveCount; i++) {
      const divider = resolved.dividers[i];
      if (!divider) continue;
      const shelfElevationY = bay.y + divider.offsetMm;
      const shelfId = `${idPrefix}-shelf-${i + 1}`;

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
          setbackMm: effectiveSetback,
          frontOffsetMm: effectiveSetback,
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

      if (hasAntiSagBrace && bay.width >= 400) {
        const braceId = `${shelfId}-brace`;
        const braceWidth = bay.width;
        const braceHeight = 60;
        const braceZ = effectiveSetback + 15;

        const bracePiece = createPiece({
          id: braceId,
          role: 'shelf-brace',
          materialId: materials.carcassMaterialId,
          contour: createRectangularContour(braceWidth, braceHeight),
          thicknessMm: T,
          structural: true,
        });

        if (edgeBandId) {
          const bottomEdge = bracePiece.faces.find((f) => f.id === 'bottom-edge');
          if (bottomEdge) {
            bottomEdge.edgeBandId = edgeBandId;
          }
        }

        pieces.push(bracePiece);

        placementNodes.push({
          pieceId: braceId,
          parentPieceId: rootPieceId,
          relativeOffset: {
            x: bay.x,
            y: shelfElevationY - braceHeight,
            z: braceZ,
          },
        });

        // 1. Structural joint with shelf bottom face
        joints.push(
          createJoint({
            a: { pieceId: shelfId, faceId: 'bottom-face' },
            b: { pieceId: braceId, faceId: 'top-edge' },
            kind: 'confirmat',
          }),
        );

        // 2. Structural joint anchoring to left lateral
        joints.push(
          createJoint({
            a: { pieceId: bay.leftPieceId, faceId: 'right-face' },
            b: { pieceId: braceId, faceId: 'left-edge' },
            kind: 'confirmat',
            offsetMm: shelfElevationY - Math.round(braceHeight / 2),
          }),
        );

        // 3. Structural joint anchoring to right lateral
        joints.push(
          createJoint({
            a: { pieceId: bay.rightPieceId, faceId: 'left-face' },
            b: { pieceId: braceId, faceId: 'right-edge' },
            kind: 'confirmat',
            offsetMm: shelfElevationY - Math.round(braceHeight / 2),
          }),
        );
      }
    }

    if (hasDoors) {
      const doorsResult = buildDoorsForBay({
        bay,
        materials,
        options,
        count: doorCount,
        hingeSide: doorHingeSide,
        mountType: doorMountType,
      });
      pieces.push(...doorsResult.pieces);
      joints.push(...doorsResult.joints);
      placementNodes.push(...doorsResult.placementNodes);
    }

    return {
      pieces,
      joints,
      placementNodes,
      subAssemblies: [],
    };
  }
}
