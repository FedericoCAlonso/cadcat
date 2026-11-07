import { useState, useMemo, type ReactElement } from 'react';
import type { BillOfMaterials, ModuleCostSummary } from '../resolver';
import type { Material } from '../model';
import { DEFAULT_UI_CONFIG } from '../config';

/**
 * Scope option for the summary footer calculation.
 */
export type SummaryScope = 'project' | 'module';

/**
 * Props for the PanelSummaryFooter component.
 */
export interface PanelSummaryFooterProps {
  /** Bill of Materials for the currently active module. */
  bom: BillOfMaterials | null;
  /** Consolidated Bill of Materials across all modules in the project. */
  consolidatedBom: BillOfMaterials | null;
  /** Cost breakdown for the active module. */
  cost: ModuleCostSummary | null;
  /** Consolidated cost breakdown for the entire project. */
  consolidatedCost: ModuleCostSummary | null;
  /** Whether the cost calculation is currently debouncing or calculating. */
  isCostCalculating?: boolean;
  /** Materials list from project catalog used to look up sheet dimensions. */
  materials: Material[];
  /** Active material identifier. */
  activeMaterialId?: string;
  /** Quantity of the active module in the project. Defaults to 1. */
  activeModuleQuantity?: number;
  /** Controlled summary scope ('project' | 'module'). */
  scope?: SummaryScope;
  /** Callback fired when the user changes the summary scope selector. */
  onScopeChange?: (scope: SummaryScope) => void;
  /** Whether a module save operation is currently in progress. */
  isSaving?: boolean;
  /** Callback fired when the user clicks 'Guardar Módulo'. */
  onSave?: () => void;
  /** Callback fired when the user clicks 'CSV'. */
  onExportCsv?: () => void;
  /** Callback fired when the user clicks 'PDF'. */
  onExportPdf?: () => void;
}

/**
 * Computes the total board area (in m²) consumed by nesting from cost summary items.
 *
 * @param costSummary Module or project cost summary containing sheet usage items.
 * @param materials Catalog of materials with sheet dimensions.
 * @param activeMaterialId Fallback material ID.
 * @returns Total sheet area in square meters consumed by nesting.
 */
export function calculateNestingBoardAreaM2(
  costSummary: ModuleCostSummary | null,
  materials: Material[],
  activeMaterialId?: string,
): number {
  if (!costSummary) return 0;
  let totalArea = 0;
  for (const item of costSummary.items) {
    if (item.category === 'material' && item.quantity > 0) {
      const mat =
        materials.find((m) => m.id === item.id) ??
        materials.find((m) => m.id === activeMaterialId) ??
        materials[0];
      const lengthMm = typeof mat?.sheetSizeMm?.length === 'number' ? mat.sheetSizeMm.length : 2800;
      const widthMm = typeof mat?.sheetSizeMm?.width === 'number' ? mat.sheetSizeMm.width : 2070;
      const sheetAreaM2 = (lengthMm * widthMm) / 1_000_000;
      totalArea += item.quantity * sheetAreaM2;
    }
  }
  return totalArea;
}

/**
 * Format helper for currency and dimension values using 'es-AR' locale.
 */
const numberFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const areaFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Compact fixed panel summary footer (Stage 4).
 * Stays anchored to the bottom of the left parameters panel, respecting bottom navigation
 * and displaying piece count, nesting board area, and debounced cost breakdown.
 */
