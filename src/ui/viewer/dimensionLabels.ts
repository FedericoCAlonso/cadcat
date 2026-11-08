import * as THREE from 'three';
import type { ModuleSpatialBounds } from '../../resolver';
import { DEFAULT_UI_CONFIG } from '../../config';

/**
 * 3D point structure.
 */
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Metadata and 3D anchor coordinates for a single dimension label (width, height, or depth).
 */
export interface DimensionAnchor {
  /** Identifier of the dimension axis ('width' | 'height' | 'depth'). */
  id: 'width' | 'height' | 'depth';
  /** Cartesian axis along which the dimension is measured. */
  axis: 'x' | 'y' | 'z';
  /** Raw dimension value in millimeters. */
  valueMm: number;
  /** Pre-formatted display text (e.g. "600 mm" or "1.200 mm"). */
  formattedText: string;
  /** Start point of the dimension line in pieceGroup local coordinates. */
  localStart: Point3D;
  /** End point of the dimension line in pieceGroup local coordinates. */
  localEnd: Point3D;
  /** Midpoint of the dimension line where the label attaches. */
  localMid: Point3D;
}

/**
 * Screen-space projected coordinates and visibility state for a dimension label.
 */
export interface ProjectedDimensionLabel {
  id: 'width' | 'height' | 'depth';
  formattedText: string;
  valueMm: number;
  /** Screen X coordinate in CSS pixels relative to the viewport canvas. */
  screenX: number;
  /** Screen Y coordinate in CSS pixels relative to the viewport canvas. */
  screenY: number;
  /** Whether the label is currently visible and not occluded or too small. */
  visible: boolean;
  /** Length of the dimension line in projected screen pixels. */
  screenSpanPx: number;
}

/**
 * Configuration options for 3D dimension lines and projected DOM labels.
 */
export interface DimensionLinesOptions {
  /** Perpendicular offset distance of dimension lines from module bounding box in millimeters. */
  offsetMm?: number;
  /** Extension distance beyond dimension lines for witness lines in millimeters. */
  extensionMm?: number;
  /** Tick mark half-length in millimeters. */
  tickSizeMm?: number;
  /** Color of dimension lines and ticks. */
  color?: number;
  /** Theme mode ('dark' | 'light'). */
  theme?: 'dark' | 'light';
  /** Unit string appended to value (defaults to config dimensionUnit). */
  dimensionUnit?: string;
  /** Locale for number formatting (defaults to config dimensionNumberFormat). */
  dimensionNumberFormat?: string;
  /** Minimum projected line length in screen pixels below which label is hidden. */
  minScreenSpanPx?: number;
}

/** Default theme line colors for dimension lines. */
export const DIMENSION_THEME_COLORS = {
  dark: 0x94a3b8, // Light slate for dark backgrounds
  light: 0x475569, // Slate 600 for light backgrounds
} as const;

/**
 * Formats a millimeter dimension value using locale-aware formatting from configuration
 * with an optional dimension axis prefix (e.g. "An 600 mm", "Al 800 mm", "Pr 500 mm").
 *
 * @param valueMm Value in millimeters.
 * @param prefix Optional axis prefix (e.g. "An", "Al", "Pr").
 * @param locale Locale code (defaults to config dimensionNumberFormat, e.g. "es-AR").
 * @param unit Unit label (defaults to config dimensionUnit, e.g. "mm").
 * @returns Formatted localized string (e.g. "An 600 mm" or "Pr 500 mm").
 */
export function formatDimensionText(
  valueMm: number,
  prefix?: string,
  locale = DEFAULT_UI_CONFIG.dimensionNumberFormat ?? 'es-AR',
  unit = DEFAULT_UI_CONFIG.dimensionUnit ?? 'mm',
): string {
  const rounded = Math.round(valueMm);
  const formatted = new Intl.NumberFormat(locale).format(rounded);
  const prefixStr = prefix ? `${prefix} ` : '';
  return `${prefixStr}${formatted} ${unit}`;
}

