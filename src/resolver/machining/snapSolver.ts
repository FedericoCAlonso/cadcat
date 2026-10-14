import type { PieceContactProjection, SnapGuide, SnapResult } from './snapTypes';

export interface SnapOptions {
  snapThresholdMm?: number; // default 12mm
  enableMidpoints?: boolean;
  enableQuarters?: boolean;
  enableThirds?: boolean;
  enableSystem32?: boolean;
  enableProjections?: boolean;
}

const DEFAULT_OPTIONS: Required<SnapOptions> = {
  snapThresholdMm: 12,
  enableMidpoints: true,
  enableQuarters: true,
  enableThirds: true,
  enableSystem32: true,
  enableProjections: true,
};

/**
 * Computes all available snap guides for a piece of dimensions (widthMm, heightMm),
 * taking into account piece proportions, standard carpentry distances, and contact projections.
 */
export function generatePieceSnapGuides(
  widthMm: number,
  heightMm: number,
  projections: PieceContactProjection[] = [],
  options: SnapOptions = {},
): { xGuides: SnapGuide[]; yGuides: SnapGuide[] } {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const xGuides: SnapGuide[] = [];
  const yGuides: SnapGuide[] = [];

  // Edges (0 and W/H)
  xGuides.push({ type: 'x', valueMm: 0, label: 'Canto izquierdo (0 mm)', kind: 'edge' });
  xGuides.push({ type: 'x', valueMm: widthMm, label: `Canto derecho (${widthMm} mm)`, kind: 'edge' });
  yGuides.push({ type: 'y', valueMm: 0, label: 'Canto inferior (0 mm)', kind: 'edge' });
  yGuides.push({ type: 'y', valueMm: heightMm, label: `Canto superior (${heightMm} mm)`, kind: 'edge' });

  // Midpoints (W/2, H/2)
  if (opts.enableMidpoints) {
    const midX = Math.round(widthMm / 2);
    const midY = Math.round(heightMm / 2);
    xGuides.push({ type: 'x', valueMm: midX, label: `Centro placa X (${midX} mm)`, kind: 'midpoint' });
    yGuides.push({ type: 'y', valueMm: midY, label: `Centro placa Y (${midY} mm)`, kind: 'midpoint' });
  }

  // Quarters (W/4, 3W/4, H/4, 3H/4)
  if (opts.enableQuarters) {
    const q1X = Math.round(widthMm / 4);
    const q3X = Math.round((widthMm * 3) / 4);
    const q1Y = Math.round(heightMm / 4);
    const q3Y = Math.round((heightMm * 3) / 4);

    xGuides.push({ type: 'x', valueMm: q1X, label: `1/4 Ancho (${q1X} mm)`, kind: 'quarter' });
    xGuides.push({ type: 'x', valueMm: q3X, label: `3/4 Ancho (${q3X} mm)`, kind: 'quarter' });
    yGuides.push({ type: 'y', valueMm: q1Y, label: `1/4 Alto (${q1Y} mm)`, kind: 'quarter' });
    yGuides.push({ type: 'y', valueMm: q3Y, label: `3/4 Alto (${q3Y} mm)`, kind: 'quarter' });
  }

  // Thirds (W/3, 2W/3, H/3, 2H/3)
  if (opts.enableThirds) {
    const t1X = Math.round(widthMm / 3);
    const t2X = Math.round((widthMm * 2) / 3);
    const t1Y = Math.round(heightMm / 3);
    const t2Y = Math.round((heightMm * 2) / 3);

    xGuides.push({ type: 'x', valueMm: t1X, label: `1/3 Ancho (${t1X} mm)`, kind: 'third' });
    xGuides.push({ type: 'x', valueMm: t2X, label: `2/3 Ancho (${t2X} mm)`, kind: 'third' });
    yGuides.push({ type: 'y', valueMm: t1Y, label: `1/3 Alto (${t1Y} mm)`, kind: 'third' });
    yGuides.push({ type: 'y', valueMm: t2Y, label: `2/3 Alto (${t2Y} mm)`, kind: 'third' });
  }

  // System 32 and standard furniture margins (37mm, 50mm, 64mm from edges)
  if (opts.enableSystem32) {
    const standardOffsets = [37, 50, 64];
    for (const off of standardOffsets) {
      if (widthMm > off * 2) {
        xGuides.push({ type: 'x', valueMm: off, label: `Línea ${off} mm (Frente/Izq)`, kind: 'system32' });
        xGuides.push({ type: 'x', valueMm: widthMm - off, label: `Línea ${off} mm (Fondo/Der)`, kind: 'system32' });
      }
      if (heightMm > off * 2) {
        yGuides.push({ type: 'y', valueMm: off, label: `Línea ${off} mm (Inferior)`, kind: 'system32' });
        yGuides.push({ type: 'y', valueMm: heightMm - off, label: `Línea ${off} mm (Superior)`, kind: 'system32' });
      }
    }
  }

  // Projection Snaps (Ghost footprints of adjacent pieces)
  if (opts.enableProjections) {
    for (const proj of projections) {
      if (proj.axis === 'horizontal') {
        // Horizontal piece touching (e.g. shelf or roof)
        yGuides.push({
          type: 'y',
          valueMm: proj.centerLineMm,
          label: `Eje central: ${proj.label}`,
          kind: 'projection-center',
        });
        yGuides.push({
          type: 'y',
          valueMm: proj.yMm,
          label: `Límite inferior: ${proj.label}`,
          kind: 'projection-edge',
        });
        yGuides.push({
          type: 'y',
          valueMm: proj.yMm + proj.heightMm,
          label: `Límite superior: ${proj.label}`,
          kind: 'projection-edge',
        });
      } else {
        // Vertical piece touching (e.g. partition)
        xGuides.push({
          type: 'x',
          valueMm: proj.centerLineMm,
          label: `Eje central: ${proj.label}`,
          kind: 'projection-center',
        });
        xGuides.push({
          type: 'x',
          valueMm: proj.xMm,
          label: `Límite izquierdo: ${proj.label}`,
          kind: 'projection-edge',
        });
        xGuides.push({
          type: 'x',
          valueMm: proj.xMm + proj.widthMm,
          label: `Límite derecho: ${proj.label}`,
          kind: 'projection-edge',
        });
      }
    }
  }

  return { xGuides, yGuides };
}

