import type { ReactElement } from 'react';
import type {
  BayContent,
  TrackSize,
  DrawerType,
  DrawerBottomMount,
  DrawerFrontMount,
  DrawerSlideType,
  DoorMountType,
} from '../resolver';
import { DrawerTracksInput } from './DrawerTracksInput';
import {
  DrawerTypeStandardDiagram,
  DrawerTypeSimpleInteriorDiagram,
  DrawerBottomGroovedDiagram,
  DrawerBottomScrewedDiagram,
  DrawerBottomFlushThickDiagram,
  DrawerFrontAppliedDiagram,
  DrawerFrontInsetDiagram,
  DrawerTransomsWithDividerDiagram,
  DrawerTransomsContinuousDiagram,
  DrawerSlideTelescopicDiagram,
  DrawerSlideUndermountDiagram,
} from './DrawerDiagrams';
import { DrawerDistributionVisualizer } from './DrawerDistributionVisualizer';

/**
 * Props for the InteriorSection component.
 */
export interface InteriorSectionProps {
  /** Total number of bays in the module. */
  currentBayCount: number;
  /** Currently active bay index [0..currentBayCount-1]. */
  currentActiveIndex: number;
  /** Callback fired when the active bay tab changes. */
  onActiveBayIndexChange?: (idx: number) => void;
  /** Active bay configuration object. */
  activeBay: BayContent;
  /** Callback fired when the active bay component type changes. */
  onBayContentTypeChange?: (
    bayIndex: number,
    type: 'empty' | 'shelves' | 'drawer-stack' | 'doors' | 'pull-out-tray' | 'bi-fold-closure' | 'subdivided',
  ) => void;
  /** Callback to open the complex subdivided distribution modal. */
  onOpenDistributionModal: () => void;
  /** Callback to remove a drawer from the active bay. */
  onRemoveDrawer?: (bayIndex: number) => void;
  /** Callback to add a drawer to the active bay. */
  onAddDrawer?: (bayIndex: number) => void;
  /** Callback fired when drawer track proportions change. */
  onDrawerTracksChange?: (bayIndex: number, tracks: TrackSize[]) => void;
  /** Calculated real heights in mm for each drawer. */
  resolvedDrawerHeights: number[];
  /** Estimated net internal cavity height in mm. */
  estimatedBayCavityHeight: number;
  /** Callback fired when drawer type (standard vs simple-interior) changes. */
  onDrawerTypeChange?: (bayIndex: number, type: DrawerType) => void;
  /** Callback fired when drawer top pull gap changes. */
  onDrawerTopPullGapChange?: (bayIndex: number, gapMm: number) => void;
  /** Callback fired when drawer box side offset height changes. */
  onDrawerBoxSideHeightOffsetChange?: (bayIndex: number, offsetMm: number) => void;
  /** Callback fired when drawer bottom mount method changes. */
  onDrawerBottomMountChange?: (bayIndex: number, mount: DrawerBottomMount) => void;
  /** Callback fired when drawer front mount method changes. */
  onDrawerFrontMountChange?: (bayIndex: number, mount: DrawerFrontMount) => void;
  /** Callback fired when drawer transoms presence changes. */
  onDrawerTransomsChange?: (bayIndex: number, hasTransoms: boolean) => void;
  /** Overall module width in mm (used for wide drawer warnings). */
  width: number;
  /** Maximum allowable single-drawer span in mm. */
  maxDrawerSpanMm?: number;
  /** Module bay grid type. */
  gridType?: string;
  /** Callback fired when drawer slide type changes. */
  onDrawerSlideTypeChange?: (bayIndex: number, slide: DrawerSlideType) => void;
  /** Callback fired when drawer slide lateral clearance changes. */
  onDrawerSlideClearanceChange?: (bayIndex: number, clearanceMm: number) => void;
  /** Callback fired when drawer front vertical gap changes. */
  onDrawerGapChange?: (bayIndex: number, gapMm: number) => void;
  /** Callback to remove a shelf from the active bay. */
  onRemoveShelf?: (bayIndex: number) => void;
  /** Callback to add a shelf to the active bay. */
  onAddShelf?: (bayIndex: number) => void;
  /** Callback fired when shelf track proportions change. */
  onShelfTracksChange?: (bayIndex: number, tracks: TrackSize[]) => void;
  /** Quick preset recipes for shelf track proportions. */
  shelfQuickRecipes: Array<{ label: string; tracks: TrackSize[] }>;
  /** Calculated real heights in mm for each shelf cavity. */
  resolvedShelfHeights: number[];
  /** Callback fired when shelf mounting type (adjustable vs fixed) changes. */
  onShelfTypeChange?: (bayIndex: number, type: 'adjustable' | 'fixed') => void;
  /** Callback fired when anti-sag reinforcement brace changes. */
  onShelfAntiSagChange?: (bayIndex: number, hasAntiSag: boolean) => void;
  /** Callback fired when shelf door presence changes. */
  onShelfHasDoorsChange?: (bayIndex: number, hasDoors: boolean) => void;
  /** Callback fired when shelf door count changes. */
  onShelfDoorCountChange?: (bayIndex: number, count: 1 | 2) => void;
  /** Callback fired when shelf door hinge mount type changes. */
  onShelfDoorMountTypeChange?: (bayIndex: number, mount: DoorMountType) => void;
  /** Callback fired when single door hinge side changes. */
  onShelfDoorHingeSideChange?: (bayIndex: number, hingeSide: 'left' | 'right') => void;
  /** Callback fired when standalone door count changes. */
  onDoorCountChange?: (bayIndex: number, count: 1 | 2) => void;
  /** Callback fired when standalone door hinge mount type changes. */
  onDoorMountTypeChange?: (bayIndex: number, mount: DoorMountType) => void;
  /** Callback fired when count of interior shelves behind doors changes. */
  onDoorInteriorShelvesCountChange?: (bayIndex: number, count: number) => void;
  /** Callback fired when interior shelf type behind doors changes. */
  onDoorShelfTypeChange?: (bayIndex: number, shelfType: 'adjustable' | 'fixed') => void;
  /** Callback fired when bi-fold opening direction changes. */
  onBifoldDirectionChange?: (bayIndex: number, dir: 'vertical-lift' | 'horizontal-book') => void;
}

