import { calculateShelfDeflection, type ShelfDeflectionResult } from '../deflection';
import type {
  BracketCalculationResult,
  LoadCategory,
  RecommendedAnchor,
  WallShelvingDefinition,
  WallType,
} from './types';

/**
 * Standard uniform loads by usage category in kg/m^2.
 */
export const LOAD_CATEGORY_KG_M2: Record<LoadCategory, number> = {
  light: 15.0, // Decoración, cuadros, plantas pequeñas
  medium: 30.0, // Ropa, vajilla estándar, despensa liviana
  heavy: 60.0, // Libros, enciclopedias, herramientas, vajilla pesada
};

/**
 * Standard bracket anchor recommendations based on wall type.
 */
export function getRecommendedAnchor(wallType: WallType): RecommendedAnchor {
  switch (wallType) {
    case 'solid-brick':
      return {
        anchorType: 'Nylon expansión 4 vías',
        brandModel: 'Fischer DuoPower 8x40',
        diameterMm: 8,
        lengthMm: 40,
        screwDiameterMm: 5.0,
        screwLengthMm: 50,
        notes: 'Apto para hormigón, ladrillo macizo y piedra. Alta capacidad de tracción.',
      };
    case 'hollow-brick':
      return {
        anchorType: 'Nylon con anudamiento interior',
        brandModel: 'Fischer DuoPower 8x65',
        diameterMm: 8,
        lengthMm: 65,
        screwDiameterMm: 5.0,
        screwLengthMm: 70,
        notes: 'Apto para ladrillo cerámico hueco. El taco forma un nudo detrás del tabique interno.',
      };
    case 'drywall':
      return {
        anchorType: 'Balancín metálico / Taco expansivo para huecos',
        brandModel: 'Fischer DuoHM 5x45 o Balancín 3/16"',
        diameterMm: 10,
        lengthMm: 50,
        screwDiameterMm: 5.0,
        screwLengthMm: 50,
        notes: 'Para placa de yeso (Durlock/Knauf). Se recomienda fijar directamente a montantes si la carga es pesada.',
      };
  }
}

/**
 * Solves bracket count, positions, deflection, and wall reaction forces for a wall shelving unit.
 */
