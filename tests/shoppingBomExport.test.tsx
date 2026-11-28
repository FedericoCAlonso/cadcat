import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import {
  buildModularModule,
  generateBillOfMaterials,
  runProjectNesting,
  calculateProjectCost,
  calculateCommercialQuote,
  buildShoppingMaterialList,
  exportShoppingListCsv,
  exportShoppingListPdf,
  calculateCountertop,
  calculatePieceCutSize,
  JointGraph,
  type ModularModuleDefinition,
} from '../src/resolver';
import { getSeedMaterials, getSeedEdgeBands, getSeedHardware } from '../src/catalog';
import { loadDefaultProjectConfigFile, loadModularPresetsConfigFile } from '../src/config';
import {
  DEFAULT_COUNTERTOP_MATERIALS,
  validateCountertopDefinition,
  type Material,
  type EdgeBand,
  type Hardware,
} from '../src/model';
import { PieceListView } from '../src/ui/PieceListView';

const defaultConfig = loadDefaultProjectConfigFile();
const presets = loadModularPresetsConfigFile();

const seedMaterials = getSeedMaterials().materials;
const seedEdgeBands = getSeedEdgeBands().edgeBands;
const seedHardware = getSeedHardware().hardware;

const pricedMaterials: Material[] = seedMaterials.map((m) => ({
  ...m,
  pricePerSheet: m.thicknessMm === 3 ? 22000 : 85000,
}));
const pricedEdgeBands: EdgeBand[] = seedEdgeBands.map((e) => ({
  ...e,
  pricePerMeter: typeof e.thicknessMm === 'number' && e.thicknessMm >= 2 ? 1200 : 650,
}));
const pricedHardware: Hardware[] = seedHardware.map((h) => ({
  ...h,
  pricePerUnit: h.id === 'hw-slide-telescopic' ? 6000 : h.id === 'hw-hinge-cup-35' ? 2800 : 120,
}));

function buildPresetFixture(presetId: string, mats = pricedMaterials, ebs = pricedEdgeBands, hws = pricedHardware) {
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
      frontsMaterialId: 'mat-egger-white-18',
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
    edgeBands: ebs,
    hardwareConfig: defaultConfig.hardware,
  });
  const resolvedPieces = built.resolvedPieces.map((p) => {
    const cut = calculatePieceCutSize(p, ebs);
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
    ebs,
  );
  const modToConsolidate = [
    {
      moduleId: def.id,
      moduleName: preset.name,
      quantity: 1,
      pieces: resolvedPieces,
      bom,
    },
  ];
  const nesting = runProjectNesting(modToConsolidate, {
    materials: mats,
    sawKerfMm: defaultConfig.nesting.sawKerfMm,
    trimMarginMm: defaultConfig.nesting.sheetTrimMarginMm,
    respectGrain: defaultConfig.nesting.respectGrain,
  });
  const cost = calculateProjectCost({
    bom,
    nestingResult: nesting,
    materials: mats,
    edgeBands: ebs,
    hardware: hws,
    costConfig: defaultConfig.cost,
  });
  return { preset, built: { ...built, resolvedPieces }, bom, nesting, cost };
}

