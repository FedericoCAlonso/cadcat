import { z } from 'zod';
import { pieceSchema } from './piece';
import { jointSchema } from './joint';
import { interferenceConfigSchema } from './interferences';

/**
 * A sub-assembly created from a template.
 */
export const subAssemblySchema = z.object({
  id: z.string().min(1),
  templateId: z.string().min(1),
  parameters: z.record(z.string(), z.number()),
  pieceIds: z.array(z.string()),
});
export type SubAssembly = z.infer<typeof subAssemblySchema>;

/**
 * Manual override attached to a piece id.
 */
export const overrideSchema = z.object({
  pieceId: z.string().min(1),
  property: z.string().min(1),
  value: z.union([z.number(), z.string(), z.boolean()]),
});
export type Override = z.infer<typeof overrideSchema>;

/**
 * Complete furniture module.
 * A module is the root unit that owns pieces and joints.
 */
export const moduleSchema = z.object({
  schemaVersion: z.number().int().positive(),
  id: z.string().min(1),
  parameters: z.record(z.string(), z.number()),
  rootPieceId: z.string().min(1),
  pieces: z.array(pieceSchema),
  joints: z.array(jointSchema),
  subAssemblies: z.array(subAssemblySchema),
  overrides: z.record(z.string(), overrideSchema),
  interferences: interferenceConfigSchema.optional(),
});
export type Module = z.infer<typeof moduleSchema>;

/**
 * Validate and parse unknown data as a Module.
 */
export function validateModule(data: unknown): Module {
  return moduleSchema.parse(data);
}
