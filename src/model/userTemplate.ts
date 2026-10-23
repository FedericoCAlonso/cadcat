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

export const handleTemplateSchema = z.object({
  type: z.enum(['none', 'bar', 'knob', 'profile-j', 'integrated-groove', 'push-to-open']),
  centerToCenterMm: z.number().positive().optional(),
  protrusionMm: z.number().nonnegative().optional(),
  orientation: z.enum(['horizontal', 'vertical']).optional(),
  positionFromEdgeMm: z.number().nonnegative().optional(),
});

export type BayContentSchemaType =
  | { type: 'empty' }
  | {
      type: 'shelves';
      count: number;
      shelfType: 'adjustable' | 'fixed';
      setbackMm?: number;
      hasAntiSagBrace?: boolean;
      shelfTracks?: Array<{ type: 'fixed'; valueMm: number } | { type: 'fractional'; valueFr: number }>;
      hasDoors?: boolean;
      doorCount?: 1 | 2;
      doorMountType?: 'full-overlay' | 'half-overlay' | 'inset' | 'overlay' | 'codo-0' | 'codo-9' | 'codo-18';
      doorHingeSide?: 'left' | 'right';
    }
  | {
      type: 'drawer-stack';
      drawerTracks: Array<{ type: 'fixed'; valueMm: number } | { type: 'fractional'; valueFr: number }>;
      frontMount?: 'applied' | 'inset';
      hasTransomDividers?: boolean;
      slideType: 'telescopic' | 'undermount' | 'metal-box' | 'roller' | 'wood-runner';
      boxThicknessMm?: number;
      frontThicknessMm?: number;
      boxJointType?: 'glue' | 'confirmat' | 'dado-groove';
      gapMm?: number;
      boxHeightRatio?: number;
      drawerType?: 'standard' | 'simple-interior';
      bottomMount?: 'grooved' | 'bottom-screwed' | 'flush-thick';
      topPullGapMm?: number;
      boxSideHeightOffsetMm?: number;
      bottomScrewedDeductionWidthMm?: number;
      bottomScrewedDeductionDepthMm?: number;
      slideClearanceMm?: number;
      boxDepthMm?: number;
      hasHingeSpacer?: boolean;
      hingeSpacerWidthMm?: number;
      hingeSpacerSide?: 'left' | 'right';
      handle?: {
        type: 'none' | 'bar' | 'knob' | 'profile-j' | 'integrated-groove' | 'push-to-open';
        centerToCenterMm?: number;
        protrusionMm?: number;
        orientation?: 'horizontal' | 'vertical';
        positionFromEdgeMm?: number;
      };
      interiorSafetyClearanceMm?: number;
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
      hingeType?: 'concealed-cup' | 'butt-hinge' | 'piano' | 'cup-35' | 'piano-hinge';
      doorThicknessMm?: number;
      catchType?: 'none' | 'magnetic' | 'roller' | 'push-to-open' | 'magnetic-catch' | 'roller-catch' | 'push-catch';
      handle?: {
        type: 'none' | 'bar' | 'knob' | 'profile-j' | 'integrated-groove' | 'push-to-open';
        centerToCenterMm?: number;
        protrusionMm?: number;
        orientation?: 'horizontal' | 'vertical';
        positionFromEdgeMm?: number;
      };
    }
  | {
      type: 'bi-fold-closure';
      leafTracks?: Array<{ type: 'fixed'; valueMm: number } | { type: 'fractional'; valueFr: number }>;
      hingeType: 'bifold-center' | 'piano' | 'aventos';
      openingDirection: 'vertical-lift' | 'horizontal-book';
      interiorShelvesCount?: number;
      shelfType?: 'adjustable' | 'fixed';
      shelvesSetbackMm?: number;
      doorThicknessMm?: number;
      catchType?: 'none' | 'magnetic' | 'roller' | 'push-to-open' | 'magnetic-catch' | 'roller-catch' | 'push-catch';
      handle?: {
        type: 'none' | 'bar' | 'knob' | 'profile-j' | 'integrated-groove' | 'push-to-open';
        centerToCenterMm?: number;
        protrusionMm?: number;
        orientation?: 'horizontal' | 'vertical';
        positionFromEdgeMm?: number;
      };
    }
  | {
      type: 'subdivided';
      axis: 'horizontal' | 'vertical';
      tracks: Array<{ type: 'fixed'; valueMm: number } | { type: 'fractional'; valueFr: number }>;
      bays: BayContentSchemaType[];
      dividerThicknessMm?: number;
      dividerMaterialId?: string;
      jointType?: 'dado-groove' | 'confirmat' | 'minifix';
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
      shelfTracks: z.array(trackSizeSchema).optional(),
      hasDoors: z.boolean().optional(),
      doorCount: z.union([z.literal(1), z.literal(2)]).optional(),
      doorMountType: z.enum([
        'full-overlay',
        'half-overlay',
        'inset',
        'overlay',
        'codo-0',
        'codo-9',
        'codo-18',
      ]).optional(),
      doorHingeSide: z.enum(['left', 'right']).optional(),
    }),
    z.object({
      type: z.literal('drawer-stack'),
      drawerTracks: z.array(trackSizeSchema),
      frontMount: z.enum(['applied', 'inset']).optional(),
      hasTransomDividers: z.boolean().optional(),
      slideType: z.enum(['telescopic', 'undermount', 'metal-box', 'roller', 'wood-runner']),
      boxThicknessMm: z.number().positive().optional(),
      frontThicknessMm: z.number().positive().optional(),
      boxJointType: z.enum(['glue', 'confirmat', 'dado-groove']).optional(),
      gapMm: z.number().optional(),
      boxHeightRatio: z.number().optional(),
      drawerType: z.enum(['standard', 'simple-interior']).optional(),
      bottomMount: z.enum(['grooved', 'bottom-screwed', 'flush-thick']).optional(),
      topPullGapMm: z.number().optional(),
      boxSideHeightOffsetMm: z.number().optional(),
      bottomScrewedDeductionWidthMm: z.number().optional(),
      bottomScrewedDeductionDepthMm: z.number().optional(),
      slideClearanceMm: z.number().optional(),
      boxDepthMm: z.number().optional(),
      hasHingeSpacer: z.boolean().optional(),
      hingeSpacerWidthMm: z.number().optional(),
      hingeSpacerSide: z.enum(['left', 'right']).optional(),
      handle: handleTemplateSchema.optional(),
      interiorSafetyClearanceMm: z.number().optional(),
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
      hingeType: z.enum(['concealed-cup', 'butt-hinge', 'piano', 'cup-35', 'piano-hinge']).optional(),
      doorThicknessMm: z.number().optional(),
      catchType: z.enum(['none', 'magnetic', 'roller', 'push-to-open', 'magnetic-catch', 'roller-catch', 'push-catch']).optional(),
      handle: handleTemplateSchema.optional(),
    }),
    z.object({
      type: z.literal('bi-fold-closure'),
      leafTracks: z.array(trackSizeSchema).optional(),
      hingeType: z.enum(['bifold-center', 'piano', 'aventos']),
      openingDirection: z.enum(['vertical-lift', 'horizontal-book']),
      interiorShelvesCount: z.number().int().nonnegative().optional(),
      shelfType: z.enum(['adjustable', 'fixed']).optional(),
      shelvesSetbackMm: z.number().optional(),
      doorThicknessMm: z.number().optional(),
      catchType: z.enum(['none', 'magnetic', 'roller', 'push-to-open', 'magnetic-catch', 'roller-catch', 'push-catch']).optional(),
      handle: handleTemplateSchema.optional(),
    }),
    z.object({
      type: z.literal('subdivided'),
      axis: z.enum(['horizontal', 'vertical']),
      tracks: z.array(trackSizeSchema),
      bays: z.array(bayContentSchema),
      dividerThicknessMm: z.number().optional(),
      dividerMaterialId: z.string().optional(),
      jointType: z.enum(['dado-groove', 'confirmat', 'minifix']).optional(),
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
