import type {
  CountertopDefinition,
  CountertopMaterial,
  EquipmentItem,
} from '../../model';
import {
  createPiece,
  createRectangularContour,
  type ResolvedPiece,
} from '../piece';
import type {
  CountertopCalculationResult,
  CountertopCutoutResult,
  JointCrossingCheck,
} from './types';

/**
 * Calculates structural loads, physical dimensions, cutout clearances and safety bridges for countertops.
 * Pure mathematical and physical resolver without UI dependencies (SOLID SRP).
 */
export function calculateCountertop(
  definition: CountertopDefinition,
  material: CountertopMaterial,
  equipmentList: EquipmentItem[],
  supportingCabinetWidthsMm?: number[],
): CountertopCalculationResult {
  const widthMm = definition.widthMm;
  const depthMm = definition.depthMm;
  const thicknessMm = material.thicknessMm;

  // 1. Physical Area and Weight Calculations
  const areaM2 = (widthMm * depthMm) / 1_000_000;
  const totalWeightKg = Math.round(areaM2 * material.densityKgM2 * 10) / 10;
  const perimeterMeters = (2 * (widthMm + depthMm)) / 1_000;

  // 2. Overhang Analysis (Cantilever beam safety)
  const frontOverhangMm = definition.frontOverhangMm;
  const leftOverhangMm = definition.leftOverhangMm;
  const rightOverhangMm = definition.rightOverhangMm;
  const maxAllowedWithoutBracketsMm = material.maxOverhangWithoutBracketsMm;

  const overhangWarnings: string[] = [];
  const maxCurrentOverhang = Math.max(frontOverhangMm, leftOverhangMm, rightOverhangMm);
  const needsBrackets = maxCurrentOverhang > maxAllowedWithoutBracketsMm;

  if (needsBrackets) {
    overhangWarnings.push(
      `El voladizo actual (${maxCurrentOverhang} mm) supera el límite sin refuerzo de ${material.name} (${maxAllowedWithoutBracketsMm} mm). Requiere ménsulas o estructura de soporte metálica para evitar fisuras o vuelco.`,
    );
  }

  // 3. Unsupported Span Analysis (e.g. gap for under-counter dishwasher)
  const spanWarnings: string[] = [];
  const maxSpanMm = 0; // Default when fully supported
  const maxAllowedSpanMm = material.maxUnsupportedSpanMm;

  // 4. Cutout Analysis & Stone Safety Bridges
  const cutouts: CountertopCutoutResult[] = [];
  const jointCrossings: JointCrossingCheck[] = [];

  // Compute cabinet seam boundaries if cabinet widths are provided
  const cabinetSeamsX: number[] = [];
  if (supportingCabinetWidthsMm && supportingCabinetWidthsMm.length > 1) {
    let currentX = leftOverhangMm;
    for (let i = 0; i < supportingCabinetWidthsMm.length - 1; i++) {
      currentX += supportingCabinetWidthsMm[i]!;
      cabinetSeamsX.push(currentX);
    }
  }

  for (const placement of definition.placements) {
    const equipment = equipmentList.find((e) => e.id === placement.equipmentId);
    if (!equipment) continue;

    const cutoutW = equipment.cutout.widthMm;
    const cutoutD = equipment.cutout.depthMm;
    const centerXMm = placement.centerXMm;

    const minXMm = Math.round(centerXMm - cutoutW / 2);
    const maxXMm = Math.round(centerXMm + cutoutW / 2);

    // Y position calculation:
    // If centerOffsetYMm is 0 or default, center the cutout while balancing front & back clearances
    let minYMm: number;
    let maxYMm: number;

    if (placement.centerOffsetYMm && placement.centerOffsetYMm !== 0) {
      const centerYM = depthMm / 2 + placement.centerOffsetYMm;
      minYMm = Math.round(centerYM - cutoutD / 2);
      maxYMm = Math.round(centerYM + cutoutD / 2);
    } else {
      // Balanced position ensuring minFrontClearance
      const availableY = depthMm - cutoutD;
      const frontTarget = Math.max(equipment.minClearancesMm.frontMm, Math.round(availableY * 0.42));
      minYMm = frontTarget;
      maxYMm = frontTarget + cutoutD;
    }

    const remainingFrontMm = minYMm;
    const remainingBackMm = depthMm - maxYMm;
    const remainingLeftMm = minXMm;
    const remainingRightMm = widthMm - maxXMm;

    const cutoutWarnings: string[] = [];

    // Safety checks against stone breaking
    if (remainingFrontMm < equipment.minClearancesMm.frontMm) {
      cutoutWarnings.push(
        `Puente frontal insuficiente (${remainingFrontMm} mm). Mínimo requerido para ${material.name}: ${equipment.minClearancesMm.frontMm} mm. Riesgo de rotura durante el calado.`,
      );
    }
    if (remainingBackMm < equipment.minClearancesMm.backMm) {
      cutoutWarnings.push(
        `Puente posterior insuficiente (${remainingBackMm} mm). Mínimo requerido para ${material.name}: ${equipment.minClearancesMm.backMm} mm.`,
      );
    }
    if (remainingLeftMm < equipment.minClearancesMm.leftMm) {
      cutoutWarnings.push(
        `Distancia al borde izquierdo insuficiente (${remainingLeftMm} mm < ${equipment.minClearancesMm.leftMm} mm).`,
      );
    }
    if (remainingRightMm < equipment.minClearancesMm.rightMm) {
      cutoutWarnings.push(
        `Distancia al borde derecho insuficiente (${remainingRightMm} mm < ${equipment.minClearancesMm.rightMm} mm).`,
      );
    }

    const isSafeStoneBridge = cutoutWarnings.length === 0;

    // Faucet hole computation (centered behind sink cutout)
    let faucetHole: CountertopCutoutResult['faucetHole'] | undefined;
    if (equipment.faucetHole?.required) {
      const faucetY = maxYMm + equipment.faucetHole.distanceBehindCutoutMm;
      faucetHole = {
        centerXMm,
        centerYMm: faucetY,
        diameterMm: equipment.faucetHole.diameterMm,
      };

      if (faucetY + equipment.faucetHole.diameterMm / 2 > depthMm - 15) {
        cutoutWarnings.push(
          `La perforación del monocomando queda demasiado cerca del zócalo/pared trasera (${depthMm - faucetY} mm).`,
        );
      }
    }

    cutouts.push({
      equipmentId: equipment.id,
      brandModel: equipment.brandModel,
      kind: equipment.kind,
      boundsMm: {
        minXMm,
        maxXMm,
        minYMm,
        maxYMm,
        widthMm: cutoutW,
        depthMm: cutoutD,
      },
      cornerRadiusMm: equipment.cutout.cornerRadiusMm,
      faucetHole,
      remainingBridgesMm: {
        frontMm: remainingFrontMm,
        backMm: remainingBackMm,
        leftMm: remainingLeftMm,
        rightMm: remainingRightMm,
      },
      isSafeStoneBridge,
      warnings: cutoutWarnings,
    });

    // Check if cutout crosses module joints
    for (const seamX of cabinetSeamsX) {
      // If seam is inside the cutout boundary plus 15mm margin
      if (seamX > minXMm + 15 && seamX < maxXMm - 15) {
        jointCrossings.push({
          equipmentId: equipment.id,
          crossesJoint: true,
          crossedJointXMm: seamX,
          warning: `La bacha/equipo cruza la unión entre módulos en X=${seamX} mm. Requiere rebajar los laterales contiguos de ambos muebles para alojar la cuba.`,
        });
      }
    }
  }

  // 5. Piece Generation (Countertop slab & Upstands)
  const countertopPiece: ResolvedPiece = {
    ...createPiece({
      id: `${definition.id}-slab`,
      role: 'countertop',
      materialId: material.id,
      contour: createRectangularContour(widthMm, depthMm),
      thicknessMm,
      structural: true,
    }),
    positionMm: { x: -leftOverhangMm, y: 0, z: 0 },
    dimensionsMm: { width: widthMm, height: depthMm },
  };

  const backsplashPieces: ResolvedPiece[] = [];

  // Rear Backsplash / Zocalín
  if (definition.backsplash.hasSplash) {
    const splashH = definition.backsplash.heightMm;
    const splashThick = definition.backsplash.thicknessMm;
    backsplashPieces.push({
      ...createPiece({
        id: `${definition.id}-splash-back`,
        role: 'countertop-backsplash',
        materialId: material.id,
        contour: createRectangularContour(widthMm, splashH),
        thicknessMm: splashThick,
        structural: false,
      }),
      positionMm: { x: -leftOverhangMm, y: depthMm, z: 0 },
      dimensionsMm: { width: widthMm, height: splashH },
    });
  }

  // Left Side Splash
  if (definition.leftSplash.hasSplash) {
    const splashH = definition.leftSplash.heightMm;
    const splashThick = definition.leftSplash.thicknessMm;
    const splashLength = depthMm - (definition.backsplash.hasSplash ? definition.backsplash.thicknessMm : 0);
    backsplashPieces.push({
      ...createPiece({
        id: `${definition.id}-splash-left`,
        role: 'countertop-splash-left',
        materialId: material.id,
        contour: createRectangularContour(splashLength, splashH),
        thicknessMm: splashThick,
        structural: false,
      }),
      positionMm: { x: -leftOverhangMm, y: 0, z: 0 },
      dimensionsMm: { width: splashLength, height: splashH },
    });
  }

  // Right Side Splash
  if (definition.rightSplash.hasSplash) {
    const splashH = definition.rightSplash.heightMm;
    const splashThick = definition.rightSplash.thicknessMm;
    const splashLength = depthMm - (definition.backsplash.hasSplash ? definition.backsplash.thicknessMm : 0);
    backsplashPieces.push({
      ...createPiece({
        id: `${definition.id}-splash-right`,
        role: 'countertop-splash-right',
        materialId: material.id,
        contour: createRectangularContour(splashLength, splashH),
        thicknessMm: splashThick,
        structural: false,
      }),
      positionMm: { x: widthMm - leftOverhangMm - splashThick, y: 0, z: 0 },
      dimensionsMm: { width: splashLength, height: splashH },
    });
  }

  // 6. Subtop pieces if required by material (e.g. Dekton 12mm)
  const subtopPieces: ResolvedPiece[] = [];
  if (material.requiresSubtop) {
    const subtopThick = 18; // 18mm plywood / water-resistant MDF
    subtopPieces.push({
      ...createPiece({
        id: `${definition.id}-subtop-board`,
        role: 'countertop-subtop',
        materialId: 'mat-subtop-plywood-18',
        contour: createRectangularContour(widthMm, depthMm),
        thicknessMm: subtopThick,
        structural: true,
      }),
      positionMm: { x: -leftOverhangMm, y: 0, z: -subtopThick },
      dimensionsMm: { width: widthMm, height: depthMm },
    });
  }

  return {
    definition,
    material,
    widthMm,
    depthMm,
    thicknessMm,
    areaM2,
    totalWeightKg,
    perimeterMeters,
    countertopPiece,
    backsplashPieces,
    subtopPieces,
    cutouts,
    jointCrossings,
    overhangAnalysis: {
      frontOverhangMm,
      leftOverhangMm,
      rightOverhangMm,
      maxAllowedWithoutBracketsMm,
      needsBrackets,
      warnings: overhangWarnings,
    },
    unsupportedSpanAnalysis: {
      maxSpanMm,
      maxAllowedSpanMm,
      warnings: spanWarnings,
    },
  };
}
