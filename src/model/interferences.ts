import { z } from 'zod';

export type ObstacleType = 'vertical-column' | 'horizontal-beam';
export type ObstacleReferenceEdge = 'left' | 'right' | 'top' | 'bottom';

/**
 * Architectural obstacle or interference (pillar, column, overhead beam, floor step)
 * positioned with respect to a reference datum edge and offset distance.
 */
export const columnObstacleSchema = z.object({
  enabled: z.boolean(),
  corner: z.enum(['back-left', 'back-right']).optional(),
  type: z.enum(['vertical-column', 'horizontal-beam']).optional(),
  referenceEdge: z.enum(['left', 'right', 'top', 'bottom']).optional(),
  distanceFromReferenceMm: z.number().nonnegative().optional(),
  widthMm: z.number().positive().optional(),
  depthMm: z.number().positive(),
  heightMm: z.number().positive().optional(),
});
export type ColumnObstacle = z.infer<typeof columnObstacleSchema>;
export type ParametricObstacle = ColumnObstacle;

/**
 * False square (pared en falsa escuadra / fuera de plomo).
 * Cabinet maintains a straight coplanar front at 90° with the reference side,
 * while depths at left and right corners absorb the wall diagonal.
 */
export const falseSquareSchema = z.object({
  enabled: z.boolean(),
  leftDepthMm: z.number().positive(),
  rightDepthMm: z.number().positive(),
});
export type FalseSquare = z.infer<typeof falseSquareSchema>;

/**
 * Complete Architectural Interferences configuration for a module.
 */
export const interferenceConfigSchema = z.object({
  columnObstacle: columnObstacleSchema.optional(),
  falseSquare: falseSquareSchema.optional(),
});
export type InterferenceConfig = z.infer<typeof interferenceConfigSchema>;

export const DEFAULT_COLUMN_OBSTACLE: ColumnObstacle = {
  enabled: false,
  corner: 'back-left',
  type: 'vertical-column',
  referenceEdge: 'left',
  distanceFromReferenceMm: 0,
  widthMm: 150,
  depthMm: 120,
};

export const DEFAULT_FALSE_SQUARE: FalseSquare = {
  enabled: false,
  leftDepthMm: 560,
  rightDepthMm: 520,
};

export const DEFAULT_INTERFERENCE_CONFIG: InterferenceConfig = {
  columnObstacle: DEFAULT_COLUMN_OBSTACLE,
  falseSquare: DEFAULT_FALSE_SQUARE,
};
