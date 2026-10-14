/**
 * Base interface for all stored JSON entities.
 * Every stored item must have a string id and a schemaVersion number.
 */
export interface StoredEntity {
  id: string;
  schemaVersion: number;
}

export const DB_NAME = 'mobilius_db';
export const DB_VERSION = 3;
export const DEFAULT_STORES = ['modules', 'catalogs', 'configs', 'user_templates'] as const;

/**
 * Get the IndexedDB factory from the current environment.
 */
export function getIndexedDbFactory(): IDBFactory {
  if (typeof indexedDB !== 'undefined') {
    return indexedDB;
  }
  if (typeof window !== 'undefined' && window.indexedDB) {
    return window.indexedDB;
  }
  throw new Error('IndexedDB is not supported in this environment');
}

/**
 * Open the IndexedDB database.
 * Creates required object stores if they do not exist.
 */
export async function openDatabase(
  dbName = DB_NAME,
  version = DB_VERSION,
  storeNames: readonly string[] = DEFAULT_STORES,
): Promise<IDBDatabase> {
  const idb = getIndexedDbFactory();

  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = idb.open(dbName, version);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const storeName of storeNames) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open database'));
  });
}

/**
 * Helper to acquire a database connection.
 */
async function acquireDb(database?: IDBDatabase): Promise<{ db: IDBDatabase; autoClose: boolean }> {
  if (database) {
    return { db: database, autoClose: false };
  }
  const db = await openDatabase();
  return { db, autoClose: true };
}

/**
 * Save an entity to an object store.
 * The entity must include an id and a schemaVersion.
 */
export async function saveItem<T extends StoredEntity>(
  storeName: string,
  item: T,
  database?: IDBDatabase,
): Promise<void> {
  if (!item.id || typeof item.schemaVersion !== 'number') {
    throw new Error('Item must have a non-empty id and a numeric schemaVersion');
  }

  const { db, autoClose } = await acquireDb(database);
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('Failed to save item'));
    });
  } finally {
    if (autoClose) {
      db.close();
    }
  }
}

/**
 * Load an entity by id from an object store.
 * Returns null if the entity does not exist.
 */
export async function loadItem<T extends StoredEntity>(
  storeName: string,
  id: string,
  database?: IDBDatabase,
): Promise<T | null> {
  const { db, autoClose } = await acquireDb(database);
  try {
    return await new Promise<T | null>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);
      request.onsuccess = () => {
        const result = request.result as T | undefined;
        resolve(result ?? null);
      };
      request.onerror = () => reject(request.error ?? new Error('Failed to load item'));
    });
  } finally {
    if (autoClose) {
      db.close();
    }
  }
}

/**
 * Delete an entity by id from an object store.
 */
export async function deleteItem(
  storeName: string,
  id: string,
  database?: IDBDatabase,
): Promise<void> {
  const { db, autoClose } = await acquireDb(database);
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('Failed to delete item'));
    });
  } finally {
    if (autoClose) {
      db.close();
    }
  }
}

/**
 * List all entities in an object store.
 */
export async function listItems<T extends StoredEntity>(
  storeName: string,
  database?: IDBDatabase,
): Promise<T[]> {
  const { db, autoClose } = await acquireDb(database);
  try {
    return await new Promise<T[]>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => {
        const result = (request.result as T[] | undefined) ?? [];
        resolve(result);
      };
      request.onerror = () => reject(request.error ?? new Error('Failed to list items'));
    });
  } finally {
    if (autoClose) {
      db.close();
    }
  }
}

/**
 * Clear all items in an object store.
 */
export async function clearStore(
  storeName: string,
  database?: IDBDatabase,
): Promise<void> {
  const { db, autoClose } = await acquireDb(database);
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('Failed to clear store'));
    });
  } finally {
    if (autoClose) {
      db.close();
    }
  }
}

/**
 * Delete the entire database.
 */
export async function deleteDatabase(dbName = DB_NAME): Promise<void> {
  const idb = getIndexedDbFactory();
  await new Promise<void>((resolve, reject) => {
    const request = idb.deleteDatabase(dbName);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Failed to delete database'));
    request.onblocked = () => resolve();
  });
}
