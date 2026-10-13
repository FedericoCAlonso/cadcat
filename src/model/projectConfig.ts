import { z } from 'zod';
import { shopValueSchema, TO_CONFIRM } from './common';

export const unitsConfigSchema = z.object({
  length: z.enum(['mm', 'cm', 'm']).default('mm'),
  currency: z.string().min(1).default('ARS'),
});
export type UnitsConfig = z.infer<typeof unitsConfigSchema>;

export const machiningConfigSchema = z.object({
  confirmatThroughDiameterMm: z.number().positive(),
  confirmatCoreDiameterMm: z.number().positive(),
  confirmatCoreDepthMm: z.number().positive(),
  minifixPocketDiameterMm: z.number().positive(),
  minifixPocketDepthMm: z.number().positive(),
  minifixPocketSetbackMm: z.number().positive(),
  minifixBoltDiameterMm: z.number().positive(),
  minifixDowelDiameterMm: z.number().positive(),
  minifixDowelDepthMm: z.number().positive(),
  dowelFaceDiameterMm: z.number().positive(),
  dowelFaceDepthMm: z.number().positive(),
  dowelEdgeDiameterMm: z.number().positive(),
  dowelEdgeDepthMm: z.number().positive(),
  hingeCupDiameterMm: z.number().positive(),
  hingeCupDepthMm: z.number().positive(),
  hingeCupEdgeSetbackMm: z.number().positive(),
  hingePlateSetbackMm: z.number().positive(),
  hingePlateDiameterMm: z.number().positive(),
  hingePlateDepthMm: z.number().positive(),
  shelfPinDiameterMm: z.number().positive(),
  shelfPinDepthMm: z.number().positive(),
  system32FrontSetbackMm: z.number().positive(),
  jointDrillMarginMm: z.number().positive(),
  maxSpanWithoutCenterDrillMm: z.number().positive(),
  defaultGaugeWidthMm: shopValueSchema.default(50),
});
export type MachiningConfig = z.infer<typeof machiningConfigSchema>;

export const nestingConfigSchema = z.object({
  sawKerfMm: z.number().min(0),
  sheetTrimMarginMm: z.number().min(0),
  respectGrain: z.boolean(),
  optimizationGoal: z.enum(['min-waste', 'min-passes']).default('min-waste'),
});
export type NestingConfig = z.infer<typeof nestingConfigSchema>;

export const costConfigSchema = z.object({
  wasteFactorPercent: z.number().min(0).max(100),
  hourlyLaborRate: z.number().min(0),
  pricePerCutPass: shopValueSchema.default(TO_CONFIRM),
  cutPricingMode: z.enum(['per-pass', 'per-meter']).default('per-pass'),
});
export type CostConfig = z.infer<typeof costConfigSchema>;

export const deflectionConfigSchema = z.object({
  maxDeflectionRatio: z.number().positive(), // e.g., 200 for L/200
  maxAbsoluteDeflectionMm: z.number().positive(), // e.g., 3.0 mm
  designUniformLoadKgM2: z.number().positive(), // e.g., 30 kg/m2
});
export type DeflectionConfig = z.infer<typeof deflectionConfigSchema>;

export const projectConfigSchema = z.object({
  schemaVersion: z.literal(1),
  projectId: z.string().min(1),
  projectName: z.string().min(1),
  clientName: z.string(),
  description: z.string(),
  units: unitsConfigSchema,
  machining: machiningConfigSchema,
  nesting: nestingConfigSchema,
  cost: costConfigSchema,
  deflection: deflectionConfigSchema,
});
export type ProjectConfig = z.infer<typeof projectConfigSchema>;

/**
 * Validates untyped data against the ProjectConfig schema.
 */
export function validateProjectConfig(data: unknown): ProjectConfig {
  return projectConfigSchema.parse(data);
}
