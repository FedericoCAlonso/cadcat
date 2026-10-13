import { type Piece, type Joint, type SubAssembly } from '../../model';
import { createPiece, createRectangularContour } from '../piece';
import { createJoint } from '../joint';
import { type PlacementNode } from '../tree';
import {
  type BayBoundingBox,
  type BayContent,
  type ModuleMaterialRoles,
} from './types';
import { resolveTracks } from './gridSolver';
import { buildShelf } from '../templates/shelf';
import { buildDrawerSubAssembly } from '../templates/drawer';
import { buildDoorSubAssembly } from '../templates/door';

export interface ComponentSolverOptions {
  carcassThicknessMm: number;
  frontThicknessMm?: number;
  boxThicknessMm?: number;
  edgeBandId?: string;
  rootPieceId: string;
  idPrefix?: string;
}

export interface ComponentSolverResult {
  pieces: Piece[];
  joints: Joint[];
  placementNodes: PlacementNode[];
  subAssemblies: SubAssembly[];
}

/**
 * Resolves internal bay furniture components into pieces, joints, sub-assemblies, and placements.
 */
export function resolveBayContent(
  bay: BayBoundingBox,
  content: BayContent,
  materials: ModuleMaterialRoles,
  options: ComponentSolverOptions,
): ComponentSolverResult {
  const {
    carcassThicknessMm: T,
    frontThicknessMm = T,
    boxThicknessMm = 15,
    edgeBandId,
    rootPieceId,
    idPrefix = `bay-${bay.bayIndex}`,
  } = options;

  const pieces: Piece[] = [];
  const joints: Joint[] = [];
  const placementNodes: PlacementNode[] = [];
  const subAssemblies: SubAssembly[] = [];

  switch (content.type) {
    case 'empty':
      return { pieces, joints, placementNodes, subAssemblies };

    case 'shelves': {
      const {
        count,
        shelfType,
        setbackMm = 20,
        hasAntiSagBrace = false,
      } = content;

      if (count <= 0) break;

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

        // Adjust shelf placement offset to bay.x
        shelfRes.placementNode.relativeOffset.x =
          bay.x + (shelfType === 'adjustable' ? 1 : 0);

        pieces.push(shelfRes.piece);
        placementNodes.push(shelfRes.placementNode);

        // Joints to left and right enclosing pieces
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

        // Anti-sag brace if requested
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
      break;
    }

    case 'drawer-stack': {
      const {
        drawerTracks,
        frontMount,
        hasTransomDividers = false,
        slideType,
        gapMm = 2.0,
      } = content;

      if (drawerTracks.length === 0) break;

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

          placementNodes.push({
            pieceId: transomId,
            parentPieceId: rootPieceId,
            relativeOffset: {
              x: bay.x,
              y: bay.y + div.offsetMm,
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

      // Generate drawers
      for (let i = 0; i < resolved.tracks.length; i++) {
        const track = resolved.tracks[i]!;
        const frontHeight = track.sizeMm;
        const drawerBaseY = bay.y + track.offsetMm;
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
      break;
    }

    case 'pull-out-tray': {
      const {
        lipHeightMm = 0,
        slideType = 'telescopic',
        clearanceDeductionMm,
        elevationYMm,
      } = content;

      const clearance = clearanceDeductionMm ?? (slideType === 'undermount' ? 10.0 : 25.4);
      const trayWidth = Math.round(bay.width - clearance);
      const trayDepth = Math.max(250, bay.depth - 50);
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
      break;
    }

    case 'doors': {
      const {
        count = 1,
        hingeSide = 'left',
        mountType = 'full-overlay',
      } = content;

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
      break;
    }

    case 'bi-fold-closure': {
      const {
        leafTracks = [
          { type: 'fractional', valueFr: 1 },
          { type: 'fractional', valueFr: 1 },
        ],
        openingDirection = 'vertical-lift',
      } = content;

      const isVertical = openingDirection === 'vertical-lift';
      const availableSpan = isVertical ? bay.height : bay.width;
      const resolved = resolveTracks(availableSpan, leafTracks, 2); // 2mm gap between folding leaves

      const leaf1Track = resolved.tracks[0]!;
      const leaf2Track = resolved.tracks[1]!;

      const leaf1Id = `${idPrefix}-bifold-leaf-1`;
      const leaf2Id = `${idPrefix}-bifold-leaf-2`;

      if (isVertical) {
        // Upper leaf (leaf 1) and lower leaf (leaf 2)
        const leaf1Height = leaf1Track.sizeMm;
        const leaf2Height = leaf2Track.sizeMm;
        const leafWidth = bay.width + 2 * T - 4; // Full overlay width with 2mm reveals

        const leaf1 = createPiece({
          id: leaf1Id,
          role: 'bifold-leaf',
          materialId: materials.frontsMaterialId,
          contour: createRectangularContour(leafWidth, leaf1Height),
          thicknessMm: frontThicknessMm,
          structural: false,
        });

        const leaf2 = createPiece({
          id: leaf2Id,
          role: 'bifold-leaf',
          materialId: materials.frontsMaterialId,
          contour: createRectangularContour(leafWidth, leaf2Height),
          thicknessMm: frontThicknessMm,
          structural: false,
        });

        pieces.push(leaf1, leaf2);

        // Leaf 1 is placed at the top, Leaf 2 below it
        const leaf2Y = bay.y;
        const leaf1Y = bay.y + leaf2Height + 2;

        placementNodes.push(
          {
            pieceId: leaf1Id,
            parentPieceId: rootPieceId,
            relativeOffset: { x: bay.x - T + 2, y: leaf1Y, z: -frontThicknessMm },
          },
          {
            pieceId: leaf2Id,
            parentPieceId: rootPieceId,
            relativeOffset: { x: bay.x - T + 2, y: leaf2Y, z: -frontThicknessMm },
          },
        );

        // Anchor hinges: connects upper leaf to carcase top
        joints.push(
          createJoint({
            a: { pieceId: leaf1Id, faceId: 'inner' },
            b: { pieceId: bay.topPieceId, faceId: 'front-edge' },
            kind: 'hinge',
            offsetMm: bay.x + 100,
          }),
          createJoint({
            a: { pieceId: leaf1Id, faceId: 'inner' },
            b: { pieceId: bay.topPieceId, faceId: 'front-edge' },
            kind: 'hinge',
            offsetMm: bay.x + bay.width - 100,
          }),
        );

        // Intermediate hinges: connects leaf 1 and leaf 2
        joints.push(
          createJoint({
            a: { pieceId: leaf1Id, faceId: 'bottom-edge' },
            b: { pieceId: leaf2Id, faceId: 'top-edge' },
            kind: 'hinge',
            offsetMm: bay.x + 100,
          }),
          createJoint({
            a: { pieceId: leaf1Id, faceId: 'bottom-edge' },
            b: { pieceId: leaf2Id, faceId: 'top-edge' },
            kind: 'hinge',
            offsetMm: bay.x + bay.width - 100,
          }),
        );
      } else {
        // Horizontal book-fold (left leaf and right leaf)
        const leaf1Width = leaf1Track.sizeMm;
        const leaf2Width = leaf2Track.sizeMm;
        const leafHeight = bay.height + 2 * T - 4;

        const leaf1 = createPiece({
          id: leaf1Id,
          role: 'bifold-leaf',
          materialId: materials.frontsMaterialId,
          contour: createRectangularContour(leaf1Width, leafHeight),
          thicknessMm: frontThicknessMm,
          structural: false,
        });

        const leaf2 = createPiece({
          id: leaf2Id,
          role: 'bifold-leaf',
          materialId: materials.frontsMaterialId,
          contour: createRectangularContour(leaf2Width, leafHeight),
          thicknessMm: frontThicknessMm,
          structural: false,
        });

        pieces.push(leaf1, leaf2);

        placementNodes.push(
          {
            pieceId: leaf1Id,
            parentPieceId: rootPieceId,
            relativeOffset: { x: bay.x - T + 2, y: bay.y - T + 2, z: -frontThicknessMm },
          },
          {
            pieceId: leaf2Id,
            parentPieceId: rootPieceId,
            relativeOffset: { x: bay.x - T + 2 + leaf1Width + 2, y: bay.y - T + 2, z: -frontThicknessMm },
          },
        );

        // Left leaf hinged to left carcase side
        joints.push(
          createJoint({
            a: { pieceId: leaf1Id, faceId: 'inner' },
            b: { pieceId: bay.leftPieceId, faceId: 'inner' },
            kind: 'hinge',
            offsetMm: bay.y + 100,
          }),
          createJoint({
            a: { pieceId: leaf1Id, faceId: 'inner' },
            b: { pieceId: bay.leftPieceId, faceId: 'inner' },
            kind: 'hinge',
            offsetMm: bay.y + bay.height - 100,
          }),
        );

        // Intermediate hinges between leaf 1 and leaf 2
        joints.push(
          createJoint({
            a: { pieceId: leaf1Id, faceId: 'right-edge' },
            b: { pieceId: leaf2Id, faceId: 'left-edge' },
            kind: 'hinge',
            offsetMm: bay.y + 100,
          }),
          createJoint({
            a: { pieceId: leaf1Id, faceId: 'right-edge' },
            b: { pieceId: leaf2Id, faceId: 'left-edge' },
            kind: 'hinge',
            offsetMm: bay.y + bay.height - 100,
          }),
        );
      }
      break;
    }
  }

  return { pieces, joints, placementNodes, subAssemblies };
}
