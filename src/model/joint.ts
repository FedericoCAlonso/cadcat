import { z } from 'zod';
import { faceRefSchema, intervalSchema } from './common';

/**
 * Kind of joint connecting two piece faces.
 */
export const jointKindSchema = z.enum([
  'dowel',
  'cam-dowel',
  'confirmat',
  'rebate',
  'groove',
  'glue',
  'butt',
]);
export type JointKind = z.infer<typeof jointKindSchema>;

/**
 * Link between a face of one piece and a face of another piece.
 */
export const jointSchema = z.object({
  a: faceRefSchema,
  b: faceRefSchema,
  kind: jointKindSchema,
  offsetMm: z.number().optional(),
  region: intervalSchema.optional(),
});
export type Joint = z.infer<typeof jointSchema>;

/**
 * Validate and parse unknown data as a Joint.
 */
export function validateJoint(data: unknown): Joint {
  return jointSchema.parse(data);
}
