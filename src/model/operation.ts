import { z } from 'zod';

export const operationKindSchema = z.enum([
  'drill',
  'groove',
  'rebate',
  'cutout',
  'profile-route',
]);
export type OperationKind = z.infer<typeof operationKindSchema>;

export const faceTypeSchema = z.enum(['face-A', 'face-B', 'edge']);
export type FaceType = z.infer<typeof faceTypeSchema>;

export const drillOperationSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  pieceId: z.string().min(1),
  faceId: z.string().min(1),
  faceType: faceTypeSchema,
  diameterMm: z.number().positive(),
  depthMm: z.number().positive(),
  isThrough: z.boolean(),
  positionMm: z.object({
    x: z.number(),
    y: z.number(),
  }),
  origin: z.enum(['derived', 'manual']),
  sourceJointKind: z.string().optional(),
  description: z.string().optional(),
});
export type DrillOperation = z.infer<typeof drillOperationSchema>;

export const pieceMachiningSchema = z.object({
  schemaVersion: z.literal(1),
  pieceId: z.string().min(1),
  role: z.string().min(1),
  operations: z.array(drillOperationSchema),
  requiresTurn: z.boolean(), // true if operations exist on both Face A and Face B, or on Face B
});
export type PieceMachining = z.infer<typeof pieceMachiningSchema>;
