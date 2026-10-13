import {
  type ProjectConfig,
  validateProjectConfig,
} from '../model';
import {
  saveItem,
  loadItem,
  type StoredEntity,
} from './db';
import defaultProjectConfigJson from '../config/defaultProjectConfig.json';

export interface StoredProjectConfig extends StoredEntity {
  data: ProjectConfig;
}

export const CONFIG_STORE = 'configs';
export const DEFAULT_PROJECT_ID = 'default-project';

/**
 * Loads baseline project configuration directly from configuration file.
 */
export function getDefaultProjectConfig(): ProjectConfig {
  return validateProjectConfig(defaultProjectConfigJson);
}

/**
 * Loads project configuration from IndexedDB.
 * If not yet in database, seeds it from the configuration file.
 */
export async function loadProjectConfigFromDb(
  projectId = DEFAULT_PROJECT_ID,
  database?: IDBDatabase,
): Promise<ProjectConfig> {
  const existing = await loadItem<StoredProjectConfig>(
    CONFIG_STORE,
    projectId,
    database,
  );

  if (existing && existing.data) {
    try {
      return validateProjectConfig(existing.data);
    } catch {
      // In case of schema upgrade or corrupted record, fallback to default
      const defaultConf = getDefaultProjectConfig();
      await saveProjectConfigToDb({ ...defaultConf, projectId }, database);
      return { ...defaultConf, projectId };
    }
  }

  // Seed into database from config file
  const defaultConf = getDefaultProjectConfig();
  const seeded: ProjectConfig = { ...defaultConf, projectId };
  await saveProjectConfigToDb(seeded, database);
  return seeded;
}

/**
 * Persists project configuration to IndexedDB.
 */
export async function saveProjectConfigToDb(
  config: ProjectConfig,
  database?: IDBDatabase,
): Promise<void> {
  const validated = validateProjectConfig(config);
  await saveItem<StoredProjectConfig>(
    CONFIG_STORE,
    {
      id: validated.projectId,
      schemaVersion: 1,
      data: validated,
    },
    database,
  );
}

/**
 * Serializes project configuration to a downloadable JSON string.
 */
export function exportProjectConfigJson(config: ProjectConfig): string {
  const validated = validateProjectConfig(config);
  return JSON.stringify(validated, null, 2);
}

/**
 * Parses and validates an uploaded project configuration JSON string.
 */
export function importProjectConfigJson(jsonString: string): ProjectConfig {
  const parsed = JSON.parse(jsonString) as unknown;
  return validateProjectConfig(parsed);
}
