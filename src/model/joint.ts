import { z } from 'zod';
import { faceRefSchema, intervalSchema } from './common';

/**
 * Kind of joint connecting two piece faces.
 */
export const jointKindSchema = z.enum([
  'dowel',
  'cam-dowel',
  'confirmat',
  'dowel-and-confirmat',
  'screw',
  'rebate',
  'groove',
  'glue',
  'butt',
  'hinge',
  'butt-hinge',
  'piano-hinge',
  'magnetic-catch',
  'push-catch',
  'roller-catch',
  'handle',
  'slide',
  'shelf-pin',
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
  doorOffsetMm: z.number().optional(),
  hingeSide: z.enum(['left', 'right', 'top', 'bottom']).optional(),
  region: intervalSchema.optional(),
  hingeCrank: z.enum(['codo-0', 'codo-9', 'codo-18']).optional(),
});
export type Joint = z.infer<typeof jointSchema>;

/**
 * Validate and parse unknown data as a Joint.
 */
export function validateJoint(data: unknown): Joint {
  return jointSchema.parse(data);
}
