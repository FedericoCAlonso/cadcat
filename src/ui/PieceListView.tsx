import type { ReactElement } from 'react';
import type { ResolvedPieceWithCutSize } from '../resolver';

export interface PieceListViewProps {
  pieces: ResolvedPieceWithCutSize[];
}

/**
 * List view of resolved pieces.
 * Shows finished dimensions, cut dimensions, and edge banding for each piece.
 */
export function PieceListView(props: PieceListViewProps): ReactElement {
  const { pieces } = props;

  if (pieces.length === 0) {
    return (
      <section aria-labelledby="pieces-heading" className="piece-list-view">
        <h2 id="pieces-heading">Pieces</h2>
        <p>No pieces resolved. Adjust module parameters.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="pieces-heading" className="piece-list-view">
      <h2 id="pieces-heading">Pieces Cut List ({pieces.length})</h2>

      <table>
        <thead>
          <tr>
            <th>Role</th>
            <th>Finished (W x H)</th>
            <th>Cut Size (W x H)</th>
            <th>Thick</th>
            <th>Structural</th>
            <th>Edge Bands</th>
          </tr>
        </thead>
        <tbody>
          {pieces.map((piece) => {
            const finishedStr = `${piece.dimensionsMm.width} x ${piece.dimensionsMm.height} mm`;
            const cutStr = `${piece.cutDimensionsMm.width} x ${piece.cutDimensionsMm.height} mm`;
            const bandedStr = piece.bandedEdges.length > 0
              ? piece.bandedEdges.map((b) => `${b.faceId} (${b.thicknessMm}mm)`).join(', ')
              : 'None';

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
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
