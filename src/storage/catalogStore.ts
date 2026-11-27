import {
  type Material,
  type EdgeBand,
  type Hardware,
  type MaterialCatalog,
  type EdgeBandCatalog,
  type HardwareCatalog,
  validateMaterialCatalog,
  validateEdgeBandCatalog,
  validateHardwareCatalog,
} from '../model';
import {
  saveItem,
  loadItem,
  openDatabase,
  type StoredEntity,
} from './db';
import { getSeedMaterials, getSeedEdgeBands, getSeedHardware } from '../catalog';

export interface StoredCatalog<T> extends StoredEntity {
  data: T;
}

export const CATALOG_STORE = 'catalogs';
export const MATERIALS_CATALOG_ID = 'catalog-materials';
export const EDGE_BANDS_CATALOG_ID = 'catalog-edge-bands';
export const HARDWARE_CATALOG_ID = 'catalog-hardware';

/**
 * Initialize and seed catalogs into IndexedDB if not already present.
 */
export async function seedCatalogsIfEmpty(database?: IDBDatabase): Promise<void> {
  const db = database ?? (await openDatabase());
  const shouldClose = !database;

  try {
    const [existingMaterials, existingEdgeBands, existingHardware] = await Promise.all([
      loadItem<StoredCatalog<MaterialCatalog>>(CATALOG_STORE, MATERIALS_CATALOG_ID, db),
      loadItem<StoredCatalog<EdgeBandCatalog>>(CATALOG_STORE, EDGE_BANDS_CATALOG_ID, db),
      loadItem<StoredCatalog<HardwareCatalog>>(CATALOG_STORE, HARDWARE_CATALOG_ID, db),
    ]);

    if (existingMaterials && existingEdgeBands && existingHardware) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(CATALOG_STORE, 'readwrite');
      const store = tx.objectStore(CATALOG_STORE);
      if (!existingMaterials) {
        store.put({ id: MATERIALS_CATALOG_ID, schemaVersion: 1, data: getSeedMaterials() });
      }
      if (!existingEdgeBands) {
        store.put({ id: EDGE_BANDS_CATALOG_ID, schemaVersion: 1, data: getSeedEdgeBands() });
      }
      if (!existingHardware) {
        store.put({ id: HARDWARE_CATALOG_ID, schemaVersion: 1, data: getSeedHardware() });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to seed catalogs'));
      tx.onabort = () => reject(tx.error ?? new Error('Seed catalogs transaction aborted'));
    });
  } finally {
    if (shouldClose) {
      db.close();
    }
  }
}

/**
 * Load materials catalog from IndexedDB.
 */
export async function loadMaterialsFromDb(database?: IDBDatabase): Promise<Material[]> {
  const db = database ?? (await openDatabase());
  const shouldClose = !database;
  try {
    let record = await loadItem<StoredCatalog<MaterialCatalog>>(
      CATALOG_STORE,
      MATERIALS_CATALOG_ID,
      db,
    );
    if (!record) {
      const seed = getSeedMaterials();
      await saveItem(CATALOG_STORE, { id: MATERIALS_CATALOG_ID, schemaVersion: 1, data: seed }, db);
      record = { id: MATERIALS_CATALOG_ID, schemaVersion: 1, data: seed };
    }
    const validated = validateMaterialCatalog(record.data);
    return validated.materials;
  } finally {
    if (shouldClose) {
      db.close();
    }
  }
}

/**
 * Load edge bands catalog from IndexedDB.
 */
export async function loadEdgeBandsFromDb(database?: IDBDatabase): Promise<EdgeBand[]> {
  const db = database ?? (await openDatabase());
  const shouldClose = !database;
  try {
    let record = await loadItem<StoredCatalog<EdgeBandCatalog>>(
      CATALOG_STORE,
      EDGE_BANDS_CATALOG_ID,
      db,
    );
    if (!record) {
      const seed = getSeedEdgeBands();
      await saveItem(CATALOG_STORE, { id: EDGE_BANDS_CATALOG_ID, schemaVersion: 1, data: seed }, db);
      record = { id: EDGE_BANDS_CATALOG_ID, schemaVersion: 1, data: seed };
    }
    const validated = validateEdgeBandCatalog(record.data);
    return validated.edgeBands;
  } finally {
    if (shouldClose) {
      db.close();
    }
  }
}

/**
 * Load hardware catalog from IndexedDB.
 */
export async function loadHardwareFromDb(database?: IDBDatabase): Promise<Hardware[]> {
  const db = database ?? (await openDatabase());
  const shouldClose = !database;
  try {
    let record = await loadItem<StoredCatalog<HardwareCatalog>>(
      CATALOG_STORE,
      HARDWARE_CATALOG_ID,
      db,
    );
    if (!record) {
      const seed = getSeedHardware();
      await saveItem(CATALOG_STORE, { id: HARDWARE_CATALOG_ID, schemaVersion: 1, data: seed }, db);
      record = { id: HARDWARE_CATALOG_ID, schemaVersion: 1, data: seed };
    }
    const validated = validateHardwareCatalog(record.data);
    return validated.hardware;
  } finally {
    if (shouldClose) {
      db.close();
    }
  }
}

