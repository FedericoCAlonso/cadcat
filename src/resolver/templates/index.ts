import { type Material, type EdgeBand, type Module, type ProjectConfig } from '../../model';
import { type ResolvedPieceWithCutSize } from '../edgeBand';
import { type PlacementTree } from '../tree';
import {
  buildBaseCabinet,
  type BaseCabinetParams,
  DEFAULT_BASE_CABINET_PARAMS,
} from './baseCabinet';
import {
  buildDrawerUnit,
  type DrawerUnitParams,
  DEFAULT_DRAWER_UNIT_PARAMS,
  DEFAULT_DRAWER_SLIDE_CLEARANCE_MM,
  DEFAULT_DRAWER_GAP_MM,
} from './drawerUnit';
import {
  buildDoorCabinet,
  type DoorCabinetParams,
  DEFAULT_DOOR_CABINET_PARAMS,
} from './doorCabinet';
import {
  buildPartitionCabinet,
  type PartitionCabinetParams,
  DEFAULT_PARTITION_CABINET_PARAMS,
} from './partitionCabinet';
import { buildModularModule } from '../composition/compositionEngine';
import { getModularPresetById } from '../composition/presets';

export interface TemplateBuildResult {
  module: Module;
  placementTree: PlacementTree;
  resolvedPieces: ResolvedPieceWithCutSize[];
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  build: (
    params: { width: number; height: number; depth: number },
    material: Material,
    edgeBands?: EdgeBand[],
    edgeBandId?: string,
    projectConfig?: ProjectConfig,
  ) => TemplateBuildResult;
}

import { type UserTemplate } from '../../model';
import { type ModularModuleDefinition, type BayGridDefinition } from '../composition/types';

export const BASE_EMPTY_TEMPLATE: TemplateDefinition = {
  id: 'modular-empty',
  name: 'Estructura Hueco Libre',
  description: 'Casco base con estructura paramétrica libre para diseñar y agregar refuerzos o accesorios.',
  build: (params, mat, bands, ebId) => {
    const def = getModularPresetById('preset-empty').createDefinition(params, { carcassMaterialId: mat.id }, ebId);
    const thickness = typeof mat.thicknessMm === 'number' ? mat.thicknessMm : 18;
    const res = buildModularModule(def, { carcassThicknessMm: thickness, edgeBands: bands });
    return { module: res.module, placementTree: res.placementTree, resolvedPieces: res.resolvedPieces };
  },
};

/**
 * Creates an executable TemplateDefinition from a UserTemplate stored in the database.
 */
export function createUserTemplateDefinition(userTemplate: UserTemplate): TemplateDefinition {
  return {
    id: userTemplate.id,
    name: userTemplate.name,
    description: userTemplate.description ?? 'Plantilla personalizada por el usuario.',
    build: (params, mat, bands, ebId) => {
      const gridDef: BayGridDefinition | undefined =
        userTemplate.gridType === '2-bays-vertical'
          ? { axis: 'horizontal', tracks: [{ type: 'fractional', valueFr: 1 }, { type: 'fractional', valueFr: 1 }] }
          : userTemplate.gridType === '3-bays-vertical'
          ? {
              axis: 'horizontal',
              tracks: [
                { type: 'fractional', valueFr: 1 },
                { type: 'fractional', valueFr: 1 },
                { type: 'fractional', valueFr: 1 },
              ],
            }
          : userTemplate.gridType === '2-bays-horizontal'
          ? { axis: 'vertical', tracks: [{ type: 'fractional', valueFr: 1 }, { type: 'fractional', valueFr: 1 }] }
          : undefined;

      const def: ModularModuleDefinition = {
        id: userTemplate.id,
        carcass: {
          width: params.width,
          height: params.height,
          depth: params.depth,
          roofType: userTemplate.carcassSettings.roofType,
          jointPriority: userTemplate.carcassSettings.jointPriority,
          hasBacking: userTemplate.carcassSettings.hasBacking,
          railOrientation: userTemplate.carcassSettings.railOrientation,
          hasMiddleBrace: userTemplate.carcassSettings.hasMiddleBrace,
          middleBraceWidthMm: userTemplate.carcassSettings.middleBraceWidthMm,
          hasWallHangingRail: userTemplate.carcassSettings.hasWallHangingRail,
          wallHangingRailWidthMm: userTemplate.carcassSettings.wallHangingRailWidthMm,
          hasPlinth: userTemplate.carcassSettings.hasPlinth,
          plinthHeightMm: userTemplate.carcassSettings.plinthHeightMm,
          plinthSetbackMm: userTemplate.carcassSettings.plinthSetbackMm,
        },
        grid: gridDef,
        bays: userTemplate.bays,
        materials: {
          carcassMaterialId: userTemplate.materials?.carcassMaterialId ?? mat.id,
          frontsMaterialId: userTemplate.materials?.frontsMaterialId ?? mat.id,
          drawerBoxesMaterialId: userTemplate.materials?.drawerBoxesMaterialId ?? mat.id,
          backingsMaterialId: userTemplate.materials?.backingsMaterialId ?? mat.id,
        },
        edgeBandId: userTemplate.materials?.edgeBandId ?? ebId,
      };
      const thickness = typeof mat.thicknessMm === 'number' ? mat.thicknessMm : 18;
      const res = buildModularModule(def, { carcassThicknessMm: thickness, edgeBands: bands });
      return { module: res.module, placementTree: res.placementTree, resolvedPieces: res.resolvedPieces };
    },
  };
}