describe('Shopping Material List (BOM) Exporter — v0.36.0', () => {
  it('matches nesting sheets, BOM edge banding (+ waste %), hardware counts, and commercial quote costs 1:1', () => {
    const { preset, bom, nesting, cost } = buildPresetFixture('preset-drawer-unit-3');
    const graniteMat = { ...DEFAULT_COUNTERTOP_MATERIALS[0]!, pricePerM2: 180000 };
    const countertop = calculateCountertop(
      validateCountertopDefinition({
        id: 'ct-1',
        materialId: graniteMat.id,
        widthMm: 600,
        depthMm: 600,
        frontOverhangMm: 20,
      }),
      graniteMat,
      [],
    );

    const quote = calculateCommercialQuote({
      bom,
      cost,
      nestingResult: nesting,
      modules: [
        {
          id: 'm1',
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
      countertop,
      countertopQuantity: 2,
      quoteConfig: { edgeBandWastePercent: 12 },
    });

    const list = buildShoppingMaterialList({
      bom,
      nestingResult: nesting,
      materials: pricedMaterials,
      edgeBands: pricedEdgeBands,
      hardware: pricedHardware,
      edgeBandWastePercent: 12,
      countertop,
      countertopQuantity: 2,
      projectName: 'Cocina Integral',
      scopeLabel: 'Módulo Actual',
      moduleNames: [preset.name],
    });

    expect(list.totals.totalSheets).toBe(nesting.totalSheets);
    expect(list.totals.totalNetEdgeBandMeters).toBe(Math.round(bom.totalEdgeBandMeters * 100) / 100);
    expect(list.totals.totalBuyEdgeBandMeters).toBe(quote.internal.edgeBandBilledMeters);
    expect(list.totals.totalHardwareUnits).toBe(bom.totalHardwareCount);
    expect(list.totals.hasUnconfirmedPrices).toBe(false);

    const boardsSubtotal = list.boards.reduce((s, b) => s + (b.estimatedSubtotal ?? 0), 0);
    const ebSubtotal = list.edgeBands.reduce((s, e) => s + (e.estimatedSubtotal ?? 0), 0);
    const hwSubtotal = list.hardware.reduce((s, h) => s + (h.estimatedSubtotal ?? 0), 0);
    expect(Math.round(boardsSubtotal * 100) / 100).toBe(quote.internal.sheetsCost);
    expect(Math.round(ebSubtotal * 100) / 100).toBe(quote.internal.edgeBandMaterialCost);
    expect(Math.round(hwSubtotal * 100) / 100).toBe(quote.internal.hardwareCost);
    expect(list.countertop?.estimatedSubtotal).toBe(quote.internal.countertopCost);
    expect(list.totals.estimatedMaterialsSubtotal).toBe(
      Math.round((boardsSubtotal + ebSubtotal + hwSubtotal + (list.countertop?.estimatedSubtotal ?? 0)) * 100) / 100,
    );

    // Slides row reports pairs cleanly
    const slideRow = list.hardware.find((h) => h.hardwareId === 'hw-slide-telescopic');
    expect(slideRow).toBeDefined();
    expect(slideRow!.count).toBe(6);
    expect(slideRow!.specification).toContain('3 par(es)');
  });

  it('exports 100% Spanish CSV and PDF with "A confirmar" instead of TO_CONFIRM when catalog prices are pending', () => {
    const { preset, bom, nesting } = buildPresetFixture('preset-base-shelf', seedMaterials, seedEdgeBands, seedHardware);
    const list = buildShoppingMaterialList({
      bom,
      nestingResult: nesting,
      materials: seedMaterials,
      edgeBands: seedEdgeBands,
      hardware: seedHardware,
      projectName: 'Bajo Mesada Prueba',
      scopeLabel: 'Módulo Actual',
      moduleNames: [preset.name],
    });

    expect(list.totals.hasUnconfirmedPrices).toBe(true);

    const csv = exportShoppingListCsv(list);
    expect(csv).toContain(
      'Categoría,Ítem / Material,Especificación,Cantidad a Comprar,Unidad,Cantidad Neta,Precio Unitario ($),Subtotal Est. ($)',
    );
    expect(csv).toContain('Placa,');
    expect(csv).toContain('Tapacanto,');
    expect(csv).toContain('Herraje,');
    expect(csv).toContain('A confirmar');
    expect(csv).not.toContain('TO_CONFIRM');

    const doc = exportShoppingListPdf(list, new Date('2026-11-27T12:00:00Z'));
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    const pages = (doc as unknown as { internal: { pages: string[][] } }).internal.pages;
    const rawPdfText = (pages[1] ?? []).join('\n');
    expect(rawPdfText).toContain('LISTA DE MATERIALES Y COMPRAS');
    expect(rawPdfText).toContain('A confirmar');
    expect(rawPdfText).not.toContain('TO_CONFIRM');
  });

  it('renders Shopping Materials PDF & CSV buttons in PieceListView and triggers callbacks', () => {
    const { built } = buildPresetFixture('preset-base-shelf');
    const onCsv = vi.fn();
    const onPdf = vi.fn();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <PieceListView
          pieces={built.resolvedPieces}
          materials={pricedMaterials}
          edgeBands={pricedEdgeBands}
          onExportShoppingListCsv={onCsv}
          onExportShoppingListPdf={onPdf}
        />,
      );
    });

    const buttons = Array.from(container.querySelectorAll('button'));
    const pdfBtn = buttons.find((b) => b.textContent?.includes('Materiales PDF'));
    const csvBtn = buttons.find((b) => b.textContent?.includes('Materiales CSV'));
    expect(pdfBtn).toBeDefined();
    expect(csvBtn).toBeDefined();

    act(() => {
      pdfBtn!.click();
      csvBtn!.click();
    });

    expect(onPdf).toHaveBeenCalledTimes(1);
    expect(onCsv).toHaveBeenCalledTimes(1);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
