import { z } from 'zod';
import defaultProjectConfigJson from './defaultProjectConfig.json';
import modularPresetsJson from './modularPresets.json';
import uiDefaultsJson from './uiDefaults.json';
import {
  projectConfigSchema,
  type ProjectConfig,
} from '../model/projectConfig';

export const trackSizeConfigSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('fixed'),
    valueMm: z.number().positive(),
  }),
  z.object({
    type: z.literal('fractional'),
    valueFr: z.number().positive(),
  }),
]);

export const modularPresetConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  defaultDimensions: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    depth: z.number().positive(),
  }),
  carcass: z.object({
    jointPriority: z.enum(['lateral-over-bottom', 'bottom-over-lateral']).default('lateral-over-bottom'),
    roofType: z.enum(['front-back-rails', 'solid-panel', 'none']).default('front-back-rails'),
    railWidthMm: z.number().positive().optional(),
    hasBacking: z.boolean().default(true),
  }),
  grid: z.object({
    axis: z.enum(['horizontal', 'vertical']),
    tracks: z.array(trackSizeConfigSchema),
    dividerThicknessMm: z.number().positive().optional(),
  }).optional(),
  bays: z.array(z.any()), // BayContent schemas validated at composition level
  defaultMaterials: z.object({
    carcassMaterialId: z.string().min(1),
    frontsMaterialId: z.string().min(1),
    drawerBoxesMaterialId: z.string().min(1),
    backingsMaterialId: z.string().min(1),
  }),
});
export type ModularPresetConfig = z.infer<typeof modularPresetConfigSchema>;

export const dimensionBoundsSchema = z.object({
  default: z.number().positive(),
  min: z.number().positive(),
  max: z.number().positive(),
  step: z.number().positive(),
});

export const uiDefaultsSchema = z.object({
  showInterferences: z.boolean().default(false),
  costDebounceMs: z.number().nonnegative().default(250),
  summaryScopeDefault: z.enum(['project', 'module']).default('project'),
  currencySymbol: z.string().default('$'),
  viewerFillRatio: z.number().positive().max(1).default(0.85),
  showDimensionsByDefault: z.boolean().default(true),
  showEdgeBandsByDefault: z.boolean().default(true),
  edgeBandHighlightColor: z.object({
    light: z.string().default('#E91E63'),
    dark: z.string().default('#FF4081'),
  }).default({ light: '#E91E63', dark: '#FF4081' }),
  minPerceptualColorDistance: z.number().positive().default(25.0),
  minEdgeBandScreenPx: z.number().positive().default(2.5),
  edgeBandPhysicalThicknessMm: z.number().positive().default(1.2),
  tabletBottomSheetHeights: z.object({
    collapsed: z.string().default('120px'),
    middle: z.string().default('50vh'),
    full: z.string().default('92vh'),
  }).default({ collapsed: '120px', middle: '50vh', full: '92vh' }),
  colorByRoleByDefault: z.boolean().default(false),
  showLinesByDefault: z.boolean().default(true),
  machiningDisplayModeDefault: z.enum(['no', 'auto', 'always']).default('auto'),
  machiningCameraDistanceRatio: z.number().positive().default(0.6),
  machiningExplodedThreshold: z.number().positive().default(0.08),
  selectedPieceColor: z.object({
    light: z.string().default('#7E57C2'),
    dark: z.string().default('#9575CD'),
  }).default({ light: '#7E57C2', dark: '#9575CD' }),
  viewerLighting: z.object({
    ambientStandard: z.number().positive().default(0.85),
    ambientColorByRole: z.number().positive().default(1.25),
    hemiStandard: z.number().positive().default(0.35),
    hemiColorByRole: z.number().positive().default(0.65),
  }).default({
    ambientStandard: 0.85,
    ambientColorByRole: 1.25,
    hemiStandard: 0.35,
    hemiColorByRole: 0.65,
  }),
  dimensionUnit: z.string().default('mm'),
  dimensionNumberFormat: z.string().default('es-AR'),
  dimensionOffsetMm: z.number().positive().default(80),
  dimensionExtensionMm: z.number().positive().default(25),
  dimensionMinScreenSpanPx: z.number().positive().default(30),
  explodedDimensionThreshold: z.number().nonnegative().default(0.05),
  dimensionPrefixes: z.object({
    width: z.string().default('An'),
    height: z.string().default('Al'),
    depth: z.string().default('Pr'),
  }).default({ width: 'An', height: 'Al', depth: 'Pr' }),
  gridIntensity: z.number().positive().max(1).default(0.18),
  gridFadeFalloff: z.number().positive().default(0.85),
  gridDivisions: z.number().positive().int().default(20),
  gridSizeFactor: z.number().positive().default(2.5),
  drawerTwoColumnThresholdPx: z.number().positive().default(520),
  drawerScaleFactorPxPerMm: z.number().positive().default(0.25),
  drawerDiagramMinHeightPx: z.number().positive().default(120),
  drawerDiagramMaxHeightPx: z.number().positive().default(240),
  drawerBandMinHeightPx: z.number().positive().default(18),
  assemblyGuidePreMachiningColumnThresholdPx: z.number().positive().default(640),
  assemblyGuidePartsCardThresholdPx: z.number().positive().default(560),
  assemblyGuideModalMaxZoom: z.number().positive().default(5.0),
  assemblyGuideModalMinZoom: z.number().positive().default(0.5),
  inspectorWidthPx: z.number().positive().default(320),
  dimensions: z.object({
    width: dimensionBoundsSchema,
    height: dimensionBoundsSchema,
    depth: dimensionBoundsSchema,
  }),
  quickTrackRecipes: z.array(
    z.object({
      label: z.string().min(1),
      tracks: z.array(trackSizeConfigSchema),
    }),
  ),
  defaultCarcassSettings: z.object({
    roofType: z.enum(['front-back-rails', 'solid-panel', 'none']),
    jointPriority: z.enum(['lateral-over-bottom', 'bottom-over-lateral']),
    hasBacking: z.boolean(),
    railWidthMm: z.number().positive(),
  }),
});
export type UiDefaultsConfig = z.infer<typeof uiDefaultsSchema>;

/**
 * Loads and validates default project configuration from file.
 */
export function loadDefaultProjectConfigFile(): ProjectConfig {
  return projectConfigSchema.parse(defaultProjectConfigJson);
}

/**
 * Loads and validates modular presets list from file.
 */
export function loadModularPresetsConfigFile(): ModularPresetConfig[] {
  return z.array(modularPresetConfigSchema).parse(modularPresetsJson);
}

/**
 * Loads and validates UI defaults configuration from file.
 */
export function loadUiDefaultsConfigFile(): UiDefaultsConfig {
  return uiDefaultsSchema.parse(uiDefaultsJson);
}

export const DEFAULT_UI_CONFIG: UiDefaultsConfig = loadUiDefaultsConfigFile();

export { defaultProjectConfigJson, modularPresetsJson, uiDefaultsJson };