/**
 * Pure function that determines whether a target 3D point is occluded by an axis-aligned bounding box
 * when viewed from a given camera eye position.
 *
 * Uses the slab intersection method on the 3D ray segment connecting origin to target.
 *
 * @param origin Camera eye position in world space.
 * @param target Target point in world space (e.g. dimension anchor or midpoint).
 * @param box Axis-aligned bounding box of the furniture module.
 * @param insetMm Inset tolerance in mm to avoid false positives for points on the box boundaries.
 * @returns True if the box is positioned between origin and target, occluding the target.
 */
export function isPointOccludedByBox(
  origin: Point3D,
  target: Point3D,
  box: { min: Point3D; max: Point3D },
  insetMm = 5,
): boolean {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dz = target.z - origin.z;
  const dist = Math.hypot(dx, dy, dz);
  if (dist < 1e-4) return false;

  const invDx = dx !== 0 ? 1 / dx : (dx >= 0 ? 1e9 : -1e9);
  const invDy = dy !== 0 ? 1 / dy : (dy >= 0 ? 1e9 : -1e9);
  const invDz = dz !== 0 ? 1 / dz : (dz >= 0 ? 1e9 : -1e9);

  const bMinX = box.min.x + insetMm;
  const bMaxX = box.max.x - insetMm;
  const bMinY = box.min.y + insetMm;
  const bMaxY = box.max.y - insetMm;
  const bMinZ = box.min.z + insetMm;
  const bMaxZ = box.max.z - insetMm;

  if (bMinX >= bMaxX || bMinY >= bMaxY || bMinZ >= bMaxZ) return false;

  let t1 = (bMinX - origin.x) * invDx;
  let t2 = (bMaxX - origin.x) * invDx;
  let tmin = Math.min(t1, t2);
  let tmax = Math.max(t1, t2);

  t1 = (bMinY - origin.y) * invDy;
  t2 = (bMaxY - origin.y) * invDy;
  tmin = Math.max(tmin, Math.min(t1, t2));
  tmax = Math.min(tmax, Math.max(t1, t2));

  t1 = (bMinZ - origin.z) * invDz;
  t2 = (bMaxZ - origin.z) * invDz;
  tmin = Math.max(tmin, Math.min(t1, t2));
  tmax = Math.min(tmax, Math.max(t1, t2));

  // The ray segment intersects the box between camera (t=0) and target (t=1)
  return tmax >= tmin && tmax > 0.02 && tmin < 0.98;
}

/**
 * Builds the 3D anchor points (width, height, depth) in pieceGroup local space.
 *
 * @param bounds Spatial bounds of the furniture module.
 * @param options Dimension line options.
 * @returns Array of 3 dimension anchors (width, height, depth).
 */
