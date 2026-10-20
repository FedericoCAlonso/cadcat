import { describe, it, expect } from 'vitest';
import {
  calculatePointAngle,
  normalizeAngularDelta,
  getThumbPivotPoint,
  calculateArcDeltaValue,
  clampAndStepValue,
  evaluateHapticFeedback,
  computeThumbArcSvgPath,
  isPointOnThumbArc,
  isPointOnKnob,
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

  describe('Thumb Arc Hit-Testing (isPointOnThumbArc)', () => {
    const W = 360;
    const H = 270;
    const radius = 275;

    it('returns true when touch point is on the right-hand arc track', () => {
      // Pivot for right hand: (360 + 20, 270 + 20) = (380, 290)
      // Point at 135 deg (-135 deg): x = 380 + 275 * cos(-135 deg) = 380 - 194.45 = 185.5
      // y = 290 + 275 * sin(-135 deg) = 290 - 194.45 = 95.5
      const pointOnArc = { x: 185.5, y: 95.5 };
      expect(isPointOnThumbArc(pointOnArc, W, H, 'right', { radius })).toBe(true);

      // Point near start of arc (-165 deg): x = 380 + 275 * cos(-165) = 114.4, y = 290 + 275 * sin(-165) = 218.8
      const pointNearStart = { x: 114.4, y: 218.8 };
      expect(isPointOnThumbArc(pointNearStart, W, H, 'right', { radius })).toBe(true);

      // Point near end of arc (-105 deg): x = 380 + 275 * cos(-105) = 308.8, y = 290 + 275 * sin(-105) = 24.4
      const pointNearEnd = { x: 308.8, y: 24.4 };
      expect(isPointOnThumbArc(pointNearEnd, W, H, 'right', { radius })).toBe(true);
    });

    it('returns false when touch point is outside the arc (empty center or corners)', () => {
      // Center of card: (180, 200) -> distance to pivot (380, 290) is sqrt(200^2 + 90^2) = 219.3 px (|219.3 - 275| = 55.7 > 40)
      expect(isPointOnThumbArc({ x: 180, y: 200 }, W, H, 'right', { radius })).toBe(false);

      // Top-left corner: (20, 20) -> distance to pivot is sqrt(360^2 + 270^2) = 450 px
      expect(isPointOnThumbArc({ x: 20, y: 20 }, W, H, 'right', { radius })).toBe(false);

      // Far right-bottom corner near pivot: (350, 250)
      expect(isPointOnThumbArc({ x: 350, y: 250 }, W, H, 'right', { radius })).toBe(false);
    });

    it('returns true when touch point is on the left-hand arc track', () => {
      // Left-hand pivot: (-20, 290)
      // Point at -45 deg: x = -20 + 275 * cos(-45 deg) = -20 + 194.45 = 174.5, y = 290 - 194.45 = 95.5
      const pointOnLeftArc = { x: 174.5, y: 95.5 };
      expect(isPointOnThumbArc(pointOnLeftArc, W, H, 'left', { radius })).toBe(true);
    });
  });

  describe('Knob Area Hit-Testing (isPointOnKnob)', () => {
    const knobCenter = { x: 150, y: 150 };

    it('returns true when point is within 35px radius of knob center', () => {
      expect(isPointOnKnob({ x: 150, y: 150 }, knobCenter, 35)).toBe(true);
      expect(isPointOnKnob({ x: 170, y: 150 }, knobCenter, 35)).toBe(true);
      expect(isPointOnKnob({ x: 150, y: 180 }, knobCenter, 35)).toBe(true);
      expect(isPointOnKnob({ x: 174, y: 174 }, knobCenter, 35)).toBe(true); // hypot(24, 24) = 33.94 <= 35
    });

    it('returns false when point is beyond 35px radius', () => {
      expect(isPointOnKnob({ x: 150, y: 190 }, knobCenter, 35)).toBe(false); // 40px away
      expect(isPointOnKnob({ x: 100, y: 150 }, knobCenter, 35)).toBe(false); // 50px away
    });
  });
});
