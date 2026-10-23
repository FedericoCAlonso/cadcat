import { useState } from 'react';
import type { Material } from '../model';
import {
  DEFAULT_STANDARD_THICKNESSES_MM,
  filterMaterialsByThickness,
  getMaterialThicknessMm,
  listThicknessOptions,
} from '../model';

/** Minimum touch target edge (px) for the thickness chips (Material Design 3). */
const TOUCH_TARGET_PX = 48;

export interface ThicknessMaterialPickerProps {
  /** Unique id used for the select and accessibility labels. */
  id: string;
  label: string;
  materials: readonly Material[];
  selectedMaterialId: string;
  onMaterialChange: (materialId: string) => void;
  standardThicknessesMm?: readonly number[];
  /** Caption shown above the thickness chips. */
  thicknessCaption?: string;
  /**
   * Called when the chosen thickness has no plate in the catalog. Lets the owner keep an
   * explicit thickness (e.g. piece-level override) until a plate is defined.
   */
  onThicknessWithoutPlate?: (thicknessMm: number) => void;
}

/**
 * Plate selector coupled to thickness: the thickness follows the selected plate; picking a
 * thickness first (standard values first) filters the plate list to those that match it.
 */
export function ThicknessMaterialPicker({
  id,
  label,
  materials,
  selectedMaterialId,
  onMaterialChange,
  standardThicknessesMm = DEFAULT_STANDARD_THICKNESSES_MM,
  thicknessCaption = 'Espesor (mm):',
  onThicknessWithoutPlate,
}: ThicknessMaterialPickerProps) {
  const selected = materials.find((m) => m.id === selectedMaterialId);
  const selectedThickness = getMaterialThicknessMm(selected);
  // Explicit thickness filter chosen by the user; null = automatic (follow the selected plate)
  const [pickedThickness, setPickedThickness] = useState<number | null>(null);

  const activeThickness = pickedThickness ?? selectedThickness ?? null;
  const options = listThicknessOptions(materials, standardThicknessesMm);
  const visible = filterMaterialsByThickness(materials, pickedThickness ?? null);

  const handleThickness = (t: number) => {
    setPickedThickness(t);
    const matching = filterMaterialsByThickness(materials, t);
    if (matching.length === 0) {
      onThicknessWithoutPlate?.(t);
      return;
    }
    if (!matching.some((m) => m.id === selectedMaterialId)) {
      onMaterialChange(matching[0]!.id);
    }
  };

  return (
    <div style={{ minWidth: 0, width: '100%' }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', overflowWrap: 'break-word' }}>
        {label}
      </label>
      <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--md-sys-color-on-surface-variant)', marginBottom: '0.2rem' }}>
        {thicknessCaption}
      </span>
      <div
        role="group"
        aria-label={`Espesor para ${label}`}
        style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginBottom: '0.4rem' }}
      >
        {options.map((t) => {
          const isActive = activeThickness === t;
          const hasPlate = filterMaterialsByThickness(materials, t).length > 0;
          return (
            <button
              key={t}
              type="button"
              className={`builder-segmented-btn ${isActive ? 'selected' : ''}`}
              aria-pressed={isActive}
              title={hasPlate ? `Placas de ${t} mm` : `Sin placas de ${t} mm en el catálogo`}
              onClick={() => handleThickness(t)}
              style={{
                minHeight: `${TOUCH_TARGET_PX}px`,
                minWidth: `${TOUCH_TARGET_PX}px`,
                opacity: hasPlate ? 1 : 0.6,
              }}
            >
              {t} mm
            </button>
          );
        })}
        {pickedThickness !== null && (
          <button
            type="button"
            className="builder-segmented-btn"
            onClick={() => setPickedThickness(null)}
            aria-label="Quitar filtro de espesor"
            style={{ minHeight: `${TOUCH_TARGET_PX}px`, minWidth: `${TOUCH_TARGET_PX}px` }}
          >
            ✕ Todos
          </button>
        )}
      </div>
      <select
        id={id}
        className="m3-select"
        value={selectedMaterialId}
        onChange={(e) => {
          setPickedThickness(null);
          onMaterialChange(e.target.value);
        }}
        style={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          textOverflow: 'ellipsis',
          minHeight: `${TOUCH_TARGET_PX}px`,
        }}
      >
        {visible.length === 0 && <option value={selectedMaterialId}>Sin placas de {activeThickness} mm en el catálogo</option>}
        {visible.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name ?? m.id} ({m.thicknessMm} mm)
          </option>
        ))}
      </select>
    </div>
  );
}
