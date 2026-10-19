import { describe, it, expect } from 'vitest';
import { getSeedMaterials, getSeedEdgeBands } from '../src/catalog';

describe('Seed Catalogs', () => {
  it('loads and validates seed materials catalog', () => {
    const catalog = getSeedMaterials();

    expect(catalog.schemaVersion).toBe(1);
    expect(catalog.materials).toHaveLength(5);

    const whiteBoard = catalog.materials.find((m) => m.id === 'mat-egger-white-18');
    expect(whiteBoard).toBeDefined();
    expect(whiteBoard?.name).toContain('White');
    expect(whiteBoard?.thicknessMm).toBe(18);
    expect(whiteBoard?.sheetSizeMm.length).toBe(2800);
    expect(whiteBoard?.sheetSizeMm.width).toBe(2070);
    expect(whiteBoard?.milling.maxDepthMm).toBe('TO_CONFIRM');
    expect(whiteBoard?.pricePerSheet).toBe('TO_CONFIRM');

    const oakBoard = catalog.materials.find((m) => m.id === 'mat-egger-oak-18');
    expect(oakBoard).toBeDefined();
    expect(oakBoard?.name).toContain('Oak');
    expect(oakBoard?.hasGrain).toBe(true);
    expect(oakBoard?.pricePerSheet).toBe('TO_CONFIRM');

    const mdfWhiteBacking = catalog.materials.find((m) => m.id === 'mat-mdf-white-3');
    expect(mdfWhiteBacking).toBeDefined();
    expect(mdfWhiteBacking?.thicknessMm).toBe(3);

    const mdfRaw3 = catalog.materials.find((m) => m.id === 'mat-mdf-raw-3');
    expect(mdfRaw3).toBeDefined();
    expect(mdfRaw3?.name).toContain('Crudo');
    expect(mdfRaw3?.thicknessMm).toBe(3);

    const mdfRaw6 = catalog.materials.find((m) => m.id === 'mat-mdf-raw-6');
    expect(mdfRaw6).toBeDefined();
    expect(mdfRaw6?.name).toContain('Crudo');
    expect(mdfRaw6?.thicknessMm).toBe(6);
  });

  it('loads and validates seed edge bands catalog', () => {
    const catalog = getSeedEdgeBands();

    expect(catalog.schemaVersion).toBe(1);
    expect(catalog.edgeBands).toHaveLength(2);

    const whiteBand = catalog.edgeBands.find((eb) => eb.id === 'eb-white-08');
    expect(whiteBand).toBeDefined();
    expect(whiteBand?.thicknessMm).toBe(0.8);
    expect(whiteBand?.pricePerMeter).toBe('TO_CONFIRM');

    const oakBand = catalog.edgeBands.find((eb) => eb.id === 'eb-oak-20');
    expect(oakBand).toBeDefined();
    expect(oakBand?.thicknessMm).toBe(2.0);
    expect(oakBand?.pricePerMeter).toBe('TO_CONFIRM');
  });
});
