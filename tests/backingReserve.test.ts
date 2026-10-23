import { describe, it, expect } from 'vitest';
import { resolveBackingReserveMm } from '../src/resolver/composition/backingReserve';
import { buildModularModule } from '../src/resolver/composition/compositionEngine';
import type { ModularModuleDefinition } from '../src/resolver/composition/types';

describe('resolveBackingReserveMm', () => {
  it('groove = distance + thickness, thick structural & overlay = thickness, none/island = 0', () => {
    expect(resolveBackingReserveMm({ hasBacking: true, backingType: 'groove', backingThicknessMm: 3 })).toBe(18);
    expect(resolveBackingReserveMm({ hasBacking: true, backingType: 'groove', backingThicknessMm: 5.5, backingGrooveDistanceMm: 10 })).toBe(15.5);
    expect(resolveBackingReserveMm({ hasBacking: true, backingType: 'groove', backingThicknessMm: 18 })).toBe(18);
    expect(resolveBackingReserveMm({ hasBacking: true, backingType: 'overlay', backingThicknessMm: 3 })).toBe(3);
    expect(resolveBackingReserveMm({ hasBacking: true, backingType: 'overlay', backingThicknessMm: 5.5 })).toBe(5.5);
    expect(resolveBackingReserveMm({ hasBacking: false })).toBe(0);
    expect(resolveBackingReserveMm({ hasBacking: true, isIslandCabinet: true })).toBe(0);
  });
});

const def = (over: Partial<ModularModuleDefinition['carcass']>, tracks = 1): ModularModuleDefinition => ({
  id: 'm',
  carcass: { width: 800, height: 720, depth: 500, jointPriority: 'lateral-over-bottom', roofType: 'solid-panel', hasBacking: true, backingType: 'groove', backingThicknessMm: 3, ...over },
  grid: tracks > 1
    ? { axis: 'horizontal', tracks: Array.from({ length: tracks }, () => ({ type: 'fractional' as const, valueFr: 1 })), dividerThicknessMm: 18 }
    : undefined,
  bays: Array.from({ length: tracks }, () => ({ type: 'empty' as const })),
  materials: { carcassMaterialId: 'c', frontsMaterialId: 'c', drawerBoxesMaterialId: 'c', backingsMaterialId: 'b' },
});

describe('interior equipment stops flush against the backing', () => {
  it('single bay: interior depth shrinks with the groove backing and follows thickness changes', () => {
    const a = buildModularModule(def({ backingThicknessMm: 3 }));
    const b = buildModularModule(def({ backingThicknessMm: 5.5 }));
    expect(a.bayBoxes![0]!.depth).toBe(500 - 18);
    expect(b.bayBoxes![0]!.depth).toBeCloseTo(500 - 20.5, 5);
  });

  it('two bays: each bay is delimited by its own backing across groove, overlay, and structural 18mm', () => {
    const grooveOut = buildModularModule(def({ backingType: 'groove', backingThicknessMm: 3 }, 2));
    expect(grooveOut.bayBoxes!.length).toBe(2);
    for (const bb of grooveOut.bayBoxes!) expect(bb.depth).toBe(500 - 18);
    expect(grooveOut.module.pieces.filter((p) => p.role === 'back').length).toBe(2);

    const overlayOut = buildModularModule(def({ backingType: 'overlay', backingThicknessMm: 3 }, 2));
    for (const bb of overlayOut.bayBoxes!) expect(bb.depth).toBe(500 - 3);
    expect(overlayOut.module.pieces.filter((p) => p.role === 'back').length).toBe(2);

    const thickOut = buildModularModule(def({ backingType: 'groove', backingThicknessMm: 18 }, 2));
    for (const bb of thickOut.bayBoxes!) expect(bb.depth).toBe(500 - 18);
    expect(thickOut.module.pieces.filter((p) => p.role === 'back').length).toBe(2);
  });

  it('structural 18mm backing and overlay deduct their thickness from usable bay depth', () => {
    expect(buildModularModule(def({ backingThicknessMm: 18 })).bayBoxes![0]!.depth).toBe(482);
    expect(buildModularModule(def({ backingType: 'overlay', backingThicknessMm: 3 })).bayBoxes![0]!.depth).toBe(497);
  });
});
