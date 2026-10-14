import type { CustomDrillOperation } from '../../model/operation';
import type { PieceContactProjection, FastenerDistributionConfig } from './snapTypes';

/**
 * Calculates equidistant fastener distribution points along the contact centerline of a projection.
 */
export function calculateFastenerDistributionPoints(
  projection: PieceContactProjection,
  config: FastenerDistributionConfig,
): Array<{ xMm: number; yMm: number }> {
  const count = Math.max(2, Math.min(config.count || 2, 5));
  const isHorizontal = projection.axis === 'horizontal';

  const lengthMm = isHorizontal ? projection.widthMm : projection.heightMm;
  const startMm = isHorizontal ? projection.xMm : projection.yMm;
  const centerLineMm = projection.centerLineMm;

  let setbackStart = config.setbackStartMm ?? 50;
  let setbackEnd = config.setbackEndMm ?? 50;

  // Safeguard: if setbacks exceed available length, adjust proportionally
  if (setbackStart + setbackEnd >= lengthMm) {
    setbackStart = Math.max(15, Math.floor(lengthMm / (count + 1)));
    setbackEnd = setbackStart;
  }

  const pStart = startMm + setbackStart;
  const pEnd = startMm + lengthMm - setbackEnd;
  const span = pEnd - pStart;

  const points: Array<{ xMm: number; yMm: number }> = [];

  for (let i = 0; i < count; i++) {
    const fraction = count > 1 ? i / (count - 1) : 0.5;
    const pos = Math.round(pStart + span * fraction);

    if (isHorizontal) {
      points.push({ xMm: pos, yMm: centerLineMm });
    } else {
      points.push({ xMm: centerLineMm, yMm: pos });
    }
  }

  return points;
}

/**
 * Generates ready-to-apply CustomDrillOperation objects for a piece along a contact projection centerline.
 */
export function generateFastenerDrillOperations(
  targetPieceId: string,
  targetPieceThicknessMm: number,
  projection: PieceContactProjection,
  config: FastenerDistributionConfig,
  faceType: 'face-A' | 'face-B' = 'face-A',
  isThrough = true,
): CustomDrillOperation[] {
  const points = calculateFastenerDistributionPoints(projection, config);
  const dia = config.diameterMm ?? 5; // Standard 5mm through-hole for Euro/Confirmat
  const depth = isThrough ? targetPieceThicknessMm : (config.depthMm ?? 12);
  const labelPrefix = config.kind === 'dowel' ? 'Tarugo' : config.kind === 'minifix' ? 'Minifix' : 'Tornillo';

  const timestamp = Date.now();

  return points.map((pt, idx) => ({
    kind: 'drill',
    id: `fastener-${projection.sourcePieceId}-${idx + 1}-${timestamp}`,
    pieceId: targetPieceId,
    faceType,
    xMm: pt.xMm,
    yMm: pt.yMm,
    diameterMm: dia,
    depthMm: depth,
    isThrough,
    description: `${labelPrefix} pasante ${idx + 1}/${points.length} hacia ${projection.label}`,
  }));
}
