import { type ReactElement } from 'react';
import { type JointPriority, type RoofType } from '../resolver';
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
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={hasBacking}
                onChange={(e) => onHasBackingChange(e.target.checked)}
              />
              Fondo de Módulo (Ranurado 3mm)
            </label>
          </div>
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
