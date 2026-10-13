import { z } from 'zod';

/**
 * Placeholder for shop values that domain expert must confirm.
 */
export const TO_CONFIRM = 'TO_CONFIRM' as const;

/**
 * A shop value can be a confirmed numeric value or 'TO_CONFIRM'.
 */
export const shopValueSchema = z.union([z.number(), z.literal(TO_CONFIRM)]);
export type ShopValue = z.infer<typeof shopValueSchema>;

/**
 * Capability state for operations on materials.
 */
export const capabilitySchema = z.enum(['yes', 'no', 'with-accessory']);
export type Capability = z.infer<typeof capabilitySchema>;

/**
 * 2D coordinate point.
 */
export const point2DSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type Point2D = z.infer<typeof point2DSchema>;

/**
 * 2D contour polygon with optional internal holes.
 */
export const contourSchema = z.object({
  points: z.array(point2DSchema).min(3),
  holes: z.array(z.array(point2DSchema).min(3)).optional(),
});
export type Contour = z.infer<typeof contourSchema>;

/**
 * 1D interval along a face edge or segment.
 */
export const intervalSchema = z.object({
  start: z.number(),
  end: z.number(),
});
export type Interval = z.infer<typeof intervalSchema>;

/**
 * Reference to a specific face of a piece.
 */
export const faceRefSchema = z.object({
  pieceId: z.string().min(1),
  faceId: z.string().min(1),
});
export type FaceRef = z.infer<typeof faceRefSchema>;
