import { describe, it, expect } from 'vitest';
import {
  buildBaseCabinet,
  buildDrawerUnit,
  resolveModuleSpatialBoxes,
  calculateExplodedBoxes,
  determinePieceSpatialSize,
} from '../src/resolver';
import type { Material, EdgeBand } from '../src/model';

const testMaterial: Material = {
  schemaVersion: 1,
  id: 'mat-test-18',
  name: 'Melamine White 18mm',
  thicknessMm: 18,
  sheetSizeMm: { length: 2750, width: 1830 },
  hasGrain: false,
  milling: { hidden: 'yes', visible: 'no', onStructuralPiece: 'limited' },
};

const testEdgeBand: EdgeBand = {
  schemaVersion: 1,
  id: 'eb-test-08',
  kind: 'adhesive',
  thicknessMm: 0.8,
  pricePerMeter: 'TO_CONFIRM',
};

describe('3D Spatial Resolver (spatial3d)', () => {
  it('determines spatial dimensions according to piece role', () => {
    const { module } = buildBaseCabinet(
      { width: 600, height: 800, depth: 560 },
      testMaterial,
      [testEdgeBand],
    );

    const sideLeft = module.pieces.find((p) => p.role === 'side-left')!;
    const bottom = module.pieces.find((p) => p.role === 'bottom')!;
    const back = module.pieces.find((p) => p.role === 'back')!;

    const sideSize = determinePieceSpatialSize(sideLeft);
    expect(sideSize.x).toBe(18); // thickness along X
    expect(sideSize.y).toBe(800); // height along Y
    expect(sideSize.z).toBe(560); // depth along Z

    const bottomSize = determinePieceSpatialSize(bottom);
    expect(bottomSize.x).toBe(600 - 36); // inner width along X
    expect(bottomSize.y).toBe(18); // thickness along Y
    expect(bottomSize.z).toBe(560); // depth along Z

    const backSize = determinePieceSpatialSize(back);
    expect(backSize.x).toBe(600 - 36);
    expect(backSize.y).toBe(800 - 18);
    expect(backSize.z).toBe(18);
  });

  it('resolves bounding box and centers for base cabinet', () => {
    const built = buildBaseCabinet(
      { width: 600, height: 800, depth: 560 },
      testMaterial,
      [testEdgeBand],
    );

    const { boxes, bounds } = resolveModuleSpatialBoxes(
      built.module.pieces,
      built.placementTree,
    );

    expect(boxes.length).toBe(7);
    expect(bounds.size.x).toBe(600);
    expect(bounds.size.y).toBe(800);
    expect(bounds.size.z).toBeGreaterThanOrEqual(560);

    expect(bounds.min.x).toBe(0);
    expect(bounds.max.x).toBe(600);
  });

  it('computes exploded view offsets correctly', () => {
    const built = buildBaseCabinet(
      { width: 600, height: 800, depth: 560 },
      testMaterial,
      [testEdgeBand],
    );

    const { boxes, bounds } = resolveModuleSpatialBoxes(
      built.module.pieces,
      built.placementTree,
    );

    // At ratio 0: offsets are zero
    const assembled = calculateExplodedBoxes(boxes, bounds, 0);
    for (const b of assembled) {
      expect(b.explodedOffsetMm).toEqual({ x: 0, y: 0, z: 0 });
      expect(b.explodedPositionMm).toEqual(b.positionMm);
    }

    // At ratio 1: sides displace horizontally, back displaces backwards
    const exploded = calculateExplodedBoxes(boxes, bounds, 1.0, 100);
    const sideL = exploded.find((p) => p.role === 'side-left')!;
    const sideR = exploded.find((p) => p.role === 'side-right')!;
    const bottom = exploded.find((p) => p.role === 'bottom')!;
    const back = exploded.find((p) => p.role === 'back')!;

    expect(sideL.explodedOffsetMm.x).toBeLessThan(0);
    expect(sideR.explodedOffsetMm.x).toBeGreaterThan(0);
    expect(bottom.explodedOffsetMm.y).toBeLessThan(0);
    expect(back.explodedOffsetMm.z).toBeGreaterThan(0);
  });

  it('resolves drawer unit pieces in 3D and explodes drawer sub-assemblies forward', () => {
    const built = buildDrawerUnit(
      { width: 500, height: 750, depth: 500 },
      testMaterial,
      [testEdgeBand],
    );

    const { boxes, bounds } = resolveModuleSpatialBoxes(
      built.module.pieces,
      built.placementTree,
    );

    expect(boxes.length).toBeGreaterThan(15);
    expect(bounds.size.x).toBeGreaterThanOrEqual(500);

    const exploded = calculateExplodedBoxes(boxes, bounds, 0.5, 120);
    const drawerFront = exploded.find((p) => p.role === 'drawer-front')!;
    const drawerSide = exploded.find((p) => p.role === 'drawer-side')!;

    // Drawers move forward along negative Z
    expect(drawerFront.explodedOffsetMm.z).toBeLessThan(0);
    expect(drawerSide.explodedOffsetMm.z).toBeLessThan(0);
  });
});
