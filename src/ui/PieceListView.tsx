import { useState, type ReactElement } from 'react';
import type { ResolvedPieceWithCutSize, ShelfDeflectionResult, PieceEdgeBandOverride } from '../resolver';
import type { JointKind, JointStrategy, Material, EdgeBand } from '../model';
import { translatePieceRole } from './localization';

export interface PieceListViewProps {
  pieces: ResolvedPieceWithCutSize[];
  shelfDeflections?: Map<string, ShelfDeflectionResult>;
  selectedPieceId?: string | null;
  onSelectPiece?: (pieceId: string | null) => void;
  pieceJointOverrides?: Record<string, JointKind>;
  onSetPieceJointOverride?: (pieceId: string, jointKind: JointKind | null) => void;
  defaultJointStrategy?: JointStrategy;
  // Overrides & inspector props (Point 10)
  materials?: Material[];
  edgeBands?: EdgeBand[];
  pieceMaterialOverrides?: Record<string, string>;
  pieceThicknessOverrides?: Record<string, number>;
  pieceEdgeBandOverrides?: Record<string, PieceEdgeBandOverride>;
  onSetPieceMaterial?: (pieceId: string, materialId: string | null) => void;
  onSetPieceThickness?: (pieceId: string, thicknessMm: number | null) => void;
  onSetPieceEdgeBands?: (pieceId: string, overrides: PieceEdgeBandOverride | null) => void;
  // Machining modal (Point 8)
  onOpenMachiningModal?: (pieceId: string) => void;
}

/**
 * List view of resolved pieces with Argentine Spanish terminology and responsive M3 table.
 * Shows finished dimensions, cut dimensions, material filter, edge banding, and deflection checks.
 */
