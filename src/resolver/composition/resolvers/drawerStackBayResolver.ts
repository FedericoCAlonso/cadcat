import { type Piece, type Joint, type SubAssembly } from '../../../model';
import { createPiece, createRectangularContour } from '../../piece';
import { createJoint } from '../../joint';
import { type PlacementNode } from '../../tree';
import { resolveTracks } from '../gridSolver';
import { buildDrawerSubAssembly } from '../../templates/drawer';
import {
  type IBayContentResolver,
  type BayResolutionContext,
  type ComponentSolverResult,
} from './types';
import { type BayContentDrawerStack } from '../types';

export class DrawerStackBayResolver implements IBayContentResolver<BayContentDrawerStack> {
  public readonly type = 'drawer-stack' as const;

  public resolve(context: BayResolutionContext<BayContentDrawerStack>): ComponentSolverResult {
    const { bay, content, materials, options } = context;
    const {
      carcassThicknessMm: T,
      boxThicknessMm = 15,
      edgeBandId,
      rootPieceId,
      idPrefix = `bay-${bay.bayIndex}`,
    } = options;

    const pieces: Piece[] = [];
    const joints: Joint[] = [];
    const placementNodes: PlacementNode[] = [];
    const subAssemblies: SubAssembly[] = [];

    const {
      drawerTracks,
      frontMount,
      hasTransomDividers = false,
      slideType,
      gapMm = 2.0,
    } = content;

    if (drawerTracks.length === 0) {
      return { pieces, joints, placementNodes, subAssemblies };
    }

    const useTransoms = hasTransomDividers && frontMount === 'inset';
    const resolved = resolveTracks(
      bay.height,
      drawerTracks,
      useTransoms ? T : 0,
    );

    // Create transom dividers between inset drawers if requested
    if (useTransoms) {
      for (let i = 0; i < resolved.dividers.length; i++) {
        const div = resolved.dividers[i]!;
        const transomId = `${idPrefix}-transom-${i + 1}`;
        const transomWidth = bay.width;
        const transomDepth = 80;

        const transomPiece = createPiece({
          id: transomId,
          role: 'transom',
          materialId: materials.carcassMaterialId,
          contour: createRectangularContour(transomWidth, transomDepth),
          thicknessMm: T,
          structural: true,
        });
        pieces.push(transomPiece);

        const transomY = bay.y + bay.height - (div.offsetMm + T);

        placementNodes.push({
          pieceId: transomId,
          parentPieceId: rootPieceId,
          relativeOffset: {
            x: bay.x,
            y: transomY,
            z: 0,
          },
        });

        joints.push(
          createJoint({
            a: { pieceId: bay.leftPieceId, faceId: 'inner' },
            b: { pieceId: transomId, faceId: 'left-edge' },
            kind: 'confirmat',
          }),
          createJoint({
            a: { pieceId: bay.rightPieceId, faceId: 'inner' },
            b: { pieceId: transomId, faceId: 'right-edge' },
            kind: 'confirmat',
          }),
        );
      }
    }

    // Generate drawers: Index 0 is Cajón 1 (top drawer), descending to bottom
    for (let i = 0; i < resolved.tracks.length; i++) {
      const track = resolved.tracks[i]!;
      const frontHeight = track.sizeMm;
      const offsetFromTop = track.offsetMm;
      const drawerBaseY = bay.y + bay.height - (offsetFromTop + frontHeight);
      const boxHeight = Math.min(250, Math.max(80, Math.round(frontHeight * 0.7)));

      const drawerResult = buildDrawerSubAssembly(
        {
          idPrefix: `${idPrefix}-drawer`,
          index: i + 1,
          openingWidthMm: bay.width,
          depthMm: bay.depth,
          frontHeightMm: frontHeight,
          boxHeightMm: boxHeight,
          baseYMm: drawerBaseY,
          carcaseThicknessMm: T,
          materialId: materials.carcassMaterialId,
          frontMaterialId: materials.frontsMaterialId,
          boxMaterialId: materials.drawerBoxesMaterialId,
          boxThicknessMm,
          slideType,
          frontMount,
          edgeBandId,
          gapMm,
        },
        rootPieceId,
      );

      // Shift X placements to align with this bay's X offset
      const xOffsetDelta = bay.x - T;
      for (const node of drawerResult.placementNodes) {
        node.relativeOffset.x += xOffsetDelta;
        placementNodes.push(node);
      }

      pieces.push(...drawerResult.pieces);
      subAssemblies.push(drawerResult.subAssembly);

      // Slide joints between drawer box and enclosing sides
      const boxSideL = drawerResult.pieces.find((p) => p.role === 'drawer-side' && p.id.includes('-l-'));
      const boxSideR = drawerResult.pieces.find((p) => p.role === 'drawer-side' && p.id.includes('-r-'));

      if (boxSideL) {
        joints.push(
          createJoint({
            a: { pieceId: boxSideL.id, faceId: 'outer' },
            b: { pieceId: bay.leftPieceId, faceId: 'inner' },
            kind: 'slide',
            offsetMm: drawerBaseY + 30,
          }),
        );
      }
      if (boxSideR) {
        joints.push(
          createJoint({
            a: { pieceId: boxSideR.id, faceId: 'outer' },
            b: { pieceId: bay.rightPieceId, faceId: 'inner' },
            kind: 'slide',
            offsetMm: drawerBaseY + 30,
          }),
        );
      }

      // Add internal drawer box joints from the drawer sub-assembly (excluding generic slide)
      const boxJoints = drawerResult.joints.filter((j) => j.kind !== 'slide');
      joints.push(...boxJoints);
    }

    return { pieces, joints, placementNodes, subAssemblies };
  }
}
