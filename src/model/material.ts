import { z } from 'zod';
import { capabilitySchema, shopValueSchema, TO_CONFIRM } from './common';

/**
 * Milling tolerance rules for a sheet material.
 */
export const millingToleranceSchema = z.object({
  hidden: z.enum(['yes', 'no']),
  visible: capabilitySchema,
  onStructuralPiece: z.enum(['yes', 'no', 'limited']),
  maxDepthMm: shopValueSchema.optional(),
});
export type MillingTolerance = z.infer<typeof millingToleranceSchema>;

/**
 * Sheet dimension value (number in mm or unconfirmed shop value).
 */
export const sheetDimensionSchema = z.union([
  z.number().positive(),
  z.literal(TO_CONFIRM),
]);
export type SheetDimension = z.infer<typeof sheetDimensionSchema>;

/**
 * Dimensions of a sheet of material in millimeters.
 */
export const sheetSizeSchema = z.object({
  length: sheetDimensionSchema,
  width: sheetDimensionSchema,
});
export type SheetSize = z.infer<typeof sheetSizeSchema>;

/**
 * Sheet material definition and properties.
 */
export const materialSchema = z.object({
  schemaVersion: z.number().int().positive().optional(),
  id: z.string().min(1),
  name: z.string().min(1),
  thicknessMm: z.union([z.number().positive(), z.literal(TO_CONFIRM)]),
  sheetSizeMm: sheetSizeSchema,
  hasGrain: z.boolean(),
  milling: millingToleranceSchema,
  heatResistant: z.boolean().optional(),
  elasticModulusMPa: shopValueSchema.optional(),
  pricePerSheet: shopValueSchema.optional(),
});
export type Material = z.infer<typeof materialSchema>;

/**
 * Catalog of sheet materials with schema version.
 */
export const materialCatalogSchema = z.object({
  schemaVersion: z.number().int().positive(),
  materials: z.array(materialSchema),
});
export type MaterialCatalog = z.infer<typeof materialCatalogSchema>;

/**
 * Validate and parse unknown data as a Material.
 */
export function validateMaterial(data: unknown): Material {
  return materialSchema.parse(data);
}

/**
 * Validate and parse unknown data as a MaterialCatalog.
 */
export function validateMaterialCatalog(data: unknown): MaterialCatalog {
  return materialCatalogSchema.parse(data);
}
