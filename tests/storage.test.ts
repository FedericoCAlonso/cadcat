import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  openDatabase,
  saveItem,
  loadItem,
  deleteItem,
  listItems,
  clearStore,
  deleteDatabase,
  type StoredEntity,
} from '../src/storage';

interface TestModule extends StoredEntity {
  name: string;
  width: number;
}

const TEST_DB = 'test_cadcat_db';

describe('IndexedDB Storage Layer', () => {
  let db: IDBDatabase;

  beforeEach(async () => {
    await deleteDatabase(TEST_DB);
    db = await openDatabase(TEST_DB, 1, ['modules', 'catalogs']);
  });

  afterEach(async () => {
    db.close();
    await deleteDatabase(TEST_DB);
  });

  it('saves and loads a JSON object by id', async () => {
    const item: TestModule = {
      id: 'module-1',
      schemaVersion: 1,
      name: 'Base Cabinet',
      width: 600,
    };

    await saveItem('modules', item, db);
    const loaded = await loadItem<TestModule>('modules', 'module-1', db);

    expect(loaded).toEqual(item);
  });

  it('returns null when loading a non-existent item', async () => {
    const loaded = await loadItem<TestModule>('modules', 'non-existent', db);
    expect(loaded).toBeNull();
  });

  it('rejects an item without schemaVersion or id', async () => {
    const itemWithoutVersion = {
      id: 'invalid-item',
      name: 'Bad Item',
    } as unknown as StoredEntity;

    await expect(saveItem('modules', itemWithoutVersion, db)).rejects.toThrow(
      'Item must have a non-empty id and a numeric schemaVersion',
    );

    const itemWithoutId = {
      id: '',
      schemaVersion: 1,
      name: 'Bad Item',
    } as unknown as StoredEntity;

    await expect(saveItem('modules', itemWithoutId, db)).rejects.toThrow(
      'Item must have a non-empty id and a numeric schemaVersion',
    );
  });

  it('updates an existing item when saved with same id', async () => {
    const original: TestModule = {
      id: 'mod-update',
      schemaVersion: 1,
      name: 'Old Name',
      width: 500,
    };

    await saveItem('modules', original, db);

    const updated: TestModule = {
      id: 'mod-update',
      schemaVersion: 1,
      name: 'New Name',
      width: 800,
    };

    await saveItem('modules', updated, db);

    const loaded = await loadItem<TestModule>('modules', 'mod-update', db);
    expect(loaded?.name).toBe('New Name');
    expect(loaded?.width).toBe(800);
  });

  it('lists all items in a store', async () => {
    const item1: TestModule = { id: 'm-1', schemaVersion: 1, name: 'Module 1', width: 400 };
    const item2: TestModule = { id: 'm-2', schemaVersion: 1, name: 'Module 2', width: 500 };

    await saveItem('modules', item1, db);
    await saveItem('modules', item2, db);

    const all = await listItems<TestModule>('modules', db);
    expect(all).toHaveLength(2);
    expect(all.map((item) => item.id)).toEqual(expect.arrayContaining(['m-1', 'm-2']));
  });

  it('deletes an item by id', async () => {
    const item: TestModule = { id: 'm-del', schemaVersion: 1, name: 'To Delete', width: 300 };

    await saveItem('modules', item, db);
    await deleteItem('modules', 'm-del', db);

    const loaded = await loadItem<TestModule>('modules', 'm-del', db);
    expect(loaded).toBeNull();
  });

  it('clears all items in a store', async () => {
    const item1: TestModule = { id: 'm-1', schemaVersion: 1, name: 'Item 1', width: 100 };
    const item2: TestModule = { id: 'm-2', schemaVersion: 1, name: 'Item 2', width: 200 };

    await saveItem('modules', item1, db);
    await saveItem('modules', item2, db);
    await clearStore('modules', db);

    const all = await listItems<TestModule>('modules', db);
    expect(all).toHaveLength(0);
  });
});
