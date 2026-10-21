import { z } from 'zod';
import { contourSchema } from './common';

/**
 * Surface or edge of a piece.
 */
export const faceSchema = z.object({
  id: z.string().min(1),
  visible: z.boolean(),
  edgeBandId: z.string().optional(),
});
export type Face = z.infer<typeof faceSchema>;

/**
 * Secondary manual or CNC shop operation performed on a raw rectangular cut
 * (e.g., column notches, false square diagonal bevels, cable pass-throughs).
 */
export const secondaryCutSchema = z.object({
  type: z.enum(['notch', 'bevel-diagonal', 'corner-chamfer', 'custom-polygon']),
  description: z.string(),
  corner: z.enum(['back-left', 'back-right', 'front-left', 'front-right', 'top-rear', 'bottom-rear', 'intermediate-rear']).optional(),
  widthMm: z.number().optional(),
  depthMm: z.number().optional(),
  angleDeg: z.number().optional(),
});
export type SecondaryCut = z.infer<typeof secondaryCutSchema>;

/**
 * Panel piece owned by a module.
 */
export const pieceSchema = z.object({
  id: z.string().min(1),
  role: z.string().min(1),
  materialId: z.string().min(1),
  contour: contourSchema,
  thicknessMm: z.number().positive(),
  faces: z.array(faceSchema),
  structural: z.boolean(),
  referenceFace: z.enum(['A', 'B']),
  isAuxiliary: z.boolean().optional(),
  rawBoundingBox: z.object({
    widthMm: z.number().positive(),
    heightMm: z.number().positive(),
  }).optional(),
  secondaryCuts: z.array(secondaryCutSchema).optional(),
  notes: z.array(z.string()).optional(),
});
export type Piece = z.infer<typeof pieceSchema>;

/**
 * Validate and parse unknown data as a Piece.
 */
export function validatePiece(data: unknown): Piece {
  return pieceSchema.parse(data);
}

/**
 * Validate and parse unknown data as a Face.
 */
export function validateFace(data: unknown): Face {
  return faceSchema.parse(data);
}
