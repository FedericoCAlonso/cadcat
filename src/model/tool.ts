import { z } from 'zod';
import { shopValueSchema, TO_CONFIRM } from './common';

export const toolKindSchema = z.enum([
  'drill-bit',
  'straight-router-bit',
  'profile-router-bit',
  'saw-blade',
]);
export type ToolKind = z.infer<typeof toolKindSchema>;

export const drillBitKindSchema = z.enum([
  'through',
  'blind',
  'countersink',
  'forstner',
]);
export type DrillBitKind = z.infer<typeof drillBitKindSchema>;

export const routerProfileKindSchema = z.enum([
  'straight',
  'chamfer-45',
  'roundover',
  'cove',
  'ogee',
  'j-pull',
]);
export type RouterProfileKind = z.infer<typeof routerProfileKindSchema>;

/**
 * Zod schema for a workshop tool (drill bits, straight and profile router cutters, saw blades).
 * Defines physical dimensions, maximum cut depths, flute lengths, and cutting speeds.
 */
export const toolItemSchema = z.object({
  schemaVersion: z.number().int().positive().optional().default(1),
  id: z.string().min(1),
  name: z.string().min(1),
  kind: toolKindSchema,
  diameterMm: z.number().positive(),
  shankDiameterMm: z.number().positive().optional(),
  maxCutDepthMm: z.number().positive(),
  fluteLengthMm: z.number().positive().optional(),
  drillType: drillBitKindSchema.optional(),
  profileKind: routerProfileKindSchema.optional(),
  profileRadiusMm: z.number().positive().optional(),
  rotationSpeedRpm: z.union([z.number().positive(), z.literal(TO_CONFIRM)]).optional(),
  feedRateMmMin: z.union([z.number().positive(), z.literal(TO_CONFIRM)]).optional(),
  price: shopValueSchema.optional(),
  notes: z.string().optional(),
});
export type ToolItem = z.infer<typeof toolItemSchema>;

export const toolCatalogSchema = z.object({
  schemaVersion: z.number().int().positive().optional().default(1),
  tools: z.array(toolItemSchema),
});
export type ToolCatalog = z.infer<typeof toolCatalogSchema>;

/**
 * Validate and parse raw data as a ToolItem.
 */
export function validateToolItem(data: unknown): ToolItem {
  return toolItemSchema.parse(data);
}

/**
 * Validate and parse raw data as a ToolCatalog.
 */
export function validateToolCatalog(data: unknown): ToolCatalog {
  return toolCatalogSchema.parse(data);
}

/**
 * Seed catalog of standard workshop and CNC machining tools.
 * Covers drilling (System 32, dowels, cams, hinges) and routing (grooving, pocketing, edge profiles).
 */
