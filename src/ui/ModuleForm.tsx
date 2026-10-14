import type { ReactElement, ChangeEvent } from 'react';
import type { Material, EdgeBand } from '../model';
import type {
  TemplateDefinition,
  RoofType,
  JointPriority,
  BayContent,
  DrawerSlideType,
  DrawerFrontMount,
  DoorMountType,
  TrackSize,
} from '../resolver';
import {
  resolveTracks,
  formatTracksToGridString,
  parseGridStringToTracks,
} from '../resolver';
import { translateTemplateName, translateEdgeBandKind } from './localization';

export interface ModuleFormProps {
  width: number;
  height: number;
  depth: number;
  templates?: TemplateDefinition[];
  selectedTemplateId?: string;
  materials: Material[];
  edgeBands: EdgeBand[];
  selectedMaterialId: string;
  selectedEdgeBandId: string;
  isSaving: boolean;
  onWidthChange: (val: number) => void;
  onHeightChange: (val: number) => void;
  onDepthChange: (val: number) => void;
  onTemplateChange?: (id: string) => void;
  onMaterialChange: (id: string) => void;
  onEdgeBandChange: (id: string) => void;
  onSave: () => void;
  onExportCsv?: () => void;
  onExportPdf?: () => void;
  // Modular builder state & actions
  isCustomModular?: boolean;
  roofType?: RoofType;
  jointPriority?: JointPriority;
  hasBacking?: boolean;
  gridType?: '1-bay' | '2-bays-vertical' | '3-bays-vertical' | '2-bays-horizontal';
  bays?: BayContent[];
  activeBayIndex?: number;
  frontsMaterialId?: string;
  drawerBoxesMaterialId?: string;
  backingsMaterialId?: string;
  onRoofTypeChange?: (roof: RoofType) => void;
  onJointPriorityChange?: (priority: JointPriority) => void;
  onHasBackingChange?: (hasBacking: boolean) => void;
  onGridTypeChange?: (gridType: '1-bay' | '2-bays-vertical' | '3-bays-vertical' | '2-bays-horizontal') => void;
  onActiveBayIndexChange?: (idx: number) => void;
  onBayContentTypeChange?: (
    bayIndex: number,
    type: 'empty' | 'shelves' | 'drawer-stack' | 'doors' | 'pull-out-tray' | 'bi-fold-closure',
  ) => void;
  onAddShelf?: (bayIndex: number) => void;
  onRemoveShelf?: (bayIndex: number) => void;
  onShelfTypeChange?: (bayIndex: number, type: 'adjustable' | 'fixed') => void;
  onShelfAntiSagChange?: (bayIndex: number, hasAntiSag: boolean) => void;
  onAddDrawer?: (bayIndex: number) => void;
  onRemoveDrawer?: (bayIndex: number) => void;
  onDrawerFrontMountChange?: (bayIndex: number, mount: DrawerFrontMount) => void;
  onDrawerSlideTypeChange?: (bayIndex: number, slide: DrawerSlideType) => void;
  onDrawerDistributionPresetChange?: (
    bayIndex: number,
    preset: 'equal' | 'cutlery-top' | 'custom',
    topHeightMm?: number,
  ) => void;
  onDrawerTopHeightChange?: (bayIndex: number, heightMm: number) => void;
  onDrawerTrackChange?: (bayIndex: number, trackIndex: number, track: TrackSize) => void;
  onDrawerTracksChange?: (bayIndex: number, tracks: TrackSize[]) => void;
  onDrawerGapChange?: (bayIndex: number, gapMm: number) => void;
  onDrawerTransomsChange?: (bayIndex: number, hasTransoms: boolean) => void;
  onDoorCountChange?: (bayIndex: number, count: 1 | 2) => void;
  onDoorMountTypeChange?: (bayIndex: number, mount: DoorMountType) => void;
  onBifoldDirectionChange?: (bayIndex: number, dir: 'vertical-lift' | 'horizontal-book') => void;
  onFrontsMaterialChange?: (id: string) => void;
  onDrawerBoxesMaterialChange?: (id: string) => void;
  onBackingsMaterialChange?: (id: string) => void;
  onView3dClick?: () => void;
}

/**
 * Module configuration form component with Argentine Spanish localization and M3 styles.
 * Supports interactive builder controls: drawers, shelves, covers, doors, partitions, and roofs.
 */
