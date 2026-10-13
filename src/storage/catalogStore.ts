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
