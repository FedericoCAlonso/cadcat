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

      // Adapt shelf geometry for architectural interferences (column obstacle or false square)
      const column = bay.interferences?.columnObstacle?.enabled ? bay.interferences.columnObstacle : undefined;
      const falseSquare = bay.interferences?.falseSquare?.enabled ? bay.interferences.falseSquare : undefined;

      if (column) {
        const bayLeft = bay.x;
        const totalW = bay.overallWidth ?? (bay.x + bay.width + T);
        const shelfWidth = shelfRes.piece.contour.points[1]?.x ?? bay.width;
        const shelfDepth = shelfRes.piece.contour.points[2]?.y ?? (bay.depth - setbackMm);

        const isBeam = column.type === 'horizontal-beam';
        const obstRefEdge = column.referenceEdge ?? (column.corner === 'back-right' ? 'right' : 'left');
        const obstDist = column.distanceFromReferenceMm ?? 0;
        const obstD = column.depthMm;
        const obstW = column.widthMm ?? (isBeam ? totalW : 150);

        let obstX0 = 0;
        let obstX1 = totalW;
        if (isBeam) {
          if (column.widthMm && column.widthMm > 0 && column.widthMm < totalW) {
            obstX0 = obstRefEdge === 'right' ? Math.max(0, totalW - obstDist - column.widthMm) : obstDist;
            obstX1 = obstRefEdge === 'right' ? Math.max(0, totalW - obstDist) : Math.min(totalW, obstDist + column.widthMm);
          } else {
            obstX0 = 0;
            obstX1 = totalW;
          }
        } else {
          if (obstRefEdge === 'right' || column.corner === 'back-right') {
            obstX1 = Math.max(0, totalW - obstDist);
            obstX0 = Math.max(0, totalW - obstDist - obstW);
          } else {
            obstX0 = obstDist;
            obstX1 = Math.min(totalW, obstDist + obstW);
          }
        }

        const x_0 = Math.max(0, obstX0 - bayLeft);
        const x_1 = Math.min(shelfWidth, obstX1 - bayLeft);

        if (x_1 > x_0) {
          const innerDepth = Math.max(20, shelfDepth - obstD);
          const notchW = Math.round(x_1 - x_0);

          if (x_0 <= 0 && x_1 >= shelfWidth) {
            shelfRes.piece.contour = createRectangularContour(shelfWidth, innerDepth);
            shelfRes.piece.rawBoundingBox = { widthMm: shelfWidth, heightMm: shelfDepth };
            shelfRes.piece.secondaryCuts = [
              {
                type: 'notch',
                description: `Profundidad reducida por interferencia trasera: ${shelfWidth} x ${obstD} mm`,
                depthMm: obstD,
              },
            ];
          } else if (x_0 <= 0 && x_1 < shelfWidth) {
            const cutW = Math.round(x_1);
            shelfRes.piece.contour = {
              points: [
                { x: 0, y: 0 },
                { x: shelfWidth, y: 0 },
                { x: shelfWidth, y: shelfDepth },
                { x: cutW, y: shelfDepth },
                { x: cutW, y: innerDepth },
                { x: 0, y: innerDepth },
              ],
            };
            shelfRes.piece.rawBoundingBox = { widthMm: shelfWidth, heightMm: shelfDepth };
            shelfRes.piece.secondaryCuts = [
              {
                type: 'notch',
                corner: 'back-left',
                widthMm: cutW,
                depthMm: obstD,
                description: `Destaje para columna trasera izquierda: ${cutW} x ${obstD} mm`,
              },
            ];
          } else if (x_0 > 0 && x_1 >= shelfWidth) {
            const cutW = Math.round(shelfWidth - x_0);
            shelfRes.piece.contour = {
              points: [
                { x: 0, y: 0 },
                { x: shelfWidth, y: 0 },
                { x: shelfWidth, y: innerDepth },
                { x: x_0, y: innerDepth },
                { x: x_0, y: shelfDepth },
                { x: 0, y: shelfDepth },
              ],
            };
            shelfRes.piece.rawBoundingBox = { widthMm: shelfWidth, heightMm: shelfDepth };
            shelfRes.piece.secondaryCuts = [
              {
                type: 'notch',
                corner: 'back-right',
                widthMm: cutW,
                depthMm: obstD,
                description: `Destaje para columna trasera derecha: ${cutW} x ${obstD} mm`,
              },
            ];
          } else if (x_0 > 0 && x_1 < shelfWidth) {
            shelfRes.piece.contour = {
              points: [
                { x: 0, y: 0 },
                { x: shelfWidth, y: 0 },
                { x: shelfWidth, y: shelfDepth },
                { x: x_1, y: shelfDepth },
                { x: x_1, y: innerDepth },
                { x: x_0, y: innerDepth },
                { x: x_0, y: shelfDepth },
                { x: 0, y: shelfDepth },
              ],
            };
            shelfRes.piece.rawBoundingBox = { widthMm: shelfWidth, heightMm: shelfDepth };
            shelfRes.piece.secondaryCuts = [
              {
                type: 'notch',
                corner: 'intermediate-rear',
                widthMm: notchW,
                depthMm: obstD,
                description: `Cajeado interior para columna a ${Math.round(x_0)} mm del lateral: ${notchW} x ${obstD} mm`,
              },
            ];
          }
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
