import { describe, it, expect } from 'vitest';
import { resolveCarcass } from '../src/resolver/composition/anchorSolver';
import { buildModularModule } from '../src/resolver/composition/compositionEngine';

describe('Base Structure Carcass Extensions (Point 7)', () => {
  it('resolves vertical stretchers (fajas de canto)', () => {
    const res = resolveCarcass({
      carcass: {
        width: 800,
        height: 720,
        depth: 580,
        jointPriority: 'lateral-over-bottom',
        roofType: 'front-back-rails',
        railWidthMm: 80,
        railOrientation: 'vertical',
      },
      carcassMaterialId: 'm-mel-white-18',
      carcassThicknessMm: 18,
    });

    const frontRail = res.pieces.find((p) => p.role === 'rail-vertical');
    expect(frontRail).toBeDefined();
    expect(frontRail?.contour.points[1]?.x).toBe(800 - 36); // interiorWidth = 764
    expect(frontRail?.contour.points[2]?.y).toBe(80); // railWidthMm = 80
  });

  it('resolves middle structural cross-brace between rails', () => {
    const res = resolveCarcass({
      carcass: {
        width: 1000,
        height: 800,
        depth: 600,
        jointPriority: 'lateral-over-bottom',
        roofType: 'front-back-rails',
        railWidthMm: 80,
        hasMiddleBrace: true,
        middleBraceWidthMm: 100,
      },
      carcassMaterialId: 'm-mel-white-18',
      carcassThicknessMm: 18,
    });

    const middleBrace = res.pieces.find((p) => p.role === 'brace-middle');
    expect(middleBrace).toBeDefined();
    // Length fits between rails: 600 - 2 * 80 = 440
    expect(middleBrace?.contour.points[1]?.x).toBe(440);
    expect(middleBrace?.contour.points[2]?.y).toBe(100);
  });

  it('resolves rear wall hanging rail', () => {
    const res = resolveCarcass({
      carcass: {
        width: 600,
        height: 600,
        depth: 320,
        jointPriority: 'lateral-over-bottom',
        roofType: 'solid-panel',
        hasWallHangingRail: true,
        wallHangingRailWidthMm: 90,
      },
      carcassMaterialId: 'm-mel-white-18',
      carcassThicknessMm: 18,
    });

    const hangingRail = res.pieces.find((p) => p.role === 'hanging-rail');
    expect(hangingRail).toBeDefined();
    expect(hangingRail?.contour.points[1]?.x).toBe(600 - 36);
    expect(hangingRail?.contour.points[2]?.y).toBe(90);
  });

  it('resolves integrated plinth (zócalo) elevating interior cavity', () => {
    const res = resolveCarcass({
      carcass: {
        width: 800,
        height: 850,
        depth: 550,
        jointPriority: 'lateral-over-bottom',
        roofType: 'front-back-rails',
        hasPlinth: true,
        plinthHeightMm: 100,
        plinthSetbackMm: 50,
      },
      carcassMaterialId: 'm-mel-white-18',
      carcassThicknessMm: 18,
    });

    const plinthPiece = res.pieces.find((p) => p.role === 'plinth-front');
    expect(plinthPiece).toBeDefined();
    expect(plinthPiece?.contour.points[1]?.x).toBe(800 - 36);
    expect(plinthPiece?.contour.points[2]?.y).toBe(100);

    // Interior cavity is elevated above the 100mm plinth + bottom thickness 18mm
    expect(res.interior.y).toBe(118);
    // Height is reduced by plinth height
    expect(res.interior.height).toBe(850 - 36 - 100);
  });

  it('builds modular module with custom carcass structure end-to-end', () => {
    const output = buildModularModule({
      id: 'custom-base-cabinet',
      carcass: {
        width: 900,
        height: 860,
        depth: 580,
        jointPriority: 'lateral-over-bottom',
        roofType: 'front-back-rails',
        railOrientation: 'vertical',
        hasMiddleBrace: true,
        hasWallHangingRail: true,
        hasPlinth: true,
        plinthHeightMm: 100,
      },
      bays: [{ type: 'empty' }],
      materials: {
        carcassMaterialId: 'm-mel-white-18',
        frontsMaterialId: 'm-mel-white-18',
        drawerBoxesMaterialId: 'm-mel-white-18',
        backingsMaterialId: 'm-mdf-white-3',
      },
    });

    expect(output.module.pieces.length).toBeGreaterThanOrEqual(7);
    const roles = output.module.pieces.map((p) => p.role);
    expect(roles).toContain('plinth-front');
    expect(roles).toContain('rail-vertical');
    expect(roles).toContain('brace-middle');
    expect(roles).toContain('hanging-rail');
  });
});
