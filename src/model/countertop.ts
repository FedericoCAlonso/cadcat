import { z } from 'zod';
import { shopValueSchema, TO_CONFIRM } from './common';
import { countertopEquipmentPlacementSchema } from './equipment';

/**
 * Types of countertop materials.
 */
export const countertopMaterialKindSchema = z.enum([
  'natural-stone',
  'quartz-composite',
  'sintered-stone',
  'solid-wood',
  'hpl-laminate',
]);
export type CountertopMaterialKind = z.infer<typeof countertopMaterialKindSchema>;

/**
 * Physical properties of a countertop material for structural and costing calculations.
 */
export const countertopMaterialSchema = z.object({
  schemaVersion: z.number().int().positive().optional().default(1),
  id: z.string().min(1),
  name: z.string().min(1),
  kind: countertopMaterialKindSchema,
  thicknessMm: z.number().positive(),
  densityKgM2: z.number().positive(), // Weight per square meter (e.g. 20mm granite ~ 54 kg/m²)
  elasticModulusMPa: shopValueSchema.optional(),
  maxOverhangWithoutBracketsMm: z.number().positive(), // Max cantilever without brackets/corbels
  maxUnsupportedSpanMm: z.number().positive(), // Max clear span without a cabinet under (e.g. dishwasher niche)
  requiresSubtop: z.boolean().default(false), // Sintered stone (12mm) requires plywood/MDF substrate
  pricePerM2: shopValueSchema.optional(),
});
export type CountertopMaterial = z.infer<typeof countertopMaterialSchema>;

/**
 * Catalog of countertop materials.
 */
export const countertopMaterialCatalogSchema = z.object({
  schemaVersion: z.number().int().positive(),
  materials: z.array(countertopMaterialSchema),
});
export type CountertopMaterialCatalog = z.infer<typeof countertopMaterialCatalogSchema>;

/**
 * Backsplash and side splash specifications against walls.
 */
export const countertopBacksplashSchema = z.object({
  hasSplash: z.boolean().default(true),
  heightMm: z.number().positive().default(60),
  thicknessMm: z.number().positive().default(20),
});
export type CountertopBacksplash = z.infer<typeof countertopBacksplashSchema>;

/**
 * Edge profile finish for exposed countertop sides.
 */
export const countertopEdgeFinishSchema = z.enum([
  'straight-polished', // Canto recto pulido
  'bevel-2mm',          // Bisel 2mm
  'bullnose',           // Media caña / redondeado
  'mitered-skirt',      // Inglete con regrueso / faldón
]);
export type CountertopEdgeFinish = z.infer<typeof countertopEdgeFinishSchema>;

/**
 * Corner radius specifications for polished outer corners.
 */
export const countertopCornerRadiiSchema = z.object({
  frontLeftMm: z.number().nonnegative().default(0),
  frontRightMm: z.number().nonnegative().default(0),
  backLeftMm: z.number().nonnegative().default(0),
  backRightMm: z.number().nonnegative().default(0),
});
export type CountertopCornerRadii = z.infer<typeof countertopCornerRadiiSchema>;

/**
 * Complete definition of a countertop spanning one or multiple base cabinets.
 */
export const countertopDefinitionSchema = z.object({
  schemaVersion: z.number().int().positive().optional().default(1),
  id: z.string().min(1),
  name: z.string().default('Mesada Principal'),
  materialId: z.string().min(1),
  widthMm: z.number().positive(),
  depthMm: z.number().positive(),
  frontOverhangMm: z.number().nonnegative().default(25),
  leftOverhangMm: z.number().nonnegative().default(0),
  rightOverhangMm: z.number().nonnegative().default(0),
  backOverhangMm: z.number().nonnegative().default(0),
  edgeFinish: countertopEdgeFinishSchema.default('straight-polished'),
  miteredSkirtHeightMm: z.number().nonnegative().default(0), // Faldón regruesado si edgeFinish === 'mitered-skirt'
  cornerRadii: countertopCornerRadiiSchema.default({
    frontLeftMm: 0,
    frontRightMm: 0,
    backLeftMm: 0,
    backRightMm: 0,
  }),
  backsplash: countertopBacksplashSchema.default({
    hasSplash: true,
    heightMm: 60,
    thicknessMm: 20,
  }),
  leftSplash: countertopBacksplashSchema.default({
    hasSplash: false,
    heightMm: 60,
    thicknessMm: 20,
  }),
  rightSplash: countertopBacksplashSchema.default({
    hasSplash: false,
    heightMm: 60,
    thicknessMm: 20,
  }),
  placements: z.array(countertopEquipmentPlacementSchema).default([]),
});
export type CountertopDefinition = z.infer<typeof countertopDefinitionSchema>;

