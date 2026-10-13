import {
  type Piece,
  type Joint,
  type MachiningConfig,
} from '../model';
import { createPiece, createRectangularContour } from './piece';
import { JointGraph } from './joint';
import { determinePieceSpatialSize } from './spatial3d';
import type { ResolvedPiece, ResolvedModule } from './resolver';

export interface SpanOccurrence {
  lowerPieceId: string;
  upperPieceId: string;
  referencePieceId?: string;
  clearSpanMm: number;
  axis: 'x' | 'y' | 'z';
}

export interface AssemblyGauge {
  id: string;
  label: string; // e.g., 'G1'
  clearSpanMm: number;
  widthMm: number;
  piece: Piece;
  matchingJoints: Joint[];
  occurrences: SpanOccurrence[];
  spansCount: number;
}

export interface DeriveGaugesInput {
  pieces: (Piece | ResolvedPiece)[];
  joints: Joint[];
  jointGraph?: JointGraph;
  machiningConfig?: MachiningConfig;
}

interface SpatialPieceInfo {
  piece: Piece | ResolvedPiece;
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
  size: { x: number; y: number; z: number };
  normalAxis: 'x' | 'y' | 'z';
}

/**
 * Determine spatial bounding box and primary panel normal for a piece.
 */
function getPieceSpatialInfo(p: Piece | ResolvedPiece): SpatialPieceInfo {
  const pos = ('positionMm' in p && p.positionMm) ? p.positionMm : { x: 0, y: 0, z: 0 };
  const size = determinePieceSpatialSize(p);

  let normalAxis: 'x' | 'y' | 'z' = 'y';
  const role = p.role.toLowerCase();

  if ((role.includes('side') || role.includes('partition')) && !role.includes('rail')) {
    normalAxis = 'x';
  } else if (role.includes('bottom') || role.includes('shelf') || role.includes('top') || role.includes('rail')) {
    normalAxis = 'y';
  } else if (role.includes('back') || role.includes('front') || role.includes('door')) {
    normalAxis = 'z';
  } else {
    // Fallback: smallest spatial size axis is likely the thickness normal
    if (size.x <= size.y && size.x <= size.z) normalAxis = 'x';
    else if (size.y <= size.x && size.y <= size.z) normalAxis = 'y';
    else normalAxis = 'z';
  }

  return {
    piece: p,
    min: { x: pos.x, y: pos.y, z: pos.z },
    max: { x: pos.x + size.x, y: pos.y + size.y, z: pos.z + size.z },
    size,
    normalAxis,
  };
}

/**
 * Derives assembly gauges from module pieces and joints.
 * Finds clear spans between parallel panel faces (e.g., shelf spacings or drawer spans),
 * groups identical spans, and creates an auxiliary piece for each unique clear span.
 */
