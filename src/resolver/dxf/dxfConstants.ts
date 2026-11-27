/**
 * Constants and Layer Definitions for AutoCAD Release 12 (AC1009) DXF Generation.
 * Follows Strict No-Hardcoding Policy: All layer names, colors, and AutoCAD codes are declared here.
 */

export const AUTOCAD_R12_VERSION = 'AC1009';

/** AutoCAD Measurement system: 1 = Metric, 0 = Imperial */
export const DXF_MEASUREMENT_METRIC = 1;

/** AutoCAD Units ($INSUNITS): 4 = Millimeters */
export const DXF_INSUNITS_MILLIMETERS = 4;

/** Default decimal precision for coordinates in millimeters */
export const DEFAULT_DXF_COORDINATE_PRECISION = 3;

/** Standard DXF Layer Names for Digital Carpentry & CNC nesting */
export const DXF_STANDARD_LAYERS = {
  CONTOUR: '0_CONTOUR',
  DRILL_5MM: '1_DRILL_5MM',
  DRILL_8MM: '1_DRILL_8MM',
  DRILL_15MM: '1_DRILL_15MM',
  DRILL_35MM: '1_DRILL_35MM',
  GROOVE: '2_GROOVE',
  POCKET: '3_POCKET',
  PROFILE: '4_PROFILE',
  EDGE_DRILL: '5_EDGE_DRILL',
  LABEL: '0_LABEL',
} as const;

export type DxfStandardLayerName =
  (typeof DXF_STANDARD_LAYERS)[keyof typeof DXF_STANDARD_LAYERS];

/**
 * Standard AutoCAD Color Index (ACI) for layers:
 * 1: Red, 2: Yellow, 3: Green, 4: Cyan, 5: Blue, 6: Magenta, 7: White/Black, 8: Dark Gray, 30: Orange
 */
export const DXF_LAYER_COLORS: Record<string, number> = {
  [DXF_STANDARD_LAYERS.CONTOUR]: 7, // White/Black (cut boundary)
  [DXF_STANDARD_LAYERS.DRILL_5MM]: 1, // Red (confirmat / shelf pins / system 32)
  [DXF_STANDARD_LAYERS.DRILL_8MM]: 3, // Green (dowels / minifix bolt)
  [DXF_STANDARD_LAYERS.DRILL_15MM]: 5, // Blue (minifix cam)
  [DXF_STANDARD_LAYERS.DRILL_35MM]: 6, // Magenta (hinge cups)
  [DXF_STANDARD_LAYERS.GROOVE]: 4, // Cyan (back panel grooves / slots)
  [DXF_STANDARD_LAYERS.POCKET]: 2, // Yellow (cutouts / cable grommets)
  [DXF_STANDARD_LAYERS.PROFILE]: 30, // Orange (chamfers / roundovers)
  [DXF_STANDARD_LAYERS.EDGE_DRILL]: 140, // Steel Blue (edge boring for CNC/dowel)
  [DXF_STANDARD_LAYERS.LABEL]: 8, // Dark Gray (text annotations)
};

/** Default fallback color for custom drill layers */
export const DXF_DEFAULT_CUSTOM_DRILL_COLOR = 1; // Red

/** Standard drill diameters mapping to canonical layer names */
export const CANONICAL_DRILL_DIAMETERS = [5, 8, 15, 35] as const;

/** Tolerance for matching nominal tool diameters (in mm) */
export const DIAMETER_MATCH_TOLERANCE_MM = 0.2;

/**
 * Resolves a drill operation diameter to its standardized CAD layer name.
 * e.g. 5mm -> '1_DRILL_5MM', 8mm -> '1_DRILL_8MM', 10mm -> '1_DRILL_10MM'
 */
export function getDrillLayerName(diameterMm: number, depthMm?: number, isThrough?: boolean): string {
  let base: string | null = null;
  for (const nominal of CANONICAL_DRILL_DIAMETERS) {
    if (Math.abs(diameterMm - nominal) <= DIAMETER_MATCH_TOLERANCE_MM) {
      base = `1_DRILL_${nominal}MM`;
      break;
    }
  }
  if (!base) {
    const rounded = Math.round(diameterMm * 10) / 10;
    base = `1_DRILL_${rounded}MM`;
  }
  if (depthMm !== undefined && depthMm > 0) {
    const zTag = isThrough ? 'THRU' : `Z${Math.round(depthMm * 10) / 10}`;
    return `${base}_${zTag}`;
  }
  return base;
}

/**
 * Resolves a CAM groove layer name optionally encoding groove width & Z depth.
 */
export function getGrooveLayerName(widthMm?: number, depthMm?: number): string {
  if (widthMm !== undefined && depthMm !== undefined) {
    const w = Math.round(widthMm * 10) / 10;
    const z = Math.round(depthMm * 10) / 10;
    return `${DXF_STANDARD_LAYERS.GROOVE}_W${w}_Z${z}`;
  }
  return DXF_STANDARD_LAYERS.GROOVE;
}

/**
 * Resolves a CAM edge-drilling layer name encoding edge orientation, diameter, and Z depth.
 */
export function getEdgeDrillLayerName(edgeFaceId: string, diameterMm: number, depthMm: number): string {
  const f = edgeFaceId.toLowerCase();
  const edgeCode = f.includes('left')
    ? 'LEFT'
    : f.includes('right')
      ? 'RIGHT'
      : f.includes('top')
        ? 'TOP'
        : 'BOTTOM';
  const d = Math.round(diameterMm * 10) / 10;
  const z = Math.round(depthMm * 10) / 10;
  return `${DXF_STANDARD_LAYERS.EDGE_DRILL}_${edgeCode}_D${d}_Z${z}`;
}
