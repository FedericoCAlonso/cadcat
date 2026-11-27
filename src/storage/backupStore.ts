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
import { CONFIG_STORE } from './configService';
import { PROJECTS_STORE } from './projectStore';
import { USER_TEMPLATE_STORE } from './userTemplateStore';
import { openDatabase } from './db';
import { validateProject, validateProjectConfig, validateUserTemplate } from '../model';

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
 * Persists all entities from a validated CadCatBackupBundle into IndexedDB atomically
 * using a single multi-store readwrite transaction.
 */
export async function importBackupBundleToDb(
  bundle: CadCatBackupBundle,
  database?: IDBDatabase,
): Promise<void> {
  // Pre-validate everything in memory before mutating IndexedDB
  const validated = validateBackupBundle(bundle);
  const matCatalog = validated.materials.length > 0
    ? validateMaterialCatalog({ schemaVersion: 1, materials: validated.materials })
    : null;
  const ebCatalog = validated.edgeBands.length > 0
    ? validateEdgeBandCatalog({ schemaVersion: 1, edgeBands: validated.edgeBands })
    : null;
  const hwCatalog = validated.hardware.length > 0
    ? validateHardwareCatalog({ schemaVersion: 1, hardware: validated.hardware })
    : null;
  const validatedConfig = validated.projectConfig
    ? validateProjectConfig(validated.projectConfig)
    : null;
  const validatedProjects = validated.projects.map((p) => validateProject(p));
  const validatedTemplates = validated.userTemplates.map((t) => validateUserTemplate(t));

  const db = database ?? (await openDatabase());
  const shouldClose = !database;

  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        [CATALOG_STORE, CONFIG_STORE, PROJECTS_STORE, USER_TEMPLATE_STORE],
        'readwrite',
      );
      const catalogStore = tx.objectStore(CATALOG_STORE);
      const configStore = tx.objectStore(CONFIG_STORE);
      const projectsStore = tx.objectStore(PROJECTS_STORE);
      const templatesStore = tx.objectStore(USER_TEMPLATE_STORE);

      if (matCatalog) {
        catalogStore.put({ id: MATERIALS_CATALOG_ID, schemaVersion: 1, data: matCatalog });
      }
      if (ebCatalog) {
        catalogStore.put({ id: EDGE_BANDS_CATALOG_ID, schemaVersion: 1, data: ebCatalog });
      }
      if (hwCatalog) {
        catalogStore.put({ id: HARDWARE_CATALOG_ID, schemaVersion: 1, data: hwCatalog });
      }
      if (validatedConfig) {
        configStore.put({
          id: validatedConfig.projectId,
          schemaVersion: 1,
          data: validatedConfig,
        });
      }

      projectsStore.clear();
      for (const proj of validatedProjects) {
        projectsStore.put({
          id: proj.id,
          schemaVersion: proj.schemaVersion,
          project: proj,
        });
      }

      templatesStore.clear();
      for (const tpl of validatedTemplates) {
        templatesStore.put({
          id: tpl.id,
          schemaVersion: 1,
          data: tpl,
        });
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to import backup bundle atomically'));
      tx.onabort = () => reject(tx.error ?? new Error('Backup import transaction aborted'));
    });
  } finally {
    if (shouldClose) {
      db.close();
    }
  }
}
