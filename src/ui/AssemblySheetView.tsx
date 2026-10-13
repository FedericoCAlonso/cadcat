import { useState, type ReactElement } from 'react';
import type { AssemblySheet, AssemblyGauge } from '../resolver';
import { exportAssemblyGuidePdf } from '../resolver';

export interface AssemblySheetViewProps {
  assemblySheet: AssemblySheet | null;
  onExportPdf?: () => void;
}

/**
 * Render an SVG elevation diagram showing the carcass panels and assembly gauge strips.
 */
function renderAssemblySvg(sheet: AssemblySheet): ReactElement {
  const width = 640;
  const height = 400;
  const margin = 50;

  // Carcass dimensions inside SVG
  const carcassW = 280;
  const carcassH = 320;
  const carcassX = margin + 40;
  const carcassY = margin;

  const panelThickness = 12;

  // Collect unique gauges
  const gauges = sheet.gauges;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="assembly-svg"
      style={{ width: '100%', height: 'auto', maxHeight: '420px', background: '#fafafa', borderRadius: '12px' }}
      aria-label="Carcass elevation diagram with assembly gauges"
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#1b5e20" />
        </marker>
        <pattern id="gauge-hatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#81c784" strokeWidth="2" />
        </pattern>
      </defs>

      {/* Carcass Sides */}
      {/* Left side */}
      <rect
        x={carcassX}
        y={carcassY}
        width={panelThickness}
        height={carcassH}
        fill="#b0bec5"
        stroke="#37474f"
        strokeWidth="1.5"
      />
      <text x={carcassX - 5} y={carcassY + carcassH / 2} textAnchor="end" fontSize="10" fill="#37474f">
        Side Left
      </text>

      {/* Right side */}
      <rect
        x={carcassX + carcassW - panelThickness}
        y={carcassY}
        width={panelThickness}
        height={carcassH}
        fill="#b0bec5"
        stroke="#37474f"
        strokeWidth="1.5"
      />
      <text x={carcassX + carcassW + 5} y={carcassY + carcassH / 2} textAnchor="start" fontSize="10" fill="#37474f">
        Side Right
      </text>

      {/* Bottom Panel */}
      <rect
        x={carcassX + panelThickness}
        y={carcassY + carcassH - panelThickness}
        width={carcassW - 2 * panelThickness}
        height={panelThickness}
        fill="#90a4ae"
        stroke="#37474f"
        strokeWidth="1.5"
      />
      <text x={carcassX + carcassW / 2} y={carcassY + carcassH + 14} textAnchor="middle" fontSize="10" fill="#37474f">
        Bottom Panel
      </text>

      {/* Top Rail / Panel */}
      <rect
        x={carcassX + panelThickness}
        y={carcassY}
        width={carcassW - 2 * panelThickness}
        height={panelThickness}
        fill="#90a4ae"
        stroke="#37474f"
        strokeWidth="1.5"
      />
      <text x={carcassX + carcassW / 2} y={carcassY - 8} textAnchor="middle" fontSize="10" fill="#37474f">
        Top Rails / Stretchers
      </text>

      {/* Shelves and Gauges */}
      {gauges.length > 0 ? (
        gauges.map((g, idx) => {
          const numGauges = Math.max(1, gauges.length);
          const availableInteriorH = carcassH - 2 * panelThickness;
          const sectionH = availableInteriorH / (numGauges + 1);
          const shelfY = carcassY + carcassH - panelThickness - (idx + 1) * sectionH;
          const gaugeH = sectionH - panelThickness;
          const gaugeY = shelfY + panelThickness;

          return (
            <g key={g.id}>
              {/* Shelf */}
              <rect
                x={carcassX + panelThickness}
                y={shelfY}
                width={carcassW - 2 * panelThickness}
                height={panelThickness}
                fill="#78909c"
                stroke="#37474f"
                strokeWidth="1.5"
              />
              <text x={carcassX + carcassW / 2} y={shelfY + panelThickness - 3} textAnchor="middle" fontSize="9" fill="#ffffff" fontWeight="bold">
                Shelf {idx + 1}
              </text>

              {/* Gauge Block on Left */}
              <rect
                x={carcassX + panelThickness + 8}
                y={gaugeY}
                width={28}
                height={gaugeH}
                fill="url(#gauge-hatch)"
                stroke="#2e7d32"
                strokeWidth="2"
                rx="2"
              />
              <rect
                x={carcassX + panelThickness + 8}
                y={gaugeY}
                width={28}
                height={gaugeH}
                fill="#c8e6c9"
                opacity="0.6"
              />
              <text
                x={carcassX + panelThickness + 22}
                y={gaugeY + gaugeH / 2 + 4}
                textAnchor="middle"
                fontSize="11"
                fontWeight="bold"
                fill="#1b5e20"
              >
                {g.label}
              </text>

              {/* Gauge Block on Right */}
              <rect
                x={carcassX + carcassW - panelThickness - 36}
                y={gaugeY}
                width={28}
                height={gaugeH}
                fill="url(#gauge-hatch)"
                stroke="#2e7d32"
                strokeWidth="2"
                rx="2"
              />
              <rect
                x={carcassX + carcassW - panelThickness - 36}
                y={gaugeY}
                width={28}
                height={gaugeH}
                fill="#c8e6c9"
                opacity="0.6"
              />
              <text
                x={carcassX + carcassW - panelThickness - 22}
                y={gaugeY + gaugeH / 2 + 4}
                textAnchor="middle"
                fontSize="11"
                fontWeight="bold"
                fill="#1b5e20"
              >
                {g.label}
              </text>

              {/* Dimension Line on Right */}
              <line
                x1={carcassX + carcassW + 45}
                y1={gaugeY}
                x2={carcassX + carcassW + 45}
                y2={gaugeY + gaugeH}
                stroke="#1b5e20"
                strokeWidth="1.5"
                markerStart="url(#arrow)"
                markerEnd="url(#arrow)"
              />
              <text
                x={carcassX + carcassW + 55}
                y={gaugeY + gaugeH / 2 + 4}
                fontSize="11"
                fontWeight="bold"
                fill="#1b5e20"
              >
                {g.label}: {g.clearSpanMm} mm
              </text>
            </g>
          );
        })
      ) : (
        <text x={carcassX + carcassW / 2} y={carcassY + carcassH / 2} textAnchor="middle" fontSize="12" fill="#78909c">
          Standard carcass structure
        </text>
      )}

      {/* Legend Box */}
      <g transform={`translate(${carcassX + carcassW + 40}, ${carcassY + 15})`}>
        <rect x="0" y="0" width="130" height="65" fill="#ffffff" stroke="#e0e0e0" rx="4" />
        <rect x="10" y="10" width="16" height="12" fill="#c8e6c9" stroke="#2e7d32" strokeWidth="1.5" />
        <text x="32" y="20" fontSize="10" fill="#212121">Gauge Strip</text>
        <rect x="10" y="28" width="16" height="6" fill="#90a4ae" stroke="#37474f" />
        <text x="32" y="34" fontSize="10" fill="#212121">Panel (18mm)</text>
        <line x1="10" y1="46" x2="26" y2="46" stroke="#1b5e20" strokeWidth="1.5" markerEnd="url(#arrow)" />
        <text x="32" y="49" fontSize="10" fill="#212121">Clear Span</text>
      </g>
    </svg>
  );
}

