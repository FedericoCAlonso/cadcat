import type { ReactElement } from 'react';
import type { MachiningDisplayMode } from './viewer/machiningVisibility';

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
  wireframe?: boolean;
  /** Callback fired to toggle wireframe rendering. */
  onToggleWireframe?: () => void;
  /** Whether piece edge outlines ("Líneas") are rendered. */
  showLines?: boolean;
  /** Callback fired to toggle piece edge outlines. */
  onToggleShowLines?: () => void;
  /** Whether 3D machining features (holes, grooves, hinge cups) are visible (legacy boolean). */
  showMachining3D?: boolean;
  /** Callback fired to toggle 3D machining feature visibility (legacy toggle). */
  onToggleMachining3D?: () => void;
  /** Three-state machining visibility mode ('no' | 'auto' | 'always') (Stage 5 Step B). */
  machiningMode?: MachiningDisplayMode;
  /** Callback fired when cycling or switching machining display mode. */
  onChangeMachiningMode?: (mode: MachiningDisplayMode) => void;
  /** Whether functional color-coding by piece role is active (Stage 5 Step B). */
  colorByRole?: boolean;
  /** Callback fired to toggle color by piece role. */
  onToggleColorByRole?: () => void;
  /** Current exploded view expansion ratio [0..1]. */
  explodedRatio: number;
  /** Callback fired when the exploded view slider ratio is changed. */
  onExplodedRatioChange: (val: number) => void;
  /** Callback fired to auto-fit / zoom the module into view. */
  onFitCamera?: () => void;
  /** Whether 3D dimension lines and projected DOM labels are visible. */
  showDimensions?: boolean;
  /** Callback fired to toggle dimension lines and labels visibility. */
  onToggleDimensions?: () => void;
  /** Whether edge band highlights are visible on pieces (Stage 5 Step C). */
  showEdgeBands?: boolean;
  /** Callback fired to toggle edge band highlights. */
  onToggleShowEdgeBands?: () => void;
}

/**
 * Combined floating toolbar for the 3D viewport.
 * Consolidates controls into three distinct ergonomic groups:
 * 1. Views (Isometric, Front, Top, Side, Fit)
 * 2. Render modes (Lines, Color by role, Machining 3-state, Dimensions)
 * 3. Exploded view slider
 */
export function ViewerToolbar({
  onSetCameraView,
  wireframe = false,
  onToggleWireframe,
  showLines,
  onToggleShowLines,
  showMachining3D,
  onToggleMachining3D,
  machiningMode,
  onChangeMachiningMode,
  colorByRole,
  onToggleColorByRole,
  explodedRatio,
  onExplodedRatioChange,
  onFitCamera,
  showDimensions,
  onToggleDimensions,
  showEdgeBands,
  onToggleShowEdgeBands,
}: ViewerToolbarProps): ReactElement {
  // Handler for cycling through machining modes ('auto' -> 'always' -> 'no' -> 'auto')
  const handleMachiningClick = () => {
    if (onChangeMachiningMode) {
      const current = machiningMode ?? 'auto';
      const nextMap: Record<MachiningDisplayMode, MachiningDisplayMode> = {
        auto: 'always',
        always: 'no',
        no: 'auto',
      };
      onChangeMachiningMode(nextMap[current]);
    } else if (onToggleMachining3D) {
      onToggleMachining3D();
    }
  };

  const machiningLabel = (() => {
    if (machiningMode !== undefined) {
      if (machiningMode === 'auto') return 'Auto';
      if (machiningMode === 'always') return 'Siempre';
      return 'No';
    }
    return showMachining3D ? 'ON' : 'OFF';
  })();

  const isMachiningActive = machiningMode !== undefined ? machiningMode !== 'no' : Boolean(showMachining3D);

  const linesActive = showLines !== undefined ? showLines : wireframe;
  const linesLabel = showLines !== undefined ? `Líneas ${showLines ? 'ON' : 'OFF'}` : (wireframe ? 'Sólido' : 'Líneas');

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
          {onFitCamera && (
            <button
              type="button"
              className="m3-btn m3-btn--small m3-btn--tonal viewer-toolbar-btn"
              onClick={onFitCamera}
              title="Encuadrar módulo en pantalla (zoom óptimo)"
              aria-label="Encuadrar módulo"
            >
              ⛶ Encuadrar
            </button>
          )}
        </div>
      </div>

      {/* Grupo 2: Modos de Renderizado */}
      <div className="viewer-toolbar-group viewer-toolbar-group--render" role="group" aria-label="Modo de renderizado">
        <span className="viewer-toolbar-group-label">Render:</span>
        <div className="viewer-toolbar-buttons">
          <button
            type="button"
            className={`m3-btn m3-btn--small ${linesActive ? 'm3-btn--primary is-active' : 'm3-btn--outlined'} viewer-toolbar-btn`}
            onClick={onToggleShowLines ?? onToggleWireframe}
            title={linesActive ? 'Ocultar aristas y líneas de contorno' : 'Mostrar aristas y líneas de contorno'}
            aria-label="Alternar líneas"
          >
            {linesLabel}
          </button>
          {onToggleColorByRole && (
            <button
              type="button"
              className={`m3-btn m3-btn--small ${colorByRole ? 'm3-btn--primary is-active' : 'm3-btn--outlined'} viewer-toolbar-btn`}
              onClick={onToggleColorByRole}
              title={colorByRole ? 'Desactivar colores por rol y mostrar materiales' : 'Activar color por rol (laterales, base, fondo, etc.)'}
              aria-label="Alternar color por rol"
            >
              {`🎨 Rol ${colorByRole ? 'ON' : 'OFF'}`}
            </button>
          )}
          <button
            type="button"
            className={`m3-btn m3-btn--small ${isMachiningActive ? 'm3-btn--primary is-active' : 'm3-btn--outlined'} viewer-toolbar-btn`}
            onClick={handleMachiningClick}
            title="Mecanizados 3D: Auto (según zoom/selección) · Siempre (visibles) · No (ocultos)"
            aria-label={`Modo de mecanizados: ${machiningLabel}`}
          >
            {`⚙️ Mecanizados ${machiningLabel}`}
          </button>
          {onToggleDimensions && (
            <button
              type="button"
              className={`m3-btn m3-btn--small ${showDimensions ? 'm3-btn--primary is-active' : 'm3-btn--outlined'} viewer-toolbar-btn`}
              onClick={onToggleDimensions}
              title={showDimensions ? 'Ocultar cotas de dimensión' : 'Mostrar cotas de dimensión'}
              aria-label="Alternar cotas de dimensión"
            >
              {`📏 Cotas ${showDimensions ? 'ON' : 'OFF'}`}
            </button>
          )}
          {onToggleShowEdgeBands && (
            <button
              type="button"
              className={`m3-btn m3-btn--small ${showEdgeBands ? 'm3-btn--primary is-active' : 'm3-btn--outlined'} viewer-toolbar-btn`}
              onClick={onToggleShowEdgeBands}
              title={showEdgeBands ? 'Ocultar resaltado de tapacantos (cantos)' : 'Mostrar resaltado de tapacantos (cantos) en 3D'}
              aria-label="Alternar tapacantos"
            >
              {`🏷️ Cantos ${showEdgeBands ? 'ON' : 'OFF'}`}
            </button>
          )}
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
