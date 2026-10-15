import type {
  CountertopDefinition,
  CountertopMaterial,
  EquipmentItem,
  EquipmentKind,
  CountertopEquipmentPlacement,
} from '../../model';
import type { ResolvedPiece } from '../piece';

/**
 * Geometric bounds and safety verification of a countertop cutout.
 */
export interface CountertopCutoutResult {
  equipmentId: string;
  brandModel: string;
  kind: EquipmentKind;
  /** X, Y relative to front-left corner of countertop */
  boundsMm: {
    minXMm: number;
    maxXMm: number;
    minYMm: number; // Front is Y=0
    maxYMm: number; // Back is Y=depth
    widthMm: number;
    depthMm: number;
  };
  cornerRadiusMm: number;
  faucetHole?: {
    centerXMm: number;
    centerYMm: number;
    diameterMm: number;
  };
  remainingBridgesMm: {
    frontMm: number;
    backMm: number;
    leftMm: number;
    rightMm: number;
  };
  isSafeStoneBridge: boolean;
  warnings: string[];
}

/**
 * Warning and conflict detection for equipment crossing module partitions.
 */
export interface JointCrossingCheck {
  equipmentId: string;
  crossesJoint: boolean;
  crossedJointXMm?: number;
  warning?: string;
}

/**
 * Complete structural, geometric and BOM analysis of a countertop.
 */
export interface CountertopCalculationResult {
  definition: CountertopDefinition;
  material: CountertopMaterial;
  widthMm: number;
  depthMm: number;
  thicknessMm: number;
  areaM2: number;
  totalWeightKg: number;
  perimeterMeters: number;
  countertopPiece: ResolvedPiece;
  backsplashPieces: ResolvedPiece[];
  subtopPieces: ResolvedPiece[];
  cutouts: CountertopCutoutResult[];
  jointCrossings: JointCrossingCheck[];
  overhangAnalysis: {
    frontOverhangMm: number;
    leftOverhangMm: number;
    rightOverhangMm: number;
    maxAllowedWithoutBracketsMm: number;
    needsBrackets: boolean;
    warnings: string[];
  };
  unsupportedSpanAnalysis: {
    maxSpanMm: number;
    maxAllowedSpanMm: number;
    warnings: string[];
  };
}

/**
 * Result of adapting a cabinet's structural rails, drawers and shelves for sink/cooktop equipment.
 */
export interface SinkCabinetAdaptationResult {
  cabinetPieces: ResolvedPiece[];
  removedPieceIds: string[];
  appliedAdaptations: {
    frontRailOrientation: 'vertical' | 'horizontal' | 'suppressed';
    sinkDrawerAdaptation: 'false-front' | 'u-shape-drawer' | 'none';
    shelfCollisionsResolved: number;
    summary: string[];
  };
}
