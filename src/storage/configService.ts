import {
  type ProjectConfig,
  validateProjectConfig,
} from '../model';
import {
  saveItem,
  loadItem,
  type StoredEntity,
} from './db';
import { loadDefaultProjectConfigFile } from '../config';

export interface StoredProjectConfig extends StoredEntity {
  data: ProjectConfig;
}

export const CONFIG_STORE = 'configs';
export const DEFAULT_PROJECT_ID = 'default-project';

/**
 * Interface representing project configuration management (DIP).
 */
export interface IConfigService {
  getDefaultConfig(): ProjectConfig;
  loadConfig(projectId?: string, database?: IDBDatabase): Promise<ProjectConfig>;
  saveConfig(config: ProjectConfig, database?: IDBDatabase): Promise<void>;
  exportConfigJson(config: ProjectConfig): string;
  importConfigJson(jsonString: string): ProjectConfig;
}

/**
 * Service implementation managing project configuration persistence and validation (SRP).
 */
export class ProjectConfigService implements IConfigService {
  /**
   * Loads baseline project configuration directly from configuration file.
   */
  public getDefaultConfig(): ProjectConfig {
    return loadDefaultProjectConfigFile();
  }

  /**
   * Loads project configuration from IndexedDB.
   * If not yet in database, seeds it from the configuration file.
   */
  public async loadConfig(
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
        // Fallback to validated config file default if corrupted
        const defaultConf = this.getDefaultConfig();
        await this.saveConfig({ ...defaultConf, projectId }, database);
        return { ...defaultConf, projectId };
      }
    }

    // Seed into database from config file
    const defaultConf = this.getDefaultConfig();
    const seeded: ProjectConfig = { ...defaultConf, projectId };
    await this.saveConfig(seeded, database);
    return seeded;
  }

  /**
   * Persists project configuration to IndexedDB after validation.
   */
  public async saveConfig(
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
   * Serializes project configuration to formatted JSON string.
   */
  public exportConfigJson(config: ProjectConfig): string {
    const validated = validateProjectConfig(config);
    return JSON.stringify(validated, null, 2);
  }

  /**
   * Parses and validates uploaded configuration JSON string.
   */
  public importConfigJson(jsonString: string): ProjectConfig {
    const parsed = JSON.parse(jsonString) as unknown;
    return validateProjectConfig(parsed);
  }
}

/**
 * Default singleton instance of ProjectConfigService.
 */
export const projectConfigService: IConfigService = new ProjectConfigService();
