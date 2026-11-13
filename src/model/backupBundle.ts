import { z } from 'zod';
import { materialSchema } from './material';
import { edgeBandSchema } from './edgeBand';
import { hardwareSchema } from './hardware';
import { projectSchema } from './project';
import { projectConfigSchema } from './projectConfig';
import { userTemplateSchema } from './userTemplate';

export const BACKUP_BUNDLE_FORMAT = 'cadcat-backup' as const;

/**
 * Zod schema for a portable full-workspace CadCat backup bundle (.cadcat.json).
 * Enables zero-backend PC <-> mobile sync and local backups.
 */
export const backupBundleSchema = z.object({
  format: z.literal(BACKUP_BUNDLE_FORMAT),
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  appVersion: z.string().optional(),
  projects: z.array(projectSchema).default([]),
  projectConfig: projectConfigSchema.nullable().default(null),
  materials: z.array(materialSchema).default([]),
  edgeBands: z.array(edgeBandSchema).default([]),
  hardware: z.array(hardwareSchema).default([]),
  userTemplates: z.array(userTemplateSchema).default([]),
});

export type CadCatBackupBundle = z.infer<typeof backupBundleSchema>;

/**
 * Validates and parses an unknown payload as a CadCatBackupBundle.
 */
export function validateBackupBundle(data: unknown): CadCatBackupBundle {
  return backupBundleSchema.parse(data);
}
