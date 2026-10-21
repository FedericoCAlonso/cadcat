import { useState, useMemo, type ReactElement } from 'react';
import {
  type Piece,
  type Material,
  type EdgeBand,
  type LabelLayoutFormat,
  LABEL_LAYOUT_PRESETS,
} from '../model';
import { type PieceMachining } from '../model/operation';
import {
  extractPieceLabelData,
  exportLabelsPdf,
} from '../resolver/labels';

export interface LabelExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  pieces: Piece[];
  materials: Material[];
  edgeBands: EdgeBand[];
  machiningList?: PieceMachining[];
  orderId?: string;
  clientName?: string;
  moduleId?: string;
  moduleName?: string;
}

export function LabelExportModal({
  isOpen,
  onClose,
  pieces,
  materials,
  edgeBands,
  machiningList = [],
  orderId = 'ORD-001',
  clientName = 'Cliente Taller',
  moduleId = 'MOD-01',
  moduleName = 'Módulo CadCat',
}: LabelExportModalProps): ReactElement | null {
  const [selectedFormat, setSelectedFormat] = useState<LabelLayoutFormat>('thermal-100x50');
  const [includeGauges, setIncludeGauges] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const layout = LABEL_LAYOUT_PRESETS[selectedFormat];

  // Extract label data for current options
  const labelDataList = useMemo(() => {
    if (!isOpen || pieces.length === 0) return [];
    return extractPieceLabelData(pieces, {
      orderId,
      clientName,
      moduleId,
      moduleName,
      materials,
      edgeBands,
      machiningList,
      includeAuxiliaryGauges: includeGauges,
    });
  }, [
    isOpen,
    pieces,
    orderId,
    clientName,
    moduleId,
    moduleName,
    materials,
    edgeBands,
    machiningList,
    includeGauges,
  ]);

  const totalLabels = labelDataList.length;
  const totalPages = layout.isContinuousRoll
    ? totalLabels
    : Math.ceil(totalLabels / layout.labelsPerPage);

  if (!isOpen) {
    return null;
  }

  const handleGeneratePdf = () => {
    try {
      setIsGenerating(true);
      const doc = exportLabelsPdf(labelDataList, {
        layout,
        showCuttingGuidelines: showGuidelines,
      });

      const sanitizedModule = (moduleName || 'modulo').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const filename = `etiquetas_${sanitizedModule}_${selectedFormat}.pdf`;
      doc.save(filename);
      onClose();
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      className="m3-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="label-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: '1rem',
      }}
    >
      <div
        className="m3-card"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: 'var(--md-sys-color-surface)',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.28)',
          padding: '1.5rem',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h3 id="label-modal-title" style={{ margin: 0, fontSize: '1.25rem', color: 'var(--md-sys-color-on-surface)' }}>
              🏷️ Impresión de Etiquetas de Taller
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--md-sys-color-outline)' }}>
              {moduleName} ({totalLabels} piezas a etiquetar)
            </p>
          </div>
          <button
            type="button"
            className="m3-button m3-button--text"
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{ minWidth: '44px', minHeight: '44px', fontSize: '1.25rem' }}
          >
            ✕
          </button>
        </div>

        {/* Format Selector */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', color: 'var(--md-sys-color-on-surface)' }}>
            Selecciona el Formato de Impresión:
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {(Object.keys(LABEL_LAYOUT_PRESETS) as LabelLayoutFormat[]).map((fmtKey) => {
              const preset = LABEL_LAYOUT_PRESETS[fmtKey];
              const isSelected = selectedFormat === fmtKey;
              return (
                <label
                  key={fmtKey}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '10px',
                    border: `2px solid ${isSelected ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)'}`,
                    backgroundColor: isSelected ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container)',
                    cursor: 'pointer',
                    minHeight: '48px',
                    transition: 'all 0.15s ease-in-out',
                  }}
                >
                  <input
                    type="radio"
                    name="label-format"
                    value={fmtKey}
                    checked={isSelected}
                    onChange={() => setSelectedFormat(fmtKey)}
                    style={{ accentColor: 'var(--md-sys-color-primary)', width: '20px', height: '20px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--md-sys-color-on-surface)' }}>
                      {preset.name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--md-sys-color-outline)' }}>
                      {preset.isContinuousRoll
                        ? `Impresora térmica de rollo · 1 etiqueta por página (${preset.labelWidthMm} × ${preset.labelHeightMm} mm)`
                        : `Hoja A4 · ${preset.labelsPerPage} etiquetas por página (${preset.columns} col × ${preset.rows} filas)`}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Options */}
        <div style={{ marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', minHeight: '48px' }}>
            <input
              type="checkbox"
              checked={includeGauges}
              onChange={(e) => setIncludeGauges(e.target.checked)}
              style={{ accentColor: 'var(--md-sys-color-primary)', width: '20px', height: '20px' }}
            />
            <span style={{ fontSize: '0.9rem', color: 'var(--md-sys-color-on-surface)' }}>
              Incluir calibres auxiliares de ensamble (tiras de retazo)
            </span>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', minHeight: '48px' }}>
            <input
              type="checkbox"
              checked={showGuidelines}
              onChange={(e) => setShowGuidelines(e.target.checked)}
              style={{ accentColor: 'var(--md-sys-color-primary)', width: '20px', height: '20px' }}
            />
            <span style={{ fontSize: '0.9rem', color: 'var(--md-sys-color-on-surface)' }}>
              Dibujar bordes guía de corte / troquel en el PDF
            </span>
          </label>
        </div>

        {/* Output Summary Card */}
        <div
          style={{
            padding: '0.85rem 1rem',
            borderRadius: '8px',
            backgroundColor: 'var(--md-sys-color-surface-container-high)',
            marginBottom: '1.5rem',
            fontSize: '0.85rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div>
            <div><strong>Total de Piezas:</strong> {totalLabels}</div>
            <div style={{ color: 'var(--md-sys-color-outline)' }}>
              {layout.isContinuousRoll ? '1 etiqueta por disparo' : `${layout.labelsPerPage} etiquetas por hoja`}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div><strong>Páginas a Imprimir:</strong> {totalPages}</div>
            <div style={{ color: 'var(--md-sys-color-primary)', fontWeight: 600 }}>
              {layout.isContinuousRoll ? 'PDF continuo' : `Hojas A4: ${totalPages}`}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="m3-button m3-button--tonal"
            onClick={onClose}
            style={{ minHeight: '48px', padding: '0 1.25rem', fontWeight: 600 }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="m3-button m3-button--primary"
            onClick={handleGeneratePdf}
            disabled={totalLabels === 0 || isGenerating}
            style={{
              minHeight: '48px',
              padding: '0 1.5rem',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>{isGenerating ? 'Generando...' : '📥 Descargar PDF de Etiquetas'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
