import type { ReactElement } from 'react';
import type { CommercialQuoteConfig, WorkshopCostingMode, QuoteCurrency } from '../model';
import type { CommercialQuoteResult } from '../resolver';
import { NumericInput } from './NumericInput';

export interface CommercialQuoteViewProps {
  quote: CommercialQuoteResult | null;
  quoteConfig: CommercialQuoteConfig;
  projectScope: 'current-module' | 'all-modules';
  projectName?: string;
  clientName?: string;
  onUpdateQuoteConfig: (patch: Partial<CommercialQuoteConfig>) => void;
  onExportCommercialQuotePdf: () => void;
  onExportPlacacentroCsv?: () => void;
}

function formatMoney(amount: number, currency: 'ARS' | 'USD'): string {
  const prefix = currency === 'USD' ? 'USD ' : '$ ';
  return `${prefix}${amount.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Commercial budgeting & dual workshop costing view (Material Design 3).
 * Clearly separates internal workshop cost breakdown from client commercial pricing.
 */
export function CommercialQuoteView({
  quote,
  quoteConfig,
  projectScope,
  projectName,
  clientName,
  onUpdateQuoteConfig,
  onExportCommercialQuotePdf,
  onExportPlacacentroCsv,
}: CommercialQuoteViewProps): ReactElement {
  if (!quote) {
    return (
      <div className="m3-card" style={{ padding: '1rem' }}>
        <p style={{ margin: 0, color: 'var(--md-sys-color-on-surface-variant)' }}>
          No hay piezas suficientes para calcular el presupuesto comercial.
        </p>
      </div>
    );
  }

  const { internal, client, profitability } = quote;

  return (
    <div className="commercial-quote-view" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header Actions */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
            💰 Presupuesto Comercial ({projectScope === 'all-modules' ? 'Proyecto Completo' : 'Módulo Actual'})
          </h3>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
            {projectName ? `Proyecto: ${projectName}` : 'Proyecto CadCat'}
            {clientName ? ` · Cliente: ${clientName}` : ''} · {quote.totalModuleUnits} unidad(es)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {onExportPlacacentroCsv && (
            <button
              type="button"
              className="m3-btn m3-btn--outlined"
              style={{ minHeight: '48px', padding: '0 0.9rem' }}
              onClick={onExportPlacacentroCsv}
              title="Exportar planilla en formato CorteCloud / Lepton / Optimik (Largo × Ancho × Veta × L1/L2/A1/A2)"
            >
              🏭 CSV Placacentro
            </button>
          )}
          <button
            type="button"
            className="m3-btn m3-btn--filled"
            style={{ minHeight: '48px', padding: '0 1.1rem', fontWeight: 700 }}
            onClick={onExportCommercialQuotePdf}
          >
            📄 Presupuesto Cliente (PDF)
          </button>
        </div>
      </div>

      {/* Warning if any catalog prices are still TO_CONFIRM */}
      {quote.hasUnconfirmedPrices && (
        <div
          role="status"
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            backgroundColor: 'var(--md-sys-color-error-container)',
            color: 'var(--md-sys-color-on-error-container)',
            fontSize: '0.84rem',
            lineHeight: 1.4,
          }}
        >
          <strong>⚠️ Precios pendientes de confirmar (`TO_CONFIRM`):</strong>{' '}
          {quote.unconfirmedItemNames.slice(0, 5).join(', ')}
          {quote.unconfirmedItemNames.length > 5 ? ` (+${quote.unconfirmedItemNames.length - 5} más)` : ''}.
          Cargá sus valores en <em>Catálogos</em> para obtener un presupuesto exacto.
        </div>
      )}

      {/* Dual Workshop Costing Mode Selector */}
      <div
        className="m3-segmented-button"
        role="group"
        aria-label="Modalidad de costeo del taller"
        style={{ width: '100%' }}
      >
        {(
          [
            { id: 'outsourced', label: '🏭 Tercerizado (Placacentro / Maderera)' },
            { id: 'in-house', label: '🪚 Taller Propio (Maquinaria Propia)' },
          ] as Array<{ id: WorkshopCostingMode; label: string }>
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`m3-segmented-button__item ${quoteConfig.workshopMode === opt.id ? 'selected' : ''}`}
            style={{ minHeight: '48px', fontWeight: 600 }}
            onClick={() => onUpdateQuoteConfig({ workshopMode: opt.id })}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Main 2-column responsive layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
          gap: '1rem',
          alignItems: 'start',
        }}
      >
        {/* Left Column: Configurable Workshop & Commercial Parameters */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.85rem',
            padding: '1rem',
            borderRadius: '12px',
            backgroundColor: 'var(--md-sys-color-surface-container-low)',
            border: '1px solid var(--md-sys-color-outline-variant)',
          }}
        >
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--md-sys-color-primary)' }}>
            ⚙️ Parámetros de Costeo y Margen
          </h4>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(135px, 1fr))', gap: '0.65rem' }}>
            <div>
              <label htmlFor="quote-labor-rate" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                Hora taller ($/h)
              </label>
              <NumericInput
                id="quote-labor-rate"
                value={quoteConfig.hourlyLaborRate}
                min={0}
                max={500000}
                step={500}
                onChange={(v) => onUpdateQuoteConfig({ hourlyLaborRate: v })}
              />
            </div>

            <div>
              <label htmlFor="quote-edge-waste" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                Merma canto (%)
              </label>
              <NumericInput
                id="quote-edge-waste"
                value={quoteConfig.edgeBandWastePercent}
                min={0}
                max={100}
                step={1}
                onChange={(v) => onUpdateQuoteConfig({ edgeBandWastePercent: v })}
              />
            </div>

            {quoteConfig.workshopMode === 'outsourced' ? (
              <div>
                <label htmlFor="quote-edge-service" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                  Pegado canto ($/m)
                </label>
                <NumericInput
                  id="quote-edge-service"
                  value={quoteConfig.edgeBandingServicePerMeter}
                  min={0}
                  max={100000}
                  step={100}
                  onChange={(v) => onUpdateQuoteConfig({ edgeBandingServicePerMeter: v })}
                />
              </div>
            ) : (
              <div>
                <label htmlFor="quote-offcut-credit" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                  Crédito retazos (%)
                </label>
                <NumericInput
                  id="quote-offcut-credit"
                  value={quoteConfig.usableOffcutCreditPercent}
                  min={0}
                  max={50}
                  step={5}
                  onChange={(v) => onUpdateQuoteConfig({ usableOffcutCreditPercent: v })}
                />
              </div>
            )}

            <div>
              <label htmlFor="quote-consumables" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                Insumos menores (%)
              </label>
              <NumericInput
                id="quote-consumables"
                value={quoteConfig.consumablesPercent}
                min={0}
                max={50}
                step={1}
                onChange={(v) => onUpdateQuoteConfig({ consumablesPercent: v })}
              />
            </div>

            <div>
              <label htmlFor="quote-delivery" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                Flete / Entrega ($)
              </label>
              <NumericInput
                id="quote-delivery"
                value={quoteConfig.deliveryCost}
                min={0}
                max={5000000}
                step={1000}
                onChange={(v) => onUpdateQuoteConfig({ deliveryCost: v })}
              />
            </div>

            <div>
              <label htmlFor="quote-installation" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                Colocación ($)
              </label>
              <NumericInput
                id="quote-installation"
                value={quoteConfig.installationCost}
                min={0}
                max={5000000}
                step={1000}
                onChange={(v) => onUpdateQuoteConfig({ installationCost: v })}
              />
            </div>

            <div>
              <label htmlFor="quote-overhead" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                Gastos fijos (%)
              </label>
              <NumericInput
                id="quote-overhead"
                value={quoteConfig.overheadPercent}
                min={0}
                max={200}
                step={1}
                onChange={(v) => onUpdateQuoteConfig({ overheadPercent: v })}
              />
            </div>

            <div>
              <label htmlFor="quote-margin" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                Margen / Markup (%)
              </label>
              <NumericInput
                id="quote-margin"
                value={quoteConfig.profitMarginPercent}
                min={0}
                max={500}
                step={5}
                onChange={(v) => onUpdateQuoteConfig({ profitMarginPercent: v })}
              />
            </div>

            <div>
              <label htmlFor="quote-discount" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                Descuento (%)
              </label>
              <NumericInput
                id="quote-discount"
                value={quoteConfig.discountPercent}
                min={0}
                max={100}
                step={1}
                onChange={(v) => onUpdateQuoteConfig({ discountPercent: v })}
              />
            </div>

            <div>
              <label htmlFor="quote-vat" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                IVA (%)
              </label>
              <NumericInput
                id="quote-vat"
                value={quoteConfig.vatPercent}
                min={0}
                max={50}
                step={1}
                allowDecimals={true}
                onChange={(v) => onUpdateQuoteConfig({ vatPercent: v })}
              />
            </div>

            <div>
              <label htmlFor="quote-currency" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                Moneda cliente
              </label>
              <select
                id="quote-currency"
                className="m3-select"
                style={{ width: '100%', minHeight: '48px' }}
                value={quoteConfig.currency}
                onChange={(e) => onUpdateQuoteConfig({ currency: e.target.value as QuoteCurrency })}
              >
                <option value="ARS">ARS ($)</option>
                <option value="USD">USD (US$)</option>
              </select>
            </div>

            <div>
              <label htmlFor="quote-fx-rate" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                Tipo cambio ($/USD)
              </label>
              <NumericInput
                id="quote-fx-rate"
                value={quoteConfig.exchangeRateArsPerUsd}
                min={1}
                max={100000}
                step={10}
                onChange={(v) => onUpdateQuoteConfig({ exchangeRateArsPerUsd: Math.max(1, v) })}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Internal Cost Breakdown vs Client Commercial Price */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Client Commercial Price Highlight Card */}
          <div
            style={{
              padding: '1.1rem',
              borderRadius: '14px',
              backgroundColor: 'var(--md-sys-color-primary-container)',
              color: 'var(--md-sys-color-on-primary-container)',
              border: '1px solid var(--md-sys-color-primary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.45rem',
            }}
          >
            <span style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Precio Comercial para Cliente
            </span>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1.15 }}>
              {formatMoney(client.finalTotal, client.currency)}
            </div>
            <div style={{ fontSize: '0.82rem', opacity: 0.9 }}>
              Neto: {formatMoney(client.netSubtotal, client.currency)}
              {client.vatPercent > 0 ? ` + IVA (${client.vatPercent}%): ${formatMoney(client.vatAmount, client.currency)}` : ' (Sin IVA)'}
            </div>
            <div style={{ fontSize: '0.8rem', opacity: 0.85 }}>
              Equivalente ({client.equivalentCurrency}): <strong>{formatMoney(client.equivalentFinalTotal, client.equivalentCurrency)}</strong>
            </div>
            <div
              style={{
                marginTop: '0.35rem',
                paddingTop: '0.45rem',
                borderTop: '1px solid rgba(67, 91, 76, 0.25)',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.82rem',
                fontWeight: 600,
              }}
            >
              <span>Ganancia bruta est. (interno):</span>
              <span>
                {formatMoney(profitability.estimatedGrossProfitArs, 'ARS')} ({profitability.realMarginPercent.toFixed(1)}%)
              </span>
            </div>
          </div>

          {/* Internal Workshop Cost Breakdown (Hidden in Client PDF) */}
          <div
            style={{
              padding: '1rem',
              borderRadius: '12px',
              backgroundColor: 'var(--md-sys-color-surface-container-low)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              fontSize: '0.84rem',
            }}
          >
            <h4 style={{ margin: '0 0 0.25rem', fontSize: '0.92rem', fontWeight: 700 }}>
              🔒 Costo Interno de Taller (no se muestra al cliente)
            </h4>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Placas ({quoteConfig.workshopMode === 'in-house' && internal.offcutCredit > 0 ? 'neto con crédito retazos' : 'enteras'}):</span>
              <strong>{formatMoney(internal.netMaterialCost, 'ARS')}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Tapacanto ({internal.edgeBandBilledMeters} m con +{quoteConfig.edgeBandWastePercent}% merma):</span>
              <strong>{formatMoney(internal.edgeBandMaterialCost, 'ARS')}</strong>
            </div>
            {internal.edgeBandServiceCost > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Servicio pegado de cantos:</span>
                <strong>{formatMoney(internal.edgeBandServiceCost, 'ARS')}</strong>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Herrajes:</span>
              <strong>{formatMoney(internal.hardwareCost, 'ARS')}</strong>
            </div>
            {internal.cutPassCost > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Servicio / pasadas de corte:</span>
                <strong>{formatMoney(internal.cutPassCost, 'ARS')}</strong>
              </div>
            )}
            {internal.countertopCost > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Mesada / Marmolería:</span>
                <strong>{formatMoney(internal.countertopCost, 'ARS')}</strong>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Mano de obra ({internal.laborHours} hs est.):</span>
              <strong>{formatMoney(internal.laborCost, 'ARS')}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Insumos menores ({quoteConfig.consumablesPercent}%):</span>
              <strong>{formatMoney(internal.consumablesCost, 'ARS')}</strong>
            </div>
            {(internal.deliveryCost > 0 || internal.installationCost > 0) && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Flete y colocación:</span>
                <strong>{formatMoney(internal.deliveryCost + internal.installationCost, 'ARS')}</strong>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Gastos fijos / Overhead ({quoteConfig.overheadPercent}%):</span>
              <strong>{formatMoney(internal.overheadCost, 'ARS')}</strong>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '0.35rem',
                paddingTop: '0.45rem',
                borderTop: '1px solid var(--md-sys-color-outline-variant)',
                fontSize: '0.92rem',
                fontWeight: 700,
              }}
            >
              <span>Costo Interno Total:</span>
              <span>{formatMoney(internal.totalInternalCost, 'ARS')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