/**
 * Section for configuring interior equipment in each bay (drawers, shelves, doors, tray, bi-fold).
 */
export function InteriorSection({
  currentBayCount,
  currentActiveIndex,
  onActiveBayIndexChange,
  activeBay,
  onBayContentTypeChange,
  onOpenDistributionModal,
  onRemoveDrawer,
  onAddDrawer,
  onDrawerTracksChange,
  resolvedDrawerHeights,
  estimatedBayCavityHeight,
  onDrawerTypeChange,
  onDrawerTopPullGapChange,
  onDrawerBoxSideHeightOffsetChange,
  onDrawerBottomMountChange,
  onDrawerFrontMountChange,
  onDrawerTransomsChange,
  width,
  maxDrawerSpanMm = 900,
  gridType,
  onDrawerSlideTypeChange,
  onDrawerSlideClearanceChange,
  onDrawerGapChange,
  onRemoveShelf,
  onAddShelf,
  onShelfTracksChange,
  shelfQuickRecipes,
  resolvedShelfHeights,
  onShelfTypeChange,
  onShelfAntiSagChange,
  onShelfHasDoorsChange,
  onShelfDoorCountChange,
  onShelfDoorMountTypeChange,
  onShelfDoorHingeSideChange,
  onDoorCountChange,
  onDoorMountTypeChange,
  onDoorInteriorShelvesCountChange,
  onDoorShelfTypeChange,
  onBifoldDirectionChange,
}: InteriorSectionProps): ReactElement {
  return (
    <fieldset className="builder-section">
      <legend className="builder-section-title">
        <span>🚪 Equipamiento Interior</span>
      </legend>

      {/* Pestañas si hay más de 1 vano */}
      {currentBayCount > 1 && (
        <div className="builder-bay-tab-row" role="tablist" aria-label="Seleccionar vano para equipar">
          {Array.from({ length: currentBayCount }, (_, idx) => (
            <button
              key={idx}
              type="button"
              className={`m3-chip ${currentActiveIndex === idx ? 'm3-chip--selected' : ''}`}
              onClick={() => onActiveBayIndexChange?.(idx)}
              role="tab"
              aria-selected={currentActiveIndex === idx}
            >
              Vano {idx + 1} {idx === 0 ? '(Izq)' : idx === 1 ? '(Der)' : `(${idx + 1})`}
            </button>
          ))}
        </div>
      )}

      {/* Tipo de componente en el vano activo */}
      <div className="form-group">
        <label>¿Qué querés armar en este vano?</label>
        <div className="builder-chip-selector" role="group" aria-label="Componente interior">
          <button
            type="button"
            className={`builder-segmented-btn ${activeBay.type === 'drawer-stack' ? 'selected' : ''}`}
            onClick={() => onBayContentTypeChange?.(currentActiveIndex, 'drawer-stack')}
          >
            🗄️ Cajones
          </button>
          <button
            type="button"
            className={`builder-segmented-btn ${activeBay.type === 'shelves' ? 'selected' : ''}`}
            onClick={() => onBayContentTypeChange?.(currentActiveIndex, 'shelves')}
          >
            📚 Estantes
          </button>
          <button
            type="button"
            className={`builder-segmented-btn ${activeBay.type === 'doors' ? 'selected' : ''}`}
            onClick={() => onBayContentTypeChange?.(currentActiveIndex, 'doors')}
          >
            🚪 Puertas
          </button>
          <button
            type="button"
            className={`builder-segmented-btn ${activeBay.type === 'pull-out-tray' ? 'selected' : ''}`}
            onClick={() => onBayContentTypeChange?.(currentActiveIndex, 'pull-out-tray')}
          >
            📥 Bandeja
          </button>
          <button
            type="button"
            className={`builder-segmented-btn ${activeBay.type === 'bi-fold-closure' ? 'selected' : ''}`}
            onClick={() => onBayContentTypeChange?.(currentActiveIndex, 'bi-fold-closure')}
          >
            🔼 Bi-Fold
          </button>
          <button
            type="button"
            className={`builder-segmented-btn ${activeBay.type === 'empty' ? 'selected' : ''}`}
            onClick={() => onBayContentTypeChange?.(currentActiveIndex, 'empty')}
          >
            ⬜ Libre
          </button>
        </div>

        {/* Botón para abrir el Modal de Distribución Compleja (Matriz estilo Word) */}
        <div style={{ marginTop: '0.75rem' }}>
          <button
            type="button"
            className={`builder-segmented-btn ${activeBay.type === 'subdivided' ? 'selected' : ''}`}
            onClick={onOpenDistributionModal}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.65rem 1rem',
              fontWeight: 600,
              border: activeBay.type === 'subdivided'
                ? '2px solid var(--md-sys-color-primary)'
                : '1px dashed var(--md-sys-color-primary)',
              backgroundColor: activeBay.type === 'subdivided'
                ? 'var(--md-sys-color-primary-container)'
                : 'var(--md-sys-color-surface-container-low)',
              color: 'var(--md-sys-color-primary)',
              borderRadius: 'var(--md-sys-shape-corner-sm)',
              cursor: 'pointer',
            }}
          >
            <span>📐</span>
            <span>
              {activeBay.type === 'subdivided'
                ? 'Editar Distribución Compleja (Matriz)...'
                : 'Diseñar Distribución Compleja (Matriz / Mixto)...'}
            </span>
          </button>
        </div>
      </div>

      {/* Controles para Cajones (Stage 2 Step A: Grupos ergonómicos y diagramas) */}
      {activeBay.type === 'drawer-stack' && (
        <div id="drawer-section-after" className="drawer-section-container" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>

          {/* GRUPO 1: Distribución de frentes */}
          <div className="drawer-group">
            <h3 className="drawer-group-title">Distribución de frentes</h3>

            {/* Fila 2 columnas: Cantidad de cajones y Luz entre frentes */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem', marginBottom: '0.35rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="drawer-field-label">Cantidad de cajones:</label>
                <div className="m3-stepper-field">
                  <button
                    type="button"
                    className="m3-stepper-btn"
                    aria-label="Quitar un cajón"
                    onClick={() => onRemoveDrawer?.(currentActiveIndex)}
                  >
                    −
                  </button>
                  <div className="builder-stepper-display">
                    {`${activeBay.drawerTracks.length} Cajones`}
                  </div>
                  <button
                    type="button"
                    className="m3-stepper-btn"
                    aria-label="Agregar un cajón"
                    onClick={() => onAddDrawer?.(currentActiveIndex)}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="drawer-field-label">Separación entre frentes (luz):</label>
                <div className="m3-stepper-field">
                  <button
                    type="button"
                    className="m3-stepper-btn"
                    aria-label="Disminuir separación entre cajones 0.5 mm"
                    onClick={() => {
                      const currentGap = activeBay.gapMm ?? 2.5;
                      onDrawerGapChange?.(currentActiveIndex, Math.max(1.0, Math.round((currentGap - 0.5) * 10) / 10));
                    }}
                  >
                    −
                  </button>
                  <div className="builder-stepper-display">
                    {`${(activeBay.gapMm ?? 2.5).toFixed(1)} mm`}
                  </div>
                  <button
                    type="button"
                    className="m3-stepper-btn"
                    aria-label="Aumentar separación entre cajones 0.5 mm"
                    onClick={() => {
                      const currentGap = activeBay.gapMm ?? 2.5;
                      onDrawerGapChange?.(currentActiveIndex, Math.min(8.0, Math.round((currentGap + 0.5) * 10) / 10));
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Visualizador de proporción y alturas a escala (Step A) */}
            <DrawerDistributionVisualizer
              tracks={activeBay.drawerTracks}
              resolvedDrawerHeights={resolvedDrawerHeights}
              estimatedBayCavityHeight={estimatedBayCavityHeight}
              onChangeTracks={(tracks) => onDrawerTracksChange?.(currentActiveIndex, tracks)}
            />

            {/* Montaje de frentes (solo si no es simple interior) */}
            {activeBay.drawerType !== 'simple-interior' && (
              <div className="form-group" style={{ marginTop: '0.35rem', marginBottom: 0 }}>
                <label className="drawer-field-label">Montaje de frentes:</label>
                <div className="drawer-segmented-row" role="radiogroup" aria-label="Montaje de frentes">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={activeBay.frontMount === 'applied' || !activeBay.frontMount}
                    className={`drawer-option-btn ${activeBay.frontMount === 'applied' || !activeBay.frontMount ? 'drawer-option-btn--selected' : ''}`}
                    onClick={() => onDrawerFrontMountChange?.(currentActiveIndex, 'applied')}
                  >
                    <DrawerFrontAppliedDiagram />
                    <span className="drawer-option-label">Aplicado (Solapado)</span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={activeBay.frontMount === 'inset'}
                    className={`drawer-option-btn ${activeBay.frontMount === 'inset' ? 'drawer-option-btn--selected' : ''}`}
                    onClick={() => onDrawerFrontMountChange?.(currentActiveIndex, 'inset')}
                  >
                    <DrawerFrontInsetDiagram />
                    <span className="drawer-option-label">Embutido</span>
                  </button>
                </div>
              </div>
            )}

            {/* Travesaños horizontales separadores para cajones embutidos */}
            {activeBay.drawerType !== 'simple-interior' && activeBay.frontMount === 'inset' && (
              <div className="form-group" style={{ marginTop: '0.35rem', marginBottom: 0 }}>
                <label className="drawer-field-label">Travesaños horizontales entre cajones:</label>
                <div className="drawer-segmented-row" role="radiogroup" aria-label="Travesaños horizontales entre cajones">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={Boolean(activeBay.hasTransomDividers)}
                    className={`drawer-option-btn ${activeBay.hasTransomDividers ? 'drawer-option-btn--selected' : ''}`}
                    onClick={() => onDrawerTransomsChange?.(currentActiveIndex, true)}
                  >
                    <DrawerTransomsWithDividerDiagram />
                    <span className="drawer-option-label">Con fajas separadoras</span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={!activeBay.hasTransomDividers}
                    className={`drawer-option-btn ${!activeBay.hasTransomDividers ? 'drawer-option-btn--selected' : ''}`}
                    onClick={() => onDrawerTransomsChange?.(currentActiveIndex, false)}
                  >
                    <DrawerTransomsContinuousDiagram />
                    <span className="drawer-option-label">Sin fajas (frente corrido)</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* GRUPO 2: Caja del cajón */}
          <div className="drawer-group">
            <h3 className="drawer-group-title">Caja del cajón</h3>

            <div className="form-group">
              <label className="drawer-field-label">Tipo de cajón:</label>
              <div className="drawer-segmented-row" role="radiogroup" aria-label="Tipo de cajón">
                <button
                  type="button"
                  role="radio"
                  aria-checked={activeBay.drawerType !== 'simple-interior'}
                  className={`drawer-option-btn ${activeBay.drawerType !== 'simple-interior' ? 'drawer-option-btn--selected' : ''}`}
                  onClick={() => onDrawerTypeChange?.(currentActiveIndex, 'standard')}
                >
                  <DrawerTypeStandardDiagram />
                  <span className="drawer-option-label">Estándar (Doble frente)</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={activeBay.drawerType === 'simple-interior'}
                  className={`drawer-option-btn ${activeBay.drawerType === 'simple-interior' ? 'drawer-option-btn--selected' : ''}`}
                  onClick={() => onDrawerTypeChange?.(currentActiveIndex, 'simple-interior')}
                >
                  <DrawerTypeSimpleInteriorDiagram />
                  <span className="drawer-option-label">Simple Interior (Placard / 1 tapa)</span>
                </button>
              </div>
            </div>

            {/* Opciones dependientes para cajón simple interior de placard */}
            {activeBay.drawerType === 'simple-interior' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', marginTop: '0.4rem', padding: '0.5rem', backgroundColor: 'var(--md-sys-color-surface-container-low)', borderRadius: 'var(--md-sys-shape-corner-sm)', border: '1px solid var(--md-sys-color-outline-variant)' }}>
                <div>
                  <label htmlFor="drawer-top-pull" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                    Ranura superior para tirar:
                  </label>
                  <select
                    id="drawer-top-pull"
                    className="m3-select"
                    style={{ width: '100%', fontSize: '0.85rem' }}
                    value={activeBay.topPullGapMm ?? 0}
                    onChange={(e) => onDrawerTopPullGapChange?.(currentActiveIndex, Number(e.target.value))}
                  >
                    <option value="0">0 mm (Con tirador)</option>
                    <option value="25">25 mm (Mano / Uñero)</option>
                    <option value="30">30 mm (Acceso estándar)</option>
                    <option value="35">35 mm (Acceso amplio)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="drawer-side-offset" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                    Laterales más bajos que frente:
                  </label>
                  <select
                    id="drawer-side-offset"
                    className="m3-select"
                    style={{ width: '100%', fontSize: '0.85rem' }}
                    value={activeBay.boxSideHeightOffsetMm ?? 0}
                    onChange={(e) => onDrawerBoxSideHeightOffsetChange?.(currentActiveIndex, Number(e.target.value))}
                  >
                    <option value="0">Misma altura</option>
                    <option value="30">30 mm más bajos</option>
                    <option value="40">40 mm más bajos</option>
                    <option value="50">50 mm más bajos</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* GRUPO 3: Fondo */}
          <div className="drawer-group">
            <h3 className="drawer-group-title">Fondo</h3>

            <div className="form-group">
              <label className="drawer-field-label">Construcción del fondo:</label>
              <div className="drawer-segmented-row drawer-segmented-row--3col" role="radiogroup" aria-label="Construcción del fondo">
                <button
                  type="button"
                  role="radio"
                  aria-checked={activeBay.bottomMount === 'grooved'}
                  className={`drawer-option-btn ${activeBay.bottomMount === 'grooved' ? 'drawer-option-btn--selected' : ''}`}
                  onClick={() => onDrawerBottomMountChange?.(currentActiveIndex, 'grooved')}
                >
                  <DrawerBottomGroovedDiagram />
                  <span className="drawer-option-label">Ranurado (3-6mm)</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={!activeBay.bottomMount || activeBay.bottomMount === 'bottom-screwed'}
                  className={`drawer-option-btn ${!activeBay.bottomMount || activeBay.bottomMount === 'bottom-screwed' ? 'drawer-option-btn--selected' : ''}`}
                  onClick={() => onDrawerBottomMountChange?.(currentActiveIndex, 'bottom-screwed')}
                >
                  <DrawerBottomScrewedDiagram />
                  <span className="drawer-option-label">Atornillado</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={activeBay.bottomMount === 'flush-thick'}
                  className={`drawer-option-btn ${activeBay.bottomMount === 'flush-thick' ? 'drawer-option-btn--selected' : ''}`}
                  onClick={() => onDrawerBottomMountChange?.(currentActiveIndex, 'flush-thick')}
                >
                  <DrawerBottomFlushThickDiagram />
                  <span className="drawer-option-label">Embutido (18mm)</span>
                </button>
              </div>
            </div>
          </div>

          {/* GRUPO 4: Herrajes */}
          <div className="drawer-group">
            <h3 className="drawer-group-title">Herrajes</h3>

            <div className="form-group">
              <label className="drawer-field-label">Tipo de correderas:</label>
              <div className="drawer-segmented-row" role="radiogroup" aria-label="Tipo de correderas">
                <button
                  type="button"
                  role="radio"
                  aria-checked={activeBay.slideType === 'telescopic' || !activeBay.slideType}
                  className={`drawer-option-btn ${activeBay.slideType === 'telescopic' || !activeBay.slideType ? 'drawer-option-btn--selected' : ''}`}
                  onClick={() => onDrawerSlideTypeChange?.(currentActiveIndex, 'telescopic')}
                >
                  <DrawerSlideTelescopicDiagram />
                  <span className="drawer-option-label">Telescópicas (25.4mm)</span>
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={activeBay.slideType === 'undermount'}
                  className={`drawer-option-btn ${activeBay.slideType === 'undermount' ? 'drawer-option-btn--selected' : ''}`}
                  onClick={() => onDrawerSlideTypeChange?.(currentActiveIndex, 'undermount')}
                >
                  <DrawerSlideUndermountDiagram />
                  <span className="drawer-option-label">Ocultas (Bajo Fondo)</span>
                </button>
              </div>
            </div>

            {/* Holgura lateral de correderas */}
            <div className="form-group" style={{ marginTop: '0.25rem' }}>
              <label className="drawer-field-label">Holgura lateral total de correderas:</label>
              <div className="m3-stepper-field">
                <button
                  type="button"
                  className="m3-stepper-btn"
                  aria-label="Disminuir holgura de correderas 0.5 mm"
                  onClick={() => {
                    const current = activeBay.slideClearanceMm ?? (activeBay.slideType === 'undermount' ? 10.0 : 25.4);
                    onDrawerSlideClearanceChange?.(currentActiveIndex, Math.max(5.0, Math.round((current - 0.5) * 10) / 10));
                  }}
                >
                  −
                </button>
                <div className="builder-stepper-display">
                  {`${(activeBay.slideClearanceMm ?? (activeBay.slideType === 'undermount' ? 10.0 : 25.4)).toFixed(1)} mm`}
                </div>
                <button
                  type="button"
                  className="m3-stepper-btn"
                  aria-label="Aumentar holgura de correderas 0.5 mm"
                  onClick={() => {
                    const current = activeBay.slideClearanceMm ?? (activeBay.slideType === 'undermount' ? 10.0 : 25.4);
                    onDrawerSlideClearanceChange?.(currentActiveIndex, Math.min(50.0, Math.round((current + 0.5) * 10) / 10));
                  }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Advertencia si supera luz máxima */}
            {width > maxDrawerSpanMm && (!gridType || gridType === '1-bay') && (
              <div
                className="m3-alert-banner warning"
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--md-sys-color-warning-container)',
                  border: '1px solid var(--md-sys-color-warning-border)',
                  color: 'var(--md-sys-color-on-warning-container)',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '0.5rem',
                }}
              >
                <span>⚠️</span>
                <span>
                  <strong>Cajón muy ancho ({width} mm):</strong> Supera el estándar de {maxDrawerSpanMm} mm. Conviene dividir el mueble en 2 vanos verticales para asegurar el buen funcionamiento de las correderas.
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Controles para Estantes */}
      {activeBay.type === 'shelves' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="form-group">
            <label>Cantidad de estantes:</label>
            <div className="m3-stepper-field">
              <button
                type="button"
                className="m3-stepper-btn"
                aria-label="Quitar un estante"
                onClick={() => onRemoveShelf?.(currentActiveIndex)}
              >
                −
              </button>
              <div className="builder-stepper-display">
                {`${activeBay.count} ${activeBay.count === 1 ? 'Estante' : 'Estantes'}`}
              </div>
              <button
                type="button"
                className="m3-stepper-btn"
                aria-label="Agregar un estante"
                onClick={() => onAddShelf?.(currentActiveIndex)}
              >
                +
              </button>
            </div>
          </div>

          {/* Definición de pistas estilo CSS Grid (Proporciones y Medidas) */}
          <div className="form-group" style={{ padding: '0.75rem', backgroundColor: 'var(--md-sys-color-surface-container-low)', borderRadius: 'var(--md-sys-shape-corner-sm)', border: '1px solid var(--md-sys-color-outline-variant)' }}>
            <label htmlFor="input-shelf-tracks" style={{ fontWeight: 600, color: 'var(--md-sys-color-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
              📐 Medidas de vanos/espacios (mm, fr o mixto):
            </label>
            <DrawerTracksInput
              tracks={
                activeBay.shelfTracks && activeBay.shelfTracks.length > 1
                  ? activeBay.shelfTracks
                  : Array.from({ length: Math.max(1, activeBay.count) + 1 }, () => ({ type: 'fractional' as const, valueFr: 1 }))
              }
              onChange={(parsed) => onShelfTracksChange?.(currentActiveIndex, parsed)}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
              <span style={{ font: 'var(--md-sys-typescale-label-small)', color: 'var(--md-sys-color-on-surface-variant)', marginRight: '0.25rem' }}>
                Atajos rápidos:
              </span>
              {shelfQuickRecipes.map((recipe, rIdx) => (
                <button
                  key={rIdx}
                  type="button"
                  className="m3-chip"
                  style={{ height: '30px', padding: '0 0.65rem', fontSize: '0.78rem' }}
                  onClick={() =>
                    onShelfTracksChange?.(currentActiveIndex, recipe.tracks)
                  }
                >
                  {recipe.label}
                </button>
              ))}
            </div>
          </div>

          {/* Visualizador de proporción y alturas calculadas */}
          {resolvedShelfHeights.length > 0 && (
            <div className="form-group" style={{ padding: '0.65rem', backgroundColor: 'var(--md-sys-color-surface-container-low)', borderRadius: 'var(--md-sys-shape-corner-sm)', border: '1px solid var(--md-sys-color-outline-variant)' }}>
              <span style={{ font: 'var(--md-sys-typescale-label-medium)', fontWeight: 600, color: 'var(--md-sys-color-primary)', display: 'block', marginBottom: '0.4rem' }}>
                📊 Luz libre calculada por vano ({estimatedBayCavityHeight} mm interior):
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', borderRadius: '4px', overflow: 'hidden' }}>
                {resolvedShelfHeights.map((h, i) => {
                  const currentTracks =
                    activeBay.shelfTracks && activeBay.shelfTracks.length > 1
                      ? activeBay.shelfTracks
                      : Array.from({ length: Math.max(1, activeBay.count) + 1 }, () => ({ type: 'fractional' as const, valueFr: 1 }));
                  const track = currentTracks[i];
                  const isFixed = track?.type === 'fixed';
                  const trackLabel = isFixed ? `${track.valueMm}mm fijo` : `${track?.valueFr ?? 1}fr prop.`;
                  const pct = Math.max(14, Math.round((h / Math.max(1, estimatedBayCavityHeight)) * 100));
                  return (
                    <div
                      key={i}
                      style={{
                        minHeight: `${Math.max(28, Math.round(pct * 0.75))}px`,
                        backgroundColor: isFixed ? 'var(--md-sys-color-tertiary-container)' : 'var(--md-sys-color-primary-container)',
                        color: isFixed ? 'var(--md-sys-color-on-tertiary-container)' : 'var(--md-sys-color-on-primary-container)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                      }}
                    >
                      <span>{`Vano ${i + 1}${i === 0 ? ' (Inferior)' : i === resolvedShelfHeights.length - 1 ? ' (Superior)' : ''}: (${trackLabel})`}</span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{`${h} mm`}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="form-group">
            <label>Tipo de fijación:</label>
            <div className="builder-segmented-group">
              <button
                type="button"
                className={`builder-segmented-btn ${activeBay.shelfType === 'adjustable' ? 'selected' : ''}`}
                onClick={() => {
                  onShelfTypeChange?.(currentActiveIndex, 'adjustable');
                  if (activeBay.hasAntiSagBrace) {
                    onShelfAntiSagChange?.(currentActiveIndex, false);
                  }
                }}
              >
                Regulables (Pitagones 5mm)
              </button>
              <button
                type="button"
                className={`builder-segmented-btn ${activeBay.shelfType === 'fixed' ? 'selected' : ''}`}
                onClick={() => onShelfTypeChange?.(currentActiveIndex, 'fixed')}
              >
                Fijos (Confirmats)
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Refuerzo antialabeo (Faja frontal en L):</label>
            <div className="builder-segmented-group">
              <button
                type="button"
                className={`builder-segmented-btn ${activeBay.hasAntiSagBrace ? 'selected' : ''}`}
                onClick={() => {
                  onShelfAntiSagChange?.(currentActiveIndex, true);
                  if (activeBay.shelfType !== 'fixed') {
                    onShelfTypeChange?.(currentActiveIndex, 'fixed');
                  }
                }}
                title="Faja estructural frontal de canto (60mm) anclada a los laterales y bajo el estante fijo"
              >
                Con faja de refuerzo (Fijo)
              </button>
              <button
                type="button"
                className={`builder-segmented-btn ${!activeBay.hasAntiSagBrace ? 'selected' : ''}`}
                onClick={() => onShelfAntiSagChange?.(currentActiveIndex, false)}
              >
                Sin refuerzo
              </button>
            </div>
            {activeBay.hasAntiSagBrace && (
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                💡 Faja frontal en L de lateral a lateral, atornillada a costados y bajo el estante fijo.
              </p>
            )}
          </div>

          {/* Puertas frontales para el vano de estantes */}
          <div className="form-group" style={{ padding: '0.75rem', backgroundColor: 'var(--md-sys-color-surface-container-low)', borderRadius: 'var(--md-sys-shape-corner-sm)', border: '1px solid var(--md-sys-color-outline-variant)' }}>
            <label style={{ fontWeight: 600, color: 'var(--md-sys-color-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.5rem' }}>
              🚪 Puertas frontales en este vano:
            </label>
            <div className="builder-segmented-group" style={{ marginBottom: '0.5rem' }}>
              <button
                type="button"
                className={`builder-segmented-btn ${!activeBay.hasDoors ? 'selected' : ''}`}
                onClick={() => onShelfHasDoorsChange?.(currentActiveIndex, false)}
              >
                Abierto (Sin puertas)
              </button>
              <button
                type="button"
                className={`builder-segmented-btn ${activeBay.hasDoors && (activeBay.doorCount ?? 1) === 1 ? 'selected' : ''}`}
                onClick={() => {
                  onShelfHasDoorsChange?.(currentActiveIndex, true);
                  onShelfDoorCountChange?.(currentActiveIndex, 1);
                }}
              >
                1 Puerta batiente
              </button>
              <button
                type="button"
                className={`builder-segmented-btn ${activeBay.hasDoors && activeBay.doorCount === 2 ? 'selected' : ''}`}
                onClick={() => {
                  onShelfHasDoorsChange?.(currentActiveIndex, true);
                  onShelfDoorCountChange?.(currentActiveIndex, 2);
                }}
              >
                2 Puertas batientes
              </button>
            </div>

            {activeBay.hasDoors && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                {(activeBay.doorCount ?? 1) === 1 && (
                  <div>
                    <label style={{ fontSize: '0.82rem', marginBottom: '0.25rem', display: 'block' }}>Lado de apertura / bisagras:</label>
                    <div className="builder-segmented-group">
                      <button
                        type="button"
                        className={`builder-segmented-btn ${(activeBay.doorHingeSide ?? 'left') === 'left' ? 'selected' : ''}`}
                        onClick={() => onShelfDoorHingeSideChange?.(currentActiveIndex, 'left')}
                      >
                        Apertura hacia Izquierda (Bisagras Izq)
                      </button>
                      <button
                        type="button"
                        className={`builder-segmented-btn ${activeBay.doorHingeSide === 'right' ? 'selected' : ''}`}
                        onClick={() => onShelfDoorHingeSideChange?.(currentActiveIndex, 'right')}
                      >
                        Apertura hacia Derecha (Bisagras Der)
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label style={{ fontSize: '0.82rem', marginBottom: '0.25rem', display: 'block' }}>Montaje de bisagras:</label>
                  <div className="builder-segmented-group">
                    <button
                      type="button"
                      className={`builder-segmented-btn ${(activeBay.doorMountType ?? 'codo-0') === 'codo-0' ? 'selected' : ''}`}
                      onClick={() => onShelfDoorMountTypeChange?.(currentActiveIndex, 'codo-0')}
                    >
                      Aplicada / Parche (Codo 0)
                    </button>
                    <button
                      type="button"
                      className={`builder-segmented-btn ${activeBay.doorMountType === 'codo-9' ? 'selected' : ''}`}
                      onClick={() => onShelfDoorMountTypeChange?.(currentActiveIndex, 'codo-9')}
                    >
                      Semi-aplicada (Codo 9)
                    </button>
                    <button
                      type="button"
                      className={`builder-segmented-btn ${activeBay.doorMountType === 'codo-18' ? 'selected' : ''}`}
                      onClick={() => onShelfDoorMountTypeChange?.(currentActiveIndex, 'codo-18')}
                    >
                      Embutida / Interior (Codo 18)
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Controles para Puertas */}
      {activeBay.type === 'doors' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="form-group">
            <label>Cantidad de hojas:</label>
            <div className="builder-segmented-group">
              <button
                type="button"
                className={`builder-segmented-btn ${activeBay.count === 1 ? 'selected' : ''}`}
                onClick={() => onDoorCountChange?.(currentActiveIndex, 1)}
              >
                1 Puerta batiente
              </button>
              <button
                type="button"
                className={`builder-segmented-btn ${activeBay.count === 2 ? 'selected' : ''}`}
                onClick={() => onDoorCountChange?.(currentActiveIndex, 2)}
              >
                2 Puertas batientes
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Montaje de puerta (Bisagra cazoleta):</label>
            <div className="builder-segmented-group" role="group" aria-label="Tipo de bisagra cazoleta">
              <button
                type="button"
                className={`builder-segmented-btn ${activeBay.mountType === 'codo-0' || activeBay.mountType === 'full-overlay' || activeBay.mountType === 'overlay' ? 'selected' : ''}`}
                onClick={() => onDoorMountTypeChange?.(currentActiveIndex, 'codo-0')}
                title="Bisagra recta / Solapado total. Tapa el canto lateral (Base a 37mm)"
              >
                Codo 0 (Recta)
              </button>
              <button
                type="button"
                className={`builder-segmented-btn ${activeBay.mountType === 'codo-9' || activeBay.mountType === 'half-overlay' ? 'selected' : ''}`}
                onClick={() => onDoorMountTypeChange?.(currentActiveIndex, 'codo-9')}
                title="Bisagra acodada / Semi-solapada. Comparte tabique central (Base a 37mm)"
              >
                Codo 9 (Acodada)
              </button>
              <button
                type="button"
                className={`builder-segmented-btn ${activeBay.mountType === 'codo-18' || activeBay.mountType === 'inset' ? 'selected' : ''}`}
                onClick={() => onDoorMountTypeChange?.(currentActiveIndex, 'codo-18')}
                title="Bisagra superacodada / Embutida. Puerta dentro del vano (Base a 37mm + espesor)"
              >
                Codo 18 (Embutida)
              </button>
            </div>
          </div>

          {/* Estantes interiores detrás de puertas (Punto 3) */}
          <div className="form-group" style={{ marginTop: '0.25rem', borderTop: '1px solid var(--md-sys-color-outline-variant)', paddingTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
              <span>📚 Estantes interiores:</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)', fontWeight: 'normal' }}>
                ({activeBay.interiorShelvesCount ?? 0} estante{(activeBay.interiorShelvesCount ?? 0) === 1 ? '' : 's'})
              </span>
            </label>
            <div className="builder-segmented-group">
              {[0, 1, 2, 3].map((num) => (
                <button
                  key={num}
                  type="button"
                  className={`builder-segmented-btn ${(activeBay.interiorShelvesCount ?? 0) === num ? 'selected' : ''}`}
                  onClick={() => onDoorInteriorShelvesCountChange?.(currentActiveIndex, num)}
                >
                  {num === 0 ? 'Sin estantes' : `${num} est.`}
                </button>
              ))}
            </div>
          </div>

          {(activeBay.interiorShelvesCount ?? 0) > 0 && (
            <div className="form-group">
              <label>Fijación de estantes interiores:</label>
              <div className="builder-segmented-group">
                <button
                  type="button"
                  className={`builder-segmented-btn ${(activeBay.shelfType ?? 'adjustable') === 'adjustable' ? 'selected' : ''}`}
                  onClick={() => onDoorShelfTypeChange?.(currentActiveIndex, 'adjustable')}
                >
                  Ajustables (Pernos)
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${activeBay.shelfType === 'fixed' ? 'selected' : ''}`}
                  onClick={() => onDoorShelfTypeChange?.(currentActiveIndex, 'fixed')}
                >
                  Fijos (Confirmats)
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Controles para Bandeja Extraíble */}
      {activeBay.type === 'pull-out-tray' && (
        <div className="m3-alert m3-alert--info">
          <span className="m3-alert__icon" aria-hidden="true">📥</span>
          <div>
            <strong>Bandeja deslizable reforzada:</strong> Corredera telescópica con barandas laterales de retención de 45mm.
          </div>
        </div>
      )}

      {/* Controles para Bi-Fold */}
      {activeBay.type === 'bi-fold-closure' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div className="form-group">
            <label>Dirección de apertura:</label>
            <div className="builder-segmented-group">
              <button
                type="button"
                className={`builder-segmented-btn ${activeBay.openingDirection === 'vertical-lift' ? 'selected' : ''}`}
                onClick={() => onBifoldDirectionChange?.(currentActiveIndex, 'vertical-lift')}
              >
                Elevable Vertical (Aventos)
              </button>
              <button
                type="button"
                className={`builder-segmented-btn ${activeBay.openingDirection === 'horizontal-book' ? 'selected' : ''}`}
                onClick={() => onBifoldDirectionChange?.(currentActiveIndex, 'horizontal-book')}
              >
                Libro Horizontal
              </button>
            </div>
          </div>

          {/* Estantes interiores para bi-fold */}
          <div className="form-group" style={{ marginTop: '0.25rem', borderTop: '1px solid var(--md-sys-color-outline-variant)', paddingTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
              <span>📚 Estantes interiores:</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)', fontWeight: 'normal' }}>
                ({activeBay.interiorShelvesCount ?? 0} estante{(activeBay.interiorShelvesCount ?? 0) === 1 ? '' : 's'})
              </span>
            </label>
            <div className="builder-segmented-group">
              {[0, 1, 2, 3].map((num) => (
                <button
                  key={num}
                  type="button"
                  className={`builder-segmented-btn ${(activeBay.interiorShelvesCount ?? 0) === num ? 'selected' : ''}`}
                  onClick={() => onDoorInteriorShelvesCountChange?.(currentActiveIndex, num)}
                >
                  {num === 0 ? 'Sin estantes' : `${num} est.`}
                </button>
              ))}
            </div>
          </div>

          {(activeBay.interiorShelvesCount ?? 0) > 0 && (
            <div className="form-group">
              <label>Fijación de estantes interiores:</label>
              <div className="builder-segmented-group">
                <button
                  type="button"
                  className={`builder-segmented-btn ${(activeBay.shelfType ?? 'adjustable') === 'adjustable' ? 'selected' : ''}`}
                  onClick={() => onDoorShelfTypeChange?.(currentActiveIndex, 'adjustable')}
                >
                  Ajustables (Pernos)
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${activeBay.shelfType === 'fixed' ? 'selected' : ''}`}
                  onClick={() => onDoorShelfTypeChange?.(currentActiveIndex, 'fixed')}
                >
                  Fijos (Confirmats)
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Controles para Vano con Distribución Compleja */}
      {activeBay.type === 'subdivided' && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--md-sys-color-surface-container-low)',
            borderRadius: 'var(--md-sys-shape-corner-md)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--md-sys-color-primary)', fontWeight: 600 }}>
            <span>🍱</span>
            <span>Distribución Compleja Activa</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
            Este vano tiene una matriz de zonas y celdas independientes (estantes, cajones, casilleros).
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="builder-segmented-btn selected"
              onClick={onOpenDistributionModal}
              style={{ flex: 1 }}
            >
              ✏️ Abrir Matriz de Edición
            </button>
            <button
              type="button"
              className="builder-segmented-btn"
              onClick={() => onBayContentTypeChange?.(currentActiveIndex, 'empty')}
            >
              ↺ Reestablecer a simple
            </button>
          </div>
        </div>
      )}

      {/* Controles para Hueco Libre */}
      {activeBay.type === 'empty' && (
        <p style={{ fontStyle: 'italic', color: 'var(--md-sys-color-on-surface-variant)', margin: '0.25rem 0' }}>
          Vano libre sin equipamiento interior. Seleccioná una opción arriba para agregar cajones, estantes o puertas.
        </p>
      )}
    </fieldset>
  );
}
