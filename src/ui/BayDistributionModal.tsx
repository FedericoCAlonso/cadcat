import { useState, useMemo, useEffect, type ReactElement } from 'react';
import {
  type Material,
  DEFAULT_STANDARD_THICKNESSES_MM,
  filterMaterialsByThickness,
  getMaterialThicknessMm,
  listThicknessOptions,
} from '../model';
import {
  type BayContent,
  type BayContentSubdivided,
  type BayContentShelves,
  type BayContentDrawerStack,
  type BayContentDoors,
  type TrackSize,
  type DoorHingeType,
} from '../resolver/composition/types';
import {
  computeTreeGeometry,
  pathKey,
  updateCellsAtPaths,
  updateDividerAtPath,
  distributeTracksEvenlyAtPath,
  splitCellsAtPaths,
  createMatrixGrid,
  removeSplitAtPath,
  getCellAtPath,
  updateTrackAtPath,
  addTrackAtPath,
  removeTrackAtPath,
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
  materials?: readonly Material[];
  standardThicknessesMm?: readonly number[];
}

/** Minimum touch target edge (px) for mobile viewports (Material Design 3). */
const MOBILE_TOUCH_TARGET_PX = 48;
/** Max share of the viewport height the inline matrix creator may occupy on mobile. */
const MOBILE_MATRIX_BAR_MAX_HEIGHT = '45dvh';

