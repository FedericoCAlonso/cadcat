import { describe, it, expect } from 'vitest';
import { ShelvesBayResolver } from '../src/resolver/composition/resolvers/shelvesBayResolver';
import { type BayBoundingBox, type TrackSize } from '../src/resolver/composition/types';

describe('ShelvesBayResolver with Parametric Tracks (Point 2)', () => {
  const resolver = new ShelvesBayResolver();

  const mockBay: BayBoundingBox = {
    bayIndex: 0,
    x: 18,
    y: 18,
    z: 0,
    width: 600,
    height: 700,
    depth: 500,
    leftPieceId: 'side-left',
    rightPieceId: 'side-right',
    bottomPieceId: 'bottom',
    topPieceId: 'top',
  };

  const mockMaterials = {
    carcassMaterialId: 'mdf-18',
    frontsMaterialId: 'mdf-18',
    drawerBoxesMaterialId: 'mdf-15',
    backingsMaterialId: 'mdf-3',
  };

  const mockOptions = {
    carcassThicknessMm: 18,
    edgeBandId: 'pvc-0.45',
    rootPieceId: 'side-left',
  };

  it('resolves shelves with default equal fractional tracks when shelfTracks is undefined (backward compatibility)', () => {
    const result = resolver.resolve({
      bay: mockBay,
      content: {
        type: 'shelves',
        count: 1,
        shelfType: 'adjustable',
        setbackMm: 20,
      },
      materials: mockMaterials,
      options: mockOptions,
    });

    expect(result.pieces).toHaveLength(1);
    expect(result.placementNodes).toHaveLength(1);

    // Available height: 700. T = 18. Remaining space = 682.
    // Track 0 = 341 mm. Divider 0 offset = 341 mm.
    // Elevation = bay.y (18) + 341 = 359 mm.
    const shelfNode = result.placementNodes[0]!;
    expect(shelfNode.relativeOffset.y).toBe(18 + 341);
  });

  it('resolves shelf with custom fixed metric track (e.g. 300mm fixed bottom opening)', () => {
    const tracks: TrackSize[] = [
      { type: 'fixed', valueMm: 300 },
      { type: 'fractional', valueFr: 1 },
    ];

    const result = resolver.resolve({
      bay: mockBay,
      content: {
        type: 'shelves',
        count: 1,
        shelfType: 'fixed',
        setbackMm: 20,
        shelfTracks: tracks,
      },
      materials: mockMaterials,
      options: mockOptions,
    });

    expect(result.pieces).toHaveLength(1);
    expect(result.placementNodes).toHaveLength(1);

    // Shelf sits exactly at bay.y + 300 mm
    const shelfNode = result.placementNodes[0]!;
    expect(shelfNode.relativeOffset.y).toBe(18 + 300);
  });

  it('resolves 2 shelves with 3 mixed tracks', () => {
    const tracks: TrackSize[] = [
      { type: 'fixed', valueMm: 250 },
      { type: 'fractional', valueFr: 1 },
      { type: 'fractional', valueFr: 1 },
    ];

    const result = resolver.resolve({
      bay: mockBay,
      content: {
        type: 'shelves',
        count: 2,
        shelfType: 'adjustable',
        shelfTracks: tracks,
      },
      materials: mockMaterials,
      options: mockOptions,
    });

    expect(result.pieces).toHaveLength(2);
    expect(result.placementNodes).toHaveLength(2);

    // Shelf 1 sits at bay.y + 250
    expect(result.placementNodes[0]!.relativeOffset.y).toBe(18 + 250);

    // Total divider space = 2 * 18 = 36.
    // Fixed = 250.
    // Remaining for 2fr = 700 - 36 - 250 = 414 mm -> 207 mm each.
    // Shelf 2 sits at 18 + 250 + 18 + 207 = 493 mm.
    expect(result.placementNodes[1]!.relativeOffset.y).toBe(18 + 250 + 18 + 207);
  });

  it('returns empty result when count is 0 and no tracks are defined', () => {
    const result = resolver.resolve({
      bay: mockBay,
      content: {
        type: 'shelves',
        count: 0,
        shelfType: 'adjustable',
      },
      materials: mockMaterials,
      options: mockOptions,
    });

    expect(result.pieces).toHaveLength(0);
    expect(result.joints).toHaveLength(0);
    expect(result.placementNodes).toHaveLength(0);
  });
});
