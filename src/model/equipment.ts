import { z } from 'zod';
import { shopValueSchema, TO_CONFIRM } from './common';

/**
 * Supported categories of built-in kitchen/bathroom equipment.
 */
export const equipmentKindSchema = z.enum([
  'sink-undermount',
  'sink-topmount',
  'cooktop-gas',
  'cooktop-induction',
  'built-in-oven',
]);
export type EquipmentKind = z.infer<typeof equipmentKindSchema>;

/**
 * Geometric parameters for cutting openings in countertops or cabinet tops.
 */
export const cutoutSpecificationSchema = z.object({
  widthMm: z.number().positive(),
  depthMm: z.number().positive(),
  cornerRadiusMm: z.number().nonnegative(),
});
export type CutoutSpecification = z.infer<typeof cutoutSpecificationSchema>;

/**
 * Faucet hole specification (typically centered behind a sink cutout).
 */
export const faucetHoleSpecificationSchema = z.object({
  required: z.boolean(),
  diameterMm: z.number().positive().default(35),
  distanceBehindCutoutMm: z.number().positive().default(50),
});
export type FaucetHoleSpecification = z.infer<typeof faucetHoleSpecificationSchema>;

/**
 * Bounding volume required for the drain siphon and plumbing below a sink.
 */
export const drainSiphonVolumeSchema = z.object({
  widthMm: z.number().positive(),
  depthMm: z.number().positive(),
  heightMm: z.number().positive(),
  offsetFromCenterXMm: z.number().default(0),
  offsetFromCenterYMm: z.number().default(0),
});
export type DrainSiphonVolume = z.infer<typeof drainSiphonVolumeSchema>;

/**
 * Safety and heat dissipation clearances for cooking equipment.
 */
export const ventilationRequirementsSchema = z.object({
  minRearClearanceMm: z.number().nonnegative().default(40),
  minBottomAirGapMm: z.number().nonnegative().default(20),
  heatShieldRequired: z.boolean().default(false),
});
export type VentilationRequirements = z.infer<typeof ventilationRequirementsSchema>;

/**
 * Equipment definition with mechanical dimensions, cutout guidelines and safety volumes.
 */
export const equipmentItemSchema = z.object({
  schemaVersion: z.number().int().positive().optional().default(1),
  id: z.string().min(1),
  brandModel: z.string().min(1),
  kind: equipmentKindSchema,
  overallDimensionsMm: z.object({
    widthMm: z.number().positive(),
    depthMm: z.number().positive(),
    heightMm: z.number().positive(),
  }),
  cutout: cutoutSpecificationSchema,
  minClearancesMm: z.object({
    frontMm: z.number().nonnegative().default(60),
    backMm: z.number().nonnegative().default(70),
    leftMm: z.number().nonnegative().default(50),
    rightMm: z.number().nonnegative().default(50),
  }),
  reservedVolumeMm: z.object({
    widthMm: z.number().positive(),
    depthMm: z.number().positive(),
    heightMm: z.number().positive(),
  }),
  faucetHole: faucetHoleSpecificationSchema.optional(),
  siphonVolume: drainSiphonVolumeSchema.optional(),
  ventilationRequirements: ventilationRequirementsSchema.optional(),
  price: shopValueSchema.optional(),
});
export type EquipmentItem = z.infer<typeof equipmentItemSchema>;

/**
 * Catalog of equipment items.
 */
export const equipmentCatalogSchema = z.object({
  schemaVersion: z.number().int().positive(),
  items: z.array(equipmentItemSchema),
});
export type EquipmentCatalog = z.infer<typeof equipmentCatalogSchema>;

/**
 * How a sink or cooktop is placed on a countertop and how the cabinet adapts.
 */
export const countertopEquipmentPlacementSchema = z.object({
  equipmentId: z.string().min(1),
  centerXMm: z.number().nonnegative(),
  centerOffsetYMm: z.number().optional().default(0),
  sinkDrawerAdaptation: z.enum(['false-front', 'u-shape-drawer', 'none']).default('false-front'),
  frontRailOrientation: z.enum(['vertical', 'horizontal', 'suppressed']).default('vertical'),
});
export type CountertopEquipmentPlacement = z.infer<typeof countertopEquipmentPlacementSchema>;

/**
 * Validate and parse raw data as an EquipmentItem.
 */
export function validateEquipmentItem(data: unknown): EquipmentItem {
  return equipmentItemSchema.parse(data);
}

/**
 * Validate and parse raw data as an EquipmentCatalog.
 */
export function validateEquipmentCatalog(data: unknown): EquipmentCatalog {
  return equipmentCatalogSchema.parse(data);
}

/**
 * Standard equipment catalog seed with verified dimensions.
 */
