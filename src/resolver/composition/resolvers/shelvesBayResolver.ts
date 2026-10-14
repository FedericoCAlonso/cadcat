import { type Piece, type Joint } from '../../../model';
import { createPiece, createRectangularContour } from '../../piece';
import { createJoint } from '../../joint';
import { type PlacementNode } from '../../tree';
import { buildShelf } from '../../templates/shelf';
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
    } = content;

    if (count <= 0) {
      return { pieces, joints, placementNodes, subAssemblies: [] };
    }

    const stepY = bay.height / (count + 1);

    for (let i = 0; i < count; i++) {
      const shelfElevationY = bay.y + Math.round((i + 1) * stepY - T / 2);
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
          setbackMm,
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

      if (hasAntiSagBrace && bay.width > 500) {
        const braceId = `${shelfId}-brace`;
        const braceWidth = Math.max(100, bay.width - 40);
        const braceHeight = 60;

        const bracePiece = createPiece({
          id: braceId,
          role: 'shelf-brace',
          materialId: materials.carcassMaterialId,
          contour: createRectangularContour(braceWidth, braceHeight),
          thicknessMm: T,
          structural: false,
        });
        pieces.push(bracePiece);

        placementNodes.push({
          pieceId: braceId,
          parentPieceId: rootPieceId,
          relativeOffset: {
            x: bay.x + 20,
            y: shelfElevationY - braceHeight,
            z: Math.round(bay.depth / 2),
          },
        });

        joints.push(
          createJoint({
            a: { pieceId: shelfId, faceId: 'bottom-face' },
            b: { pieceId: braceId, faceId: 'top-edge' },
            kind: 'confirmat',
          }),
        );
      }
    }

    return {
      pieces,
      joints,
      placementNodes,
      subAssemblies: [],
    };
  }
}
