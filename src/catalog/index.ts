import rawMaterials from './materials.json';
import rawEdgeBands from './edgeBands.json';
import rawHardware from './hardware.json';
import {
  validateMaterialCatalog,
  validateEdgeBandCatalog,
  validateHardwareCatalog,
  type MaterialCatalog,
  type EdgeBandCatalog,
  type HardwareCatalog,
} from '../model';

/**
 * Load and validate the seed materials catalog.
 */
export function getSeedMaterials(): MaterialCatalog {
  return validateMaterialCatalog(rawMaterials);
}

/**
 * Load and validate the seed edge bands catalog.
 */
export function getSeedEdgeBands(): EdgeBandCatalog {
  return validateEdgeBandCatalog(rawEdgeBands);
}

/**
 * Load and validate the seed hardware catalog.
 */
export function getSeedHardware(): HardwareCatalog {
  return validateHardwareCatalog(rawHardware);
}

export { rawMaterials, rawEdgeBands, rawHardware };
