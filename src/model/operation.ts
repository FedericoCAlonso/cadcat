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

export const customDrillOperationSchema = z.object({
  kind: z.literal('drill'),
  id: z.string().min(1),
  pieceId: z.string().min(1),
  faceType: faceTypeSchema,
  xMm: z.number().min(0),
  yMm: z.number().min(0),
  diameterMm: z.number().positive(),
  depthMm: z.number().positive(),
  isThrough: z.boolean(),
  description: z.string().optional(),
});
export type CustomDrillOperation = z.infer<typeof customDrillOperationSchema>;

export const customGrooveOperationSchema = z.object({
  kind: z.literal('groove'),
  id: z.string().min(1),
  pieceId: z.string().min(1),
  faceType: faceTypeSchema,
  axis: z.enum(['x', 'y']), // 'x' runs horizontally across width, 'y' runs vertically across height
  offsetMm: z.number().min(0), // distance from datum edge (bottom for 'x', left for 'y')
  widthMm: z.number().positive(), // groove width in mm
  depthMm: z.number().positive(), // depth into thickness
  startMm: z.number().min(0).optional(),
  lengthMm: z.number().positive().optional(),
  description: z.string().optional(),
});
export type CustomGrooveOperation = z.infer<typeof customGrooveOperationSchema>;

export const customRebateOperationSchema = z.object({
  kind: z.literal('rebate'),
  id: z.string().min(1),
  pieceId: z.string().min(1),
  faceType: faceTypeSchema,
  edge: z.enum(['top', 'bottom', 'left', 'right']),
  widthMm: z.number().positive(), // step width into face from edge
  depthMm: z.number().positive(), // step depth into thickness
  description: z.string().optional(),
});
export type CustomRebateOperation = z.infer<typeof customRebateOperationSchema>;

export const customPocketOperationSchema = z.object({
  kind: z.literal('cutout'),
  id: z.string().min(1),
  pieceId: z.string().min(1),
  faceType: faceTypeSchema,
  xMm: z.number().min(0),
  yMm: z.number().min(0),
  widthMm: z.number().positive(),
  heightMm: z.number().positive(),
  depthMm: z.number().positive(),
  isThrough: z.boolean(),
  description: z.string().optional(),
});
export type CustomPocketOperation = z.infer<typeof customPocketOperationSchema>;

export const customPieceOperationSchema = z.discriminatedUnion('kind', [
  customDrillOperationSchema,
  customGrooveOperationSchema,
  customRebateOperationSchema,
  customPocketOperationSchema,
]);
export type CustomPieceOperation = z.infer<typeof customPieceOperationSchema>;

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

export function customDrillToDrillOperation(cd: CustomDrillOperation): DrillOperation {
  return {
    schemaVersion: 1,
    id: cd.id,
    pieceId: cd.pieceId,
    faceId: cd.faceType === 'face-B' ? 'outer' : 'inner',
    faceType: cd.faceType,
    diameterMm: cd.diameterMm,
    depthMm: cd.depthMm,
    isThrough: cd.isThrough,
    positionMm: { x: cd.xMm, y: cd.yMm },
    origin: 'manual',
    description: cd.description ?? 'Perforación manual',
  };
}

export const pieceMachiningSchema = z.object({
  schemaVersion: z.literal(1),
  pieceId: z.string().min(1),
  role: z.string().min(1),
  operations: z.array(drillOperationSchema),
  customOperations: z.array(customPieceOperationSchema).optional(),
  requiresTurn: z.boolean(), // true if operations exist on both Face A and Face B, or on Face B
});
export type PieceMachining = z.infer<typeof pieceMachiningSchema>;

