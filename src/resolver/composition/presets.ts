import { type ModularModuleDefinition } from './types';
import { loadModularPresetsConfigFile, type ModularPresetConfig } from '../../config';

export interface ModularPreset {
  id: string;
  name: string;
  description: string;
  defaultDimensions: { width: number; height: number; depth: number };
  createDefinition: (
    dims?: { width?: number; height?: number; depth?: number },
    materials?: {
      carcassMaterialId?: string;
      frontsMaterialId?: string;
      drawerBoxesMaterialId?: string;
      backingsMaterialId?: string;
    },
    edgeBandId?: string,
  ) => ModularModuleDefinition;
}

/**
 * Registry for modular presets, supporting runtime extension (OCP & SRP).
 */
export class ModularPresetRegistry {
  private presets: ModularPreset[] = [];

  public constructor() {
    this.loadFromConfigFile();
  }

  /**
   * Registers a preset into the registry (OCP).
   */
  public register(preset: ModularPreset): void {
    const existingIndex = this.presets.findIndex((p) => p.id === preset.id);
    if (existingIndex >= 0) {
      this.presets[existingIndex] = preset;
    } else {
      this.presets.push(preset);
    }
  }

  /**
   * Retrieves all registered presets.
   */
  public getAll(): ModularPreset[] {
    return [...this.presets];
  }

  /**
   * Finds a preset by ID, falling back to the first preset.
   */
  public getById(presetId: string): ModularPreset {
    const found = this.presets.find((p) => p.id === presetId);
    return found ?? this.presets[0]!;
  }

  /**
   * Loads presets from modularPresets.json configuration file.
   */
  private loadFromConfigFile(): void {
    const configs = loadModularPresetsConfigFile();
    for (const conf of configs) {
      this.presets.push(this.createPresetFromConfig(conf));
    }
  }

  /**
   * Builds a ModularPreset instance from parsed configuration.
   */
  private createPresetFromConfig(conf: ModularPresetConfig): ModularPreset {
    return {
      id: conf.id,
      name: conf.name,
      description: conf.description,
      defaultDimensions: conf.defaultDimensions,
      createDefinition: (dims, mats, ebId): ModularModuleDefinition => ({
        id: `module-${conf.id}`,
        carcass: {
          width: dims?.width ?? conf.defaultDimensions.width,
          height: dims?.height ?? conf.defaultDimensions.height,
          depth: dims?.depth ?? conf.defaultDimensions.depth,
          jointPriority: conf.carcass.jointPriority,
          roofType: conf.carcass.roofType,
          railWidthMm: conf.carcass.railWidthMm ?? 80,
          hasBacking: conf.carcass.hasBacking,
        },
        grid: conf.grid
          ? {
              axis: conf.grid.axis,
              tracks: conf.grid.tracks,
              dividerThicknessMm: conf.grid.dividerThicknessMm ?? 18,
            }
          : undefined,
        bays: conf.bays,
        materials: {
          carcassMaterialId: mats?.carcassMaterialId ?? conf.defaultMaterials.carcassMaterialId,
          frontsMaterialId: mats?.frontsMaterialId ?? conf.defaultMaterials.frontsMaterialId,
          drawerBoxesMaterialId: mats?.drawerBoxesMaterialId ?? conf.defaultMaterials.drawerBoxesMaterialId,
          backingsMaterialId: mats?.backingsMaterialId ?? conf.defaultMaterials.backingsMaterialId,
        },
        edgeBandId: ebId,
      }),
    };
  }
}

/**
 * Singleton preset registry instance.
 */
export const defaultModularPresetRegistry: ModularPresetRegistry = new ModularPresetRegistry();

export const MODULAR_PRESETS: ModularPreset[] = defaultModularPresetRegistry.getAll();

export function getModularPresetById(presetId: string): ModularPreset {
  return defaultModularPresetRegistry.getById(presetId);
}
