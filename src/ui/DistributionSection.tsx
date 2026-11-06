import type { ReactElement } from 'react';
import type { TrackSize, BayBoundingBox, BayContent } from '../resolver';
import { BayTracksInput } from './BayTracksInput';

/**
 * Props for the DistributionSection component.
 */
export interface DistributionSectionProps {
  /** Selected grid division type for bays. */
  gridType?: '1-bay' | '2-bays-vertical' | '3-bays-vertical' | '2-bays-horizontal';
  /** Callback fired when grid type changes. */
  onGridTypeChange?: (gridType: '1-bay' | '2-bays-vertical' | '3-bays-vertical' | '2-bays-horizontal') => void;
  /** Active bay configuration content. */
  activeBay: BayContent;
  /** Callback to open the complex subdivided distribution modal. */
  onOpenDistributionModal: () => void;
  /** Custom track sizes for the bays. */
  bayTracks?: TrackSize[];
  /** Callback fired when custom bay track sizes change. */
  onBayTracksChange?: (tracks: TrackSize[]) => void;
  /** Calculated bounding boxes of all bays in the module. */
  bayBoxes?: BayBoundingBox[];
  /** Currently active bay index. */
  currentActiveIndex: number;
  /** Callback fired when active bay selection changes. */
  onActiveBayIndexChange?: (idx: number) => void;
}

/**
 * Section for configuring bay subdivisions (1 bay, 2 bays, 3 bays, 2 horizontal levels, or complex matrix).
 */
