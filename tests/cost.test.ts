import { describe, it, expect } from 'vitest';
import {
  calculateModuleCost,
  type BillOfMaterials,
} from '../src/resolver';
import type { NestingResult } from '../src/workers';
import type { Material, EdgeBand, Hardware } from '../src/model';
import { getSeedHardware } from '../src/catalog';

describe('Module Cost Calculator', () => {
  const sampleBOM: BillOfMaterials = {
    moduleId: 'cabinet-1',
    pieces: [],
    totalPieceCount: 3,
    totalCutAreaM2: 1.5,
    edgeBands: [
      { edgeBandId: 'eb-white-08', kind: 'adhesive', lengthMm: 2000, lengthMeters: 2.0 },
    ],
    totalEdgeBandMeters: 2.0,
    hardware: [
      { hardwareId: 'hw-confirmat-7x50', name: 'Confirmat Screw', jointKind: 'confirmat', count: 4 },
    ],
    totalHardwareCount: 4,
  };

  const sampleNesting: NestingResult = {
    sheets: [
      {
        sheetIndex: 0,
        materialId: 'mat-egger-white-18',
        sheetLengthMm: 2800,
        sheetWidthMm: 2070,
        placedPieces: [],
        utilizationPercentage: 45,
        usedAreaM2: 1.5,
        wasteAreaM2: 4.29,
      },
    ],
    unplacedPieces: [],
    totalSheets: 1,
    overallUtilizationPercentage: 45,
  };

  it('calculates totals correctly when all prices are confirmed numbers', () => {
    const confirmedMaterials: Material[] = [
      {
        schemaVersion: 1,
        id: 'mat-egger-white-18',
        name: 'Egger White 18mm',
        thicknessMm: 18,
        sheetSizeMm: { length: 2800, width: 2070 },
        hasGrain: false,
        milling: { hidden: 'yes', visible: 'no', onStructuralPiece: 'limited' },
        pricePerSheet: 65.5,
      },
    ];

    const confirmedEdgeBands: EdgeBand[] = [
      {
        schemaVersion: 1,
        id: 'eb-white-08',
        kind: 'adhesive',
        thicknessMm: 0.8,
        pricePerMeter: 1.25,
      },
    ];

    const confirmedHardware: Hardware[] = [
      {
        schemaVersion: 1,
        id: 'hw-confirmat-7x50',
        name: 'Confirmat Screw 7x50mm',
        jointKind: 'confirmat',
        pricePerUnit: 0.2,
      },
    ];

    const cost = calculateModuleCost({
      bom: sampleBOM,
      nestingResult: sampleNesting,
      materials: confirmedMaterials,
      edgeBands: confirmedEdgeBands,
      hardware: confirmedHardware,
    });

    expect(cost.isFullyConfirmed).toBe(true);
    // 1 sheet * 65.50 = 65.50
    expect(cost.materialTotal).toBe(65.5);
    // 2.0 meters * 1.25 = 2.50
    expect(cost.edgeBandTotal).toBe(2.5);
    // 4 screws * 0.20 = 0.80
    expect(cost.hardwareTotal).toBe(0.8);
    // Grand total: 65.50 + 2.50 + 0.80 = 68.80
    expect(cost.grandTotal).toBe(68.8);
  });

  it('reports TO_CONFIRM when catalog prices are unconfirmed', () => {
    const unconfirmedMaterials: Material[] = [
      {
        schemaVersion: 1,
        id: 'mat-egger-white-18',
        name: 'Egger White 18mm',
        thicknessMm: 18,
        sheetSizeMm: { length: 2800, width: 2070 },
        hasGrain: false,
        milling: { hidden: 'yes', visible: 'no', onStructuralPiece: 'limited' },
        pricePerSheet: 'TO_CONFIRM',
      },
    ];

    const unconfirmedEdgeBands: EdgeBand[] = [
      {
        schemaVersion: 1,
        id: 'eb-white-08',
        kind: 'adhesive',
        thicknessMm: 0.8,
        pricePerMeter: 'TO_CONFIRM',
      },
    ];

    const unconfirmedHardware: Hardware[] = [
      {
        schemaVersion: 1,
        id: 'hw-confirmat-7x50',
        name: 'Confirmat Screw 7x50mm',
        jointKind: 'confirmat',
        pricePerUnit: 'TO_CONFIRM',
      },
    ];

    const cost = calculateModuleCost({
      bom: sampleBOM,
      nestingResult: sampleNesting,
      materials: unconfirmedMaterials,
      edgeBands: unconfirmedEdgeBands,
      hardware: unconfirmedHardware,
    });

    expect(cost.isFullyConfirmed).toBe(false);
    expect(cost.materialTotal).toBe('TO_CONFIRM');
    expect(cost.edgeBandTotal).toBe('TO_CONFIRM');
    expect(cost.hardwareTotal).toBe('TO_CONFIRM');
    expect(cost.grandTotal).toBe('TO_CONFIRM');
    expect(cost.confirmedSubtotal).toBe(0);
  });

  it('loads seed hardware catalog without errors', () => {
    const hardwareCatalog = getSeedHardware();
    expect(hardwareCatalog.schemaVersion).toBe(1);
    expect(hardwareCatalog.hardware.length).toBeGreaterThanOrEqual(3);
    const confirmat = hardwareCatalog.hardware.find((h) => h.id === 'hw-confirmat-7x50');
    expect(confirmat).toBeDefined();
    expect(confirmat?.pricePerUnit).toBe('TO_CONFIRM');
  });
});
