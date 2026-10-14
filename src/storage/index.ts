export {
  type StoredEntity,
  DB_NAME,
  DB_VERSION,
  DEFAULT_STORES,
  getIndexedDbFactory,
  openDatabase,
  saveItem,
  loadItem,
  deleteItem,
  listItems,
  clearStore,
  deleteDatabase,
} from './db';

export {
  type StoredCatalog,
  CATALOG_STORE,
  MATERIALS_CATALOG_ID,
  EDGE_BANDS_CATALOG_ID,
  HARDWARE_CATALOG_ID,
  seedCatalogsIfEmpty,
  loadMaterialsFromDb,
  loadEdgeBandsFromDb,
  loadHardwareFromDb,
  saveMaterialToDb,
  deleteMaterialFromDb,
  saveEdgeBandToDb,
  deleteEdgeBandFromDb,
  saveHardwareToDb,
  deleteHardwareFromDb,
  resetCatalogsToSeed,
} from './catalogStore';

export {
  type StoredProjectConfig,
  type IConfigService,
  ProjectConfigService,
  projectConfigService,
  CONFIG_STORE,
  DEFAULT_PROJECT_ID,
  getDefaultProjectConfig,
  loadProjectConfigFromDb,
  saveProjectConfigToDb,
  exportProjectConfigJson,
  importProjectConfigJson,
} from './projectConfigStore';

export {
  type StoredUserTemplate,
  USER_TEMPLATE_STORE,
  loadUserTemplatesFromDb,
  saveUserTemplateToDb,
  deleteUserTemplateFromDb,
  loadUserTemplateById,
} from './userTemplateStore';

