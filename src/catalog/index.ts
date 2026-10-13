import rawMaterials from './materials.json';
import rawEdgeBands from './edgeBands.json';
import {
  validateMaterialCatalog,
  validateEdgeBandCatalog,
  type MaterialCatalog,
  type EdgeBandCatalog,
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

export { rawMaterials, rawEdgeBands };
