import { useState, type ReactElement } from 'react';
import {
  renderPieceMachiningSvg,
  type PieceMachiningSheet,
} from '../resolver';

export interface MachiningSheetViewProps {
  sheets: PieceMachiningSheet[];
  selectedPieceId: string | null;
  onSelectPiece: (pieceId: string) => void;
  onExportPdf: (pieceId?: string) => void;
}

/**
 * Technical Machining Sheet View for workshop manual machines.
 * Implements Google Material Design 3 (M3) cards, chips, and segmented buttons.
 */
export function MachiningSheetView({
  sheets,
  selectedPieceId,
  onSelectPiece,
  onExportPdf,
}: MachiningSheetViewProps): ReactElement {
  const [activeFace, setActiveFace] = useState<'face-A' | 'face-B'>('face-A');

  if (sheets.length === 0) {
    return (
      <section aria-labelledby="machining-heading" className="m3-card">
        <h2 id="machining-heading" className="m3-card__title">Planos de Mecanizado</h2>
        <p className="m3-card__subtitle">
          No hay piezas disponibles en el módulo actual para calcular mecanizados.
        </p>
      </section>
    );
  }

  const activeSheet =
    sheets.find((s) => s.pieceId === selectedPieceId) ?? sheets[0]!;

  const svgContent = renderPieceMachiningSvg(activeSheet, activeFace, {
    svgWidth: 680,
    svgHeight: 440,
  });

  const activeOps =
    activeFace === 'face-A'
      ? activeSheet.faceAOperations
      : activeSheet.faceBOperations;

  return (
    <section aria-labelledby="machining-heading" className="m3-card machining-sheet-card">
      <div className="m3-card__header">
        <div>
          <h2 id="machining-heading" className="m3-card__title">
            🛠️ Planos de Mecanizado (Máquinas Manuales)
          </h2>
          <p className="m3-card__subtitle">
            Cotas referenciadas a bordes para Cara A y Cara B con indicador de giro de pieza.
          </p>
        </div>

        <div className="machining-actions">
          <button
            type="button"
            className="m3-button m3-button--tonal"
            onClick={() => onExportPdf(activeSheet.pieceId)}
          >
            📄 PDF Esta Pieza
          </button>
          <button
            type="button"
            className="m3-button m3-button--filled"
            onClick={() => onExportPdf()}
          >
            📑 PDF Todas ({sheets.length})
          </button>
        </div>
      </div>

      {/* Piece Selection Chips */}
      <div className="machining-chips-row" role="tablist" aria-label="Seleccionar Pieza">
        {sheets.map((sheet) => {
          const isSelected = sheet.pieceId === activeSheet.pieceId;
          return (
            <button
              key={sheet.pieceId}
              type="button"
              role="tab"
              aria-selected={isSelected}
              className={`m3-chip ${isSelected ? 'm3-chip--selected' : ''}`}
              onClick={() => onSelectPiece(sheet.pieceId)}
            >
              <span className="m3-chip__label">{sheet.pieceId}</span>
              {sheet.requiresTurn && (
                <span
                  className="m3-badge m3-badge--warning"
                  title="Requiere giro de pieza para Cara B"
                >
                  🔄 Giro
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active Piece Info Bar */}
      <div className="machining-info-bar">
        <div className="info-group">
          <span className="info-label">Pieza:</span>
          <strong>{activeSheet.pieceId}</strong> ({activeSheet.role})
        </div>
        <div className="info-group">
          <span className="info-label">Medidas Finales:</span>
          <strong>
            {`${activeSheet.dimensionsMm.width} x ${activeSheet.dimensionsMm.height} x ${activeSheet.dimensionsMm.thickness} mm`}
          </strong>
        </div>
        <div className="info-group">
          <span className="info-label">Medidas de Corte:</span>
          <strong>
            {`${activeSheet.cutDimensionsMm.width} x ${activeSheet.cutDimensionsMm.height} mm`}
          </strong>
        </div>
        <div className="info-group">
          <span className="info-label">Tapacantos:</span>
          <span>
            {activeSheet.bandedEdges.top ? '↑ ' : ''}
            {activeSheet.bandedEdges.bottom ? '↓ ' : ''}
            {activeSheet.bandedEdges.left ? '← ' : ''}
            {activeSheet.bandedEdges.right ? '→ ' : ''}
            {!activeSheet.bandedEdges.top &&
            !activeSheet.bandedEdges.bottom &&
            !activeSheet.bandedEdges.left &&
            !activeSheet.bandedEdges.right
              ? 'Sin tapacantos'
              : ''}
          </span>
        </div>
      </div>

      {/* Turn Warning Banner */}
      {activeSheet.requiresTurn && (
        <div className="m3-banner m3-banner--warning" role="alert">
          <div className="m3-banner__icon">🔄</div>
          <div className="m3-banner__text">
            <strong>ATENCIÓN: GIRAR LA PIEZA</strong>
            <p>{activeSheet.turnInstructions}</p>
          </div>
        </div>
      )}

      {/* Face Selector (Segmented Button) */}
      <div className="machining-face-selector">
        <div className="m3-segmented-button" role="group" aria-label="Seleccionar Cara">
          <button
            type="button"
            className={`m3-segmented-button__item ${activeFace === 'face-A' ? 'selected' : ''}`}
            onClick={() => setActiveFace('face-A')}
          >
            Cara A (Frente) • {activeSheet.faceAOperations.length} op.
          </button>
          <button
            type="button"
            className={`m3-segmented-button__item ${activeFace === 'face-B' ? 'selected' : ''}`}
            onClick={() => setActiveFace('face-B')}
          >
            Cara B (Reverso) • {activeSheet.faceBOperations.length} op.
            {activeSheet.requiresTurn && ' ⚠️'}
          </button>
        </div>
      </div>

      {/* Technical SVG Drawing Box */}
      <div className="machining-drawing-container">
        <div
          className="machining-svg-wrapper"
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
        <div className="machining-legend">
          <span className="legend-item">
            <span className="legend-dot legend-dot--datum" />
            <strong>Datum (0,0):</strong> Esquina inferior izquierda de referencia
          </span>
          <span className="legend-item">
            <span className="legend-dot legend-dot--cota" />
            <strong>Cotas X / Y:</strong> Distancias desde los bordes de referencia
          </span>
          <span className="legend-item">
            <span className="legend-dot legend-dot--band" />
            <strong>Línea Azul:</strong> Borde con tapacantos
          </span>
        </div>
      </div>

      {/* Operations Table */}
      <div className="machining-table-container">
        <h3 className="table-heading">
          Operaciones en {activeFace === 'face-A' ? 'Cara A' : 'Cara B'} ({activeOps.length})
        </h3>
        {activeOps.length === 0 ? (
          <p className="empty-notice">No hay perforaciones en esta cara.</p>
        ) : (
          <table className="m3-table" aria-label="Tabla de operaciones">
            <thead>
              <tr>
                <th>#</th>
                <th>Descripción / Herraje</th>
                <th>Diámetro</th>
                <th>Profundidad</th>
                <th>Pasante</th>
                <th>Cota X (desde Izq.)</th>
                <th>Cota Y (desde Inf.)</th>
                <th>Margen Derecho</th>
                <th>Margen Superior</th>
              </tr>
            </thead>
            <tbody>
              {activeOps.map((op, idx) => (
                <tr key={op.id}>
                  <td>{idx + 1}</td>
                  <td>
                    <strong>{op.description}</strong>
                  </td>
                  <td>Ø{op.diameterMm} mm</td>
                  <td>{op.depthMm} mm</td>
                  <td>{op.isThrough ? 'Sí (Pasante)' : 'Ciego'}</td>
                  <td>
                    <span className="cota-badge">{op.distFromLeftMm} mm</span>
                  </td>
                  <td>
                    <span className="cota-badge">{op.distFromBottomMm} mm</span>
                  </td>
                  <td>{op.distFromRightMm} mm</td>
                  <td>{op.distFromTopMm} mm</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edge Operations Table (if any) */}
      {activeSheet.edgeOperations.length > 0 && (
        <div className="machining-table-container">
          <h3 className="table-heading">
            Perforaciones en Cantos ({activeSheet.edgeOperations.length})
          </h3>
          <table className="m3-table" aria-label="Tabla de operaciones en cantos">
            <thead>
              <tr>
                <th>#</th>
                <th>Canto</th>
                <th>Descripción</th>
                <th>Diámetro</th>
                <th>Profundidad</th>
                <th>Posición X</th>
                <th>Posición Y</th>
              </tr>
            </thead>
            <tbody>
              {activeSheet.edgeOperations.map((op, idx) => (
                <tr key={op.id}>
                  <td>{idx + 1}</td>
                  <td>{op.faceId}</td>
                  <td>{op.description}</td>
                  <td>Ø{op.diameterMm} mm</td>
                  <td>{op.depthMm} mm</td>
                  <td>{op.xMm} mm</td>
                  <td>{op.yMm} mm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
