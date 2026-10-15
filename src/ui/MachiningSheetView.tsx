import { useState, type ReactElement } from 'react';
import {
  renderPieceMachiningSvg,
  getFaceSemanticLabel,
  type PieceMachiningSheet,
} from '../resolver';
import { usePanZoom } from './usePanZoom';

export interface MachiningSheetViewProps {
  sheets: PieceMachiningSheet[];
  selectedPieceId: string | null;
  onSelectPiece: (pieceId: string) => void;
  onExportPdf: (pieceId?: string) => void;
  onExportDxf?: (pieceId?: string) => void;
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
  onExportDxf,
}: MachiningSheetViewProps): ReactElement {
  const [activeFace, setActiveFace] = useState<'face-A' | 'face-B'>('face-A');
  const panZoom = usePanZoom({ minZoom: 0.4, maxZoom: 5.0, zoomStep: 1.25 });

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

        <div className="machining-actions" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
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
          {onExportDxf && (
            <>
              <button
                type="button"
                className="m3-button m3-button--outlined"
                onClick={() => onExportDxf(activeSheet.pieceId)}
                title="Exportar archivo AutoCAD DXF R12 para esta pieza"
                aria-label="Descargar DXF de esta pieza"
              >
                📐 DXF Esta Pieza
              </button>
              <button
                type="button"
                className="m3-button m3-button--outlined"
                onClick={() => onExportDxf()}
                title="Exportar archivos AutoCAD DXF R12 para todas las piezas"
                aria-label="Descargar DXF de todas las piezas"
              >
                📐 DXF Todas ({sheets.length})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Piece Selection: Mobile Dropdown & Desktop Chips */}
      <div className="machining-piece-selector-mobile" style={{ marginBottom: '0.75rem' }}>
        <label htmlFor="machining-piece-select" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
          Seleccionar Pieza:
        </label>
        <select
          id="machining-piece-select"
          className="m3-select"
          style={{ width: '100%', fontSize: '0.9rem' }}
          value={activeSheet.pieceId}
          onChange={(e) => onSelectPiece(e.target.value)}
        >
          {sheets.map((sheet) => (
            <option key={sheet.pieceId} value={sheet.pieceId}>
              {sheet.pieceId} ({sheet.role}) {sheet.requiresTurn ? '🔄 Giro' : ''}
            </option>
          ))}
        </select>
      </div>

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
            {`Cara A: ${getFaceSemanticLabel(activeSheet.role, 'face-A')} (${activeSheet.faceAOperations.length} op.)`}
          </button>
          <button
            type="button"
            className={`m3-segmented-button__item ${activeFace === 'face-B' ? 'selected' : ''}`}
            onClick={() => setActiveFace('face-B')}
          >
            {`Cara B: ${getFaceSemanticLabel(activeSheet.role, 'face-B')} (${activeSheet.faceBOperations.length} op.)`}
            {activeSheet.requiresTurn && ' ⚠️'}
          </button>
        </div>
      </div>

      {/* Technical SVG Drawing Box with CAD Pan & Zoom */}
      <div
        className="machining-drawing-container"
        style={{ position: 'relative', overflow: 'hidden' }}
        onWheel={panZoom.handleWheel}
        onPointerDown={(e) => {
          panZoom.startPan(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (panZoom.isPanning) {
            panZoom.updatePan(e.clientX, e.clientY);
          }
        }}
        onPointerUp={() => {
          if (panZoom.isPanning) panZoom.endPan();
        }}
        onPointerLeave={() => {
          if (panZoom.isPanning) panZoom.endPan();
        }}
      >
        {/* Floating CAD Zoom Toolbar */}
        <div
          className="cad-floating-toolbar"
          style={{
            position: 'absolute',
            top: '8px',
            right: '8px',
            zIndex: 10,
            display: 'flex',
            gap: '4px',
            backgroundColor: 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(4px)',
            padding: '3px 6px',
            borderRadius: '6px',
            boxShadow: 'var(--md-sys-elevation-2)',
            border: '1px solid var(--md-sys-color-outline-variant)',
          }}
        >
          <button
            type="button"
            className="m3-btn m3-btn--small m3-btn--tonal"
            style={{ padding: '0.15rem 0.45rem', minWidth: '28px' }}
            onClick={panZoom.zoomIn}
            title="Acercar Zoom [Rueda del mouse]"
          >
            ➕
          </button>
          <button
            type="button"
            className="m3-btn m3-btn--small m3-btn--tonal"
            style={{ padding: '0.15rem 0.45rem', minWidth: '28px' }}
            onClick={panZoom.zoomOut}
            title="Alejar Zoom"
          >
            ➖
          </button>
          <button
            type="button"
            className="m3-btn m3-btn--small m3-btn--tonal"
            style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}
            onClick={panZoom.fitView}
            title="Ajustar a pantalla"
          >
            ⛶ Ajustar
          </button>
          <button
            type="button"
            className="m3-btn m3-btn--small m3-btn--outlined"
            style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}
            onClick={panZoom.resetView}
            title="Restablecer escala 1:1"
          >
            {Math.round(panZoom.zoom * 100)}%
          </button>
        </div>

        <div
          className="machining-svg-wrapper"
          style={{
            transform: `translate(${panZoom.pan.x}px, ${panZoom.pan.y}px) scale(${panZoom.zoom})`,
            transformOrigin: 'center center',
            transition: panZoom.isPanning ? 'none' : 'transform 0.1s ease-out',
            cursor: panZoom.isPanning ? 'grabbing' : 'grab',
            userSelect: 'none',
          }}
          dangerouslySetInnerHTML={{ __html: svgContent }}
        />
        <div className="machining-legend">
          <span className="legend-item">
            <span className="legend-dot legend-dot--datum" />
            <strong>Datum (0,0):</strong> Esquina inferior izquierda
          </span>
          <span className="legend-item">
            <span className="legend-dot legend-dot--cota" />
            <strong>Cotas X / Y:</strong> Distancias desde bordes de referencia
          </span>
          <span className="legend-item">
            <span className="legend-dot legend-dot--band" />
            <strong>Línea Azul:</strong> Borde con tapacantos
          </span>
          <span className="legend-item" style={{ marginLeft: 'auto', fontStyle: 'italic', fontSize: '0.8rem' }}>
            🖱️ Paneo: Arrastrar con mouse | 🔍 Zoom: Rueda o botones
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
          <>
            <div className="m3-machining-table-wrapper m3-table-responsive">
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
            </div>

            {/* Mobile M3 Cards View for Operations */}
            <div className="m3-catalog-cards">
              {activeOps.map((op, idx) => (
                <div key={op.id} className="m3-catalog-card">
                  <div className="m3-catalog-card-header">
                    <strong>#{idx + 1} {op.description}</strong>
                    <span className="m3-badge m3-badge--neutral">Ø{op.diameterMm} mm</span>
                  </div>
                  <div className="m3-catalog-card-row">
                    <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Profundidad:</span>
                    <span>{op.depthMm} mm ({op.isThrough ? 'Pasante' : 'Ciego'})</span>
                  </div>
                  <div className="m3-catalog-card-row">
                    <span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Cotas Datum (0,0):</span>
                    <span className="cota-badge">X: {op.distFromLeftMm} mm | Y: {op.distFromBottomMm} mm</span>
                  </div>
                  <div className="m3-catalog-card-row" style={{ fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                    <span>Márgenes:</span>
                    <span>Der: {op.distFromRightMm} mm | Sup: {op.distFromTopMm} mm</span>
                  </div>
                </div>
              ))}
            </div>
          </>
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
