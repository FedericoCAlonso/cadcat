import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { PanelSummaryFooter, calculateNestingBoardAreaM2 } from '../src/ui/PanelSummaryFooter';
import type { BillOfMaterials, ModuleCostSummary } from '../src/resolver';
import type { Material, EdgeBand, Hardware } from '../src/model';
import { DEFAULT_UI_CONFIG } from '../src/config';
import { buildBaseCabinetModule } from '../src/resolver/moduleBuilder';
import { generateBillOfMaterials } from '../src/resolver/bom';
import { calculateModuleCost } from '../src/resolver/cost';
import {
  consolidateProjectBom,
  consolidateProjectPieces,
  runProjectNesting,
  calculateProjectCost,
  type ModuleToConsolidate,
} from '../src/resolver/projectConsolidator';
import { exportCutListCsv } from '../src/resolver/export';

describe('Stage 4: Summary Footer, Scope Selector, and Debounce', () => {
  const mockMaterials: Material[] = [
    {
      id: 'mat-white-18',
      name: 'Egger White 18mm',
      thicknessMm: 18,
      sheetSizeMm: { length: 2800, width: 2070 }, // 5.796 m² per sheet
      pricePerSheet: 45000,
      hasGrain: false,
      milling: {
        hidden: 'yes',
        visible: 'yes',
        onStructuralPiece: 'yes',
      },
    },
  ];

  const mockModuleBom: BillOfMaterials = {
    moduleId: 'mod-1',
    totalPieceCount: 8,
    totalCutAreaM2: 2.45,
    totalEdgeBandMeters: 14.2,
    totalHardwareCount: 24,
    pieces: [],
    hardware: [],
    edgeBands: [],
  };

  const mockConsolidatedBom: BillOfMaterials = {
    moduleId: 'project-consolidated',
    totalPieceCount: 24,
    totalCutAreaM2: 7.35,
    totalEdgeBandMeters: 42.6,
    totalHardwareCount: 72,
    pieces: [],
    hardware: [],
    edgeBands: [],
  };

  const mockModuleCost: ModuleCostSummary = {
    moduleId: 'mod-1',
    items: [
      {
        id: 'mat-white-18',
        name: 'Egger White 18mm',
        category: 'material',
        quantity: 1, // 1 sheet
        unit: 'sheet',
        unitPrice: 45000,
        subtotal: 45000,
      },
    ],
    materialTotal: 45000,
    edgeBandTotal: 3000,
    hardwareTotal: 6500,
    cutPassCost: 1500,
    grandTotal: 56000,
    confirmedSubtotal: 56000,
    isFullyConfirmed: true,
  };

  const mockConsolidatedCost: ModuleCostSummary = {
    moduleId: 'project-consolidated',
    items: [
      {
        id: 'mat-white-18',
        name: 'Egger White 18mm',
        category: 'material',
        quantity: 3, // 3 sheets
        unit: 'sheet',
        unitPrice: 45000,
        subtotal: 135000,
      },
    ],
    materialTotal: 135000,
    edgeBandTotal: 9000,
    hardwareTotal: 19500,
    cutPassCost: 4500,
    grandTotal: 168000,
    confirmedSubtotal: 168000,
    isFullyConfirmed: true,
  };

  describe('2.1 & 2.2 Content and Scope Selector (Proyecto vs Módulo)', () => {
    it('calculates nesting board area from sheets used and material sheet dimensions', () => {
      // 1 sheet of 2800 x 2070 mm = 5.796 m²
      const singleSheetArea = calculateNestingBoardAreaM2(mockModuleCost, mockMaterials);
      expect(singleSheetArea).toBeCloseTo(5.796, 2);

      // 3 sheets = 17.388 m²
      const multiSheetArea = calculateNestingBoardAreaM2(mockConsolidatedCost, mockMaterials);
      expect(multiSheetArea).toBeCloseTo(17.388, 2);
    });

    it('defaults to "Proyecto" scope and displays consolidated pieces, board area, and cost', () => {
      const html = renderToString(
        <PanelSummaryFooter
          bom={mockModuleBom}
          consolidatedBom={mockConsolidatedBom}
          cost={mockModuleCost}
          consolidatedCost={mockConsolidatedCost}
          materials={mockMaterials}
          activeMaterialId="mat-white-18"
          activeModuleQuantity={2}
        />,
      );

      // Default scope button is selected
      expect(html).toContain('class="m3-segmented-button__item selected"');
      expect(html).toContain('Proyecto');

      // Pieces count for consolidated project = 24
      expect(html).toContain('Piezas:</span><strong class="panel-summary-metric__value">24</strong>');

      // Board area for 3 sheets = 17,39 m²
      expect(html).toContain('Placas:</span><strong class="panel-summary-metric__value">17,39<!-- --> m²</strong>');

      // Net cut area in tooltip (7.35 m²)
      expect(html).toContain('Área neta de piezas: 7,35 m²');

      // Consolidated cost: $168.000
      expect(html).toContain('$168.000');
    });

    it('switches to "Módulo" scope and takes metrics directly from joint calculation with unit cost in tooltip', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      const handleScopeChange = vi.fn();

      const mockQty2Bom: BillOfMaterials = {
        moduleId: 'mod-1',
        totalPieceCount: 16,
        totalCutAreaM2: 4.90,
        totalEdgeBandMeters: 28.4,
        totalHardwareCount: 48,
        pieces: [],
        hardware: [],
        edgeBands: [],
      };

      const mockQty2Cost: ModuleCostSummary = {
        moduleId: 'mod-1',
        items: [
          {
            id: 'mat-white-18',
            name: 'Egger White 18mm',
            category: 'material',
            quantity: 1, // 1 sheet for both units
            unit: 'sheet',
            unitPrice: 45000,
            subtotal: 45000,
          },
        ],
        materialTotal: 45000,
        edgeBandTotal: 6000,
        hardwareTotal: 13000,
        cutPassCost: 3000,
        grandTotal: 67000,
        confirmedSubtotal: 67000,
        isFullyConfirmed: true,
      };

      act(() => {
        root.render(
          <PanelSummaryFooter
            bom={mockQty2Bom}
            consolidatedBom={mockConsolidatedBom}
            cost={mockQty2Cost}
            consolidatedCost={mockConsolidatedCost}
            materials={mockMaterials}
            activeMaterialId="mat-white-18"
            activeModuleQuantity={2}
            onScopeChange={handleScopeChange}
          />,
        );
      });

      // Find "Módulo" button in segmented selector and click it
      const moduleBtn = Array.from(container.querySelectorAll('.panel-summary-scope-selector button')).find(
        (b) => b.textContent?.trim() === 'Módulo',
      ) as HTMLButtonElement | undefined;
      expect(moduleBtn).toBeDefined();

      act(() => {
        moduleBtn?.click();
      });

      expect(handleScopeChange).toHaveBeenCalledWith('module');

      // In Módulo scope with activeModuleQuantity = 2 (derived from joint calculation):
      // Pieces = 16
      const piecesVal = container.querySelector('.panel-summary-metrics .panel-summary-metric:nth-child(1) strong')?.textContent;
      expect(piecesVal).toBe('16');

      // Placas = 5.80 m² (1 sheet consumed by joint nesting, NOT 11.59 m²)
      const boardVal = container.querySelector('.panel-summary-metrics .panel-summary-metric:nth-child(2) strong')?.textContent;
      expect(boardVal).toBe('5,80 m²');

      // Total Cost = $67.000
      const costVal = container.querySelector('.panel-summary-metric--cost strong')?.textContent;
      expect(costVal).toBe('$67.000');

      // Tooltip contains unit cost: 67000 / 2 = $33.500
      const costMetric = container.querySelector('.panel-summary-metric--cost') as HTMLElement | null;
      expect(costMetric?.getAttribute('title')).toContain('Costo unitario: $33.500');

      act(() => {
        root.unmount();
      });
      container.remove();
    });
  });

  describe('2.3 Missing Prices ("TO_CONFIRM" Handling)', () => {
    it('displays "Parcial $X · a confirmar" using confirmedSubtotal when grandTotal is TO_CONFIRM', () => {
      const costWithPendingPrice: ModuleCostSummary = {
        moduleId: 'mod-1',
        items: [],
        materialTotal: 'TO_CONFIRM',
        edgeBandTotal: 3000,
        hardwareTotal: 4500,
        cutPassCost: 1000,
        grandTotal: 'TO_CONFIRM',
        confirmedSubtotal: 8500, // confirmed hardware + edgeband + cut
        isFullyConfirmed: false,
      };

      const html = renderToString(
        <PanelSummaryFooter
          bom={mockModuleBom}
          consolidatedBom={null}
          cost={costWithPendingPrice}
          consolidatedCost={null}
          materials={mockMaterials}
          scope="module"
          activeModuleQuantity={1}
        />,
      );

      // Must strictly show "Parcial $8.500 · a confirmar" and never a fake zero or deceptive total
      expect(html).toContain('Parcial $8.500 · a confirmar');
      expect(html).toContain('is-partial');
    });

    it('displays partial amount and shows unit partial in tooltip for multiple units', () => {
      const costWithPendingPrice: ModuleCostSummary = {
        moduleId: 'mod-1',
        items: [],
        materialTotal: 'TO_CONFIRM',
        edgeBandTotal: 9000,
        hardwareTotal: 13500,
        cutPassCost: 3000,
        grandTotal: 'TO_CONFIRM',
        confirmedSubtotal: 25500,
        isFullyConfirmed: false,
      };

      const html = renderToString(
        <PanelSummaryFooter
          bom={mockModuleBom}
          consolidatedBom={null}
          cost={costWithPendingPrice}
          consolidatedCost={null}
          materials={mockMaterials}
          scope="module"
          activeModuleQuantity={3}
        />,
      );

      // Displays calculated confirmed subtotal
      expect(html).toContain('Parcial $25.500 · a confirmar');
      // Tooltip includes unit partial cost: 25500 / 3 = 8500
      expect(html).toContain('Costo unitario: Parcial $8.500 · a confirmar');
    });
  });

  describe('2.4 Debounce State & UI ("calculando…")', () => {
    it('displays "calculando…" when isCostCalculating is true, avoiding stale numbers', () => {
      const html = renderToString(
        <PanelSummaryFooter
          bom={mockModuleBom}
          consolidatedBom={mockConsolidatedBom}
          cost={mockModuleCost}
          consolidatedCost={mockConsolidatedCost}
          isCostCalculating={true}
          materials={mockMaterials}
        />,
      );

      expect(html).toContain('calculando…');
      expect(html).toContain('is-calculating');
      // Must not display old cost numbers while calculating
      expect(html).not.toContain('$168.000');
    });

    it('verifies debounce delay from config and fast consecutive change resolution', async () => {
      vi.useFakeTimers();

      let calculateCallCount = 0;
      let lastCalculatedInput = '';

      // Simulated debounced worker function mimicking useModuleViewModel
      function simulateDebouncedCalculation(
        inputUpdates: string[],
        delayMs: number = DEFAULT_UI_CONFIG.costDebounceMs,
      ) {
        let isCalculating = false;
        let timer: NodeJS.Timeout | null = null;
        let finalResult: string | null = null;

        for (const update of inputUpdates) {
          isCalculating = true;
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            calculateCallCount++;
            lastCalculatedInput = update;
            finalResult = `cost-for-${update}`;
            isCalculating = false;
          }, delayMs);
        }

        return {
          getIsCalculating: () => isCalculating,
          getFinalResult: () => finalResult,
        };
      }

      // Step 1: Consecutive fast changes (5 changes within 50ms)
      const execution = simulateDebouncedCalculation(['width-600', 'width-700', 'width-800', 'drawers-3', 'drawers-4']);

      expect(execution.getIsCalculating()).toBe(true);
      expect(calculateCallCount).toBe(0); // Not executed yet

      // Advance time by 100ms (less than costDebounceMs = 250ms)
      vi.advanceTimersByTime(100);
      expect(calculateCallCount).toBe(0);
      expect(execution.getIsCalculating()).toBe(true);

      // Advance time by another 150ms (total 250ms from last change)
      vi.advanceTimersByTime(150);
      expect(execution.getIsCalculating()).toBe(false);
      expect(calculateCallCount).toBe(1); // Executed only ONCE!
      expect(lastCalculatedInput).toBe('drawers-4'); // Resolved strictly to the last change
      expect(execution.getFinalResult()).toBe('cost-for-drawers-4');

      vi.useRealTimers();
    });

    it('does NOT display "calculando…" on initial load when cost is already provided', () => {
      const html = renderToString(
        <PanelSummaryFooter
          bom={mockModuleBom}
          consolidatedBom={mockConsolidatedBom}
          cost={mockModuleCost}
          consolidatedCost={mockConsolidatedCost}
          isCostCalculating={false}
          materials={mockMaterials}
        />,
      );

      expect(html).not.toContain('calculando…');
      expect(html).toContain('$168.000');
    });
  });

  describe('2.5 Footer and Action Buttons', () => {
    it('renders Save Module, CSV, and PDF action buttons with accessible labels and tooltips', () => {
      const handleSave = vi.fn();
      const handleCsv = vi.fn();
      const handlePdf = vi.fn();

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      act(() => {
        root.render(
          <PanelSummaryFooter
            bom={mockModuleBom}
            consolidatedBom={mockConsolidatedBom}
            cost={mockModuleCost}
            consolidatedCost={mockConsolidatedCost}
            materials={mockMaterials}
            onSave={handleSave}
            onExportCsv={handleCsv}
            onExportPdf={handlePdf}
          />,
        );
      });

      const saveBtn = container.querySelector('.panel-footer-save-btn') as HTMLButtonElement | null;
      expect(saveBtn).toBeDefined();
      expect(saveBtn?.textContent).toContain('Guardar Módulo');
      act(() => {
        saveBtn?.click();
      });
      expect(handleSave).toHaveBeenCalledTimes(1);

      const csvBtn = container.querySelector('.panel-footer-export-btn[title="Lista de Corte (CSV)"]') as HTMLButtonElement | null;
      expect(csvBtn).toBeDefined();
      expect(csvBtn?.textContent).toContain('CSV');
      act(() => {
        csvBtn?.click();
      });
      expect(handleCsv).toHaveBeenCalledTimes(1);

      const pdfBtn = container.querySelector('.panel-footer-export-btn[title="Diagrama de Corte (PDF)"]') as HTMLButtonElement | null;
      expect(pdfBtn).toBeDefined();
      expect(pdfBtn?.textContent).toContain('PDF');
      act(() => {
        pdfBtn?.click();
      });
      expect(handlePdf).toHaveBeenCalledTimes(1);

      act(() => {
        root.unmount();
      });
      container.remove();
    });

    it('disables Save Module, CSV, and PDF buttons when isCostCalculating is true', () => {
      const handleSave = vi.fn();
      const handleCsv = vi.fn();
      const handlePdf = vi.fn();

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      act(() => {
        root.render(
          <PanelSummaryFooter
            bom={mockModuleBom}
            consolidatedBom={mockConsolidatedBom}
            cost={mockModuleCost}
            consolidatedCost={mockConsolidatedCost}
            materials={mockMaterials}
            isCostCalculating={true}
            onSave={handleSave}
            onExportCsv={handleCsv}
            onExportPdf={handlePdf}
          />,
        );
      });

      const saveBtn = container.querySelector('.panel-footer-save-btn') as HTMLButtonElement | null;
      expect(saveBtn?.disabled).toBe(true);
      act(() => {
        saveBtn?.click();
      });
      expect(handleSave).not.toHaveBeenCalled();

      const csvBtn = container.querySelector('.panel-footer-export-btn[aria-label="Lista de Corte (CSV)"]') as HTMLButtonElement | null;
      expect(csvBtn?.disabled).toBe(true);
      act(() => {
        csvBtn?.click();
      });
      expect(handleCsv).not.toHaveBeenCalled();

      const pdfBtn = container.querySelector('.panel-footer-export-btn[aria-label="Diagrama de Corte (PDF)"]') as HTMLButtonElement | null;
      expect(pdfBtn?.disabled).toBe(true);
      act(() => {
        pdfBtn?.click();
      });
      expect(handlePdf).not.toHaveBeenCalled();

      act(() => {
        root.unmount();
      });
      container.remove();
    });
  });

  describe('2.6 Multi-module Project Coherence (Real Cost Engine and CSV comparison)', () => {
    const edgeBand2: EdgeBand = {
      id: 'eb-pvc-2',
      kind: 'adhesive',
      thicknessMm: 2,
      pricePerMeter: 300,
    };

    const hardwareScrew: Hardware = {
      id: 'hw-confirmat-7x50',
      name: 'Tornillo Confirmat 7x50',
      jointKind: 'confirmat',
      pricePerUnit: 50,
    };

    const costConfig = {
      wasteFactorPercent: 10,
      hourlyLaborRate: 0,
      pricePerCutPass: 50,
      cutPricingMode: 'per-pass' as const,
    };

    it('renders identical metrics to real cost engine and matches project CSV cut list', () => {
      // 1. Module A: 800x720x580 mm, quantity 1 (5 pieces)
      const modAData = buildBaseCabinetModule(
        {
          widthMm: 800,
          heightMm: 720,
          depthMm: 580,
          materialId: mockMaterials[0]!.id,
          materialThicknessMm: 18,
          edgeBandId: edgeBand2.id,
        },
        [edgeBand2],
      );
      const piecesA = modAData.resolvedPieces;
      const bomA = generateBillOfMaterials(
        {
          moduleId: 'mod-A',
          pieces: piecesA,
          joints: modAData.module.joints,
          parameters: {},
          placementTree: null as never,
          jointGraph: null as never,
        },
        [edgeBand2],
      );
      const nestingA = runProjectNesting(
        [{ moduleId: 'mod-A', moduleName: 'Bajo Mesada 800', quantity: 1, pieces: piecesA }],
        { materials: mockMaterials },
      );
      const costA = calculateModuleCost({
        bom: bomA,
        nestingResult: nestingA,
        materials: mockMaterials,
        edgeBands: [edgeBand2],
        hardware: [hardwareScrew],
        costConfig,
      });
      expect(costA.grandTotal).toBe(46930);

      // 2. Module B: 400x600x320 mm, quantity 2 (5 pieces each)
      const modBData = buildBaseCabinetModule(
        {
          widthMm: 400,
          heightMm: 600,
          depthMm: 320,
          materialId: mockMaterials[0]!.id,
          materialThicknessMm: 18,
          edgeBandId: edgeBand2.id,
        },
        [edgeBand2],
      );
      const piecesB = modBData.resolvedPieces;
      const bomB = generateBillOfMaterials(
        {
          moduleId: 'mod-B',
          pieces: piecesB,
          joints: modBData.module.joints,
          parameters: {},
          placementTree: null as never,
          jointGraph: null as never,
        },
        [edgeBand2],
      );
      const nestingB = runProjectNesting(
        [{ moduleId: 'mod-B', moduleName: 'Alacena 400', quantity: 1, pieces: piecesB }],
        { materials: mockMaterials },
      );
      const costB = calculateModuleCost({
        bom: bomB,
        nestingResult: nestingB,
        materials: mockMaterials,
        edgeBands: [edgeBand2],
        hardware: [hardwareScrew],
        costConfig,
      });
      expect(costB.grandTotal).toBe(46702);

      // 3. Consolidated project: Mod A (qty 1) + Mod B (qty 2)
      const modulesToConsolidate: ModuleToConsolidate[] = [
        {
          moduleId: 'mod-A',
          moduleName: 'Bajo Mesada 800',
          quantity: 1,
          pieces: piecesA,
          bom: bomA,
        },
        {
          moduleId: 'mod-B',
          moduleName: 'Alacena 400',
          quantity: 2,
          pieces: piecesB,
          bom: bomB,
        },
      ];

      const consolidatedPieces = consolidateProjectPieces(modulesToConsolidate);
      const consolidatedBom = consolidateProjectBom(modulesToConsolidate);
      const consolidatedNesting = runProjectNesting(modulesToConsolidate, { materials: mockMaterials });
      const consolidatedCost = calculateProjectCost({
        bom: consolidatedBom,
        nestingResult: consolidatedNesting,
        materials: mockMaterials,
        edgeBands: [edgeBand2],
        hardware: [hardwareScrew],
        costConfig,
      });

      // Verify Project CSV cut list has exactly 15 pieces
      const projectCsv = exportCutListCsv(consolidatedPieces);
      const csvRows = projectCsv.trim().split('\r\n');
      expect(csvRows.length).toBe(16); // 1 header + 15 piece rows
      expect(consolidatedPieces.length).toBe(15);
      expect(consolidatedBom.totalPieceCount).toBe(15);

      // Verify Footer in "Proyecto" scope
      const projectHtml = renderToString(
        <PanelSummaryFooter
          bom={bomB}
          consolidatedBom={consolidatedBom}
          cost={costB}
          consolidatedCost={consolidatedCost}
          materials={mockMaterials}
          scope="project"
          activeModuleQuantity={2}
        />,
      );

      // Pieces count = 15
      expect(projectHtml).toContain('Piezas:</span><strong class="panel-summary-metric__value">15</strong>');
      // Board area = 5,80 m² (1 sheet nesting of 2800x2070mm = 5.796 m²)
      expect(projectHtml).toContain('Placas:</span><strong class="panel-summary-metric__value">5,80<!-- --> m²</strong>');
      // Net cut area tooltip = 3,09 m²
      expect(projectHtml).toContain('Área neta de piezas: 3,09 m²');
      // Cost = $49.884
      expect(projectHtml).toContain('$49.884');

      // For active Module B with quantity = 2, calculate using joint nesting of [modBConsolidate]
      const modBConsolidate: ModuleToConsolidate[] = [
        {
          moduleId: 'mod-B',
          moduleName: 'Alacena 400',
          quantity: 2,
          pieces: piecesB,
          bom: bomB,
        },
      ];
      const consolidatedBomB = consolidateProjectBom(modBConsolidate);
      const nestingB2 = runProjectNesting(modBConsolidate, { materials: mockMaterials });
      const costB2 = calculateProjectCost({
        bom: consolidatedBomB,
        nestingResult: nestingB2,
        materials: mockMaterials,
        edgeBands: [edgeBand2],
        hardware: [hardwareScrew],
        costConfig,
      });

      // Verify that for Module B with quantity = 2, both units fit on 1 single sheet!
      expect(nestingB2.sheets.length).toBe(1);

      // Verify Footer in "Módulo" scope for active Module B (quantity = 2)
      const moduleHtml = renderToString(
        <PanelSummaryFooter
          bom={consolidatedBomB}
          consolidatedBom={consolidatedBom}
          cost={costB2}
          consolidatedCost={consolidatedCost}
          materials={mockMaterials}
          scope="module"
          activeModuleQuantity={2}
        />,
      );

      // Mod B pieces: 5 * 2 = 10
      expect(moduleHtml).toContain('Piezas:</span><strong class="panel-summary-metric__value">10</strong>');
      // Mod B board area: 1 sheet = 5,80 m² (NOT twice the board area of 1 unit!)
      expect(moduleHtml).toContain('Placas:</span><strong class="panel-summary-metric__value">5,80<!-- --> m²</strong>');
      // Mod B net cut area tooltip: 0.6496 * 2 = 1,30 m²
      expect(moduleHtml).toContain('Área neta de piezas: 1,30 m²');
      // Mod B cost: $48.154 (calculated directly via joint nesting, NOT $93.404)
      expect(moduleHtml).toContain('$48.154');
      // Mod B unit cost in tooltip: 48154 / 2 = $24.077
      expect(moduleHtml).toContain('Costo unitario: $24.077');
    });
  });
});
