import { z } from 'zod';
import { shopValueSchema, TO_CONFIRM } from './common';

export const unitsConfigSchema = z.object({
  length: z.enum(['mm', 'cm', 'm']).default('mm'),
  currency: z.string().min(1).default('ARS'),
});
export type UnitsConfig = z.infer<typeof unitsConfigSchema>;

export const jointStrategySchema = z.enum([
  'confirmat',
  'dowel-and-confirmat',
  'cam-dowel',
  'screw',
]).default('confirmat');
export type JointStrategy = z.infer<typeof jointStrategySchema>;

export const machiningConfigSchema = z.object({
  jointStrategy: jointStrategySchema.default('confirmat'),
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
  dowelSpacingMm: z.number().positive().default(32.0),
  dowelMinContactLengthMm: z.number().positive().default(160.0),
  screwThroughDiameterMm: z.number().positive().default(4.0),
  screwCoreDiameterMm: z.number().positive().default(3.0),
  screwCoreDepthMm: z.number().positive().default(35.0),
  slideHoleDiameterMm: z.number().positive().default(5.0),
  slideHoleDepthMm: z.number().positive().default(12.0),
  slideHolePitchMm: z.number().positive().default(192.0),
  hingeCupDiameterMm: z.number().positive(),
  hingeCupDepthMm: z.number().positive(),
  hingeCupEdgeSetbackMm: z.number().positive(),
  hingePlateSetbackMm: z.number().positive(),
  hingePlateDiameterMm: z.number().positive(),
  hingePlateDepthMm: z.number().positive(),
  hingePlateHoleSpacingMm: z.number().positive().default(32.0),
  shelfPinDiameterMm: z.number().positive(),
  shelfPinDepthMm: z.number().positive(),
  system32FrontSetbackMm: z.number().positive(),
  jointDrillMarginMm: z.number().positive(),
  maxSpanWithoutCenterDrillMm: z.number().positive(),
  shortPieceThresholdMm: z.number().positive().default(110.0),
  shortPieceMaxMarginMm: z.number().positive().default(25.0),
  minJointLengthMm: z.number().positive().default(50.0),
  defaultGaugeWidthMm: shopValueSchema.default(50),
});
export type MachiningConfig = z.infer<typeof machiningConfigSchema>;

export const nestingConfigSchema = z.object({
  sawKerfMm: z.number().min(0),
  sheetTrimMarginMm: z.number().min(0),
  respectGrain: z.boolean(),
  optimizationGoal: z.enum(['min-waste', 'min-passes']).default('min-waste'),
  includeAssemblyGaugesInCutPlan: z.boolean().default(false),
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
  defaultElasticModulusMPa: z.number().positive().default(3000.0),
  gravityAccelerationMS2: z.number().positive().default(9.80665),
});
export type DeflectionConfig = z.infer<typeof deflectionConfigSchema>;

export const hardwareConfigSchema = z.object({
  slideClearanceTelescopicMm: z.number().positive().default(25.4),
  slideClearanceUndermountMm: z.number().positive().default(10.0),
  slideClearanceMetalBoxMm: z.number().positive().default(31.0),
  slideClearanceRollerMm: z.number().positive().default(25.0),
  drawerFrontGapMm: z.number().min(0).default(3.0),
  drawerBoxFrontOffsetMm: z.number().min(0).default(10.0),
  drawerBoxBottomClearanceMm: z.number().min(0).default(15.0),
  doorOverlayRevealMm: z.number().min(0).default(1.5),
  doorHalfOverlayRevealMm: z.number().min(0).default(1.5),
  doorInsetGapMm: z.number().min(0).default(2.0),
  doorHingeMarginMm: z.number().positive().default(100.0),
});
export type HardwareConfig = z.infer<typeof hardwareConfigSchema>;

export const DEFAULT_HARDWARE_CONFIG: HardwareConfig = hardwareConfigSchema.parse({});

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
  hardware: hardwareConfigSchema.default(DEFAULT_HARDWARE_CONFIG),
});
export type ProjectConfig = z.infer<typeof projectConfigSchema>;

/**
 * Validates untyped data against the ProjectConfig schema.
 */
export function validateProjectConfig(data: unknown): ProjectConfig {
  return projectConfigSchema.parse(data);
}
