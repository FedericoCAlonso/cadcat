import type { ReactElement } from 'react';
import type { Material, EdgeBand } from '../model';
import type {
  BracketType,
  WallType,
  LoadCategory,
  BoundaryCondition,
  OverhangMode,
  WallShelvingOutput,
} from '../resolver';
import { DEFAULT_UI_CONFIG } from '../config';
import { NumericInput } from './NumericInput';
import { ThicknessMaterialPicker } from './ThicknessMaterialPicker';
import { translateEdgeBandKind } from './localization';

/**
 * Props for WallShelvesSection component.
 */
export interface WallShelvesSectionProps {
  /** Overall width (length) in mm. */
  width: number;
  /** Overall depth in mm. */
  depth: number;
  /** Callback fired when width changes. */
  onWidthChange: (val: number) => void;
  /** Callback fired when depth changes. */
  onDepthChange: (val: number) => void;
  /** Number of vertical shelves. */
  wallShelvesShelfCount?: number;
  /** Callback fired when shelf count changes. */
  onWallShelvesShelfCountChange?: (count: number) => void;
  /** Vertical spacing between shelves in mm. */
  wallShelvesVerticalSpacingMm?: number;
  /** Callback fired when vertical spacing changes. */
  onWallShelvesVerticalSpacingMmChange?: (val: number) => void;
  /** Base elevation above floor in mm. */
  wallShelvesBaseElevationYMm?: number;
  /** Callback fired when base elevation changes. */
  onWallShelvesBaseElevationYMmChange?: (val: number) => void;
  /** Bracket type ('l-bracket' | 'floating-pin' | 'track-bracket'). */
  wallShelvesBracketType?: BracketType;
  /** Callback fired when bracket type changes. */
  onWallShelvesBracketTypeChange?: (type: BracketType) => void;
  /** Wall substrate type ('solid-brick' | 'hollow-brick' | 'drywall'). */
  wallShelvesWallType?: WallType;
  /** Callback fired when wall substrate type changes. */
  onWallShelvesWallTypeChange?: (type: WallType) => void;
  /** Expected load category ('light' | 'medium' | 'heavy'). */
  wallShelvesLoadCategory?: LoadCategory;
  /** Callback fired when load category changes. */
  onWallShelvesLoadCategoryChange?: (cat: LoadCategory) => void;
  /** Support overhang distribution mode. */
  wallShelvesOverhangMode?: OverhangMode;
  /** Callback fired when overhang mode changes. */
  onWallShelvesOverhangModeChange?: (mode: OverhangMode) => void;
  /** Installation boundary condition ('free-ends' | 'between-walls'). */
  wallShelvesBoundaryCondition?: BoundaryCondition;
  /** Callback fired when boundary condition changes. */
  onWallShelvesBoundaryConditionChange?: (cond: BoundaryCondition) => void;
  /** Available materials. */
  materials?: Material[];
  /** Standard thicknesses in mm. */
  standardThicknessesMm?: readonly number[];
  /** Selected material ID. */
  selectedMaterialId: string;
  /** Callback fired when material ID changes. */
  onMaterialChange: (id: string) => void;
  /** Available edge bands. */
  edgeBands?: EdgeBand[];
  /** Selected edge band ID. */
  selectedEdgeBandId: string;
  /** Callback fired when edge band ID changes. */
  onEdgeBandChange: (id: string) => void;
  /** Output calculation and structural sag diagnostic for wall shelving. */
  wallShelvingOutput?: WallShelvingOutput | null;
  /** Callback to view wall layout assembly plan. */
  onViewAssemblyClick?: () => void;
  /** Currently active form section. */
  activeSection: string;
}

/**
 * Dedicated configuration section for parametric floating/bracket wall shelving modules.
 */
