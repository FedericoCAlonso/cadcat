import { z } from 'zod';
import { shopValueSchema, TO_CONFIRM } from './common';

/**
 * Kind of edge band applied to a panel edge.
 */
export const edgeBandKindSchema = z.enum([
  'adhesive',
  'aluminium-profile',
  'veneer',
  'rod',
]);
export type EdgeBandKind = z.infer<typeof edgeBandKindSchema>;

/**
 * Edge band definition and shop properties.
 */
export const edgeBandSchema = z.object({
  schemaVersion: z.number().int().positive().optional(),
  id: z.string().min(1),
  kind: edgeBandKindSchema,
  thicknessMm: z.union([z.number().nonnegative(), z.literal(TO_CONFIRM)]),
  pricePerMeter: shopValueSchema,
  needsGroove: z.boolean().optional(),
});
export type EdgeBand = z.infer<typeof edgeBandSchema>;

/**
 * Catalog of edge bands with schema version.
 */
export const edgeBandCatalogSchema = z.object({
  schemaVersion: z.number().int().positive(),
  edgeBands: z.array(edgeBandSchema),
});
export type EdgeBandCatalog = z.infer<typeof edgeBandCatalogSchema>;

/**
 * Validate and parse unknown data as an EdgeBand.
 */
export function validateEdgeBand(data: unknown): EdgeBand {
  return edgeBandSchema.parse(data);
}

/**
 * Validate and parse unknown data as an EdgeBandCatalog.
 */
export function validateEdgeBandCatalog(data: unknown): EdgeBandCatalog {
  return edgeBandCatalogSchema.parse(data);
}
