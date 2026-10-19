import {
  type Material,
  type EdgeBand,
  type Hardware,
  type CostConfig,
} from '../model';
import {
  type BillOfMaterials,
  type BOMPieceItem,
  type BOMHardwareItem,
  type BOMEdgeBandItem,
} from './bom';
import {
  type ModuleCostSummary,
  calculateModuleCost,
} from './cost';
import { type ResolvedPieceWithCutSize } from './edgeBand';
import { type AssemblyGauge } from './gauges';
import { type NestingItem, runMultiMaterialGuillotineNesting, type MultiMaterialNestingResult } from '../workers';

export interface ModuleToConsolidate {
  moduleId: string;
  moduleName: string;
  quantity: number;
  pieces: ResolvedPieceWithCutSize[];
  bom?: BillOfMaterials | null;
  gauges?: AssemblyGauge[];
}

export interface ConsolidatedPiece extends ResolvedPieceWithCutSize {
  moduleId: string;
  moduleName: string;
  moduleInstanceIndex: number;
}

/**
 * Consolidates pieces from multiple modules taking module quantities into account.
 * Clones each piece per quantity and prefixes unique IDs while preserving dimensional and edgeband data.
 */
export function consolidateProjectPieces(
  modules: ModuleToConsolidate[],
): ConsolidatedPiece[] {
  const result: ConsolidatedPiece[] = [];

  for (const mod of modules) {
    const qty = Math.max(1, Math.floor(mod.quantity || 1));
    for (let instance = 1; instance <= qty; instance++) {
      for (const piece of mod.pieces) {
        const uniqueId = qty > 1 || modules.length > 1
          ? `${mod.moduleId}__${piece.id}__i${instance}`
          : piece.id;

        result.push({
          ...piece,
          id: uniqueId,
          moduleId: mod.moduleId,
          moduleName: mod.moduleName,
          moduleInstanceIndex: instance,
        });
      }
    }
  }

  return result;
}

/**
 * Consolidates Bill of Materials across all project modules according to their quantities.
 */
export function consolidateProjectBom(
  modules: ModuleToConsolidate[],
): BillOfMaterials {
  const pieceItems: BOMPieceItem[] = [];
  const hardwareMap = new Map<string, { hardwareId: string; name: string; jointKind: string; count: number }>();
  const edgeBandMap = new Map<string, { edgeBandId: string; kind: string; lengthMm: number; lengthMeters: number }>();

  let totalAreaM2 = 0;
  let totalBandedLengthMeters = 0;
  let totalHardwareCount = 0;

  for (const mod of modules) {
    const qty = Math.max(1, Math.floor(mod.quantity || 1));

    // Aggregate pieces
    for (let instance = 1; instance <= qty; instance++) {
      for (const p of mod.pieces) {
        if (p.isAuxiliary) continue;
        const area = (p.cutDimensionsMm.width * p.cutDimensionsMm.height) / 1_000_000;
        totalAreaM2 += area;

        const pieceEdgeBandMeters = p.bandedEdges.reduce((acc, b) => acc + b.lengthMm / 1000, 0);
        totalBandedLengthMeters += pieceEdgeBandMeters;

        pieceItems.push({
          pieceId: qty > 1 || modules.length > 1 ? `${mod.moduleId}__${p.id}__i${instance}` : p.id,
          role: `[${mod.moduleName}] ${p.role}`,
          materialId: p.materialId,
          finishedDimensionsMm: p.dimensionsMm,
          cutDimensionsMm: p.cutDimensionsMm,
          thicknessMm: p.thicknessMm,
          areaM2: Number(area.toFixed(4)),
          structural: Boolean(p.structural),
          bandedEdges: p.bandedEdges,
        });
      }
    }

    // Aggregate hardware if BOM exists
    if (mod.bom?.hardware) {
      for (const hw of mod.bom.hardware) {
        const addedCount = hw.count * qty;
        totalHardwareCount += addedCount;
        const existing = hardwareMap.get(hw.hardwareId);
        if (existing) {
          existing.count += addedCount;
        } else {
          hardwareMap.set(hw.hardwareId, {
            ...hw,
            count: addedCount,
          });
        }
      }
    }

    // Aggregate edge bands if BOM exists
    if (mod.bom?.edgeBands) {
      for (const eb of mod.bom.edgeBands) {
        const addedMeters = Number((eb.lengthMeters * qty).toFixed(3));
        const addedMm = eb.lengthMm * qty;
        const existing = edgeBandMap.get(eb.edgeBandId);
        if (existing) {
          existing.lengthMeters += addedMeters;
          existing.lengthMm += addedMm;
        } else {
          edgeBandMap.set(eb.edgeBandId, {
            ...eb,
            lengthMeters: addedMeters,
            lengthMm: addedMm,
          });
        }
      }
    }
  }

  const hardwareItems: BOMHardwareItem[] = Array.from(hardwareMap.values());
  const edgeBandItems: BOMEdgeBandItem[] = Array.from(edgeBandMap.values());

  return {
    moduleId: 'project-consolidated',
    totalPieceCount: pieceItems.length,
    totalCutAreaM2: Number(totalAreaM2.toFixed(3)),
    totalEdgeBandMeters: Number(totalBandedLengthMeters.toFixed(3)),
    totalHardwareCount,
    pieces: pieceItems,
    hardware: hardwareItems,
    edgeBands: edgeBandItems,
  };
}

