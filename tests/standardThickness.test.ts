import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import {
  DEFAULT_STANDARD_THICKNESSES_MM,
  filterMaterialsByThickness,
  listThicknessOptions,
  type Material,
} from '../src/model';
import { ThicknessMaterialPicker } from '../src/ui/ThicknessMaterialPicker';

const mockMaterials: Material[] = [
  {
    schemaVersion: 1,
    id: 'mat-mdf-3',
    name: 'MDF 3mm',
    thicknessMm: 3,
    sheetSizeMm: { length: 2750, width: 1830 },
    hasGrain: false,
    milling: { hidden: 'no', visible: 'no', onStructuralPiece: 'no' },
  },
  {
    schemaVersion: 1,
    id: 'mat-mel-18',
    name: 'Melamina 18mm',
    thicknessMm: 18,
    sheetSizeMm: { length: 2750, width: 1830 },
    hasGrain: true,
    milling: { hidden: 'yes', visible: 'no', onStructuralPiece: 'limited' },
  },
  {
    schemaVersion: 1,
    id: 'mat-custom-12',
    name: 'Placa Especial 12mm',
    thicknessMm: 12,
    sheetSizeMm: { length: 2750, width: 1830 },
    hasGrain: false,
    milling: { hidden: 'yes', visible: 'no', onStructuralPiece: 'no' },
  },
];

describe('standardThickness model & ThicknessMaterialPicker', () => {
  it('lists standard thicknesses first, followed by extra catalog thicknesses sorted ascending', () => {
    const options = listThicknessOptions(mockMaterials, DEFAULT_STANDARD_THICKNESSES_MM);
    expect(options.slice(0, DEFAULT_STANDARD_THICKNESSES_MM.length)).toEqual([
      ...DEFAULT_STANDARD_THICKNESSES_MM,
    ]);
    expect(options).toContain(12);
    expect(options[options.length - 1]).toBe(12);
  });

  it('filters catalog plates by chosen thickness', () => {
    expect(filterMaterialsByThickness(mockMaterials, 18).map((m) => m.id)).toEqual(['mat-mel-18']);
    expect(filterMaterialsByThickness(mockMaterials, 6)).toEqual([]);
    expect(filterMaterialsByThickness(mockMaterials, null).length).toBe(3);
  });

  it('renders automatic thickness from selected plate and standard thickness options', () => {
    const html = renderToStaticMarkup(
      React.createElement(ThicknessMaterialPicker, {
        id: 'select-material',
        label: 'Placa para Casco:',
        materials: mockMaterials,
        selectedMaterialId: 'mat-mel-18',
        onMaterialChange: vi.fn(),
      }),
    );

    expect(html).toContain('Placa para Casco:');
    expect(html).toContain('18 mm');
    expect(html).toContain('Melamina 18mm (18 mm)');
  });
});
