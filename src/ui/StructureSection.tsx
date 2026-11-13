import type { ReactElement } from 'react';
import type { RoofType, JointPriority, BackingType, RearStructuralRails } from '../resolver';
import { M3ToggleRow } from './M3ToggleRow';
import { NumericInput } from './NumericInput';

/**
 * Props for the StructureSection component.
 */
export interface StructureSectionProps {
  /** Structural span warnings to display at top of section. */
  structuralSpanWarnings?: string[];
  /** Roof / top cover type of the cabinet. */
  roofType: RoofType;
  /** Callback fired when the roof type changes. */
  onRoofTypeChange?: (roof: RoofType) => void;
  /** Joint priority between bottom board and side panels. */
  jointPriority: JointPriority;
  /** Callback fired when the joint priority changes. */
  onJointPriorityChange?: (priority: JointPriority) => void;
  /** Whether the module is configured as a standalone island cabinet without backing. */
  isIslandCabinet?: boolean;
  /** Whether the module has a rear backing board. */
  hasBacking?: boolean;
  /** Backing board thickness in mm. */
  backingThicknessMm: number;
  /** Backing installation type (groove, overlay, etc.). */
  backingType: BackingType;
  /** Callback fired when island cabinet flag changes. */
  onIsIslandCabinetChange?: (val: boolean) => void;
  /** Callback fired when backing presence changes. */
  onHasBackingChange?: (val: boolean) => void;
  /** Callback fired when backing thickness changes. */
  onBackingThicknessChange?: (val: number) => void;
  /** Callback fired when backing type changes. */
  onBackingTypeChange?: (val: BackingType) => void;
  /** Module bay grid type. */
  gridType?: string;
  /** Whether vertical partitions pass all the way through the top cover. */
  partitionPassThroughRoof?: boolean;
  /** Callback fired when partition pass-through flag changes. */
  onPartitionPassThroughRoofChange?: (val: boolean) => void;
  /** Rear structural rail configuration. */
  rearStructuralRails?: RearStructuralRails;
  /** Width of rear structural rails in mm. */
  rearStructuralRailsWidthMm?: number;
  /** Callback fired when rear structural rails configuration changes. */
  onRearStructuralRailsChange?: (val: RearStructuralRails) => void;
  /** Callback fired when rear structural rails width changes. */
  onRearStructuralRailsWidthChange?: (val: number) => void;
  /** Orientation of top front/back rails ('horizontal' | 'vertical'). */
  railOrientation?: 'horizontal' | 'vertical';
  /** Callback fired when rail orientation changes. */
  onRailOrientationChange?: (val: 'horizontal' | 'vertical') => void;
  /** Whether there is a central middle brace between top rails. */
  hasMiddleBrace?: boolean;
  /** Width of central middle brace in mm. */
  middleBraceWidthMm?: number;
  /** Callback fired when middle brace presence changes. */
  onHasMiddleBraceChange?: (val: boolean) => void;
  /** Callback fired when middle brace width changes. */
  onMiddleBraceWidthChange?: (val: number) => void;
  /** Whether the module has a wall hanging rail. */
  hasWallHangingRail?: boolean;
  /** Width of wall hanging rail in mm. */
  wallHangingRailWidthMm?: number;
  /** Callback fired when wall hanging rail presence changes. */
  onHasWallHangingRailChange?: (val: boolean) => void;
  /** Callback fired when wall hanging rail width changes. */
  onWallHangingRailWidthChange?: (val: number) => void;
  /** Whether the module includes an integrated plinth / zocalo. */
  hasPlinth?: boolean;
  /** Plinth height in mm. */
  plinthHeightMm?: number;
  /** Plinth setback in mm. */
  plinthSetbackMm?: number;
  /** Callback fired when plinth presence changes. */
  onHasPlinthChange?: (val: boolean) => void;
  /** Callback fired when plinth height changes. */
  onPlinthHeightChange?: (val: number) => void;
  /** Callback fired when plinth setback changes. */
  onPlinthSetbackChange?: (val: number) => void;
  /** Optional callback to save the current base structure as a reusable user template. */
  onSaveUserTemplate?: (name: string, description?: string) => Promise<void> | void;
}

/**
 * Section for configuring carcass structure, roof, backing, ties, wall rails, and plinth.
 */