export function buildDimensionAnchors(
  bounds: ModuleSpatialBounds,
  options?: DimensionLinesOptions,
): DimensionAnchor[] {
  const offsetMm = options?.offsetMm ?? DEFAULT_UI_CONFIG.dimensionOffsetMm ?? 80;
  const locale = options?.dimensionNumberFormat ?? DEFAULT_UI_CONFIG.dimensionNumberFormat ?? 'es-AR';
  const unit = options?.dimensionUnit ?? DEFAULT_UI_CONFIG.dimensionUnit ?? 'mm';
  const prefixes = DEFAULT_UI_CONFIG.dimensionPrefixes ?? { width: 'An', height: 'Al', depth: 'Pr' };

  // 1. Width (along X): placed along the bottom front edge
  const widthVal = bounds.size.x;
  const widthAnchor: DimensionAnchor = {
    id: 'width',
    axis: 'x',
    valueMm: widthVal,
    formattedText: formatDimensionText(widthVal, prefixes.width, locale, unit),
    localStart: { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z - offsetMm },
    localEnd: { x: bounds.max.x, y: bounds.min.y, z: bounds.min.z - offsetMm },
    localMid: { x: bounds.center.x, y: bounds.min.y, z: bounds.min.z - offsetMm },
  };

  // 2. Height (along Y): placed on the left side (min X), front-aligned
  const heightVal = bounds.size.y;
  const heightAnchor: DimensionAnchor = {
    id: 'height',
    axis: 'y',
    valueMm: heightVal,
    formattedText: formatDimensionText(heightVal, prefixes.height, locale, unit),
    localStart: { x: bounds.min.x - offsetMm, y: bounds.min.y, z: bounds.min.z },
    localEnd: { x: bounds.min.x - offsetMm, y: bounds.max.y, z: bounds.min.z },
    localMid: { x: bounds.min.x - offsetMm, y: bounds.center.y, z: bounds.min.z },
  };

  // 3. Depth (along Z): placed on the right side (max X), bottom-aligned
  const depthVal = bounds.size.z;
  const depthAnchor: DimensionAnchor = {
    id: 'depth',
    axis: 'z',
    valueMm: depthVal,
    formattedText: formatDimensionText(depthVal, prefixes.depth, locale, unit),
    localStart: { x: bounds.max.x + offsetMm, y: bounds.min.y, z: bounds.min.z },
    localEnd: { x: bounds.max.x + offsetMm, y: bounds.min.y, z: bounds.max.z },
    localMid: { x: bounds.max.x + offsetMm, y: bounds.min.y, z: bounds.center.z },
  };

  return [widthAnchor, heightAnchor, depthAnchor];
}

/**
 * Creates a Three.js Group containing 3D dimension lines, extension (witness) lines,
 * and architectural tick marks in pieceGroup local coordinate space.
 *
 * IMPORTANT (Rule 3.0.1): This group must be added directly as a child of `pieceGroup`
 * so that it automatically inherits `pieceGroup.scale.x = -1` and `pieceGroup.position.x = 2 * center.x`,
 * guaranteeing 100% geometric alignment with the pieces.
 *
 * @param bounds Spatial bounds of the furniture module.
 * @param options Customization options.
 * @returns A THREE.Group containing the dimension line geometry.
 */
