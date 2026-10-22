import { useState, useMemo, useEffect, type ReactElement } from 'react';
import {
  type BayContent,
  type BayContentShelves,
  type BayContentDrawerStack,
  type TrackSize,
} from '../resolver/composition/types';
import {
  computeTreeGeometry,
  updateCellAtPath,
  updateDividerAtPath,
  distributeTracksEvenlyAtPath,
  splitCellAtPath,
  createMatrixGrid,
  removeSplitAtPath,
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

  // Selection mode: 'cell' or 'edge'
  const [selectionType, setSelectionType] = useState<'cell' | 'edge'>('cell');
  const [selectedPath, setSelectedPath] = useState<number[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Quick matrix generator inline view
  const [showMatrixCreator, setShowMatrixCreator] = useState(false);
  const [matrixRows, setMatrixRows] = useState(2);
  const [matrixCols, setMatrixCols] = useState(2);
  const [matrixThickness, setMatrixThickness] = useState(18);
  const [matrixContinuity, setMatrixContinuity] = useState<'horizontal-continuous' | 'vertical-continuous'>('horizontal-continuous');

  // Sync draft when modal opens or initial content changes
  useEffect(() => {
    if (isOpen) {
      setDraft(initialContent);
      setSelectionType('cell');
      setSelectedPath([]);
      setSelectedEdgeId(null);
      setShowMatrixCreator(false);
    }
  }, [isOpen, initialContent]);

  // Compute leaf cells & internal divider edges geometry
  const { cells, dividers } = useMemo(() => {
    return computeTreeGeometry(draft, bayWidth, bayHeight, 18);
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

  const selectedEdge = useMemo(() => {
    return dividers.find((d) => d.id === selectedEdgeId) ?? null;
  }, [dividers, selectedEdgeId]);

  if (!isOpen) return null;

  // Generate N x M matrix (Word-table initial grid generator)
  const handleGenerateMatrix = () => {
    const newGrid = createMatrixGrid(
      matrixRows,
      matrixCols,
      matrixContinuity,
      matrixThickness,
    );
    setDraft(newGrid);
    setSelectionType('cell');
    setSelectedPath([0]);
    setSelectedEdgeId(null);
    setShowMatrixCreator(false);
  };

  // Split selected cell into rows (inserts horizontal shelf dividing Y)
  const handleSplitRows = (topHeightMm?: number, thickness = 18) => {
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
    setSelectionType('cell');
  };

  // Split selected cell into columns (inserts vertical partition dividing X)
  const handleSplitColumns = (columns = 2, thickness = 18) => {
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
    setSelectionType('cell');
  };

  // Distribute tracks evenly (Word-style "Distribuir uniformemente")
  const handleDistributeEvenly = () => {
    if (selectionType === 'edge' && selectedEdge) {
      const updated = distributeTracksEvenlyAtPath(draft, selectedEdge.path);
      setDraft(updated);
    } else if (selectedCell && selectedCell.path.length > 0) {
      const parentPath = selectedCell.path.slice(0, -1);
      const updated = distributeTracksEvenlyAtPath(draft, parentPath);
      setDraft(updated);
    }
  };

  // Update properties of selected divider edge (arista)
  const handleUpdateSelectedEdge = (updates: {
    dividerThicknessMm?: number;
    jointType?: 'confirmat' | 'minifix' | 'dado-groove';
  }) => {
    if (!selectedEdge) return;
    const updated = updateDividerAtPath(draft, selectedEdge.path, updates);
    setDraft(updated);
  };

  // Remove divider edge / merge back
  const handleRemoveEdgeOrSplit = () => {
    if (selectionType === 'edge' && selectedEdge) {
      const updated = removeSplitAtPath(draft, selectedEdge.path);
      setDraft(updated);
      setSelectionType('cell');
      setSelectedEdgeId(null);
      setSelectedPath([]);
      return;
    }

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
          maxWidth: '960px',
          maxHeight: '94vh',
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
            gap: '1rem',
          }}
        >
          <div>
            <h2
              id="bay-dist-title"
              style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: 'var(--md-sys-color-primary)' }}
            >
              📐 Distribución Interior — Matriz de Celdas (Vano {bayIndex + 1})
            </h2>
            <span style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              Luz interior: {bayWidth} mm (ancho) × {bayHeight} mm (alto)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className={`builder-segmented-btn ${showMatrixCreator ? 'selected' : ''}`}
              onClick={() => setShowMatrixCreator((v) => !v)}
              title="Definir matriz inicial de filas y columnas estilo Word"
              style={{ fontSize: '0.85rem', padding: '0.45rem 0.85rem' }}
            >
              ▦ {showMatrixCreator ? 'Ocultar Creador' : 'Definir Matriz'}
            </button>
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
        </div>

        {/* Matrix Quick Creator Inline Bar */}
        {showMatrixCreator && (
          <div
            style={{
              padding: '0.75rem 1.25rem',
              backgroundColor: 'var(--md-sys-color-surface-container)',
              borderBottom: '1px solid var(--md-sys-color-outline-variant)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Filas:</span>
              <div className="m3-stepper-field" style={{ maxWidth: '100px' }}>
                <button
                  type="button"
                  className="m3-stepper-btn"
                  onClick={() => setMatrixRows((r) => Math.max(1, r - 1))}
                >
                  −
                </button>
                <div className="builder-stepper-display">{matrixRows}</div>
                <button
                  type="button"
                  className="m3-stepper-btn"
                  onClick={() => setMatrixRows((r) => Math.min(8, r + 1))}
                >
                  +
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Columnas:</span>
              <div className="m3-stepper-field" style={{ maxWidth: '100px' }}>
                <button
                  type="button"
                  className="m3-stepper-btn"
                  onClick={() => setMatrixCols((c) => Math.max(1, c - 1))}
                >
                  −
                </button>
                <div className="builder-stepper-display">{matrixCols}</div>
                <button
                  type="button"
                  className="m3-stepper-btn"
                  onClick={() => setMatrixCols((c) => Math.min(8, c + 1))}
                >
                  +
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Espesor:</span>
              <div className="builder-segmented-btn-group">
                {[18, 9, 6].map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`builder-segmented-btn ${matrixThickness === t ? 'selected' : ''}`}
                    onClick={() => setMatrixThickness(t)}
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                  >
                    {t}mm
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Estructura:</span>
              <div className="builder-segmented-btn-group">
                <button
                  type="button"
                  className={`builder-segmented-btn ${matrixContinuity === 'horizontal-continuous' ? 'selected' : ''}`}
                  onClick={() => setMatrixContinuity('horizontal-continuous')}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                  title="Estantes horizontales continuos de lado a lado"
                >
                  ⬌ Estante continuo
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${matrixContinuity === 'vertical-continuous' ? 'selected' : ''}`}
                  onClick={() => setMatrixContinuity('vertical-continuous')}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem' }}
                  title="Tabiques verticales continuos de piso a techo"
                >
                  ⬍ Tabique continuo
                </button>
              </div>
            </div>

            <button
              type="button"
              className="m3-btn-filled"
              onClick={handleGenerateMatrix}
              style={{
                fontSize: '0.85rem',
                padding: '0.45rem 1rem',
                borderRadius: 'var(--md-sys-shape-corner-full)',
                backgroundColor: 'var(--md-sys-color-primary)',
                color: 'var(--md-sys-color-on-primary)',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              ✓ Crear Matriz {matrixRows}×{matrixCols}
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.25rem',
            display: 'grid',
            gridTemplateColumns: 'minmax(320px, 1.25fr) minmax(300px, 1fr)',
            gap: '1.25rem',
          }}
        >
          {/* Left: 2D Interactive Blueprint Canvas */}
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
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface)' }}>
                Plano del Vano (Tocá una celda o una arista divisoria)
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-primary)' }}>
                {cells.length} {cells.length === 1 ? 'celda' : 'celdas'} · {dividers.length} {dividers.length === 1 ? 'arista' : 'aristas'}
              </span>
            </div>

            {/* SVG Interactive Blueprint */}
            <div
              style={{
                flex: 1,
                minHeight: '280px',
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
                  maxHeight: '400px',
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

                {/* 1. Render Leaf Cells */}
                {cells.map((cell, idx) => {
                  const isSelected =
                    selectionType === 'cell' &&
                    JSON.stringify(cell.path) === JSON.stringify(selectedPath);
                  const rx = svgPadding + cell.x;
                  const ry = svgPadding + cell.y;

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
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectionType('cell');
                        setSelectedPath(cell.path);
                        setSelectedEdgeId(null);
                      }}
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
                            : 'var(--md-sys-color-outline-variant)'
                        }
                        strokeWidth={isSelected ? 2.5 : 1}
                        rx={3}
                      />

                      {/* Cell Info / Icon */}
                      <text
                        x={rx + cell.width / 2}
                        y={ry + cell.height / 2 - 8}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={Math.min(22, Math.max(12, Math.min(cell.width, cell.height) * 0.22))}
                      >
                        {icon}
                      </text>

                      {/* Equipment Label */}
                      <text
                        x={rx + cell.width / 2}
                        y={ry + cell.height / 2 + 10}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={Math.min(12, Math.max(9, Math.min(cell.width, cell.height) * 0.12))}
                        fill="var(--md-sys-color-on-surface)"
                        fontWeight={500}
                      >
                        {label}
                      </text>

                      {/* Cell Dimensions mm */}
                      <text
                        x={rx + cell.width / 2}
                        y={ry + cell.height - 8}
                        textAnchor="middle"
                        dominantBaseline="auto"
                        fontSize={Math.min(11, Math.max(8, Math.min(cell.width, cell.height) * 0.1))}
                        fill="var(--md-sys-color-on-surface-variant)"
                      >
                        {cell.width} × {cell.height}
                      </text>
                    </g>
                  );
                })}

                {/* 2. Render Interactive Divider Edges (Aristas) */}
                {dividers.map((edge) => {
                  const isEdgeSelected =
                    selectionType === 'edge' && selectedEdgeId === edge.id;
                  const ex = svgPadding + edge.x;
                  const ey = svgPadding + edge.y;

                  // Minimum touch/click target of at least 14px for comfortable selection
                  const hitWidth = Math.max(edge.width, 14);
                  const hitHeight = Math.max(edge.height, 14);
                  const hitX = ex - (hitWidth - edge.width) / 2;
                  const hitY = ey - (hitHeight - edge.height) / 2;

                  const isThin = edge.thicknessMm <= 9;

                  return (
                    <g
                      key={edge.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectionType('edge');
                        setSelectedEdgeId(edge.id);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Invisible expanded hit area for ergonomic touch targets */}
                      <rect
                        x={hitX}
                        y={hitY}
                        width={hitWidth}
                        height={hitHeight}
                        fill="transparent"
                      />

                      {/* Real Board Thickness Divider */}
                      <rect
                        x={ex}
                        y={ey}
                        width={edge.width}
                        height={edge.height}
                        fill={
                          isEdgeSelected
                            ? '#f59e0b'
                            : isThin
                              ? '#d4a373'
                              : 'var(--md-sys-color-outline)'
                        }
                        stroke={
                          isEdgeSelected
                            ? '#b45309'
                            : 'var(--md-sys-color-surface-container-highest)'
                        }
                        strokeWidth={isEdgeSelected ? 2 : 0.5}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Quick Helper Legend */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              <span>💡 Hacé clic en una celda para equipar o dividir</span>
              <span>Hacé clic en una arista para cambiar espesor</span>
            </div>
          </div>

          {/* Right: Word-Style Inspector & Actions */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {/* Case A: An Edge (Arista) is selected */}
            {selectionType === 'edge' && selectedEdge && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem',
                  padding: '1rem',
                  backgroundColor: 'var(--md-sys-color-surface-container-low)',
                  borderRadius: 'var(--md-sys-shape-corner-md)',
                  border: '1.5px solid #f59e0b',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#b45309' }}>
                    📐 Arista Divisoria Seleccionada
                  </span>
                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '4px', fontWeight: 600 }}>
                    {selectedEdge.axis === 'horizontal' ? 'Tabique Vertical' : 'Estante Horizontal'}
                  </span>
                </div>

                {/* Thickness Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Espesor de placa:</span>
                  <div className="builder-chip-selector" role="group">
                    <button
                      type="button"
                      className={`builder-segmented-btn ${selectedEdge.thicknessMm === 18 ? 'selected' : ''}`}
                      onClick={() => handleUpdateSelectedEdge({ dividerThicknessMm: 18, jointType: 'confirmat' })}
                    >
                      18 mm (Melamina)
                    </button>
                    <button
                      type="button"
                      className={`builder-segmented-btn ${selectedEdge.thicknessMm === 9 ? 'selected' : ''}`}
                      onClick={() => handleUpdateSelectedEdge({ dividerThicknessMm: 9, jointType: 'dado-groove' })}
                    >
                      9 mm (Guatambú)
                    </button>
                    <button
                      type="button"
                      className={`builder-segmented-btn ${selectedEdge.thicknessMm === 6 ? 'selected' : ''}`}
                      onClick={() => handleUpdateSelectedEdge({ dividerThicknessMm: 6, jointType: 'dado-groove' })}
                    >
                      6 mm (Casillero)
                    </button>
                  </div>
                </div>

                {/* Joint Type Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Tipo de Ensamble:</span>
                  <div className="builder-segmented-btn-group">
                    <button
                      type="button"
                      className={`builder-segmented-btn ${selectedEdge.jointType !== 'dado-groove' ? 'selected' : ''}`}
                      onClick={() => handleUpdateSelectedEdge({ jointType: 'confirmat' })}
                    >
                      🔩 Confirmat / Tornillo
                    </button>
                    <button
                      type="button"
                      className={`builder-segmented-btn ${selectedEdge.jointType === 'dado-groove' ? 'selected' : ''}`}
                      onClick={() => handleUpdateSelectedEdge({ jointType: 'dado-groove' })}
                    >
                      🪵 Ranura Dado (4mm)
                    </button>
                  </div>
                </div>

                {/* Alignment & Actions */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    className="m3-btn-outlined"
                    onClick={handleDistributeEvenly}
                    style={{
                      flex: 1,
                      fontSize: '0.8rem',
                      padding: '0.5rem',
                      borderRadius: 'var(--md-sys-shape-corner-sm)',
                      cursor: 'pointer',
                    }}
                  >
                    ⇹ Alinear / Distribuir
                  </button>
                  <button
                    type="button"
                    className="m3-btn-outlined"
                    onClick={handleRemoveEdgeOrSplit}
                    style={{
                      fontSize: '0.8rem',
                      padding: '0.5rem 0.75rem',
                      color: 'var(--md-sys-color-error)',
                      borderColor: 'var(--md-sys-color-error)',
                      borderRadius: 'var(--md-sys-shape-corner-sm)',
                      cursor: 'pointer',
                    }}
                    title="Eliminar este divisor y combinar los espacios adyacentes"
                  >
                    🗑️ Quitar Arista
                  </button>
                </div>
              </div>
            )}

            {/* Case B: A Cell is selected */}
            {selectionType === 'cell' && selectedCell && (
              <>
                {/* Cell Split Actions (Word Table Operations) */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    padding: '0.85rem',
                    backgroundColor: 'var(--md-sys-color-surface-container-low)',
                    borderRadius: 'var(--md-sys-shape-corner-sm)',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      ✂️ Dividir Celda ({selectedCell.width} × {selectedCell.height} mm):
                    </span>
                    {selectedCell.path.length > 0 && (
                      <button
                        type="button"
                        onClick={handleRemoveEdgeOrSplit}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--md-sys-color-error)',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 500,
                        }}
                      >
                        🗑️ Unir a celda padre
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="builder-segmented-btn"
                      onClick={() => handleSplitRows()}
                      style={{ fontSize: '0.78rem', padding: '0.45rem' }}
                    >
                      ⬌ 2 Filas (50/50)
                    </button>
                    <button
                      type="button"
                      className="builder-segmented-btn"
                      onClick={() => handleSplitRows(150)}
                      style={{ fontSize: '0.78rem', padding: '0.45rem' }}
                    >
                      ⬌ Fila sup. 150mm
                    </button>
                    <button
                      type="button"
                      className="builder-segmented-btn"
                      onClick={() => handleSplitColumns(2, 18)}
                      style={{ fontSize: '0.78rem', padding: '0.45rem' }}
                    >
                      ⬍ 2 Columnas (18mm)
                    </button>
                    <button
                      type="button"
                      className="builder-segmented-btn"
                      onClick={() => handleSplitColumns(3, 6)}
                      style={{ fontSize: '0.78rem', padding: '0.45rem' }}
                    >
                      ⬍ 3 Casilleros (6mm)
                    </button>
                  </div>
                </div>

                {/* Equipment Inspector */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    padding: '0.85rem',
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
                          frontMount: 'inset', // Sin sobretapa por defecto en organizadores
                          slideType: 'wood-runner',
                          drawerType: 'simple-interior',
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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

                      {/* Deslizamiento */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Deslizamiento:</span>
                        <div className="builder-segmented-btn-group">
                          <button
                            type="button"
                            className={`builder-segmented-btn ${(selectedCell.content as BayContentDrawerStack).slideType === 'wood-runner' ? 'selected' : ''}`}
                            onClick={() => {
                              const ds = selectedCell.content as BayContentDrawerStack;
                              handleUpdateCellContent({
                                ...ds,
                                slideType: 'wood-runner',
                                frontMount: 'inset', // Sin sobretapa
                                drawerType: 'simple-interior',
                              });
                            }}
                          >
                            🪵 Madera (4mm)
                          </button>
                          <button
                            type="button"
                            className={`builder-segmented-btn ${(selectedCell.content as BayContentDrawerStack).slideType === 'telescopic' ? 'selected' : ''}`}
                            onClick={() => {
                              const ds = selectedCell.content as BayContentDrawerStack;
                              handleUpdateCellContent({
                                ...ds,
                                slideType: 'telescopic',
                                drawerType: 'standard',
                              });
                            }}
                          >
                            ⚙️ Telescópica (25.4mm)
                          </button>
                        </div>
                      </div>

                      {/* Frente / Sobretapa */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Frente del cajón:</span>
                        <div className="builder-segmented-btn-group">
                          <button
                            type="button"
                            className={`builder-segmented-btn ${(selectedCell.content as BayContentDrawerStack).frontMount === 'inset' ? 'selected' : ''}`}
                            onClick={() => {
                              const ds = selectedCell.content as BayContentDrawerStack;
                              handleUpdateCellContent({
                                ...ds,
                                frontMount: 'inset',
                                drawerType: 'simple-interior',
                              });
                            }}
                          >
                            🔲 Embutido (sin sobretapa)
                          </button>
                          <button
                            type="button"
                            className={`builder-segmented-btn ${(selectedCell.content as BayContentDrawerStack).frontMount === 'applied' ? 'selected' : ''}`}
                            onClick={() => {
                              const ds = selectedCell.content as BayContentDrawerStack;
                              handleUpdateCellContent({
                                ...ds,
                                frontMount: 'applied',
                                drawerType: 'standard',
                              });
                            }}
                          >
                            🔲 Con sobretapa aplicada
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
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
