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
