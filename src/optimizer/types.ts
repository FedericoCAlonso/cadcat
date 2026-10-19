export type GrainMode = 'FREE' | 'FIXED' | 'AUTO';
export type SheetGrain = 'NONE' | 'ALONG_LENGTH';
export type MachineKind = 'PANEL_SAW' | 'CNC' | 'MANUAL_FREE';
export type Objective = 'MIN_MATERIAL' | 'MIN_COST' | 'MIN_CUTS' | 'BALANCED';

export interface EdgeBand {
  thicknessMm: number;
}

export interface PartEdgeBands {
  l1?: EdgeBand | null;
  l2?: EdgeBand | null;
  w1?: EdgeBand | null;
  w2?: EdgeBand | null;
}

export interface Part {
  id: string;
  label?: string;
  lengthMm: number;
  widthMm: number;
  quantity: number;
  materialKey: string;
  grain: GrainMode;
  visible?: boolean;
  edges?: PartEdgeBands;
  isFiller?: boolean;
  fillerMinCount?: number;
  group?: string;
}

export interface SheetType {
  materialKey: string;
  lengthMm: number;
  widthMm: number;
  grain: SheetGrain;
  pricePerSheet: number;
  available: number;
  isOffcut?: boolean;
}

export interface SettingsCost {
  pricePerCut: number;
  includedCuts: number;
  minimumCharge: number;
  pricePerMeterCut: number;
  offcutCreditPerM2: number;
  minOffcutMm: number;
}

export interface SettingsTrim {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface SettingsSearch {
  timeBudgetMs: number;
  maxIterations: number;
  seed: number;
}

export interface SettingsWeights {
  material: number;
  cuts: number;
  sheets: number;
}

export interface Settings {
  machine: MachineKind;
  objective: Objective;
  weights?: SettingsWeights;
  kerfMm: number;
  trimMm: SettingsTrim;
  trimCutsAreCharged: boolean;
  dimensionsAreFinished: boolean;
  maxStages: number;
  minStripMm: number;
  minPartMm: number;
  cost: SettingsCost;
  fillersMayAddSheet: boolean;
  search: SettingsSearch;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Warning {
  code: string;
  messageKey: string;
  partId?: string;
  details?: Record<string, unknown>;
}

export interface ErrorItem {
  code: string;
  messageKey: string;
  partId?: string;
  details?: Record<string, unknown>;
}

export interface CutOp {
  order: number;
  stage: number;
  dir: 'H' | 'V';
  pos: number;
  from: number;
  to: number;
  isTrim: boolean;
}

export interface PlacedPartInstance {
  partId: string;
  instance: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
  cutLengthMm?: number;
  cutWidthMm?: number;
  finishedLengthMm?: number;
  finishedWidthMm?: number;
  isFiller?: boolean;
  grainRelaxed?: boolean;
}

export interface SheetLayout {
  sheetTypeIndex: number;
  sheetWidthMm: number;
  sheetLengthMm: number;
  isOffcut?: boolean;
  placements: PlacedPartInstance[];
  cutSequence: CutOp[];
  offcuts?: Rect[];
  wasteAreaMm2?: number;
  usedAreaMm2?: number;
  passes?: number;
  cutLengthM?: number;
}

export interface LayoutMetricsCost {
  sheets: number;
  cuts: number;
  credit: number;
  total: number;
}

export interface LayoutMetrics {
  sheetsUsed: number;
  passes: number;
  cutLengthM: number;
  utilization: number;
  utilizationExLast: number;
  offcuts: Rect[];
  lowerBoundSheets: number;
  gapToBound: number;
  cost: LayoutMetricsCost;
  unplacedFillers: string[];
}

export interface Layout {
  sheets: SheetLayout[];
  metrics: LayoutMetrics;
  isReference?: boolean;
}

export interface ResultStats {
  elapsedMs: number;
  iterations: number;
  seed: number;
}

export interface Result {
  alternatives: Layout[];
  selectedIndex: number;
  warnings: Warning[];
  errors: ErrorItem[];
  stats: ResultStats;
}

export interface OptimizerInput {
  parts: Part[];
  sheets: SheetType[];
  settings: Settings;
}

export const DEFAULT_OPTIMIZER_SETTINGS: Settings = {
  machine: 'PANEL_SAW',
  objective: 'MIN_MATERIAL',
  kerfMm: 3.2,
  trimMm: { top: 10, bottom: 10, left: 10, right: 10 },
  trimCutsAreCharged: true,
  dimensionsAreFinished: true,
  maxStages: 0,
  minStripMm: 50,
  minPartMm: 50,
  cost: {
    pricePerCut: 0.5,
    includedCuts: 0,
    minimumCharge: 0,
    pricePerMeterCut: 1.5,
    offcutCreditPerM2: 0,
    minOffcutMm: 300,
  },
  fillersMayAddSheet: false,
  search: {
    timeBudgetMs: 2000,
    maxIterations: 500,
    seed: 123456789,
  },
};