export function PanelSummaryFooter({
  bom,
  consolidatedBom,
  cost,
  consolidatedCost,
  isCostCalculating = false,
  materials,
  activeMaterialId,
  activeModuleQuantity = 1,
  scope: controlledScope,
  onScopeChange,
  isSaving = false,
  onSave,
  onExportCsv,
  onExportPdf,
}: PanelSummaryFooterProps): ReactElement {
  const [internalScope, setInternalScope] = useState<SummaryScope>(
    DEFAULT_UI_CONFIG.summaryScopeDefault as SummaryScope,
  );

  const activeScope = controlledScope ?? internalScope;

  const handleScopeChange = (newScope: SummaryScope) => {
    setInternalScope(newScope);
    onScopeChange?.(newScope);
  };

  const isProjectScope = activeScope === 'project';
  const targetBom = isProjectScope ? consolidatedBom : bom;
  const targetCost = isProjectScope ? consolidatedCost : cost;

  // 1. Piece count (directly from calculated target BOM without multiplying unit result)
  const totalPieces = targetBom?.totalPieceCount ?? 0;

  // 2. Board area consumed by nesting & net piece cut area (directly from calculated target cost/BOM)
  const boardAreaM2 = useMemo(() => {
    return calculateNestingBoardAreaM2(targetCost, materials, activeMaterialId);
  }, [targetCost, materials, activeMaterialId]);

  const netPieceAreaM2 = targetBom?.totalCutAreaM2 ?? 0;

  // 3. Estimated Cost
  const currencySymbol = DEFAULT_UI_CONFIG.currencySymbol;

  let costDisplay: string;
  let isCostPartial = false;

  if (isCostCalculating) {
    costDisplay = 'calculando…';
  } else if (!targetCost) {
    costDisplay = '—';
  } else if (targetCost.grandTotal === 'TO_CONFIRM') {
    isCostPartial = true;
    costDisplay = `Parcial ${currencySymbol}${numberFormatter.format(targetCost.confirmedSubtotal)} · a confirmar`;
  } else {
    costDisplay = `${currencySymbol}${numberFormatter.format(targetCost.grandTotal)}`;
  }

  // Cost tooltip: includes cost per unit (total cost divided by quantity) in module scope
  let costTooltip = isCostPartial
    ? 'Costo parcial a confirmar con precios pendientes'
    : 'Costo estimado total';

  if (!isProjectScope && targetCost) {
    const qty = Math.max(1, activeModuleQuantity);
    if (targetCost.grandTotal === 'TO_CONFIRM') {
      const unitPartial = targetCost.confirmedSubtotal / qty;
      costTooltip = qty > 1
        ? `Costo unitario: Parcial ${currencySymbol}${numberFormatter.format(unitPartial)} · a confirmar (Total: ${costDisplay} para ${qty} unidades)`
        : 'Costo parcial a confirmar con precios pendientes';
    } else {
      const unitCost = targetCost.grandTotal / qty;
      costTooltip = qty > 1
        ? `Costo unitario: ${currencySymbol}${numberFormatter.format(unitCost)} (Total: ${costDisplay} para ${qty} unidades)`
        : `Costo unitario: ${currencySymbol}${numberFormatter.format(unitCost)}`;
    }
  }

  const boardAreaTooltip = `Área de placa consumida (nesting): ${areaFormatter.format(boardAreaM2)} m² · Área neta de piezas: ${areaFormatter.format(netPieceAreaM2)} m²`;

  return (
    <footer
      className="panel-summary-footer"
      role="region"
      aria-label="Resumen de producción y costos"
    >
      {/* Fila 1: Selector de Alcance y Métricas */}
      <div className="panel-summary-row panel-summary-row--metrics">
        {/* Selector de Alcance (Módulo / Proyecto) */}
        <div
          className="m3-segmented-button panel-summary-scope-selector"
          role="radiogroup"
          aria-label="Alcance del resumen"
        >
          <button
            type="button"
            role="radio"
            aria-checked={activeScope === 'project'}
            className={`m3-segmented-button__item ${activeScope === 'project' ? 'selected' : ''}`}
            onClick={() => handleScopeChange('project')}
            title="Ver métricas consolidadas de todo el proyecto"
          >
            Proyecto
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={activeScope === 'module'}
            className={`m3-segmented-button__item ${activeScope === 'module' ? 'selected' : ''}`}
            onClick={() => handleScopeChange('module')}
            title="Ver métricas del módulo activo (multiplicado por su cantidad)"
          >
            Módulo
          </button>
        </div>

        {/* Métricas Principales */}
        <div className="panel-summary-metrics">
          {/* Cantidad de piezas */}
          <div className="panel-summary-metric" title="Cantidad total de piezas">
            <span className="panel-summary-metric__label">Piezas:</span>
            <strong className="panel-summary-metric__value">{totalPieces}</strong>
          </div>

          {/* Área de placa con tooltip de área neta */}
          <div
            className="panel-summary-metric"
            title={boardAreaTooltip}
            tabIndex={0}
            role="note"
            aria-label={boardAreaTooltip}
          >
            <span className="panel-summary-metric__label">Placas:</span>
            <strong className="panel-summary-metric__value">{areaFormatter.format(boardAreaM2)} m²</strong>
          </div>

          {/* Costo estimado */}
          <div
            className={`panel-summary-metric panel-summary-metric--cost ${isCostCalculating ? 'is-calculating' : ''} ${isCostPartial ? 'is-partial' : ''}`}
            title={costTooltip}
          >
            <span className="panel-summary-metric__label">Costo:</span>
            <strong className="panel-summary-metric__value">{costDisplay}</strong>
          </div>
        </div>
      </div>

      {/* Fila 2: Botones de Acción */}
      <div className="panel-summary-row panel-summary-row--actions">
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || isCostCalculating}
            className="m3-btn m3-btn--filled panel-footer-save-btn"
            title={
              isCostCalculating
                ? 'Calculando costos y despiece...'
                : isSaving
                  ? 'Guardando...'
                  : 'Guardar Módulo en la base de datos local'
            }
          >
            <span>
              {isCostCalculating
                ? 'Calculando...'
                : isSaving
                  ? 'Guardando...'
                  : '💾 Guardar Módulo'}
            </span>
            <span className="visually-hidden">Save Module to Database</span>
          </button>
        )}

        <div className="panel-footer-export-group">
          {onExportCsv && (
            <button
              type="button"
              onClick={onExportCsv}
              disabled={isCostCalculating}
              className="m3-btn m3-btn--small m3-btn--tonal panel-footer-export-btn"
              title={
                isCostCalculating
                  ? 'Calculando lista de corte...'
                  : 'Lista de Corte (CSV)'
              }
              aria-label="Lista de Corte (CSV)"
            >
              <span>📄 CSV</span>
            </button>
          )}

          {onExportPdf && (
            <button
              type="button"
              onClick={onExportPdf}
              disabled={isCostCalculating}
              className="m3-btn m3-btn--small m3-btn--outlined panel-footer-export-btn"
              title={
                isCostCalculating
                  ? 'Calculando diagrama de corte...'
                  : 'Diagrama de Corte (PDF)'
              }
              aria-label="Diagrama de Corte (PDF)"
            >
              <span>📑 PDF</span>
            </button>
          )}
        </div>
      </div>
    </footer>
  );
}
