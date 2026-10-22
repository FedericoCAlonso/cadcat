import { useState, useMemo, useEffect, type ReactElement } from 'react';
import {
  type BayContent,
  type BayContentShelves,
  type BayContentDrawerStack,
  type TrackSize,
} from '../resolver/composition/types';
import {
  computeLeafCells,
  updateCellAtPath,
  splitCellAtPath,
  removeSplitAtPath,
  type CellBox,
} from '../resolver/composition/bayCellTree';

export interface BayDistributionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (content: BayContent) => void;
  bayIndex: number;
  bayWidth: number;
  bayHeight: number;
  bayDepth: number;
  initialContent: BayContent;
}

export function BayDistributionModal({
  isOpen,
  onClose,
  onApply,
  bayIndex,
  bayWidth,
  bayHeight,
  initialContent,
}: BayDistributionModalProps): ReactElement | null {
  // Working draft of the bay content tree
  const [draft, setDraft] = useState<BayContent>(initialContent);
  const [selectedPath, setSelectedPath] = useState<number[]>([]);

  // Sync draft when modal opens or initial content changes
  useEffect(() => {
    if (isOpen) {
      setDraft(initialContent);
      setSelectedPath([]);
    }
  }, [isOpen, initialContent]);

  // Compute leaf cells geometry
  const cells: CellBox[] = useMemo(() => {
    return computeLeafCells(draft, bayWidth, bayHeight, 18);
  }, [draft, bayWidth, bayHeight]);

  // Keep selected path valid
  useEffect(() => {
    if (cells.length === 0) return;
    const exists = cells.some(
      (c) => JSON.stringify(c.path) === JSON.stringify(selectedPath),
    );
    if (!exists && cells[0]) {
      setSelectedPath(cells[0].path);
    }
  }, [cells, selectedPath]);

  const selectedCell = useMemo(() => {
    return cells.find(
      (c) => JSON.stringify(c.path) === JSON.stringify(selectedPath),
    ) ?? cells[0];
  }, [cells, selectedPath]);

  if (!isOpen) return null;

  // Split selected cell horizontally (inserts horizontal shelf dividing Y)
  const handleSplitHorizontal = (topHeightMm?: number, thickness = 18) => {
    if (!selectedCell) return;
    const tracks: TrackSize[] = topHeightMm
      ? [
          { type: 'fixed', valueMm: topHeightMm },
          { type: 'fractional', valueFr: 1 },
        ]
      : [
          { type: 'fractional', valueFr: 1 },
          { type: 'fractional', valueFr: 1 },
        ];

    const updated = splitCellAtPath(
      draft,
      selectedCell.path,
      'vertical', // In gridSolver: 'vertical' axis places horizontal shelves dividing Y
      tracks,
      thickness,
    );
    setDraft(updated);
  };

  // Split selected cell vertically (inserts vertical partition dividing X)
  const handleSplitVertical = (columns = 2, thickness = 18) => {
    if (!selectedCell) return;
    const tracks: TrackSize[] = Array.from({ length: columns }, () => ({
      type: 'fractional',
      valueFr: 1,
    }));

    const updated = splitCellAtPath(
      draft,
      selectedCell.path,
      'horizontal', // In gridSolver: 'horizontal' axis places vertical partitions dividing X
      tracks,
      thickness,
      thickness <= 9 ? 'mat-plywood-guatambu-6' : undefined,
      thickness <= 9 ? 'dado-groove' : 'confirmat',
    );
    setDraft(updated);
  };

  // Remove subdivision / merge back
  const handleRemoveSplit = () => {
    if (!selectedCell || selectedCell.path.length === 0) {
      setDraft({ type: 'empty' });
      setSelectedPath([]);
      return;
    }
    const updated = removeSplitAtPath(draft, selectedCell.path);
    setDraft(updated);
    setSelectedPath([]);
  };

  // Update content of selected leaf cell
  const handleUpdateCellContent = (newContent: BayContent) => {
    if (!selectedCell) return;
    const updated = updateCellAtPath(draft, selectedCell.path, newContent);
    setDraft(updated);
  };

  const svgPadding = 20;
  const svgW = bayWidth + 2 * svgPadding;
  const svgH = bayHeight + 2 * svgPadding;

  return (
    <div
      className="m3-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bay-dist-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1200,
        padding: '1rem',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        className="m3-card"
        style={{
          width: '100%',
          maxWidth: '920px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--md-sys-color-surface)',
          color: 'var(--md-sys-color-on-surface)',
          borderRadius: 'var(--md-sys-shape-corner-lg)',
          boxShadow: 'var(--md-sys-elevation-3)',
          overflow: 'hidden',
          border: '1px solid var(--md-sys-color-outline-variant)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2
              id="bay-dist-title"
              style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--md-sys-color-primary)' }}
            >
              📐 Distribución Interior del Vano {bayIndex + 1}
            </h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              Luz libre interior: {bayWidth} mm (ancho) × {bayHeight} mm (alto)
            </span>
          </div>
          <button
            type="button"
            className="m3-icon-button"
            aria-label="Cerrar ventana"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              color: 'var(--md-sys-color-on-surface)',
              padding: '0.5rem',
              borderRadius: '50%',
            }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem',
            display: 'grid',
            gridTemplateColumns: 'minmax(300px, 1.2fr) minmax(280px, 1fr)',
            gap: '1.25rem',
          }}
        >
          {/* Left: 2D Interactive Canvas */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              backgroundColor: 'var(--md-sys-color-surface-container-low)',
              borderRadius: 'var(--md-sys-shape-corner-md)',
              padding: '1rem',
              border: '1px solid var(--md-sys-color-outline-variant)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--md-sys-color-on-surface)' }}>
                Croquis del Vano (Tocá una celda para editar)
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-primary)', fontStyle: 'italic' }}>
                {cells.length} {cells.length === 1 ? 'celda' : 'celdas'}
              </span>
            </div>

            {/* SVG Visual Matrix */}
            <div
              style={{
                flex: 1,
                minHeight: '260px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
                borderRadius: 'var(--md-sys-shape-corner-sm)',
                padding: '0.5rem',
                border: '1px solid var(--md-sys-color-outline-variant)',
              }}
            >
              <svg
                viewBox={`0 0 ${svgW} ${svgH}`}
                style={{
                  width: '100%',
                  maxHeight: '380px',
                  display: 'block',
                }}
              >
                {/* Structural bay perimeter outline */}
                <rect
                  x={svgPadding}
                  y={svgPadding}
                  width={bayWidth}
                  height={bayHeight}
                  fill="none"
                  stroke="var(--md-sys-color-outline)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                />

                {/* Render each leaf cell */}
                {cells.map((cell, idx) => {
                  const isSelected =
                    JSON.stringify(cell.path) === JSON.stringify(selectedPath);
                  const rx = svgPadding + cell.x;
                  const ry = svgPadding + cell.y;

                  // Label and icon for cell content
                  let icon = '⬜';
                  let label = 'Libre';
                  if (cell.content.type === 'shelves') {
                    icon = '📚';
                    label = `${cell.content.count} ${cell.content.count === 1 ? 'Estante' : 'Estantes'}`;
                  } else if (cell.content.type === 'drawer-stack') {
                    icon = '🗄️';
                    const count = cell.content.drawerTracks?.length ?? 1;
                    label = `${count} ${count === 1 ? 'Cajón' : 'Cajones'}`;
                  } else if (cell.content.type === 'doors') {
                    icon = '🚪';
                    label = `${cell.content.count} ${cell.content.count === 1 ? 'Puerta' : 'Puertas'}`;
                  }

                  return (
                    <g
                      key={`cell-${cell.path.join('-') || idx}`}
                      onClick={() => setSelectedPath(cell.path)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Cell box background */}
                      <rect
                        x={rx}
                        y={ry}
                        width={cell.width}
                        height={cell.height}
                        fill={
                          isSelected
                            ? 'var(--md-sys-color-primary-container)'
                            : 'var(--md-sys-color-surface-container)'
                        }
                        stroke={
                          isSelected
                            ? 'var(--md-sys-color-primary)'
                            : 'var(--md-sys-color-outline)'
                        }
                        strokeWidth={isSelected ? 3 : 1.5}
                        rx={4}
                      />

                      {/* Cell dimensions text */}
                      <text
                        x={rx + cell.width / 2}
                        y={ry + cell.height / 2 - 8}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="var(--md-sys-color-on-surface)"
                        fontSize={Math.max(12, Math.min(18, cell.width / 16))}
                        fontWeight="600"
                      >
                        {`${cell.width} × ${cell.height}`}
                      </text>

                      {/* Content icon & badge */}
                      <text
                        x={rx + cell.width / 2}
                        y={ry + cell.height / 2 + 14}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="var(--md-sys-color-on-surface-variant)"
                        fontSize={Math.max(10, Math.min(14, cell.width / 20))}
                      >
                        {`${icon} ${label}`}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)', textAlign: 'center' }}>
              💡 Cada línea entre celdas descuenta el espesor real de la placa y calcula los mecanizados automáticamente.
            </span>
          </div>

          {/* Right: Word-style Cell Tools & Equipment */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {/* Cell Info Banner */}
            {selectedCell && (
              <div
                style={{
                  padding: '0.75rem',
                  backgroundColor: 'var(--md-sys-color-surface-container-high)',
                  borderRadius: 'var(--md-sys-shape-corner-sm)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--md-sys-color-primary)' }}>
                  Celda Seleccionada
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '0.2rem' }}>
                  Luz interior: <strong>{selectedCell.width} mm ancho</strong> × <strong>{selectedCell.height} mm alto</strong>
                </div>
              </div>
            )}

            {/* Division Tools (Word table style) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                padding: '0.75rem',
                backgroundColor: 'var(--md-sys-color-surface-container-low)',
                borderRadius: 'var(--md-sys-shape-corner-sm)',
                border: '1px solid var(--md-sys-color-outline-variant)',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                ✂️ Dividir Celda (Estilo Tabla):
              </span>

              {/* Horizontal Split (Row / Shelf) */}
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="builder-chip-sm"
                  onClick={() => handleSplitHorizontal(undefined, 18)}
                  title="Divide horizontalmente al medio con estante de 18mm"
                >
                  ⬌ 2 Filas (50/50)
                </button>
                <button
                  type="button"
                  className="builder-chip-sm"
                  onClick={() => handleSplitHorizontal(150, 18)}
                  title="Fila superior de 150mm para cajonera"
                >
                  ⬌ Arriba 150mm (Cajones)
                </button>
                <button
                  type="button"
                  className="builder-chip-sm"
                  onClick={() => handleSplitHorizontal(undefined, 6)}
                  title="Estante fino de 6mm para casilleros"
                >
                  ⬌ Fino 6 mm Guatambú
                </button>
              </div>

              {/* Vertical Split (Column / Partition) */}
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                <button
                  type="button"
                  className="builder-chip-sm"
                  onClick={() => handleSplitVertical(2, 18)}
                  title="Divide verticalmente en 2 columnas con placa de 18mm"
                >
                  ⬍ 2 Columnas (18mm)
                </button>
                <button
                  type="button"
                  className="builder-chip-sm"
                  onClick={() => handleSplitVertical(3, 6)}
                  title="Divide verticalmente en 3 casilleros con Guatambú 6mm"
                >
                  ⬍ 3 Columnas (6mm Guatambú)
                </button>
                <button
                  type="button"
                  className="builder-chip-sm"
                  onClick={() => handleSplitVertical(2, 6)}
                  title="Divide verticalmente en 2 columnas con Guatambú 6mm"
                >
                  ⬍ 2 Col (6mm)
                </button>
              </div>

              {/* Merge / Un-split */}
              {selectedCell && selectedCell.path.length > 0 && (
                <button
                  type="button"
                  className="builder-chip-sm"
                  onClick={handleRemoveSplit}
                  style={{
                    marginTop: '0.35rem',
                    color: 'var(--md-sys-color-error)',
                    borderColor: 'var(--md-sys-color-error)',
                  }}
                >
                  🗑️ Quitar división (Unir celdas)
                </button>
              )}
            </div>

            {/* Cell Content Equipment (Touch & Equip) */}
            {selectedCell && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  backgroundColor: 'var(--md-sys-color-surface-container-low)',
                  borderRadius: 'var(--md-sys-shape-corner-sm)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                  📦 Equipar esta celda:
                </span>

                <div className="builder-chip-selector" role="group">
                  <button
                    type="button"
                    className={`builder-segmented-btn ${selectedCell.content.type === 'empty' ? 'selected' : ''}`}
                    onClick={() => handleUpdateCellContent({ type: 'empty' })}
                  >
                    ⬜ Libre
                  </button>
                  <button
                    type="button"
                    className={`builder-segmented-btn ${selectedCell.content.type === 'shelves' ? 'selected' : ''}`}
                    onClick={() =>
                      handleUpdateCellContent({
                        type: 'shelves',
                        count: 1,
                        shelfType: 'adjustable',
                        setbackMm: 15,
                      })
                    }
                  >
                    📚 Estante
                  </button>
                  <button
                    type="button"
                    className={`builder-segmented-btn ${selectedCell.content.type === 'drawer-stack' ? 'selected' : ''}`}
                    onClick={() =>
                      handleUpdateCellContent({
                        type: 'drawer-stack',
                        drawerTracks: [{ type: 'fractional', valueFr: 1 }],
                        frontMount: 'applied',
                        slideType: 'wood-runner',
                        drawerType: 'standard',
                      })
                    }
                  >
                    🗄️ Cajón
                  </button>
                  <button
                    type="button"
                    className={`builder-segmented-btn ${selectedCell.content.type === 'doors' ? 'selected' : ''}`}
                    onClick={() =>
                      handleUpdateCellContent({
                        type: 'doors',
                        count: 1,
                        mountType: 'full-overlay',
                      })
                    }
                  >
                    🚪 Puerta
                  </button>
                </div>

                {/* Sub-parameters for Shelves */}
                {selectedCell.content.type === 'shelves' && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem' }}>Cantidad de estantes:</span>
                    <div className="m3-stepper-field" style={{ maxWidth: '120px' }}>
                      <button
                        type="button"
                        className="m3-stepper-btn"
                        onClick={() => {
                          const currentShelves = selectedCell.content as BayContentShelves;
                          const nextCount = Math.max(1, currentShelves.count - 1);
                          handleUpdateCellContent({ ...currentShelves, count: nextCount });
                        }}
                      >
                        −
                      </button>
                      <div className="builder-stepper-display">
                        {(selectedCell.content as BayContentShelves).count}
                      </div>
                      <button
                        type="button"
                        className="m3-stepper-btn"
                        onClick={() => {
                          const currentShelves = selectedCell.content as BayContentShelves;
                          const nextCount = Math.min(8, currentShelves.count + 1);
                          handleUpdateCellContent({ ...currentShelves, count: nextCount });
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}

                {/* Sub-parameters for Drawers */}
                {selectedCell.content.type === 'drawer-stack' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem' }}>Cantidad de cajones:</span>
                      <div className="m3-stepper-field" style={{ maxWidth: '120px' }}>
                        <button
                          type="button"
                          className="m3-stepper-btn"
                          onClick={() => {
                            const ds = selectedCell.content as BayContentDrawerStack;
                            const nextTracks = ds.drawerTracks.length > 1
                              ? ds.drawerTracks.slice(0, -1)
                              : ds.drawerTracks;
                            handleUpdateCellContent({ ...ds, drawerTracks: nextTracks });
                          }}
                        >
                          −
                        </button>
                        <div className="builder-stepper-display">
                          {(selectedCell.content as BayContentDrawerStack).drawerTracks.length}
                        </div>
                        <button
                          type="button"
                          className="m3-stepper-btn"
                          onClick={() => {
                            const ds = selectedCell.content as BayContentDrawerStack;
                            const nextTracks = [...ds.drawerTracks, { type: 'fractional' as const, valueFr: 1 }];
                            handleUpdateCellContent({ ...ds, drawerTracks: nextTracks });
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem' }}>Deslizamiento:</span>
                      <div className="builder-segmented-btn-group">
                        <button
                          type="button"
                          className={`builder-segmented-btn ${(selectedCell.content as any).slideType === 'wood-runner' ? 'selected' : ''}`}
                          onClick={() =>
                            handleUpdateCellContent({
                              ...(selectedCell.content as any),
                              slideType: 'wood-runner',
                            })
                          }
                        >
                          🪵 Madera (4mm)
                        </button>
                        <button
                          type="button"
                          className={`builder-segmented-btn ${(selectedCell.content as any).slideType === 'telescopic' ? 'selected' : ''}`}
                          onClick={() =>
                            handleUpdateCellContent({
                              ...(selectedCell.content as any),
                              slideType: 'telescopic',
                            })
                          }
                        >
                          ⚙️ Telescópica
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderTop: '1px solid var(--md-sys-color-outline-variant)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            backgroundColor: 'var(--md-sys-color-surface-container-low)',
          }}
        >
          <button
            type="button"
            className="m3-btn-outlined"
            onClick={onClose}
            style={{
              padding: '0.6rem 1.25rem',
              borderRadius: 'var(--md-sys-shape-corner-full)',
              border: '1px solid var(--md-sys-color-outline)',
              backgroundColor: 'transparent',
              color: 'var(--md-sys-color-primary)',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="m3-btn-filled"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
            style={{
              padding: '0.6rem 1.5rem',
              borderRadius: 'var(--md-sys-shape-corner-full)',
              border: 'none',
              backgroundColor: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            💾 Aplicar al Vano
          </button>
        </div>
      </div>
    </div>
  );
}