export function DistributionSection({
  gridType = '1-bay',
  onGridTypeChange,
  activeBay,
  onOpenDistributionModal,
  bayTracks,
  onBayTracksChange,
  bayBoxes = [],
  currentActiveIndex,
  onActiveBayIndexChange,
}: DistributionSectionProps): ReactElement {
  return (
    <fieldset className="builder-section">
      <legend className="builder-section-title">
        <span>🔲 Distribución de Vanos</span>
      </legend>
      <div className="form-group">
        <label>Divisiones del mueble:</label>
        <div className="builder-segmented-group" role="group" aria-label="Distribución de vanos">
          <button
            type="button"
            className={`builder-segmented-btn ${gridType === '1-bay' ? 'selected' : ''}`}
            onClick={() => onGridTypeChange?.('1-bay')}
          >
            1 Vano único
          </button>
          <button
            type="button"
            className={`builder-segmented-btn ${gridType === '2-bays-vertical' ? 'selected' : ''}`}
            onClick={() => onGridTypeChange?.('2-bays-vertical')}
          >
            2 Vanos (Parante)
          </button>
          <button
            type="button"
            className={`builder-segmented-btn ${gridType === '3-bays-vertical' ? 'selected' : ''}`}
            onClick={() => onGridTypeChange?.('3-bays-vertical')}
          >
            3 Vanos
          </button>
          <button
            type="button"
            className={`builder-segmented-btn ${gridType === '2-bays-horizontal' ? 'selected' : ''}`}
            onClick={() => onGridTypeChange?.('2-bays-horizontal')}
          >
            2 Niveles
          </button>
        </div>
      </div>

      {/* Acceso Directo y Destacado a Edición Especial de Vanos (Matriz / Celdas Libres) */}
      <div style={{ marginTop: '0.65rem', marginBottom: '0.5rem' }}>
        <button
          type="button"
          className={`builder-segmented-btn ${activeBay.type === 'subdivided' ? 'selected' : ''}`}
          onClick={onOpenDistributionModal}
          style={{
            width: '100%',
            minHeight: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0.65rem 1rem',
            fontWeight: 700,
            fontSize: '0.88rem',
            border: activeBay.type === 'subdivided'
              ? '2px solid var(--md-sys-color-primary)'
              : '1.5px dashed var(--md-sys-color-primary)',
            backgroundColor: activeBay.type === 'subdivided'
              ? 'var(--md-sys-color-primary-container)'
              : 'var(--md-sys-color-surface-container-high)',
            color: activeBay.type === 'subdivided'
              ? 'var(--md-sys-color-on-primary-container)'
              : 'var(--md-sys-color-primary)',
            borderRadius: '12px',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
          }}
        >
          <span style={{ fontSize: '1.15rem' }}>🍱</span>
          <span>
            {activeBay.type === 'subdivided'
              ? 'Editar Distribución Especial (Matriz de Celdas estilo Word)...'
              : 'Edición Especial: Matriz de Celdas estilo Word (Divisiones Libres)...'}
          </span>
        </button>
      </div>

      {gridType && gridType !== '1-bay' && (
        <div
          className="form-group"
          style={{
            padding: '0.75rem',
            backgroundColor: 'var(--md-sys-color-surface-container-low)',
            borderRadius: 'var(--md-sys-shape-corner-sm)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            marginTop: '0.5rem',
          }}
        >
          <label
            htmlFor="input-bay-grid-tracks"
            style={{
              fontWeight: 600,
              color: 'var(--md-sys-color-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              marginBottom: '0.35rem',
            }}
          >
            📐 Distribución de vanos (mm, fr o mixto):
          </label>
          <BayTracksInput
            tracks={
              bayTracks && bayTracks.length > 0
                ? bayTracks
                : gridType === '3-bays-vertical'
                ? [
                    { type: 'fractional', valueFr: 1 },
                    { type: 'fractional', valueFr: 1 },
                    { type: 'fractional', valueFr: 1 },
                  ]
                : [
                    { type: 'fractional', valueFr: 1 },
                    { type: 'fractional', valueFr: 1 },
                  ]
            }
            axis={gridType === '2-bays-horizontal' ? 'vertical' : 'horizontal'}
            onChange={onBayTracksChange}
          />

          {/* Visual preview of bays with calculated interior widths */}
          {bayBoxes && bayBoxes.length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--md-sys-color-on-surface-variant)',
                  display: 'block',
                  marginBottom: '0.35rem',
                }}
              >
                📊 Medidas libres por vano (luz interior neta):
              </span>
              <div
                style={{
                  display: 'flex',
                  flexDirection: gridType === '2-bays-horizontal' ? 'column' : 'row',
                  gap: '4px',
                  width: '100%',
                  borderRadius: '6px',
                  overflow: 'hidden',
                }}
              >
                {bayBoxes.map((bb, bIdx) => {
                  const isSelected = currentActiveIndex === bIdx;
                  const dimLabel =
                    gridType === '2-bays-horizontal'
                      ? `${Math.round(bb.height)} mm alto`
                      : `${Math.round(bb.width)} mm ancho`;
                  return (
                    <button
                      key={bIdx}
                      type="button"
                      onClick={() => onActiveBayIndexChange?.(bIdx)}
                      style={{
                        flex: gridType === '2-bays-horizontal' ? undefined : (bb.width || 1),
                        height: gridType === '2-bays-horizontal' ? '32px' : '44px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: isSelected
                          ? 'var(--md-sys-color-primary)'
                          : 'var(--md-sys-color-surface-container-high)',
                        color: isSelected
                          ? 'var(--md-sys-color-on-primary)'
                          : 'var(--md-sys-color-on-surface)',
                        border: isSelected
                          ? '2px solid var(--md-sys-color-primary)'
                          : '1px solid var(--md-sys-color-outline-variant)',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        padding: '0.2rem 0.4rem',
                        transition: 'all 0.15s ease',
                      }}
                      title={`Clic para equipar Vano ${bIdx + 1} (${dimLabel})`}
                    >
                      <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                        Vano {bIdx + 1} {isSelected ? '●' : ''}
                      </span>
                      <span style={{ fontSize: '0.7rem', opacity: 0.9 }}>
                        {dimLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </fieldset>
  );
}
