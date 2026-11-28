import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import {
  buildModularModule,
  generateBillOfMaterials,
  runProjectNesting,
  calculateProjectCost,
  calculateCommercialQuote,
  exportCommercialQuotePdf,
  buildPlacacentroCutRows,
  exportPlacacentroCsv,
  calculatePieceCutSize,
  deriveModuleDrillOperations,
  deriveModuleGrooveOperations,
  buildModuleMachiningSheets,
  exportPieceToDxf,
  exportMachiningSheetToDxf,
  JointGraph,
  type ModularModuleDefinition,
} from '../src/resolver';
import { getSeedMaterials, getSeedEdgeBands, getSeedHardware } from '../src/catalog';
import { loadDefaultProjectConfigFile, loadModularPresetsConfigFile } from '../src/config';
import { DEFAULT_COMMERCIAL_QUOTE_CONFIG, type Material, type EdgeBand, type Hardware } from '../src/model';
import { CommercialQuoteView } from '../src/ui/CommercialQuoteView';

const defaultConfig = loadDefaultProjectConfigFile();
const presets = loadModularPresetsConfigFile();

const pricedMaterials: Material[] = getSeedMaterials().materials.map((m) => ({
  ...m,
  pricePerSheet: m.thicknessMm === 3 ? 22000 : 85000,
}));
const pricedEdgeBands: EdgeBand[] = getSeedEdgeBands().edgeBands.map((e) => ({
  ...e,
  pricePerMeter: typeof e.thicknessMm === 'number' && e.thicknessMm >= 2 ? 1200 : 650,
}));
const pricedHardware: Hardware[] = getSeedHardware().hardware.map((h) => ({
  ...h,
  pricePerUnit: h.id === 'hw-slide-telescopic' ? 6000 : h.id === 'hw-hinge-cup-35' ? 2800 : 120,
}));

function buildSamplePreset(presetId: string) {
  const preset = presets.find((p) => p.id === presetId)!;
  const def: ModularModuleDefinition = {
    id: `module-${preset.id}`,
    carcass: {
      width: preset.defaultDimensions.width,
      height: preset.defaultDimensions.height,
      depth: preset.defaultDimensions.depth,
      ...preset.carcass,
      backingType: 'groove',
      backingThicknessMm: 3,
    },
    grid: preset.grid,
    bays: preset.bays,
    materials: {
      carcassMaterialId: 'mat-egger-white-18',
      frontsMaterialId: presetId === 'preset-door-cabinet-2' ? 'mat-egger-oak-18' : 'mat-egger-white-18',
      drawerBoxesMaterialId: 'mat-egger-white-18',
      backingsMaterialId: 'mat-mdf-raw-3',
    },
    edgeBandId: 'eb-white-08',
  };

  const built = buildModularModule(def, {
    carcassThicknessMm: 18,
    frontThicknessMm: 18,
    boxThicknessMm: 18,
    backingThicknessMm: 3,
    edgeBands: pricedEdgeBands,
    hardwareConfig: defaultConfig.hardware,
  });

  const resolvedPieces = built.resolvedPieces.map((p) => {
    const cut = calculatePieceCutSize(p, pricedEdgeBands);
    return {
      ...p,
      dimensionsMm: cut.finishedDimensionsMm,
      cutDimensionsMm: cut.cutDimensionsMm,
      bandedEdges: [
        cut.bandedEdges.top,
        cut.bandedEdges.bottom,
        cut.bandedEdges.left,
        cut.bandedEdges.right,
      ].filter((b): b is NonNullable<typeof b> => Boolean(b)),
    };
  });

  const bom = generateBillOfMaterials(
    {
      moduleId: built.module.id,
      parameters: built.module.parameters,
      pieces: built.resolvedPieces,
      joints: built.module.joints,
      placementTree: built.placementTree,
      jointGraph: new JointGraph(built.module.joints),
    },
    pricedEdgeBands,
  );

  const nesting = runProjectNesting(
    [
      {
        moduleId: built.module.id,
        moduleName: preset.name,
        quantity: 1,
        pieces: resolvedPieces,
        bom,
      },
    ],
    {
      materials: pricedMaterials,
      sawKerfMm: defaultConfig.nesting.sawKerfMm,
      trimMarginMm: defaultConfig.nesting.sheetTrimMarginMm,
      grainDirectionMode: 'auto',
    },
  );

  const cost = calculateProjectCost({
    bom,
    nestingResult: nesting,
    materials: pricedMaterials,
    edgeBands: pricedEdgeBands,
    hardware: pricedHardware,
    costConfig: { ...defaultConfig.cost, pricePerCutPass: 450 },
  });

  return { preset, built, resolvedPieces, bom, nesting, cost };
}

