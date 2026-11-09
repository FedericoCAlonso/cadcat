import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { usePanZoom } from './usePanZoom';
import { DEFAULT_UI_CONFIG } from '../config';

/**
 * Properties for the full-screen interactive assembly diagram modal.
 */
export interface AssemblyDiagramModalProps {
  /** Descriptive title displayed in the modal's top app bar */
  title: string;
  /** Inner SVG or diagram content to be rendered and panned/zoomed */
  children: ReactNode;
  /** Callback triggered when the modal is closed via close button, Escape key, or backdrop */
  onClose: () => void;
  /** Minimum allowable zoom scale factor */
  minZoom?: number;
  /** Maximum allowable zoom scale factor */
  maxZoom?: number;
}

/**
 * Full-screen modal overlay that displays CAD technical assembly diagrams
 * with smooth multi-touch pinch-to-zoom, drag-to-pan, wheel zoom, and reset controls.
 * Adheres to Material Design 3 ergonomics and supports light and dark themes.
 */
export function AssemblyDiagramModal({
  title,
  children,
  onClose,
  minZoom = DEFAULT_UI_CONFIG.assemblyGuideModalMinZoom ?? 0.5,
  maxZoom = DEFAULT_UI_CONFIG.assemblyGuideModalMaxZoom ?? 5.0,
}: AssemblyDiagramModalProps): ReactElement {
  const panZoom = usePanZoom({
    initialZoom: 1.0,
    minZoom,
    maxZoom,
    zoomStep: 1.25,
  });

  const viewportRef = useRef<HTMLDivElement>(null);

  // Close on Escape key press
  useEffect(() => {
    /**
     * Handles keyboard events to close modal when Escape key is pressed.
     */
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Touch pan handling for single touch while allowing two-touch pinch to zoom
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  /**
   * Dispatches touchstart to panZoom hook: 1 touch triggers pan tracking, 2 touches trigger pinch.
   */
  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>): void {
    if (e.touches.length === 1) {
      const touch = e.touches[0]!;
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      panZoom.startPan(touch.clientX, touch.clientY, viewportRef.current);
    } else if (e.touches.length === 2) {
      touchStartRef.current = null;
      panZoom.handleTouchStart(e);
    }
  }

  /**
   * Dispatches touchmove to panZoom hook: updates pan offset or pinch scaling.
   */
  function handleTouchMove(e: React.TouchEvent<HTMLDivElement>): void {
    if (e.touches.length === 1 && panZoom.isPanning) {
      const touch = e.touches[0]!;
      panZoom.updatePan(touch.clientX, touch.clientY);
    } else if (e.touches.length === 2) {
      panZoom.handleTouchMove(e);
    }
  }

  /**
   * Ends current pan or pinch touch gesture.
   */
  function handleTouchEnd(e: React.TouchEvent<HTMLDivElement>): void {
    touchStartRef.current = null;
    panZoom.endPan();
    panZoom.handleTouchEnd(e);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="assembly-diagram-modal-backdrop"
      onClick={(e) => {
        // Close if clicking directly on the backdrop container outside header/content
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Modal Top App Bar */}
      <header className="assembly-diagram-modal-header">
        <h3 className="assembly-diagram-modal-title">{title}</h3>

        <div className="assembly-diagram-modal-controls">
          <span
            style={{
              fontSize: '0.82rem',
              fontWeight: 700,
              color: 'var(--text, #1f2622)',
              minWidth: '46px',
              textAlign: 'center',
            }}
            aria-live="polite"
          >
            {Math.round(panZoom.zoom * 100)}%
          </span>

          <button
            type="button"
            className="m3-btn m3-btn--tonal"
            onClick={panZoom.zoomOut}
            aria-label="Reducir zoom"
            title="Reducir zoom (-)"
            style={{ minWidth: '40px', minHeight: '40px', padding: '0 8px', fontSize: '1.1rem' }}
          >
            −
          </button>

          <button
            type="button"
            className="m3-btn m3-btn--tonal"
            onClick={panZoom.resetView}
            aria-label="Restablecer tamaño original 1:1"
            title="Restablecer vista 1:1"
            style={{ minHeight: '40px', padding: '0 10px', fontSize: '0.8rem' }}
          >
            ↺ 1:1
          </button>

          <button
            type="button"
            className="m3-btn m3-btn--tonal"
            onClick={panZoom.zoomIn}
            aria-label="Aumentar zoom"
            title="Aumentar zoom (+)"
            style={{ minWidth: '40px', minHeight: '40px', padding: '0 8px', fontSize: '1.1rem' }}
          >
            +
          </button>

          <button
            type="button"
            className="m3-btn m3-btn--filled"
            onClick={onClose}
            aria-label="Cerrar vista de pantalla completa"
            style={{ minWidth: '48px', minHeight: '48px', padding: '0 16px', fontWeight: 700 }}
          >
            ✕ Cerrar
          </button>
        </div>
      </header>

      {/* Interactive Pan-Zoom Viewport */}
      <div
        ref={viewportRef}
        className="assembly-diagram-modal-viewport"
        onMouseDown={(e) => {
          if (e.button === 0) {
            panZoom.startPan(e.clientX, e.clientY, viewportRef.current);
          }
        }}
        onMouseMove={(e) => {
          if (panZoom.isPanning) {
            panZoom.updatePan(e.clientX, e.clientY);
          }
        }}
        onMouseUp={panZoom.endPan}
        onMouseLeave={panZoom.endPan}
        onWheel={panZoom.handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <div
          className="assembly-diagram-modal-canvas"
          style={{
            transform: `translate(${panZoom.pan.x}px, ${panZoom.pan.y}px) scale(${panZoom.zoom})`,
          }}
        >
          {children}
        </div>

        {/* Floating touch guidance caption */}
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: '#ffffff',
            fontSize: '0.75rem',
            padding: '4px 12px',
            borderRadius: '16px',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          💡 Arrastra para mover • Pellizca o rueda para zoom
        </div>
      </div>
    </div>
  );
}
