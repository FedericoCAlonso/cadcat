import { type ProjectConfig } from '../model';
import {
  ProjectConfigService,
  projectConfigService,
  type IConfigService,
  type StoredProjectConfig,
  CONFIG_STORE,
  DEFAULT_PROJECT_ID,
} from './configService';

export {
  type StoredProjectConfig,
  type IConfigService,
  ProjectConfigService,
  projectConfigService,
  CONFIG_STORE,
  DEFAULT_PROJECT_ID,
};

/**
 * Loads baseline project configuration directly from configuration file.
 */
export function getDefaultProjectConfig(): ProjectConfig {
  return projectConfigService.getDefaultConfig();
}

/**
 * Loads project configuration from IndexedDB.
 * If not yet in database, seeds it from the configuration file.
 */
export async function loadProjectConfigFromDb(
  projectId = DEFAULT_PROJECT_ID,
  database?: IDBDatabase,
): Promise<ProjectConfig> {
  return projectConfigService.loadConfig(projectId, database);
}

/**
 * Persists project configuration to IndexedDB.
 */
export async function saveProjectConfigToDb(
  config: ProjectConfig,
  database?: IDBDatabase,
): Promise<void> {
  return projectConfigService.saveConfig(config, database);
}

/**
 * Serializes project configuration to a downloadable JSON string.
 */
export function exportProjectConfigJson(config: ProjectConfig): string {
  return projectConfigService.exportConfigJson(config);
}

/**
 * Parses and validates an uploaded project configuration JSON string.
 */
export function importProjectConfigJson(jsonString: string): ProjectConfig {
  return projectConfigService.importConfigJson(jsonString);
}
