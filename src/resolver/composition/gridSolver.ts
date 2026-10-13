import { type Piece, type Joint } from '../../model';
import { createPiece, createRectangularContour } from '../piece';
import { createJoint } from '../joint';
import { type PlacementNode } from '../tree';
import {
  type TrackSize,
  type ResolvedTrack,
  type GridDivider,
  type BayGridDefinition,
  type BayBoundingBox,
} from './types';

export interface ResolveTracksResult {
  tracks: ResolvedTrack[];
  dividers: GridDivider[];
}

/**
 * Resolves track sizes (fixed mm and fractional fr) and divider offsets across an available dimension.
 * Uses exact remainder distribution so integer track sizes sum precisely to available space.
 */
export function resolveTracks(
  availableSpaceMm: number,
  tracks: TrackSize[],
  dividerThicknessMm: number,
): ResolveTracksResult {
  if (tracks.length === 0) {
    return { tracks: [], dividers: [] };
  }

  const dividerCount = Math.max(0, tracks.length - 1);
  const totalDividerSpace = dividerCount * dividerThicknessMm;

  let fixedSpace = 0;
  let totalFr = 0;

  for (const t of tracks) {
    if (t.type === 'fixed') {
      fixedSpace += t.valueMm;
    } else {
      totalFr += t.valueFr;
    }
  }

  const remainingSpaceForFr = Math.max(0, availableSpaceMm - totalDividerSpace - fixedSpace);

  // Allocate fractional sizes with cumulative integer rounding
  const resolvedSizes: number[] = [];
  let cumFrTarget = 0;
  let prevCumInt = 0;

  for (const t of tracks) {
    if (t.type === 'fixed') {
      resolvedSizes.push(Math.round(t.valueMm));
    } else {
      if (totalFr > 0) {
        cumFrTarget += (t.valueFr / totalFr) * remainingSpaceForFr;
        const cumInt = Math.round(cumFrTarget);
        const allocated = cumInt - prevCumInt;
        prevCumInt = cumInt;
        resolvedSizes.push(Math.max(0, allocated));
      } else {
        resolvedSizes.push(0);
      }
    }
  }

  const resolvedTracks: ResolvedTrack[] = [];
  const dividers: GridDivider[] = [];

  let currentOffset = 0;

  for (let i = 0; i < tracks.length; i++) {
    const sizeMm = resolvedSizes[i] ?? 0;
    const trackDef = tracks[i]!;

    resolvedTracks.push({
      index: i,
      sizeMm,
      offsetMm: currentOffset,
      rawFraction: trackDef.type === 'fractional' ? trackDef.valueFr : undefined,
    });

    currentOffset += sizeMm;

    if (i < tracks.length - 1) {
      dividers.push({
        index: i,
        offsetMm: currentOffset,
        thicknessMm: dividerThicknessMm,
      });
      currentOffset += dividerThicknessMm;
    }
  }

  return { tracks: resolvedTracks, dividers };
}

export interface SubdivideBayResult {
  bayBoxes: BayBoundingBox[];
  dividerPieces: Piece[];
  dividerJoints: Joint[];
  dividerPlacements: PlacementNode[];
}

/**
 * Subdivides a parent bay volume according to a grid definition.
 */
