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
  name: z.string().min(1).optional(),
  kind: edgeBandKindSchema,
  thicknessMm: z.union([z.number().nonnegative(), z.literal(TO_CONFIRM)]),
  pricePerMeter: shopValueSchema,
  needsGroove: z.boolean().optional(),
  /** Whether the edge band thickness is deducted from the panel cut size (false for thin 0.45mm melamine tape or full pre-milling). */
  deductFromCut: z.boolean().optional(),
  /** Optional edgebander pre-milling depth (mm) already compensated by the machine. */
  preMillingMm: z.number().nonnegative().optional(),
});
export type EdgeBand = z.infer<typeof edgeBandSchema>;

export const pieceEdgeBandOverrideSchema = z.object({
  top: z.boolean().optional(),
  bottom: z.boolean().optional(),
  left: z.boolean().optional(),
  right: z.boolean().optional(),
  edgeBandId: z.string().optional(),
});
export type PieceEdgeBandOverrideModel = z.infer<typeof pieceEdgeBandOverrideSchema>;

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