export function ModuleForm(props: ModuleFormProps): ReactElement {
  const {
    width,
    height,
    depth,
    templates,
    selectedTemplateId,
    materials,
    edgeBands,
    selectedMaterialId,
    selectedEdgeBandId,
    isSaving,
    onWidthChange,
    onHeightChange,
    onDepthChange,
    onTemplateChange,
    onMaterialChange,
    onEdgeBandChange,
    onSave,
    onExportCsv,
    onExportPdf,
    roofType = 'front-back-rails',
    jointPriority = 'lateral-over-bottom',
    hasBacking = true,
    gridType = '1-bay',
    bays = [{ type: 'shelves', count: 1, shelfType: 'adjustable', setbackMm: 20 }],
    activeBayIndex = 0,
    frontsMaterialId = '',
    drawerBoxesMaterialId = '',
    onRoofTypeChange,
    onJointPriorityChange,
    onHasBackingChange,
    onGridTypeChange,
    onActiveBayIndexChange,
    onBayContentTypeChange,
    onAddShelf,
    onRemoveShelf,
    onShelfTypeChange,
    onShelfAntiSagChange,
    onAddDrawer,
    onRemoveDrawer,
    onDrawerFrontMountChange,
    onDrawerSlideTypeChange,
    onDrawerDistributionPresetChange,
    onDrawerTopHeightChange,
    onDrawerTrackChange,
    onDrawerTracksChange,
    onDrawerGapChange,
    onDrawerTransomsChange,
    onDoorCountChange,
    onDoorMountTypeChange,
    onBifoldDirectionChange,
    onFrontsMaterialChange,
    onDrawerBoxesMaterialChange,
    onView3dClick,
  } = props;

  const handleNumberInput = (setter: (val: number) => void) => (e: ChangeEvent<HTMLInputElement>) => {
    const val = Number.parseFloat(e.target.value);
    if (!Number.isNaN(val)) {
      setter(val);
    }
  };

  const adjustDimension = (current: number, delta: number, min: number, max: number, setter: (val: number) => void) => {
    setter(Math.max(min, Math.min(max, current + delta)));
  };

  const currentBayCount = gridType === '3-bays-vertical' ? 3 : gridType === '1-bay' ? 1 : 2;
  const currentActiveIndex = Math.min(activeBayIndex, currentBayCount - 1);
  const activeBay = bays[currentActiveIndex] ?? { type: 'empty' };

  const currentDrawerPreset: 'equal' | 'cutlery-top' | 'custom' = (() => {
    if (activeBay.type !== 'drawer-stack' || !activeBay.drawerTracks || activeBay.drawerTracks.length <= 1) {
      return 'equal';
    }
    const tracks = activeBay.drawerTracks;
    const isAllEqualFr = tracks.every((t) => t.type === 'fractional' && t.valueFr === 1);
    if (isAllEqualFr) return 'equal';
    const isCutleryTop =
      tracks[0]?.type === 'fixed' &&
      tracks.slice(1).every((t) => t.type === 'fractional' && t.valueFr === 1);
    if (isCutleryTop) return 'cutlery-top';
    return 'custom';
  })();

  const topCutleryHeight =
    activeBay.type === 'drawer-stack' && activeBay.drawerTracks?.[0]?.type === 'fixed'
      ? activeBay.drawerTracks[0].valueMm
      : 140;

  const rawThickness = materials.find((m) => m.id === selectedMaterialId)?.thicknessMm;
  const matThickness = typeof rawThickness === 'number' ? rawThickness : 18;
  const estimatedBayCavityHeight = Math.max(
    100,
    Math.round(
      gridType === '2-bays-horizontal'
        ? (height - 3 * matThickness) / 2
        : roofType === 'solid-panel'
        ? height - 2 * matThickness
        : height - matThickness,
    ),
  );

  const resolvedDrawerHeights = (() => {
    if (activeBay.type !== 'drawer-stack' || !activeBay.drawerTracks || activeBay.drawerTracks.length === 0) {
      return [];
    }
    const useTransoms = Boolean(activeBay.hasTransomDividers && activeBay.frontMount === 'inset');
    const res = resolveTracks(
      estimatedBayCavityHeight,
      activeBay.drawerTracks,
      useTransoms ? matThickness : 0,
    );
    return res.tracks.map((t) => t.sizeMm);
  })();

  return (
    <section aria-labelledby="form-heading" className="m3-card module-form">
      <div className="m3-card__header">
        <h2 id="form-heading" className="m3-card__title">
          📐 Medidas y Armado del Módulo
          <span className="visually-hidden">Module Parameters and Builder</span>
        </h2>
        <p className="m3-card__subtitle">
          Personalizá dimensiones, tapa superior, vanos, cajones y estantes.
        </p>
      </div>

      {templates && templates.length > 0 && onTemplateChange && (
        <div className="form-group">
          <label htmlFor="select-template">
            Plantilla base:
            <span className="visually-hidden">Module Template:</span>
          </label>
          <select
            id="select-template"
            value={selectedTemplateId}
            onChange={(e) => onTemplateChange(e.target.value)}
            className="m3-select"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {translateTemplateName(t.id, t.name)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Ancho */}
      <div className="form-group">
        <label htmlFor="input-width">
          Ancho exterior (mm):
          <span className="visually-hidden">Width (mm):</span>
        </label>
        <div className="m3-stepper-field">
          <button
            type="button"
            className="m3-stepper-btn"
            aria-label="Disminuir ancho 50 mm"
            onClick={() => adjustDimension(width, -50, 100, 3000, onWidthChange)}
          >
            −
          </button>
          <input
            id="input-width"
            type="number"
            min="100"
            max="3000"
            step="1"
            value={width}
            onChange={handleNumberInput(onWidthChange)}
          />
          <button
            type="button"
            className="m3-stepper-btn"
            aria-label="Aumentar ancho 50 mm"
            onClick={() => adjustDimension(width, 50, 100, 3000, onWidthChange)}
          >
            +
          </button>
        </div>
      </div>

      {/* Alto */}
      <div className="form-group">
        <label htmlFor="input-height">
          Alto exterior (mm):
          <span className="visually-hidden">Height (mm):</span>
        </label>
        <div className="m3-stepper-field">
          <button
            type="button"
            className="m3-stepper-btn"
            aria-label="Disminuir alto 50 mm"
            onClick={() => adjustDimension(height, -50, 100, 3000, onHeightChange)}
          >
            −
          </button>
          <input
            id="input-height"
            type="number"
            min="100"
            max="3000"
            step="1"
            value={height}
            onChange={handleNumberInput(onHeightChange)}
          />
          <button
            type="button"
            className="m3-stepper-btn"
            aria-label="Aumentar alto 50 mm"
            onClick={() => adjustDimension(height, 50, 100, 3000, onHeightChange)}
          >
            +
          </button>
        </div>
      </div>

      {/* Profundidad */}
      <div className="form-group">
        <label htmlFor="input-depth">
          Profundidad exterior (mm):
          <span className="visually-hidden">Depth (mm):</span>
        </label>
        <div className="m3-stepper-field">
          <button
            type="button"
            className="m3-stepper-btn"
            aria-label="Disminuir profundidad 50 mm"
            onClick={() => adjustDimension(depth, -50, 100, 1500, onDepthChange)}
          >
            −
          </button>
          <input
            id="input-depth"
            type="number"
            min="100"
            max="1500"
            step="1"
            value={depth}
            onChange={handleNumberInput(onDepthChange)}
          />
          <button
            type="button"
            className="m3-stepper-btn"
            aria-label="Aumentar profundidad 50 mm"
            onClick={() => adjustDimension(depth, 50, 100, 1500, onDepthChange)}
          >
            +
          </button>
        </div>
      </div>

      {/* =========================================================================
          SECCIÓN 1: Casco y Tapa Superior
          ========================================================================= */}
      <div className="builder-section">
        <h3 className="builder-section-title">
          <span>🏗️ Estructura del Casco y Tapa</span>
        </h3>

        {/* Tapa Superior / Techo */}
        <div className="form-group">
          <label>Tapa superior / Techo:</label>
          <div className="builder-segmented-group" role="group" aria-label="Tipo de tapa superior">
            <button
              type="button"
              className={`builder-segmented-btn ${roofType === 'front-back-rails' ? 'selected' : ''}`}
              onClick={() => onRoofTypeChange?.('front-back-rails')}
            >
              2 Fajas (80mm)
            </button>
            <button
              type="button"
              className={`builder-segmented-btn ${roofType === 'solid-panel' ? 'selected' : ''}`}
              onClick={() => onRoofTypeChange?.('solid-panel')}
            >
              Tapa entera
            </button>
            <button
              type="button"
              className={`builder-segmented-btn ${roofType === 'none' ? 'selected' : ''}`}
              onClick={() => onRoofTypeChange?.('none')}
            >
              Sin tapa
            </button>
          </div>
        </div>

        {/* Unión de Esquinas */}
        <div className="form-group">
          <label>Unión de esquinas:</label>
          <div className="builder-segmented-group" role="group" aria-label="Prioridad de unión de esquinas">
            <button
              type="button"
              className={`builder-segmented-btn ${jointPriority === 'lateral-over-bottom' ? 'selected' : ''}`}
              onClick={() => onJointPriorityChange?.('lateral-over-bottom')}
            >
              Laterales pasan
            </button>
            <button
              type="button"
              className={`builder-segmented-btn ${jointPriority === 'bottom-over-lateral' ? 'selected' : ''}`}
              onClick={() => onJointPriorityChange?.('bottom-over-lateral')}
            >
              Piso pasa
            </button>
          </div>
        </div>

        {/* Fondo */}
        <div className="form-group">
          <label>Fondo posterior:</label>
          <div className="builder-segmented-group" role="group" aria-label="Fondo posterior del módulo">
            <button
              type="button"
              className={`builder-segmented-btn ${hasBacking ? 'selected' : ''}`}
              onClick={() => onHasBackingChange?.(true)}
            >
              Con fondo (ranurado 3mm)
            </button>
            <button
              type="button"
              className={`builder-segmented-btn ${!hasBacking ? 'selected' : ''}`}
              onClick={() => onHasBackingChange?.(false)}
            >
              Sin fondo
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECCIÓN 2: Distribución de Vanos
          ========================================================================= */}
      <div className="builder-section">
        <h3 className="builder-section-title">
          <span>🔲 Distribución de Vanos</span>
        </h3>
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
      </div>

      {/* =========================================================================
          SECCIÓN 3: Equipamiento Interior (Cajones, Estantes, Puertas, Tapas)
          ========================================================================= */}
      <div className="builder-section">
        <h3 className="builder-section-title">
          <span>🚪 Equipamiento Interior</span>
        </h3>

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
        </div>

        {/* Controles para Cajones */}
        {activeBay.type === 'drawer-stack' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="form-group">
              <label>Cantidad de cajones:</label>
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

            {/* Definición de pistas estilo CSS Grid (Proporciones y Medidas) */}
            <div className="form-group" style={{ padding: '0.65rem', backgroundColor: 'var(--md-sys-color-surface-container-low)', borderRadius: 'var(--md-sys-shape-corner-sm)', border: '1px solid var(--md-sys-color-outline-variant)' }}>
              <label htmlFor="input-grid-tracks" style={{ fontWeight: 600, color: 'var(--md-sys-color-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                📐 Pistas de cajón (Sintaxis CSS Grid):
              </label>
              <input
                id="input-grid-tracks"
                type="text"
                className="m3-input"
                style={{ fontFamily: 'monospace', fontWeight: 600, fontSize: '0.95rem', margin: '0.35rem 0' }}
                value={formatTracksToGridString(activeBay.drawerTracks)}
                placeholder="ej. 140mm 1fr 1fr o 1fr 2fr 1fr"
                onChange={(e) => {
                  const parsed = parseGridStringToTracks(e.target.value);
                  if (parsed && parsed.length > 0) {
                    onDrawerTracksChange?.(currentActiveIndex, parsed);
                  }
                }}
              />
              <small style={{ color: 'var(--md-sys-color-on-surface-variant)', fontSize: '0.78rem', display: 'block', marginBottom: '0.5rem' }}>
                Definí cualquier combinación de medidas fijas (ej. <code>140mm</code>) y proporciones (ej. <code>1fr</code>, <code>2fr</code>), como en CSS Grid.
              </small>

              <span style={{ font: 'var(--md-sys-typescale-label-small)', color: 'var(--md-sys-color-on-surface-variant)', display: 'block', marginBottom: '0.35rem' }}>
                Atajos de proporción rápidos:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                <button
                  type="button"
                  className="m3-chip"
                  style={{ height: '30px', padding: '0 0.6rem', fontSize: '0.78rem' }}
                  onClick={() =>
                    onDrawerTracksChange?.(currentActiveIndex, [
                      { type: 'fractional', valueFr: 1 },
                      { type: 'fractional', valueFr: 1 },
                      { type: 'fractional', valueFr: 1 },
                    ])
                  }
                >
                  1fr 1fr 1fr (3 iguales)
                </button>
                <button
                  type="button"
                  className="m3-chip"
                  style={{ height: '30px', padding: '0 0.6rem', fontSize: '0.78rem' }}
                  onClick={() =>
                    onDrawerTracksChange?.(currentActiveIndex, [
                      { type: 'fixed', valueMm: 140 },
                      { type: 'fractional', valueFr: 1 },
                      { type: 'fractional', valueFr: 1 },
                    ])
                  }
                >
                  140mm 1fr 1fr (cubertero + 2)
                </button>
                <button
                  type="button"
                  className="m3-chip"
                  style={{ height: '30px', padding: '0 0.6rem', fontSize: '0.78rem' }}
                  onClick={() =>
                    onDrawerTracksChange?.(currentActiveIndex, [
                      { type: 'fixed', valueMm: 140 },
                      { type: 'fixed', valueMm: 140 },
                      { type: 'fractional', valueFr: 1 },
                    ])
                  }
                >
                  140mm 140mm 1fr (2 cuberteros + 1)
                </button>
                <button
                  type="button"
                  className="m3-chip"
                  style={{ height: '30px', padding: '0 0.6rem', fontSize: '0.78rem' }}
                  onClick={() =>
                    onDrawerTracksChange?.(currentActiveIndex, [
                      { type: 'fractional', valueFr: 1 },
                      { type: 'fractional', valueFr: 2 },
                      { type: 'fractional', valueFr: 2 },
                    ])
                  }
                >
                  1fr 2fr 2fr (1 chico + 2 grandes)
                </button>
                <button
                  type="button"
                  className="m3-chip"
                  style={{ height: '30px', padding: '0 0.6rem', fontSize: '0.78rem' }}
                  onClick={() =>
                    onDrawerTracksChange?.(currentActiveIndex, [
                      { type: 'fractional', valueFr: 1 },
                      { type: 'fractional', valueFr: 1 },
                      { type: 'fractional', valueFr: 1 },
                      { type: 'fractional', valueFr: 1 },
                    ])
                  }
                >
                  1fr 1fr 1fr 1fr (4 iguales)
                </button>
                <button
                  type="button"
                  className="m3-chip"
                  style={{ height: '30px', padding: '0 0.6rem', fontSize: '0.78rem' }}
                  onClick={() =>
                    onDrawerTracksChange?.(currentActiveIndex, [
                      { type: 'fixed', valueMm: 120 },
                      { type: 'fractional', valueFr: 1 },
                      { type: 'fractional', valueFr: 1 },
                      { type: 'fractional', valueFr: 1 },
                    ])
                  }
                >
                  120mm 1fr 1fr 1fr (1 fijo + 3)
                </button>
              </div>
            </div>

            {/* Visualizador de proporción y alturas calculadas */}
            {resolvedDrawerHeights.length > 0 && (
              <div className="form-group" style={{ padding: '0.65rem', backgroundColor: 'var(--md-sys-color-surface-container-low)', borderRadius: 'var(--md-sys-shape-corner-sm)', border: '1px solid var(--md-sys-color-outline-variant)' }}>
                <span style={{ font: 'var(--md-sys-typescale-label-medium)', fontWeight: 600, color: 'var(--md-sys-color-primary)', display: 'block', marginBottom: '0.4rem' }}>
                  📊 Proporción y alturas reales ({estimatedBayCavityHeight} mm luz libre):
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', borderRadius: '4px', overflow: 'hidden' }}>
                  {resolvedDrawerHeights.map((h, i) => {
                    const track = activeBay.drawerTracks[i];
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
                        <span>{`Cajón ${i + 1} (${trackLabel})`}</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{`${h} mm`}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Distribución de alturas */}
            <div className="form-group">
              <label id="drawer-distribution-label">Distribución de alturas:</label>
              <div className="builder-segmented-group" role="group" aria-labelledby="drawer-distribution-label">
                <button
                  type="button"
                  className={`builder-segmented-btn ${currentDrawerPreset === 'equal' ? 'selected' : ''}`}
                  onClick={() => onDrawerDistributionPresetChange?.(currentActiveIndex, 'equal')}
                >
                  ⚖️ Todos iguales
                </button>
                {activeBay.drawerTracks.length >= 2 && (
                  <button
                    type="button"
                    className={`builder-segmented-btn ${currentDrawerPreset === 'cutlery-top' ? 'selected' : ''}`}
                    onClick={() => onDrawerDistributionPresetChange?.(currentActiveIndex, 'cutlery-top', topCutleryHeight)}
                  >
                    🥄 Cubertero + Olleros
                  </button>
                )}
                <button
                  type="button"
                  className={`builder-segmented-btn ${currentDrawerPreset === 'custom' ? 'selected' : ''}`}
                  onClick={() => onDrawerDistributionPresetChange?.(currentActiveIndex, 'custom')}
                >
                  📐 Personalizado
                </button>
              </div>
            </div>

            {/* Si es Cubertero + Olleros: control para la altura del cajón superior */}
            {currentDrawerPreset === 'cutlery-top' && (
              <div className="form-group" style={{ padding: '0.6rem', backgroundColor: 'var(--md-sys-color-surface-container-low)', borderRadius: 'var(--md-sys-shape-corner-sm)' }}>
                <label htmlFor="input-cutlery-height">
                  Altura cajón superior (cubertero):
                </label>
                <div className="m3-stepper-field">
                  <button
                    type="button"
                    className="m3-stepper-btn"
                    aria-label="Disminuir altura cubertero 10 mm"
                    onClick={() => onDrawerTopHeightChange?.(currentActiveIndex, Math.max(80, topCutleryHeight - 10))}
                  >
                    −
                  </button>
                  <input
                    id="input-cutlery-height"
                    type="number"
                    min="80"
                    max="400"
                    step="5"
                    value={topCutleryHeight}
                    onChange={(e) => {
                      const v = Number.parseInt(e.target.value, 10);
                      if (!Number.isNaN(v)) {
                        onDrawerTopHeightChange?.(currentActiveIndex, v);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="m3-stepper-btn"
                    aria-label="Aumentar altura cubertero 10 mm"
                    onClick={() => onDrawerTopHeightChange?.(currentActiveIndex, Math.min(400, topCutleryHeight + 10))}
                  >
                    +
                  </button>
                </div>
                <small style={{ color: 'var(--md-sys-color-on-surface-variant)', fontSize: '0.8rem', marginTop: '0.35rem', display: 'block' }}>
                  {`Primer cajón de ${topCutleryHeight} mm; los restantes ${activeBay.drawerTracks.length - 1} se dividen en partes iguales.`}
                </small>
              </div>
            )}

            {/* Si es Personalizado: control individual por cajón */}
            {currentDrawerPreset === 'custom' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.6rem', backgroundColor: 'var(--md-sys-color-surface-container-low)', borderRadius: 'var(--md-sys-shape-corner-sm)' }}>
                <span style={{ font: 'var(--md-sys-typescale-label-medium)', fontWeight: 600 }}>
                  Ajuste por cajón (de arriba a abajo):
                </span>
                {activeBay.drawerTracks.map((track, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ minWidth: '65px', font: 'var(--md-sys-typescale-body-small)', fontWeight: 600 }}>
                      {`Cajón ${idx + 1}:`}
                    </span>
                    <div className="builder-segmented-group" style={{ flex: '1 1 auto', minWidth: '150px' }}>
                      <button
                        type="button"
                        className={`builder-segmented-btn ${track.type === 'fixed' ? 'selected' : ''}`}
                        style={{ minHeight: '34px', padding: '0.2rem 0.45rem', fontSize: '0.78rem' }}
                        onClick={() =>
                          onDrawerTrackChange?.(currentActiveIndex, idx, {
                            type: 'fixed',
                            valueMm: track.type === 'fixed' ? track.valueMm : (resolvedDrawerHeights[idx] ?? 140),
                          })
                        }
                      >
                        Fijo (mm)
                      </button>
                      <button
                        type="button"
                        className={`builder-segmented-btn ${track.type === 'fractional' ? 'selected' : ''}`}
                        style={{ minHeight: '34px', padding: '0.2rem 0.45rem', fontSize: '0.78rem' }}
                        onClick={() =>
                          onDrawerTrackChange?.(currentActiveIndex, idx, {
                            type: 'fractional',
                            valueFr: 1,
                          })
                        }
                      >
                        Proporcional (fr)
                      </button>
                    </div>
                    {track.type === 'fixed' ? (
                      <div className="m3-stepper-field" style={{ width: '130px' }}>
                        <input
                          type="number"
                          min="60"
                          max="600"
                          step="5"
                          value={track.valueMm}
                          aria-label={`Altura fija de cajón ${idx + 1} en mm`}
                          onChange={(e) => {
                            const val = Number.parseInt(e.target.value, 10);
                            if (!Number.isNaN(val)) {
                              onDrawerTrackChange?.(currentActiveIndex, idx, { type: 'fixed', valueMm: val });
                            }
                          }}
                        />
                        <span style={{ fontSize: '0.8rem', paddingRight: '0.5rem', color: 'var(--md-sys-color-on-surface-variant)' }}>mm</span>
                      </div>
                    ) : (
                      <div className="m3-stepper-field" style={{ width: '110px' }}>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          step="1"
                          value={track.valueFr}
                          aria-label={`Proporción de cajón ${idx + 1} en fr`}
                          onChange={(e) => {
                            const val = Number.parseFloat(e.target.value);
                            if (!Number.isNaN(val) && val > 0) {
                              onDrawerTrackChange?.(currentActiveIndex, idx, { type: 'fractional', valueFr: val });
                            }
                          }}
                        />
                        <span style={{ fontSize: '0.8rem', paddingRight: '0.5rem', color: 'var(--md-sys-color-on-surface-variant)' }}>fr</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Frentes calculados en mm en vivo */}
            {resolvedDrawerHeights.length > 0 && (
              <div className="form-group">
                <label>Alturas calculadas de frentes:</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.25rem' }}>
                  {resolvedDrawerHeights.map((h, i) => (
                    <span
                      key={i}
                      style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: 'var(--md-sys-shape-corner-full)',
                        backgroundColor: 'var(--md-sys-color-secondary-container)',
                        color: 'var(--md-sys-color-on-secondary-container)',
                        font: 'var(--md-sys-typescale-label-small)',
                        fontWeight: 600,
                        border: '1px solid var(--md-sys-color-outline-variant)',
                      }}
                    >
                      {`Cajón ${i + 1}: ${h} mm`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Montaje de frentes:</label>
              <div className="builder-segmented-group">
                <button
                  type="button"
                  className={`builder-segmented-btn ${activeBay.frontMount === 'applied' ? 'selected' : ''}`}
                  onClick={() => onDrawerFrontMountChange?.(currentActiveIndex, 'applied')}
                >
                  Aplicado (Solapado)
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${activeBay.frontMount === 'inset' ? 'selected' : ''}`}
                  onClick={() => onDrawerFrontMountChange?.(currentActiveIndex, 'inset')}
                >
                  Embutido
                </button>
              </div>
            </div>

            {/* Travesaños separadores para cajones embutidos */}
            {activeBay.frontMount === 'inset' && (
              <div className="form-group">
                <label>Travesaños horizontales entre cajones:</label>
                <div className="builder-segmented-group">
                  <button
                    type="button"
                    className={`builder-segmented-btn ${activeBay.hasTransomDividers ? 'selected' : ''}`}
                    onClick={() => onDrawerTransomsChange?.(currentActiveIndex, true)}
                  >
                    Con fajas separadoras
                  </button>
                  <button
                    type="button"
                    className={`builder-segmented-btn ${!activeBay.hasTransomDividers ? 'selected' : ''}`}
                    onClick={() => onDrawerTransomsChange?.(currentActiveIndex, false)}
                  >
                    Sin fajas (frente corrido)
                  </button>
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Tipo de correderas:</label>
              <div className="builder-segmented-group">
                <button
                  type="button"
                  className={`builder-segmented-btn ${activeBay.slideType === 'telescopic' ? 'selected' : ''}`}
                  onClick={() => onDrawerSlideTypeChange?.(currentActiveIndex, 'telescopic')}
                >
                  Telescópicas (25.4mm)
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${activeBay.slideType === 'undermount' ? 'selected' : ''}`}
                  onClick={() => onDrawerSlideTypeChange?.(currentActiveIndex, 'undermount')}
                >
                  Ocultas (Bajo Fondo)
                </button>
              </div>
            </div>

            {/* Separación entre frentes (luz) */}
            <div className="form-group">
              <label>Separación entre frentes (luz):</label>
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

            <div className="form-group">
              <label>Tipo de fijación:</label>
              <div className="builder-segmented-group">
                <button
                  type="button"
                  className={`builder-segmented-btn ${activeBay.shelfType === 'adjustable' ? 'selected' : ''}`}
                  onClick={() => onShelfTypeChange?.(currentActiveIndex, 'adjustable')}
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
              <label>Refuerzo antialabeo:</label>
              <div className="builder-segmented-group">
                <button
                  type="button"
                  className={`builder-segmented-btn ${activeBay.hasAntiSagBrace ? 'selected' : ''}`}
                  onClick={() => onShelfAntiSagChange?.(currentActiveIndex, true)}
                >
                  Con faja de refuerzo
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${!activeBay.hasAntiSagBrace ? 'selected' : ''}`}
                  onClick={() => onShelfAntiSagChange?.(currentActiveIndex, false)}
                >
                  Sin refuerzo
                </button>
              </div>
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
              <label>Montaje de puerta:</label>
              <div className="builder-segmented-group">
                <button
                  type="button"
                  className={`builder-segmented-btn ${activeBay.mountType === 'full-overlay' ? 'selected' : ''}`}
                  onClick={() => onDoorMountTypeChange?.(currentActiveIndex, 'full-overlay')}
                >
                  Solapada (Full Overlay)
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${activeBay.mountType === 'inset' ? 'selected' : ''}`}
                  onClick={() => onDoorMountTypeChange?.(currentActiveIndex, 'inset')}
                >
                  Embutida (Inset)
                </button>
              </div>
            </div>
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
        )}

        {/* Controles para Hueco Libre */}
        {activeBay.type === 'empty' && (
          <p style={{ fontStyle: 'italic', color: 'var(--md-sys-color-on-surface-variant)', margin: '0.25rem 0' }}>
            Vano libre sin equipamiento interior. Seleccioná una opción arriba para agregar cajones, estantes o puertas.
          </p>
        )}
      </div>

      {/* =========================================================================
          SECCIÓN 4: Materiales por Rol (Multi-Material)
          ========================================================================= */}
      <div className="builder-section">
        <h3 className="builder-section-title">
          <span>🎨 Materiales y Tapacantos</span>
        </h3>

        {/* Material Casco */}
        <div className="form-group">
          <label htmlFor="select-material">
            Placa para Casco (Laterales, piso, techo):
            <span className="visually-hidden">Sheet Material:</span>
          </label>
          <select
            id="select-material"
            value={selectedMaterialId}
            onChange={(e) => onMaterialChange(e.target.value)}
            className="m3-select"
          >
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.thicknessMm} mm)
              </option>
            ))}
          </select>
        </div>

        {/* Material Frentes / Puertas */}
        {onFrontsMaterialChange && (
          <div className="form-group">
            <label htmlFor="select-fronts-material">
              Placa para Frentes / Puertas / Tapas:
            </label>
            <select
              id="select-fronts-material"
              value={frontsMaterialId || selectedMaterialId}
              onChange={(e) => onFrontsMaterialChange(e.target.value)}
              className="m3-select"
            >
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.thicknessMm} mm)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Material Cajones */}
        {onDrawerBoxesMaterialChange && (
          <div className="form-group">
            <label htmlFor="select-drawer-material">
              Placa para Cajas de Cajones interiores:
            </label>
            <select
              id="select-drawer-material"
              value={drawerBoxesMaterialId || selectedMaterialId}
              onChange={(e) => onDrawerBoxesMaterialChange(e.target.value)}
              className="m3-select"
            >
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.thicknessMm} mm)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Tapacantos */}
        <div className="form-group">
          <label htmlFor="select-edgeband">
            Tapacantos:
            <span className="visually-hidden">Edge Band:</span>
          </label>
          <select
            id="select-edgeband"
            value={selectedEdgeBandId}
            onChange={(e) => onEdgeBandChange(e.target.value)}
            className="m3-select"
          >
            <option value="">Sin tapacanto / Ninguno</option>
            {edgeBands.map((eb) => (
              <option key={eb.id} value={eb.id}>
                {eb.id} ({translateEdgeBandKind(eb.kind)}, {eb.thicknessMm} mm)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="form-actions m3-button-row">
        {onView3dClick && (
          <button
            type="button"
            onClick={onView3dClick}
            className="m3-btn m3-btn--filled"
            style={{ width: '100%', marginBottom: '0.5rem' }}
          >
            🧊 Ver Resultado en 3D
          </button>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="m3-btn m3-btn--filled"
        >
          {isSaving ? 'Guardando...' : '💾 Guardar Módulo'}
          <span className="visually-hidden">Save Module to Database</span>
        </button>
        {onExportCsv && (
          <button
            type="button"
            onClick={onExportCsv}
            className="m3-btn m3-btn--tonal export-btn"
          >
            📄 Lista de Corte (CSV)
          </button>
        )}
        {onExportPdf && (
          <button
            type="button"
            onClick={onExportPdf}
            className="m3-btn m3-btn--outlined export-btn"
          >
            📑 Diagrama de Corte (PDF)
          </button>
        )}
      </div>
    </section>
  );
}
