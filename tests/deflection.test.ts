import { describe, it, expect } from 'vitest';
import {
  calculateShelfDeflection,
  checkPieceDeflection,
  checkModuleShelvesDeflection,
  DEFAULT_ELASTIC_MODULUS_MPA,
  type ShelfDeflectionInput,
} from '../src/resolver/deflection';
import { type Material } from '../src/model';
import { type ResolvedPieceWithCutSize } from '../src/resolver/edgeBand';
import { createPiece, createRectangularContour } from '../src/resolver/piece';

const mockMaterial: Material = {
  id: 'mat-egger-white-18',
  name: 'Egger White 18mm',
  thicknessMm: 18,
  sheetSizeMm: { length: 2800, width: 2070 },
  hasGrain: false,
  milling: {
    hidden: 'yes',
    visible: 'no',
    onStructuralPiece: 'limited',
  },
  elasticModulusMPa: 'TO_CONFIRM',
};

const mockMaterialWithConfirmedE: Material = {
  ...mockMaterial,
  id: 'mat-confirmed-e',
  elasticModulusMPa: 3500,
};

function createMockShelfPiece(
  id: string,
  width: number,
  depth: number,
  thickness = 18,
  role = 'shelf',
): ResolvedPieceWithCutSize {
  const contour = createRectangularContour(width, depth);
  const base = createPiece({
    id,
    role,
    materialId: 'mat-egger-white-18',
    contour,
    thicknessMm: thickness,
  });

  return {
    ...base,
    positionMm: { x: 0, y: 0, z: 0 },
    dimensionsMm: { width, height: depth },
    cutDimensionsMm: { width, height: depth },
    cutContour: contour,
    bandedEdges: [],
  };
}

describe('Shelf Deflection Calculation', () => {
  it('calculates mid-span deflection correctly for standard shelf dimensions', () => {
    const input: ShelfDeflectionInput = {
      spanMm: 600,
      depthMm: 300,
      thicknessMm: 18,
      elasticModulusMPa: 3000,
      designUniformLoadKgM2: 30,
      maxDeflectionRatio: 200,
      maxAbsoluteDeflectionMm: 3.0,
    };

    const result = calculateShelfDeflection(input);

    expect(result.spanMm).toBe(600);
    expect(result.depthMm).toBe(300);
    expect(result.thicknessMm).toBe(18);
    expect(result.elasticModulusMPa).toBe(3000);
    expect(result.isElasticModulusConfirmed).toBe(true);

    // Area = 0.6 * 0.3 = 0.18 m2
    // Load = 0.18 * 30 = 5.4 kg
    expect(result.totalLoadKg).toBe(5.4);
    expect(result.totalLoadN).toBeCloseTo(52.95, 1);

    // Inertia I = (300 * 18^3) / 12 = 145,800 mm^4
    expect(result.inertiaMm4).toBe(145800);

    // Calculated deflection is ~0.34 mm
    expect(result.calculatedDeflectionMm).toBeCloseTo(0.34, 1);
    expect(result.allowableDeflectionMm).toBe(3.0);
    expect(result.hasWarning).toBe(false);
    expect(result.warningMessage).toBeUndefined();
  });

  it('triggers a warning when shelf deflection exceeds the allowable limit', () => {
    // 1200mm span shelf with only 15mm thickness under 50 kg/m2 load
    const input: ShelfDeflectionInput = {
      spanMm: 1200,
      depthMm: 400,
      thicknessMm: 15,
      elasticModulusMPa: 2500,
      designUniformLoadKgM2: 50,
      maxDeflectionRatio: 200,
      maxAbsoluteDeflectionMm: 3.0,
    };

    const result = calculateShelfDeflection(input);

    expect(result.calculatedDeflectionMm).toBeGreaterThan(3.0);
    expect(result.hasWarning).toBe(true);
    expect(result.warningMessage).toBeDefined();
    expect(result.warningMessage).toContain('exceeds allowable limit');
    expect(result.warningMessage).toContain('Consider adding a center support');
  });

  it('falls back to DEFAULT_ELASTIC_MODULUS_MPA when material modulus is TO_CONFIRM', () => {
    const input: ShelfDeflectionInput = {
      spanMm: 564,
      depthMm: 540,
      thicknessMm: 18,
      elasticModulusMPa: 'TO_CONFIRM',
    };

    const result = calculateShelfDeflection(input);

    expect(result.elasticModulusMPa).toBe(DEFAULT_ELASTIC_MODULUS_MPA);
    expect(result.isElasticModulusConfirmed).toBe(false);
    expect(result.hasWarning).toBe(false);
  });

  it('uses confirmed elastic modulus when provided', () => {
    const input: ShelfDeflectionInput = {
      spanMm: 564,
      depthMm: 540,
      thicknessMm: 18,
      elasticModulusMPa: 3500,
    };

    const result = calculateShelfDeflection(input);

    expect(result.elasticModulusMPa).toBe(3500);
    expect(result.isElasticModulusConfirmed).toBe(true);
  });

  it('returns null for pieces that are not shelves', () => {
    const sidePiece = createMockShelfPiece('side-1', 560, 800, 18, 'side-left');
    const result = checkPieceDeflection(sidePiece, mockMaterial);

    expect(result).toBeNull();
  });

  it('evaluates shelf piece correctly and maps shelves in a module', () => {
    const shelf1 = createMockShelfPiece('shelf-1', 564, 540, 18, 'shelf');
    const side1 = createMockShelfPiece('side-left', 560, 800, 18, 'side-left');
    const bottom1 = createMockShelfPiece('bottom', 564, 560, 18, 'bottom');

    const singleResult = checkPieceDeflection(shelf1, mockMaterialWithConfirmedE);
    expect(singleResult).not.toBeNull();
    expect(singleResult?.isElasticModulusConfirmed).toBe(true);
    expect(singleResult?.elasticModulusMPa).toBe(3500);

    const map = checkModuleShelvesDeflection(
      [shelf1, side1, bottom1],
      [mockMaterialWithConfirmedE],
    );

    expect(map.size).toBe(1);
    expect(map.has('shelf-1')).toBe(true);
    expect(map.has('side-left')).toBe(false);
    expect(map.has('bottom')).toBe(false);
  });
});
