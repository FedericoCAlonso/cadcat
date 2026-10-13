import type { ReactElement } from 'react';
import type { ResolvedPieceWithCutSize, ShelfDeflectionResult } from '../resolver';

export interface PieceListViewProps {
  pieces: ResolvedPieceWithCutSize[];
  shelfDeflections?: Map<string, ShelfDeflectionResult>;
}

/**
 * List view of resolved pieces.
 * Shows finished dimensions, cut dimensions, edge banding, and deflection checks for each piece.
 */
export function PieceListView(props: PieceListViewProps): ReactElement {
  const { pieces, shelfDeflections } = props;

  if (pieces.length === 0) {
    return (
      <section aria-labelledby="pieces-heading" className="m3-card piece-list-view">
        <h2 id="pieces-heading" className="m3-card__title">Pieces</h2>
        <p>No pieces resolved. Adjust module parameters.</p>
      </section>
    );
  }

  // Check if any shelf has an active deflection warning
  const warningList = pieces
    .map((p) => shelfDeflections?.get(p.id))
    .filter((d): d is ShelfDeflectionResult => d !== undefined && d.hasWarning);

  return (
    <section aria-labelledby="pieces-heading" className="m3-card piece-list-view">
      <div className="m3-card__header">
        <h2 id="pieces-heading" className="m3-card__title">Pieces Cut List ({pieces.length})</h2>
        <p className="m3-card__subtitle">
          List of resolved panels with finished dimensions, edge banding, and deflection checks.
        </p>
      </div>

      {warningList.length > 0 && (
        <div className="m3-alert m3-alert--warning" role="alert" style={{ marginBottom: '1rem' }}>
          <span className="m3-alert__icon" aria-hidden="true">⚠️</span>
          <div>
            <strong>Aviso de flexión en estante:</strong> Se detectó deflexión superior al límite admisible en {warningList.length} estante(s). Verifique el vano o aumente el espesor.
          </div>
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Role</th>
            <th>Finished (W x H)</th>
            <th>Cut Size (W x H)</th>
            <th>Thick</th>
            <th>Structural</th>
            <th>Edge Bands</th>
            <th>Deflexión / Estado</th>
          </tr>
        </thead>
        <tbody>
          {pieces.map((piece) => {
            const finishedStr = `${piece.dimensionsMm.width} x ${piece.dimensionsMm.height} mm`;
            const cutStr = `${piece.cutDimensionsMm.width} x ${piece.cutDimensionsMm.height} mm`;
            const bandedStr = piece.bandedEdges.length > 0
              ? piece.bandedEdges.map((b) => `${b.faceId} (${b.thicknessMm}mm)`).join(', ')
              : 'None';

            const deflection = shelfDeflections?.get(piece.id);

            return (
              <tr key={piece.id}>
                <td>
                  <strong>{piece.role}</strong>
                  <br />
                  <small>{piece.id}</small>
                </td>
                <td>{finishedStr}</td>
                <td>
                  <strong>{cutStr}</strong>
                </td>
                <td>{`${piece.thicknessMm} mm`}</td>
                <td>{piece.structural ? 'Yes' : 'No'}</td>
                <td>{bandedStr}</td>
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
                    <span className="m3-badge m3-badge--neutral">✓ OK</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
