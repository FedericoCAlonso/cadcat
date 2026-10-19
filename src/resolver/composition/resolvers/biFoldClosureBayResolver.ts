import { type Piece, type Joint } from '../../../model';
import { createPiece, createRectangularContour } from '../../piece';
import { createJoint } from '../../joint';
import { type PlacementNode } from '../../tree';
import { resolveTracks } from '../gridSolver';
import { buildShelf } from '../../templates/shelf';
import {
  type IBayContentResolver,
  type BayResolutionContext,
  type ComponentSolverResult,
} from './types';
import { type BayContentBiFoldClosure } from '../types';

export class BiFoldClosureBayResolver implements IBayContentResolver<BayContentBiFoldClosure> {
  public readonly type = 'bi-fold-closure' as const;

  public resolve(context: BayResolutionContext<BayContentBiFoldClosure>): ComponentSolverResult {
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
      leafTracks = [
        { type: 'fractional', valueFr: 1 },
        { type: 'fractional', valueFr: 1 },
      ],
      openingDirection = 'vertical-lift',
      interiorShelvesCount = 0,
      shelfType = 'adjustable',
      shelvesSetbackMm = 20,
    } = content;

    // Resolve interior shelves behind the folding leaves
    if (interiorShelvesCount > 0) {
      const stepY = bay.height / (interiorShelvesCount + 1);
      for (let i = 0; i < interiorShelvesCount; i++) {
        const shelfElevationY = bay.y + Math.round((i + 1) * stepY - T / 2);
        const shelfId = `${idPrefix}-bifold-shelf-${i + 1}`;

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
          b: { pieceId: bay.topPieceId, faceId: 'inner' },
          kind: 'hinge',
          hingeSide: 'top',
          offsetMm: 100,
          doorOffsetMm: 100,
        }),
        createJoint({
          a: { pieceId: leaf1Id, faceId: 'inner' },
          b: { pieceId: bay.topPieceId, faceId: 'inner' },
          kind: 'hinge',
          hingeSide: 'top',
          offsetMm: leafWidth - 100,
          doorOffsetMm: leafWidth - 100,
        }),
      );

      // Intermediate hinges: connects leaf 1 and leaf 2
      joints.push(
        createJoint({
          a: { pieceId: leaf1Id, faceId: 'inner' },
          b: { pieceId: leaf2Id, faceId: 'inner' },
          kind: 'hinge',
          hingeSide: 'bottom',
          offsetMm: 100,
          doorOffsetMm: 100,
        }),
        createJoint({
          a: { pieceId: leaf1Id, faceId: 'inner' },
          b: { pieceId: leaf2Id, faceId: 'inner' },
          kind: 'hinge',
          hingeSide: 'bottom',
          offsetMm: leafWidth - 100,
          doorOffsetMm: leafWidth - 100,
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
      const leafBottomY = bay.y - T + 2;
      joints.push(
        createJoint({
          a: { pieceId: leaf1Id, faceId: 'inner' },
          b: { pieceId: bay.leftPieceId, faceId: 'inner' },
          kind: 'hinge',
          offsetMm: leafBottomY + 100,
          doorOffsetMm: 100,
          hingeSide: 'left',
        }),
        createJoint({
          a: { pieceId: leaf1Id, faceId: 'inner' },
          b: { pieceId: bay.leftPieceId, faceId: 'inner' },
          kind: 'hinge',
          offsetMm: leafBottomY + leafHeight - 100,
          doorOffsetMm: leafHeight - 100,
          hingeSide: 'left',
        }),
      );

      // Intermediate hinges between leaf 1 and leaf 2
      joints.push(
        createJoint({
          a: { pieceId: leaf1Id, faceId: 'inner' },
          b: { pieceId: leaf2Id, faceId: 'inner' },
          kind: 'hinge',
          hingeSide: 'right',
          offsetMm: 100,
          doorOffsetMm: 100,
        }),
        createJoint({
          a: { pieceId: leaf1Id, faceId: 'inner' },
          b: { pieceId: leaf2Id, faceId: 'inner' },
          kind: 'hinge',
          hingeSide: 'right',
          offsetMm: leafHeight - 100,
          doorOffsetMm: leafHeight - 100,
        }),
      );
    }

    return { pieces, joints, placementNodes, subAssemblies: [] };
  }
}
