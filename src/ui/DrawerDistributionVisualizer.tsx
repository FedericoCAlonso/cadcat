import {
  useState,
  type ReactElement,
} from 'react';
import type { TrackSize } from '../resolver';
import { DEFAULT_UI_CONFIG } from '../config';
import { NumericInput } from './NumericInput';
import { DrawerTracksInput } from './DrawerTracksInput';
import { calculateProportionalBandHeights } from './drawerScaleUtils';

export interface DrawerDistributionVisualizerProps {
  /** Array of track sizes (fixed in mm or fractional in fr). */
  tracks: TrackSize[];
  /** Calculated real heights in mm for each drawer. */
  resolvedDrawerHeights: number[];
  /** Estimated net internal cavity height in mm (luz libre). */
  estimatedBayCavityHeight: number;
  /** Callback fired when tracks change. */
  onChangeTracks?: (tracks: TrackSize[]) => void;
  /** Index of currently selected drawer (0-indexed). */
  selectedIndex?: number;
  /** Callback fired when user clicks to select a drawer. */
  onSelectDrawer?: (idx: number) => void;
}

/**
 * Step A drawer distribution visualizer.
 * Replaces bulky text rows with a scaled vertical elevation drawing to scale,
 * responsive container queries, and ergonomic numeric fields (with draft buffer and range guards)
 * for the selected drawer placed below the elevation diagram.
 */
