import { useState, type ReactElement } from 'react';
import type { ResolvedPieceWithCutSize, ShelfDeflectionResult } from '../resolver';
import { translatePieceRole } from './localization';

export interface PieceListViewProps {
  pieces: ResolvedPieceWithCutSize[];
  shelfDeflections?: Map<string, ShelfDeflectionResult>;
}

/**
 * List view of resolved pieces with Argentine Spanish terminology and responsive M3 table.
 * Shows finished dimensions, cut dimensions, material filter, edge banding, and deflection checks.
 */
export function PieceListView(props: PieceListViewProps): ReactElement {
  const { pieces, shelfDeflections } = props;
  const [selectedMaterial, setSelectedMaterial] = useState<string>('all');

  if (pieces.length === 0) {
    return (
      <section aria-labelledby="pieces-heading" className="m3-card piece-list-view">
        <h2 id="pieces-heading" className="m3-card__title">
          📋 Despiece y Piezas
          <span className="visually-hidden">Pieces</span>
        </h2>
        <p>
          No hay piezas resueltas en el despiece. Ajustá las medidas del módulo.
          <span className="visually-hidden">No pieces resolved. Adjust module parameters.</span>
        </p>
      </section>
    );
  }

  // Extract unique materials
  const uniqueMaterials = Array.from(new Set(pieces.map((p) => p.materialId)));

  const filteredPieces =
    selectedMaterial === 'all'
      ? pieces
      : pieces.filter((p) => p.materialId === selectedMaterial);

  // Check if any shelf has an active deflection warning
  const warningList = filteredPieces
    .map((p) => shelfDeflections?.get(p.id))
    .filter((d): d is ShelfDeflectionResult => d !== undefined && d.hasWarning);

  const totalEdgeBandMeters = filteredPieces.reduce((acc, p) => {
    return acc + p.bandedEdges.reduce((bAcc, b) => bAcc + b.lengthMm / 1000, 0);
  }, 0);

  return (
    <section aria-labelledby="pieces-heading" className="m3-card piece-list-view">
      <div className="m3-card__header">
        <div className="piece-list-header-row">
          <div>
            <h2 id="pieces-heading" className="m3-card__title">
              📋 Despiece de Taller ({filteredPieces.length} piezas)
              <span className="visually-hidden">{`Pieces Cut List (${filteredPieces.length})`}</span>
            </h2>
            <p className="m3-card__subtitle">
              Planilla de corte con medidas finales terminadas y descuento de tapacantos para escuadradora.
            </p>
          </div>
          <div className="piece-summary-badges">
            <span className="m3-badge m3-badge--neutral">
              Total: <strong>{filteredPieces.length} piezas</strong>
            </span>
            <span className="m3-badge m3-badge--neutral">
              Tapacantos: <strong>{totalEdgeBandMeters.toFixed(2)} m</strong>
            </span>
          </div>
        </div>

        {uniqueMaterials.length > 1 && (
          <div className="material-filter-bar" style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem', alignSelf: 'center', fontWeight: 600 }}>Filtrar por material:</span>
            <button
              type="button"
              className={`m3-btn m3-btn--small ${selectedMaterial === 'all' ? 'm3-btn--primary' : 'm3-btn--text'}`}
              onClick={() => setSelectedMaterial('all')}
            >
              Todos ({pieces.length})
            </button>
            {uniqueMaterials.map((matId) => {
              const count = pieces.filter((p) => p.materialId === matId).length;
              return (
                <button
                  key={matId}
                  type="button"
                  className={`m3-btn m3-btn--small ${selectedMaterial === matId ? 'm3-btn--primary' : 'm3-btn--text'}`}
                  onClick={() => setSelectedMaterial(matId)}
                >
                  {matId} ({count})
                </button>
              );
            })}
          </div>
        )}
      </div>

      {warningList.length > 0 && (
        <div className="m3-alert m3-alert--warning" role="alert" style={{ marginBottom: '1rem' }}>
          <span className="m3-alert__icon" aria-hidden="true">⚠️</span>
          <div>
            <strong>Aviso de flexión en estante:</strong> Se detectó deflexión superior al límite admisible en {warningList.length} estante(s). Verifique el vano o aumente el espesor.
          </div>
        </div>
      )}

      <div className="m3-table-responsive">
        <table className="m3-table">
          <thead>
            <tr>
              <th>Rol / Pieza</th>
              <th>Material</th>
              <th>Medida Final</th>
              <th>Corte en Sierra</th>
              <th>Espesor</th>
              <th>Estructural</th>
              <th>Tapacantos</th>
              <th>Deflexión / Estado</th>
            </tr>
          </thead>
          <tbody>
            {filteredPieces.map((piece) => {
              const finishedStr = `${piece.dimensionsMm.width} x ${piece.dimensionsMm.height} mm`;
              const cutStr = `${piece.cutDimensionsMm.width} x ${piece.cutDimensionsMm.height} mm`;
              const bandedStr = piece.bandedEdges.length > 0
                ? piece.bandedEdges.map((b) => `${b.faceId} (${b.thicknessMm}mm)`).join(', ')
                : 'Sin tapacanto';

              const deflection = shelfDeflections?.get(piece.id);

              return (
                <tr key={piece.id}>
                  <td>
                    <strong>{translatePieceRole(piece.role)}</strong>
                    <br />
                    <code className="piece-tag">{piece.id}</code>
                  </td>
                  <td>
                    <span className="m3-badge m3-badge--neutral">{piece.materialId}</span>
                  </td>
                  <td>{finishedStr}</td>
                  <td>
                    <strong>{cutStr}</strong>
                  </td>
                  <td>{`${piece.thicknessMm} mm`}</td>
                  <td>
                    {piece.structural ? (
                      <span className="status-dot status-dot--yes" title="Pieza estructural">Sí</span>
                    ) : (
                      <span className="status-dot status-dot--no" title="Pieza no estructural">No</span>
                    )}
                  </td>
                  <td>
                    <span className="edgeband-cell">{bandedStr}</span>
                  </td>
                  <td>
                    {deflection ? (
                      deflection.hasWarning ? (
                        <span
                          className="m3-badge m3-badge--warning"
                          title={deflection.warningMessage}
                          data-testid={`deflection-warning-${piece.id}`}
                        >
                          {`⚠️ ${deflection.calculatedDeflectionMm.toFixed(2)} mm (máx ${deflection.allowableDeflectionMm.toFixed(2)} mm)`}
                        </span>
                      ) : (
                        <span
                          className="m3-badge m3-badge--success"
                          title={`Flecha: ${deflection.calculatedDeflectionMm.toFixed(2)} mm / límite admisible: ${deflection.allowableDeflectionMm.toFixed(2)} mm`}
                          data-testid={`deflection-ok-${piece.id}`}
                        >
                          {`✓ ${deflection.calculatedDeflectionMm.toFixed(2)} mm (ok)`}
                        </span>
                      )
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
