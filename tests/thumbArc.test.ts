import { describe, it, expect } from 'vitest';
import {
  calculatePointAngle,
  normalizeAngularDelta,
  getThumbPivotPoint,
  calculateArcDeltaValue,
  clampAndStepValue,
  evaluateHapticFeedback,
  computeThumbArcSvgPath,
  DEFAULT_THUMB_ARC_CONFIG,
} from '../src/resolver';

describe('ThumbArc Mathematical Resolver (Modo Obra)', () => {
  describe('Angle and Delta Normalization', () => {
    it('calculates point angle correctly relative to pivot', () => {
      const pivot = { x: 300, y: 600 };
      // Directly above pivot
      const pointAbove = { x: 300, y: 500 };
      expect(calculatePointAngle(pointAbove, pivot)).toBeCloseTo(-Math.PI / 2);

      // Directly to the left of pivot
      const pointLeft = { x: 200, y: 600 };
      expect(calculatePointAngle(pointLeft, pivot)).toBeCloseTo(Math.PI);
    });

    it('normalizes angular delta across wrap-around boundaries', () => {
      // Small continuous counter-clockwise movement across PI / -PI
      const angle1 = 3.10;
      const angle2 = -3.10;
      const delta = normalizeAngularDelta(angle1, angle2);
      expect(delta).toBeGreaterThan(0);
      expect(delta).toBeCloseTo((Math.PI - 3.10) + (Math.PI - 3.10), 2);

      // Reverse direction
      const reverseDelta = normalizeAngularDelta(angle2, angle1);
      expect(reverseDelta).toBeLessThan(0);
      expect(reverseDelta).toBeCloseTo(-delta, 2);
    });
  });

  describe('Thumb Pivot Determination', () => {
    it('positions pivot based on hand mode and container dimensions', () => {
      const width = 360;
      const height = 640;

      const rightPivot = getThumbPivotPoint(width, height, 'right', 25);
      expect(rightPivot.x).toBe(360 + 25);
      expect(rightPivot.y).toBe(640 + 25);

      const leftPivot = getThumbPivotPoint(width, height, 'left', 25);
      expect(leftPivot.x).toBe(-25);
      expect(leftPivot.y).toBe(640 + 25);
    });
  });

  describe('Value Delta and Direction Calculation', () => {
    it('increases value when right thumb sweeps upward along natural arc', () => {
      const config = { ...DEFAULT_THUMB_ARC_CONFIG, handMode: 'right' as const };
      // Upward sweep from bottom-left to top is positive angle delta
      const deltaRad = 0.1;
      const deltaVal = calculateArcDeltaValue(deltaRad, config, 1.0);
      expect(deltaVal).toBeGreaterThan(0);
      expect(deltaVal).toBeCloseTo(0.1 * config.mmPerRadian, 1);

      // Downward sweep decreases value
      const reverseDelta = calculateArcDeltaValue(-0.1, config, 1.0);
      expect(reverseDelta).toBeLessThan(0);
      expect(reverseDelta).toBeCloseTo(-0.1 * config.mmPerRadian, 1);
    });

    it('increases value when left thumb sweeps upward along natural arc', () => {
      const config = { ...DEFAULT_THUMB_ARC_CONFIG, handMode: 'left' as const };
      // Upward sweep from bottom-right to top is negative angle delta
      const deltaRad = -0.1;
      const deltaVal = calculateArcDeltaValue(deltaRad, config, 1.0);
      expect(deltaVal).toBeGreaterThan(0);
      expect(deltaVal).toBeCloseTo(0.1 * config.mmPerRadian, 1);

      // Downward sweep decreases value
      const reverseDelta = calculateArcDeltaValue(0.1, config, 1.0);
      expect(reverseDelta).toBeLessThan(0);
      expect(reverseDelta).toBeCloseTo(-0.1 * config.mmPerRadian, 1);
    });

    it('applies fast velocity multiplier when movement exceeds threshold', () => {
      const config = {
        ...DEFAULT_THUMB_ARC_CONFIG,
        fastAngularVelocityThreshold: 3.0,
        fastMultiplier: 4,
        handMode: 'right' as const,
      };

      const normalDelta = calculateArcDeltaValue(0.1, config, 1.5);
      const fastDelta = calculateArcDeltaValue(0.1, config, 4.5);

      expect(fastDelta).toBeCloseTo(normalDelta * 4, 1);
    });
  });

  describe('Value Clamping and Stepping', () => {
    it('clamps values strictly within min and max bounds', () => {
      expect(clampAndStepValue(10, 50, 1000, 1)).toBe(50);
      expect(clampAndStepValue(1200, 50, 1000, 1)).toBe(1000);
      expect(clampAndStepValue(600, 50, 1000, 1)).toBe(600);
    });

    it('quantizes to specified step increment', () => {
      expect(clampAndStepValue(603.4, 0, 1000, 5)).toBe(605);
      expect(clampAndStepValue(602.1, 0, 1000, 5)).toBe(600);
      expect(clampAndStepValue(750.6, 0, 1000, 1)).toBe(751);
    });

    it('throws error when min is greater than max', () => {
      expect(() => clampAndStepValue(100, 500, 200, 1)).toThrow();
    });
  });

  describe('Haptic Feedback Evaluation', () => {
    it('returns none when value does not cross boundary or is unchanged', () => {
      expect(evaluateHapticFeedback(601, 603)).toBe('none');
      expect(evaluateHapticFeedback(600, 600)).toBe('none');
    });

    it('returns tick when crossing a minor 10 mm boundary', () => {
      expect(evaluateHapticFeedback(608, 612)).toBe('tick');
      expect(evaluateHapticFeedback(619, 621)).toBe('tick');
    });

    it('returns major when crossing a major 100 mm boundary', () => {
      expect(evaluateHapticFeedback(695, 705)).toBe('major');
      expect(evaluateHapticFeedback(802, 798)).toBe('major');
    });
  });

  describe('SVG Arc Path Computation', () => {
    it('generates valid SVG path for right hand thumb zone', () => {
      const arc = computeThumbArcSvgPath(360, 640, 'right', 220);
      expect(arc.pathD).toMatch(/^M \d+(\.\d+)? \d+(\.\d+)? A 220 220 0 0 1 \d+(\.\d+)? \d+(\.\d+)?$/);
      expect(arc.center.x).toBeGreaterThan(360);
      expect(arc.center.y).toBeGreaterThan(640);
    });

    it('generates valid SVG path for left hand thumb zone', () => {
      const arc = computeThumbArcSvgPath(360, 640, 'left', 220);
      expect(arc.pathD).toMatch(/^M \d+(\.\d+)? \d+(\.\d+)? A 220 220 0 0 1 \d+(\.\d+)? \d+(\.\d+)?$/);
      expect(arc.center.x).toBeLessThan(0);
      expect(arc.center.y).toBeGreaterThan(640);
    });
  });
});
