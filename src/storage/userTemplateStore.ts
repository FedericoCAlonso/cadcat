import { type UserTemplate, validateUserTemplate } from '../model';
import { saveItem, loadItem, deleteItem, listItems, type StoredEntity } from './db';

export const USER_TEMPLATE_STORE = 'user_templates';

export interface StoredUserTemplate extends StoredEntity {
  data: UserTemplate;
}

/**
 * Load all user-created templates from IndexedDB.
 */
export async function loadUserTemplatesFromDb(database?: IDBDatabase): Promise<UserTemplate[]> {
  const records = await listItems<StoredUserTemplate>(USER_TEMPLATE_STORE, database);
  return records
    .map((r) => {
      try {
        return validateUserTemplate(r.data);
      } catch {
        return null;
      }
    })
    .filter((t): t is UserTemplate => t !== null);
}

/**
 * Save or update a user template in IndexedDB.
 */
export async function saveUserTemplateToDb(
  template: UserTemplate,
  database?: IDBDatabase,
): Promise<void> {
  const validated = validateUserTemplate(template);
  const record: StoredUserTemplate = {
    id: validated.id,
    schemaVersion: 1,
    data: validated,
  };
  await saveItem(USER_TEMPLATE_STORE, record, database);
}

/**
 * Delete a user template by id from IndexedDB.
 */
export async function deleteUserTemplateFromDb(
  id: string,
  database?: IDBDatabase,
): Promise<void> {
  await deleteItem(USER_TEMPLATE_STORE, id, database);
}

/**
 * Load a single user template by id from IndexedDB.
 */
export async function loadUserTemplateById(
  id: string,
  database?: IDBDatabase,
): Promise<UserTemplate | null> {
  const record = await loadItem<StoredUserTemplate>(USER_TEMPLATE_STORE, id, database);
  if (!record) return null;
  return validateUserTemplate(record.data);
}
