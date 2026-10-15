import { type ReactElement } from 'react';
import {
  type JointPriority,
  type RoofType,
  type BackingType,
  type RearStructuralRails,
} from '../resolver';
import { NumericInput } from './NumericInput';

export interface BaseStructureEditorProps {
  jointPriority: JointPriority;
  roofType: RoofType;
  railWidthMm?: number;
  railOrientation: 'horizontal' | 'vertical';
  hasMiddleBrace: boolean;
  middleBraceWidthMm: number;
  hasWallHangingRail: boolean;
  wallHangingRailWidthMm: number;
  hasPlinth: boolean;
  plinthHeightMm: number;
  plinthSetbackMm: number;
  hasBacking: boolean;
  backingType?: BackingType;
  backingThicknessMm?: number;
  isIslandCabinet?: boolean;
  rearStructuralRails?: RearStructuralRails;
  rearStructuralRailsWidthMm?: number;
  onJointPriorityChange: (val: JointPriority) => void;
  onRoofTypeChange: (val: RoofType) => void;
  onRailOrientationChange: (val: 'horizontal' | 'vertical') => void;
  onHasMiddleBraceChange: (val: boolean) => void;
  onMiddleBraceWidthChange: (val: number) => void;
  onHasWallHangingRailChange: (val: boolean) => void;
  onWallHangingRailWidthChange: (val: number) => void;
  onHasPlinthChange: (val: boolean) => void;
  onPlinthHeightChange: (val: number) => void;
  onPlinthSetbackChange: (val: number) => void;
  onHasBackingChange: (val: boolean) => void;
  onBackingTypeChange?: (val: BackingType) => void;
  onBackingThicknessChange?: (val: number) => void;
  onIsIslandCabinetChange?: (val: boolean) => void;
  onRearStructuralRailsChange?: (val: RearStructuralRails) => void;
  onRearStructuralRailsWidthChange?: (val: number) => void;
  onSaveAsBaseTemplate?: () => void;
}

/**
 * Editor de Estructura Base para módulos carpinteros (Point 7).
 * Permite configurar refuerzos, travesaños verticales/planos, fajas de colgado y zócalos.
 */