/**
 * Builds nesting items for the entire project, combining all modules and quantities.
 * Enables massive sheet yield improvements in guillotine nesting by fitting small pieces
 * from one module into offcuts of larger modules.
 */
export function buildProjectNestingItems(
  modules: ModuleToConsolidate[],
  options?: {
    includeAssemblyGauges?: boolean;
    materials?: Material[];
    activeMaterial?: Material;
  },
): NestingItem[] {
  const items: NestingItem[] = [];
  const materials = options?.materials ?? [];
  const activeMat = options?.activeMaterial;

  for (const mod of modules) {
    const qty = Math.max(1, Math.floor(mod.quantity || 1));

    for (let instance = 1; instance <= qty; instance++) {
      for (const p of mod.pieces) {
        const pieceMat = materials.find((m) => m.id === p.materialId) ?? activeMat;
        const canRotate = pieceMat ? !pieceMat.hasGrain : true;
        const uniqueId = qty > 1 || modules.length > 1
          ? `${mod.moduleId}__${p.id}__i${instance}`
          : p.id;

        items.push({
          id: uniqueId,
          pieceId: uniqueId,
          materialId: p.materialId,
          cutWidthMm: p.cutDimensionsMm.width,
          cutHeightMm: p.cutDimensionsMm.height,
          canRotate,
          isAuxiliary: Boolean(p.isAuxiliary),
        });
      }
    }

    // Assembly gauges (workshop rule: max 2 pieces per unique span per module)
    if (options?.includeAssemblyGauges && mod.gauges) {
      for (const g of mod.gauges) {
        const gaugeCount = Math.min(2, Math.max(1, g.occurrences.length));
        for (let i = 0; i < gaugeCount; i++) {
          const gId = `${mod.moduleId}__gauge_${g.label.toLowerCase()}_${i + 1}`;
          items.push({
            id: gId,
            pieceId: gId,
            materialId: activeMat?.id ?? 'mat-default',
            cutWidthMm: g.clearSpanMm,
            cutHeightMm: g.widthMm,
            canRotate: true,
            isAuxiliary: true,
          });
        }
      }
    }
  }

  return items;
}

/**
 * Runs full project multi-material nesting across all modules.
 */
export function runProjectNesting(
  modules: ModuleToConsolidate[],
  config: {
    materials: Material[];
    sawKerfMm?: number;
    trimMarginMm?: number;
    optimizationGoal?: 'min-waste' | 'min-passes';
    includeAssemblyGauges?: boolean;
  },
): MultiMaterialNestingResult {
  const nestingItems = buildProjectNestingItems(modules, {
    includeAssemblyGauges: config.includeAssemblyGauges,
    materials: config.materials,
    activeMaterial: config.materials[0],
  });

  return runMultiMaterialGuillotineNesting({
    items: nestingItems,
    sheetLookup: (matId) => {
      const mat = config.materials.find((m) => m.id === matId) ?? config.materials[0];
      const sLen = typeof mat?.sheetSizeMm?.length === 'number' ? mat.sheetSizeMm.length : 2800;
      const sWid = typeof mat?.sheetSizeMm?.width === 'number' ? mat.sheetSizeMm.width : 2070;
      return {
        materialId: mat?.id ?? matId,
        lengthMm: sLen,
        widthMm: sWid,
        sawKerfMm: config.sawKerfMm,
        trimMarginMm: config.trimMarginMm,
      };
    },
    optimizationGoal: config.optimizationGoal,
  });
}

/**
 * Calculates total project cost across all modules from consolidated BOM and global Nesting.
 */
export function calculateProjectCost(input: {
  bom: BillOfMaterials;
  nestingResult: MultiMaterialNestingResult;
  materials: Material[];
  edgeBands: EdgeBand[];
  hardware: Hardware[];
  costConfig?: CostConfig;
}): ModuleCostSummary {
  return calculateModuleCost(input);
}
