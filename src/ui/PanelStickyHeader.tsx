import type { ReactElement } from 'react';

/**
 * Props for the PanelStickyHeader component.
 */
export interface PanelStickyHeaderProps {
  /** Name of the currently visible or active section (e.g. "Medidas y Plantilla", "Estructura"). */
  currentSectionName: string;
  /** Active module width in mm. */
  width: number;
  /** Active module height in mm. */
  height: number;
  /** Active module depth in mm. */
  depth: number;
  /** Callback fired when module width changes. */
  onWidthChange: (val: number) => void;
  /** Callback fired when module height changes. */
  onHeightChange: (val: number) => void;
  /** Callback fired when module depth changes. */
  onDepthChange: (val: number) => void;
  /** Callback to switch to mobile site/workshop mode. */
  onSwitchToSiteMode?: () => void;
  /** Whether the current environment is detected as a mobile device. */
  isMobileDevice?: boolean;
}

/**
 * Sticky header for the configuration sidebar.
 * Displays the current section title and allows direct editing of module dimensions (W × H × D).
 */
export function PanelStickyHeader({
  currentSectionName,
  width,
  height,
  depth,
  onWidthChange,
  onHeightChange,
  onDepthChange,
  onSwitchToSiteMode,
  isMobileDevice: _isMobileDevice = false,
}: PanelStickyHeaderProps): ReactElement {
  return (
    <header className="panel-sticky-header">
      <div className="panel-sticky-header__top-row">
        <div className="panel-sticky-header__titles">
          <span className="panel-sticky-header__badge">⚙️ Modo Experto</span>
          <h2 className="panel-sticky-header__section-name">
            {currentSectionName}
          </h2>
        </div>

        <div className="panel-sticky-header__actions">
          {onSwitchToSiteMode && (
            <button
              type="button"
              onClick={onSwitchToSiteMode}
              className="m3-button m3-button--tonal panel-header-btn"
              title="Cambiar a Modo Taller / Obra (gestual para celular)"
              aria-label="Cambiar a Modo Taller"
            >
              <span aria-hidden="true">🏗️</span>
              <span>Modo Taller</span>
            </button>
          )}
        </div>
      </div>

      <div className="panel-sticky-header__dimensions-bar">
        <span className="dimensions-bar-label" title="Dimensiones exteriores del módulo">
          📐 Cotas:
        </span>
        <div className="dimensions-bar-inputs">
          <label className="header-dim-field" title="Ancho del módulo en mm">
            <span className="dim-field-caption">Ancho</span>
            <input
              type="number"
              min={100}
              max={3000}
              step={10}
              value={width}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (!isNaN(val) && val > 0) onWidthChange(val);
              }}
              className="header-dim-input"
              aria-label="Ancho del módulo en mm"
            />
          </label>
          <span className="dim-field-sep" aria-hidden="true">×</span>
          <label className="header-dim-field" title="Alto del módulo en mm">
            <span className="dim-field-caption">Alto</span>
            <input
              type="number"
              min={100}
              max={3000}
              step={10}
              value={height}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (!isNaN(val) && val > 0) onHeightChange(val);
              }}
              className="header-dim-input"
              aria-label="Alto del módulo en mm"
            />
          </label>
          <span className="dim-field-sep" aria-hidden="true">×</span>
          <label className="header-dim-field" title="Profundidad del módulo en mm">
            <span className="dim-field-caption">Prof.</span>
            <input
              type="number"
              min={100}
              max={3000}
              step={10}
              value={depth}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (!isNaN(val) && val > 0) onDepthChange(val);
              }}
              className="header-dim-input"
              aria-label="Profundidad del módulo en mm"
            />
          </label>
          <span className="dim-field-unit">mm</span>
        </div>
      </div>
    </header>
  );
}