/**
 * View component for the sequential workshop assembly sheet.
 * Implements Google Material Design 3 guidelines with elevation, cards, and step tracking.
 */
export function AssemblySheetView({
  assemblySheet,
  onExportPdf,
}: AssemblySheetViewProps): ReactElement {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  if (!assemblySheet) {
    return (
      <section aria-labelledby="assembly-heading" className="m3-card">
        <h2 id="assembly-heading" className="m3-card__title">📖 Guía de Armado de Taller</h2>
        <p className="m3-card__subtitle">
          No hay datos de armado disponibles. Seleccione o cree un módulo para generar la guía.
        </p>
      </section>
    );
  }

  function toggleStep(stepNum: number): void {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepNum)) next.delete(stepNum);
      else next.add(stepNum);
      return next;
    });
  }

  function handleDefaultExport(): void {
    if (!assemblySheet) return;
    if (onExportPdf) {
      onExportPdf();
      return;
    }
    const doc = exportAssemblyGuidePdf(assemblySheet);
    doc.save(`assembly_guide_${assemblySheet.moduleId}.pdf`);
  }

  const allDone = completedSteps.size === assemblySheet.steps.length;

  return (
    <section aria-labelledby="assembly-heading" className="m3-card assembly-sheet-card">
      <div className="m3-card__header">
        <div>
          <h2 id="assembly-heading" className="m3-card__title">
            📖 Guía de Armado y Calibres de Taller
          </h2>
          <p className="m3-card__subtitle">
            Secuencia de montaje sin cinta métrica usando tiras calibre derivadas de vanos idénticos.
          </p>
        </div>

        <div className="assembly-actions">
          <button
            type="button"
            className="m3-button m3-button--filled"
            onClick={handleDefaultExport}
          >
            📄 Exportar Guía PDF
          </button>
        </div>
      </div>

      {/* Assembly Gauges Table / Cards */}
      <div className="assembly-gauges-section" style={{ marginTop: '16px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px', color: '#1f2937' }}>
          📏 Calibres de Montaje Derivados ({assemblySheet.gauges.length})
        </h3>

        {assemblySheet.gauges.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
            No se identificaron vanos paralelos repetidos que requieran calibres especiales.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            {assemblySheet.gauges.map((g: AssemblyGauge) => (
              <div
                key={g.id}
                style={{
                  border: '1px solid #a7f3d0',
                  background: '#f0fdf4',
                  borderRadius: '8px',
                  padding: '12px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#065f46' }}>
                    Calibre {g.label}
                  </span>
                  <span
                    style={{
                      background: '#d1fae5',
                      color: '#065f46',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    {g.spansCount} vano(s)
                  </span>
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.875rem', color: '#374151' }}>
                  <div><strong>Largo vano:</strong> {g.clearSpanMm} mm</div>
                  <div><strong>Ancho tira:</strong> {g.widthMm} mm</div>
                  <div><strong>Costo material:</strong> $0.00 (Retazo)</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Carcass Elevation & Gauge Placement SVG */}
      <div style={{ marginTop: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px', color: '#1f2937' }}>
          📐 Esquema de Posicionamiento de Calibres
        </h3>
        {renderAssemblySvg(assemblySheet)}
      </div>

      {/* Sequential Assembly Checklist */}
      <div style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1f2937' }}>
            📋 Pasos de Armado Secuenciales ({completedSteps.size}/{assemblySheet.steps.length})
          </h3>
          {allDone && (
            <span style={{ color: '#059669', fontWeight: 600, fontSize: '0.9rem' }}>
              ✓ ¡Módulo Completado!
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {assemblySheet.steps.map((step) => {
            const isDone = completedSteps.has(step.stepNumber);
            return (
              <div
                key={step.stepNumber}
                onClick={() => toggleStep(step.stepNumber)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: isDone ? '1px solid #10b981' : '1px solid #e5e7eb',
                  background: isDone ? '#f0fdf4' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-in-out',
                }}
              >
                <input
                  type="checkbox"
                  checked={isDone}
                  onChange={() => toggleStep(step.stepNumber)}
                  style={{ marginTop: '3px', cursor: 'pointer', accentColor: '#10b981', width: '16px', height: '16px' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        color: isDone ? '#065f46' : '#111827',
                        textDecoration: isDone ? 'line-through' : 'none',
                      }}
                    >
                      Paso {step.stepNumber}: {step.title}
                    </span>
                    {step.gaugesInvolved.map((g) => (
                      <span
                        key={g}
                        style={{
                          background: '#dcfce7',
                          color: '#166534',
                          border: '1px solid #86efac',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                        }}
                      >
                        Calibre {g}
                      </span>
                    ))}
                  </div>

                  <p
                    style={{
                      margin: '4px 0 0 0',
                      fontSize: '0.875rem',
                      color: isDone ? '#4b5563' : '#374151',
                    }}
                  >
                    {step.instruction}
                  </p>

                  {step.notes && (
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', fontStyle: 'italic', color: '#6b7280' }}>
                      Nota: {step.notes}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