export const DEFAULT_TOOLS: ToolItem[] = [
  // 1. Drilling Bits
  {
    schemaVersion: 1,
    id: 'tool-drill-3',
    name: 'Broca Helicoidal Ø3mm (Guía de tornillo)',
    kind: 'drill-bit',
    diameterMm: 3,
    shankDiameterMm: 3,
    maxCutDepthMm: 45,
    fluteLengthMm: 35,
    drillType: 'through',
    rotationSpeedRpm: 3000,
    price: TO_CONFIRM,
    notes: 'Agujero guía para tornillos de ensamble 3.5x40 / 4x50',
  },
  {
    schemaVersion: 1,
    id: 'tool-drill-5',
    name: 'Broca Sistema 32 Ø5mm (Pasadores de estante)',
    kind: 'drill-bit',
    diameterMm: 5,
    shankDiameterMm: 10,
    maxCutDepthMm: 30,
    fluteLengthMm: 20,
    drillType: 'blind',
    rotationSpeedRpm: 4500,
    price: TO_CONFIRM,
    notes: 'Perforado ciego para soporte de estantes y tornillos euro 6.3mm',
  },
  {
    schemaVersion: 1,
    id: 'tool-drill-8',
    name: 'Broca para Tarugos Ø8mm',
    kind: 'drill-bit',
    diameterMm: 8,
    shankDiameterMm: 10,
    maxCutDepthMm: 35,
    fluteLengthMm: 25,
    drillType: 'blind',
    rotationSpeedRpm: 4000,
    price: TO_CONFIRM,
    notes: 'Tarugos de madera 8x30 / 8x35mm para ensamble oculto',
  },
  {
    schemaVersion: 1,
    id: 'tool-drill-10',
    name: 'Broca Ø10mm (Pernos y casquillos)',
    kind: 'drill-bit',
    diameterMm: 10,
    shankDiameterMm: 10,
    maxCutDepthMm: 40,
    fluteLengthMm: 30,
    drillType: 'blind',
    rotationSpeedRpm: 3500,
    price: TO_CONFIRM,
    notes: 'Pernos pasantes y casquillos de unión modular',
  },
  {
    schemaVersion: 1,
    id: 'tool-forstner-15',
    name: 'Fresa Forstner Ø15mm (Cajas excéntricas Minifix / Rafix)',
    kind: 'drill-bit',
    diameterMm: 15,
    shankDiameterMm: 10,
    maxCutDepthMm: 14.5,
    fluteLengthMm: 15,
    drillType: 'forstner',
    rotationSpeedRpm: 2500,
    price: TO_CONFIRM,
    notes: 'Caja para caja excéntrica estándar Minifix de 15mm de diámetro y 12.5mm de profundidad',
  },
  {
    schemaVersion: 1,
    id: 'tool-forstner-35',
    name: 'Fresa Forstner Ø35mm (Cazoleta de bisagras de libro / cazoleta)',
    kind: 'drill-bit',
    diameterMm: 35,
    shankDiameterMm: 10,
    maxCutDepthMm: 13,
    fluteLengthMm: 14,
    drillType: 'forstner',
    rotationSpeedRpm: 1800,
    price: TO_CONFIRM,
    notes: 'Cazoleta estándar Euro para bisagras articuladas en puertas de 15 a 22mm',
  },

  // 2. Straight Router Bits (Grooving & Pockets)
  {
    schemaVersion: 1,
    id: 'tool-router-straight-3',
    name: 'Fresa Cilíndrica Recta Ø3mm (Ranuras de fondo 3mm)',
    kind: 'straight-router-bit',
    diameterMm: 3,
    shankDiameterMm: 6,
    maxCutDepthMm: 10,
    fluteLengthMm: 12,
    profileKind: 'straight',
    rotationSpeedRpm: 18000,
    feedRateMmMin: 2500,
    price: TO_CONFIRM,
    notes: 'Ranuras posteriores para fondos de fibrofácil / MDF de 3mm',
  },
  {
    schemaVersion: 1,
    id: 'tool-router-straight-6',
    name: 'Fresa Cilíndrica Recta Ø6mm (Ranuras fondos 5.5mm / Pasacables)',
    kind: 'straight-router-bit',
    diameterMm: 6,
    shankDiameterMm: 8,
    maxCutDepthMm: 18,
    fluteLengthMm: 20,
    profileKind: 'straight',
    rotationSpeedRpm: 18000,
    feedRateMmMin: 3500,
    price: TO_CONFIRM,
    notes: 'Ranurado para fondos reforzados de 5.5mm o ranuras de tiras LED',
  },
  {
    schemaVersion: 1,
    id: 'tool-router-straight-10',
    name: 'Fresa Cilíndrica Recta Ø10mm (Cajeados y desbaste)',
    kind: 'straight-router-bit',
    diameterMm: 10,
    shankDiameterMm: 12,
    maxCutDepthMm: 30,
    fluteLengthMm: 32,
    profileKind: 'straight',
    rotationSpeedRpm: 16000,
    feedRateMmMin: 4000,
    price: TO_CONFIRM,
    notes: 'Cajeados de herrajes embutidos, cerraduras y calados interiores con radio R5',
  },
  {
    schemaVersion: 1,
    id: 'tool-router-straight-12',
    name: 'Fresa Cilíndrica Recta Ø12mm (Corte perimetral CNC)',
    kind: 'straight-router-bit',
    diameterMm: 12,
    shankDiameterMm: 12,
    maxCutDepthMm: 45,
    fluteLengthMm: 45,
    profileKind: 'straight',
    rotationSpeedRpm: 16000,
    feedRateMmMin: 4500,
    price: TO_CONFIRM,
    notes: 'Corte perimetral en placa entera para centros de mecanizado CNC',
  },

  // 3. Profile Router Bits (Edge Molding & Grip Pulls)
  {
    schemaVersion: 1,
    id: 'tool-router-chamfer-45',
    name: 'Fresa de Chaflán 45° con Rodamiento (Bisel decorativo)',
    kind: 'profile-router-bit',
    diameterMm: 32,
    shankDiameterMm: 8,
    maxCutDepthMm: 12,
    profileKind: 'chamfer-45',
    rotationSpeedRpm: 16000,
    price: TO_CONFIRM,
    notes: 'Bisel a 45 grados en cantos de frentes de cajón o puertas',
  },
  {
    schemaVersion: 1,
    id: 'tool-router-roundover-r3',
    name: 'Fresa de Redondeo R3mm con Rodamiento',
    kind: 'profile-router-bit',
    diameterMm: 19,
    shankDiameterMm: 8,
    maxCutDepthMm: 10,
    profileKind: 'roundover',
    profileRadiusMm: 3,
    rotationSpeedRpm: 18000,
    price: TO_CONFIRM,
    notes: 'Matado de aristas y redondeo de cantos para frentes laqueados',
  },
  {
    schemaVersion: 1,
    id: 'tool-router-jpull',
    name: 'Fresa Perfil J-Pull (Tirador Gola Integrado)',
    kind: 'profile-router-bit',
    diameterMm: 38,
    shankDiameterMm: 12,
    maxCutDepthMm: 22,
    profileKind: 'j-pull',
    rotationSpeedRpm: 14000,
    price: TO_CONFIRM,
    notes: 'Mecanizado de tirador embutido en canto superior de frentes de cajón',
  },
];
