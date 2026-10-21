import { z } from 'zod';
import { jointStrategySchema } from './projectConfig';
import { interferenceConfigSchema } from './interferences';

export const projectModuleItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  quantity: z.number().int().positive().default(1),
  templateId: z.string().default('base-modular'),
  width: z.number().positive(),
  height: z.number().positive(),
  depth: z.number().positive(),
  selectedMaterialId: z.string().default(''),
  selectedEdgeBandId: z.string().default(''),
  frontsMaterialId: z.string().default(''),
  drawerBoxesMaterialId: z.string().default(''),
  backingsMaterialId: z.string().default(''),
  isCustomModular: z.boolean().default(true),
  roofType: z.enum(['solid-panel', 'front-back-rails', 'none']).default('front-back-rails'),
  jointPriority: z.enum(['lateral-over-bottom', 'bottom-over-lateral', 'miter-45']).default('lateral-over-bottom'),
  hasBacking: z.boolean().default(true),
  backingType: z.enum(['groove', 'rebate', 'overlay', 'none']).default('groove'),
  backingThicknessMm: z.number().positive().default(3),
  isIslandCabinet: z.boolean().default(false),
  rearStructuralRails: z.enum(['none', 'top-and-bottom', 'top-only']).default('none'),
  rearStructuralRailsWidthMm: z.number().positive().default(100),
  partitionPassThroughRoof: z.boolean().default(false),
  gridType: z.enum(['1-bay', '2-bays-vertical', '3-bays-vertical', '2-bays-horizontal']).default('1-bay'),
  bays: z.array(z.any()).default([]),
  bayTracks: z.array(z.any()).optional(),
  jointStrategy: jointStrategySchema.default('confirmat'),
  pieceJointOverrides: z.record(z.string(), z.string()).optional(),
  pieceMaterialOverrides: z.record(z.string(), z.string()).optional(),
  pieceThicknessOverrides: z.record(z.string(), z.number()).optional(),
  pieceEdgeBandOverrides: z.record(z.string(), z.any()).optional(),
  countertopEnabled: z.boolean().optional(),
  countertopDefinition: z.any().optional(),
  interferences: interferenceConfigSchema.optional(),
});
export type ProjectModuleItem = z.infer<typeof projectModuleItemSchema>;

export const projectSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1),
  clientName: z.string().default(''),
  description: z.string().default(''),
  modules: z.array(projectModuleItemSchema).min(1),
  activeModuleId: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof projectSchema>;

export function validateProject(data: unknown): Project {
  return projectSchema.parse(data);
}

export function createDefaultProject(defaultModule: ProjectModuleItem): Project {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: 'proj-default',
    name: 'Proyecto Principal',
    clientName: 'Cliente Estándar',
    description: 'Proyecto de mobiliario con optimización de placas.',
    modules: [defaultModule],
    activeModuleId: defaultModule.id,
    createdAt: now,
    updatedAt: now,
  };
}