export function createDimensionLinesGroup(
  bounds: ModuleSpatialBounds,
  options?: DimensionLinesOptions,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'DimensionLinesOverlay';

  const offsetMm = options?.offsetMm ?? DEFAULT_UI_CONFIG.dimensionOffsetMm ?? 80;
  const extensionMm = options?.extensionMm ?? DEFAULT_UI_CONFIG.dimensionExtensionMm ?? 25;
  const tickSize = options?.tickSizeMm ?? 15;
  const theme = options?.theme ?? 'dark';
  const colorHex = options?.color ?? (theme === 'light' ? DIMENSION_THEME_COLORS.light : DIMENSION_THEME_COLORS.dark);

  const positions: number[] = [];

  const addLine = (p1: Point3D, p2: Point3D) => {
    positions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
  };

  // 1. Width Lines (along X, at Z = bounds.min.z - offsetMm, Y = bounds.min.y)
  const wz = bounds.min.z - offsetMm;
  const wy = bounds.min.y;
  // Main dimension line
  addLine({ x: bounds.min.x, y: wy, z: wz }, { x: bounds.max.x, y: wy, z: wz });
  // Extension lines from module to dimension line
  addLine({ x: bounds.min.x, y: wy, z: bounds.min.z }, { x: bounds.min.x, y: wy, z: wz - extensionMm });
  addLine({ x: bounds.max.x, y: wy, z: bounds.min.z }, { x: bounds.max.x, y: wy, z: wz - extensionMm });
  // Architectural 45-degree ticks
  addLine({ x: bounds.min.x - tickSize, y: wy, z: wz - tickSize }, { x: bounds.min.x + tickSize, y: wy, z: wz + tickSize });
  addLine({ x: bounds.max.x - tickSize, y: wy, z: wz - tickSize }, { x: bounds.max.x + tickSize, y: wy, z: wz + tickSize });

  // 2. Height Lines (along Y, at X = bounds.min.x - offsetMm, Z = bounds.min.z)
  const hx = bounds.min.x - offsetMm;
  const hz = bounds.min.z;
  // Main dimension line
  addLine({ x: hx, y: bounds.min.y, z: hz }, { x: hx, y: bounds.max.y, z: hz });
  // Extension lines
  addLine({ x: bounds.min.x, y: bounds.min.y, z: hz }, { x: hx - extensionMm, y: bounds.min.y, z: hz });
  addLine({ x: bounds.min.x, y: bounds.max.y, z: hz }, { x: hx - extensionMm, y: bounds.max.y, z: hz });
  // Architectural ticks
  addLine({ x: hx - tickSize, y: bounds.min.y - tickSize, z: hz }, { x: hx + tickSize, y: bounds.min.y + tickSize, z: hz });
  addLine({ x: hx - tickSize, y: bounds.max.y - tickSize, z: hz }, { x: hx + tickSize, y: bounds.max.y + tickSize, z: hz });

  // 3. Depth Lines (along Z, at X = bounds.max.x + offsetMm, Y = bounds.min.y)
  const dx = bounds.max.x + offsetMm;
  const dy = bounds.min.y;
  // Main dimension line
  addLine({ x: dx, y: dy, z: bounds.min.z }, { x: dx, y: dy, z: bounds.max.z });
  // Extension lines
  addLine({ x: bounds.max.x, y: dy, z: bounds.min.z }, { x: dx + extensionMm, y: dy, z: bounds.min.z });
  addLine({ x: bounds.max.x, y: dy, z: bounds.max.z }, { x: dx + extensionMm, y: dy, z: bounds.max.z });
  // Architectural ticks
  addLine({ x: dx - tickSize, y: dy, z: bounds.min.z - tickSize }, { x: dx + tickSize, y: dy, z: bounds.min.z + tickSize });
  addLine({ x: dx - tickSize, y: dy, z: bounds.max.z - tickSize }, { x: dx + tickSize, y: dy, z: bounds.max.z + tickSize });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  const material = new THREE.LineBasicMaterial({
    color: colorHex,
    linewidth: 1,
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
  });

  const lines = new THREE.LineSegments(geometry, material);
  group.add(lines);

  return group;
}

/**
 * Safely disposes Three.js geometries and materials in a dimension lines group.
 *
 * @param group The THREE.Group to dispose.
 */
export function disposeDimensionLinesGroup(group: THREE.Group | null | undefined): void {
  if (!group) return;
  group.traverse((obj) => {
    if (obj instanceof THREE.LineSegments || obj instanceof THREE.Mesh) {
      if (obj.geometry) obj.geometry.dispose();
      if (Array.isArray(obj.material)) {
        obj.material.forEach((m) => m.dispose());
      } else if (obj.material) {
        obj.material.dispose();
      }
    }
  });
}

/**
 * Pure function that projects 3D dimension anchor coordinates to 2D screen positions
 * and evaluates visibility, occlusion, and minimum screen span.
 *
 * @param anchors Array of dimension anchors in pieceGroup local space.
 * @param camera Three.js perspective camera.
 * @param pieceGroupMatrixWorld World transformation matrix of pieceGroup (containing scale.x = -1).
 * @param viewportWidth Width of viewport canvas in CSS pixels.
 * @param viewportHeight Height of viewport canvas in CSS pixels.
 * @param options Projection options.
 * @returns Array of projected label positions and visibility states.
 */