import { buildWallShelving } from '../wallShelves/wallShelvesBuilder';
import { calculatePieceCutSize } from '../edgeBand';
import { createRectangularContour } from '../piece';

export const WALL_SHELVING_TEMPLATE: TemplateDefinition = {
  id: 'wall-shelves',
  name: 'Estantería de Pared con Ménsulas',
  description: 'Estantes de pared calculados con distribución óptima de ménsulas, flecha admisible y plano de replanteo.',
  build: (params, mat, bands = [], ebId) => {
    const thickness = typeof mat.thicknessMm === 'number' ? mat.thicknessMm : 18;
    const shelfCount = Math.max(1, Math.round(params.height / 320)) || 3;
    const wallOutput = buildWallShelving({
      id: 'wall-shelves-module',
      widthMm: params.width,
      depthMm: params.depth,
      thicknessMm: thickness,
      shelfCount,
      verticalSpacingMm: 320,
      bracketType: 'l-bracket',
      wallType: 'solid-brick',
      loadCategory: 'medium',
      boundaryCondition: 'free-ends',
      overhangMode: 'balanced-cantilever',
      materialId: mat.id,
      edgeBandId: ebId,
    });

    const positions = wallOutput.placementTree.resolvePositions();
    const resolvedPieces: ResolvedPieceWithCutSize[] = wallOutput.module.pieces.map((p) => {
      const cut = calculatePieceCutSize(p, bands);
      const pos = positions.get(p.id) ?? { x: 0, y: 0, z: 0 };
      const bandedList = [
        cut.bandedEdges.bottom,
        cut.bandedEdges.right,
        cut.bandedEdges.top,
        cut.bandedEdges.left,
      ].filter((b): b is NonNullable<typeof b> => Boolean(b));

      return {
        ...p,
        positionMm: pos,
        dimensionsMm: {
          width: p.contour.points[1]!.x,
          height: p.contour.points[2]!.y,
        },
        cutDimensionsMm: cut.cutDimensionsMm,
        cutContour: createRectangularContour(cut.cutDimensionsMm.width, cut.cutDimensionsMm.height),
        bandedEdges: bandedList,
      };
    });

    return {
      module: wallOutput.module,
      placementTree: wallOutput.placementTree,
      resolvedPieces,
    };
  },
};

/**
 * Single base template as requested: only "Estructura Hueco Libre".
 * All other designs are saved and managed as user templates.
 */
export const TEMPLATES: TemplateDefinition[] = [BASE_EMPTY_TEMPLATE];
export const MODULAR_TEMPLATES: TemplateDefinition[] = [BASE_EMPTY_TEMPLATE];
export const ALL_TEMPLATES: TemplateDefinition[] = [BASE_EMPTY_TEMPLATE];

export function getTemplateById(templateId: string, userTemplates?: UserTemplate[]): TemplateDefinition {
  if (templateId === BASE_EMPTY_TEMPLATE.id) {
    return BASE_EMPTY_TEMPLATE;
  }
  if (templateId === WALL_SHELVING_TEMPLATE.id) {
    return WALL_SHELVING_TEMPLATE;
  }
  if (userTemplates) {
    const foundUser = userTemplates.find((t) => t.id === templateId);
    if (foundUser) {
      return createUserTemplateDefinition(foundUser);
    }
  }
  return BASE_EMPTY_TEMPLATE;
}

export {
  buildBaseCabinet,
  type BaseCabinetParams,
  DEFAULT_BASE_CABINET_PARAMS,
  buildDrawerUnit,
  type DrawerUnitParams,
  DEFAULT_DRAWER_UNIT_PARAMS,
  DEFAULT_DRAWER_SLIDE_CLEARANCE_MM,
  DEFAULT_DRAWER_GAP_MM,
  buildDoorCabinet,
  type DoorCabinetParams,
  DEFAULT_DOOR_CABINET_PARAMS,
  buildPartitionCabinet,
  type PartitionCabinetParams,
  DEFAULT_PARTITION_CABINET_PARAMS,
};

export {
  buildDoorSubAssembly,
  calculateHingeCount,
  calculateHingePositions,
  type DoorConfig,
  type DoorMountType,
  type DoorSubAssemblyResult,
} from './door';

export {
  buildDrawerSubAssembly,
  DRAWER_SLIDE_CLEARANCES_MM,
  type DrawerSlideType,
  type DrawerFrontMount,
  type DrawerConfig,
  type DrawerSubAssemblyResult,
} from './drawer';

export {
  buildShelf,
  type ShelfConfig,
  type ShelfMountType,
  type ShelfResult,
} from './shelf';

export {
  buildPartition,
  type PartitionConfig,
  type PartitionResult,
} from './partition';
