import type { ReactElement, ChangeEvent } from 'react';
import type { Material, EdgeBand } from '../model';
import type { TemplateDefinition } from '../resolver';
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
}

/**
 * Module configuration form component with Argentine Spanish localization and M3 styles.
 * Supports quick numeric touch steppers and full accessibility.
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

  return (
    <section aria-labelledby="form-heading" className="m3-card module-form">
      <div className="m3-card__header">
        <h2 id="form-heading" className="m3-card__title">
          📐 Medidas y Módulo
          <span className="visually-hidden">Module Parameters</span>
        </h2>
        <p className="m3-card__subtitle">
          Configurá las dimensiones del mueble, placa y tapacantos.
        </p>
      </div>

      {templates && templates.length > 0 && onTemplateChange && (
        <div className="form-group">
          <label htmlFor="select-template">
            Plantilla de mueble:
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
          Ancho (mm):
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
          Alto (mm):
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
          Profundidad (mm):
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

      {/* Material */}
      <div className="form-group">
        <label htmlFor="select-material">
          Placa de melamina:
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

      {/* Botones de acción */}
      <div className="form-actions m3-button-row">
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