export function WallShelvesSection({
  width,
  depth,
  onWidthChange,
  onDepthChange,
  wallShelvesShelfCount = 3,
  onWallShelvesShelfCountChange,
  wallShelvesVerticalSpacingMm = 320,
  onWallShelvesVerticalSpacingMmChange,
  wallShelvesBaseElevationYMm = 800,
  onWallShelvesBaseElevationYMmChange,
  wallShelvesBracketType = 'l-bracket',
  onWallShelvesBracketTypeChange,
  wallShelvesWallType = 'solid-brick',
  onWallShelvesWallTypeChange,
  wallShelvesLoadCategory = 'medium',
  onWallShelvesLoadCategoryChange,
  wallShelvesOverhangMode = 'balanced-cantilever',
  onWallShelvesOverhangModeChange,
  wallShelvesBoundaryCondition = 'free-ends',
  onWallShelvesBoundaryConditionChange,
  materials = [],
  standardThicknessesMm,
  selectedMaterialId,
  onMaterialChange,
  edgeBands = [],
  selectedEdgeBandId,
  onEdgeBandChange,
  wallShelvingOutput,
  onViewAssemblyClick,
  activeSection,
}: WallShelvesSectionProps): ReactElement {
  return (
    <>
      {(activeSection === 'all' || activeSection === 'dimensions') && (
        <>
          {/* Dimensiones y Cantidad de Estantes */}
          <fieldset className="builder-section">
            <legend className="builder-section-title">
              <span>📏 Dimensiones y Niveles</span>
            </legend>

            {/* Ancho */}
            <div className="form-group">
              <label htmlFor="input-shelf-width">Ancho del estante (Largo):</label>
              <NumericInput
                id="input-shelf-width"
                min={DEFAULT_UI_CONFIG.dimensions.width.min}
                max={DEFAULT_UI_CONFIG.dimensions.width.max}
                step={DEFAULT_UI_CONFIG.dimensions.width.step}
                value={width}
                showStepper={true}
                unit="mm"
                onChange={onWidthChange}
              />
            </div>

            {/* Profundidad */}
            <div className="form-group">
              <label htmlFor="input-shelf-depth">Profundidad del estante:</label>
              <NumericInput
                id="input-shelf-depth"
                min={DEFAULT_UI_CONFIG.dimensions.depth.min}
                max={DEFAULT_UI_CONFIG.dimensions.depth.max}
                step={DEFAULT_UI_CONFIG.dimensions.depth.step}
                value={depth}
                showStepper={true}
                unit="mm"
                onChange={onDepthChange}
              />
            </div>

            {/* Cantidad de estantes */}
            <div className="form-group">
              <label>Cantidad de estantes:</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="m3-button m3-button--tonal"
                  style={{ width: '40px', height: '40px', fontSize: '1.2rem', padding: 0 }}
                  onClick={() => onWallShelvesShelfCountChange?.(Math.max(1, wallShelvesShelfCount - 1))}
                  disabled={wallShelvesShelfCount <= 1}
                >
                  -
                </button>
                <span style={{ fontSize: '1.2rem', fontWeight: 700, minWidth: '40px', textAlign: 'center' }}>
                  {wallShelvesShelfCount}
                </span>
                <button
                  type="button"
                  className="m3-button m3-button--tonal"
                  style={{ width: '40px', height: '40px', fontSize: '1.2rem', padding: 0 }}
                  onClick={() => onWallShelvesShelfCountChange?.(Math.min(8, wallShelvesShelfCount + 1))}
                  disabled={wallShelvesShelfCount >= 8}
                >
                  +
                </button>
                <span style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                  ({wallShelvesShelfCount} niveles verticales)
                </span>
              </div>
            </div>

            {/* Separación vertical */}
            <div className="form-group">
              <label htmlFor="input-shelf-spacing">Separación vertical entre estantes:</label>
              <NumericInput
                id="input-shelf-spacing"
                min={150}
                max={600}
                step={20}
                value={wallShelvesVerticalSpacingMm}
                showStepper={true}
                unit="mm"
                onChange={(val) => onWallShelvesVerticalSpacingMmChange?.(val)}
              />
            </div>

            {/* Altura sobre piso */}
            <div className="form-group">
              <label htmlFor="input-shelf-elevation">Altura base sobre piso (NPT):</label>
              <NumericInput
                id="input-shelf-elevation"
                min={100}
                max={2000}
                step={50}
                value={wallShelvesBaseElevationYMm}
                showStepper={true}
                unit="mm"
                onChange={(val) => onWallShelvesBaseElevationYMmChange?.(val)}
              />
            </div>
          </fieldset>

          {/* Sistema de Fijación y Ménsulas */}
          <fieldset className="builder-section">
            <legend className="builder-section-title">
              <span>🔩 Sistema de Ménsulas y Fijación</span>
            </legend>

            {/* Tipo de Ménsula */}
            <div className="form-group">
              <label>Tipo de soporte / Ménsula:</label>
              <div className="builder-segmented-group" role="group">
                <button
                  type="button"
                  className={`builder-segmented-btn ${wallShelvesBracketType === 'l-bracket' ? 'selected' : ''}`}
                  onClick={() => onWallShelvesBracketTypeChange?.('l-bracket')}
                >
                  📐 Ménsula L
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${wallShelvesBracketType === 'floating-pin' ? 'selected' : ''}`}
                  onClick={() => onWallShelvesBracketTypeChange?.('floating-pin')}
                >
                  🔩 Perno Flotante
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${wallShelvesBracketType === 'track-bracket' ? 'selected' : ''}`}
                  onClick={() => onWallShelvesBracketTypeChange?.('track-bracket')}
                >
                  🪜 Cremallera
                </button>
              </div>
            </div>

            {/* Tipo de Pared */}
            <div className="form-group">
              <label>Tipo de pared:</label>
              <div className="builder-segmented-group" role="group">
                <button
                  type="button"
                  className={`builder-segmented-btn ${wallShelvesWallType === 'solid-brick' ? 'selected' : ''}`}
                  onClick={() => onWallShelvesWallTypeChange?.('solid-brick')}
                >
                  🧱 Maciza / Hormigón
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${wallShelvesWallType === 'hollow-brick' ? 'selected' : ''}`}
                  onClick={() => onWallShelvesWallTypeChange?.('hollow-brick')}
                >
                  🕳️ Ladrillo Hueco
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${wallShelvesWallType === 'drywall' ? 'selected' : ''}`}
                  onClick={() => onWallShelvesWallTypeChange?.('drywall')}
                >
                  📄 Durlock / Yeso
                </button>
              </div>
            </div>

            {/* Carga esperada */}
            <div className="form-group">
              <label>Carga esperada:</label>
              <div className="builder-segmented-group" role="group">
                <button
                  type="button"
                  className={`builder-segmented-btn ${wallShelvesLoadCategory === 'light' ? 'selected' : ''}`}
                  onClick={() => onWallShelvesLoadCategoryChange?.('light')}
                >
                  🪴 Liviana (15 kg/m²)
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${wallShelvesLoadCategory === 'medium' ? 'selected' : ''}`}
                  onClick={() => onWallShelvesLoadCategoryChange?.('medium')}
                >
                  👕 Media (30 kg/m²)
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${wallShelvesLoadCategory === 'heavy' ? 'selected' : ''}`}
                  onClick={() => onWallShelvesLoadCategoryChange?.('heavy')}
                >
                  📚 Pesada / Libros (60 kg/m²)
                </button>
              </div>
            </div>

            {/* Distribución de apoyos */}
            <div className="form-group">
              <label>Distribución de apoyos:</label>
              <div className="builder-segmented-group" role="group">
                <button
                  type="button"
                  className={`builder-segmented-btn ${wallShelvesOverhangMode === 'balanced-cantilever' ? 'selected' : ''}`}
                  onClick={() => onWallShelvesOverhangModeChange?.('balanced-cantilever')}
                >
                  ⚖️ Voladizo estético
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${wallShelvesOverhangMode === 'flush-ends' ? 'selected' : ''}`}
                  onClick={() => onWallShelvesOverhangModeChange?.('flush-ends')}
                >
                  ⏹️ A las puntas
                </button>
                {wallShelvesWallType === 'drywall' && (
                  <button
                    type="button"
                    className={`builder-segmented-btn ${wallShelvesOverhangMode === 'stud-aligned' ? 'selected' : ''}`}
                    onClick={() => onWallShelvesOverhangModeChange?.('stud-aligned')}
                  >
                    📏 A montantes (400mm)
                  </button>
                )}
              </div>
            </div>

            {/* Condición de colocación */}
            <div className="form-group">
              <label>Condición de colocación:</label>
              <div className="builder-segmented-group" role="group">
                <button
                  type="button"
                  className={`builder-segmented-btn ${wallShelvesBoundaryCondition === 'free-ends' ? 'selected' : ''}`}
                  onClick={() => onWallShelvesBoundaryConditionChange?.('free-ends')}
                >
                  ↔️ Extremos libres
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${wallShelvesBoundaryCondition === 'between-walls' ? 'selected' : ''}`}
                  onClick={() => onWallShelvesBoundaryConditionChange?.('between-walls')}
                >
                  🚪 Entre paredes / Nicho
                </button>
              </div>
              <small style={{ color: 'var(--md-sys-color-on-surface-variant)', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                {wallShelvesBoundaryCondition === 'free-ends'
                  ? 'Frente y laterales aplacados con tapacantos; fondo contra pared crudo.'
                  : 'Solo frente aplacado; laterales crudos con descuento de 3 mm de holgura total.'}
              </small>
            </div>
          </fieldset>
        </>
      )}

      {/* Material y Tapacantos */}
      {(activeSection === 'all' || activeSection === 'materials') && (
        <fieldset
          className="builder-section"
          style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', overflow: 'hidden' }}
        >
          <legend className="builder-section-title" style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span>🎨 Materiales y Tapacantos</span>
          </legend>

          <div className="form-group" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
            <ThicknessMaterialPicker
              id="select-shelf-material"
              label="Placa para Estantes:"
              materials={materials}
              selectedMaterialId={selectedMaterialId}
              onMaterialChange={onMaterialChange}
              standardThicknessesMm={standardThicknessesMm}
            />
          </div>

          <div className="form-group" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
            <label htmlFor="select-shelf-edgeband" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
              Tapacantos para bordes vistos:
            </label>
            <select
              id="select-shelf-edgeband"
              value={selectedEdgeBandId}
              onChange={(e) => onEdgeBandChange(e.target.value)}
              className="m3-select"
              style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
            >
              {edgeBands.map((eb) => (
                <option key={eb.id} value={eb.id}>
                  {eb.id} ({translateEdgeBandKind(eb.kind)}, {eb.thicknessMm} mm)
                </option>
              ))}
            </select>
          </div>
        </fieldset>
      )}

      {/* Tarjeta de Diagnóstico Estructural en Tiempo Real */}
      {(activeSection === 'all' || activeSection === 'dimensions' || activeSection === 'materials') && wallShelvingOutput && (
        <div
          className="m3-card"
          style={{
            marginTop: '1rem',
            padding: '1rem',
            background: wallShelvingOutput.bracketCalculation.warning
              ? 'var(--md-sys-color-warning-container)'
              : 'var(--md-sys-color-success-container)',
            border: wallShelvingOutput.bracketCalculation.warning
              ? '1px solid var(--md-sys-color-warning-border)'
              : '1px solid var(--md-sys-color-success-border)',
            borderRadius: '8px',
          }}
        >
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: 'var(--md-sys-color-on-surface)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {wallShelvingOutput.bracketCalculation.warning ? '⚠️ Advertencia Estructural' : '✅ Diagnóstico Estructural (Sagulator)'}
          </h4>

          {wallShelvingOutput.bracketCalculation.warning && (
            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--md-sys-color-on-warning-container)', fontWeight: 500 }}>
              {wallShelvingOutput.bracketCalculation.warning}
            </p>
          )}

          <div style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div>
              <strong>Ménsulas sugeridas:</strong> {wallShelvingOutput.bracketCalculation.bracketCountPerShelf} por estante ({wallShelvingOutput.bracketCalculation.totalBrackets} totales)
            </div>
            <div>
              <strong>Separación entre ménsulas:</strong> {wallShelvingOutput.bracketCalculation.maxSpanMm} mm
            </div>
            <div>
              <strong>Flecha calculada:</strong> {wallShelvingOutput.bracketCalculation.calculatedDeflectionMm} mm (Límite: {wallShelvingOutput.bracketCalculation.allowableDeflectionMm} mm)
            </div>
            <div>
              <strong>Taco sugerido:</strong> {wallShelvingOutput.bracketCalculation.recommendedAnchor.brandModel}
            </div>
            <div>
              <strong>Tornillo pared:</strong> {wallShelvingOutput.bracketCalculation.recommendedAnchor.screwDiameterMm}x{wallShelvingOutput.bracketCalculation.recommendedAnchor.screwLengthMm} mm (Tracción: ~{wallShelvingOutput.bracketCalculation.pullOutForceKg} kg/soporte)
            </div>
          </div>

          {onViewAssemblyClick && (
            <button
              type="button"
              className="m3-button m3-button--filled"
              style={{ width: '100%', marginTop: '0.75rem', fontSize: '0.85rem' }}
              onClick={onViewAssemblyClick}
            >
              📐 Ver Plano de Replanteo en Pared ➔
            </button>
          )}
        </div>
      )}
    </>
  );
}
