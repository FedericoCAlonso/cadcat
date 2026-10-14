import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  openDatabase,
  deleteDatabase,
  loadMaterialsFromDb,
  loadEdgeBandsFromDb,
  loadHardwareFromDb,
  saveMaterialToDb,
  deleteMaterialFromDb,
  saveEdgeBandToDb,
  deleteEdgeBandFromDb,
  saveHardwareToDb,
  deleteHardwareFromDb,
  resetCatalogsToSeed,
  loadUserTemplatesFromDb,
  saveUserTemplateToDb,
  deleteUserTemplateFromDb,
  seedCatalogsIfEmpty,
} from '../src/storage';

const TEST_DB = 'test_catalog_store_db';

describe('Catalog Store in IndexedDB', () => {
  let db: IDBDatabase;

  beforeEach(async () => {
    await deleteDatabase(TEST_DB);
    db = await openDatabase(TEST_DB, 1, ['catalogs', 'modules', 'user_templates']);
  });

  afterEach(async () => {
    db.close();
    await deleteDatabase(TEST_DB);
  });

  it('seeds catalogs into IndexedDB when empty', async () => {
    await seedCatalogsIfEmpty(db);

    const materials = await loadMaterialsFromDb(db);
    expect(materials.length).toBeGreaterThanOrEqual(2);
    expect(materials[0]?.id).toBe('mat-egger-white-18');

    const edgeBands = await loadEdgeBandsFromDb(db);
    expect(edgeBands.length).toBeGreaterThanOrEqual(2);
    expect(edgeBands[0]?.id).toBe('eb-white-08');

    const hardware = await loadHardwareFromDb(db);
    expect(hardware.length).toBeGreaterThanOrEqual(3);
    expect(hardware[0]?.id).toBe('hw-confirmat-7x50');
  });

  it('preserves existing data in IndexedDB on subsequent seed calls', async () => {
    await seedCatalogsIfEmpty(db);
    const firstLoad = await loadMaterialsFromDb(db);

    await seedCatalogsIfEmpty(db);
    const secondLoad = await loadMaterialsFromDb(db);

    expect(secondLoad).toEqual(firstLoad);
  });

  it('supports saving, updating and deleting materials', async () => {
    const newMat = {
      id: 'mat-custom-mdf-15',
      name: 'Fibrofacil MDF 15mm',
      thicknessMm: 15,
      sheetSizeMm: { length: 2600, width: 1830 },
      hasGrain: false,
      milling: {
        hidden: 'yes' as const,
        visible: 'yes' as const,
        onStructuralPiece: 'yes' as const,
      },
    };

    await saveMaterialToDb(newMat, db);
    let materials = await loadMaterialsFromDb(db);
    expect(materials.some((m) => m.id === 'mat-custom-mdf-15')).toBe(true);

    // Update
    await saveMaterialToDb({ ...newMat, name: 'Fibrofacil MDF 15mm Calidad Premium' }, db);
    materials = await loadMaterialsFromDb(db);
    const updated = materials.find((m) => m.id === 'mat-custom-mdf-15');
    expect(updated?.name).toBe('Fibrofacil MDF 15mm Calidad Premium');

    // Delete
    await deleteMaterialFromDb('mat-custom-mdf-15', db);
    materials = await loadMaterialsFromDb(db);
    expect(materials.some((m) => m.id === 'mat-custom-mdf-15')).toBe(false);
  });

  it('supports saving, updating and deleting edge bands', async () => {
    const newEb = {
      id: 'eb-custom-pvc-045',
      kind: 'adhesive' as const,
      thicknessMm: 0.45,
      pricePerMeter: 120,
      needsGroove: false,
    };

    await saveEdgeBandToDb(newEb, db);
    let edgeBands = await loadEdgeBandsFromDb(db);
    expect(edgeBands.some((e) => e.id === 'eb-custom-pvc-045')).toBe(true);

    await deleteEdgeBandFromDb('eb-custom-pvc-045', db);
    edgeBands = await loadEdgeBandsFromDb(db);
    expect(edgeBands.some((e) => e.id === 'eb-custom-pvc-045')).toBe(false);
  });

  it('supports saving, updating and deleting hardware/fasteners', async () => {
    const newHw = {
      id: 'hw-custom-spax-4x45',
      name: 'Tornillo Spax Cabeza Plana 4x45mm',
      jointKind: 'screw',
      pricePerUnit: 15,
    };

    await saveHardwareToDb(newHw, db);
    let hardware = await loadHardwareFromDb(db);
    expect(hardware.some((h) => h.id === 'hw-custom-spax-4x45')).toBe(true);

    await deleteHardwareFromDb('hw-custom-spax-4x45', db);
    hardware = await loadHardwareFromDb(db);
    expect(hardware.some((h) => h.id === 'hw-custom-spax-4x45')).toBe(false);
  });

  it('resets catalogs to seed defaults on resetCatalogsToSeed', async () => {
    await saveMaterialToDb({
      id: 'mat-temp',
      name: 'Temporal',
      thicknessMm: 18,
      sheetSizeMm: { length: 2000, width: 1000 },
      hasGrain: false,
      milling: { hidden: 'yes', visible: 'no', onStructuralPiece: 'no' },
    }, db);

    await resetCatalogsToSeed(db);
    const materials = await loadMaterialsFromDb(db);
    expect(materials.some((m) => m.id === 'mat-temp')).toBe(false);
  });
});

describe('User Templates Store in IndexedDB', () => {
  let db: IDBDatabase;

  beforeEach(async () => {
    await deleteDatabase('test_user_tpl_db');
    db = await openDatabase('test_user_tpl_db', 1, ['user_templates']);
  });

  afterEach(async () => {
    db.close();
    await deleteDatabase('test_user_tpl_db');
  });

  it('saves, loads, and deletes user templates', async () => {
    const initial = await loadUserTemplatesFromDb(db);
    expect(initial).toEqual([]);

    const tpl = {
      id: 'user-tpl-1',
      schemaVersion: 1 as const,
      name: 'Módulo Alacena Personalizada',
      description: 'Alacena de 800mm con fajas',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dimensions: { width: 800, height: 720, depth: 350 },
      carcassSettings: {
        roofType: 'front-back-rails' as const,
        jointPriority: 'lateral-over-bottom' as const,
        hasBacking: true,
      },
      gridType: '1-bay' as const,
      bays: [{ type: 'empty' as const }],
    };

    await saveUserTemplateToDb(tpl, db);
    const loaded = await loadUserTemplatesFromDb(db);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.name).toBe('Módulo Alacena Personalizada');

    await deleteUserTemplateFromDb('user-tpl-1', db);
    const afterDelete = await loadUserTemplatesFromDb(db);
    expect(afterDelete).toHaveLength(0);
  });
});


