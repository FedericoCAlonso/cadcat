import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  openDatabase,
  deleteDatabase,
  loadMaterialsFromDb,
  loadEdgeBandsFromDb,
  loadHardwareFromDb,
  seedCatalogsIfEmpty,
} from '../src/storage';

const TEST_DB = 'test_catalog_store_db';

describe('Catalog Store in IndexedDB', () => {
  let db: IDBDatabase;

  beforeEach(async () => {
    await deleteDatabase(TEST_DB);
    db = await openDatabase(TEST_DB, 1, ['catalogs', 'modules']);
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
});
