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
