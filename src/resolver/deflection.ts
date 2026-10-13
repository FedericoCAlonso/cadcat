import { type Material, type DeflectionConfig } from '../model';
import { type ResolvedPieceWithCutSize } from './edgeBand';

/**
 * Standard acceleration of gravity in m/s^2.
 */
export const GRAVITY_ACCELERATION_M_S2 = 9.80665;

/**
 * Default modulus of elasticity for wood panel boards (particleboard / MDF) in MPa (N/mm^2).
 * Mark as TO_CONFIRM until domain expert confirms exact shop value per supplier.
 */
export const DEFAULT_ELASTIC_MODULUS_MPA = 3000; // TO_CONFIRM

/**
 * Default deflection criteria from shop configuration.
 */
export const DEFAULT_DEFLECTION_CONFIG: DeflectionConfig = {
  maxDeflectionRatio: 200, // TO_CONFIRM: L / 200 standard limit
  maxAbsoluteDeflectionMm: 3.0, // TO_CONFIRM: 3.0 mm maximum absolute sag
  designUniformLoadKgM2: 30.0, // TO_CONFIRM: 30 kg/m^2 distributed storage load
};

export interface ShelfDeflectionInput {
  spanMm: number; // L: distance between shelf supports
  depthMm: number; // D: shelf depth
  thicknessMm: number; // T: shelf thickness
  elasticModulusMPa?: number | 'TO_CONFIRM';
  designUniformLoadKgM2?: number;
  maxDeflectionRatio?: number;
  maxAbsoluteDeflectionMm?: number;
}

export interface ShelfDeflectionResult {
  spanMm: number;
  depthMm: number;
  thicknessMm: number;
  elasticModulusMPa: number;
  isElasticModulusConfirmed: boolean;
  totalLoadKg: number;
  totalLoadN: number;
  inertiaMm4: number; // Area moment of inertia I = (D * T^3) / 12
  calculatedDeflectionMm: number; // Mid-span deflection delta
  allowableDeflectionMm: number; // delta_max = min(L / ratio, maxAbsolute)
  deflectionRatio: number; // Actual L / delta ratio
  exceedsRatio: boolean;
  exceedsAbsolute: boolean;
  hasWarning: boolean;
  warningMessage?: string;
}

/**
 * Calculates shelf deflection under uniform distributed load using Euler-Bernoulli beam theory.
 * Simply supported beam formula: delta = (5 * q * L^4) / (384 * E * I) = (5 * W * L^3) / (384 * E * I).
 * ASD-STE100: Short sentences and clear technical terms.
 */