export function projectDimensionLabels(
  anchors: DimensionAnchor[],
  camera: THREE.Camera,
  pieceGroupMatrixWorld: THREE.Matrix4,
  viewportWidth: number,
  viewportHeight: number,
  options?: {
    minScreenSpanPx?: number;
    bounds?: ModuleSpatialBounds;
  },
): ProjectedDimensionLabel[] {
  const minScreenSpanPx = options?.minScreenSpanPx ?? DEFAULT_UI_CONFIG.dimensionMinScreenSpanPx ?? 30;
  const bounds = options?.bounds;

  const results: ProjectedDimensionLabel[] = [];

  const tempVec = new THREE.Vector3();
  const startWorld = new THREE.Vector3();
  const endWorld = new THREE.Vector3();
  const midWorld = new THREE.Vector3();

  // Camera world position for occlusion calculations
  const camPos = new THREE.Vector3();
  camera.getWorldPosition(camPos);

  for (const anchor of anchors) {
    // 1. Transform local coordinates into world space using pieceGroup matrix
    startWorld.set(anchor.localStart.x, anchor.localStart.y, anchor.localStart.z).applyMatrix4(pieceGroupMatrixWorld);
    endWorld.set(anchor.localEnd.x, anchor.localEnd.y, anchor.localEnd.z).applyMatrix4(pieceGroupMatrixWorld);
    midWorld.set(anchor.localMid.x, anchor.localMid.y, anchor.localMid.z).applyMatrix4(pieceGroupMatrixWorld);

    // 2. Project midpoint to Normalized Device Coordinates (NDC)
    tempVec.copy(midWorld).project(camera);

    // 3. Screen coordinates in CSS pixels
    const screenX = (tempVec.x * 0.5 + 0.5) * viewportWidth;
    const screenY = (-tempVec.y * 0.5 + 0.5) * viewportHeight;

    // 4. Calculate projected length of dimension line on screen
    const pStart = startWorld.clone().project(camera);
    const pEnd = endWorld.clone().project(camera);
    const dx = (pEnd.x - pStart.x) * 0.5 * viewportWidth;
    const dy = (-pEnd.y - -pStart.y) * 0.5 * viewportHeight;
    const screenSpanPx = Math.hypot(dx, dy);

    // 5. Visibility evaluations
    let visible = true;

    // Behind camera near plane
    if (tempVec.z > 1.0) {
      visible = false;
    }

    // Line is viewed edge-on or too far away to fit readable text
    if (screenSpanPx < minScreenSpanPx) {
      visible = false;
    }

    // Completely outside visible canvas area (with margin)
    if (screenX < -40 || screenX > viewportWidth + 40 || screenY < -40 || screenY > viewportHeight + 40) {
      visible = false;
    }

    // Occlusion check against module bounds (slab Ray-AABB intersection)
    // Hides label when its line or midpoint is occluded by the module volume
    if (bounds && visible) {
      const midOccluded = isPointOccludedByBox(camPos, midWorld, bounds);
      const endsOccluded = isPointOccludedByBox(camPos, startWorld, bounds) && isPointOccludedByBox(camPos, endWorld, bounds);
      if (midOccluded || endsOccluded) {
        visible = false;
      }
    }

    results.push({
      id: anchor.id,
      formattedText: anchor.formattedText,
      valueMm: anchor.valueMm,
      screenX: Math.round(screenX),
      screenY: Math.round(screenY),
      visible,
      screenSpanPx: Math.round(screenSpanPx),
    });
  }

  // 6. Anti-collision / overlap resolution between labels
  for (let i = 0; i < results.length; i++) {
    const a = results[i];
    if (!a || !a.visible) continue;
    for (let j = i + 1; j < results.length; j++) {
      const b = results[j];
      if (!b || !b.visible) continue;
      const dist = Math.hypot(a.screenX - b.screenX, a.screenY - b.screenY);
      // If two labels collide within 36px, slightly offset the one with lower span
      if (dist < 36) {
        if (a.screenSpanPx >= b.screenSpanPx) {
          b.screenY += 20;
        } else {
          a.screenY += 20;
        }
      }
    }
  }

  return results;
}
