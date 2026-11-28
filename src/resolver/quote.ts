import {
  type CommercialQuoteConfig,
  DEFAULT_COMMERCIAL_QUOTE_CONFIG,
  type Material,
  type Hardware,
  type EdgeBand,
} from '../model';
import type { BillOfMaterials } from './bom';
import type { ModuleCostSummary } from './cost';
import type { NestingResult } from '../workers';
import type { CountertopCalculationResult } from './countertop/types';

export interface QuoteModuleDescriptor {
  id: string;
  name: string;
  quantity: number;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  drawerCount: number;
  doorCount: number;
  shelfCount: number;
}

export interface CommercialQuoteInput {
  bom: BillOfMaterials;
  cost: ModuleCostSummary;
  nestingResult?: NestingResult | null;
  modules: QuoteModuleDescriptor[];
  materials?: Material[];
  edgeBands?: EdgeBand[];
  hardware?: Hardware[];
  countertop?: CountertopCalculationResult | null;
  /** Number of countertop units (defaults to 1). */
  countertopQuantity?: number;
  quoteConfig?: Partial<CommercialQuoteConfig>;
  /** Fallback hourly rate from legacy ProjectConfig.cost.hourlyLaborRate when quoteConfig.hourlyLaborRate is 0. */
  fallbackHourlyLaborRate?: number;
}

export interface CommercialQuoteInternalBreakdown {
  sheetsCost: number;
  offcutCredit: number;
  netMaterialCost: number;
  edgeBandMaterialCost: number;
  edgeBandBilledMeters: number;
  edgeBandServiceCost: number;
  hardwareCost: number;
  cutPassCost: number;
  countertopCost: number;
  laborHours: number;
  laborCost: number;
  consumablesCost: number;
  deliveryCost: number;
  installationCost: number;
  directWorkshopCost: number;
  overheadCost: number;
  totalInternalCost: number;
}

export interface CommercialQuoteClientTotals {
  currency: 'ARS' | 'USD';
  exchangeRateArsPerUsd: number;
  netBeforeDiscount: number;
  discountPercent: number;
  discountAmount: number;
  netSubtotal: number;
  vatPercent: number;
  vatAmount: number;
  finalTotal: number;
  /** Equivalent in the opposite currency (USD when primary is ARS, ARS when primary is USD). */
  equivalentCurrency: 'ARS' | 'USD';
  equivalentFinalTotal: number;
}

export interface CommercialQuoteProfitability {
  estimatedGrossProfitArs: number;
  realMarginPercent: number;
  markupPercent: number;
}