export function subdivideBay(
  parentBay: BayBoundingBox,
  grid: BayGridDefinition,
  dividerMaterialId: string,
  dividerThicknessMm: number,
  edgeBandId?: string,
  idPrefix = 'div',
): SubdivideBayResult {
  const isHorizontal = grid.axis === 'horizontal';
  const availableSpace = isHorizontal ? parentBay.width : parentBay.height;

  const resolved = resolveTracks(availableSpace, grid.tracks, dividerThicknessMm);

  const dividerPieces: Piece[] = [];
  const dividerJoints: Joint[] = [];
  const dividerPlacements: PlacementNode[] = [];
  const bayBoxes: BayBoundingBox[] = [];

  // Generate divider pieces and joints
  for (let i = 0; i < resolved.dividers.length; i++) {
    const divider = resolved.dividers[i]!;
    const dividerId = `${idPrefix}-${grid.axis}-${i + 1}`;

    if (isHorizontal) {
      // Vertical partition dividing in X
      const piece = createPiece({
        id: dividerId,
        role: 'partition',
        materialId: dividerMaterialId,
        contour: createRectangularContour(parentBay.depth, parentBay.height),
        thicknessMm: dividerThicknessMm,
        structural: true,
      });

      if (edgeBandId) {
        const frontFace = piece.faces.find((f) => f.id === 'right-edge');
        if (frontFace) frontFace.edgeBandId = edgeBandId;
      }

      dividerPieces.push(piece);

      // Placement: relative to Left piece (or root)
      dividerPlacements.push({
        pieceId: dividerId,
        parentPieceId: parentBay.leftPieceId,
        relativeOffset: {
          x: parentBay.x + divider.offsetMm,
          y: parentBay.y,
          z: parentBay.z,
        },
      });

      // Joint with bottom panel
      dividerJoints.push(
        createJoint({
          a: { pieceId: parentBay.bottomPieceId, faceId: 'top' },
          b: { pieceId: dividerId, faceId: 'bottom-edge' },
          kind: 'confirmat',
        }),
      );
    } else {
      // Horizontal structural shelf dividing in Y
      const piece = createPiece({
        id: dividerId,
        role: 'shelf',
        materialId: dividerMaterialId,
        contour: createRectangularContour(parentBay.width, parentBay.depth),
        thicknessMm: dividerThicknessMm,
        structural: true,
      });

      if (edgeBandId) {
        const frontFace = piece.faces.find((f) => f.id === 'right-edge');
        if (frontFace) frontFace.edgeBandId = edgeBandId;
      }

      dividerPieces.push(piece);

      dividerPlacements.push({
        pieceId: dividerId,
        parentPieceId: parentBay.leftPieceId,
        relativeOffset: {
          x: parentBay.x,
          y: parentBay.y + divider.offsetMm,
          z: parentBay.z,
        },
      });

      // Joints to left and right enclosing pieces
      dividerJoints.push(
        createJoint({
          a: { pieceId: parentBay.leftPieceId, faceId: 'inner' },
          b: { pieceId: dividerId, faceId: 'left-edge' },
          kind: 'confirmat',
        }),
        createJoint({
          a: { pieceId: parentBay.rightPieceId, faceId: 'inner' },
          b: { pieceId: dividerId, faceId: 'right-edge' },
          kind: 'confirmat',
        }),
      );
    }
  }

  // Construct resulting child bay bounding boxes
  for (let i = 0; i < resolved.tracks.length; i++) {
    const track = resolved.tracks[i]!;

    if (isHorizontal) {
      const leftPieceId = i === 0 ? parentBay.leftPieceId : dividerPieces[i - 1]!.id;
      const rightPieceId =
        i === resolved.tracks.length - 1 ? parentBay.rightPieceId : dividerPieces[i]!.id;

      bayBoxes.push({
        bayIndex: i,
        x: parentBay.x + track.offsetMm,
        y: parentBay.y,
        z: parentBay.z,
        width: track.sizeMm,
        height: parentBay.height,
        depth: parentBay.depth,
        leftPieceId,
        rightPieceId,
        bottomPieceId: parentBay.bottomPieceId,
        topPieceId: parentBay.topPieceId,
      });
    } else {
      const bottomPieceId = i === 0 ? parentBay.bottomPieceId : dividerPieces[i - 1]!.id;
      const topPieceId =
        i === resolved.tracks.length - 1 ? parentBay.topPieceId : dividerPieces[i]!.id;

      bayBoxes.push({
        bayIndex: i,
        x: parentBay.x,
        y: parentBay.y + track.offsetMm,
        z: parentBay.z,
        width: parentBay.width,
        height: track.sizeMm,
        depth: parentBay.depth,
        leftPieceId: parentBay.leftPieceId,
        rightPieceId: parentBay.rightPieceId,
        bottomPieceId,
        topPieceId,
      });
    }
  }

  return {
    bayBoxes,
    dividerPieces,
    dividerJoints,
    dividerPlacements,
  };
}