/**
 * Save or update a material in the materials catalog in IndexedDB.
 */
export async function saveMaterialToDb(material: Material, database?: IDBDatabase): Promise<void> {
  const current = await loadMaterialsFromDb(database);
  const index = current.findIndex((m) => m.id === material.id);
  const updated = index >= 0
    ? [...current.slice(0, index), material, ...current.slice(index + 1)]
    : [...current, material];

  const catalog: MaterialCatalog = {
    schemaVersion: 1,
    materials: updated,
  };
  const validated = validateMaterialCatalog(catalog);
  await saveItem(CATALOG_STORE, { id: MATERIALS_CATALOG_ID, schemaVersion: 1, data: validated }, database);
}

/**
 * Delete a material by id from the materials catalog in IndexedDB.
 */
export async function deleteMaterialFromDb(materialId: string, database?: IDBDatabase): Promise<void> {
  const current = await loadMaterialsFromDb(database);
  const filtered = current.filter((m) => m.id !== materialId);
  const catalog: MaterialCatalog = {
    schemaVersion: 1,
    materials: filtered,
  };
  const validated = validateMaterialCatalog(catalog);
  await saveItem(CATALOG_STORE, { id: MATERIALS_CATALOG_ID, schemaVersion: 1, data: validated }, database);
}

/**
 * Save or update an edge band in the edge bands catalog in IndexedDB.
 */
export async function saveEdgeBandToDb(edgeBand: EdgeBand, database?: IDBDatabase): Promise<void> {
  const current = await loadEdgeBandsFromDb(database);
  const index = current.findIndex((b) => b.id === edgeBand.id);
  const updated = index >= 0
    ? [...current.slice(0, index), edgeBand, ...current.slice(index + 1)]
    : [...current, edgeBand];

  const catalog: EdgeBandCatalog = {
    schemaVersion: 1,
    edgeBands: updated,
  };
  const validated = validateEdgeBandCatalog(catalog);
  await saveItem(CATALOG_STORE, { id: EDGE_BANDS_CATALOG_ID, schemaVersion: 1, data: validated }, database);
}

/**
 * Delete an edge band by id from the edge bands catalog in IndexedDB.
 */
export async function deleteEdgeBandFromDb(edgeBandId: string, database?: IDBDatabase): Promise<void> {
  const current = await loadEdgeBandsFromDb(database);
  const filtered = current.filter((b) => b.id !== edgeBandId);
  const catalog: EdgeBandCatalog = {
    schemaVersion: 1,
    edgeBands: filtered,
  };
  const validated = validateEdgeBandCatalog(catalog);
  await saveItem(CATALOG_STORE, { id: EDGE_BANDS_CATALOG_ID, schemaVersion: 1, data: validated }, database);
}

/**
 * Save or update hardware/fastener in the hardware catalog in IndexedDB.
 */
export async function saveHardwareToDb(hardware: Hardware, database?: IDBDatabase): Promise<void> {
  const current = await loadHardwareFromDb(database);
  const index = current.findIndex((h) => h.id === hardware.id);
  const updated = index >= 0
    ? [...current.slice(0, index), hardware, ...current.slice(index + 1)]
    : [...current, hardware];

  const catalog: HardwareCatalog = {
    schemaVersion: 1,
    hardware: updated,
  };
  const validated = validateHardwareCatalog(catalog);
  await saveItem(CATALOG_STORE, { id: HARDWARE_CATALOG_ID, schemaVersion: 1, data: validated }, database);
}

/**
 * Delete a hardware item by id from the hardware catalog in IndexedDB.
 */
export async function deleteHardwareFromDb(hardwareId: string, database?: IDBDatabase): Promise<void> {
  const current = await loadHardwareFromDb(database);
  const filtered = current.filter((h) => h.id !== hardwareId);
  const catalog: HardwareCatalog = {
    schemaVersion: 1,
    hardware: filtered,
  };
  const validated = validateHardwareCatalog(catalog);
  await saveItem(CATALOG_STORE, { id: HARDWARE_CATALOG_ID, schemaVersion: 1, data: validated }, database);
}

/**
 * Reset all catalogs back to default factory seed definitions.
 */
export async function resetCatalogsToSeed(database?: IDBDatabase): Promise<void> {
  const matSeed = getSeedMaterials();
  await saveItem(CATALOG_STORE, { id: MATERIALS_CATALOG_ID, schemaVersion: 1, data: matSeed }, database);

  const ebSeed = getSeedEdgeBands();
  await saveItem(CATALOG_STORE, { id: EDGE_BANDS_CATALOG_ID, schemaVersion: 1, data: ebSeed }, database);

  const hwSeed = getSeedHardware();
  await saveItem(CATALOG_STORE, { id: HARDWARE_CATALOG_ID, schemaVersion: 1, data: hwSeed }, database);
}

