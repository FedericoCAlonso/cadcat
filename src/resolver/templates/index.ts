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

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'base-cabinet',
    name: 'Base Cabinet (1 Shelf)',
    description: 'Two sides, bottom, front/back rails, back panel, and one shelf.',
    build: (params, mat, bands, ebId) => buildBaseCabinet(params, mat, bands, ebId),
  },
  {
    id: 'door-cabinet',
    name: 'Door Cabinet (Hinged Doors & Shelf)',
    description: 'Carcase with single or double hinged doors and adjustable shelf.',
    build: (params, mat, bands, ebId, conf) => buildDoorCabinet(params, mat, bands, ebId, conf),
  },
  {
    id: 'drawer-unit',
    name: 'Drawer Unit (3 Drawers)',
    description: 'Base carcase with three drawer sub-assemblies and slide clearances.',
    build: (params, mat, bands, ebId, conf) => buildDrawerUnit(params, mat, bands, ebId, conf),
  },
  {
    id: 'partition-cabinet',
    name: '2-Bay Partition Cabinet',
    description: 'Carcase with vertical partition dividing shelves and drawer units.',
    build: (params, mat, bands, ebId) => buildPartitionCabinet(params, mat, bands, ebId),
  },
];

export const MODULAR_TEMPLATES: TemplateDefinition[] = [
  {
    id: 'modular-empty',
    name: 'Modular: Hueco Libre / Casco',
    description: 'Casco compositivo configurable con fajas de amarre o tapa entera.',
    build: (params, mat, bands, ebId) => {
      const def = getModularPresetById('preset-empty').createDefinition(params, { carcassMaterialId: mat.id }, ebId);
      const thickness = typeof mat.thicknessMm === 'number' ? mat.thicknessMm : 18;
      const res = buildModularModule(def, { carcassThicknessMm: thickness, edgeBands: bands });
      return { module: res.module, placementTree: res.placementTree, resolvedPieces: res.resolvedPieces };
    },
  },
  {
    id: 'modular-drawer-unit-3',
    name: 'Modular: Cajonera 3 Cajones (fr + mm)',
    description: 'Cajonera paramétrica con cajón cubertero fijo (140mm) y dos olleros en fr.',
    build: (params, mat, bands, ebId) => {
      const def = getModularPresetById('preset-drawer-unit-3').createDefinition(params, { carcassMaterialId: mat.id }, ebId);
      const thickness = typeof mat.thicknessMm === 'number' ? mat.thicknessMm : 18;
      const res = buildModularModule(def, { carcassThicknessMm: thickness, edgeBands: bands });
      return { module: res.module, placementTree: res.placementTree, resolvedPieces: res.resolvedPieces };
    },
  },
  {
    id: 'modular-door-cabinet',
    name: 'Modular: Alacena 2 Puertas',
    description: 'Alacena con techo macizo y dos puertas batientes completas.',
    build: (params, mat, bands, ebId) => {
      const def = getModularPresetById('preset-door-cabinet-2').createDefinition(params, { carcassMaterialId: mat.id }, ebId);
      const thickness = typeof mat.thicknessMm === 'number' ? mat.thicknessMm : 18;
      const res = buildModularModule(def, { carcassThicknessMm: thickness, edgeBands: bands });
      return { module: res.module, placementTree: res.placementTree, resolvedPieces: res.resolvedPieces };
    },
  },
  {
    id: 'modular-partition-combo',
    name: 'Modular: 2 Vanos (Estantes + Cajones)',
    description: 'Vano izquierdo con 2 estantes y vano derecho con 3 cajones.',
    build: (params, mat, bands, ebId) => {
      const def = getModularPresetById('preset-partition-combo').createDefinition(params, { carcassMaterialId: mat.id }, ebId);
      const thickness = typeof mat.thicknessMm === 'number' ? mat.thicknessMm : 18;
      const res = buildModularModule(def, { carcassThicknessMm: thickness, edgeBands: bands });
      return { module: res.module, placementTree: res.placementTree, resolvedPieces: res.resolvedPieces };
    },
  },
  {
    id: 'modular-pullout-tray',
    name: 'Modular: Bandeja Extraíble Telescópica',
    description: 'Módulo bajo con bandeja deslizable reforzada para ollas y electrodomésticos.',
    build: (params, mat, bands, ebId) => {
      const def = getModularPresetById('preset-pullout-tray').createDefinition(params, { carcassMaterialId: mat.id }, ebId);
      const thickness = typeof mat.thicknessMm === 'number' ? mat.thicknessMm : 18;
      const res = buildModularModule(def, { carcassThicknessMm: thickness, edgeBands: bands });
      return { module: res.module, placementTree: res.placementTree, resolvedPieces: res.resolvedPieces };
    },
  },
  {
    id: 'modular-bifold-closure',
    name: 'Modular: Puerta Plegable Bi-Fold',
    description: 'Alacena con puerta elevable articulada en dos hojas.',
    build: (params, mat, bands, ebId) => {
      const def = getModularPresetById('preset-bifold-closure').createDefinition(params, { carcassMaterialId: mat.id }, ebId);
      const thickness = typeof mat.thicknessMm === 'number' ? mat.thicknessMm : 18;
      const res = buildModularModule(def, { carcassThicknessMm: thickness, edgeBands: bands });
      return { module: res.module, placementTree: res.placementTree, resolvedPieces: res.resolvedPieces };
    },
  },
];

export const ALL_TEMPLATES: TemplateDefinition[] = [...TEMPLATES, ...MODULAR_TEMPLATES];

export function getTemplateById(templateId: string): TemplateDefinition {
  const found = ALL_TEMPLATES.find((t) => t.id === templateId);
  return found ?? TEMPLATES[0]!;
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