export function calculateShelfDeflection(input: ShelfDeflectionInput): ShelfDeflectionResult {
  const {
    spanMm,
    depthMm,
    thicknessMm,
    elasticModulusMPa,
    designUniformLoadKgM2 = DEFAULT_DEFLECTION_CONFIG.designUniformLoadKgM2,
    maxDeflectionRatio = DEFAULT_DEFLECTION_CONFIG.maxDeflectionRatio,
    maxAbsoluteDeflectionMm = DEFAULT_DEFLECTION_CONFIG.maxAbsoluteDeflectionMm,
  } = input;

  // Resolve elastic modulus (use numeric value if confirmed, otherwise shop default)
  const isConfirmed = typeof elasticModulusMPa === 'number' && elasticModulusMPa > 0;
  const E = isConfirmed ? elasticModulusMPa : DEFAULT_ELASTIC_MODULUS_MPA;

  // Shelf surface area in square meters: A = (L * D) / 1,000,000
  const areaM2 = (spanMm * depthMm) / 1_000_000;

  // Total mass in kg and force in Newtons
  const totalLoadKg = designUniformLoadKgM2 * areaM2;
  const totalLoadN = totalLoadKg * GRAVITY_ACCELERATION_M_S2;

  // Area moment of inertia for rectangular section: I = (D * T^3) / 12 (mm^4)
  const inertiaMm4 = (depthMm * Math.pow(thicknessMm, 3)) / 12;

  // Deflection at center of simply supported span:
  // delta = (5 * W * L^3) / (384 * E * I)
  // W is in N, L is in mm, E is in MPa (N/mm^2), I is in mm^4 -> delta in mm
  const calculatedDeflectionMm =
    inertiaMm4 > 0 && E > 0
      ? (5 * totalLoadN * Math.pow(spanMm, 3)) / (384 * E * inertiaMm4)
      : 0;

  // Allowable deflection limit: min(L / maxDeflectionRatio, maxAbsoluteDeflectionMm)
  const ratioLimitMm = maxDeflectionRatio > 0 ? spanMm / maxDeflectionRatio : Infinity;
  const allowableDeflectionMm = Math.min(ratioLimitMm, maxAbsoluteDeflectionMm);

  const roundedDeflection = Math.round(calculatedDeflectionMm * 100) / 100;
  const roundedAllowable = Math.round(allowableDeflectionMm * 100) / 100;

  const exceedsRatio = calculatedDeflectionMm > ratioLimitMm;
  const exceedsAbsolute = calculatedDeflectionMm > maxAbsoluteDeflectionMm;
  const hasWarning = calculatedDeflectionMm > allowableDeflectionMm;

  const actualRatio =
    calculatedDeflectionMm > 0 ? Math.round(spanMm / calculatedDeflectionMm) : Infinity;

  let warningMessage: string | undefined;
  if (hasWarning) {
    warningMessage = `Shelf deflection ${roundedDeflection.toFixed(2)} mm exceeds allowable limit ${roundedAllowable.toFixed(2)} mm (span: ${spanMm} mm, load: ${designUniformLoadKgM2} kg/m²). Consider adding a center support or increasing thickness.`;
  }

  return {
    spanMm,
    depthMm,
    thicknessMm,
    elasticModulusMPa: E,
    isElasticModulusConfirmed: isConfirmed,
    totalLoadKg: Math.round(totalLoadKg * 100) / 100,
    totalLoadN: Math.round(totalLoadN * 10) / 10,
    inertiaMm4: Math.round(inertiaMm4 * 10) / 10,
    calculatedDeflectionMm: roundedDeflection,
    allowableDeflectionMm: roundedAllowable,
    deflectionRatio: actualRatio,
    exceedsRatio,
    exceedsAbsolute,
    hasWarning,
    warningMessage,
  };
}

/**
 * Checks a resolved piece for shelf deflection if the piece has a shelf role.
 * Returns null if the piece is not a shelf.
 */
export function checkPieceDeflection(
  piece: ResolvedPieceWithCutSize,
  material: Material | undefined,
  config?: DeflectionConfig,
): ShelfDeflectionResult | null {
  const role = piece.role.toLowerCase();
  if (!role.includes('shelf')) {
    return null;
  }

  // Span is finished width across carcase opening; depth is finished height/depth
  const spanMm = piece.dimensionsMm.width;
  const depthMm = piece.dimensionsMm.height;
  const thicknessMm = piece.thicknessMm;

  const eModulus = material?.elasticModulusMPa;

  return calculateShelfDeflection({
    spanMm,
    depthMm,
    thicknessMm,
    elasticModulusMPa: eModulus,
    designUniformLoadKgM2: config?.designUniformLoadKgM2,
    maxDeflectionRatio: config?.maxDeflectionRatio,
    maxAbsoluteDeflectionMm: config?.maxAbsoluteDeflectionMm,
  });
}

/**
 * Checks deflection for all shelves in a module piece list.
 * Returns a mapping of piece ID to deflection analysis result.
 */
export function checkModuleShelvesDeflection(
  pieces: ResolvedPieceWithCutSize[],
  materials: Material[],
  config?: DeflectionConfig,
): Map<string, ShelfDeflectionResult> {
  const results = new Map<string, ShelfDeflectionResult>();
  const matMap = new Map<string, Material>(materials.map((m) => [m.id, m]));

  for (const piece of pieces) {
    const mat = matMap.get(piece.materialId);
    const deflection = checkPieceDeflection(piece, mat, config);
    if (deflection) {
      results.set(piece.id, deflection);
    }
  }

  return results;
}