/**
 * Resolves magnetic snapping for an input point (xMm, yMm) against a set of snap guides.
 */
export function resolveMagneticSnap(
  xMm: number,
  yMm: number,
  guides: { xGuides: SnapGuide[]; yGuides: SnapGuide[] },
  thresholdMm = 12,
): SnapResult {
  let bestX = xMm;
  let minDiffX = thresholdMm + 1;
  let snappedGuideX: SnapGuide | null = null;

  for (const g of guides.xGuides) {
    const diff = Math.abs(xMm - g.valueMm);
    if (diff <= thresholdMm && diff < minDiffX) {
      minDiffX = diff;
      bestX = g.valueMm;
      snappedGuideX = g;
    }
  }

  let bestY = yMm;
  let minDiffY = thresholdMm + 1;
  let snappedGuideY: SnapGuide | null = null;

  for (const g of guides.yGuides) {
    const diff = Math.abs(yMm - g.valueMm);
    if (diff <= thresholdMm && diff < minDiffY) {
      minDiffY = diff;
      bestY = g.valueMm;
      snappedGuideY = g;
    }
  }

  const activeGuides: SnapGuide[] = [];
  const labels: string[] = [];

  if (snappedGuideX) {
    activeGuides.push(snappedGuideX);
    labels.push(snappedGuideX.label);
  }
  if (snappedGuideY) {
    activeGuides.push(snappedGuideY);
    labels.push(snappedGuideY.label);
  }

  return {
    xMm: bestX,
    yMm: bestY,
    isSnappedX: snappedGuideX !== null,
    isSnappedY: snappedGuideY !== null,
    guides: activeGuides,
    label: labels.length > 0 ? labels.join(' ∩ ') : undefined,
  };
}
