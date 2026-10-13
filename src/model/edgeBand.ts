import { z } from 'zod';
import { shopValueSchema } from './common';

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
  thicknessMm: z.number().nonnegative(),
  pricePerMeter: shopValueSchema,
  needsGroove: z.boolean().optional(),
});
export type EdgeBand = z.infer<typeof edgeBandSchema>;

/**
 * Validate and parse unknown data as an EdgeBand.
 */
export function validateEdgeBand(data: unknown): EdgeBand {
  return edgeBandSchema.parse(data);
}
