import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDefaultProjectConfig,
  loadProjectConfigFromDb,
  saveProjectConfigToDb,
  exportProjectConfigJson,
  importProjectConfigJson,
  DEFAULT_PROJECT_ID,
  deleteDatabase,
} from '../src/storage';
import {
  deriveModuleDrillOperations,
  buildBaseCabinet,
} from '../src/resolver';
import type { Material, ProjectConfig } from '../src/model';

const testMaterial: Material = {
  schemaVersion: 1,
  id: 'mat-test-18',
  name: 'Melamine White 18mm',
  thicknessMm: 18,
  sheetSizeMm: { length: 2750, width: 1830 },
  hasGrain: false,
  milling: { hidden: 'yes', visible: 'no', onStructuralPiece: 'limited' },
};

describe('Project Configuration System', () => {
  beforeEach(async () => {
    await deleteDatabase();
  });

  it('loads baseline configuration from JSON file with valid schema', () => {
    const config = getDefaultProjectConfig();

    expect(config.schemaVersion).toBe(1);
    expect(config.projectId).toBe('default-project');
    expect(config.machining.confirmatThroughDiameterMm).toBe(7.0);
    expect(config.machining.minifixPocketDiameterMm).toBe(15.0);
    expect(config.machining.hingeCupDiameterMm).toBe(35.0);
    expect(config.nesting.sawKerfMm).toBe(4.4);
    expect(config.nesting.sheetTrimMarginMm).toBe(10.0);
    expect(config.features.enablePieceLabels).toBe(true);
    expect(config.features.enableInterferencesLab).toBe(false);
  });

  it('seeds configuration into IndexedDB on first load and persists changes', async () => {
    const loaded = await loadProjectConfigFromDb(DEFAULT_PROJECT_ID);
    expect(loaded).toBeDefined();
    expect(loaded.projectName).toContain('CadCat');

    // Modify machining tolerance and project name
    const modified: ProjectConfig = {
      ...loaded,
      projectName: 'Proyecto Personalizado Taller',
      machining: {
        ...loaded.machining,
        confirmatThroughDiameterMm: 8.0,
        jointDrillMarginMm: 65.0,
      },
    };

    await saveProjectConfigToDb(modified);

    const reloaded = await loadProjectConfigFromDb(DEFAULT_PROJECT_ID);
    expect(reloaded.projectName).toBe('Proyecto Personalizado Taller');
    expect(reloaded.machining.confirmatThroughDiameterMm).toBe(8.0);
    expect(reloaded.machining.jointDrillMarginMm).toBe(65.0);
  });

  it('exports configuration to JSON string and imports it back accurately', () => {
    const base = getDefaultProjectConfig();
    const jsonStr = exportProjectConfigJson(base);

    expect(jsonStr).toContain('"projectId": "default-project"');
    expect(jsonStr).toContain('"sawKerfMm": 4.4');

    const imported = importProjectConfigJson(jsonStr);
    expect(imported).toEqual(base);
  });

  it('validates uploaded configuration JSON and rejects invalid structures', () => {
    const invalidJson = JSON.stringify({
      schemaVersion: 1,
      projectId: 'corrupt-project',
      // missing machining and nesting
    });

    expect(() => importProjectConfigJson(invalidJson)).toThrow();
  });

  it('applies project configuration to machining derivation dynamically', () => {
    const customConfig = getDefaultProjectConfig();
    customConfig.machining.confirmatThroughDiameterMm = 9.0;
    customConfig.machining.jointDrillMarginMm = 80.0;

    const built = buildBaseCabinet(
      { width: 600, height: 800, depth: 560 },
      testMaterial,
    );

    const ops = deriveModuleDrillOperations(
      built.module.pieces,
      built.module.joints,
      customConfig.machining,
    );

    const confirmatHoles = ops.filter((o) => o.sourceJointKind === 'confirmat' && o.faceType === 'face-A');
    expect(confirmatHoles.length).toBeGreaterThan(0);

    // Diameter should match the custom project configuration
    expect(confirmatHoles[0]!.diameterMm).toBe(9.0);
    // Setback coordinate should reflect custom jointDrillMarginMm (80mm)
    expect(confirmatHoles[0]!.positionMm.x).toBe(80.0);
  });
});
