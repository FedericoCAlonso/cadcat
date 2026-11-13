import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createDefaultProject,
  projectModuleItemSchema,
  type Material,
  type EdgeBand,
  type Hardware,
  type UserTemplate,
} from '../src/model';
import {
  DB_VERSION,
  DEFAULT_PROJECT_ID,
  DEFAULT_STORES,
  buildBackupBundleJson,
  deleteDatabase,
  getDefaultProjectConfig,
  importBackupBundleToDb,
  loadAllProjectsFromDb,
  loadEdgeBandsFromDb,
  loadHardwareFromDb,
  loadMaterialsFromDb,
  loadProjectConfigFromDb,
  loadUserTemplatesFromDb,
  openDatabase,
  parseBackupBundleJson,
} from '../src/storage';

const TEST_DB = 'test_backup_bundle_db';

function createSampleMaterial(): Material {
  return {
    id: 'mat-test-18',
    name: 'Melamina Test 18mm',
    thicknessMm: 18,
    sheetSizeMm: { length: 2750, width: 1830 },
    hasGrain: false,
    milling: {
      hidden: 'yes',
      visible: 'yes',
      onStructuralPiece: 'yes',
    },
  };
}

function createSampleEdgeBand(): EdgeBand {
  return {
    id: 'eb-test-08',
    kind: 'adhesive',
    thicknessMm: 0.8,
    pricePerMeter: 500,
    needsGroove: false,
  };
}

function createSampleHardware(): Hardware {
  return {
    id: 'hw-test-confirmat',
    name: 'Confirmat Test 7x50',
    jointKind: 'confirmat',
    pricePerUnit: 150,
  };
}

function createSampleUserTemplate(): UserTemplate {
  const now = new Date().toISOString();
  return {
    id: 'tpl-user-1',
    schemaVersion: 1,
    name: 'Plantilla Test',
    createdAt: now,
    updatedAt: now,
    dimensions: { width: 800, height: 720, depth: 560 },
    carcassSettings: {
      roofType: 'front-back-rails',
      jointPriority: 'lateral-over-bottom',
      hasBacking: true,
    },
    gridType: '1-bay',
    bays: [{ type: 'empty' }],
  };
}

describe('Backup Bundle & Zero-Backend Sync', () => {
  let db: IDBDatabase;

  beforeEach(async () => {
    await deleteDatabase(TEST_DB);
    db = await openDatabase(TEST_DB, DB_VERSION, DEFAULT_STORES);
  });

  afterEach(async () => {
    db.close();
    await deleteDatabase(TEST_DB);
  });

  it('builds and parses a complete backup bundle JSON round-trip', () => {
    const defaultConfig = getDefaultProjectConfig();
    const mod = projectModuleItemSchema.parse({
      id: 'mod-1',
      name: 'Bajo Mesada Test',
      width: 800,
      height: 750,
      depth: 560,
    });
    const project = createDefaultProject(mod);
    const json = buildBackupBundleJson({
      appVersion: '0.32.0',
      projects: [project],
      projectConfig: defaultConfig,
      materials: [createSampleMaterial()],
      edgeBands: [createSampleEdgeBand()],
      hardware: [createSampleHardware()],
      userTemplates: [createSampleUserTemplate()],
    });

    const parsed = parseBackupBundleJson(json);
    expect(parsed.format).toBe('cadcat-backup');
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.appVersion).toBe('0.32.0');
    expect(parsed.projects).toHaveLength(1);
    expect(parsed.projects[0]?.id).toBe(project.id);
    expect(parsed.materials).toHaveLength(1);
    expect(parsed.edgeBands).toHaveLength(1);
    expect(parsed.hardware).toHaveLength(1);
    expect(parsed.userTemplates).toHaveLength(1);
    expect(parsed.projectConfig).not.toBeNull();
  });

  it('rejects malformed or wrong-format backup payloads', () => {
    expect(() => parseBackupBundleJson('not json')).toThrow();
    expect(() =>
      parseBackupBundleJson(JSON.stringify({ format: 'other-app', schemaVersion: 1 })),
    ).toThrow();
  });

  it('imports a validated bundle into IndexedDB replacing stale projects and templates', async () => {
    const defaultConfig = getDefaultProjectConfig();
    const mod = projectModuleItemSchema.parse({
      id: 'mod-sync-1',
      name: 'Módulo Sincronizado',
      width: 900,
      height: 820,
      depth: 580,
    });
    const project = {
      ...createDefaultProject(mod),
      id: 'proj-synced',
      name: 'Cocina Móvil → PC',
    };
    const template = createSampleUserTemplate();
    const json = buildBackupBundleJson({
      projects: [project],
      projectConfig: defaultConfig,
      materials: [createSampleMaterial()],
      edgeBands: [createSampleEdgeBand()],
      hardware: [createSampleHardware()],
      userTemplates: [template],
    });

    const bundle = parseBackupBundleJson(json);
    await importBackupBundleToDb(bundle, db);

    const loadedProjects = await loadAllProjectsFromDb(db);
    const loadedConfig = await loadProjectConfigFromDb(DEFAULT_PROJECT_ID, db);
    const loadedMaterials = await loadMaterialsFromDb(db);
    const loadedEdgeBands = await loadEdgeBandsFromDb(db);
    const loadedHardware = await loadHardwareFromDb(db);
    const loadedTemplates = await loadUserTemplatesFromDb(db);

    expect(loadedProjects).toHaveLength(1);
    expect(loadedProjects[0]?.id).toBe('proj-synced');
    expect(loadedProjects[0]?.name).toBe('Cocina Móvil → PC');
    expect(loadedConfig.units.length).toBe(defaultConfig.units.length);
    expect(loadedMaterials[0]?.id).toBe('mat-test-18');
    expect(loadedEdgeBands[0]?.id).toBe('eb-test-08');
    expect(loadedHardware[0]?.id).toBe('hw-test-confirmat');
    expect(loadedTemplates).toHaveLength(1);
    expect(loadedTemplates[0]?.id).toBe('tpl-user-1');
  });
});
