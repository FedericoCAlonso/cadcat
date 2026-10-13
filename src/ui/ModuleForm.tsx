import type { ReactElement, ChangeEvent } from 'react';
import type { Material, EdgeBand } from '../model';
import type { TemplateDefinition } from '../resolver';

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
 * Module configuration form component.
 * Allows editing parameters, material, and edge band.
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

  return (
    <section aria-labelledby="form-heading" className="module-form">
      <h2 id="form-heading">Module Parameters</h2>

      {templates && templates.length > 0 && onTemplateChange && (
        <div className="form-group">
          <label htmlFor="select-template">Module Template:</label>
          <select
            id="select-template"
            value={selectedTemplateId}
            onChange={(e) => onTemplateChange(e.target.value)}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="input-width">Width (mm):</label>
        <input
          id="input-width"
          type="number"
          min="100"
          max="3000"
          value={width}
          onChange={handleNumberInput(onWidthChange)}
        />
      </div>

      <div className="form-group">
        <label htmlFor="input-height">Height (mm):</label>
        <input
          id="input-height"
          type="number"
          min="100"
          max="3000"
          value={height}
          onChange={handleNumberInput(onHeightChange)}
        />
      </div>

      <div className="form-group">
        <label htmlFor="input-depth">Depth (mm):</label>
        <input
          id="input-depth"
          type="number"
          min="100"
          max="1500"
          value={depth}
          onChange={handleNumberInput(onDepthChange)}
        />
      </div>

      <div className="form-group">
        <label htmlFor="select-material">Sheet Material:</label>
        <select
          id="select-material"
          value={selectedMaterialId}
          onChange={(e) => onMaterialChange(e.target.value)}
        >
          {materials.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} ({m.thicknessMm} mm)
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="select-edgeband">Edge Band:</label>
        <select
          id="select-edgeband"
          value={selectedEdgeBandId}
          onChange={(e) => onEdgeBandChange(e.target.value)}
        >
          <option value="">None</option>
          {edgeBands.map((eb) => (
            <option key={eb.id} value={eb.id}>
              {eb.id} ({eb.kind}, {eb.thicknessMm} mm)
            </option>
          ))}
        </select>
      </div>

      <div className="form-actions">
        <button type="button" onClick={onSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Module to Database'}
        </button>
        {onExportCsv && (
          <button type="button" onClick={onExportCsv} className="export-btn">
            Export Cut List (CSV)
          </button>
        )}
        {onExportPdf && (
          <button type="button" onClick={onExportPdf} className="export-btn">
            Export Cut Plan (PDF)
          </button>
        )}
      </div>
    </section>
  );
}