/**
 * Validate and parse raw data as a CountertopMaterial.
 */
export function validateCountertopMaterial(data: unknown): CountertopMaterial {
  return countertopMaterialSchema.parse(data);
}

/**
 * Validate and parse raw data as a CountertopDefinition.
 */
export function validateCountertopDefinition(data: unknown): CountertopDefinition {
  return countertopDefinitionSchema.parse(data);
}

/**
 * Seed catalog of countertop materials.
 */
export const DEFAULT_COUNTERTOP_MATERIALS: CountertopMaterial[] = [
  {
    schemaVersion: 1,
    id: 'ct-granite-gris-mara-20',
    name: 'Granito Gris Mara 20mm',
    kind: 'natural-stone',
    thicknessMm: 20,
    densityKgM2: 54, // ~2700 kg/m³ * 0.02 m = 54 kg/m²
    maxOverhangWithoutBracketsMm: 150,
    maxUnsupportedSpanMm: 600,
    requiresSubtop: false,
    pricePerM2: TO_CONFIRM,
  },
  {
    schemaVersion: 1,
    id: 'ct-granite-negro-brasil-20',
    name: 'Granito Negro Brasil 20mm',
    kind: 'natural-stone',
    thicknessMm: 20,
    densityKgM2: 58,
    maxOverhangWithoutBracketsMm: 150,
    maxUnsupportedSpanMm: 600,
    requiresSubtop: false,
    pricePerM2: TO_CONFIRM,
  },
  {
    schemaVersion: 1,
    id: 'ct-quartz-white-zeus-20',
    name: 'Cuarzo / Silestone Blanco Zeus 20mm',
    kind: 'quartz-composite',
    thicknessMm: 20,
    densityKgM2: 50,
    maxOverhangWithoutBracketsMm: 180,
    maxUnsupportedSpanMm: 700,
    requiresSubtop: false,
    pricePerM2: TO_CONFIRM,
  },
  {
    schemaVersion: 1,
    id: 'ct-sintered-dekton-12',
    name: 'Piedra Sinterizada Dekton 12mm (con sustrato)',
    kind: 'sintered-stone',
    thicknessMm: 12,
    densityKgM2: 32,
    maxOverhangWithoutBracketsMm: 200,
    maxUnsupportedSpanMm: 800,
    requiresSubtop: true,
    pricePerM2: TO_CONFIRM,
  },
  {
    schemaVersion: 1,
    id: 'ct-wood-paraiso-30',
    name: 'Madera Maciza Paraíso Alistonada 30mm',
    kind: 'solid-wood',
    thicknessMm: 30,
    densityKgM2: 21,
    maxOverhangWithoutBracketsMm: 280,
    maxUnsupportedSpanMm: 900,
    requiresSubtop: false,
    pricePerM2: TO_CONFIRM,
  },
  {
    schemaVersion: 1,
    id: 'ct-hpl-laminate-postformed-30',
    name: 'Laminado HPL Postformado 30mm',
    kind: 'hpl-laminate',
    thicknessMm: 30,
    densityKgM2: 20,
    maxOverhangWithoutBracketsMm: 200,
    maxUnsupportedSpanMm: 750,
    requiresSubtop: false,
    pricePerM2: TO_CONFIRM,
  },
];
