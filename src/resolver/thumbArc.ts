/**
 * Pure mathematical resolver for ergonomic thumb arc gesture interaction (Modo Obra).
 * Models natural radial sweep of the thumb when holding a mobile device with one hand.
 */

export type HandMode = 'right' | 'left';

export interface Point2D {
  x: number;
  y: number;
}

export interface ThumbArcConfig {
  min: number;
  max: number;
  step: number;
  coarseStep: number;
  handMode: HandMode;
  mmPerRadian: number;
  fastAngularVelocityThreshold: number; // radians per second
  fastMultiplier: number;
  majorTickInterval: number; // e.g. 100 mm
  minorTickInterval: number; // e.g. 10 mm
}

export const DEFAULT_THUMB_ARC_CONFIG: ThumbArcConfig = {
  min: 50,
  max: 3000,
  step: 1,
  coarseStep: 10,
  handMode: 'right',
  mmPerRadian: 450, // ~7.8 mm per degree of sweep
  fastAngularVelocityThreshold: 4.0, // rad/s
  fastMultiplier: 5,
  majorTickInterval: 100,
  minorTickInterval: 10,
};

export type HapticType = 'none' | 'tick' | 'major';

/**
 * Calculates the angle (in radians, from -PI to PI) of a touch point relative to the thumb pivot origin.
 */
export function calculatePointAngle(point: Point2D, pivot: Point2D): number {
  return Math.atan2(point.y - pivot.y, point.x - pivot.x);
}

/**
 * Computes shortest angular delta between two angles in radians, handling -PI / PI wrap-around.
 */
export function normalizeAngularDelta(prevAngle: number, currentAngle: number): number {
  let diff = currentAngle - prevAngle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return diff;
}

/**
 * Determines the default thumb pivot position based on container dimensions and hand mode.
 * - Right hand: bottom-right corner with anatomical offset for thenar eminence.
 * - Left hand: bottom-left corner with anatomical offset.
 */
export function getThumbPivotPoint(
  width: number,
  height: number,
  handMode: HandMode,
  marginOffsetMm: number = 30,
): Point2D {
  const safeWidth = Math.max(100, width);
  const safeHeight = Math.max(100, height);

  if (handMode === 'right') {
    return {
      x: safeWidth + marginOffsetMm,
      y: safeHeight + marginOffsetMm,
    };
  }

  return {
    x: -marginOffsetMm,
    y: safeHeight + marginOffsetMm,
  };
}

/**
 * Calculates the value change (delta) resulting from an angular thumb movement.
 * - Right hand: sweeping upwards along natural thumb arc increases value; downwards decreases.
 * - Left hand: sweeping upwards along natural thumb arc increases value; downwards decreases.
 */
export function calculateArcDeltaValue(
  angularDeltaRad: number,
  config: ThumbArcConfig,
  angularVelocityRadPerSec: number = 0,
): number {
  const directionMultiplier = config.handMode === 'right' ? 1 : -1;
  const rawDirectionalDelta = angularDeltaRad * directionMultiplier;

  const isFast = Math.abs(angularVelocityRadPerSec) >= config.fastAngularVelocityThreshold;
  const speedMultiplier = isFast ? config.fastMultiplier : 1;

  const continuousDelta = rawDirectionalDelta * config.mmPerRadian * speedMultiplier;
  return continuousDelta;
}

/**
 * Clamps a numeric value between [min, max] and rounds it to the nearest step increment.
 */
export function clampAndStepValue(
  value: number,
  min: number,
  max: number,
  step: number = 1,
): number {
  if (min > max) {
    throw new Error(`Invalid bounds: min (${min}) cannot be greater than max (${max})`);
  }
  const safeStep = Math.max(0.001, step);
  const clamped = Math.max(min, Math.min(max, value));
  const stepped = Math.round((clamped - min) / safeStep) * safeStep + min;

  // Round to 3 decimal places to prevent floating point inaccuracies
  return Math.round(Math.max(min, Math.min(max, stepped)) * 1000) / 1000;
}

/**
 * Evaluates whether haptic feedback should trigger when transitioning from oldValue to newValue.
 */
export function evaluateHapticFeedback(
  oldValue: number,
  newValue: number,
  config: Pick<ThumbArcConfig, 'majorTickInterval' | 'minorTickInterval'> = DEFAULT_THUMB_ARC_CONFIG,
): HapticType {
  const minVal = Math.min(oldValue, newValue);
  const maxVal = Math.max(oldValue, newValue);

  if (minVal === maxVal) return 'none';

  // Check if a major interval was crossed
  const prevMajor = Math.floor(oldValue / config.majorTickInterval);
  const nextMajor = Math.floor(newValue / config.majorTickInterval);
  if (prevMajor !== nextMajor) {
    return 'major';
  }

  // Check if a minor interval was crossed
  const prevMinor = Math.floor(oldValue / config.minorTickInterval);
  const nextMinor = Math.floor(newValue / config.minorTickInterval);
  if (prevMinor !== nextMinor) {
    return 'tick';
  }

  return 'none';
}

/**
 * Triggers physical vibration on devices supporting the Vibration API.
 */
export function triggerHaptic(type: HapticType): void {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;

  if (type === 'major') {
    navigator.vibrate(25);
  } else if (type === 'tick') {
    navigator.vibrate(10);
  }
}

/**
 * Arc geometry parameters for rendering an SVG visual track representing thumb zone.
 */
export interface ArcSvgTrack {
  pathD: string;
  startPoint: Point2D;
  endPoint: Point2D;
  center: Point2D;
  radius: number;
}

/**
 * Computes SVG arc path for the thumb zone based on container dimensions and hand mode.
 */
export function computeThumbArcSvgPath(
  containerWidth: number,
  containerHeight: number,
  handMode: HandMode,
  radius: number = 240,
): ArcSvgTrack {
  const pivot = getThumbPivotPoint(containerWidth, containerHeight, handMode, 20);

  // Angular span for thumb reach:
  // Right hand: spans from approx -165 deg (facing left-up) to -105 deg (facing straight up)
  // Left hand: spans from approx -15 deg (facing right-up) to -75 deg (facing straight up)
  const [startAngleDeg, endAngleDeg] = handMode === 'right' ? [-165, -105] : [-75, -15];

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const startRad = toRad(startAngleDeg);
  const endRad = toRad(endAngleDeg);

  const startPoint: Point2D = {
    x: pivot.x + radius * Math.cos(startRad),
    y: pivot.y + radius * Math.sin(startRad),
  };

  const endPoint: Point2D = {
    x: pivot.x + radius * Math.cos(endRad),
    y: pivot.y + radius * Math.sin(endRad),
  };

  const pathD = `M ${startPoint.x.toFixed(1)} ${startPoint.y.toFixed(1)} A ${radius} ${radius} 0 0 1 ${endPoint.x.toFixed(1)} ${endPoint.y.toFixed(1)}`;

  return {
    pathD,
    startPoint,
    endPoint,
    center: pivot,
    radius,
  };
}