export function PieceListView(props: PieceListViewProps): ReactElement {
  const {
    pieces,
    shelfDeflections,
    selectedPieceId,
    onSelectPiece,
    pieceJointOverrides,
    onSetPieceJointOverride,
    defaultJointStrategy = 'confirmat',
    materials,
    edgeBands,
    pieceMaterialOverrides,
    pieceThicknessOverrides,
    pieceEdgeBandOverrides,
    onSetPieceMaterial,
    onSetPieceThickness,
    onSetPieceEdgeBands,
    onOpenMachiningModal,
  } = props;

  const [selectedMaterial, setSelectedMaterial] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grouped' | 'flat'>('grouped');

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

  const selectedPiece = pieces.find((p) => p.id === selectedPieceId) ?? null;

  const renderPiecesTable = (tablePieces: ResolvedPieceWithCutSize[]) => (
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
            <th>Fijación / Mecanizado</th>
          </tr>
        </thead>
        <tbody>
          {tablePieces.map((piece) => {
            const finishedStr = `${piece.dimensionsMm.width} x ${piece.dimensionsMm.height} mm`;
            const cutStr = `${piece.cutDimensionsMm.width} x ${piece.cutDimensionsMm.height} mm`;
            const bandedStr = piece.bandedEdges.length > 0
              ? piece.bandedEdges.map((b) => `${b.faceId} (${b.thicknessMm}mm)`).join(', ')
              : 'Sin tapacanto';

            const deflection = shelfDeflections?.get(piece.id);

            return (
              <tr
                key={piece.id}
                className={selectedPieceId === piece.id ? 'selected-piece-row' : ''}
                onClick={() => onSelectPiece?.(piece.id)}
                style={{ cursor: 'pointer' }}
              >
                <td>
                  <strong>{translatePieceRole(piece.role)}</strong>
                  <br />
                  <code className="piece-tag">{piece.id}</code>
                </td>
                <td>
                  <span className="m3-badge m3-badge--neutral">
                    {materials?.find((m) => m.id === piece.materialId)?.name ?? piece.materialId}
                  </span>
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
                <td onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <select
                      aria-label={`Fijación para ${piece.id}`}
                      className="m3-select"
                      style={{ fontSize: '0.8rem', padding: '0.2rem 0.4rem', minWidth: '130px' }}
                      value={pieceJointOverrides?.[piece.id] ?? ''}
                      onChange={(e) => {
                        const val = e.target.value as JointKind | '';
                        onSetPieceJointOverride?.(piece.id, val ? val : null);
                      }}
                    >
                      <option value="">Por defecto ({defaultJointStrategy})</option>
                      <option value="cam-dowel">Minifix (Oculto)</option>
                      <option value="dowel">Tarugos (Oculto)</option>
                      <option value="confirmat">Confirmat (Pasante)</option>
                      <option value="dowel-and-confirmat">Tarugos + Confirmat</option>
                      <option value="screw">Tornillos (Spax)</option>
                    </select>

                    {onOpenMachiningModal && (
                      <button
                        type="button"
                        className="m3-btn m3-btn--small m3-btn--tonal"
                        style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                        onClick={() => onOpenMachiningModal(piece.id)}
                      >
                        🛠️ Mecanizados
                      </button>
                    )}
                  </div>

                  {pieceJointOverrides?.[piece.id] && (
                    <div style={{ marginTop: '2px' }}>
                      <span className="m3-badge m3-badge--success" style={{ fontSize: '0.7rem' }}>
                        ✓ {pieceJointOverrides[piece.id]}
                      </span>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

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

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
          {uniqueMaterials.length > 1 && (
            <div className="material-filter-bar" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
                    {materials?.find((m) => m.id === matId)?.name ?? matId} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {selectedMaterial === 'all' && (
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button
                type="button"
                className={`m3-btn m3-btn--small ${viewMode === 'grouped' ? 'm3-btn--tonal' : 'm3-btn--text'}`}
                onClick={() => setViewMode('grouped')}
              >
                📁 Agrupar por Placa
              </button>
              <button
                type="button"
                className={`m3-btn m3-btn--small ${viewMode === 'flat' ? 'm3-btn--tonal' : 'm3-btn--text'}`}
                onClick={() => setViewMode('flat')}
              >
                📄 Lista Corrida
              </button>
            </div>
          )}
        </div>
      </div>

      {warningList.length > 0 && (
        <div className="m3-alert m3-alert--warning" role="alert" style={{ marginBottom: '1rem' }}>
          <span className="m3-alert__icon" aria-hidden="true">⚠️</span>
          <div>
            <strong>Aviso de flexión en estante:</strong> Se detectó deflexión superior al límite admisible en {warningList.length} estante(s). Verifique el vano o aumente el espesor.
          </div>
        </div>
      )}

      {/* Grouped by plate / material mode (Point 10) */}
      {viewMode === 'grouped' && selectedMaterial === 'all' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {uniqueMaterials.map((matId) => {
            const matPieces = pieces.filter((p) => p.materialId === matId);
            const matEdgeMeters = matPieces.reduce((acc, p) => {
              return acc + p.bandedEdges.reduce((bAcc, b) => bAcc + b.lengthMm / 1000, 0);
            }, 0);
            const matObj = materials?.find((m) => m.id === matId);

            return (
              <div
                key={matId}
                className="plate-group-card"
                style={{
                  background: '#ffffff',
                  borderRadius: '10px',
                  border: '1px solid #d3e3fd',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    background: '#f0f4f9',
                    borderBottom: '1px solid #e0e0e0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '0.5rem',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#041e49' }}>
                      🪵 Placa: {matObj?.name ?? matId}
                    </span>
                    <span style={{ fontSize: '0.85rem', color: '#444746', marginLeft: '0.5rem' }}>
                      (Espesor base: {matPieces[0]?.thicknessMm} mm)
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <span className="m3-badge m3-badge--neutral">
                      {matPieces.length} piezas de corte
                    </span>
                    <span className="m3-badge m3-badge--neutral">
                      Tapacantos: {matEdgeMeters.toFixed(2)} m
                    </span>
                  </div>
                </div>
                {renderPiecesTable(matPieces)}
              </div>
            );
          })}
        </div>
      ) : (
        renderPiecesTable(filteredPieces)
      )}

      {/* Selected Piece Inspector & Inline Property Editor (Point 10 & Point 8) */}
      {selectedPiece && (
        <div
          className="piece-selection-inspector"
          style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: '#f8fafd',
            border: '1px solid #c2e7ff',
            borderRadius: '10px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <h4 style={{ margin: 0, fontSize: '1rem', color: '#041e49' }}>
              🔧 Modificar Placa Seleccionada: <code>{selectedPiece.id}</code> (
              {translatePieceRole(selectedPiece.role)})
            </h4>
            <button
              type="button"
              className="m3-btn m3-btn--small m3-btn--outlined"
              onClick={() => onSelectPiece?.(null)}
            >
              Cerrar Inspector
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
            {/* Material */}
            <div>
              <label
                htmlFor={`list-material-override-${selectedPiece.id}`}
                style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}
              >
                🪵 Material:
              </label>
              <select
                id={`list-material-override-${selectedPiece.id}`}
                className="m3-select"
                style={{ width: '100%', fontSize: '0.85rem' }}
                value={pieceMaterialOverrides?.[selectedPiece.id] ?? selectedPiece.materialId}
                onChange={(e) => onSetPieceMaterial?.(selectedPiece.id, e.target.value || null)}
              >
                {materials?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name ?? m.id} ({m.thicknessMm} mm)
                  </option>
                ))}
              </select>
            </div>

            {/* Thickness */}
            <div>
              <label
                htmlFor={`list-thickness-override-${selectedPiece.id}`}
                style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}
              >
                📏 Espesor (mm):
              </label>
              <input
                id={`list-thickness-override-${selectedPiece.id}`}
                type="number"
                className="m3-input"
                style={{ width: '100%', fontSize: '0.85rem', padding: '0.35rem 0.5rem' }}
                min={3}
                max={50}
                value={pieceThicknessOverrides?.[selectedPiece.id] ?? selectedPiece.thicknessMm}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > 0) {
                    onSetPieceThickness?.(selectedPiece.id, val);
                  }
                }}
              />
            </div>

            {/* Edge Band Override */}
            <div>
              <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                🏷️ Cantos / Tapacantos:
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.35rem', fontSize: '0.8rem' }}>
                {(['top', 'bottom', 'left', 'right'] as const).map((edgeKey) => {
                  const label =
                    edgeKey === 'top'
                      ? 'Sup'
                      : edgeKey === 'bottom'
                      ? 'Inf'
                      : edgeKey === 'left'
                      ? 'Izq'
                      : 'Der';
                  const isBanded =
                    pieceEdgeBandOverrides?.[selectedPiece.id]?.[edgeKey] ??
                    selectedPiece.bandedEdges.some((b) => b.faceId.toLowerCase().includes(edgeKey));

                  return (
                    <label key={edgeKey} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={Boolean(isBanded)}
                        onChange={(e) => {
                          const current = pieceEdgeBandOverrides?.[selectedPiece.id] ?? {
                            top: selectedPiece.bandedEdges.some((b) => b.faceId.toLowerCase().includes('top')),
                            bottom: selectedPiece.bandedEdges.some((b) => b.faceId.toLowerCase().includes('bottom')),
                            left: selectedPiece.bandedEdges.some((b) => b.faceId.toLowerCase().includes('left')),
                            right: selectedPiece.bandedEdges.some((b) => b.faceId.toLowerCase().includes('right')),
                          };
                          onSetPieceEdgeBands?.(selectedPiece.id, {
                            ...current,
                            [edgeKey]: e.target.checked,
                          });
                        }}
                      />
                      {label}
                    </label>
                  );
                })}
              </div>
              {edgeBands && edgeBands.length > 0 && (
                <div style={{ marginTop: '0.35rem' }}>
                  <select
                    aria-label={`Tipo de tapacanto para ${selectedPiece.id}`}
                    className="m3-select"
                    style={{ width: '100%', fontSize: '0.75rem', padding: '0.2rem' }}
                    value={pieceEdgeBandOverrides?.[selectedPiece.id]?.edgeBandId ?? ''}
                    onChange={(e) => {
                      const current = pieceEdgeBandOverrides?.[selectedPiece.id] ?? {
                        top: selectedPiece.bandedEdges.some((b) => b.faceId.toLowerCase().includes('top')),
                        bottom: selectedPiece.bandedEdges.some((b) => b.faceId.toLowerCase().includes('bottom')),
                        left: selectedPiece.bandedEdges.some((b) => b.faceId.toLowerCase().includes('left')),
                        right: selectedPiece.bandedEdges.some((b) => b.faceId.toLowerCase().includes('right')),
                      };
                      onSetPieceEdgeBands?.(selectedPiece.id, {
                        ...current,
                        edgeBandId: e.target.value || undefined,
                      });
                    }}
                  >
                    <option value="">Por defecto del módulo</option>
                    {edgeBands.map((eb) => (
                      <option key={eb.id} value={eb.id}>
                        {eb.id} ({eb.thicknessMm} mm)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Machining Modal & Info */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '0.4rem' }}>
              <div style={{ fontSize: '0.8rem', color: '#444746' }}>
                Corte sierra: <strong>{selectedPiece.cutDimensionsMm.width} × {selectedPiece.cutDimensionsMm.height} mm</strong>
              </div>
              {onOpenMachiningModal && (
                <button
                  type="button"
                  className="m3-btn m3-btn--tonal"
                  style={{ width: '100%', fontSize: '0.85rem' }}
                  onClick={() => onOpenMachiningModal(selectedPiece.id)}
                >
                  🛠️ Mecanizados de Placa
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
