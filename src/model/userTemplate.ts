import { z } from 'zod';
import { jointKindSchema } from './joint';

export const roofTypeSchema = z.enum(['solid-panel', 'front-back-rails', 'none']);
export const jointPrioritySchema = z.enum(['lateral-over-bottom', 'bottom-over-lateral', 'miter-45']);

export const trackSizeSchema = z.union([
  z.object({
    type: z.literal('fixed'),
    valueMm: z.number().positive(),
  }),
  z.object({
    type: z.literal('fractional'),
    valueFr: z.number().positive(),
  }),
]);

export type BayContentSchemaType =
  | { type: 'empty' }
  | {
      type: 'shelves';
      count: number;
      shelfType: 'adjustable' | 'fixed';
      setbackMm?: number;
      hasAntiSagBrace?: boolean;
    }
  | {
      type: 'drawer-stack';
      drawerTracks: Array<{ type: 'fixed'; valueMm: number } | { type: 'fractional'; valueFr: number }>;
      frontMount: 'applied' | 'inset';
      hasTransomDividers?: boolean;
      slideType: 'telescopic' | 'undermount' | 'metal-box' | 'roller' | 'wood-runner';
      gapMm?: number;
      boxHeightRatio?: number;
    }
  | {
      type: 'pull-out-tray';
      lipHeightMm?: number;
      slideType: 'telescopic' | 'undermount';
      clearanceDeductionMm?: number;
      elevationYMm?: number;
    }
  | {
      type: 'doors';
      count: 1 | 2;
      hingeSide?: 'left' | 'right';
      mountType: 'full-overlay' | 'half-overlay' | 'inset' | 'overlay' | 'codo-0' | 'codo-9' | 'codo-18';
      interiorShelvesCount?: number;
      shelfType?: 'adjustable' | 'fixed';
      shelvesSetbackMm?: number;
    }
  | {
      type: 'bi-fold-closure';
      leafTracks?: Array<{ type: 'fixed'; valueMm: number } | { type: 'fractional'; valueFr: number }>;
      hingeType: 'bifold-center' | 'piano' | 'aventos';
      openingDirection: 'vertical-lift' | 'horizontal-book';
      interiorShelvesCount?: number;
      shelfType?: 'adjustable' | 'fixed';
      shelvesSetbackMm?: number;
    }
  | {
      type: 'subdivided';
      axis: 'horizontal' | 'vertical';
      tracks: Array<{ type: 'fixed'; valueMm: number } | { type: 'fractional'; valueFr: number }>;
      bays: BayContentSchemaType[];
      dividerThicknessMm?: number;
      dividerMaterialId?: string;
      jointType?: 'dado-groove' | 'confirmat';
      dividerSetbackMm?: number;
      dividerDadoDepthMm?: number;
    };

export const bayContentSchema: z.ZodType<BayContentSchemaType> = z.lazy(() =>
  z.union([
    z.object({
      type: z.literal('empty'),
    }),
    z.object({
      type: z.literal('shelves'),
      count: z.number().int().nonnegative(),
      shelfType: z.enum(['adjustable', 'fixed']),
      setbackMm: z.number().optional(),
      hasAntiSagBrace: z.boolean().optional(),
    }),
    z.object({
      type: z.literal('drawer-stack'),
      drawerTracks: z.array(trackSizeSchema),
      frontMount: z.enum(['applied', 'inset']),
      hasTransomDividers: z.boolean().optional(),
      slideType: z.enum(['telescopic', 'undermount', 'metal-box', 'roller', 'wood-runner']),
      gapMm: z.number().optional(),
      boxHeightRatio: z.number().optional(),
    }),
    z.object({
      type: z.literal('pull-out-tray'),
      lipHeightMm: z.number().optional(),
      slideType: z.enum(['telescopic', 'undermount']),
      clearanceDeductionMm: z.number().optional(),
      elevationYMm: z.number().optional(),
    }),
    z.object({
      type: z.literal('doors'),
      count: z.union([z.literal(1), z.literal(2)]),
      hingeSide: z.enum(['left', 'right']).optional(),
      mountType: z.enum([
        'full-overlay',
        'half-overlay',
        'inset',
        'overlay',
        'codo-0',
        'codo-9',
        'codo-18',
      ]),
      interiorShelvesCount: z.number().int().nonnegative().optional(),
      shelfType: z.enum(['adjustable', 'fixed']).optional(),
      shelvesSetbackMm: z.number().optional(),
    }),
    z.object({
      type: z.literal('bi-fold-closure'),
      leafTracks: z.array(trackSizeSchema).optional(),
      hingeType: z.enum(['bifold-center', 'piano', 'aventos']),
      openingDirection: z.enum(['vertical-lift', 'horizontal-book']),
      interiorShelvesCount: z.number().int().nonnegative().optional(),
      shelfType: z.enum(['adjustable', 'fixed']).optional(),
      shelvesSetbackMm: z.number().optional(),
    }),
    z.object({
      type: z.literal('subdivided'),
      axis: z.enum(['horizontal', 'vertical']),
      tracks: z.array(trackSizeSchema),
      bays: z.array(bayContentSchema),
      dividerThicknessMm: z.number().optional(),
      dividerMaterialId: z.string().optional(),
      jointType: z.enum(['dado-groove', 'confirmat']).optional(),
      dividerSetbackMm: z.number().optional(),
      dividerDadoDepthMm: z.number().optional(),
    }),
  ]),
);

export const userTemplateSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.literal(1).default(1),
  name: z.string().min(1),
  description: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  dimensions: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    depth: z.number().positive(),
  }),
  carcassSettings: z.object({
    roofType: roofTypeSchema,
    jointPriority: jointPrioritySchema,
    hasBacking: z.boolean(),
    railWidthMm: z.number().optional(),
    railOrientation: z.enum(['horizontal', 'vertical']).optional(),
    hasMiddleBrace: z.boolean().optional(),
    middleBraceWidthMm: z.number().optional(),
    hasWallHangingRail: z.boolean().optional(),
    wallHangingRailWidthMm: z.number().optional(),
    hasPlinth: z.boolean().optional(),
    plinthHeightMm: z.number().optional(),
    plinthSetbackMm: z.number().optional(),
    backingType: z.enum(['groove', 'rebate', 'overlay', 'none']).optional(),
    backingThicknessMm: z.number().optional(),
    isIslandCabinet: z.boolean().optional(),
    rearStructuralRails: z.enum(['none', 'top-and-bottom', 'top-only']).optional(),
    rearStructuralRailsWidthMm: z.number().optional(),
    partitionPassThroughRoof: z.boolean().optional(),
    backingMultiBayMode: z.enum(['split-per-bay', 'continuous']).optional(),
  }),
  gridType: z.enum(['1-bay', '2-bays-vertical', '3-bays-vertical', '2-bays-horizontal']),
  bayTracks: z.array(trackSizeSchema).optional(),
  bays: z.array(bayContentSchema),
  materials: z
    .object({
      carcassMaterialId: z.string().optional(),
      frontsMaterialId: z.string().optional(),
      drawerBoxesMaterialId: z.string().optional(),
      backingsMaterialId: z.string().optional(),
      edgeBandId: z.string().optional(),
    })
    .optional(),
  jointOverrides: z.record(z.string(), jointKindSchema).optional(),
});

export type UserTemplate = z.infer<typeof userTemplateSchema>;

export function validateUserTemplate(data: unknown): UserTemplate {
  return userTemplateSchema.parse(data);
}
