import type { ModuleSpatialBounds } from '../../resolver';
import { DEFAULT_UI_CONFIG } from '../../config';

/**
 * 3D vector-like coordinate structure.
 */
export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

/**
 * Input parameters for camera auto-fit calculation.
 */
export interface CameraFitParams {
  /** Spatial bounding box of the module (min, max, center, size). */
  bounds: ModuleSpatialBounds;
  /** Viewport aspect ratio (width / height). */
  aspect: number;
  /** Vertical field of view in degrees (defaults to 45). */
  fov?: number;
  /** Proportion of viewport covered by the bounding box [0..1] (defaults to config viewerFillRatio). */
  fillRatio?: number;
  /** Direction vector from target toward the camera (defaults to standard isometric [1.5, 1.2, -2.0]). */
  direction?: Vector3Like;
}

/**
 * Result of the camera auto-fit calculation.
 */
export interface CameraFitResult {
  /** Calculated camera eye position in world coordinates. */
  position: Vector3Like;
  /** Target look-at point in world coordinates (center of module bounds). */
  target: Vector3Like;
  /** Distance from target center to camera eye in millimeters. */
  distance: number;
}

/** Default isometric view direction vector pointing toward the front-top-right corner. */
export const DEFAULT_ISOMETRIC_DIRECTION: Vector3Like = {
  x: 1.5,
  y: 1.2,
  z: -2.0,
};

/**
 * Pure function that calculates optimal camera distance and eye position so that the
 * entire module bounding box fills a large portion of the viewport without clipping.
 *
 * It projects all 8 corners of the bounding box into the camera view coordinate system
 * and determines the exact minimal distance required along the viewing direction so that
 * all corners fit within the camera frustum scaled by `fillRatio`.
 *
 * @param params Camera fitting parameters.
 * @returns Camera position, target look-at point, and distance.
 */
export function calculateCameraFit(params: CameraFitParams): CameraFitResult {
  const {
    bounds,
    aspect,
    fov = 45,
    fillRatio = DEFAULT_UI_CONFIG.viewerFillRatio ?? 0.85,
    direction = DEFAULT_ISOMETRIC_DIRECTION,
  } = params;

  // Normalize direction vector d (pointing from target toward camera)
  const dirLen = Math.hypot(direction.x, direction.y, direction.z) || 1;
  const dx = direction.x / dirLen;
  const dy = direction.y / dirLen;
  const dz = direction.z / dirLen;

  // Forward vector pointing from camera to target
  const fx = -dx;
  const fy = -dy;
  const fz = -dz;

  // World up vector (0, 1, 0), fallback to (0, 0, 1) if looking almost vertically
  let upX = 0;
  let upY = 1;
  let upZ = 0;
  if (Math.abs(fy) > 0.99) {
    upX = 0;
    upY = 0;
    upZ = fy > 0 ? -1 : 1;
  }

  // Camera right vector = forward x up
  let rx = fy * upZ - fz * upY;
  let ry = fz * upX - fx * upZ;
  let rz = fx * upY - fy * upX;
  const rLen = Math.hypot(rx, ry, rz) || 1;
  rx /= rLen;
  ry /= rLen;
  rz /= rLen;

  // Camera up vector = right x forward
  let ux = ry * fz - rz * fy;
  let uy = rz * fx - rx * fz;
  let uz = rx * fy - ry * fx;
  const uLen = Math.hypot(ux, uy, uz) || 1;
  ux /= uLen;
  uy /= uLen;
  uz /= uLen;

  // Tangents of half FOV angles
  const fovRad = (fov * Math.PI) / 180;
  const halfTanY = Math.tan(fovRad / 2);
  const halfTanX = aspect * halfTanY;

  const effectiveRatio = Math.max(0.1, Math.min(1.0, fillRatio));
  const limitTanY = halfTanY * effectiveRatio;
  const limitTanX = halfTanX * effectiveRatio;

  const cx = bounds.center.x;
  const cy = bounds.center.y;
  const cz = bounds.center.z;

  // 8 corners of the bounding box
  const corners: Vector3Like[] = [
    { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z },
    { x: bounds.max.x, y: bounds.min.y, z: bounds.min.z },
    { x: bounds.min.x, y: bounds.max.y, z: bounds.min.z },
    { x: bounds.max.x, y: bounds.max.y, z: bounds.min.z },
    { x: bounds.min.x, y: bounds.min.y, z: bounds.max.z },
    { x: bounds.max.x, y: bounds.min.y, z: bounds.max.z },
    { x: bounds.min.x, y: bounds.max.y, z: bounds.max.z },
    { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z },
  ];

  let maxRequiredDist = 0;

  for (const corner of corners) {
    // Vector from center to corner
    const vx = corner.x - cx;
    const vy = corner.y - cy;
    const vz = corner.z - cz;

    // Projected coordinates in camera frame:
    // xCam along camera right
    const xCam = Math.abs(vx * rx + vy * ry + vz * rz);
    // yCam along camera up
    const yCam = Math.abs(vx * ux + vy * uy + vz * uz);
    // zCam along direction toward camera (depth offset relative to center)
    const zCam = vx * dx + vy * dy + vz * dz;

    // Minimum distance so that |xCam| <= (dist - zCam) * limitTanX
    const distForX = zCam + xCam / limitTanX;
    // Minimum distance so that |yCam| <= (dist - zCam) * limitTanY
    const distForY = zCam + yCam / limitTanY;

    maxRequiredDist = Math.max(maxRequiredDist, distForX, distForY);
  }

  // Ensure minimum reasonable distance
  const distance = Math.max(maxRequiredDist, 200);

  return {
    position: {
      x: cx + dx * distance,
      y: cy + dy * distance,
      z: cz + dz * distance,
    },
    target: {
      x: cx,
      y: cy,
      z: cz,
    },
    distance,
  };
}

/**
 * Calculates a new camera eye position when module dimensions change but the user has
 * manually rotated, panned, or zoomed the camera.
 *
 * Keeps the camera target centered on the new module center while strictly preserving
 * the relative orientation, pitch, yaw, and distance offset from the module center,
 * preventing any unwanted camera jump.
 *
 * @param newTarget New module center in world coordinates.
 * @param previousTarget Previous module center in world coordinates.
 * @param currentPosition Current camera eye position in world coordinates.
 * @returns Updated camera eye position preserving orientation.
 */
export function calculatePreservedCameraTarget(
  newTarget: Vector3Like,
  previousTarget: Vector3Like,
  currentPosition: Vector3Like,
): Vector3Like {
  return {
    x: newTarget.x + (currentPosition.x - previousTarget.x),
    y: newTarget.y + (currentPosition.y - previousTarget.y),
    z: newTarget.z + (currentPosition.z - previousTarget.z),
  };
}
