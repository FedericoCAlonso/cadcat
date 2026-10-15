import type { CornerTreatment } from '../../../model';

export interface PocketDimensions {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  cornerRadiusMm: number;
  cornerTreatment?: CornerTreatment;
  tBoneAxis?: 'x' | 'y';
}

export type CornerLocation = 'bottom-left' | 'bottom-right' | 'top-right' | 'top-left';

export interface CornerReliefPoint {
  corner: CornerLocation;
  vertexMm: { x: number; y: number };
  reliefCenterMm: { x: number; y: number };
  reliefRadiusMm: number;
  clearanceDepthMm: number;
}

export interface PocketContourResult {
  valid: boolean;
  errors: string[];
  corners: CornerReliefPoint[];
  svgPath: string;
}

const SQRT_2 = Math.SQRT2; // ~1.41421356

/**
 * Calculates corner relief geometries for cutouts / pockets.
 * Supports:
 * - 'natural-radius': tool radius tangent to inside edges.
 * - 'dog-bone': cutter plunges diagonally at 45° so square parts fit flush.
 * - 't-bone': cutter overcuts along one axis so perpendicular edges mate flush.
 */
export function calculatePocketCornerRelief(pocket: PocketDimensions): PocketContourResult {
  const {
    xMm: x,
    yMm: y,
    widthMm: w,
    heightMm: h,
    cornerRadiusMm: r,
    cornerTreatment = 'natural-radius',
    tBoneAxis = 'x',
  } = pocket;

  const errors: string[] = [];

  if (w <= 0 || h <= 0) {
    errors.push(`Las dimensiones del cajeado deben ser positivas (ancho: ${w}mm, alto: ${h}mm).`);
    return { valid: false, errors, corners: [], svgPath: '' };
  }

  if (r < 0) {
    errors.push(`El radio de herramienta/esquina no puede ser negativo (${r}mm).`);
    return { valid: false, errors, corners: [], svgPath: '' };
  }

  // Maximum allowable tool radius: diameter (2*r) cannot exceed width or height
  const maxAllowableRadius = Math.min(w, h) / 2;
  if (r > maxAllowableRadius) {
    errors.push(
      `El diámetro de la fresa (${2 * r}mm) excede la dimensión mínima del cajeado (${Math.min(w, h)}mm).`,
    );
  }

  // Corner vertices in CAD coordinates (y points up)
  // bottom-left: (x, y)
  // bottom-right: (x + w, y)
  // top-right: (x + w, y + h)
  // top-left: (x, y + h)
  const vertices: Record<CornerLocation, { x: number; y: number }> = {
    'bottom-left': { x, y },
    'bottom-right': { x: x + w, y },
    'top-right': { x: x + w, y: y + h },
    'top-left': { x, y: y + h },
  };

  const corners: CornerReliefPoint[] = [];

  if (r <= 0) {
    // Sharp rectangle without relief
    for (const [location, vertex] of Object.entries(vertices) as [CornerLocation, { x: number; y: number }][]) {
      corners.push({
        corner: location,
        vertexMm: vertex,
        reliefCenterMm: vertex,
        reliefRadiusMm: 0,
        clearanceDepthMm: 0,
      });
    }
    const svgPath = `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
    return { valid: errors.length === 0, errors, corners, svgPath };
  }

  if (cornerTreatment === 'dog-bone') {
    // Center is placed at r / sqrt(2) from each edge meeting at the corner.
    // Distance from center to vertex is exactly r, and the circle passes directly through vertex.
    const delta = r / SQRT_2;
    const centers: Record<CornerLocation, { x: number; y: number }> = {
      'bottom-left': { x: x + delta, y: y + delta },
      'bottom-right': { x: x + w - delta, y: y + delta },
      'top-right': { x: x + w - delta, y: y + h - delta },
      'top-left': { x: x + delta, y: y + h - delta },
    };

    const dogboneOvercut = r * SQRT_2;

    for (const [loc, vertex] of Object.entries(vertices) as [CornerLocation, { x: number; y: number }][]) {
      corners.push({
        corner: loc,
        vertexMm: vertex,
        reliefCenterMm: centers[loc],
        reliefRadiusMm: r,
        clearanceDepthMm: r * (SQRT_2 - 1),
      });
    }

    // Closed SVG path for dog-bone pocket
    // Follows clockwise or counter-clockwise boundary
    // Start at bottom-left corner after relief on left edge (x, y + dogboneOvercut)
    // Down to bottom-left relief arc (center at x+delta, y+delta), exits at (x + dogboneOvercut, y)
    // Across bottom edge to bottom-right relief (x + w - dogboneOvercut, y)
    // Arc to (x + w, y + dogboneOvercut)
    // Up right edge to top-right relief (x + w, y + h - dogboneOvercut)
    // Arc to (x + w - dogboneOvercut, y + h)
    // Across top edge to top-left relief (x + dogboneOvercut, y + h)
    // Arc to (x, y + h - dogboneOvercut)
    // Down left edge back to start
    const svgPath = [
      `M ${round(x)} ${round(y + dogboneOvercut)}`,
      // Bottom-Left Dog-bone Arc
      `A ${round(r)} ${round(r)} 0 1 0 ${round(x + dogboneOvercut)} ${round(y)}`,
      // Bottom Edge
      `L ${round(x + w - dogboneOvercut)} ${round(y)}`,
      // Bottom-Right Dog-bone Arc
      `A ${round(r)} ${round(r)} 0 1 0 ${round(x + w)} ${round(y + dogboneOvercut)}`,
      // Right Edge
      `L ${round(x + w)} ${round(y + h - dogboneOvercut)}`,
      // Top-Right Dog-bone Arc
      `A ${round(r)} ${round(r)} 0 1 0 ${round(x + w - dogboneOvercut)} ${round(y + h)}`,
      // Top Edge
      `L ${round(x + dogboneOvercut)} ${round(y + h)}`,
      // Top-Left Dog-bone Arc
      `A ${round(r)} ${round(r)} 0 1 0 ${round(x)} ${round(y + h - dogboneOvercut)}`,
      `Z`,
    ].join(' ');

    return { valid: errors.length === 0, errors, corners, svgPath };
  }

  if (cornerTreatment === 't-bone') {
    // T-bone: cutter overcuts along chosen axis.
    // If tBoneAxis === 'x':
    // Cutter overcuts horizontally into side walls by radius r.
    const centers: Record<CornerLocation, { x: number; y: number }> =
      tBoneAxis === 'x'
        ? {
            'bottom-left': { x: x, y: y + r },
            'bottom-right': { x: x + w, y: y + r },
            'top-right': { x: x + w, y: y + h - r },
            'top-left': { x: x, y: y + h - r },
          }
        : {
            'bottom-left': { x: x + r, y: y },
            'bottom-right': { x: x + w - r, y: y },
            'top-right': { x: x + w - r, y: y + h },
            'top-left': { x: x + r, y: y + h },
          };

    for (const [loc, vertex] of Object.entries(vertices) as [CornerLocation, { x: number; y: number }][]) {
      corners.push({
        corner: loc,
        vertexMm: vertex,
        reliefCenterMm: centers[loc],
        reliefRadiusMm: r,
        clearanceDepthMm: r,
      });
    }

    let svgPath = '';
    if (tBoneAxis === 'x') {
      svgPath = [
        `M ${round(x)} ${round(y + 2 * r)}`,
        `A ${round(r)} ${round(r)} 0 0 0 ${round(x)} ${round(y)}`,
        `L ${round(x + w)} ${round(y)}`,
        `A ${round(r)} ${round(r)} 0 0 0 ${round(x + w)} ${round(y + 2 * r)}`,
        `L ${round(x + w)} ${round(y + h - 2 * r)}`,
        `A ${round(r)} ${round(r)} 0 0 0 ${round(x + w)} ${round(y + h)}`,
        `L ${round(x)} ${round(y + h)}`,
        `A ${round(r)} ${round(r)} 0 0 0 ${round(x)} ${round(y + h - 2 * r)}`,
        `Z`,
      ].join(' ');
    } else {
      svgPath = [
        `M ${round(x)} ${round(y)}`,
        `A ${round(r)} ${round(r)} 0 0 0 ${round(x + 2 * r)} ${round(y)}`,
        `L ${round(x + w - 2 * r)} ${round(y)}`,
        `A ${round(r)} ${round(r)} 0 0 0 ${round(x + w)} ${round(y)}`,
        `L ${round(x + w)} ${round(y + h)}`,
        `A ${round(r)} ${round(r)} 0 0 0 ${round(x + w - 2 * r)} ${round(y + h)}`,
        `L ${round(x + 2 * r)} ${round(y + h)}`,
        `A ${round(r)} ${round(r)} 0 0 0 ${round(x)} ${round(y + h)}`,
        `Z`,
      ].join(' ');
    }

    return { valid: errors.length === 0, errors, corners, svgPath };
  }

  // Default: natural-radius (fillet arc tangent to both edges)
  const centers: Record<CornerLocation, { x: number; y: number }> = {
    'bottom-left': { x: x + r, y: y + r },
    'bottom-right': { x: x + w - r, y: y + r },
    'top-right': { x: x + w - r, y: y + h - r },
    'top-left': { x: x + r, y: y + h - r },
  };

  for (const [loc, vertex] of Object.entries(vertices) as [CornerLocation, { x: number; y: number }][]) {
    corners.push({
      corner: loc,
      vertexMm: vertex,
      reliefCenterMm: centers[loc],
      reliefRadiusMm: r,
      clearanceDepthMm: 0,
    });
  }

  const svgPath = [
    `M ${round(x)} ${round(y + r)}`,
    `A ${round(r)} ${round(r)} 0 0 0 ${round(x + r)} ${round(y)}`,
    `L ${round(x + w - r)} ${round(y)}`,
    `A ${round(r)} ${round(r)} 0 0 0 ${round(x + w)} ${round(y + r)}`,
    `L ${round(x + w)} ${round(y + h - r)}`,
    `A ${round(r)} ${round(r)} 0 0 0 ${round(x + w - r)} ${round(y + h)}`,
    `L ${round(x + r)} ${round(y + h)}`,
    `A ${round(r)} ${round(r)} 0 0 0 ${round(x)} ${round(y + h - r)}`,
    `Z`,
  ].join(' ');

  return { valid: errors.length === 0, errors, corners, svgPath };
}

function round(val: number): number {
  return Math.round(val * 1000) / 1000;
}