describe('Ola 3 — Commercial Quote Engine, Placacentro Exporter & DXF CAM Layers', () => {
  describe('Commercial Quote Engine (Dual Workshop Mode, Labor, Margin, VAT, Multi-Currency)', () => {
    it('calculates outsourced mode with edgeband waste, banding service, labor, consumables, overhead, margin, discount, IVA & USD', () => {
      const { preset, resolvedPieces, bom, nesting, cost } = buildSamplePreset('preset-drawer-unit-3');
      const quote = calculateCommercialQuote({
        bom,
        cost,
        nestingResult: nesting,
        modules: [
          {
            id: 'mod-1',
            name: preset.name,
            quantity: 1,
            widthMm: preset.defaultDimensions.width,
            heightMm: preset.defaultDimensions.height,
            depthMm: preset.defaultDimensions.depth,
            drawerCount: resolvedPieces.filter((p) => p.role === 'drawer-front').length,
            doorCount: 0,
            shelfCount: 0,
          },
        ],
        materials: pricedMaterials,
        edgeBands: pricedEdgeBands,
        hardware: pricedHardware,
        quoteConfig: {
          workshopMode: 'outsourced',
          edgeBandWastePercent: 15,
          edgeBandingServicePerMeter: 800,
          hourlyLaborRate: 12000,
          consumablesPercent: 5,
          deliveryCost: 15000,
          installationCost: 25000,
          overheadPercent: 10,
          profitMarginPercent: 40,
          discountPercent: 5,
          vatPercent: 21,
          currency: 'ARS',
          exchangeRateArsPerUsd: 1200,
        },
      });

      expect(quote.hasUnconfirmedPrices).toBe(false);
      // 1 module (4h) + 3 drawers (3 * 1.2h = 3.6h) = 7.6 hours
      expect(quote.internal.laborHours).toBe(7.6);
      expect(quote.internal.laborCost).toBe(7.6 * 12000);
      expect(quote.internal.edgeBandServiceCost).toBeGreaterThan(0);
      expect(quote.internal.offcutCredit).toBe(0);
      expect(quote.internal.overheadCost).toBeCloseTo(quote.internal.directWorkshopCost * 0.1, 1);
      expect(quote.client.discountAmount).toBeGreaterThan(0);
      expect(quote.client.vatAmount).toBeCloseTo(quote.client.netSubtotal * 0.21, 1);
      expect(quote.client.finalTotal).toBeCloseTo(quote.client.netSubtotal + quote.client.vatAmount, 1);
      expect(quote.client.equivalentCurrency).toBe('USD');
      expect(quote.client.equivalentFinalTotal).toBeCloseTo(quote.client.finalTotal / 1200, 1);
      expect(quote.profitability.estimatedGrossProfitArs).toBeGreaterThan(0);
    });

    it('applies usable offcut credit and zero external banding service in in-house mode', () => {
      const { preset, bom, nesting, cost } = buildSamplePreset('preset-empty');
      const quote = calculateCommercialQuote({
        bom,
        cost,
        nestingResult: nesting,
        modules: [
          {
            id: 'mod-1',
            name: preset.name,
            quantity: 1,
            widthMm: 600,
            heightMm: 800,
            depthMm: 560,
            drawerCount: 0,
            doorCount: 0,
            shelfCount: 0,
          },
        ],
        materials: pricedMaterials,
        edgeBands: pricedEdgeBands,
        hardware: pricedHardware,
        quoteConfig: {
          workshopMode: 'in-house',
          usableOffcutCreditPercent: 25,
          edgeBandingServicePerMeter: 999,
          currency: 'USD',
          exchangeRateArsPerUsd: 1000,
        },
      });

      expect(quote.internal.edgeBandServiceCost).toBe(0);
      expect(quote.internal.offcutCredit).toBeGreaterThan(0);
      expect(quote.internal.netMaterialCost).toBeLessThan(quote.internal.sheetsCost);
      expect(quote.client.currency).toBe('USD');
      expect(quote.client.equivalentCurrency).toBe('ARS');
    });

    it('generates client Commercial Quote PDF without leaking internal cost, overhead or margin', () => {
      const { preset, bom, nesting, cost } = buildSamplePreset('preset-base-shelf');
      const quote = calculateCommercialQuote({
        bom,
        cost,
        nestingResult: nesting,
        modules: [
          {
            id: 'mod-1',
            name: preset.name,
            quantity: 2,
            widthMm: 600,
            heightMm: 720,
            depthMm: 560,
            drawerCount: 0,
            doorCount: 0,
            shelfCount: 1,
          },
        ],
        materials: pricedMaterials,
        edgeBands: pricedEdgeBands,
        hardware: pricedHardware,
        quoteConfig: {
          ...DEFAULT_COMMERCIAL_QUOTE_CONFIG,
          hourlyLaborRate: 10000,
          profitMarginPercent: 45,
          overheadPercent: 12,
        },
      });

      const doc = exportCommercialQuotePdf(quote, {
        projectName: 'Cocina Integral Palermo',
        clientName: 'María Gómez',
      });
      const pages = (doc as unknown as { internal: { pages: string[][] } }).internal.pages;
      const pdfText = pages.flat().join('\n');

      expect(pdfText).toContain('PRESUPUESTO COMERCIAL');
      expect(pdfText).toContain('Cocina Integral Palermo');
      expect(pdfText).toContain('TOTAL FINAL');
      // Client PDF MUST NOT leak internal cost / margin / overhead
      expect(pdfText).not.toContain('Costo Interno');
      expect(pdfText).not.toContain('Overhead');
      expect(pdfText).not.toContain('Margen');
    });
  });

  describe('Placacentro CSV Exporter (CorteCloud / Lepton / Optimik)', () => {
    it('aligns Largo with grain axis on grained doors, maps L1/L2/A1/A2 edgebands, and groups identical pieces', () => {
      const { resolvedPieces } = buildSamplePreset('preset-door-cabinet-2');
      const rows = buildPlacacentroCutRows(resolvedPieces, pricedMaterials, pricedEdgeBands, {
        defaultModuleName: 'Alacena 800',
      });

      const doorRow = rows.find((r) => r.materialId === 'mat-egger-oak-18')!;
      expect(doorRow).toBeDefined();
      expect(doorRow.respectGrain).toBe(true);
      // Grained vertical door: height (~715.4) is Largo, width (~396.4) is Ancho
      expect(doorRow.lengthMm).toBeGreaterThan(doorRow.widthMm);
      // All 4 edges banded with 0.8 mm
      expect(doorRow.l1).toBe('0.8');
      expect(doorRow.l2).toBe('0.8');
      expect(doorRow.a1).toBe('0.8');
      expect(doorRow.a2).toBe('0.8');

      // Carcass sides are identical and grouped with quantity = 2
      const csv = exportPlacacentroCsv(resolvedPieces, pricedMaterials, pricedEdgeBands, {
        defaultModuleName: 'Alacena 800',
      });
      expect(csv).toContain('Largo (mm),Ancho (mm),Cantidad,Material,Espesor (mm),Veta,L1,L2,A1,A2,Pieza,Módulo');
      expect(csv).toContain('Alacena 800');
      expect(csv).toContain('Sí');
    });
  });

  describe('DXF CAM Depth-Encoded Layers & Edge Boring', () => {
    it('encodes Z depths in drill/groove CAM layers and exports edge drills onto 5_EDGE_DRILL_* layers', () => {
      const { built, resolvedPieces } = buildSamplePreset('preset-empty');
      const drills = deriveModuleDrillOperations(
        resolvedPieces,
        built.module.joints,
        defaultConfig.machining,
      );
      const grooves = deriveModuleGrooveOperations(resolvedPieces, built.module.joints, {
        backingThicknessMm: 3,
      });
      const sheets = buildModuleMachiningSheets(resolvedPieces, drills, grooves);
      const bottomSheet = sheets.find((s) => s.role === 'bottom')!;

      const dxf = exportMachiningSheetToDxf(bottomSheet, {
        face: 'face-A',
        useCutDimensions: true,
        includeGrooveCenterline: true,
        encodeDepthInLayer: true,
        includeEdgeDrills: true,
      });

      expect(dxf).toContain('2_GROOVE_W');
      expect(dxf).toContain('5_EDGE_DRILL_LEFT_D5_Z35');
      expect(dxf).toContain('5_EDGE_DRILL_RIGHT_D5_Z35');
    });

    it('encodes _THRU when depth >= thickness, preserves canonical ACI drill color on _Z layers, and matches asymmetric edgeband offsets', () => {
      const { resolvedPieces } = buildSamplePreset('preset-empty');
      const basePiece = resolvedPieces.find((p) => p.role === 'bottom')!;
      const asymPiece = {
        ...basePiece,
        dimensionsMm: { width: 600, height: 500 },
        cutDimensionsMm: { width: 597.2, height: 500 }, // 2.0mm left + 0.8mm right
        thicknessMm: 18,
        bandedEdges: [
          { faceId: 'left-edge', edgeBandId: 'eb-pvc-2mm', thicknessMm: 2.0, applied: true, lengthMm: 500 },
          { faceId: 'right-edge', edgeBandId: 'eb-pvc-045mm', thicknessMm: 0.8, applied: true, lengthMm: 500 },
        ],
      };
      const drillOps = [
        {
          schemaVersion: 1 as const,
          origin: 'derived' as const,
          id: 'd-35-blind',
          pieceId: asymPiece.id,
          faceId: 'face-A',
          faceType: 'face-A' as const,
          positionMm: { x: 100, y: 100 },
          diameterMm: 35,
          depthMm: 12,
          isThrough: false,
        },
        {
          schemaVersion: 1 as const,
          origin: 'derived' as const,
          id: 'd-5-full-depth',
          pieceId: asymPiece.id,
          faceId: 'face-A',
          faceType: 'face-A' as const,
          positionMm: { x: 200, y: 100 },
          diameterMm: 5,
          depthMm: 18,
          isThrough: false,
        },
      ];

      const sheet = buildModuleMachiningSheets([asymPiece], drillOps, [])[0]!;
      const dxfPiece = exportPieceToDxf(asymPiece, {
        face: 'face-A',
        useCutDimensions: true,
        derivedOperations: drillOps,
        encodeDepthInLayer: true,
      });
      const dxfSheet = exportMachiningSheetToDxf(sheet, {
        face: 'face-A',
        useCutDimensions: true,
        encodeDepthInLayer: true,
      });

      // Full-depth drill (18mm on 18mm board) must emit _THRU even if isThrough flag was false
      expect(dxfPiece).toContain('1_DRILL_5MM_THRU');
      expect(dxfSheet).toContain('1_DRILL_5MM_THRU');
      // Canonical 35mm drill layer keeps ACI color 6 (Magenta), not red fallback 1
      expect(dxfSheet).toMatch(/1_DRILL_35MM_Z12\r?\n\s*70\r?\n\s*64\r?\n\s*62\r?\n\s*6\r?\n/);
      // Asymmetric 2.0mm left / 0.8mm right shiftX must be 2.0mm -> X = 98.0 in BOTH exporters
      expect(dxfPiece).toMatch(/10\r?\n98\.0\r?\n/);
      expect(dxfSheet).toMatch(/10\r?\n98\.0\r?\n/);
    });
  });

  describe('Wave 3 Audit Regression Guarantees', () => {
    it('zeros cutPassCost in in-house mode, guarantees exact USD additive totals, and preserves distinct edgeBandIds in Placacentro CSV', () => {
      const { preset, bom, nesting, cost } = buildSamplePreset('preset-drawer-unit-3');
      const inHouse = calculateCommercialQuote({
        bom,
        cost,
        nestingResult: nesting,
        modules: [
          {
            id: 'mod-1',
            name: preset.name,
            quantity: 1,
            widthMm: 600,
            heightMm: 720,
            depthMm: 560,
            drawerCount: 3,
            doorCount: 0,
            shelfCount: 0,
          },
        ],
        materials: pricedMaterials,
        edgeBands: pricedEdgeBands,
        hardware: pricedHardware,
        quoteConfig: {
          workshopMode: 'in-house',
          usableOffcutCreditPercent: 30,
          currency: 'USD',
          exchangeRateArsPerUsd: 1200,
          discountPercent: 5,
          vatPercent: 21,
        },
      });

      expect(inHouse.internal.cutPassCost).toBe(0);
      expect(inHouse.internal.edgeBandServiceCost).toBe(0);
      expect(
        Math.round((inHouse.client.netBeforeDiscount - inHouse.client.discountAmount) * 100) / 100,
      ).toBe(inHouse.client.netSubtotal);
      expect(
        Math.round((inHouse.client.netSubtotal + inHouse.client.vatAmount) * 100) / 100,
      ).toBe(inHouse.client.finalTotal);

      // Placacentro CSV: two 2mm edgebands with different IDs/colors must NOT merge into 1 row
      const { resolvedPieces } = buildSamplePreset('preset-empty');
      const sample = resolvedPieces[0]!;
      const pA = {
        ...sample,
        id: 'p-band-a',
        bandedEdges: [{ faceId: 'top-edge', edgeBandId: 'eb-pvc-2mm-white', thicknessMm: 2, applied: true, lengthMm: 500 }],
      };
      const pB = {
        ...sample,
        id: 'p-band-b',
        bandedEdges: [{ faceId: 'top-edge', edgeBandId: 'eb-pvc-2mm-oak', thicknessMm: 2, applied: true, lengthMm: 500 }],
      };
      const rows = buildPlacacentroCutRows([pA, pB], pricedMaterials, pricedEdgeBands);
      expect(rows.length).toBe(2);
      expect(rows.reduce((s, r) => s + r.quantity, 0)).toBe(2);
    });
  });

  describe('CommercialQuoteView M3 Component', () => {
    it('renders commercial quote controls, switches workshop mode, and triggers PDF export', () => {
      const { preset, bom, nesting, cost } = buildSamplePreset('preset-empty');
      const quote = calculateCommercialQuote({
        bom,
        cost,
        nestingResult: nesting,
        modules: [
          {
            id: 'mod-1',
            name: preset.name,
            quantity: 1,
            widthMm: 600,
            heightMm: 800,
            depthMm: 560,
            drawerCount: 0,
            doorCount: 0,
            shelfCount: 0,
          },
        ],
        materials: pricedMaterials,
        edgeBands: pricedEdgeBands,
        hardware: pricedHardware,
      });

      const onUpdate = vi.fn();
      const onExportPdf = vi.fn();
      const onExportPlacacentro = vi.fn();

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      act(() => {
        root.render(
          <CommercialQuoteView
            quote={quote}
            quoteConfig={DEFAULT_COMMERCIAL_QUOTE_CONFIG}
            projectScope="current-module"
            projectName="Cocina Test"
            clientName="Juan Pérez"
            onUpdateQuoteConfig={onUpdate}
            onExportCommercialQuotePdf={onExportPdf}
            onExportPlacacentroCsv={onExportPlacacentro}
          />,
        );
      });

      expect(container.textContent).toContain('Presupuesto Comercial');
      expect(container.textContent).toContain('Precio Comercial para Cliente');
      expect(container.textContent).toContain('Costo Interno Total');

      const inHouseBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Taller Propio'),
      )!;
      act(() => {
        inHouseBtn.click();
      });
      expect(onUpdate).toHaveBeenCalledWith({ workshopMode: 'in-house' });

      const pdfBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Presupuesto Cliente (PDF)'),
      )!;
      act(() => {
        pdfBtn.click();
      });
      expect(onExportPdf).toHaveBeenCalledTimes(1);

      act(() => {
        root.unmount();
      });
      container.remove();
    });
  });
});