export function solveBrackets(def: WallShelvingDefinition, elasticModulusMPa: number = 3000): BracketCalculationResult {
  const {
    widthMm,
    depthMm,
    thicknessMm,
    bracketType,
    wallType,
    loadCategory,
    overhangMode,
  } = def;

  const designLoadKgM2 = LOAD_CATEGORY_KG_M2[loadCategory] ?? 30.0;
  const areaM2 = (widthMm * depthMm) / 1_000_000;
  const shelfLoadKg = designLoadKgM2 * areaM2;

  // Shelf self-weight (assuming average board density ~ 750 kg/m^3)
  const selfWeightKg = (widthMm * depthMm * thicknessMm * 750) / 1_000_000_000;
  const totalShelfLoadKg = Math.round((shelfLoadKg + selfWeightKg) * 100) / 100;
  const totalShelfLoadN = totalShelfLoadKg * 9.80665;

  // Determine minimum bracket count starting from 2
  let bracketCount = 2;
  let bracketPositions: number[] = [];
  let maxSpan = widthMm;
  let cantilever = 0;
  let deflectionRes: ShelfDeflectionResult = {
    spanMm: widthMm,
    depthMm,
    thicknessMm,
    elasticModulusMPa,
    isElasticModulusConfirmed: true,
    totalLoadKg: totalShelfLoadKg,
    totalLoadN: totalShelfLoadN,
    inertiaMm4: (depthMm * Math.pow(thicknessMm, 3)) / 12,
    calculatedDeflectionMm: 0,
    allowableDeflectionMm: 3.0,
    deflectionRatio: 0,
    exceedsRatio: false,
    exceedsAbsolute: false,
    hasWarning: false,
  };

  const computePositionsForCount = (k: number): { positions: number[]; span: number; cant: number } => {
    if (k < 2) k = 2;

    if (overhangMode === 'flush-ends') {
      const edgeSetback = Math.min(50, Math.max(25, Math.round(widthMm * 0.05)));
      const span = (widthMm - 2 * edgeSetback) / (k - 1);
      const pos: number[] = [];
      for (let i = 0; i < k; i++) {
        pos.push(Math.round(edgeSetback + i * span));
      }
      return { positions: pos, span, cant: edgeSetback };
    }

    if (overhangMode === 'stud-aligned' && wallType === 'drywall') {
      const studInterval = 400; // Standard 400mm metal stud centers
      // Fit as many studs as possible centered within the width
      const maxStuds = Math.max(2, Math.floor((widthMm - 80) / studInterval) + 1);
      const actualCount = Math.max(k, maxStuds);
      const totalSpan = (actualCount - 1) * studInterval;
      const startX = Math.max(30, Math.round((widthMm - totalSpan) / 2));
      const pos: number[] = [];
      for (let i = 0; i < actualCount; i++) {
        pos.push(startX + i * studInterval);
      }
      return { positions: pos, span: studInterval, cant: startX };
    }

    // Default: 'balanced-cantilever' (mechanically balances positive and negative bending moments)
    // Optimal cantilever overhang is approximately L / (2 * k)
    const cant = Math.max(40, Math.min(250, Math.round(widthMm / (2 * k))));
    const innerSpan = (widthMm - 2 * cant) / (k - 1);
    const pos: number[] = [];
    for (let i = 0; i < k; i++) {
      pos.push(Math.round(cant + i * innerSpan));
    }
    return { positions: pos, span: innerSpan, cant };
  };

  // Find minimum bracket count so deflection is acceptable
  for (let k = 2; k <= 8; k++) {
    const layout = computePositionsForCount(k);
    bracketCount = layout.positions.length;
    bracketPositions = layout.positions;
    maxSpan = Math.round(layout.span);
    cantilever = layout.cant;

    deflectionRes = calculateShelfDeflection({
      spanMm: maxSpan,
      depthMm,
      thicknessMm,
      elasticModulusMPa,
      designUniformLoadKgM2: designLoadKgM2,
    });

    if (!deflectionRes.hasWarning) {
      break;
    }
  }

  // Calculate pull-out force (overturning moment / effective bracket vertical height)
  // Effective bracket leg / lever arm:
  let effectiveHeightMm = depthMm * 0.7; // Standard L-bracket ~70% of shelf depth
  if (bracketType === 'floating-pin') {
    effectiveHeightMm = 55; // Floating mounting plate vertical bolt spacing ~55mm
  } else if (bracketType === 'track-bracket') {
    effectiveHeightMm = depthMm * 0.85;
  }

  const loadPerBracketN = totalShelfLoadN / bracketCount;
  // Center of mass is at depth / 2 from wall
  const overturningMomentNmm = loadPerBracketN * (depthMm / 2);
  const pullOutForceN = Math.round((overturningMomentNmm / Math.max(30, effectiveHeightMm)) * 10) / 10;
  const pullOutForceKg = Math.round((pullOutForceN / 9.80665) * 10) / 10;

  // Warning checks
  let warning: string | undefined;
  if (bracketType === 'floating-pin' && thicknessMm < 22) {
    warning = `El espesor actual (${thicknessMm} mm) es insuficiente para perno flotante embutido. Se requiere un espesor mínimo de 25 mm o construir el estante engrosado/tamburato para alojar el perno de 10-12 mm sin astillar la placa.`;
  } else if (deflectionRes.hasWarning) {
    warning = `Aún con ${bracketCount} ménsulas, la flecha estimada (${deflectionRes.calculatedDeflectionMm} mm) supera el límite admisible (${deflectionRes.allowableDeflectionMm} mm). Aumentá el espesor de la placa a 25 mm o más.`;
  }

  return {
    bracketCountPerShelf: bracketCount,
    totalBrackets: bracketCount * def.shelfCount,
    bracketPositionsMm: bracketPositions,
    maxSpanMm: maxSpan,
    cantileverMm: cantilever,
    calculatedDeflectionMm: deflectionRes.calculatedDeflectionMm,
    allowableDeflectionMm: deflectionRes.allowableDeflectionMm,
    designLoadKgM2,
    totalShelfLoadKg,
    pullOutForceN,
    pullOutForceKg,
    recommendedAnchor: getRecommendedAnchor(wallType),
    warning,
  };
}
