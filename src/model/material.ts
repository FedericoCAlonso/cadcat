import { z } from 'zod';
import { capabilitySchema, shopValueSchema } from './common';

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
 * Dimensions of a sheet of material in millimeters.
 */
export const sheetSizeSchema = z.object({
  length: z.number().positive(),
  width: z.number().positive(),
});
export type SheetSize = z.infer<typeof sheetSizeSchema>;

/**
 * Sheet material definition and properties.
 */
export const materialSchema = z.object({
  schemaVersion: z.number().int().positive().optional(),
  id: z.string().min(1),
  name: z.string().min(1),
  thicknessMm: z.number().positive(),
  sheetSizeMm: sheetSizeSchema,
  hasGrain: z.boolean(),
  milling: millingToleranceSchema,
  heatResistant: z.boolean().optional(),
  elasticModulusMPa: shopValueSchema.optional(),
  pricePerSheet: shopValueSchema.optional(),
});
export type Material = z.infer<typeof materialSchema>;

/**
 * Validate and parse unknown data as a Material.
 */
export function validateMaterial(data: unknown): Material {
  return materialSchema.parse(data);
}
