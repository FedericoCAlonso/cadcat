import { type Material, type EdgeBand, type Module } from '../../model';
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
    build: (params, mat, bands, ebId) => buildDoorCabinet(params, mat, bands, ebId),
  },
  {
    id: 'drawer-unit',
    name: 'Drawer Unit (3 Drawers)',
    description: 'Base carcase with three drawer sub-assemblies and slide clearances.',
    build: (params, mat, bands, ebId) => buildDrawerUnit(params, mat, bands, ebId),
  },
  {
    id: 'partition-cabinet',
    name: '2-Bay Partition Cabinet',
    description: 'Carcase with vertical partition dividing shelves and drawer units.',
    build: (params, mat, bands, ebId) => buildPartitionCabinet(params, mat, bands, ebId),
  },
];

export function getTemplateById(templateId: string): TemplateDefinition {
  const found = TEMPLATES.find((t) => t.id === templateId);
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
