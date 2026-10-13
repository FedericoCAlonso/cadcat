import { type Material, type EdgeBand, type Module } from '../../model';
import { type ResolvedPieceWithCutSize } from '../edgeBand';
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

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  build: (
    params: { width: number; height: number; depth: number },
    material: Material,
    edgeBands?: EdgeBand[],
    edgeBandId?: string,
  ) => {
    module: Module;
    resolvedPieces: ResolvedPieceWithCutSize[];
  };
}

export const TEMPLATES: TemplateDefinition[] = [
  {
    id: 'base-cabinet',
    name: 'Base Cabinet (1 Shelf)',
    description: 'Two sides, bottom, front/back rails, back panel, and one shelf.',
    build: (params, mat, bands, ebId) => buildBaseCabinet(params, mat, bands, ebId),
  },
  {
    id: 'drawer-unit',
    name: 'Drawer Unit (3 Drawers)',
    description: 'Base carcase with three drawer sub-assemblies and slide clearances.',
    build: (params, mat, bands, ebId) => buildDrawerUnit(params, mat, bands, ebId),
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
};
