import { type Project, validateProject } from '../model';
import { saveItem, loadItem, deleteItem, openDatabase, type StoredEntity } from './db';

export const PROJECTS_STORE = 'projects';

export interface StoredProject extends StoredEntity {
  id: string;
  schemaVersion: number;
  project: Project;
}

/**
 * Persists a complete Project entity to IndexedDB.
 */
export async function saveProjectToDb(project: Project, database?: IDBDatabase): Promise<void> {
  const stored: StoredProject = {
    id: project.id,
    schemaVersion: project.schemaVersion,
    project,
  };
  await saveItem(PROJECTS_STORE, stored, database);
}

/**
 * Loads a project by ID from IndexedDB.
 */
export async function loadProjectFromDb(id: string, database?: IDBDatabase): Promise<Project | null> {
  const item = await loadItem<StoredProject>(PROJECTS_STORE, id, database);
  if (!item?.project) return null;
  return validateProject(item.project);
}

/**
 * Loads all projects from IndexedDB.
 */
export async function loadAllProjectsFromDb(database?: IDBDatabase): Promise<Project[]> {
  const db = database ?? (await openDatabase());
  const shouldClose = !database;

  try {
    return await new Promise<Project[]>((resolve, reject) => {
      const transaction = db.transaction(PROJECTS_STORE, 'readonly');
      const store = transaction.objectStore(PROJECTS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const items = (request.result as StoredProject[]) || [];
        const valid = items
          .map((item) => {
            try {
              return validateProject(item.project);
            } catch {
              return null;
            }
          })
          .filter((p): p is Project => p !== null);
        resolve(valid);
      };
      request.onerror = () => reject(request.error ?? new Error('Failed to load projects'));
    });
  } finally {
    if (shouldClose) {
      db.close();
    }
  }
}

/**
 * Deletes a project by ID from IndexedDB.
 */
export async function deleteProjectFromDb(id: string, database?: IDBDatabase): Promise<void> {
  await deleteItem(PROJECTS_STORE, id, database);
}

/**
 * Exports project as formatted JSON string.
 */
export function exportProjectJson(project: Project): string {
  return JSON.stringify(project, null, 2);
}

/**
 * Imports and validates project from JSON string.
 */
export function importProjectJson(json: string): Project {
  const parsed = JSON.parse(json);
  return validateProject(parsed);
}
