import {
  BACKUP_BUNDLE_FORMAT,
  type CadCatBackupBundle,
  type Material,
  type EdgeBand,
  type Hardware,
  type Project,
  type ProjectConfig,
  type UserTemplate,
  validateBackupBundle,
  validateMaterialCatalog,
  validateEdgeBandCatalog,
  validateHardwareCatalog,
} from '../model';
import {
  CATALOG_STORE,
  EDGE_BANDS_CATALOG_ID,
  HARDWARE_CATALOG_ID,
  MATERIALS_CATALOG_ID,
} from './catalogStore';
import { saveProjectConfigToDb } from './projectConfigStore';
import { saveProjectToDb } from './projectStore';
import { saveUserTemplateToDb } from './userTemplateStore';
import { clearStore, openDatabase, saveItem } from './db';
import { USER_TEMPLATE_STORE } from './userTemplateStore';
import { PROJECTS_STORE } from './projectStore';

export interface BuildBackupBundleInput {
  appVersion?: string;
  projects: Project[];
  projectConfig: ProjectConfig | null;
  materials: Material[];
  edgeBands: EdgeBand[];
  hardware: Hardware[];
  userTemplates: UserTemplate[];
}

/**
 * Builds and validates a formatted JSON string for a complete CadCat backup bundle.
 */
export function buildBackupBundleJson(input: BuildBackupBundleInput): string {
  const bundle: CadCatBackupBundle = validateBackupBundle({
    format: BACKUP_BUNDLE_FORMAT,
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    appVersion: input.appVersion,
    projects: input.projects,
    projectConfig: input.projectConfig,
    materials: input.materials,
    edgeBands: input.edgeBands,
    hardware: input.hardware,
    userTemplates: input.userTemplates,
  });
  return JSON.stringify(bundle, null, 2);
}

/**
 * Parses and validates a .cadcat.json backup bundle string.
 */
export function parseBackupBundleJson(jsonString: string): CadCatBackupBundle {
  const parsed: unknown = JSON.parse(jsonString);
  return validateBackupBundle(parsed);
}

/**
 * Persists all entities from a validated CadCatBackupBundle into IndexedDB.
 */
export async function importBackupBundleToDb(
  bundle: CadCatBackupBundle,
  database?: IDBDatabase,
): Promise<void> {
  const validated = validateBackupBundle(bundle);
  const db = database ?? (await openDatabase());
  const shouldClose = !database;

  try {
    if (validated.materials.length > 0) {
      const matCatalog = validateMaterialCatalog({ schemaVersion: 1, materials: validated.materials });
      await saveItem(CATALOG_STORE, { id: MATERIALS_CATALOG_ID, schemaVersion: 1, data: matCatalog }, db);
    }

    if (validated.edgeBands.length > 0) {
      const ebCatalog = validateEdgeBandCatalog({ schemaVersion: 1, edgeBands: validated.edgeBands });
      await saveItem(CATALOG_STORE, { id: EDGE_BANDS_CATALOG_ID, schemaVersion: 1, data: ebCatalog }, db);
    }

    if (validated.hardware.length > 0) {
      const hwCatalog = validateHardwareCatalog({ schemaVersion: 1, hardware: validated.hardware });
      await saveItem(CATALOG_STORE, { id: HARDWARE_CATALOG_ID, schemaVersion: 1, data: hwCatalog }, db);
    }

    if (validated.projectConfig) {
      await saveProjectConfigToDb(validated.projectConfig, db);
    }

    await clearStore(PROJECTS_STORE, db);
    for (const proj of validated.projects) {
      await saveProjectToDb(proj, db);
    }

    await clearStore(USER_TEMPLATE_STORE, db);
    for (const tpl of validated.userTemplates) {
      await saveUserTemplateToDb(tpl, db);
    }
  } finally {
    if (shouldClose) {
      db.close();
    }
  }
}
