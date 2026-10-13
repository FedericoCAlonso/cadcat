import { z } from 'zod';
import { shopValueSchema } from './common';

/**
 * Hardware item used in furniture assembly.
 */
export const hardwareSchema = z.object({
  schemaVersion: z.number().int().positive().optional(),
  id: z.string().min(1),
  name: z.string().min(1),
  jointKind: z.string().min(1),
  pricePerUnit: shopValueSchema,
});
export type Hardware = z.infer<typeof hardwareSchema>;

/**
 * Catalog of hardware items with schema version.
 */
export const hardwareCatalogSchema = z.object({
  schemaVersion: z.number().int().positive(),
  hardware: z.array(hardwareSchema),
});
export type HardwareCatalog = z.infer<typeof hardwareCatalogSchema>;

/**
 * Validate and parse unknown data as a Hardware item.
 */
export function validateHardware(data: unknown): Hardware {
  return hardwareSchema.parse(data);
}

/**
 * Validate and parse unknown data as a HardwareCatalog.
 */
export function validateHardwareCatalog(data: unknown): HardwareCatalog {
  return hardwareCatalogSchema.parse(data);
}