export interface CommercialQuoteResult {
  config: CommercialQuoteConfig;
  scopeModuleCount: number;
  totalModuleUnits: number;
  modules: QuoteModuleDescriptor[];
  materialsSummary: string[];
  hardwareSummary: string[];
  countertopSummary: string | null;
  internal: CommercialQuoteInternalBreakdown;
  client: CommercialQuoteClientTotals;
  profitability: CommercialQuoteProfitability;
  hasUnconfirmedPrices: boolean;
  unconfirmedItemNames: string[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toDisplayCurrency(
  amountArs: number,
  currency: 'ARS' | 'USD',
  exchangeRateArsPerUsd: number,
): number {
  if (currency === 'USD') {
    return round2(amountArs / Math.max(1, exchangeRateArsPerUsd));
  }
  return round2(amountArs);
}

/**
 * Pure end-to-end commercial budgeting & dual workshop costing engine (SOLID SRP, Zero Hardcoding).
 * Separates internal workshop costs (materials, offcut credit, edgebanding service + waste,
 * hardware, cutting passes, countertop, labor hours, consumables, logistics, overhead) from
 * client commercial pricing (markup, discount, VAT/IVA, multi-currency ARS/USD).
 */
export function calculateCommercialQuote(input: CommercialQuoteInput): CommercialQuoteResult {
  const cfg: CommercialQuoteConfig = {
    ...DEFAULT_COMMERCIAL_QUOTE_CONFIG,
    ...(input.quoteConfig ?? {}),
  };

  const { bom, cost, nestingResult, modules, countertop } = input;
  const effectiveHourlyRate =
    cfg.hourlyLaborRate > 0 ? cfg.hourlyLaborRate : Math.max(0, input.fallbackHourlyLaborRate ?? 0);

  // Confirmed base costs from ModuleCostSummary (in ARS)
  const sheetsCost = typeof cost.materialTotal === 'number'
    ? cost.materialTotal
    : cost.items
        .filter((i) => i.category === 'material' && typeof i.subtotal === 'number')
        .reduce((sum, i) => sum + (i.subtotal as number), 0);

  const baseEdgeBandMaterialCost = typeof cost.edgeBandTotal === 'number'
    ? cost.edgeBandTotal
    : cost.items
        .filter((i) => i.category === 'edge-band' && typeof i.subtotal === 'number')
        .reduce((sum, i) => sum + (i.subtotal as number), 0);

  const hardwareCost = typeof cost.hardwareTotal === 'number'
    ? cost.hardwareTotal
    : cost.items
        .filter((i) => i.category === 'hardware' && typeof i.subtotal === 'number')
        .reduce((sum, i) => sum + (i.subtotal as number), 0);

  // Cut-pass service fees apply only in outsourced (placacentro) mode; in-house cutting is covered by workshop labor.
  const cutPassCost = cfg.workshopMode === 'outsourced' ? (cost.cutPassCost ?? 0) : 0;

  // 1. Dual workshop mode: per-sheet offcut credit (in-house) vs full sheets + edgebanding service (outsourced)
  const matPriceMap = new Map(
    (input.materials ?? []).map((m) => [
      m.id,
      typeof m.pricePerSheet === 'number' && m.pricePerSheet > 0 ? m.pricePerSheet : 0,
    ]),
  );
  let offcutCredit = 0;
  if (cfg.workshopMode === 'in-house' && cfg.usableOffcutCreditPercent > 0 && nestingResult && sheetsCost > 0) {
    const creditFactor = cfg.usableOffcutCreditPercent / 100;
    let computedFromSheetPrices = 0;
    let hasSheetPrices = false;

    for (const s of nestingResult.sheets) {
      const sheetPrice = matPriceMap.get(s.materialId) ?? 0;
      const sheetAreaM2 = (s.sheetLengthMm * s.sheetWidthMm) / 1_000_000;
      if (sheetPrice > 0 && sheetAreaM2 > 0 && s.wasteAreaM2 > 0) {
        hasSheetPrices = true;
        const wasteRatio = Math.min(1, Math.max(0, s.wasteAreaM2 / sheetAreaM2));
        computedFromSheetPrices += sheetPrice * wasteRatio * creditFactor;
      }
    }

    if (hasSheetPrices) {
      offcutCredit = round2(Math.min(sheetsCost, computedFromSheetPrices));
    } else {
      const totalSheetAreaM2 = nestingResult.sheets.reduce(
        (sum, s) => sum + (s.sheetLengthMm * s.sheetWidthMm) / 1_000_000,
        0,
      );
      const totalWasteAreaM2 = nestingResult.sheets.reduce((sum, s) => sum + s.wasteAreaM2, 0);
      if (totalSheetAreaM2 > 0 && totalWasteAreaM2 > 0) {
        const wasteShare = Math.min(1, Math.max(0, totalWasteAreaM2 / totalSheetAreaM2));
        offcutCredit = round2(Math.min(sheetsCost, sheetsCost * wasteShare * creditFactor));
      }
    }
  }
  const netMaterialCost = round2(Math.max(0, sheetsCost - offcutCredit));

  // 2. Edgeband material with waste % + external application service (outsourced)
  const edgeWasteFactor = 1 + cfg.edgeBandWastePercent / 100;
  const rawEdgeBandBilledMeters = bom.totalEdgeBandMeters * edgeWasteFactor;
  const edgeBandBilledMeters = round2(rawEdgeBandBilledMeters);
  const edgeBandMaterialCost = round2(baseEdgeBandMaterialCost * edgeWasteFactor);
  const edgeBandServiceCost =
    cfg.workshopMode === 'outsourced'
      ? round2(rawEdgeBandBilledMeters * cfg.edgeBandingServicePerMeter)
      : 0;

  // 3. Countertop integration (when countertop material has confirmed pricePerM2)
  let countertopCost = 0;
  let countertopSummary: string | null = null;
  if (countertop) {
    const ctQty = Math.max(1, Math.floor(input.countertopQuantity ?? 1));
    const pricePerM2 = countertop.material.pricePerM2;
    if (typeof pricePerM2 === 'number' && pricePerM2 > 0) {
      countertopCost = round2(countertop.areaM2 * pricePerM2 * ctQty);
    }
    const qtyTag = ctQty > 1 ? ` × ${ctQty} un.` : '';
    countertopSummary = `${countertop.material.name} (${countertop.widthMm}×${countertop.depthMm}×${countertop.thicknessMm} mm · ${(countertop.areaM2 * ctQty).toFixed(2)} m²${qtyTag})`;
  }

  // 4. Parametric labor hours & cost
  let totalModuleUnits = 0;
  let totalDrawers = 0;
  let totalDoors = 0;
  let totalShelves = 0;
  for (const mod of modules) {
    const qty = Math.max(1, Math.floor(mod.quantity || 1));
    totalModuleUnits += qty;
    totalDrawers += (mod.drawerCount || 0) * qty;
    totalDoors += (mod.doorCount || 0) * qty;
    totalShelves += (mod.shelfCount || 0) * qty;
  }

  const laborHours = round2(
    totalModuleUnits * cfg.laborHoursPerModule +
      totalDrawers * cfg.laborHoursPerDrawer +
      totalDoors * cfg.laborHoursPerDoor +
      totalShelves * cfg.laborHoursPerShelf,
  );
  const laborCost = round2(laborHours * effectiveHourlyRate);

  // 5. Minor consumables (% of direct wood + edgeband + hardware)
  const consumablesBase = netMaterialCost + edgeBandMaterialCost + hardwareCost;
  const consumablesCost = round2(consumablesBase * (cfg.consumablesPercent / 100));

  // 6. Logistics & installation
  const deliveryCost = round2(cfg.deliveryCost);
  const installationCost = round2(cfg.installationCost);

  // 7. Direct workshop cost + overhead = Total internal cost (ARS)
  const directWorkshopCost = round2(
    netMaterialCost +
      edgeBandMaterialCost +
      edgeBandServiceCost +
      hardwareCost +
      cutPassCost +
      countertopCost +
      laborCost +
      consumablesCost +
      deliveryCost +
      installationCost,
  );
  const overheadCost = round2(directWorkshopCost * (cfg.overheadPercent / 100));
  const totalInternalCost = round2(directWorkshopCost + overheadCost);

  // 8. Commercial client pricing (ARS base -> display currency + equivalent)
  const netBeforeDiscountArs = round2(totalInternalCost * (1 + cfg.profitMarginPercent / 100));
  const discountAmountArs = round2(netBeforeDiscountArs * (cfg.discountPercent / 100));
  const netSubtotalArs = round2(Math.max(0, netBeforeDiscountArs - discountAmountArs));
  const vatAmountArs = round2(netSubtotalArs * (cfg.vatPercent / 100));
  const finalTotalArs = round2(netSubtotalArs + vatAmountArs);

  const estimatedGrossProfitArs = round2(netSubtotalArs - totalInternalCost);
  const realMarginPercent =
    netSubtotalArs > 0 ? round2((estimatedGrossProfitArs / netSubtotalArs) * 100) : 0;

  const displayCurrency = cfg.currency;
  const equivalentCurrency: 'ARS' | 'USD' = displayCurrency === 'ARS' ? 'USD' : 'ARS';

  // Compute display currency lines with strict additive consistency:
  // netBeforeDiscount - discountAmount === netSubtotal and netSubtotal + vatAmount === finalTotal
  const fx = Math.max(1, cfg.exchangeRateArsPerUsd);
  const displayNetBeforeDiscount = toDisplayCurrency(netBeforeDiscountArs, displayCurrency, fx);
  const displayDiscountAmount =
    displayCurrency === 'USD'
      ? round2(displayNetBeforeDiscount * (cfg.discountPercent / 100))
      : discountAmountArs;
  const displayNetSubtotal = round2(Math.max(0, displayNetBeforeDiscount - displayDiscountAmount));
  const displayVatAmount =
    displayCurrency === 'USD'
      ? round2(displayNetSubtotal * (cfg.vatPercent / 100))
      : vatAmountArs;
  const displayFinalTotal = round2(displayNetSubtotal + displayVatAmount);
  const equivalentFinalTotal =
    equivalentCurrency === 'USD'
      ? round2(finalTotalArs / fx)
      : round2(displayFinalTotal * fx);

  // Human-readable specifications for client proposal
  const matMap = new Map((input.materials ?? []).map((m) => [m.id, m.name]));
  const materialIds = Array.from(new Set(bom.pieces.map((p) => p.materialId)));
  const materialsSummary = materialIds.map((id) => matMap.get(id) ?? id);

  const hwMap = new Map((input.hardware ?? []).map((h) => [h.id, h.name]));
  const hardwareSummary = bom.hardware.map((h) => `${h.count}× ${hwMap.get(h.hardwareId) ?? h.name}`);

  const unconfirmedItemNames = cost.items
    .filter((i) => i.subtotal === 'TO_CONFIRM')
    .map((i) => i.name);
  if (countertop && typeof countertop.material.pricePerM2 !== 'number') {
    unconfirmedItemNames.push(`Mesada: ${countertop.material.name}`);
  }

  return {
    config: { ...cfg, hourlyLaborRate: effectiveHourlyRate },
    scopeModuleCount: modules.length,
    totalModuleUnits,
    modules,
    materialsSummary,
    hardwareSummary,
    countertopSummary,
    internal: {
      sheetsCost: round2(sheetsCost),
      offcutCredit,
      netMaterialCost,
      edgeBandMaterialCost,
      edgeBandBilledMeters,
      edgeBandServiceCost,
      hardwareCost: round2(hardwareCost),
      cutPassCost: round2(cutPassCost),
      countertopCost,
      laborHours,
      laborCost,
      consumablesCost,
      deliveryCost,
      installationCost,
      directWorkshopCost,
      overheadCost,
      totalInternalCost,
    },
    client: {
      currency: displayCurrency,
      exchangeRateArsPerUsd: cfg.exchangeRateArsPerUsd,
      netBeforeDiscount: displayNetBeforeDiscount,
      discountPercent: cfg.discountPercent,
      discountAmount: displayDiscountAmount,
      netSubtotal: displayNetSubtotal,
      vatPercent: cfg.vatPercent,
      vatAmount: displayVatAmount,
      finalTotal: displayFinalTotal,
      equivalentCurrency,
      equivalentFinalTotal,
    },
    profitability: {
      estimatedGrossProfitArs,
      realMarginPercent,
      markupPercent: cfg.profitMarginPercent,
    },
    hasUnconfirmedPrices: unconfirmedItemNames.length > 0,
    unconfirmedItemNames,
  };
}
