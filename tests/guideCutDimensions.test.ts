import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import {
  getModularPresetById,
  buildModularModule,
  generateAssemblySheet,
  exportCutListCsv,
  getPieceCutDimensions,
  type ModuleMaterialRoles,
} from '../src/resolver';
import { AssemblySheetView } from '../src/ui/AssemblySheetView';

describe('Fix Commit 1: Assembly Guide Cut Dimensions Alignment with Cut List CSV', () => {
  const materials: ModuleMaterialRoles = {
    carcassMaterialId: 'mat-egger-white-18',
    frontsMaterialId: 'mat-egger-oak-18',
    drawerBoxesMaterialId: 'mat-mdf-white-15',
    backingsMaterialId: 'mat-mdf-white-3',
  };

  function parseCsvCutMap(csv: string) {
    const lines = csv.trim().split('\r\n').slice(1);
    const map = new Map<string, { cutW: number; cutH: number; th: number }>();
    for (const line of lines) {
      const parts = line.split(',');
      const pieceId = parts[0];
      const cutWStr = parts[5];
      const cutHStr = parts[6];
      const thStr = parts[7];
      if (pieceId && cutWStr && cutHStr && thStr) {
        map.set(pieceId, {
          cutW: parseFloat(cutWStr),
          cutH: parseFloat(cutHStr),
          th: parseFloat(thStr),
        });
      }
    }
    return map;
  }

  it('matches 100% of pieces between Guide explodedMap and Cut List CSV for preset-drawer-unit-3', () => {
    const preset = getModularPresetById('preset-drawer-unit-3');
    const def = preset.createDefinition({ width: 500, height: 720, depth: 560 }, materials);
    const output = buildModularModule(def);
    const sheet = generateAssemblySheet({
      module: {
        moduleId: 'preset-drawer-unit-3',
        pieces: output.resolvedPieces,
        joints: output.module.joints,
      },
      moduleDimensions: { width: 500, height: 720, depth: 560 },
    });

    const csv = exportCutListCsv(output.resolvedPieces);
    const csvMap = parseCsvCutMap(csv);

    expect(sheet.explodedMap.length).toBe(output.resolvedPieces.length);
    expect(sheet.explodedMap.length).toBe(24);

    for (const exp of sheet.explodedMap) {
      const csvItem = csvMap.get(exp.pieceId);
      expect(csvItem, `Piece ${exp.pieceId} must exist in CSV`).toBeDefined();
      if (!csvItem) continue;

      expect(exp.dimensionsMm.width).toBe(Math.round(csvItem.cutW));
      expect(exp.dimensionsMm.height).toBe(Math.round(csvItem.cutH));
      expect(exp.dimensionsMm.thickness).toBe(Math.round(csvItem.th));
    }
  });

  it('matches 100% of pieces between Guide explodedMap and Cut List CSV for preset-empty', () => {
    const preset = getModularPresetById('preset-empty');
    const def = preset.createDefinition({ width: 500, height: 720, depth: 560 }, materials);
    const output = buildModularModule(def);
    const sheet = generateAssemblySheet({
      module: {
        moduleId: 'preset-empty',
        pieces: output.resolvedPieces,
        joints: output.module.joints,
      },
      moduleDimensions: { width: 500, height: 720, depth: 560 },
    });

    const csv = exportCutListCsv(output.resolvedPieces);
    const csvMap = parseCsvCutMap(csv);

    expect(sheet.explodedMap.length).toBe(output.resolvedPieces.length);
    expect(sheet.explodedMap.length).toBe(6);

    for (const exp of sheet.explodedMap) {
      const csvItem = csvMap.get(exp.pieceId);
      expect(csvItem, `Piece ${exp.pieceId} must exist in CSV`).toBeDefined();
      if (!csvItem) continue;

      expect(exp.dimensionsMm.width).toBe(Math.round(csvItem.cutW));
      expect(exp.dimensionsMm.height).toBe(Math.round(csvItem.cutH));
      expect(exp.dimensionsMm.thickness).toBe(Math.round(csvItem.th));
    }
  });

  it('matches panelDetails dimensions with the Cut List CSV', () => {
    const preset = getModularPresetById('preset-drawer-unit-3');
    const def = preset.createDefinition({ width: 500, height: 720, depth: 560 }, materials);
    const output = buildModularModule(def);
    const sheet = generateAssemblySheet({
      module: {
        moduleId: 'preset-drawer-unit-3',
        pieces: output.resolvedPieces,
        joints: output.module.joints,
      },
      moduleDimensions: { width: 500, height: 720, depth: 560 },
    });

    const csv = exportCutListCsv(output.resolvedPieces);
    const csvMap = parseCsvCutMap(csv);

    for (const panel of sheet.panelDetails) {
      const csvItem = csvMap.get(panel.pieceId);
      expect(csvItem).toBeDefined();
      if (!csvItem) continue;

      expect(panel.dimensionsMm.width).toBe(Math.round(csvItem.cutW));
      expect(panel.dimensionsMm.height).toBe(Math.round(csvItem.cutH));
      expect(panel.dimensionsMm.thickness).toBe(Math.round(csvItem.th));
    }
  });

  it('getPieceCutDimensions handles cutDimensionsMm, dimensionsMm and fallback contours', () => {
    // 1. Piece with cutDimensionsMm
    const pieceWithCut = {
      cutDimensionsMm: { width: 560, height: 720 },
      thicknessMm: 18,
      contour: { points: [{ x: 0, y: 0 }, { x: 560, y: 0 }, { x: 560, y: 720 }, { x: 0, y: 720 }] },
    };
    expect(getPieceCutDimensions(pieceWithCut)).toEqual({
      width: 560,
      height: 720,
      thickness: 18,
    });

    // 2. Piece without cutDimensionsMm but with dimensionsMm
    const pieceWithDim = {
      dimensionsMm: { width: 450, height: 300 },
      thicknessMm: 15,
      contour: { points: [{ x: 0, y: 0 }] },
    };
    expect(getPieceCutDimensions(pieceWithDim)).toEqual({
      width: 450,
      height: 300,
      thickness: 15,
    });

    // 3. Piece with contour only
    const pieceContour = {
      thicknessMm: 3,
      contour: { points: [{ x: 10, y: 20 }, { x: 110, y: 20 }, { x: 110, y: 220 }, { x: 10, y: 220 }] },
    };
    expect(getPieceCutDimensions(pieceContour)).toEqual({
      width: 100,
      height: 200,
      thickness: 3,
    });
  });

  it('renders Diagonal de Escuadra with normal text color and proper cut labels in UI', () => {
    const preset = getModularPresetById('preset-empty');
    const def = preset.createDefinition({ width: 500, height: 720, depth: 560 }, materials);
    const output = buildModularModule(def);
    const sheet = generateAssemblySheet({
      module: {
        moduleId: 'preset-empty',
        pieces: output.resolvedPieces,
        joints: output.module.joints,
      },
      moduleDimensions: { width: 500, height: 720, depth: 560 },
    });

    const html = renderToString(
      React.createElement(AssemblySheetView, {
        assemblySheet: sheet,
      })
    );

    // Diagonal de Escuadra must not have var(--danger, #b3412f)
    expect(html).toContain('Diagonal de Escuadra:');
    expect(html).not.toMatch(/color:\s*var\(--danger,\s*#b3412f\)[^>]*>(\s|\n)*<strong>📐 Diagonal de Escuadra/);

    // Table header must say "Corte (Ancho × Alto × Esp)"
    expect(html).toContain('Corte (Ancho × Alto × Esp)');

    // Cards and inspector must say "Corte (An × Al × Esp)"
    expect(html).toContain('Corte (An × Al × Esp):');
  });
});
