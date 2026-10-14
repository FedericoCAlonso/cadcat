/**
 * Types and definitions for the Modular Parametric Composition Engine.
 */

export type JointPriority = 'lateral-over-bottom' | 'bottom-over-lateral' | 'miter-45';
export type RoofType = 'solid-panel' | 'front-back-rails' | 'none';
export type BackingType = 'groove' | 'rebate' | 'overlay' | 'none';

export interface CarcassDefinition {
  width: number;
  height: number;
  depth: number;
  jointPriority: JointPriority;
  roofType: RoofType;
  railWidthMm?: number;              // Width of front/back stretchers (default: 80mm)
  railOrientation?: 'horizontal' | 'vertical'; // Stretcher orientation (default: horizontal)
  hasMiddleBrace?: boolean;          // Intermediate structural reinforcement stretcher
  middleBraceWidthMm?: number;       // Width of middle brace (default: 80mm)
  hasWallHangingRail?: boolean;      // Top-back wall mounting rail (faja de colgado)
  wallHangingRailWidthMm?: number;   // Width of wall hanging rail (default: 100mm)
  hasPlinth?: boolean;               // Bottom plinth / kickboard (zócalo)
  plinthHeightMm?: number;           // Height of plinth (default: 100mm)
  plinthSetbackMm?: number;          // Setback from front edge (default: 50mm)
  hasBacking?: boolean;              // Whether there is a back panel
  backingType?: BackingType;         // Default: 'groove'
  backingGrooveDistanceMm?: number;  // Distance from back edge to groove (default: 15mm)
  backingGrooveDepthMm?: number;     // Groove depth into carcase sides (default: 8mm)
  backingThicknessMm?: number;       // Thickness of back panel (default: 3mm)
}

export interface InteriorBounds {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
}

export type TrackSize =
  | { type: 'fixed'; valueMm: number }
  | { type: 'fractional'; valueFr: number };

export interface ResolvedTrack {
  index: number;
  sizeMm: number;
  offsetMm: number;
  rawFraction?: number;
}

export interface GridDivider {
  index: number;
  offsetMm: number;
  thicknessMm: number;
}

export interface BayGridDefinition {
  axis: 'horizontal' | 'vertical'; // 'horizontal' divides X (vertical partitions), 'vertical' divides Y (structural shelves)
  tracks: TrackSize[];
  dividerThicknessMm?: number;
}

export interface BayBoundingBox {
  bayIndex: number;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  depth: number;
  leftPieceId: string;
  rightPieceId: string;
  bottomPieceId: string;
  topPieceId: string;
}

export type DrawerSlideType = 'telescopic' | 'undermount' | 'metal-box' | 'roller';
export type DrawerFrontMount = 'applied' | 'inset';
export type DrawerType = 'standard' | 'simple-interior';
export type DrawerBottomMount = 'grooved' | 'bottom-screwed' | 'flush-thick';
export type DoorMountType = 'full-overlay' | 'half-overlay' | 'inset' | 'overlay';

export type BayContent =
  | { type: 'empty' }
  | {
      type: 'shelves';
      count: number;
      shelfType: 'adjustable' | 'fixed';
      setbackMm?: number;
      hasAntiSagBrace?: boolean;
    }
  | {
      type: 'drawer-stack';
      drawerTracks: TrackSize[];
      frontMount: DrawerFrontMount;
      hasTransomDividers?: boolean;
      slideType: DrawerSlideType;
      gapMm?: number;
      boxHeightRatio?: number;
      drawerType?: DrawerType;
      bottomMount?: DrawerBottomMount;
      topPullGapMm?: number;
      boxSideHeightOffsetMm?: number;
    }
  | {
      type: 'pull-out-tray';
      lipHeightMm?: number; // 0 = flat tray, >0 = perimeter retention lip
      slideType: 'telescopic' | 'undermount';
      clearanceDeductionMm?: number; // Default 25.4 for telescopic
      elevationYMm?: number; // Y position inside bay (default: centered or bottom + 20)
    }
  | {
      type: 'doors';
      count: 1 | 2;
      hingeSide?: 'left' | 'right';
      mountType: DoorMountType;
    }
  | {
      type: 'bi-fold-closure';
      leafTracks?: TrackSize[]; // Default: [ { type: 'fractional', valueFr: 1 }, { type: 'fractional', valueFr: 1 } ]
      hingeType: 'bifold-center' | 'piano' | 'aventos';
      openingDirection: 'vertical-lift' | 'horizontal-book';
    };

export type BayContentEmpty = Extract<BayContent, { type: 'empty' }>;
export type BayContentShelves = Extract<BayContent, { type: 'shelves' }>;
export type BayContentDrawerStack = Extract<BayContent, { type: 'drawer-stack' }>;
export type BayContentPullOutTray = Extract<BayContent, { type: 'pull-out-tray' }>;
export type BayContentDoors = Extract<BayContent, { type: 'doors' }>;
export type BayContentBiFoldClosure = Extract<BayContent, { type: 'bi-fold-closure' }>;

export interface PieceEdgeBandOverride {
  top?: boolean;
  bottom?: boolean;
  left?: boolean;
  right?: boolean;
  edgeBandId?: string;
}

export interface ModuleMaterialRoles {
  carcassMaterialId: string;
  frontsMaterialId: string;
  drawerBoxesMaterialId: string;
  backingsMaterialId: string;
  pieceOverrides?: Record<string, string>;
  pieceThicknessOverrides?: Record<string, number>;
  pieceEdgeBandOverrides?: Record<string, PieceEdgeBandOverride>;
}

export interface ModularModuleDefinition {
  id: string;
  carcass: CarcassDefinition;
  grid?: BayGridDefinition;
  bays: BayContent[]; // One per track in grid (or single bay if grid is omitted)
  materials: ModuleMaterialRoles;
  edgeBandId?: string;
}