export function BaseStructureEditor(props: BaseStructureEditorProps): ReactElement {
  const {
    jointPriority,
    roofType,
    railOrientation,
    hasMiddleBrace,
    middleBraceWidthMm,
    hasWallHangingRail,
    wallHangingRailWidthMm,
    hasPlinth,
    plinthHeightMm,
    plinthSetbackMm,
    hasBacking,
    backingType = 'groove',
    backingThicknessMm = 3,
    isIslandCabinet = false,
    rearStructuralRails = 'none',
    rearStructuralRailsWidthMm = 80,
    onJointPriorityChange,
    onRoofTypeChange,
    onRailOrientationChange,
    onHasMiddleBraceChange,
    onMiddleBraceWidthChange,
    onHasWallHangingRailChange,
    onWallHangingRailWidthChange,
    onHasPlinthChange,
    onPlinthHeightChange,
    onPlinthSetbackChange,
    onHasBackingChange,
    onBackingTypeChange,
    onBackingThicknessChange,
    onIsIslandCabinetChange,
    onRearStructuralRailsChange,
    onRearStructuralRailsWidthChange,
    onSaveAsBaseTemplate,
  } = props;

  return (
    <div className="base-structure-editor" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className="m3-structure-card">
        <h4 className="m3-structure-title">
          🏗️ Unión y Ensamble Estructural
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <div>
            <label htmlFor="base-joint-priority" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              Prioridad de Costados / Piso:
            </label>
            <select
              id="base-joint-priority"
              className="m3-select"
              style={{ width: '100%', fontSize: '0.85rem' }}
              value={jointPriority}
              onChange={(e) => onJointPriorityChange(e.target.value as JointPriority)}
            >
              <option value="lateral-over-bottom">Costado pasa (Lateral continuo)</option>
              <option value="bottom-over-lateral">Piso pasa (Fondo continuo)</option>
            </select>
          </div>

          <div>
            <label htmlFor="base-roof-type" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              Tipo de Techo:
            </label>
            <select
              id="base-roof-type"
              className="m3-select"
              style={{ width: '100%', fontSize: '0.85rem' }}
              value={roofType}
              onChange={(e) => onRoofTypeChange(e.target.value as RoofType)}
            >
              <option value="front-back-rails">Fajas / Travesaños (Bajo mesada)</option>
              <option value="solid-panel">Tapa Sólida Completa</option>
              <option value="none">Sin Techo (Abierto)</option>
            </select>
          </div>
        </div>
      </div>

      {roofType === 'front-back-rails' && (
        <div className="m3-structure-card">
          <h4 className="m3-structure-title">
            🪚 Travesaños y Refuerzos Superiores
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label htmlFor="base-rail-orientation" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                Orientación de Fajas:
              </label>
              <select
                id="base-rail-orientation"
                className="m3-select"
                style={{ width: '100%', fontSize: '0.85rem' }}
                value={railOrientation}
                onChange={(e) => onRailOrientationChange(e.target.value as 'horizontal' | 'vertical')}
              >
                <option value="horizontal">Horizontal (Planos)</option>
                <option value="vertical">Vertical de Canto (Mayor resistencia)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, marginTop: '1.2rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={hasMiddleBrace}
                  onChange={(e) => onHasMiddleBraceChange(e.target.checked)}
                />
                Refuerzo Central entre Fajas
              </label>
            </div>

            {hasMiddleBrace && (
              <div>
                <label htmlFor="middle-brace-width" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  Ancho Refuerzo Central (mm):
                </label>
                <NumericInput
                  id="middle-brace-width"
                  value={middleBraceWidthMm}
                  min={40}
                  max={250}
                  step={10}
                  onChange={onMiddleBraceWidthChange}
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="m3-structure-card">
        <h4 className="m3-structure-title">
          🧱 Faja de Colgado / Amarre y Zócalo
        </h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={hasWallHangingRail}
                onChange={(e) => onHasWallHangingRailChange(e.target.checked)}
              />
              Faja Posterior de Amarre / Colgado
            </label>
            {hasWallHangingRail && (
              <div style={{ marginTop: '0.4rem' }}>
                <label htmlFor="wall-rail-width" style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                  Ancho de faja (mm):
                </label>
                <NumericInput
                  id="wall-rail-width"
                  value={wallHangingRailWidthMm}
                  min={50}
                  max={200}
                  step={10}
                  onChange={onWallHangingRailWidthChange}
                />
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={hasPlinth}
                onChange={(e) => onHasPlinthChange(e.target.checked)}
              />
              Zócalo / Plinto Estructural
            </label>
            {hasPlinth && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                <div>
                  <label htmlFor="plinth-height" style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                    Alto (mm):
                  </label>
                  <NumericInput
                    id="plinth-height"
                    value={plinthHeightMm}
                    min={40}
                    max={200}
                    step={10}
                    onChange={onPlinthHeightChange}
                  />
                </div>
                <div>
                  <label htmlFor="plinth-setback" style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                    Retranqueo (mm):
                  </label>
                  <NumericInput
                    id="plinth-setback"
                    value={plinthSetbackMm}
                    min={0}
                    max={150}
                    step={5}
                    onChange={onPlinthSetbackChange}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="base-backing-mode" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              Configuración de Fondo:
            </label>
            <select
              id="base-backing-mode"
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
                  onHasBackingChange(false);
                } else if (val === 'none') {
                  onIsIslandCabinetChange?.(false);
                  onHasBackingChange(false);
                } else if (val === 'solid-thick') {
                  onIsIslandCabinetChange?.(false);
                  onHasBackingChange(true);
                  onBackingThicknessChange?.(18);
                  onBackingTypeChange?.('groove');
                } else if (val === 'overlay') {
                  onIsIslandCabinetChange?.(false);
                  onHasBackingChange(true);
                  onBackingThicknessChange?.(3);
                  onBackingTypeChange?.('overlay');
                } else {
                  // groove
                  onIsIslandCabinetChange?.(false);
                  onHasBackingChange(true);
                  onBackingThicknessChange?.(3);
                  onBackingTypeChange?.('groove');
                }
              }}
            >
              <option value="groove">Fondo de Módulo (Ranurado 3mm)</option>
              <option value="overlay">Fondo Fino Clavado / Atornillado (3mm)</option>
              <option value="solid-thick">Fondo Grueso Estructural (18mm con confirmat)</option>
              <option value="island">Mueble tipo Isla (Sin fondo, cantos traseros aplacados)</option>
              <option value="none">Sin fondo (Abierto)</option>
            </select>
          </div>

          <div>
            <label htmlFor="base-rear-rails" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              Tirantes Estructurales Traseros:
            </label>
            <select
              id="base-rear-rails"
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
            <div>
              <label htmlFor="base-rear-rails-width" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                Ancho Tirantes Traseros (mm):
              </label>
              <NumericInput
                id="base-rear-rails-width"
                value={rearStructuralRailsWidthMm}
                min={50}
                max={200}
                step={10}
                onChange={(val) => onRearStructuralRailsWidthChange?.(val)}
              />
            </div>
          )}
        </div>
      </div>

      {onSaveAsBaseTemplate && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button
            type="button"
            className="m3-btn m3-btn--primary"
            onClick={onSaveAsBaseTemplate}
          >
            💾 Guardar Estructura como Módulo Base
          </button>
        </div>
      )}
    </div>
  );
}
