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
  const existingMaterials = await loadItem<StoredCatalog<MaterialCatalog>>(
    CATALOG_STORE,
    MATERIALS_CATALOG_ID,
    database,
  );
  if (!existingMaterials) {
    const seed = getSeedMaterials();
    await saveItem(
      CATALOG_STORE,
      { id: MATERIALS_CATALOG_ID, schemaVersion: 1, data: seed },
      database,
    );
  }

  const existingEdgeBands = await loadItem<StoredCatalog<EdgeBandCatalog>>(
    CATALOG_STORE,
    EDGE_BANDS_CATALOG_ID,
    database,
  );
  if (!existingEdgeBands) {
    const seed = getSeedEdgeBands();
    await saveItem(
      CATALOG_STORE,
      { id: EDGE_BANDS_CATALOG_ID, schemaVersion: 1, data: seed },
      database,
    );
  }

  const existingHardware = await loadItem<StoredCatalog<HardwareCatalog>>(
    CATALOG_STORE,
    HARDWARE_CATALOG_ID,
    database,
  );
  if (!existingHardware) {
    const seed = getSeedHardware();
    await saveItem(
      CATALOG_STORE,
      { id: HARDWARE_CATALOG_ID, schemaVersion: 1, data: seed },
      database,
    );
  }
}

/**
 * Load materials catalog from IndexedDB.
 */
export async function loadMaterialsFromDb(database?: IDBDatabase): Promise<Material[]> {
  await seedCatalogsIfEmpty(database);
  const record = await loadItem<StoredCatalog<MaterialCatalog>>(
    CATALOG_STORE,
    MATERIALS_CATALOG_ID,
    database,
  );
  if (!record) return [];
  const validated = validateMaterialCatalog(record.data);
  return validated.materials;
}

/**
 * Load edge bands catalog from IndexedDB.
 */
export async function loadEdgeBandsFromDb(database?: IDBDatabase): Promise<EdgeBand[]> {
  await seedCatalogsIfEmpty(database);
  const record = await loadItem<StoredCatalog<EdgeBandCatalog>>(
    CATALOG_STORE,
    EDGE_BANDS_CATALOG_ID,
    database,
  );
  if (!record) return [];
  const validated = validateEdgeBandCatalog(record.data);
  return validated.edgeBands;
}

/**
 * Load hardware catalog from IndexedDB.
 */
export async function loadHardwareFromDb(database?: IDBDatabase): Promise<Hardware[]> {
  await seedCatalogsIfEmpty(database);
  const record = await loadItem<StoredCatalog<HardwareCatalog>>(
    CATALOG_STORE,
    HARDWARE_CATALOG_ID,
    database,
  );
  if (!record) return [];
  const validated = validateHardwareCatalog(record.data);
  return validated.hardware;
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