export function DrawerDistributionVisualizer({
  tracks,
  resolvedDrawerHeights,
  estimatedBayCavityHeight,
  onChangeTracks,
  selectedIndex: controlledSelectedIndex,
  onSelectDrawer,
}: DrawerDistributionVisualizerProps): ReactElement {
  const [internalSelectedIndex, setInternalSelectedIndex] = useState<number>(0);
  const [showCustomGridInput, setShowCustomGridInput] = useState<boolean>(false);

  const activeIndex = controlledSelectedIndex !== undefined
    ? controlledSelectedIndex
    : internalSelectedIndex;

  const safeIndex = Math.min(Math.max(0, activeIndex), Math.max(0, tracks.length - 1));

  const handleSelect = (idx: number) => {
    setInternalSelectedIndex(idx);
    onSelectDrawer?.(idx);
  };

  const currentTrack: TrackSize = tracks[safeIndex] ?? { type: 'fractional', valueFr: 1 };
  const currentHeight = resolvedDrawerHeights[safeIndex] ?? 0;

  // Compute effective real heights in mm for all drawers
  const effectiveHeightsMm = tracks.map((t, idx) => {
    const resolved = resolvedDrawerHeights[idx];
    if (typeof resolved === 'number' && resolved > 0) return resolved;
    if (t.type === 'fixed') return t.valueMm;
    return Math.round(estimatedBayCavityHeight / Math.max(1, tracks.length));
  });

  // Calculate pixel heights to scale, respecting minimum visible height
  const bandHeightsPx = calculateProportionalBandHeights(effectiveHeightsMm, 100);

  // Handlers for updating the currently selected track size
  const handleToggleTrackType = (newType: 'fixed' | 'fractional') => {
    if (!onChangeTracks) return;
    const nextTracks = [...tracks];
    if (newType === 'fixed') {
      const defaultMm = currentHeight > 0 ? Math.round(currentHeight) : 150;
      nextTracks[safeIndex] = { type: 'fixed', valueMm: Math.max(50, defaultMm) };
    } else {
      nextTracks[safeIndex] = { type: 'fractional', valueFr: 1 };
    }
    onChangeTracks(nextTracks);
  };

  const handleFixedValueChange = (valMm: number) => {
    if (!onChangeTracks) return;
    const nextTracks = [...tracks];
    nextTracks[safeIndex] = { type: 'fixed', valueMm: valMm };
    onChangeTracks(nextTracks);
  };

  const handleFractionalValueChange = (valFr: number) => {
    if (!onChangeTracks) return;
    const nextTracks = [...tracks];
    nextTracks[safeIndex] = { type: 'fractional', valueFr: valFr };
    onChangeTracks(nextTracks);
  };

  const totalHeight = Math.max(1, estimatedBayCavityHeight);

  return (
    <div
      className="drawer-distribution-visualizer"
      style={{
        '--drawer-two-column-threshold': `${DEFAULT_UI_CONFIG.drawerTwoColumnThresholdPx ?? 520}px`,
      } as React.CSSProperties}
    >
      {/* 1. Header con luz libre total y botón para modo libre */}
      <div className="drawer-distribution-header">
        <span className="drawer-distribution-title">
          <span>📊 Distribución a Escala</span>
          <span className="drawer-distribution-cavity-pill">
            {`${estimatedBayCavityHeight} mm luz libre`}
          </span>
        </span>
        <button
          type="button"
          className="m3-button m3-button--text drawer-distribution-custom-btn"
          onClick={() => setShowCustomGridInput((prev) => !prev)}
          title="Alternar campo de texto libre para definir medidas CSS Grid (ej. 140mm 1fr 1fr)"
          aria-expanded={showCustomGridInput}
        >
          <span>{showCustomGridInput ? '✕ Ocultar edición libre' : '✏️ Edición libre'}</span>
        </button>
      </div>

      {/* 2. Campo opcional de texto libre para atajos CSS Grid */}
      {showCustomGridInput && (
        <div className="drawer-distribution-custom-field">
          <label htmlFor="input-grid-tracks" className="drawer-sublabel">
            Medidas de cajones (mm, fr o mixto):
          </label>
          <DrawerTracksInput
            tracks={tracks}
            onChange={(parsed) => onChangeTracks?.(parsed)}
          />
        </div>
      )}

      {/* 3. Atajos Rápidos de Recetas con scroll horizontal y difuminado */}
      <div className="drawer-distribution-recipes" role="group" aria-label="Atajos rápidos de distribución">
        <span className="drawer-recipes-caption">Atajos:</span>
        <div className="drawer-recipes-scroll-container">
          <div className="drawer-recipes-chips">
            {DEFAULT_UI_CONFIG.quickTrackRecipes.map((recipe, rIdx) => {
              const isMatch = tracks.length === recipe.tracks.length &&
                recipe.tracks.every((rt, idx) => {
                  const cur = tracks[idx];
                  if (!cur) return false;
                  if (rt.type === 'fixed' && cur.type === 'fixed') return rt.valueMm === cur.valueMm;
                  if (rt.type === 'fractional' && cur.type === 'fractional') return rt.valueFr === cur.valueFr;
                  return false;
                });

              return (
                <button
                  key={rIdx}
                  type="button"
                  className={`drawer-recipe-chip ${isMatch ? 'drawer-recipe-chip--active' : ''}`}
                  title={`Receta CSS Grid: ${recipe.label}`}
                  onClick={() => onChangeTracks?.(recipe.tracks as TrackSize[])}
                >
                  {recipe.label.replace(/\s*\(.*?\)/, '')}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Dibujo de Elevación Vertical a Escala y Editor de Cajón (1 columna apilada por defecto) */}
      <div className="drawer-elevation-and-editor">
        {/* Elevación Vertical a Escala */}
        <div
          className="drawer-elevation-diagram"
          role="listbox"
          aria-label="Cajones del vano a escala vertical"
        >
          {tracks.map((track, idx) => {
            const hMm = effectiveHeightsMm[idx] ?? Math.round(totalHeight / tracks.length);
            const bandHeight = bandHeightsPx[idx] ?? 36;
            const isSelected = idx === safeIndex;
            const isFixed = track.type === 'fixed';

            return (
              <button
                key={idx}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-testid={`drawer-band-${idx}`}
                data-height-mm={hMm}
                data-height-px={bandHeight}
                className={`drawer-elevation-band ${isSelected ? 'drawer-elevation-band--selected' : ''} ${isFixed ? 'drawer-elevation-band--fixed' : 'drawer-elevation-band--frac'}`}
                style={{ height: `${bandHeight}px` }}
                onClick={() => handleSelect(idx)}
                title={`Cajón ${idx + 1}: ${hMm} mm (${isFixed ? `${track.valueMm} mm fijo` : `${track.valueFr}fr prop.`})`}
              >
                <div className="drawer-band-content">
                  <span className="drawer-band-num">{`Cajón ${idx + 1}`}</span>
                  <span className="drawer-band-height">{`${hMm} mm`}</span>
                </div>
                <span className="drawer-band-tag">
                  {isFixed ? 'Fijo' : `${track.valueFr ?? 1}fr`}
                </span>
              </button>
            );
          })}
        </div>

        {/* Editor Numérico del Cajón Seleccionado (Se muestra solo para el cajón seleccionado) */}
        {safeIndex >= 0 && tracks[safeIndex] != null && (
          <div className="drawer-selected-editor">
            <div className="drawer-selected-header">
              <span className="drawer-selected-title">
                {`Ajustar Cajón ${safeIndex + 1} (${currentHeight} mm):`}
              </span>
              <div className="m3-segmented-button drawer-unit-toggle" role="radiogroup" aria-label="Tipo de medida">
                <button
                  type="button"
                  role="radio"
                  aria-checked={currentTrack.type === 'fractional'}
                  className={`m3-segmented-button__item ${currentTrack.type === 'fractional' ? 'selected' : ''}`}
                  onClick={() => handleToggleTrackType('fractional')}
                >
                  Proporc. (fr)
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={currentTrack.type === 'fixed'}
                  className={`m3-segmented-button__item ${currentTrack.type === 'fixed' ? 'selected' : ''}`}
                  onClick={() => handleToggleTrackType('fixed')}
                >
                  Fijo (mm)
                </button>
              </div>
            </div>

            <div className="drawer-selected-field-row">
              {currentTrack.type === 'fixed' ? (
                <div className="drawer-num-field-container">
                  <label htmlFor={`drawer-fixed-val-${safeIndex}`} className="drawer-num-label">
                    Altura exterior fija:
                  </label>
                  <NumericInput
                    id={`drawer-fixed-val-${safeIndex}`}
                    value={currentTrack.valueMm}
                    min={60}
                    max={Math.min(1000, totalHeight)}
                    step={10}
                    showStepper={true}
                    restoreOnInvalid={true}
                    unit="mm"
                    onChange={handleFixedValueChange}
                    ariaLabel={`Altura fija en mm para cajón ${safeIndex + 1}`}
                  />
                </div>
              ) : (
                <div className="drawer-num-field-container">
                  <label htmlFor={`drawer-frac-val-${safeIndex}`} className="drawer-num-label">
                    Proporción relativa:
                  </label>
                  <NumericInput
                    id={`drawer-frac-val-${safeIndex}`}
                    value={currentTrack.valueFr}
                    min={0.5}
                    max={10}
                    step={0.5}
                    showStepper={true}
                    restoreOnInvalid={true}
                    allowDecimals={true}
                    unit="fr"
                    onChange={handleFractionalValueChange}
                    ariaLabel={`Proporción fr para cajón ${safeIndex + 1}`}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
