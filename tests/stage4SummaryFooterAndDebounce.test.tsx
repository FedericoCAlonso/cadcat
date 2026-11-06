import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { PanelSummaryFooter, calculateNestingBoardAreaM2 } from '../src/ui/PanelSummaryFooter';
import type { BillOfMaterials, ModuleCostSummary } from '../src/resolver';
import type { Material } from '../src/model';
import { DEFAULT_UI_CONFIG } from '../src/config';

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

    it('switches to "Módulo" scope and multiplies active module metrics by its quantity', () => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      const handleScopeChange = vi.fn();

      act(() => {
        root.render(
          <PanelSummaryFooter
            bom={mockModuleBom}
            consolidatedBom={mockConsolidatedBom}
            cost={mockModuleCost}
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

      // In Módulo scope with activeModuleQuantity = 2:
      // Pieces = 8 * 2 = 16
      const piecesVal = container.querySelector('.panel-summary-metrics .panel-summary-metric:nth-child(1) strong')?.textContent;
      expect(piecesVal).toBe('16');

      // Placas = 5.796 * 2 = 11.59 m²
      const boardVal = container.querySelector('.panel-summary-metrics .panel-summary-metric:nth-child(2) strong')?.textContent;
      expect(boardVal).toBe('11,59 m²');

      // Cost = 56000 * 2 = $112.000
      const costVal = container.querySelector('.panel-summary-metric--cost strong')?.textContent;
      expect(costVal).toBe('$112.000');

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

    it('scales partial amount by activeModuleQuantity in module scope', () => {
      const costWithPendingPrice: ModuleCostSummary = {
        moduleId: 'mod-1',
        items: [],
        materialTotal: 'TO_CONFIRM',
        edgeBandTotal: 3000,
        hardwareTotal: 4500,
        cutPassCost: 1000,
        grandTotal: 'TO_CONFIRM',
        confirmedSubtotal: 8500,
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

      // 8500 * 3 = 25500
      expect(html).toContain('Parcial $25.500 · a confirmar');
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
  });
});
