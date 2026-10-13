import {
  type Material,
  type EdgeBand,
  type Hardware,
  type CostConfig,
} from '../model';
import { type BillOfMaterials } from './bom';
import { type NestingResult } from '../workers';

export interface CostItem {
  id: string;
  name: string;
  category: 'material' | 'edge-band' | 'hardware' | 'cutting';
  quantity: number;
  unit: 'sheet' | 'meter' | 'piece' | 'pass';
  unitPrice: number | 'TO_CONFIRM';
  subtotal: number | 'TO_CONFIRM';
}

export interface ModuleCostSummary {
  moduleId: string;
  items: CostItem[];
  materialTotal: number | 'TO_CONFIRM';
  edgeBandTotal: number | 'TO_CONFIRM';
  hardwareTotal: number | 'TO_CONFIRM';
  cutPassCost: number;
  grandTotal: number | 'TO_CONFIRM';
  confirmedSubtotal: number;
  isFullyConfirmed: boolean;
}

export interface CostCalculationInput {
  bom: BillOfMaterials;
  nestingResult: NestingResult;
  materials: Material[] | { materials: Material[] } | Map<string, Material>;
  edgeBands: EdgeBand[] | { edgeBands: EdgeBand[] } | Map<string, EdgeBand>;
  hardware: Hardware[] | { hardware: Hardware[] } | Map<string, Hardware>;
  costConfig?: CostConfig;
}

function normalizeMap<T extends { id: string }>(
  data: T[] | { [key: string]: unknown } | Map<string, T>,
  listKey: string,
): Map<string, T> {
  if (data instanceof Map) {
    return data as Map<string, T>;
  }
  const list = Array.isArray(data)
    ? data
    : ((data as Record<string, unknown>)[listKey] as T[] | undefined) ?? [];
  const map = new Map<string, T>();
  for (const item of list) {
    map.set(item.id, item);
  }
  return map;
}

/**
 * Calculate the cost of material, edge band, and hardware for a module.
 */
export function calculateModuleCost(input: CostCalculationInput): ModuleCostSummary {
  const { bom, nestingResult } = input;
  const materialMap = normalizeMap<Material>(input.materials, 'materials');
  const edgeBandMap = normalizeMap<EdgeBand>(input.edgeBands, 'edgeBands');
  const hardwareMap = normalizeMap<Hardware>(input.hardware, 'hardware');

  const items: CostItem[] = [];

  // 1. Material cost (per sheet used in nesting)
  const sheetsByMaterial = new Map<string, number>();
  for (const sheet of nestingResult.sheets) {
    const current = sheetsByMaterial.get(sheet.materialId) ?? 0;
    sheetsByMaterial.set(sheet.materialId, current + 1);
  }

  for (const [materialId, sheetCount] of sheetsByMaterial.entries()) {
    const mat = materialMap.get(materialId);
    const unitPrice = (typeof mat?.pricePerSheet === 'number') ? mat.pricePerSheet : 'TO_CONFIRM';
    const subtotal = typeof unitPrice === 'number' ? Number((sheetCount * unitPrice).toFixed(2)) : 'TO_CONFIRM';

    items.push({
      id: materialId,
      name: mat?.name ?? `Sheet Material (${materialId})`,
      category: 'material',
      quantity: sheetCount,
      unit: 'sheet',
      unitPrice,
      subtotal,
    });
  }

  // 2. Edge band cost (per linear meter)
  for (const ebItem of bom.edgeBands) {
    const band = edgeBandMap.get(ebItem.edgeBandId);
    const unitPrice = (typeof band?.pricePerMeter === 'number') ? band.pricePerMeter : 'TO_CONFIRM';
    const subtotal = typeof unitPrice === 'number'
      ? Number((ebItem.lengthMeters * unitPrice).toFixed(2))
      : 'TO_CONFIRM';

    items.push({
      id: ebItem.edgeBandId,
      name: `Edge Band (${ebItem.edgeBandId})`,
      category: 'edge-band',
      quantity: ebItem.lengthMeters,
      unit: 'meter',
      unitPrice,
      subtotal,
    });
  }

  // 3. Hardware cost (per piece)
  for (const hwItem of bom.hardware) {
    const hw = hardwareMap.get(hwItem.hardwareId);
    const unitPrice = (typeof hw?.pricePerUnit === 'number') ? hw.pricePerUnit : 'TO_CONFIRM';
    const subtotal = typeof unitPrice === 'number'
      ? Number((hwItem.count * unitPrice).toFixed(2))
      : 'TO_CONFIRM';

    items.push({
      id: hwItem.hardwareId,
      name: hw?.name ?? hwItem.name,
      category: 'hardware',
      quantity: hwItem.count,
      unit: 'piece',
      unitPrice,
      subtotal,
    });
  }

  // 4. Cutting passes cost
  let cutPassCost = 0;
  if (input.costConfig) {
    const totalCutPasses = nestingResult.totalCutPasses ?? 0;
    const pricePerCutPass = input.costConfig.pricePerCutPass;
    const isPriceNumber = typeof pricePerCutPass === 'number';

    if (isPriceNumber) {
      cutPassCost = Number((totalCutPasses * pricePerCutPass).toFixed(2));
    }

    const subtotal = isPriceNumber ? cutPassCost : 'TO_CONFIRM';

    items.push({
      id: 'cut-passes',
      name: 'Guillotine Cut Passes',
      category: 'cutting',
      quantity: totalCutPasses,
      unit: 'pass',
      unitPrice: pricePerCutPass,
      subtotal,
    });
  }

  // Helper to sum category items
  function calculateCategoryTotal(category: 'material' | 'edge-band' | 'hardware'): number | 'TO_CONFIRM' {
    const categoryItems = items.filter((it) => it.category === category);
    let total = 0;
    for (const it of categoryItems) {
      if (typeof it.subtotal === 'number') {
        total += it.subtotal;
      } else {
        return 'TO_CONFIRM';
      }
    }
    return Number(total.toFixed(2));
  }

  const materialTotal = calculateCategoryTotal('material');
  const edgeBandTotal = calculateCategoryTotal('edge-band');
  const hardwareTotal = calculateCategoryTotal('hardware');

  let confirmedSubtotal = 0;
  let isFullyConfirmed = true;

  for (const it of items) {
    if (typeof it.subtotal === 'number') {
      confirmedSubtotal += it.subtotal;
    } else {
      isFullyConfirmed = false;
    }
  }

  const grandTotal = isFullyConfirmed ? Number(confirmedSubtotal.toFixed(2)) : 'TO_CONFIRM';

  return {
    moduleId: bom.moduleId,
    items,
    materialTotal,
    edgeBandTotal,
    hardwareTotal,
    cutPassCost,
    grandTotal,
    confirmedSubtotal: Number(confirmedSubtotal.toFixed(2)),
    isFullyConfirmed,
  };
}
