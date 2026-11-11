import { describe, it, expect } from 'vitest';
import {
  resolveNonOverlappingLabels,
  hasNoLabelCollisions,
  type RawOperationLabel,
} from '../src/ui/viewer/labelLayout';

describe('labelLayout non-overlapping coordinate resolution', () => {
  it('returns empty array when given no operations', () => {
    const result = resolveNonOverlappingLabels([]);
    expect(result).toEqual([]);
    expect(hasNoLabelCollisions(result)).toBe(true);
  });

  it('preserves single operation position without stagger', () => {
    const labels: RawOperationLabel[] = [
      { id: '1', x: 100, y: 150, text: 'Y=150 (X=100)' },
    ];
    const result = resolveNonOverlappingLabels(labels);
    expect(result).toHaveLength(1);
    expect(result[0]!.renderedX).toBe(100);
    expect(result[0]!.renderedY).toBe(150);
    expect(result[0]!.staggerLevel).toBe(0);
    expect(hasNoLabelCollisions(result)).toBe(true);
  });

  it('keeps distant operations at baseline level 0', () => {
    const labels: RawOperationLabel[] = [
      { id: '1', x: 50, y: 50, text: 'Y=50 (X=50)' },
      { id: '2', x: 50, y: 250, text: 'Y=250 (X=50)' },
      { id: '3', x: 300, y: 50, text: 'Y=50 (X=300)' },
    ];
    const result = resolveNonOverlappingLabels(labels, 14, 85);
    expect(result.every((r) => r.staggerLevel === 0)).toBe(true);
    expect(hasNoLabelCollisions(result, 60, 10)).toBe(true);
  });

  it('staggers vertically adjacent operations to eliminate label collision', () => {
    // Two shelf holes or confirmat screws along X=37 at Y=50 and Y=58 (deltaY = 8, collision threshold = 14)
    const labels: RawOperationLabel[] = [
      { id: 'hole-1', x: 37, y: 50, text: 'Y=50 (X=37)' },
      { id: 'hole-2', x: 37, y: 58, text: 'Y=58 (X=37)' },
    ];

    const result = resolveNonOverlappingLabels(labels, 14, 85);
    expect(result).toHaveLength(2);

    // Stagger level must differ
    expect(result[0]!.staggerLevel !== result[1]!.staggerLevel).toBe(true);

    // Rendered Y positions must maintain at least minSpacingY
    const deltaY = Math.abs(result[0]!.renderedY - result[1]!.renderedY);
    expect(deltaY).toBeGreaterThanOrEqual(14);

    // Verification check
    expect(hasNoLabelCollisions(result, 60, 10)).toBe(true);
  });

  it('resolves dense 3-hole cluster without overlap', () => {
    // 3 holes close to each other in vertical stack (e.g., 32mm system cabinet drilling)
    const labels: RawOperationLabel[] = [
      { id: 'h1', x: 60, y: 100, text: 'Y=100 (X=60)' },
      { id: 'h2', x: 60, y: 106, text: 'Y=106 (X=60)' },
      { id: 'h3', x: 60, y: 112, text: 'Y=112 (X=60)' },
    ];

    const result = resolveNonOverlappingLabels(labels, 14, 85);
    expect(result).toHaveLength(3);
    expect(hasNoLabelCollisions(result, 60, 10)).toBe(true);
  });

  it('handles slide guide line operations alongside discrete drillings', () => {
    const labels: RawOperationLabel[] = [
      { id: 'slide-1', x: 80, y: 120, text: 'Guía corredera Y = 120 mm', isSlide: true },
      { id: 'drill-1', x: 80, y: 126, text: 'Y=126 (X=80)' },
    ];

    const result = resolveNonOverlappingLabels(labels, 14, 85);
    expect(result).toHaveLength(2);
    expect(hasNoLabelCollisions(result, 60, 10)).toBe(true);
  });

  it('preserves exact input ordering when labels have scrambled Y coordinates', () => {
    // Top-most operation first in input, bottom-most second
    const labels: RawOperationLabel[] = [
      { id: 'top-hole', x: 100, y: 711, text: 'Y=711 (X=100)' },
      { id: 'bottom-hole', x: 100, y: 9, text: 'Y=9 (X=100)' },
    ];

    const result = resolveNonOverlappingLabels(labels, 14, 85);
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('top-hole');
    expect(result[0]!.renderedY).toBe(711);
    expect(result[1]!.id).toBe('bottom-hole');
    expect(result[1]!.renderedY).toBe(9);
  });

  it('avoids collision with exclusion boxes (e.g. Datum note mark) by staying clear of the box', () => {
    const labels: RawOperationLabel[] = [
      { id: 'bottom-drill', x: 50, y: 275, text: 'Y=9 (X=50)' },
    ];
    const exclusionBoxes = [
      { id: 'datum-box', x: 50, y: 270, width: 120, height: 20 },
    ];

    const result = resolveNonOverlappingLabels(labels, 14, 85, exclusionBoxes, 268);
    expect(result).toHaveLength(1);
    // Rendered Y must be pushed upwards clear of the exclusion box and capped at maxY
    expect(result[0]!.renderedY).toBeLessThanOrEqual(256);
  });
});
