import { type Piece, type Joint } from '../../../model';
import { createPiece, createRectangularContour } from '../../piece';
import { createJoint } from '../../joint';
import { type PlacementNode } from '../../tree';
import {
  type IBayContentResolver,
  type BayResolutionContext,
  type ComponentSolverResult,
} from './types';
import { type BayContentPullOutTray } from '../types';

export class PullOutTrayBayResolver implements IBayContentResolver<BayContentPullOutTray> {
  public readonly type = 'pull-out-tray' as const;

  public resolve(context: BayResolutionContext<BayContentPullOutTray>): ComponentSolverResult {
    const { bay, content, materials, options } = context;
    const {
      boxThicknessMm = 15,
      rootPieceId,
      idPrefix = `bay-${bay.bayIndex}`,
    } = options;

    const pieces: Piece[] = [];
    const joints: Joint[] = [];
    const placementNodes: PlacementNode[] = [];

    const {
      lipHeightMm = 0,
      slideType = 'telescopic',
      clearanceDeductionMm,
      elevationYMm,
    } = content;

    const clearance = clearanceDeductionMm ?? (slideType === 'undermount' ? 10.0 : 25.4);
    const trayWidth = Math.round(bay.width - clearance);
    const trayFrontOffsetMm = 10;
    const trayDepth = Math.min(
      Math.max(50, bay.depth - trayFrontOffsetMm),
      Math.max(250, bay.depth - 50),
    );
    const trayElevationY = elevationYMm ?? (bay.y + 30);
    const trayThickness = boxThicknessMm;

    const trayBottomId = `${idPrefix}-tray-bottom`;
    const trayBottom = createPiece({
      id: trayBottomId,
      role: 'tray-bottom',
      materialId: materials.drawerBoxesMaterialId,
      contour: createRectangularContour(trayWidth, trayDepth),
      thicknessMm: trayThickness,
      structural: true,
    });
    pieces.push(trayBottom);

    const trayX = bay.x + Math.round(clearance / 2);
    placementNodes.push({
      pieceId: trayBottomId,
      parentPieceId: rootPieceId,
      relativeOffset: {
        x: trayX,
        y: trayElevationY,
        z: 10,
      },
    });

    // Side slide joints
    joints.push(
      createJoint({
        a: { pieceId: trayBottomId, faceId: 'left-edge' },
        b: { pieceId: bay.leftPieceId, faceId: 'inner' },
        kind: 'slide',
        offsetMm: trayElevationY,
      }),
      createJoint({
        a: { pieceId: trayBottomId, faceId: 'right-edge' },
        b: { pieceId: bay.rightPieceId, faceId: 'inner' },
        kind: 'slide',
        offsetMm: trayElevationY,
      }),
    );

    // Add retention lips if lipHeightMm > 0
    if (lipHeightMm > 0) {
      const lipSideLId = `${idPrefix}-tray-lip-l`;
      const lipSideRId = `${idPrefix}-tray-lip-r`;
      const lipFrontId = `${idPrefix}-tray-lip-front`;
      const lipBackId = `${idPrefix}-tray-lip-back`;

      const lipSideL = createPiece({
        id: lipSideLId,
        role: 'tray-lip-side',
        materialId: materials.drawerBoxesMaterialId,
        contour: createRectangularContour(trayDepth, lipHeightMm),
        thicknessMm: trayThickness,
        structural: false,
      });
      const lipSideR = createPiece({
        id: lipSideRId,
        role: 'tray-lip-side',
        materialId: materials.drawerBoxesMaterialId,
        contour: createRectangularContour(trayDepth, lipHeightMm),
        thicknessMm: trayThickness,
        structural: false,
      });
      const lipFront = createPiece({
        id: lipFrontId,
        role: 'tray-lip-front',
        materialId: materials.drawerBoxesMaterialId,
        contour: createRectangularContour(trayWidth - 2 * trayThickness, lipHeightMm),
        thicknessMm: trayThickness,
        structural: false,
      });
      const lipBack = createPiece({
        id: lipBackId,
        role: 'tray-lip-back',
        materialId: materials.drawerBoxesMaterialId,
        contour: createRectangularContour(trayWidth - 2 * trayThickness, lipHeightMm),
        thicknessMm: trayThickness,
        structural: false,
      });

      pieces.push(lipSideL, lipSideR, lipFront, lipBack);

      placementNodes.push(
        {
          pieceId: lipSideLId,
          parentPieceId: rootPieceId,
          relativeOffset: { x: trayX, y: trayElevationY + trayThickness, z: 10 },
        },
        {
          pieceId: lipSideRId,
          parentPieceId: rootPieceId,
          relativeOffset: { x: trayX + trayWidth - trayThickness, y: trayElevationY + trayThickness, z: 10 },
        },
        {
          pieceId: lipFrontId,
          parentPieceId: rootPieceId,
          relativeOffset: { x: trayX + trayThickness, y: trayElevationY + trayThickness, z: 10 },
        },
        {
          pieceId: lipBackId,
          parentPieceId: rootPieceId,
          relativeOffset: { x: trayX + trayThickness, y: trayElevationY + trayThickness, z: 10 + trayDepth - trayThickness },
        },
      );

      joints.push(
        createJoint({
          a: { pieceId: trayBottomId, faceId: 'top' },
          b: { pieceId: lipSideLId, faceId: 'bottom-edge' },
          kind: 'confirmat',
        }),
        createJoint({
          a: { pieceId: trayBottomId, faceId: 'top' },
          b: { pieceId: lipSideRId, faceId: 'bottom-edge' },
          kind: 'confirmat',
        }),
      );
    }

    return { pieces, joints, placementNodes, subAssemblies: [] };
  }
}
