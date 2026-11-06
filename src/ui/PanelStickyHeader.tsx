import type { ReactElement } from 'react';
import { DEFAULT_UI_CONFIG } from '../config';
import { NumericInput } from './NumericInput';

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
  /** Count of active architectural interferences in the module. */
  activeInterferenceCount?: number;
  /** Callback fired when clicking the interference warning badge to navigate to the section. */
  onOpenInterferences?: () => void;
}

/**
 * Sticky header for the configuration sidebar.
 * Displays the current section title, active interference warnings, and allows direct editing
 * of module dimensions (W × H × D) arranged in three equal columns with draft buffer protection.
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
  activeInterferenceCount = 0,
  onOpenInterferences,
}: PanelStickyHeaderProps): ReactElement {
  return (
    <header className="panel-sticky-header">
      <div className="panel-sticky-header__row">
        <div className="panel-sticky-header__titles">
          <span className="panel-sticky-header__badge">⚙️ Modo Experto</span>
          <h2 className="panel-sticky-header__section-name">
            {currentSectionName}
          </h2>
        </div>

        <div className="panel-sticky-header__dimensions-bar">
          <span className="dimensions-bar-unit" title="Milímetros (mm)">mm</span>
          <div className="panel-sticky-header__dimensions-grid">
            <div className="header-dim-col">
              <label htmlFor="header-dim-width" className="header-dim-label-inside">
                An
              </label>
              <NumericInput
                id="header-dim-width"
                value={width}
                min={DEFAULT_UI_CONFIG.dimensions.width.min}
                max={DEFAULT_UI_CONFIG.dimensions.width.max}
                step={DEFAULT_UI_CONFIG.dimensions.width.step}
                onChange={onWidthChange}
                restoreOnInvalid={true}
                ariaLabel="Ancho del módulo en mm"
                className="header-dim-input"
              />
            </div>

            <div className="header-dim-col">
              <label htmlFor="header-dim-height" className="header-dim-label-inside">
                Al
              </label>
              <NumericInput
                id="header-dim-height"
                value={height}
                min={DEFAULT_UI_CONFIG.dimensions.height.min}
                max={DEFAULT_UI_CONFIG.dimensions.height.max}
                step={DEFAULT_UI_CONFIG.dimensions.height.step}
                onChange={onHeightChange}
                restoreOnInvalid={true}
                ariaLabel="Alto del módulo en mm"
                className="header-dim-input"
              />
            </div>

            <div className="header-dim-col">
              <label htmlFor="header-dim-depth" className="header-dim-label-inside">
                Pr
              </label>
              <NumericInput
                id="header-dim-depth"
                value={depth}
                min={DEFAULT_UI_CONFIG.dimensions.depth.min}
                max={DEFAULT_UI_CONFIG.dimensions.depth.max}
                step={DEFAULT_UI_CONFIG.dimensions.depth.step}
                onChange={onDepthChange}
                restoreOnInvalid={true}
                ariaLabel="Profundidad del módulo en mm"
                className="header-dim-input"
              />
            </div>
          </div>
        </div>

        {(activeInterferenceCount > 0 && onOpenInterferences) || onSwitchToSiteMode ? (
          <div className="panel-sticky-header__actions">
            {activeInterferenceCount > 0 && onOpenInterferences && (
              <button
                type="button"
                onClick={onOpenInterferences}
                className="panel-sticky-header__warning-badge"
                title="Interferencias arquitectónicas activas en el módulo. Clic para ver o ajustar."
                aria-label={`${activeInterferenceCount} interferencias activas`}
              >
                <span aria-hidden="true">⚠️</span>
                <span>{`${activeInterferenceCount}`}</span>
              </button>
            )}

            {onSwitchToSiteMode && (
              <button
                type="button"
                onClick={onSwitchToSiteMode}
                className="m3-button m3-button--tonal panel-header-btn"
                title="Cambiar a Modo Taller / Obra (gestual para celular)"
                aria-label="Cambiar a Modo Taller"
              >
                <span aria-hidden="true">🏗️</span>
                <span>Taller</span>
              </button>
            )}
          </div>
        ) : null}
      </div>
    </header>
  );
}