export function deriveAssemblyGauges(
  input: DeriveGaugesInput | ResolvedModule,
  config?: MachiningConfig,
): AssemblyGauge[] {
  const pieces = 'pieces' in input ? input.pieces : [];
  const joints = 'joints' in input ? input.joints : [];
  const machiningConfig = ('machiningConfig' in input ? input.machiningConfig : undefined) ?? config;

  const gaugeWidthMm =
    typeof machiningConfig?.defaultGaugeWidthMm === 'number'
      ? machiningConfig.defaultGaugeWidthMm
      : 50;

  const jGraph = 'jointGraph' in input && input.jointGraph
    ? input.jointGraph
    : new JointGraph(joints);

  const spatialMap = new Map<string, SpatialPieceInfo>();
  for (const p of pieces) {
    if (p.isAuxiliary) continue; // Skip existing auxiliary pieces
    spatialMap.set(p.id, getPieceSpatialInfo(p));
  }

  const rawSpans: SpanOccurrence[] = [];

  // 1. Find spans between parallel panels joined to common reference pieces
  for (const p of pieces) {
    if (p.isAuxiliary) continue;
    const refInfo = spatialMap.get(p.id);
    if (!refInfo) continue;

    const neighbors = jGraph.getNeighbors(p.id);
    const neighborInfos: SpatialPieceInfo[] = [];
    for (const nid of neighbors) {
      const nInfo = spatialMap.get(nid);
      if (nInfo) neighborInfos.push(nInfo);
    }

    // Check parallel neighbors along Y (horizontal panels attached to vertical reference like side-left)
    const horizontalNeighbors = neighborInfos.filter((n) => n.normalAxis === 'y');
    horizontalNeighbors.sort((a, b) => a.min.y - b.min.y);

    for (let i = 0; i < horizontalNeighbors.length - 1; i++) {
      const lower = horizontalNeighbors[i]!;
      const upper = horizontalNeighbors[i + 1]!;
      const spanMm = upper.min.y - lower.max.y;

      if (spanMm > 1.0) {
        rawSpans.push({
          lowerPieceId: lower.piece.id,
          upperPieceId: upper.piece.id,
          referencePieceId: p.id,
          clearSpanMm: Number(spanMm.toFixed(1)),
          axis: 'y',
        });
      }
    }

    // Check parallel neighbors along X (vertical panels attached to horizontal reference like bottom)
    const verticalNeighbors = neighborInfos.filter((n) => n.normalAxis === 'x');
    verticalNeighbors.sort((a, b) => a.min.x - b.min.x);

    for (let i = 0; i < verticalNeighbors.length - 1; i++) {
      const left = verticalNeighbors[i]!;
      const right = verticalNeighbors[i + 1]!;
      const spanMm = right.min.x - left.max.x;

      if (spanMm > 1.0) {
        rawSpans.push({
          lowerPieceId: left.piece.id,
          upperPieceId: right.piece.id,
          referencePieceId: p.id,
          clearSpanMm: Number(spanMm.toFixed(1)),
          axis: 'x',
        });
      }
    }
  }

  // De-duplicate spans between identical piece pairs
  const uniqueSpans = new Map<string, SpanOccurrence>();
  for (const span of rawSpans) {
    const key = `${span.lowerPieceId}->${span.upperPieceId}`;
    if (!uniqueSpans.has(key)) {
      uniqueSpans.set(key, span);
    }
  }

  // Group spans by clearSpanMm (within 0.5mm tolerance)
  const groupedSpans = new Map<number, SpanOccurrence[]>();
  for (const span of uniqueSpans.values()) {
    let matchedKey: number | null = null;
    for (const key of groupedSpans.keys()) {
      if (Math.abs(key - span.clearSpanMm) <= 0.5) {
        matchedKey = key;
        break;
      }
    }

    if (matchedKey !== null) {
      groupedSpans.get(matchedKey)!.push(span);
    } else {
      groupedSpans.set(span.clearSpanMm, [span]);
    }
  }

  // Sort groups by clearSpanMm ascending
  const sortedSpanKeys = Array.from(groupedSpans.keys()).sort((a, b) => a - b);

  const defaultMaterialId = pieces[0]?.materialId ?? 'mat-default';
  const defaultThicknessMm = pieces[0]?.thicknessMm ?? 18;

  const result: AssemblyGauge[] = [];

  let gaugeIndex = 1;
  for (const spanMm of sortedSpanKeys) {
    const occurrences = groupedSpans.get(spanMm) ?? [];
    const label = `G${gaugeIndex}`;
    const id = `gauge-${label.toLowerCase()}`;

    // Collect all matching joints connecting the pieces in this span
    const matchingJoints: Joint[] = [];
    for (const occ of occurrences) {
      const betweenJoints = jGraph.getJointsBetween(occ.lowerPieceId, occ.upperPieceId);
      matchingJoints.push(...betweenJoints);
      if (occ.referencePieceId) {
        matchingJoints.push(...jGraph.getJointsBetween(occ.lowerPieceId, occ.referencePieceId));
        matchingJoints.push(...jGraph.getJointsBetween(occ.upperPieceId, occ.referencePieceId));
      }
    }

    // De-duplicate joints
    const distinctJoints = Array.from(
      new Map(matchingJoints.map((j) => [`${j.a.pieceId}:${j.a.faceId}-${j.b.pieceId}:${j.b.faceId}`, j])).values(),
    );

    const auxPiece: Piece = createPiece({
      id,
      role: 'assembly-gauge',
      materialId: defaultMaterialId,
      contour: createRectangularContour(spanMm, gaugeWidthMm),
      thicknessMm: defaultThicknessMm,
      structural: false,
      referenceFace: 'A',
      isAuxiliary: true,
    });

    result.push({
      id,
      label,
      clearSpanMm: spanMm,
      widthMm: gaugeWidthMm,
      piece: auxPiece,
      matchingJoints: distinctJoints,
      occurrences,
      spansCount: occurrences.length,
    });

    gaugeIndex++;
  }

  return result;
}

/**
 * Returns auxiliary gauge pieces to be included in shop cut lists and nesting.
 */
export function deriveAuxiliaryGaugePieces(
  input: DeriveGaugesInput | ResolvedModule,
  config?: MachiningConfig,
): Piece[] {
  const gauges = deriveAssemblyGauges(input, config);
  return gauges.map((g) => g.piece);
}