export function BayDistributionModal({
  isOpen,
  onClose,
  onApply,
  bayIndex,
  bayWidth,
  bayHeight,
  bayDepth,
  initialContent,
  materials = [],
  standardThicknessesMm = DEFAULT_STANDARD_THICKNESSES_MM,
}: BayDistributionModalProps): ReactElement | null {
  // Working draft of the bay content tree
  const [draft, setDraft] = useState<BayContent>(initialContent);

  // Selection mode: 'cell' or 'edge'
  const [selectionType, setSelectionType] = useState<'cell' | 'edge'>('cell');
  const [selectedPaths, setSelectedPaths] = useState<number[][]>([[]]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState<boolean>(false);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Quick matrix generator inline view
  const [showMatrixCreator, setShowMatrixCreator] = useState(false);
  const [matrixRows, setMatrixRows] = useState(2);
  const [matrixCols, setMatrixCols] = useState(2);
  const [matrixThickness, setMatrixThickness] = useState(18);
  const [matrixContinuity, setMatrixContinuity] = useState<'horizontal-continuous' | 'vertical-continuous'>('horizontal-continuous');

  // Reactive mobile detection
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 640;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync draft when modal opens or initial content changes
  useEffect(() => {
    if (isOpen) {
      setDraft(initialContent);
      setSelectionType('cell');
      setSelectedPaths([[]]);
      setIsMultiSelectMode(false);
      setSelectedEdgeId(null);
      setShowMatrixCreator(false);
    }
  }, [isOpen, initialContent]);

  // Compute leaf cells & internal divider edges geometry
  const { cells, dividers } = useMemo(() => {
    return computeTreeGeometry(draft, bayWidth, bayHeight, 18);
  }, [draft, bayWidth, bayHeight]);

  // Keep selected paths valid against current leaf cells
  useEffect(() => {
    if (cells.length === 0) return;
    const validKeySet = new Set(cells.map((c) => pathKey(c.path)));
    const validSelected = selectedPaths.filter((p) => validKeySet.has(pathKey(p)));
    if (validSelected.length === 0 && cells[0]) {
      setSelectedPaths([cells[0].path]);
    } else if (validSelected.length !== selectedPaths.length) {
      setSelectedPaths(validSelected);
    }
  }, [cells, selectedPaths]);

  const selectedCells = useMemo(() => {
    const keySet = new Set(selectedPaths.map((p) => pathKey(p)));
    const matched = cells.filter((c) => keySet.has(pathKey(c.path)));
    if (matched.length > 0) return matched;
    return cells[0] ? [cells[0]] : [];
  }, [cells, selectedPaths]);

  const selectedCell = selectedCells[0] ?? cells[0];

  const selectedEdge = useMemo(() => {
    return dividers.find((d) => d.id === selectedEdgeId) ?? null;
  }, [dividers, selectedEdgeId]);

  const edgeSubdivided = useMemo(() => {
    if (!selectedEdge) return null;
    const node = getCellAtPath(draft, selectedEdge.path);
    if (!node || node.type !== 'subdivided') return null;
    return node as BayContentSubdivided;
  }, [draft, selectedEdge]);

  if (!isOpen) return null;

  const targetCellPaths = selectedCells.map((c) => c.path);

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
    setSelectedPaths([[0]]);
    setSelectedEdgeId(null);
    setShowMatrixCreator(false);
  };

  // Split selected cell(s) with custom arbitrary tracks (e.g. 100mm fixed + 70/30)
  const handleSplitCustom = (
    axis: 'horizontal' | 'vertical',
    tracks: TrackSize[],
    thickness = 18,
  ) => {
    if (targetCellPaths.length === 0) return;
    const updated = splitCellsAtPaths(
      draft,
      targetCellPaths,
      axis,
      tracks,
      thickness,
      thickness <= 9 ? 'mat-plywood-guatambu-6' : undefined,
      thickness <= 9 ? 'dado-groove' : 'confirmat',
    );
    setDraft(updated);
    setSelectionType('cell');
    setSelectedPaths(targetCellPaths.map((p) => [...p, 0]));
  };

  // Split selected cell(s) into rows (inserts horizontal shelf dividing Y)
  const handleSplitRows = (topHeightMm?: number, thickness = 18) => {
    if (targetCellPaths.length === 0) return;
    const tracks: TrackSize[] = topHeightMm
      ? [
          { type: 'fixed', valueMm: topHeightMm },
          { type: 'fractional', valueFr: 1 },
        ]
      : [
          { type: 'fractional', valueFr: 1 },
          { type: 'fractional', valueFr: 1 },
        ];

    const updated = splitCellsAtPaths(
      draft,
      targetCellPaths,
      'vertical', // In gridSolver: 'vertical' axis places horizontal shelves dividing Y
      tracks,
      thickness,
    );
    setDraft(updated);
    setSelectionType('cell');
    setSelectedPaths(targetCellPaths.map((p) => [...p, 0]));
  };

  // Split selected cell(s) into columns (inserts vertical partition dividing X)
  const handleSplitColumns = (columns = 2, thickness = 18) => {
    if (targetCellPaths.length === 0) return;
    const tracks: TrackSize[] = Array.from({ length: columns }, () => ({
      type: 'fractional',
      valueFr: 1,
    }));

    const updated = splitCellsAtPaths(
      draft,
      targetCellPaths,
      'horizontal', // In gridSolver: 'horizontal' axis places vertical partitions dividing X
      tracks,
      thickness,
      thickness <= 9 ? 'mat-plywood-guatambu-6' : undefined,
      thickness <= 9 ? 'dado-groove' : 'confirmat',
    );
    setDraft(updated);
    setSelectionType('cell');
    setSelectedPaths(targetCellPaths.map((p) => [...p, 0]));
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
    dividerMaterialId?: string;
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
      setSelectedPaths([[]]);
      return;
    }

    if (!selectedCell || selectedCell.path.length === 0) {
      setDraft({ type: 'empty' });
      setSelectedPaths([[]]);
      return;
    }
    const updated = removeSplitAtPath(draft, selectedCell.path);
    setDraft(updated);
    setSelectedPaths([[]]);
  };

  // Update content of all selected leaf cells in block
  const handleUpdateCellContent = (newContent: BayContent) => {
    if (targetCellPaths.length === 0) return;
    const updated = updateCellsAtPaths(draft, targetCellPaths, newContent);
    setDraft(updated);
  };

  // Normalized CAD viewport geometry so the blueprint never overflows on tall/wide bays
  const safeBayW = Math.max(100, bayWidth);
  const safeBayH = Math.max(100, bayHeight);
  const normScale = 320 / Math.max(safeBayW, safeBayH);
  const drawW = safeBayW * normScale;
  const drawH = safeBayH * normScale;
  const padX = 26;
  const padY = 22;
  const svgW = drawW + padX * 2;
  const svgH = drawH + padY * 2;
  const selectedKeySet = new Set(selectedCells.map((c) => pathKey(c.path)));

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
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'center',
        zIndex: 1200,
        padding: isMobile ? '0' : '1rem',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        className="m3-card"
        style={{
          width: '100%',
          maxWidth: isMobile ? '100vw' : '960px',
          maxHeight: isMobile ? '100dvh' : '94vh',
          height: isMobile ? '100dvh' : 'auto',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--md-sys-color-surface)',
          color: 'var(--md-sys-color-on-surface)',
          borderRadius: isMobile ? '0' : 'var(--md-sys-shape-corner-lg)',
          boxShadow: 'var(--md-sys-elevation-3)',
          overflow: 'hidden',
          border: isMobile ? 'none' : '1px solid var(--md-sys-color-outline-variant)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: isMobile ? '0.65rem 0.85rem' : '1rem 1.25rem',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            flexWrap: isMobile ? 'nowrap' : 'wrap',
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2
              id="bay-dist-title"
              style={{
                margin: 0,
                fontSize: isMobile ? '1rem' : '1.2rem',
                fontWeight: 600,
                color: 'var(--md-sys-color-primary)',
                lineHeight: 1.25,
              }}
            >
              📐 Distribución Interior (Vano {bayIndex + 1})
            </h2>
            <span style={{ fontSize: isMobile ? '0.75rem' : '0.85rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              Luz interior: {bayWidth} mm (ancho) × {bayHeight} mm (alto)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              className={`builder-segmented-btn ${showMatrixCreator ? 'selected' : ''}`}
              onClick={() => setShowMatrixCreator((v) => !v)}
              title="Definir matriz inicial de filas y columnas estilo Word"
              aria-label={showMatrixCreator ? 'Ocultar creador de matriz' : 'Definir matriz de filas y columnas'}
              style={{
                fontSize: '0.85rem',
                padding: '0.45rem 0.85rem',
                minHeight: isMobile ? `${MOBILE_TOUCH_TARGET_PX}px` : undefined,
                whiteSpace: 'nowrap',
              }}
            >
              ▦ {isMobile ? 'Matriz' : showMatrixCreator ? 'Ocultar Creador' : 'Definir Matriz'}
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
                minWidth: `${MOBILE_TOUCH_TARGET_PX}px`,
                minHeight: `${MOBILE_TOUCH_TARGET_PX}px`,
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
              padding: isMobile ? '0.65rem 0.85rem' : '0.75rem 1.25rem',
              backgroundColor: 'var(--md-sys-color-surface-container)',
              borderBottom: '1px solid var(--md-sys-color-outline-variant)',
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              flexWrap: 'wrap',
              gap: isMobile ? '0.6rem' : '1rem',
              alignItems: isMobile ? 'stretch' : 'center',
              maxHeight: isMobile ? MOBILE_MATRIX_BAR_MAX_HEIGHT : undefined,
              overflowY: isMobile ? 'auto' : undefined,
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: isMobile ? 'space-between' : undefined }}>
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: isMobile ? 'space-between' : undefined }}>
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: isMobile ? 'space-between' : undefined }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Espesor:</span>
              <div className="builder-segmented-btn-group">
                {listThicknessOptions(materials, standardThicknessesMm).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`builder-segmented-btn ${matrixThickness === t ? 'selected' : ''}`}
                    onClick={() => setMatrixThickness(t)}
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', minHeight: isMobile ? `${MOBILE_TOUCH_TARGET_PX}px` : undefined }}
                  >
                    {t}mm
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: isMobile ? 'space-between' : undefined }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Estructura:</span>
              <div className="builder-segmented-btn-group">
                <button
                  type="button"
                  className={`builder-segmented-btn ${matrixContinuity === 'horizontal-continuous' ? 'selected' : ''}`}
                  onClick={() => setMatrixContinuity('horizontal-continuous')}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', minHeight: isMobile ? `${MOBILE_TOUCH_TARGET_PX}px` : undefined }}
                  title="Estantes horizontales continuos de lado a lado"
                >
                  ⬌ Estante continuo
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${matrixContinuity === 'vertical-continuous' ? 'selected' : ''}`}
                  onClick={() => setMatrixContinuity('vertical-continuous')}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.65rem', minHeight: isMobile ? `${MOBILE_TOUCH_TARGET_PX}px` : undefined }}
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
                minHeight: isMobile ? `${MOBILE_TOUCH_TARGET_PX}px` : undefined,
                width: isMobile ? '100%' : undefined,
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
            padding: isMobile ? '0.65rem' : '1.25rem',
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'minmax(320px, 1.25fr) minmax(300px, 1fr)',
            gap: isMobile ? '0.75rem' : '1.25rem',
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
              padding: isMobile ? '0.65rem' : '1rem',
              border: '1px solid var(--md-sys-color-outline-variant)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface)' }}>
                Plano del Vano (Tocá una celda o una arista divisoria)
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-primary)', fontWeight: 600 }}>
                {cells.length} {cells.length === 1 ? 'celda' : 'celdas'} · {dividers.length} {dividers.length === 1 ? 'arista' : 'aristas'}
                {selectionType === 'cell' && selectedCells.length > 1 && (
                  <> · <strong style={{ color: 'var(--md-sys-color-tertiary, #0d9488)' }}>{selectedCells.length} seleccionadas</strong></>
                )}
              </span>
            </div>

            {/* Multi-Cell Block Selection Toolbar */}
            {cells.length > 1 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.4rem 0.55rem',
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  borderRadius: 'var(--md-sys-shape-corner-sm)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                }}
              >
                <button
                  type="button"
                  data-testid="toggle-multi-select"
                  aria-pressed={isMultiSelectMode}
                  onClick={() => setIsMultiSelectMode((prev) => !prev)}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.3rem 0.65rem',
                    minHeight: isMobile ? `${MOBILE_TOUCH_TARGET_PX}px` : undefined,
                    borderRadius: 'var(--md-sys-shape-corner-full)',
                    backgroundColor: isMultiSelectMode
                      ? 'var(--md-sys-color-primary)'
                      : 'var(--md-sys-color-surface)',
                    color: isMultiSelectMode
                      ? 'var(--md-sys-color-on-primary)'
                      : 'var(--md-sys-color-on-surface)',
                    border: '1px solid var(--md-sys-color-outline)',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {isMultiSelectMode ? '☑️ Selección Múltiple: ON' : '☐ Selección Múltiple'}
                </button>
                <button
                  type="button"
                  data-testid="select-all-cells"
                  onClick={() => {
                    setSelectionType('cell');
                    setSelectedEdgeId(null);
                    setIsMultiSelectMode(true);
                    setSelectedPaths(cells.map((c) => c.path));
                  }}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.3rem 0.6rem',
                    minHeight: isMobile ? `${MOBILE_TOUCH_TARGET_PX}px` : undefined,
                    borderRadius: 'var(--md-sys-shape-corner-full)',
                    backgroundColor: 'var(--md-sys-color-surface)',
                    color: 'var(--md-sys-color-primary)',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  ✓ Todas ({cells.length})
                </button>
                {cells.some((c) => c.content.type === 'empty') && (
                  <button
                    type="button"
                    data-testid="select-empty-cells"
                    onClick={() => {
                      const emptyPaths = cells
                        .filter((c) => c.content.type === 'empty')
                        .map((c) => c.path);
                      if (emptyPaths.length > 0) {
                        setSelectionType('cell');
                        setSelectedEdgeId(null);
                        setIsMultiSelectMode(emptyPaths.length > 1);
                        setSelectedPaths(emptyPaths);
                      }
                    }}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.3rem 0.6rem',
                      minHeight: isMobile ? `${MOBILE_TOUCH_TARGET_PX}px` : undefined,
                      borderRadius: 'var(--md-sys-shape-corner-full)',
                      backgroundColor: 'var(--md-sys-color-surface)',
                      color: 'var(--md-sys-color-on-surface)',
                      border: '1px solid var(--md-sys-color-outline-variant)',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    ⬜ Solo Libres
                  </button>
                )}
                {selectedCells.length > 1 && (
                  <button
                    type="button"
                    data-testid="clear-multi-select"
                    onClick={() => {
                      setIsMultiSelectMode(false);
                      setSelectedPaths(selectedCell ? [selectedCell.path] : []);
                    }}
                    style={{
                      fontSize: '0.74rem',
                      padding: '0.25rem 0.55rem',
                      minHeight: isMobile ? `${MOBILE_TOUCH_TARGET_PX}px` : undefined,
                      borderRadius: 'var(--md-sys-shape-corner-full)',
                      backgroundColor: 'transparent',
                      color: 'var(--md-sys-color-on-surface-variant)',
                      border: '1px dashed var(--md-sys-color-outline)',
                      cursor: 'pointer',
                      marginLeft: 'auto',
                    }}
                  >
                    ✕ Solo 1 celda
                  </button>
                )}
              </div>
            )}

            {/* SVG Interactive Blueprint — strictly contained, never overflows */}
            <div
              data-testid="bay-blueprint-canvas-container"
              style={{
                width: '100%',
                height: isMobile ? '220px' : '340px',
                minHeight: isMobile ? '190px' : '260px',
                maxHeight: isMobile ? '240px' : '380px',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
                borderRadius: 'var(--md-sys-shape-corner-sm)',
                padding: '0.4rem',
                border: '1px solid var(--md-sys-color-outline-variant)',
                boxSizing: 'border-box',
              }}
            >
              <svg
                data-testid="bay-blueprint-svg"
                viewBox={`0 0 ${svgW} ${svgH}`}
                preserveAspectRatio="xMidYMid meet"
                style={{
                  width: '100%',
                  height: '100%',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  display: 'block',
                  userSelect: 'none',
                }}
              >
                <defs>
                  {cells.map((cell, idx) => {
                    const clipId = `cell-clip-${cell.path.join('-') || idx}`;
                    const rx = padX + cell.x * normScale;
                    const ry = padY + cell.y * normScale;
                    const rw = Math.max(1, cell.width * normScale);
                    const rh = Math.max(1, cell.height * normScale);
                    return (
                      <clipPath key={clipId} id={clipId}>
                        <rect x={rx + 1.5} y={ry + 1.5} width={Math.max(1, rw - 3)} height={Math.max(1, rh - 3)} rx={3} />
                      </clipPath>
                    );
                  })}
                </defs>

                {/* Overall Bay Dimensions Annotation (Top & Left) */}
                <text
                  x={padX + drawW / 2}
                  y={Math.max(11, padY - 7)}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={600}
                  fill="var(--md-sys-color-on-surface-variant)"
                >
                  ↔ {Math.round(bayWidth)} mm
                </text>
                <text
                  x={Math.max(9, padX - 8)}
                  y={padY + drawH / 2}
                  textAnchor="middle"
                  fontSize={10}
                  fontWeight={600}
                  fill="var(--md-sys-color-on-surface-variant)"
                  transform={`rotate(-90, ${Math.max(9, padX - 8)}, ${padY + drawH / 2})`}
                >
                  ↕ {Math.round(bayHeight)} mm
                </text>

                {/* Structural bay perimeter outline */}
                <rect
                  x={padX}
                  y={padY}
                  width={drawW}
                  height={drawH}
                  fill="none"
                  stroke="var(--md-sys-color-outline)"
                  strokeWidth={1.75}
                  strokeDasharray="4 3"
                />

                {/* 1. Render Leaf Cells */}
                {cells.map((cell, idx) => {
                  const key = pathKey(cell.path);
                  const isSelected = selectionType === 'cell' && selectedKeySet.has(key);
                  const isPrimarySelected =
                    isSelected && selectedCell !== undefined && pathKey(selectedCell.path) === key;
                  const rx = padX + cell.x * normScale;
                  const ry = padY + cell.y * normScale;
                  const rw = Math.max(2, cell.width * normScale);
                  const rh = Math.max(2, cell.height * normScale);
                  const minDim = Math.min(rw, rh);
                  const clipId = `cell-clip-${cell.path.join('-') || idx}`;

                  let icon = '⬜';
                  let label = 'Libre';
                  if (cell.content.type === 'shelves') {
                    icon = '📚';
                    label = `${cell.content.count} ${cell.content.count === 1 ? 'Est.' : 'Est.'}`;
                  } else if (cell.content.type === 'drawer-stack') {
                    icon = '🗄️';
                    const count = cell.content.drawerTracks?.length ?? 1;
                    label = `${count} ${count === 1 ? 'Cajón' : 'Caj.'}`;
                  } else if (cell.content.type === 'doors') {
                    icon = '🚪';
                    label = `${cell.content.count} ${cell.content.count === 1 ? 'Pta.' : 'Ptas.'}`;
                  }

                  const showIcon = minDim >= 24;
                  const showLabel = rh >= 40 && rw >= 38;
                  const showDims = rh >= 56 && rw >= 44;
                  const iconFontSize = Math.min(18, Math.max(10, minDim * 0.24));
                  const labelFontSize = Math.min(10.5, Math.max(7.5, minDim * 0.13));
                  const dimFontSize = Math.min(9.5, Math.max(7, minDim * 0.11));

                  return (
                    <g
                      key={`cell-${cell.path.join('-') || idx}`}
                      data-testid={`bay-cell-${cell.path.join('-') || 'root'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        const additive =
                          isMultiSelectMode || e.ctrlKey || e.metaKey || e.shiftKey;
                        setSelectionType('cell');
                        setSelectedEdgeId(null);
                        if (additive) {
                          setSelectedPaths((prev) => {
                            const exists = prev.some((p) => pathKey(p) === key);
                            if (exists) {
                              return prev.length > 1
                                ? prev.filter((p) => pathKey(p) !== key)
                                : prev;
                            }
                            return [...prev, cell.path];
                          });
                        } else {
                          setSelectedPaths([cell.path]);
                        }
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Cell box background */}
                      <rect
                        x={rx}
                        y={ry}
                        width={rw}
                        height={rh}
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
                        strokeWidth={isPrimarySelected ? 2.5 : isSelected ? 2 : 1}
                        rx={3}
                      />

                      {/* Clipped interior text & badges so nothing ever overflows cell boundaries */}
                      <g clipPath={`url(#${clipId})`}>
                        {/* Multi-select Check Badge */}
                        {isSelected && (selectedCells.length > 1 || isMultiSelectMode) && minDim >= 22 && (
                          <g>
                            <circle
                              cx={rx + Math.min(11, rw * 0.22)}
                              cy={ry + Math.min(11, rh * 0.22)}
                              r={Math.min(7.5, minDim * 0.16)}
                              fill="var(--md-sys-color-primary)"
                            />
                            <text
                              x={rx + Math.min(11, rw * 0.22)}
                              y={ry + Math.min(11, rh * 0.22)}
                              textAnchor="middle"
                              dominantBaseline="central"
                              fontSize={Math.min(9, minDim * 0.18)}
                              fill="var(--md-sys-color-on-primary)"
                              fontWeight={700}
                            >
                              ✓
                            </text>
                          </g>
                        )}

                        {/* Cell Info / Icon */}
                        {showIcon && (
                          <text
                            x={rx + rw / 2}
                            y={
                              showLabel
                                ? ry + rh / 2 - labelFontSize * 0.75
                                : ry + rh / 2
                            }
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize={iconFontSize}
                          >
                            {icon}
                          </text>
                        )}

                        {/* Equipment Label */}
                        {showLabel && (
                          <text
                            x={rx + rw / 2}
                            y={ry + rh / 2 + iconFontSize * 0.45}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize={labelFontSize}
                            fill="var(--md-sys-color-on-surface)"
                            fontWeight={600}
                          >
                            {label}
                          </text>
                        )}

                        {/* Cell Dimensions mm */}
                        {showDims && (
                          <text
                            x={rx + rw / 2}
                            y={ry + rh - 5}
                            textAnchor="middle"
                            dominantBaseline="auto"
                            fontSize={dimFontSize}
                            fill="var(--md-sys-color-on-surface-variant)"
                          >
                            {Math.round(cell.width)}×{Math.round(cell.height)}
                          </text>
                        )}
                      </g>
                    </g>
                  );
                })}

                {/* 2. Render Interactive Divider Edges (Aristas) */}
                {dividers.map((edge) => {
                  const isEdgeSelected =
                    selectionType === 'edge' && selectedEdgeId === edge.id;
                  const ex = padX + edge.x * normScale;
                  const ey = padY + edge.y * normScale;
                  const ew = Math.max(2.5, edge.width * normScale);
                  const eh = Math.max(2.5, edge.height * normScale);

                  // Minimum touch/click target in normalized SVG units
                  const hitWidth = Math.max(ew, 12);
                  const hitHeight = Math.max(eh, 12);
                  const hitX = ex - (hitWidth - ew) / 2;
                  const hitY = ey - (hitHeight - eh) / 2;

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
                        width={ew}
                        height={eh}
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
                        strokeWidth={isEdgeSelected ? 1.8 : 0.5}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Quick Helper Legend */}
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.35rem', fontSize: '0.74rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              <span>💡 Clic o ☑️ Selección Múltiple (Ctrl/Shift+Clic) para configurar en bloque</span>
              <span>Clic en arista para cambiar espesor</span>
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

                {/* Thickness & Plate Selector (standard thicknesses first; filters matching plates) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Espesor de placa:</span>
                  <div className="builder-chip-selector" role="group">
                    {listThicknessOptions(materials, standardThicknessesMm).map((t) => {
                      const matching = filterMaterialsByThickness(materials, t);
                      return (
                        <button
                          key={t}
                          type="button"
                          className={`builder-segmented-btn ${selectedEdge.thicknessMm === t ? 'selected' : ''}`}
                          onClick={() =>
                            handleUpdateSelectedEdge({
                              dividerThicknessMm: t,
                              jointType: t <= 9 ? 'dado-groove' : 'confirmat',
                              dividerMaterialId: matching[0]?.id ?? selectedEdge.materialId,
                            })
                          }
                          style={{ minHeight: isMobile ? `${MOBILE_TOUCH_TARGET_PX}px` : undefined }}
                        >
                          {t} mm
                        </button>
                      );
                    })}
                  </div>
                  {materials.length > 0 && (
                    <div style={{ marginTop: '0.25rem' }}>
                      <label
                        htmlFor="bay-divider-plate-select"
                        style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }}
                      >
                        Placa del divisor ({selectedEdge.thicknessMm} mm):
                      </label>
                      <select
                        id="bay-divider-plate-select"
                        className="m3-select"
                        value={
                          selectedEdge.materialId ??
                          filterMaterialsByThickness(materials, selectedEdge.thicknessMm)[0]?.id ??
                          ''
                        }
                        onChange={(e) => {
                          const picked = materials.find((m) => m.id === e.target.value);
                          const nextT = getMaterialThicknessMm(picked) ?? selectedEdge.thicknessMm;
                          handleUpdateSelectedEdge({
                            dividerMaterialId: e.target.value || undefined,
                            dividerThicknessMm: nextT,
                            jointType: nextT <= 9 ? 'dado-groove' : 'confirmat',
                          });
                        }}
                        style={{
                          width: '100%',
                          fontSize: '0.85rem',
                          minHeight: isMobile ? `${MOBILE_TOUCH_TARGET_PX}px` : undefined,
                        }}
                      >
                        {filterMaterialsByThickness(materials, selectedEdge.thicknessMm).length === 0 && (
                          <option value={selectedEdge.materialId ?? ''}>
                            Sin placas de {selectedEdge.thicknessMm} mm en el catálogo
                          </option>
                        )}
                        {filterMaterialsByThickness(materials, selectedEdge.thicknessMm).map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name ?? m.id} ({m.thicknessMm} mm)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
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

                {/* Track Inspector: Cotas y Pistas de este Eje */}
                {edgeSubdivided && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      marginTop: '0.65rem',
                      paddingTop: '0.65rem',
                      borderTop: '1px solid var(--md-sys-color-outline-variant)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                        📏 Pistas y Cotas ({selectedEdge.axis === 'horizontal' ? 'Columnas' : 'Filas'}):
                      </span>
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: '1px solid var(--md-sys-color-primary)',
                          color: 'var(--md-sys-color-primary)',
                          fontSize: '0.72rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 500,
                        }}
                        onClick={() => {
                          const next = addTrackAtPath(draft, selectedEdge.path);
                          setDraft(next);
                        }}
                      >
                        + Agregar División
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {edgeSubdivided.tracks.map((track, tIdx) => {
                        const isFixed = track.type === 'fixed';
                        const isSelectedTrack =
                          selectedEdge.dividerIndex === tIdx ||
                          selectedEdge.dividerIndex === tIdx - 1;

                        return (
                          <div
                            key={`track-${tIdx}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              padding: '0.35rem 0.5rem',
                              backgroundColor: isSelectedTrack
                                ? 'var(--md-sys-color-surface-container)'
                                : 'var(--md-sys-color-surface)',
                              borderRadius: 'var(--md-sys-shape-corner-xs)',
                              border: isSelectedTrack
                                ? '1px solid #f59e0b'
                                : '1px solid var(--md-sys-color-outline-variant)',
                              fontSize: '0.78rem',
                            }}
                          >
                            <span style={{ fontWeight: 600, minWidth: '32px' }}>
                              #{tIdx + 1}:
                            </span>

                            <div className="builder-segmented-btn-group" style={{ flex: '0 0 auto' }}>
                              <button
                                type="button"
                                className={`builder-segmented-btn ${isFixed ? 'selected' : ''}`}
                                style={{ fontSize: '0.7rem', padding: '0.15rem 0.35rem' }}
                                onClick={() => {
                                  const next = updateTrackAtPath(
                                    draft,
                                    selectedEdge.path,
                                    tIdx,
                                    { type: 'fixed', valueMm: 100 },
                                  );
                                  setDraft(next);
                                }}
                              >
                                Fijo mm
                              </button>
                              <button
                                type="button"
                                className={`builder-segmented-btn ${!isFixed ? 'selected' : ''}`}
                                style={{ fontSize: '0.7rem', padding: '0.15rem 0.35rem' }}
                                onClick={() => {
                                  const next = updateTrackAtPath(
                                    draft,
                                    selectedEdge.path,
                                    tIdx,
                                    { type: 'fractional', valueFr: 1 },
                                  );
                                  setDraft(next);
                                }}
                              >
                                Proporc.
                              </button>
                            </div>

                            <input
                              type="number"
                              style={{
                                width: isFixed ? '60px' : '45px',
                                padding: '0.2rem 0.35rem',
                                fontSize: '0.78rem',
                                borderRadius: '4px',
                                border: '1px solid var(--md-sys-color-outline)',
                                textAlign: 'right',
                              }}
                              value={isFixed ? track.valueMm : track.valueFr}
                              min={1}
                              step={isFixed ? 10 : 1}
                              onChange={(e) => {
                                const val = Math.max(1, parseFloat(e.target.value) || 1);
                                const nextTrack: TrackSize = isFixed
                                  ? { type: 'fixed', valueMm: val }
                                  : { type: 'fractional', valueFr: val };
                                const next = updateTrackAtPath(
                                  draft,
                                  selectedEdge.path,
                                  tIdx,
                                  nextTrack,
                                );
                                setDraft(next);
                              }}
                            />
                            <span
                              style={{
                                color: 'var(--md-sys-color-on-surface-variant)',
                                fontSize: '0.72rem',
                              }}
                            >
                              {isFixed ? 'mm' : 'fr'}
                            </span>

                            {edgeSubdivided.tracks.length > 1 && (
                              <button
                                type="button"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--md-sys-color-error)',
                                  cursor: 'pointer',
                                  fontSize: '0.8rem',
                                  marginLeft: 'auto',
                                }}
                                onClick={() => {
                                  const next = removeTrackAtPath(
                                    draft,
                                    selectedEdge.path,
                                    tIdx,
                                  );
                                  setDraft(next);
                                }}
                                title="Eliminar esta pista"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Case B: One or Multiple Cells are selected */}
            {selectionType === 'cell' && selectedCell && (
              <>
                {/* Block Configuration Banner when multiple cells are selected */}
                {selectedCells.length > 1 && (
                  <div
                    data-testid="batch-selection-banner"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.6rem 0.85rem',
                      backgroundColor: 'var(--md-sys-color-primary-container)',
                      color: 'var(--md-sys-color-on-primary-container)',
                      borderRadius: 'var(--md-sys-shape-corner-sm)',
                      border: '1.5px solid var(--md-sys-color-primary)',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                    }}
                  >
                    <span>
                      ☑️ Configurando en Bloque: {selectedCells.length} de {cells.length} celdas seleccionadas
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMultiSelectMode(false);
                        setSelectedPaths([selectedCell.path]);
                      }}
                      style={{
                        fontSize: '0.74rem',
                        padding: '0.2rem 0.55rem',
                        borderRadius: 'var(--md-sys-shape-corner-full)',
                        backgroundColor: 'var(--md-sys-color-surface)',
                        color: 'var(--md-sys-color-on-surface)',
                        border: '1px solid var(--md-sys-color-outline)',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      Desagrupar
                    </button>
                  </div>
                )}

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
                      {selectedCells.length > 1
                        ? `✂️ Dividir ${selectedCells.length} Celdas en Bloque:`
                        : `✂️ Dividir Celda (${selectedCell.width} × ${selectedCell.height} mm):`}
                    </span>
                    {selectedCells.length === 1 && selectedCell.path.length > 0 && (
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
                    <button
                      type="button"
                      className="builder-segmented-btn"
                      onClick={() =>
                        handleSplitCustom('horizontal', [
                          { type: 'fixed', valueMm: 100 },
                          { type: 'fractional', valueFr: 7 },
                          { type: 'fractional', valueFr: 3 },
                        ])
                      }
                      style={{ fontSize: '0.78rem', padding: '0.45rem', gridColumn: 'span 2' }}
                    >
                      ⬍ 100mm fijo + 70% / 30% proporcional
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
                    {selectedCells.length > 1
                      ? `📦 Equipar ${selectedCells.length} Celdas en Bloque:`
                      : '📦 Equipar esta celda:'}
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

                      {/* Deslizamiento y Correderas */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Sistema de deslizamiento:</span>
                        <div className="builder-segmented-btn-group">
                          <button
                            type="button"
                            className={`builder-segmented-btn ${(selectedCell.content as BayContentDrawerStack).slideType === 'wood-runner' ? 'selected' : ''}`}
                            onClick={() => {
                              const ds = selectedCell.content as BayContentDrawerStack;
                              handleUpdateCellContent({
                                ...ds,
                                slideType: 'wood-runner',
                              });
                            }}
                          >
                            🪵 Madera (4mm)
                          </button>
                          <button
                            type="button"
                            className={`builder-segmented-btn ${(selectedCell.content as BayContentDrawerStack).slideType === 'telescopic' || !(selectedCell.content as BayContentDrawerStack).slideType ? 'selected' : ''}`}
                            onClick={() => {
                              const ds = selectedCell.content as BayContentDrawerStack;
                              handleUpdateCellContent({
                                ...ds,
                                slideType: 'telescopic',
                              });
                            }}
                          >
                            ⚙️ Telescópica (25.4mm)
                          </button>
                          <button
                            type="button"
                            className={`builder-segmented-btn ${(selectedCell.content as BayContentDrawerStack).slideType === 'undermount' ? 'selected' : ''}`}
                            onClick={() => {
                              const ds = selectedCell.content as BayContentDrawerStack;
                              handleUpdateCellContent({
                                ...ds,
                                slideType: 'undermount',
                              });
                            }}
                          >
                            🔻 Oculta (10mm)
                          </button>
                        </div>
                      </div>

                      {/* Medida de Corredera / Profundidad de Caja */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                          Medida comercial de corredera / profundidad:
                        </span>
                        <div className="builder-chip-selector" role="group" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          <button
                            type="button"
                            className={`builder-segmented-btn ${!(selectedCell.content as BayContentDrawerStack).boxDepthMm ? 'selected' : ''}`}
                            style={{ height: '30px', padding: '0 0.5rem', fontSize: '0.76rem' }}
                            onClick={() => {
                              const ds = selectedCell.content as BayContentDrawerStack;
                              const updated = { ...ds };
                              delete updated.boxDepthMm;
                              handleUpdateCellContent(updated);
                            }}
                          >
                            Auto ({Math.max(50, bayDepth - (bayDepth <= 350 ? 20 : 50))}mm)
                          </button>
                          {[250, 300, 350, 400, 450, 500, 550, 600]
                            .filter((len) => len <= bayDepth)
                            .map((len) => (
                              <button
                                key={len}
                                type="button"
                                className={`builder-segmented-btn ${(selectedCell.content as BayContentDrawerStack).boxDepthMm === len ? 'selected' : ''}`}
                                style={{ height: '30px', padding: '0 0.5rem', fontSize: '0.76rem' }}
                                onClick={() => {
                                  const ds = selectedCell.content as BayContentDrawerStack;
                                  handleUpdateCellContent({
                                    ...ds,
                                    boxDepthMm: len,
                                  });
                                }}
                              >
                                {len} mm
                              </button>
                            ))}
                        </div>
                      </div>

                      {/* Tipo de Tapa / Frente (Estructura) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Tipo de tapa (Estructura):</span>
                        <div className="builder-segmented-btn-group">
                          <button
                            type="button"
                            className={`builder-segmented-btn ${(selectedCell.content as BayContentDrawerStack).drawerType !== 'simple-interior' ? 'selected' : ''}`}
                            onClick={() => {
                              const ds = selectedCell.content as BayContentDrawerStack;
                              handleUpdateCellContent({
                                ...ds,
                                drawerType: 'standard',
                              });
                            }}
                          >
                            🔲 Tapa Doble (Frente postizo)
                          </button>
                          <button
                            type="button"
                            className={`builder-segmented-btn ${(selectedCell.content as BayContentDrawerStack).drawerType === 'simple-interior' ? 'selected' : ''}`}
                            onClick={() => {
                              const ds = selectedCell.content as BayContentDrawerStack;
                              handleUpdateCellContent({
                                ...ds,
                                drawerType: 'simple-interior',
                              });
                            }}
                          >
                            🔲 Tapa Simple (Estructural)
                          </button>
                        </div>
                      </div>

                      {/* Posición del Frente (Montaje) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Posición del frente (Montaje):</span>
                        <div className="builder-segmented-btn-group">
                          <button
                            type="button"
                            className={`builder-segmented-btn ${(selectedCell.content as BayContentDrawerStack).frontMount === 'applied' || !(selectedCell.content as BayContentDrawerStack).frontMount ? 'selected' : ''}`}
                            onClick={() => {
                              const ds = selectedCell.content as BayContentDrawerStack;
                              handleUpdateCellContent({
                                ...ds,
                                frontMount: 'applied',
                              });
                            }}
                          >
                            🔲 Aplicado (Solapado)
                          </button>
                          <button
                            type="button"
                            className={`builder-segmented-btn ${(selectedCell.content as BayContentDrawerStack).frontMount === 'inset' ? 'selected' : ''}`}
                            onClick={() => {
                              const ds = selectedCell.content as BayContentDrawerStack;
                              handleUpdateCellContent({
                                ...ds,
                                frontMount: 'inset',
                              });
                            }}
                          >
                            🔲 Embutido a la luz
                          </button>
                        </div>
                      </div>

                      {/* Construcción del Fondo */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Construcción del fondo:</span>
                        <div className="builder-segmented-btn-group">
                          <button
                            type="button"
                            className={`builder-segmented-btn ${!(selectedCell.content as BayContentDrawerStack).bottomMount || (selectedCell.content as BayContentDrawerStack).bottomMount === 'bottom-screwed' ? 'selected' : ''}`}
                            onClick={() => {
                              const ds = selectedCell.content as BayContentDrawerStack;
                              handleUpdateCellContent({
                                ...ds,
                                bottomMount: 'bottom-screwed',
                              });
                            }}
                          >
                            Atornillado/Clavado
                          </button>
                          <button
                            type="button"
                            className={`builder-segmented-btn ${(selectedCell.content as BayContentDrawerStack).bottomMount === 'grooved' ? 'selected' : ''}`}
                            onClick={() => {
                              const ds = selectedCell.content as BayContentDrawerStack;
                              handleUpdateCellContent({
                                ...ds,
                                bottomMount: 'grooved',
                              });
                            }}
                          >
                            Ranurado (3-6mm)
                          </button>
                          <button
                            type="button"
                            className={`builder-segmented-btn ${(selectedCell.content as BayContentDrawerStack).bottomMount === 'flush-thick' ? 'selected' : ''}`}
                            onClick={() => {
                              const ds = selectedCell.content as BayContentDrawerStack;
                              handleUpdateCellContent({
                                ...ds,
                                bottomMount: 'flush-thick',
                              });
                            }}
                          >
                            Grueso al ras (15/18mm)
                          </button>
                        </div>
                      </div>

                      {/* Faja Compensatoria Lateral (Anti-colisión de bisagras) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                          Faja compensatoria (cajones tras puertas batientes):
                        </span>
                        <div className="builder-segmented-btn-group">
                          <button
                            type="button"
                            className={`builder-segmented-btn ${!(selectedCell.content as BayContentDrawerStack).hasHingeSpacer ? 'selected' : ''}`}
                            onClick={() => {
                              const ds = selectedCell.content as BayContentDrawerStack;
                              handleUpdateCellContent({ ...ds, hasHingeSpacer: false });
                            }}
                          >
                            Ninguna
                          </button>
                          <button
                            type="button"
                            className={`builder-segmented-btn ${(selectedCell.content as BayContentDrawerStack).hasHingeSpacer && (selectedCell.content as BayContentDrawerStack).hingeSpacerSide !== 'right' ? 'selected' : ''}`}
                            onClick={() => {
                              const ds = selectedCell.content as BayContentDrawerStack;
                              handleUpdateCellContent({
                                ...ds,
                                hasHingeSpacer: true,
                                hingeSpacerSide: 'left',
                                hingeSpacerWidthMm: 25,
                              });
                            }}
                          >
                            Faja Izq (25mm)
                          </button>
                          <button
                            type="button"
                            className={`builder-segmented-btn ${(selectedCell.content as BayContentDrawerStack).hasHingeSpacer && (selectedCell.content as BayContentDrawerStack).hingeSpacerSide === 'right' ? 'selected' : ''}`}
                            onClick={() => {
                              const ds = selectedCell.content as BayContentDrawerStack;
                              handleUpdateCellContent({
                                ...ds,
                                hasHingeSpacer: true,
                                hingeSpacerSide: 'right',
                                hingeSpacerWidthMm: 25,
                              });
                            }}
                          >
                            Faja Der (25mm)
                          </button>
                        </div>
                      </div>

                      {/* Tirador del cajón */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Tirador / Manija del cajón:</span>
                        <div className="builder-chip-selector" role="group" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          <button
                            type="button"
                            className={`builder-segmented-btn ${!(selectedCell.content as BayContentDrawerStack).handle || (selectedCell.content as BayContentDrawerStack).handle?.type === 'none' ? 'selected' : ''}`}
                            style={{ height: '30px', padding: '0 0.5rem', fontSize: '0.76rem' }}
                            onClick={() => {
                              const ds = selectedCell.content as BayContentDrawerStack;
                              handleUpdateCellContent({ ...ds, handle: { type: 'none' } });
                            }}
                          >
                            Sin tirador (Uñero / Push)
                          </button>
                          <button
                            type="button"
                            className={`builder-segmented-btn ${(selectedCell.content as BayContentDrawerStack).handle?.type === 'knob' ? 'selected' : ''}`}
                            style={{ height: '30px', padding: '0 0.5rem', fontSize: '0.76rem' }}
                            onClick={() => {
                              const ds = selectedCell.content as BayContentDrawerStack;
                              handleUpdateCellContent({ ...ds, handle: { type: 'knob', protrusionMm: 25 } });
                            }}
                          >
                            Pomo
                          </button>
                          {[96, 128, 160, 192].map((pitch) => (
                            <button
                              key={pitch}
                              type="button"
                              className={`builder-segmented-btn ${(selectedCell.content as BayContentDrawerStack).handle?.type === 'bar' && (selectedCell.content as BayContentDrawerStack).handle?.centerToCenterMm === pitch ? 'selected' : ''}`}
                              style={{ height: '30px', padding: '0 0.5rem', fontSize: '0.76rem' }}
                              onClick={() => {
                                const ds = selectedCell.content as BayContentDrawerStack;
                                handleUpdateCellContent({
                                  ...ds,
                                  handle: { type: 'bar', centerToCenterMm: pitch, protrusionMm: 25 },
                                });
                              }}
                            >
                              Barral {pitch}mm
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Espesor de la Caja del Cajón */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Espesor de placa de la caja:</span>
                        <div className="builder-chip-selector" role="group">
                          <button
                            type="button"
                            className={`builder-segmented-btn ${((selectedCell.content as BayContentDrawerStack).boxThicknessMm ?? 15) === 6 ? 'selected' : ''}`}
                            onClick={() => {
                              const ds = selectedCell.content as BayContentDrawerStack;
                              handleUpdateCellContent({
                                ...ds,
                                boxThicknessMm: 6,
                                boxJointType: 'glue',
                              });
                            }}
                          >
                            6 mm (Cajoncito)
                          </button>
                          <button
                            type="button"
                            className={`builder-segmented-btn ${((selectedCell.content as BayContentDrawerStack).boxThicknessMm ?? 15) === 9 ? 'selected' : ''}`}
                            onClick={() => {
                              const ds = selectedCell.content as BayContentDrawerStack;
                              handleUpdateCellContent({
                                ...ds,
                                boxThicknessMm: 9,
                                boxJointType: 'glue',
                              });
                            }}
                          >
                            9 mm (Fino)
                          </button>
                          <button
                            type="button"
                            className={`builder-segmented-btn ${((selectedCell.content as BayContentDrawerStack).boxThicknessMm ?? 15) === 15 ? 'selected' : ''}`}
                            onClick={() => {
                              const ds = selectedCell.content as BayContentDrawerStack;
                              handleUpdateCellContent({
                                ...ds,
                                boxThicknessMm: 15,
                                boxJointType: 'confirmat',
                              });
                            }}
                          >
                            15 mm
                          </button>
                          <button
                            type="button"
                            className={`builder-segmented-btn ${((selectedCell.content as BayContentDrawerStack).boxThicknessMm ?? 15) === 18 ? 'selected' : ''}`}
                            onClick={() => {
                              const ds = selectedCell.content as BayContentDrawerStack;
                              handleUpdateCellContent({
                                ...ds,
                                boxThicknessMm: 18,
                                boxJointType: 'confirmat',
                              });
                            }}
                          >
                            18 mm
                          </button>
                        </div>
                      </div>

                      {/* Aviso y opciones de frente para cajas delgadas <= 9mm */}
                      {((selectedCell.content as BayContentDrawerStack).boxThicknessMm ?? 15) <= 9 && (
                        <>
                          <div
                            style={{
                              fontSize: '0.74rem',
                              padding: '0.45rem 0.6rem',
                              backgroundColor: '#fef3c7',
                              color: '#92400e',
                              borderRadius: '4px',
                              lineHeight: 1.35,
                            }}
                          >
                            🪵 <strong>Caja encolada sin tornillos en canto:</strong> En placas de {((selectedCell.content as BayContentDrawerStack).boxThicknessMm ?? 15)} mm las uniones son encoladas/encastradas sin perforaciones en canto.
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Espesor del Frente:</span>
                            <div className="builder-segmented-btn-group">
                              <button
                                type="button"
                                className={`builder-segmented-btn ${((selectedCell.content as BayContentDrawerStack).frontThicknessMm ?? 18) === 18 ? 'selected' : ''}`}
                                onClick={() => {
                                  const ds = selectedCell.content as BayContentDrawerStack;
                                  handleUpdateCellContent({ ...ds, frontThicknessMm: 18 });
                                }}
                              >
                                18 mm (Frente a tono)
                              </button>
                              <button
                                type="button"
                                className={`builder-segmented-btn ${(selectedCell.content as BayContentDrawerStack).frontThicknessMm === 6 ? 'selected' : ''}`}
                                onClick={() => {
                                  const ds = selectedCell.content as BayContentDrawerStack;
                                  handleUpdateCellContent({ ...ds, frontThicknessMm: 6 });
                                }}
                              >
                                6 mm (Monolítico liviano)
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Sub-parameters for Doors */}
                  {selectedCell.content.type === 'doors' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {/* Cantidad de Hojas y Apertura */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Cantidad de hojas y apertura:</span>
                        <div className="builder-segmented-btn-group">
                          <button
                            type="button"
                            className={`builder-segmented-btn ${(selectedCell.content as BayContentDoors).count === 1 && ((selectedCell.content as BayContentDoors).hingeSide !== 'right') ? 'selected' : ''}`}
                            onClick={() => {
                              const d = selectedCell.content as BayContentDoors;
                              handleUpdateCellContent({
                                ...d,
                                count: 1,
                                hingeSide: 'left',
                              });
                            }}
                          >
                            🚪 1 Hoja (Bisagra Izq)
                          </button>
                          <button
                            type="button"
                            className={`builder-segmented-btn ${(selectedCell.content as BayContentDoors).count === 1 && (selectedCell.content as BayContentDoors).hingeSide === 'right' ? 'selected' : ''}`}
                            onClick={() => {
                              const d = selectedCell.content as BayContentDoors;
                              handleUpdateCellContent({
                                ...d,
                                count: 1,
                                hingeSide: 'right',
                              });
                            }}
                          >
                            🚪 1 Hoja (Bisagra Der)
                          </button>
                          <button
                            type="button"
                            className={`builder-segmented-btn ${(selectedCell.content as BayContentDoors).count === 2 ? 'selected' : ''}`}
                            onClick={() => {
                              const d = selectedCell.content as BayContentDoors;
                              handleUpdateCellContent({
                                ...d,
                                count: 2,
                              });
                            }}
                          >
                            🚪🚪 2 Hojas (Partida)
                          </button>
                        </div>
                      </div>

                      {/* Posición de Montaje */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Montaje de la puerta:</span>
                        <div className="builder-segmented-btn-group">
                          <button
                            type="button"
                            className={`builder-segmented-btn ${(selectedCell.content as BayContentDoors).mountType === 'full-overlay' || !(selectedCell.content as BayContentDoors).mountType ? 'selected' : ''}`}
                            onClick={() => {
                              const d = selectedCell.content as BayContentDoors;
                              handleUpdateCellContent({
                                ...d,
                                mountType: 'full-overlay',
                              });
                            }}
                          >
                            🔲 Aplicada (Solapada)
                          </button>
                          <button
                            type="button"
                            className={`builder-segmented-btn ${(selectedCell.content as BayContentDoors).mountType === 'inset' ? 'selected' : ''}`}
                            onClick={() => {
                              const d = selectedCell.content as BayContentDoors;
                              handleUpdateCellContent({
                                ...d,
                                mountType: 'inset',
                              });
                            }}
                          >
                            🔲 Embutida a la luz
                          </button>
                          <button
                            type="button"
                            className={`builder-segmented-btn ${(selectedCell.content as BayContentDoors).mountType === 'half-overlay' ? 'selected' : ''}`}
                            onClick={() => {
                              const d = selectedCell.content as BayContentDoors;
                              handleUpdateCellContent({
                                ...d,
                                mountType: 'half-overlay',
                              });
                            }}
                          >
                            🔲 Semi-aplicada
                          </button>
                        </div>
                      </div>

                      {/* Espesor de la Puerta */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Espesor de la puerta:</span>
                        <div className="builder-chip-selector" role="group">
                          {[6, 9, 15, 18].map((thick) => {
                            const d = selectedCell.content as BayContentDoors;
                            const isSelected = (d.doorThicknessMm ?? 18) === thick;
                            return (
                              <button
                                key={thick}
                                type="button"
                                className={`builder-segmented-btn ${isSelected ? 'selected' : ''}`}
                                onClick={() => {
                                  let nextHinge: DoorHingeType = d.hingeType ?? 'cup-35';
                                  if (thick <= 9 && nextHinge === 'cup-35') {
                                    nextHinge = 'butt-hinge';
                                  }
                                  handleUpdateCellContent({
                                    ...d,
                                    doorThicknessMm: thick,
                                    hingeType: nextHinge,
                                  });
                                }}
                              >
                                {thick} mm {thick <= 9 ? '(Fina/Liviana)' : ''}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Tipo de Bisagra */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Tipo de bisagra:</span>
                        <div className="builder-chip-selector" role="group" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {((selectedCell.content as BayContentDoors).doorThicknessMm ?? 18) > 9 && (
                            <button
                              type="button"
                              className={`builder-segmented-btn ${!(selectedCell.content as BayContentDoors).hingeType || (selectedCell.content as BayContentDoors).hingeType === 'cup-35' ? 'selected' : ''}`}
                              style={{ height: '30px', padding: '0 0.5rem', fontSize: '0.76rem' }}
                              onClick={() => {
                                const d = selectedCell.content as BayContentDoors;
                                handleUpdateCellContent({ ...d, hingeType: 'cup-35' });
                              }}
                            >
                              ⚙️ Cazoleta Ø35mm (Articulada)
                            </button>
                          )}
                          <button
                            type="button"
                            className={`builder-segmented-btn ${(selectedCell.content as BayContentDoors).hingeType === 'butt-hinge' || (((selectedCell.content as BayContentDoors).doorThicknessMm ?? 18) <= 9 && (!(selectedCell.content as BayContentDoors).hingeType || (selectedCell.content as BayContentDoors).hingeType === 'butt-hinge')) ? 'selected' : ''}`}
                            style={{ height: '30px', padding: '0 0.5rem', fontSize: '0.76rem' }}
                            onClick={() => {
                              const d = selectedCell.content as BayContentDoors;
                              handleUpdateCellContent({ ...d, hingeType: 'butt-hinge' });
                            }}
                          >
                            📖 Libro / Común
                          </button>
                          <button
                            type="button"
                            className={`builder-segmented-btn ${(selectedCell.content as BayContentDoors).hingeType === 'piano-hinge' ? 'selected' : ''}`}
                            style={{ height: '30px', padding: '0 0.5rem', fontSize: '0.76rem' }}
                            onClick={() => {
                              const d = selectedCell.content as BayContentDoors;
                              handleUpdateCellContent({ ...d, hingeType: 'piano-hinge' });
                            }}
                          >
                            🎹 Piano / Continua
                          </button>
                        </div>
                      </div>

                      {/* Advertencia para puertas finas */}
                      {((selectedCell.content as BayContentDoors).doorThicknessMm ?? 18) <= 9 && (
                        <div
                          style={{
                            fontSize: '0.74rem',
                            padding: '0.45rem 0.6rem',
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                            borderRadius: '4px',
                            lineHeight: 1.35,
                          }}
                        >
                          🚪 <strong>Tapa delgada ({((selectedCell.content as BayContentDoors).doorThicknessMm ?? 18)}mm):</strong> Las bisagras de cazoleta de 35mm traspasan placas menores a 12mm. Se utilizan bisagras tipo libro o piano fijadas superficialmente con tornillos cortos.
                        </div>
                      )}

                      {/* Retén / Traba de Cierre */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Retén / Traba de cierre:</span>
                        <div className="builder-chip-selector" role="group" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          <button
                            type="button"
                            className={`builder-segmented-btn ${!(selectedCell.content as BayContentDoors).catchType || (selectedCell.content as BayContentDoors).catchType === 'none' ? 'selected' : ''}`}
                            style={{ height: '30px', padding: '0 0.5rem', fontSize: '0.76rem' }}
                            onClick={() => {
                              const d = selectedCell.content as BayContentDoors;
                              handleUpdateCellContent({ ...d, catchType: 'none' });
                            }}
                          >
                            Ninguno
                          </button>
                          <button
                            type="button"
                            className={`builder-segmented-btn ${(selectedCell.content as BayContentDoors).catchType === 'magnetic-catch' ? 'selected' : ''}`}
                            style={{ height: '30px', padding: '0 0.5rem', fontSize: '0.76rem' }}
                            onClick={() => {
                              const d = selectedCell.content as BayContentDoors;
                              handleUpdateCellContent({ ...d, catchType: 'magnetic-catch' });
                            }}
                          >
                            🧲 Magnético
                          </button>
                          <button
                            type="button"
                            className={`builder-segmented-btn ${(selectedCell.content as BayContentDoors).catchType === 'roller-catch' ? 'selected' : ''}`}
                            style={{ height: '30px', padding: '0 0.5rem', fontSize: '0.76rem' }}
                            onClick={() => {
                              const d = selectedCell.content as BayContentDoors;
                              handleUpdateCellContent({ ...d, catchType: 'roller-catch' });
                            }}
                          >
                            ⚪ A rodillo / bolilla
                          </button>
                          <button
                            type="button"
                            className={`builder-segmented-btn ${(selectedCell.content as BayContentDoors).catchType === 'push-catch' ? 'selected' : ''}`}
                            style={{ height: '30px', padding: '0 0.5rem', fontSize: '0.76rem' }}
                            onClick={() => {
                              const d = selectedCell.content as BayContentDoors;
                              handleUpdateCellContent({ ...d, catchType: 'push-catch' });
                            }}
                          >
                            🔘 Pulsador Push Tip-On
                          </button>
                        </div>
                      </div>

                      {/* Tirador / Manija de la puerta */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Tirador / Manija:</span>
                        <div className="builder-chip-selector" role="group" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          <button
                            type="button"
                            className={`builder-segmented-btn ${!(selectedCell.content as BayContentDoors).handle || (selectedCell.content as BayContentDoors).handle?.type === 'none' ? 'selected' : ''}`}
                            style={{ height: '30px', padding: '0 0.5rem', fontSize: '0.76rem' }}
                            onClick={() => {
                              const d = selectedCell.content as BayContentDoors;
                              handleUpdateCellContent({ ...d, handle: { type: 'none' } });
                            }}
                          >
                            Sin tirador (Uñero / Push)
                          </button>
                          <button
                            type="button"
                            className={`builder-segmented-btn ${(selectedCell.content as BayContentDoors).handle?.type === 'knob' ? 'selected' : ''}`}
                            style={{ height: '30px', padding: '0 0.5rem', fontSize: '0.76rem' }}
                            onClick={() => {
                              const d = selectedCell.content as BayContentDoors;
                              handleUpdateCellContent({ ...d, handle: { type: 'knob', protrusionMm: 25 } });
                            }}
                          >
                            Pomo
                          </button>
                          {[96, 128, 160, 192].map((pitch) => (
                            <button
                              key={pitch}
                              type="button"
                              className={`builder-segmented-btn ${(selectedCell.content as BayContentDoors).handle?.type === 'bar' && (selectedCell.content as BayContentDoors).handle?.centerToCenterMm === pitch ? 'selected' : ''}`}
                              style={{ height: '30px', padding: '0 0.5rem', fontSize: '0.76rem' }}
                              onClick={() => {
                                const d = selectedCell.content as BayContentDoors;
                                handleUpdateCellContent({
                                  ...d,
                                  handle: { type: 'bar', centerToCenterMm: pitch, protrusionMm: 25 },
                                });
                              }}
                            >
                              Barral {pitch}mm
                            </button>
                          ))}
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
            padding: isMobile ? '0.65rem 0.85rem max(0.65rem, env(safe-area-inset-bottom, 0.65rem))' : '1rem 1.25rem',
            borderTop: '1px solid var(--md-sys-color-outline-variant)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            flexShrink: 0,
            backgroundColor: 'var(--md-sys-color-surface-container-low)',
          }}
        >
          <button
            type="button"
            className="m3-btn-outlined"
            onClick={onClose}
            style={{
              minHeight: `${MOBILE_TOUCH_TARGET_PX}px`,
              flex: isMobile ? 1 : undefined,
              padding: '0.6rem 1.25rem',
              borderRadius: 'var(--md-sys-shape-corner-full)',
              border: '1px solid var(--md-sys-color-outline)',
              backgroundColor: 'transparent',
              color: 'var(--md-sys-color-primary)',
              fontWeight: 600,
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
              minHeight: `${MOBILE_TOUCH_TARGET_PX}px`,
              flex: isMobile ? 2 : undefined,
              justifyContent: 'center',
              padding: '0.6rem 1.5rem',
              borderRadius: 'var(--md-sys-shape-corner-full)',
              border: 'none',
              backgroundColor: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span>💾</span>
            <span>Aplicar al Vano</span>
          </button>
        </div>
      </div>
    </div>
  );
}
