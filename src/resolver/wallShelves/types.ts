import type { Module } from '../../model';
import type { PlacementTree } from '../tree';
import type {
  CustomDrillOperation,
  CustomGrooveOperation,
  CustomRebateOperation,
  CustomPocketOperation,
} from '../../model/operation';

export type BracketType = 'l-bracket' | 'floating-pin' | 'track-bracket';

export type WallType = 'solid-brick' | 'hollow-brick' | 'drywall';

export type LoadCategory = 'light' | 'medium' | 'heavy';

export type BoundaryCondition = 'free-ends' | 'between-walls';

export type OverhangMode = 'balanced-cantilever' | 'flush-ends' | 'stud-aligned';

export interface WallShelvingDefinition {
  id: string;
  widthMm: number;
  depthMm: number;
  thicknessMm: number;
  shelfCount: number;
  verticalSpacingMm: number;
  bracketType: BracketType;
  wallType: WallType;
  loadCategory: LoadCategory;
  boundaryCondition: BoundaryCondition;
  overhangMode: OverhangMode;
  materialId: string;
  edgeBandId?: string;
  baseElevationYMm?: number; // Distance from finished floor level (NPT) to lowest shelf
}

export interface RecommendedAnchor {
  anchorType: string;
  brandModel: string;
  diameterMm: number;
  lengthMm: number;
  screwDiameterMm: number;
  screwLengthMm: number;
  notes: string;
}

export interface BracketCalculationResult {
  bracketCountPerShelf: number;
  totalBrackets: number;
  bracketPositionsMm: number[]; // X coordinates along the shelf width
  maxSpanMm: number;
  cantileverMm: number;
  calculatedDeflectionMm: number;
  allowableDeflectionMm: number;
  designLoadKgM2: number;
  totalShelfLoadKg: number;
  pullOutForceN: number;
  pullOutForceKg: number;
  recommendedAnchor: RecommendedAnchor;
  warning?: string;
}

export interface WallShelvingHardwareItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  purpose: string;
}

export interface InstallationPoint {
  shelfIndex: number;
  bracketIndex: number;
  xMm: number; // X distance from left datum of wall/shelf
  yMm: number; // Y height from base reference / floor level
}

export interface WallShelvingOutput {
  module: Module;
  bracketCalculation: BracketCalculationResult;
  placementTree: PlacementTree;
  operations: (CustomDrillOperation | CustomGrooveOperation | CustomRebateOperation | CustomPocketOperation)[];
  hardwareBOM: WallShelvingHardwareItem[];
  installationPoints: InstallationPoint[];
}
