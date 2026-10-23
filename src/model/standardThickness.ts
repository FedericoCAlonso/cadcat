import type { Material } from './material';

/**
 * Standard sheet thicknesses (mm) offered first when a thickness is chosen before a plate.
 * Centralised default; the project can override it via `hardware.standardThicknessesMm`.
 */
export const DEFAULT_STANDARD_THICKNESSES_MM: readonly number[] = [3, 6, 9, 15, 18, 25];

type ThicknessHolder = Pick<Material, 'thicknessMm'>;

/** Numeric thickness of a material, or undefined when it is still "to confirm". */
export function getMaterialThicknessMm(material: ThicknessHolder | undefined): number | undefined {
  return typeof material?.thicknessMm === 'number' ? material.thicknessMm : undefined;
}

/**
 * Thickness options: standard values first (in their declared order), then any other
 * thickness present in the catalog (ascending). No duplicates.
 */
export function listThicknessOptions(
  materials: readonly ThicknessHolder[],
  standardThicknessesMm: readonly number[] = DEFAULT_STANDARD_THICKNESSES_MM,
): number[] {
  const extra = new Set<number>();
  for (const m of materials) {
    const t = getMaterialThicknessMm(m);
    if (t !== undefined && !standardThicknessesMm.includes(t)) extra.add(t);
  }
  return [...standardThicknessesMm, ...[...extra].sort((a, b) => a - b)];
}

/** Plates matching a thickness; a null thickness means "no filter". */
export function filterMaterialsByThickness<M extends ThicknessHolder>(
  materials: readonly M[],
  thicknessMm: number | null,
): M[] {
  if (thicknessMm === null) return [...materials];
  return materials.filter((m) => getMaterialThicknessMm(m) === thicknessMm);
}
