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

      // Adapt shelf geometry for architectural interferences (column obstacle or false square)
      const column = bay.interferences?.columnObstacle?.enabled ? bay.interferences.columnObstacle : undefined;
      const falseSquare = bay.interferences?.falseSquare?.enabled ? bay.interferences.falseSquare : undefined;

      if (column) {
        const bayLeft = bay.x;
        const bayRight = bay.x + bay.width;
        const totalW = bay.overallWidth ?? (bayRight + T);
        const shelfWidth = shelfRes.piece.contour.points[1]?.x ?? bay.width;
        const shelfDepth = shelfRes.piece.contour.points[2]?.y ?? (bay.depth - setbackMm);

        if (column.corner === 'back-left' && bayLeft < column.widthMm) {
          const notchWidth = Math.min(shelfWidth - 30, Math.max(10, column.widthMm - bayLeft));
          const notchDepth = column.depthMm;
          const innerDepth = Math.max(20, shelfDepth - notchDepth);

          shelfRes.piece.contour = {
            points: [
              { x: 0, y: 0 },
              { x: shelfWidth, y: 0 },
              { x: shelfWidth, y: shelfDepth },
              { x: notchWidth, y: shelfDepth },
              { x: notchWidth, y: innerDepth },
              { x: 0, y: innerDepth },
            ],
          };
          shelfRes.piece.rawBoundingBox = { widthMm: shelfWidth, heightMm: shelfDepth };
          shelfRes.piece.secondaryCuts = [
            {
              type: 'notch',
              corner: 'back-left',
              widthMm: notchWidth,
              depthMm: notchDepth,
              description: `Destaje para columna trasera izquierda: ${notchWidth} x ${notchDepth} mm`,
            },
          ];
        } else if (column.corner === 'back-right' && bayRight > totalW - column.widthMm) {
          const notchWidth = Math.min(shelfWidth - 30, Math.max(10, bayRight - (totalW - column.widthMm)));
          const notchDepth = column.depthMm;
          const innerDepth = Math.max(20, shelfDepth - notchDepth);

          shelfRes.piece.contour = {
            points: [
              { x: 0, y: 0 },
              { x: shelfWidth, y: 0 },
              { x: shelfWidth, y: innerDepth },
              { x: shelfWidth - notchWidth, y: innerDepth },
              { x: shelfWidth - notchWidth, y: shelfDepth },
              { x: 0, y: shelfDepth },
            ],
          };
          shelfRes.piece.rawBoundingBox = { widthMm: shelfWidth, heightMm: shelfDepth };
          shelfRes.piece.secondaryCuts = [
            {
              type: 'notch',
              corner: 'back-right',
              widthMm: notchWidth,
              depthMm: notchDepth,
              description: `Destaje para columna trasera derecha: ${notchWidth} x ${notchDepth} mm`,
            },
          ];
        }
      } else if (falseSquare) {
        const totalW = bay.overallWidth ?? (bay.width + 2 * T);
        const shelfWidth = shelfRes.piece.contour.points[1]?.x ?? bay.width;
        const leftDepth = falseSquare.leftDepthMm;
        const rightDepth = falseSquare.rightDepthMm;
        const shelfDepthLeft = Math.round(leftDepth + (bay.x / totalW) * (rightDepth - leftDepth) - setbackMm);
        const shelfDepthRight = Math.round(leftDepth + ((bay.x + bay.width) / totalW) * (rightDepth - leftDepth) - setbackMm);

        shelfRes.piece.contour = {
          points: [
            { x: 0, y: 0 },
            { x: shelfWidth, y: 0 },
            { x: shelfWidth, y: shelfDepthRight },
            { x: 0, y: shelfDepthLeft },
          ],
        };
        shelfRes.piece.rawBoundingBox = { widthMm: shelfWidth, heightMm: Math.max(shelfDepthLeft, shelfDepthRight) };
        shelfRes.piece.secondaryCuts = [
          {
            type: 'bevel-diagonal',
            description: `Chaflán trasera falsa escuadra: ${shelfDepthLeft} mm a ${shelfDepthRight} mm`,
            angleDeg: Math.round(Math.atan2(Math.abs(shelfDepthRight - shelfDepthLeft), shelfWidth) * (180 / Math.PI) * 10) / 10,
          },
        ];
      }

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
