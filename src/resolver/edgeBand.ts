import {
  type EdgeBand,
  type Piece,
} from '../model';
import { type ResolvedPiece } from './resolver';
import { createRectangularContour, getContourSegments } from './piece';

export interface BandedEdgeInfo {
  faceId: string;
  edgeBandId: string;
  thicknessMm: number;
  lengthMm: number;
}

export interface PieceCutSize {
  pieceId: string;
  finishedDimensionsMm: { width: number; height: number };
  cutDimensionsMm: { width: number; height: number };
  bandedEdges: {
    left?: BandedEdgeInfo;
    right?: BandedEdgeInfo;
    top?: BandedEdgeInfo;
    bottom?: BandedEdgeInfo;
  };
  totalDeductionMm: {
    width: number;
    height: number;
  };
}

export interface ResolvedPieceWithCutSize extends ResolvedPiece {
  cutDimensionsMm: { width: number; height: number };
  cutContour: ReturnType<typeof createRectangularContour>;
  bandedEdges: BandedEdgeInfo[];
}

/**
 * Normalizes an array or map of edge bands into a Map.
 */
export function createEdgeBandMap(
  edgeBands: Map<string, EdgeBand> | EdgeBand[] | { edgeBands: EdgeBand[] },
): Map<string, EdgeBand> {
  if (edgeBands instanceof Map) {
    return edgeBands;
  }
  const list = Array.isArray(edgeBands) ? edgeBands : edgeBands.edgeBands;
  const map = new Map<string, EdgeBand>();
  for (const eb of list) {
    map.set(eb.id, eb);
  }
  return map;
}

/**
 * Get numeric edge band thickness in millimeters.
 */
export function getEdgeBandThickness(edgeBand: EdgeBand): number {
  if (typeof edgeBand.thicknessMm !== 'number') {
    throw new Error(`Edge band "${edgeBand.id}" has an unconfirmed thickness: TO_CONFIRM`);
  }
  return edgeBand.thicknessMm;
}

/**
 * Calculate the cut size of a piece by applying Section 8.3:
 * Cut size = finished size minus edge band thickness on each banded side.
 */
export function calculatePieceCutSize(
  piece: Piece | ResolvedPiece,
  edgeBands: Map<string, EdgeBand> | EdgeBand[] | { edgeBands: EdgeBand[] },
  finishedWidth?: number,
  finishedHeight?: number,
): PieceCutSize {
  const edgeBandMap = createEdgeBandMap(edgeBands);
  const segments = getContourSegments(piece.contour);

  const width = finishedWidth ??
    ('dimensionsMm' in piece ? piece.dimensionsMm.width : (piece.contour.points[1]?.x ?? 0));
  const height = finishedHeight ??
    ('dimensionsMm' in piece ? piece.dimensionsMm.height : (piece.contour.points[2]?.y ?? 0));

  let leftDeduction = 0;
  let rightDeduction = 0;
  let bottomDeduction = 0;
  let topDeduction = 0;

  let leftEdge: BandedEdgeInfo | undefined;
  let rightEdge: BandedEdgeInfo | undefined;
  let bottomEdge: BandedEdgeInfo | undefined;
  let topEdge: BandedEdgeInfo | undefined;

  for (const face of piece.faces) {
    if (!face.edgeBandId) {
      continue;
    }

    const band = edgeBandMap.get(face.edgeBandId);
    if (!band) {
      throw new Error(`Edge band id "${face.edgeBandId}" not found in catalog`);
    }

    const thickness = getEdgeBandThickness(band);
    const seg = segments.find((s) => s.faceId === face.id);
    const lengthMm = seg?.lengthMm ?? 0;

    const edgeInfo: BandedEdgeInfo = {
      faceId: face.id,
      edgeBandId: face.edgeBandId,
      thicknessMm: thickness,
      lengthMm,
    };

    if (face.id === 'left-edge' || face.id === 'edge-3') {
      leftDeduction = thickness;
      leftEdge = edgeInfo;
    } else if (face.id === 'right-edge' || face.id === 'edge-1') {
      rightDeduction = thickness;
      rightEdge = edgeInfo;
    } else if (face.id === 'bottom-edge' || face.id === 'edge-0') {
      bottomDeduction = thickness;
      bottomEdge = edgeInfo;
    } else if (face.id === 'top-edge' || face.id === 'edge-2') {
      topDeduction = thickness;
      topEdge = edgeInfo;
    }
  }

  const cutWidth = width - (leftDeduction + rightDeduction);
  const cutHeight = height - (bottomDeduction + topDeduction);

  if (cutWidth <= 0 || cutHeight <= 0) {
    throw new Error(
      `Cut dimensions for piece "${piece.id}" must be positive. ` +
      `Finished: ${width}x${height}, Cut: ${cutWidth}x${cutHeight}`,
    );
  }

  return {
    pieceId: piece.id,
    finishedDimensionsMm: { width, height },
    cutDimensionsMm: { width: cutWidth, height: cutHeight },
    bandedEdges: {
      left: leftEdge,
      right: rightEdge,
      bottom: bottomEdge,
      top: topEdge,
    },
    totalDeductionMm: {
      width: leftDeduction + rightDeduction,
      height: bottomDeduction + topDeduction,
    },
  };
}

/**
 * Apply edge band rule to a ResolvedPiece and produce a ResolvedPieceWithCutSize.
 */
export function applyEdgeBandRule(
  resolvedPiece: ResolvedPiece,
  edgeBands: Map<string, EdgeBand> | EdgeBand[] | { edgeBands: EdgeBand[] },
): ResolvedPieceWithCutSize {
  const cutSize = calculatePieceCutSize(resolvedPiece, edgeBands);
  const cutContour = createRectangularContour(
    cutSize.cutDimensionsMm.width,
    cutSize.cutDimensionsMm.height,
  );

  const bandedEdges: BandedEdgeInfo[] = [];
  if (cutSize.bandedEdges.bottom) bandedEdges.push(cutSize.bandedEdges.bottom);
  if (cutSize.bandedEdges.right) bandedEdges.push(cutSize.bandedEdges.right);
  if (cutSize.bandedEdges.top) bandedEdges.push(cutSize.bandedEdges.top);
  if (cutSize.bandedEdges.left) bandedEdges.push(cutSize.bandedEdges.left);

  return {
    ...resolvedPiece,
    cutDimensionsMm: cutSize.cutDimensionsMm,
    cutContour,
    bandedEdges,
  };
}

/**
 * Calculate total edge band meters required by edge band ID for a list of pieces.
 */
export function calculateEdgeBandLengths(
  pieces: (Piece | ResolvedPiece)[],
  edgeBands: Map<string, EdgeBand> | EdgeBand[] | { edgeBands: EdgeBand[] },
): Map<string, number> {
  const edgeBandMap = createEdgeBandMap(edgeBands);
  const meterMap = new Map<string, number>();

  for (const piece of pieces) {
    const segments = getContourSegments(piece.contour);
    for (const face of piece.faces) {
      if (!face.edgeBandId) {
        continue;
      }
      if (!edgeBandMap.has(face.edgeBandId)) {
        throw new Error(`Edge band id "${face.edgeBandId}" not found in catalog`);
      }
      const seg = segments.find((s) => s.faceId === face.id);
      const lengthMm = seg?.lengthMm ?? 0;
      const current = meterMap.get(face.edgeBandId) ?? 0;
      meterMap.set(face.edgeBandId, current + lengthMm);
    }
  }

  return meterMap;
}
