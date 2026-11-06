import type { ReactElement } from 'react';

/**
 * Camera preset view directions supported by the 3D viewport.
 */
export type CameraPresetView = 'iso' | 'front' | 'back' | 'left' | 'right' | 'top' | 'bottom' | 'side';

/**
 * Props for the combined 3D viewer toolbar component.
 */
export interface ViewerToolbarProps {
  /** Callback invoked when a preset camera orientation button is clicked. */
  onSetCameraView: (view: CameraPresetView) => void;
  /** Current wireframe / line render mode state. */
  wireframe: boolean;
  /** Callback fired to toggle wireframe rendering. */
  onToggleWireframe: () => void;
  /** Whether 3D machining features (holes, grooves, hinge cups) are visible. */
  showMachining3D: boolean;
  /** Callback fired to toggle 3D machining feature visibility. */
  onToggleMachining3D: () => void;
  /** Current exploded view expansion ratio [0..1]. */
  explodedRatio: number;
  /** Callback fired when the exploded view slider ratio is changed. */
  onExplodedRatioChange: (val: number) => void;
}

/**
 * Combined floating toolbar for the 3D viewport.
 * Consolidates controls into three distinct ergonomic groups:
 * 1. Views (Isometric, Front, Top, Side)
 * 2. Render modes (Wireframe / Lines, 3D Machining)
 * 3. Exploded view slider
 */
export function ViewerToolbar({
  onSetCameraView,
  wireframe,
  onToggleWireframe,
  showMachining3D,
  onToggleMachining3D,
  explodedRatio,
  onExplodedRatioChange,
}: ViewerToolbarProps): ReactElement {
  return (
    <div
      className="viewer-toolbar"
      role="toolbar"
      aria-label="Herramientas del visor 3D"
    >
      {/* Grupo 1: Vistas de Cámara */}
      <div className="viewer-toolbar-group viewer-toolbar-group--views" role="group" aria-label="Orientación de cámara">
        <span className="viewer-toolbar-group-label">Vistas:</span>
        <div className="viewer-toolbar-buttons">
          <button
            type="button"
            className="m3-btn m3-btn--small m3-btn--tonal viewer-toolbar-btn"
            onClick={() => onSetCameraView('iso')}
            title="Vista Isométrica"
          >
            Isométrica
            <span className="visually-hidden">Isometric</span>
          </button>
          <button
            type="button"
            className="m3-btn m3-btn--small m3-btn--tonal viewer-toolbar-btn"
            onClick={() => onSetCameraView('front')}
            title="Vista de Frente"
          >
            Frente
            <span className="visually-hidden">Front</span>
          </button>
          <button
            type="button"
            className="m3-btn m3-btn--small m3-btn--tonal viewer-toolbar-btn"
            onClick={() => onSetCameraView('top')}
            title="Vista de Planta (Superior)"
          >
            Planta
            <span className="visually-hidden">Top</span>
          </button>
          <button
            type="button"
            className="m3-btn m3-btn--small m3-btn--tonal viewer-toolbar-btn"
            onClick={() => onSetCameraView('side')}
            title="Vista Lateral"
          >
            Lateral
            <span className="visually-hidden">Side</span>
          </button>
        </div>
      </div>

      {/* Grupo 2: Modos de Renderizado */}
      <div className="viewer-toolbar-group viewer-toolbar-group--render" role="group" aria-label="Modo de renderizado">
        <span className="viewer-toolbar-group-label">Render:</span>
        <div className="viewer-toolbar-buttons">
          <button
            type="button"
            className={`m3-btn m3-btn--small ${wireframe ? 'm3-btn--primary is-active' : 'm3-btn--outlined'} viewer-toolbar-btn`}
            onClick={onToggleWireframe}
            title={wireframe ? 'Cambiar a sombreado sólido' : 'Cambiar a visualización alámbrica / líneas'}
          >
            {wireframe ? 'Sólido' : 'Líneas'}
          </button>
          <button
            type="button"
            className={`m3-btn m3-btn--small ${showMachining3D ? 'm3-btn--primary is-active' : 'm3-btn--outlined'} viewer-toolbar-btn`}
            onClick={onToggleMachining3D}
            title="Activar u ocultar mecanizados 3D (agujeros, ranuras, cazoletas)"
          >
            {`⚙️ Mecanizados ${showMachining3D ? 'ON' : 'OFF'}`}
          </button>
        </div>
      </div>

      {/* Grupo 3: Despiece / Vista Explotada */}
      <div className="viewer-toolbar-group viewer-toolbar-group--exploded" role="group" aria-label="Despiece explotado">
        <div className="viewer-exploded-label-wrap">
          <label htmlFor="toolbar-exploded-slider" className="viewer-exploded-label">
            <span>Despiece:</span>{' '}
            <strong>{`${Math.round(explodedRatio * 100)}%`}</strong>
            <span className="visually-hidden">Exploded View:</span>
          </label>
        </div>
        <input
          id="toolbar-exploded-slider"
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={explodedRatio}
          onChange={(e) => onExplodedRatioChange(parseFloat(e.target.value))}
          className="viewer-exploded-slider"
          aria-label="Control de despiece / vista explotada"
        />
      </div>
    </div>
  );
}