export function StructureSection({
  structuralSpanWarnings,
  roofType,
  onRoofTypeChange,
  jointPriority,
  onJointPriorityChange,
  isIslandCabinet = false,
  hasBacking = true,
  backingThicknessMm,
  backingType,
  onIsIslandCabinetChange,
  onHasBackingChange,
  onBackingThicknessChange,
  onBackingTypeChange,
  gridType,
  partitionPassThroughRoof = false,
  onPartitionPassThroughRoofChange,
  rearStructuralRails = 'none',
  rearStructuralRailsWidthMm = 80,
  onRearStructuralRailsChange,
  onRearStructuralRailsWidthChange,
  railOrientation = 'horizontal',
  onRailOrientationChange,
  hasMiddleBrace = false,
  middleBraceWidthMm = 80,
  onHasMiddleBraceChange,
  onMiddleBraceWidthChange,
  hasWallHangingRail = false,
  wallHangingRailWidthMm = 100,
  onHasWallHangingRailChange,
  onWallHangingRailWidthChange,
  hasPlinth = false,
  plinthHeightMm = 100,
  plinthSetbackMm = 50,
  onHasPlinthChange,
  onPlinthHeightChange,
  onPlinthSetbackChange,
  onSaveUserTemplate,
}: StructureSectionProps): ReactElement {
  return (
    <fieldset className="builder-section">
      <legend className="builder-section-title">
        <span>🏗️ Estructura del Casco y Techo</span>
      </legend>

      {structuralSpanWarnings && structuralSpanWarnings.length > 0 && (
        <div
          className="m3-alert-banner warning"
          style={{
            padding: '10px 14px',
            borderRadius: '8px',
            backgroundColor: 'var(--md-sys-color-warning-container)',
            border: '1px solid var(--md-sys-color-warning-border)',
            color: 'var(--md-sys-color-on-warning-container)',
            fontSize: '0.82rem',
            marginBottom: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {structuralSpanWarnings.map((warn, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <span style={{ fontSize: '1rem' }}>⚠️</span>
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}

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

      {/* Fondo y Módulo Isla (Puntos 4, 5, 6) */}
      <div className="form-group">
        <label htmlFor="form-backing-type">Fondo posterior / Módulo Isla:</label>
        <select
          id="form-backing-type"
          className="m3-select"
          style={{ width: '100%', fontSize: '0.85rem' }}
          value={
            isIslandCabinet
              ? 'island'
              : !hasBacking
              ? 'none'
              : backingThicknessMm >= 15
              ? 'solid-thick'
              : backingType === 'overlay'
              ? 'overlay'
              : 'groove'
          }
          onChange={(e) => {
            const val = e.target.value;
            if (val === 'island') {
              onIsIslandCabinetChange?.(true);
              onHasBackingChange?.(false);
            } else if (val === 'none') {
              onIsIslandCabinetChange?.(false);
              onHasBackingChange?.(false);
            } else if (val === 'solid-thick') {
              onIsIslandCabinetChange?.(false);
              onHasBackingChange?.(true);
              onBackingThicknessChange?.(18);
              onBackingTypeChange?.('groove');
            } else if (val === 'overlay') {
              onIsIslandCabinetChange?.(false);
              onHasBackingChange?.(true);
              if (backingThicknessMm >= 15) onBackingThicknessChange?.(3);
              onBackingTypeChange?.('overlay');
            } else {
              // groove
              onIsIslandCabinetChange?.(false);
              onHasBackingChange?.(true);
              if (backingThicknessMm >= 15) onBackingThicknessChange?.(3);
              onBackingTypeChange?.('groove');
            }
          }}
        >
          <option value="groove">Con fondo ranurado</option>
          <option value="overlay">Fondo fino clavado / atornillado posterior</option>
          <option value="solid-thick">Fondo grueso estructural (18mm con confirmat)</option>
          <option value="island">🏝️ Mueble tipo Isla (Sin fondo, cantos traseros aplacados)</option>
          <option value="none">Sin fondo (Abierto)</option>
        </select>
      </div>

      {/* Espesor e indicador coherente de fondo según material */}
      {hasBacking && !isIslandCabinet && (
        <div className="form-group" style={{ marginTop: '-0.25rem' }}>
          <label style={{ fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
            Espesor de fondo y ranura de casco:
          </label>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '4px',
              padding: '6px 12px',
              borderRadius: '8px',
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              fontSize: '0.85rem',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--md-sys-color-primary)' }}>
              📏 {backingThicknessMm} mm
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              (determinado por la placa seleccionada en Materiales)
            </span>
          </div>
        </div>
      )}

      {/* Divisores pasantes hasta arriba (Decision 2) */}
      {gridType && gridType !== '1-bay' && (
        <div className="form-group" style={{ marginTop: '0.25rem' }}>
          <M3ToggleRow
            id="struct-partition-pass-through-roof"
            label="Divisores pasantes hasta arriba (secciona la tapa/fajas por vano)"
            checked={Boolean(partitionPassThroughRoof)}
            onChange={(checked) => onPartitionPassThroughRoofChange?.(checked)}
          />
        </div>
      )}

      {/* Tirantes Estructurales de Amarre (Punto 6) */}
      <div className="form-group">
        <label htmlFor="form-rear-rails">Tirantes estructurales de amarre / escuadra:</label>
        <select
          id="form-rear-rails"
          className="m3-select"
          style={{ width: '100%', fontSize: '0.85rem' }}
          value={rearStructuralRails}
          onChange={(e) => onRearStructuralRailsChange?.(e.target.value as RearStructuralRails)}
        >
          <option value="none">Sin tirantes traseros</option>
          <option value="top-and-bottom">Superior e Inferior (Rigidez y escuadra)</option>
          <option value="top-only">Solo Superior</option>
        </select>
      </div>

      {rearStructuralRails !== 'none' && (
        <div className="form-group" style={{ marginTop: '0.25rem' }}>
          <label htmlFor="form-rear-rails-width" style={{ fontSize: '0.8rem', display: 'block' }}>
            Ancho de tirantes traseros (mm):
          </label>
          <NumericInput
            id="form-rear-rails-width"
            value={rearStructuralRailsWidthMm}
            min={50}
            max={200}
            step={10}
            onChange={(val) => onRearStructuralRailsWidthChange?.(val)}
          />
        </div>
      )}

      {/* Refuerzos Avanzados de Estructura y Zócalo (Punto 7) */}
      {roofType === 'front-back-rails' && (
        <>
          <div className="form-group">
            <label htmlFor="input-rail-orientation">Orientación de Fajas Superiores:</label>
            <select
              id="input-rail-orientation"
              className="m3-select"
              style={{ width: '100%', fontSize: '0.85rem' }}
              value={railOrientation}
              onChange={(e) => onRailOrientationChange?.(e.target.value as 'horizontal' | 'vertical')}
            >
              <option value="horizontal">Horizontal (Planos)</option>
              <option value="vertical">Vertical de Canto (Mayor resistencia)</option>
            </select>
          </div>

          <div className="form-group">
            <M3ToggleRow
              id="struct-middle-brace"
              label="Refuerzo central entre fajas"
              checked={Boolean(hasMiddleBrace)}
              onChange={(checked) => onHasMiddleBraceChange?.(checked)}
            />
            {hasMiddleBrace && (
              <div style={{ marginTop: '0.35rem' }}>
                <label htmlFor="input-middle-brace-width" style={{ fontSize: '0.75rem', display: 'block' }}>
                  Ancho refuerzo (mm):
                </label>
                <NumericInput
                  id="input-middle-brace-width"
                  value={middleBraceWidthMm}
                  min={40}
                  max={250}
                  step={10}
                  onChange={(val) => onMiddleBraceWidthChange?.(val)}
                />
              </div>
            )}
          </div>
        </>
      )}

      <div className="form-group">
        <M3ToggleRow
          id="struct-wall-hanging-rail"
          label="Faja posterior de amarre / colgado a pared"
          checked={Boolean(hasWallHangingRail)}
          onChange={(checked) => onHasWallHangingRailChange?.(checked)}
        />
        {hasWallHangingRail && (
          <div style={{ marginTop: '0.35rem' }}>
            <label htmlFor="input-wall-rail-width" style={{ fontSize: '0.75rem', display: 'block' }}>
              Ancho faja (mm):
            </label>
            <NumericInput
              id="input-wall-rail-width"
              value={wallHangingRailWidthMm}
              min={50}
              max={200}
              step={10}
              onChange={(val) => onWallHangingRailWidthChange?.(val)}
            />
          </div>
        )}
      </div>

      <div className="form-group">
        <M3ToggleRow
          id="struct-plinth"
          label="Zócalo / Plinto estructural integrado"
          checked={Boolean(hasPlinth)}
          onChange={(checked) => onHasPlinthChange?.(checked)}
        />
        {hasPlinth && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.5rem', marginTop: '0.35rem' }}>
            <div>
              <label htmlFor="input-plinth-height" style={{ fontSize: '0.75rem', display: 'block' }}>
                Alto zócalo (mm):
              </label>
              <NumericInput
                id="input-plinth-height"
                value={plinthHeightMm}
                min={40}
                max={200}
                step={10}
                onChange={(val) => onPlinthHeightChange?.(val)}
              />
            </div>
            <div>
              <label htmlFor="input-plinth-setback" style={{ fontSize: '0.75rem', display: 'block' }}>
                Retranqueo (mm):
              </label>
              <NumericInput
                id="input-plinth-setback"
                value={plinthSetbackMm}
                min={0}
                max={150}
                step={5}
                onChange={(val) => onPlinthSetbackChange?.(val)}
              />
            </div>
          </div>
        )}
      </div>

      {onSaveUserTemplate && (
        <div className="form-group" style={{ marginTop: '0.5rem' }}>
          <button
            type="button"
            className="m3-btn m3-btn--small m3-btn--tonal"
            style={{ width: '100%' }}
            onClick={() => {
              const name = window.prompt?.('Nombre para la nueva plantilla de estructura base:', 'Módulo Base Personalizado');
              if (name) {
                void onSaveUserTemplate(name, 'Estructura base personalizada con refuerzos');
              }
            }}
          >
            💾 Guardar Estructura como Módulo Base
          </button>
        </div>
      )}
    </fieldset>
  );
}