export const DEFAULT_EQUIPMENT_ITEMS: EquipmentItem[] = [
  {
    schemaVersion: 1,
    id: 'eq-sink-johnson-luxon-ln50',
    brandModel: 'Johnson Acero Luxon LN50 (Bacha Simple)',
    kind: 'sink-undermount',
    overallDimensionsMm: { widthMm: 540, depthMm: 440, heightMm: 200 },
    cutout: { widthMm: 500, depthMm: 400, cornerRadiusMm: 50 },
    minClearancesMm: { frontMm: 60, backMm: 70, leftMm: 50, rightMm: 50 },
    reservedVolumeMm: { widthMm: 530, depthMm: 430, heightMm: 220 },
    faucetHole: { required: true, diameterMm: 35, distanceBehindCutoutMm: 50 },
    siphonVolume: {
      widthMm: 180,
      depthMm: 200,
      heightMm: 260,
      offsetFromCenterXMm: 0,
      offsetFromCenterYMm: 0,
    },
    price: TO_CONFIRM,
  },
  {
    schemaVersion: 1,
    id: 'eq-sink-mipileta-420e',
    brandModel: 'Mi Pileta 420 E (Bacha Simple Compacta)',
    kind: 'sink-undermount',
    overallDimensionsMm: { widthMm: 460, depthMm: 380, heightMm: 180 },
    cutout: { widthMm: 420, depthMm: 340, cornerRadiusMm: 40 },
    minClearancesMm: { frontMm: 60, backMm: 70, leftMm: 50, rightMm: 50 },
    reservedVolumeMm: { widthMm: 450, depthMm: 370, heightMm: 200 },
    faucetHole: { required: true, diameterMm: 35, distanceBehindCutoutMm: 50 },
    siphonVolume: {
      widthMm: 160,
      depthMm: 180,
      heightMm: 240,
      offsetFromCenterXMm: 0,
      offsetFromCenterYMm: 0,
    },
    price: TO_CONFIRM,
  },
  {
    schemaVersion: 1,
    id: 'eq-sink-johnson-c37',
    brandModel: 'Johnson Acero C37 (Bacha Doble)',
    kind: 'sink-undermount',
    overallDimensionsMm: { widthMm: 750, depthMm: 420, heightMm: 200 },
    cutout: { widthMm: 710, depthMm: 380, cornerRadiusMm: 50 },
    minClearancesMm: { frontMm: 60, backMm: 70, leftMm: 60, rightMm: 60 },
    reservedVolumeMm: { widthMm: 740, depthMm: 410, heightMm: 220 },
    faucetHole: { required: true, diameterMm: 35, distanceBehindCutoutMm: 50 },
    siphonVolume: {
      widthMm: 360,
      depthMm: 200,
      heightMm: 260,
      offsetFromCenterXMm: 0,
      offsetFromCenterYMm: 0,
    },
    price: TO_CONFIRM,
  },
  {
    schemaVersion: 1,
    id: 'eq-cooktop-domec-gas-4',
    brandModel: 'Domec Gas 4 Hornallas (Acero Inox)',
    kind: 'cooktop-gas',
    overallDimensionsMm: { widthMm: 590, depthMm: 510, heightMm: 55 },
    cutout: { widthMm: 560, depthMm: 480, cornerRadiusMm: 15 },
    minClearancesMm: { frontMm: 60, backMm: 60, leftMm: 50, rightMm: 50 },
    reservedVolumeMm: { widthMm: 570, depthMm: 490, heightMm: 65 },
    ventilationRequirements: {
      minRearClearanceMm: 45,
      minBottomAirGapMm: 20,
      heatShieldRequired: true,
    },
    price: TO_CONFIRM,
  },
  {
    schemaVersion: 1,
    id: 'eq-cooktop-orbis-induction-4',
    brandModel: 'Orbis Vitrocerámico / Inducción 4 Zonas',
    kind: 'cooktop-induction',
    overallDimensionsMm: { widthMm: 590, depthMm: 520, heightMm: 60 },
    cutout: { widthMm: 560, depthMm: 490, cornerRadiusMm: 10 },
    minClearancesMm: { frontMm: 60, backMm: 60, leftMm: 50, rightMm: 50 },
    reservedVolumeMm: { widthMm: 570, depthMm: 500, heightMm: 75 },
    ventilationRequirements: {
      minRearClearanceMm: 50,
      minBottomAirGapMm: 30,
      heatShieldRequired: false,
    },
    price: TO_CONFIRM,
  },
  {
    schemaVersion: 1,
    id: 'eq-oven-ariston-builtin-60',
    brandModel: 'Ariston Horno Eléctrico Empotrable 60cm',
    kind: 'built-in-oven',
    overallDimensionsMm: { widthMm: 595, depthMm: 550, heightMm: 595 },
    cutout: { widthMm: 560, depthMm: 550, cornerRadiusMm: 0 },
    minClearancesMm: { frontMm: 0, backMm: 50, leftMm: 18, rightMm: 18 },
    reservedVolumeMm: { widthMm: 560, depthMm: 550, heightMm: 595 },
    ventilationRequirements: {
      minRearClearanceMm: 50,
      minBottomAirGapMm: 40,
      heatShieldRequired: true,
    },
    price: TO_CONFIRM,
  },
];
