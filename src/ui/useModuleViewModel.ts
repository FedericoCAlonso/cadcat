import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  type Material,
  type EdgeBand,
  type Hardware,
  type Module,
  type DrillOperation,
  type PieceMachining,
  type ProjectConfig,
  type JointStrategy,
  type UserTemplate,
  type JointKind,
  type CustomPieceOperation,
  DEFAULT_COUNTERTOP_MATERIALS,
  DEFAULT_EQUIPMENT_ITEMS,
  DEFAULT_COUNTERTOP_CONFIG,
  type CountertopDefinition,
  type CountertopMaterial,
  type CountertopEdgeFinish,
  type EquipmentItem,
} from '../model';
import {
  loadMaterialsFromDb,
  loadEdgeBandsFromDb,
  loadHardwareFromDb,
  saveMaterialToDb,
  deleteMaterialFromDb,
  saveEdgeBandToDb,
  deleteEdgeBandFromDb,
  saveHardwareToDb,
  deleteHardwareFromDb,
  resetCatalogsToSeed,
  loadUserTemplatesFromDb,
  saveUserTemplateToDb,
  deleteUserTemplateFromDb,
  saveItem,
  loadItem,
  loadProjectConfigFromDb,
  saveProjectConfigToDb,
  getDefaultProjectConfig,
  exportProjectConfigJson,
  importProjectConfigJson,
  DEFAULT_PROJECT_ID,
} from '../storage';
import { DEFAULT_UI_CONFIG } from '../config';
import { getSeedMaterials, getSeedEdgeBands, getSeedHardware } from '../catalog';
import {
  generateBillOfMaterials,
  calculateModuleCost,
  PlacementTree,
  JointGraph,
  exportCutListCsv,
  exportCutPlanPdf,
  exportMachiningSheetToDxf,
  triggerBrowserDownload,
  type ResolvedPieceWithCutSize,
  type BillOfMaterials,
  type ModuleCostSummary,
  type TemplateDefinition,
  BASE_EMPTY_TEMPLATE,
  WALL_SHELVING_TEMPLATE,
  createUserTemplateDefinition,
  getTemplateById,
  resolveModuleSpatialBoxes,
  type SpatialPieceBox,
  type ModuleSpatialBounds,
  deriveModuleDrillOperations,
  groupOperationsByPiece,
  buildModuleMachiningSheets,
  exportMachiningSheetPdf,
  type PieceMachiningSheet,
  checkModuleShelvesDeflection,
  type ShelfDeflectionResult,
  generateAssemblySheet,
  exportAssemblyGuidePdf,
  type AssemblySheet,
  type JointPriority,
  type RoofType,
  type BackingType,
  type RearStructuralRails,
  type BayContent,
  type DrawerSlideType,
  type DrawerFrontMount,
  type DrawerType,
  type DrawerBottomMount,
  type DoorMountType,
  type BayGridDefinition,
  type TrackSize,
  type ModularModuleDefinition,
  type PieceEdgeBandOverride,
  type KinematicMechanism,
  type KinematicPieceBox,
  identifyKinematicMechanisms,
  calculateKinematicBoxes,
  type BracketType,
  type WallType,
  type LoadCategory,
  type BoundaryCondition,
  type OverhangMode,
  type WallShelvingDefinition,
  type WallShelvingOutput,
  buildWallShelving,
  exportWallShelvesInstallationPdf,
  calculatePieceCutSize,
  createRectangularContour,
  buildModularModule,
  type CountertopCalculationResult,
  calculateCountertop,
  adaptCabinetForEquipment,
  exportMarmoleriaPdf,
} from '../resolver';
import { runMultiMaterialGuillotineNesting } from '../workers';

export interface ModuleViewModelState {
  width: number;
  height: number;
  depth: number;
  selectedTemplateId: string;
  templates: TemplateDefinition[];
  selectedMaterialId: string;
  selectedEdgeBandId: string;
  materials: Material[];
  edgeBands: EdgeBand[];
  hardware: Hardware[];
  isLoading: boolean;
  isSaving: boolean;
  statusMessage: string | null;
  error: string | null;
  currentModule: Module | null;
  resolvedPieces: ResolvedPieceWithCutSize[];
  bom: BillOfMaterials | null;
  cost: ModuleCostSummary | null;
  activeTab: 'form' | 'pieces' | '3d' | 'machining' | 'settings' | 'assembly' | 'catalogs' | 'countertop';
  selectedPieceId: string | null;
  explodedRatio: number;
  spatialBoxes: SpatialPieceBox[];
  spatialBounds: ModuleSpatialBounds;
  machiningOperations: DrillOperation[];
  pieceMachiningList: PieceMachining[];
  machiningSheets: PieceMachiningSheet[];
  selectedMachiningPieceId: string | null;
  assemblySheet: AssemblySheet | null;
  shelfDeflections: Map<string, ShelfDeflectionResult>;
  shelfDeflectionWarnings: ShelfDeflectionResult[];
  projectConfig: ProjectConfig | null;
  // Modular builder state
  isCustomModular: boolean;
  roofType: RoofType;
  jointPriority: JointPriority;
  hasBacking: boolean;
  gridType: '1-bay' | '2-bays-vertical' | '3-bays-vertical' | '2-bays-horizontal';
  bays: BayContent[];
  activeBayIndex: number;
  frontsMaterialId: string;
  drawerBoxesMaterialId: string;
  backingsMaterialId: string;
  jointStrategy: JointStrategy;
  setWidth: (width: number) => void;
  setHeight: (height: number) => void;
  setDepth: (depth: number) => void;
  setSelectedTemplateId: (id: string) => void;
  setSelectedMaterialId: (id: string) => void;
  setSelectedEdgeBandId: (id: string) => void;
  setActiveTab: (tab: 'form' | 'pieces' | '3d' | 'machining' | 'settings' | 'assembly' | 'catalogs' | 'countertop') => void;
  setSelectedPieceId: (id: string | null) => void;
  setSelectedMachiningPieceId: (id: string | null) => void;
  setExplodedRatio: (ratio: number) => void;
  setRoofType: (roof: RoofType) => void;
  setJointPriority: (priority: JointPriority) => void;
  setHasBacking: (hasBacking: boolean) => void;
  setGridType: (gridType: '1-bay' | '2-bays-vertical' | '3-bays-vertical' | '2-bays-horizontal') => void;
  setActiveBayIndex: (idx: number) => void;
  setBayContentType: (bayIndex: number, type: 'empty' | 'shelves' | 'drawer-stack' | 'doors' | 'pull-out-tray' | 'bi-fold-closure') => void;
  addShelf: (bayIndex: number) => void;
  removeShelf: (bayIndex: number) => void;
  setShelfType: (bayIndex: number, type: 'adjustable' | 'fixed') => void;
  setShelfAntiSag: (bayIndex: number, hasAntiSag: boolean) => void;
  addDrawer: (bayIndex: number) => void;
  removeDrawer: (bayIndex: number) => void;
  setDrawerFrontMount: (bayIndex: number, mount: DrawerFrontMount) => void;
  setDrawerSlideType: (bayIndex: number, slide: DrawerSlideType) => void;
  setDrawerDistributionPreset: (bayIndex: number, preset: 'equal' | 'cutlery-top' | 'custom', topHeightMm?: number) => void;
  setDrawerTopHeight: (bayIndex: number, heightMm: number) => void;
  setDrawerTrack: (bayIndex: number, trackIndex: number, track: TrackSize) => void;
  setDrawerTracks: (bayIndex: number, tracks: TrackSize[]) => void;
  setDrawerGap: (bayIndex: number, gapMm: number) => void;
  setDrawerTransoms: (bayIndex: number, hasTransoms: boolean) => void;
  setDrawerType: (bayIndex: number, drawerType: DrawerType) => void;
  setDrawerBottomMount: (bayIndex: number, mount: DrawerBottomMount) => void;
  setDrawerTopPullGap: (bayIndex: number, gapMm: number) => void;
  setDrawerBoxSideHeightOffset: (bayIndex: number, offsetMm: number) => void;
  setDoorCount: (bayIndex: number, count: 1 | 2) => void;
  setDoorMountType: (bayIndex: number, mount: DoorMountType) => void;
  setDoorInteriorShelvesCount: (bayIndex: number, count: number) => void;
  setDoorShelfType: (bayIndex: number, type: 'adjustable' | 'fixed') => void;
  setBifoldDirection: (bayIndex: number, dir: 'vertical-lift' | 'horizontal-book') => void;
  // Backing, island cabinet, and structural rails
  backingType: BackingType;
  backingThicknessMm: number;
  isIslandCabinet: boolean;
  rearStructuralRails: RearStructuralRails;
  rearStructuralRailsWidthMm: number;
  setBackingType: (type: BackingType) => void;
  setBackingThicknessMm: (thickness: number) => void;
  setIsIslandCabinet: (val: boolean) => void;
  setRearStructuralRails: (val: RearStructuralRails) => void;
  setRearStructuralRailsWidthMm: (val: number) => void;
  setFrontsMaterialId: (id: string) => void;
  setDrawerBoxesMaterialId: (id: string) => void;
  setBackingsMaterialId: (id: string) => void;
  setJointStrategy: (strategy: JointStrategy) => void;
  saveModule: () => Promise<void>;
  loadModule: (id: string) => Promise<void>;
  exportCsv: () => void;
  exportPdf: () => void;
  exportMachiningPdf: (pieceId?: string) => void;
  exportMachiningDxf: (pieceId?: string) => void;
  exportAssemblyPdf: () => void;
  updateProjectConfig: (config: ProjectConfig) => void;
  saveProjectConfig: () => Promise<void>;
  importProjectConfigFile: (file: File) => Promise<void>;
  exportProjectConfigFile: () => void;
  resetProjectConfigToDefaults: () => Promise<void>;
  // User templates
  userTemplates: UserTemplate[];
  saveCurrentUserTemplate: (name: string, description?: string) => Promise<void>;
  deleteUserTemplate: (id: string) => Promise<void>;
  // Catalog database CRUD
  saveMaterial: (material: Material) => Promise<void>;
  deleteMaterial: (id: string) => Promise<void>;
  saveEdgeBand: (edgeBand: EdgeBand) => Promise<void>;
  deleteEdgeBand: (id: string) => Promise<void>;
  saveHardware: (hardware: Hardware) => Promise<void>;
  deleteHardware: (id: string) => Promise<void>;
  resetCatalogs: () => Promise<void>;
  // Piece-level joint overrides (Point 9)
  pieceJointOverrides: Record<string, JointKind>;
  setPieceJointOverride: (pieceId: string, jointKind: JointKind | null) => void;
  // Base structure settings (Point 7)
  railOrientation: 'horizontal' | 'vertical';
  hasMiddleBrace: boolean;
  middleBraceWidthMm: number;
  hasWallHangingRail: boolean;
  wallHangingRailWidthMm: number;
  hasPlinth: boolean;
  plinthHeightMm: number;
  plinthSetbackMm: number;
  setRailOrientation: (val: 'horizontal' | 'vertical') => void;
  setHasMiddleBrace: (val: boolean) => void;
  setMiddleBraceWidthMm: (val: number) => void;
  setHasWallHangingRail: (val: boolean) => void;
  setWallHangingRailWidthMm: (val: number) => void;
  setHasPlinth: (val: boolean) => void;
  setPlinthHeightMm: (val: number) => void;
  setPlinthSetbackMm: (val: number) => void;
  // Piece-level overrides (Point 10)
  pieceMaterialOverrides: Record<string, string>;
  pieceThicknessOverrides: Record<string, number>;
  pieceEdgeBandOverrides: Record<string, PieceEdgeBandOverride>;
  setPieceMaterial: (pieceId: string, materialId: string | null) => void;
  setPieceThickness: (pieceId: string, thicknessMm: number | null) => void;
  setPieceEdgeBands: (pieceId: string, override: PieceEdgeBandOverride | null) => void;
  // Custom machining operations (Point 8)
  customPieceOperations: Record<string, CustomPieceOperation[]>;
  addCustomPieceOperation: (pieceId: string, op: CustomPieceOperation) => void;
  removeCustomPieceOperation: (pieceId: string, opId: string) => void;
  // Kinematics (Point 11)
  kinematicsState: Record<string, number>;
  kinematicMechanisms: KinematicMechanism[];
  kinematicBoxes: KinematicPieceBox[];
  setMechanismOpenRatio: (mechanismId: string | null, ratio: number) => void;
  // Wall Shelving state
  wallShelvesBracketType: BracketType;
  wallShelvesWallType: WallType;
  wallShelvesLoadCategory: LoadCategory;
  wallShelvesBoundaryCondition: BoundaryCondition;
  wallShelvesOverhangMode: OverhangMode;
  wallShelvesShelfCount: number;
  wallShelvesVerticalSpacingMm: number;
  wallShelvesBaseElevationYMm: number;
  wallShelvingDefinition: WallShelvingDefinition | null;
  wallShelvingOutput: WallShelvingOutput | null;
  setWallShelvesBracketType: (type: BracketType) => void;
  setWallShelvesWallType: (type: WallType) => void;
  setWallShelvesLoadCategory: (cat: LoadCategory) => void;
  setWallShelvesBoundaryCondition: (cond: BoundaryCondition) => void;
  setWallShelvesOverhangMode: (mode: OverhangMode) => void;
  setWallShelvesShelfCount: (count: number) => void;
  setWallShelvesVerticalSpacingMm: (spacing: number) => void;
  setWallShelvesBaseElevationYMm: (elev: number) => void;
  // Countertop & Built-in Equipment (Phase 3)
  countertopEnabled: boolean;
  countertopMaterialId: string;
  countertopMaterials: CountertopMaterial[];
  equipmentCatalog: EquipmentItem[];
  selectedEquipmentId: string;
  countertopFrontOverhangMm: number;
  countertopEdgeFinish: CountertopEdgeFinish;
  countertopHasBacksplash: boolean;
  countertopBacksplashHeightMm: number;
  sinkDrawerAdaptation: 'false-front' | 'u-shape-drawer' | 'none';
  countertopFrontRailOrientation: 'vertical' | 'horizontal' | 'suppressed';
  countertopDefinition: CountertopDefinition;
  countertopCalculation: CountertopCalculationResult | null;
  setCountertopEnabled: (enabled: boolean) => void;
  setCountertopMaterialId: (id: string) => void;
  setSelectedEquipmentId: (id: string) => void;
  setCountertopFrontOverhangMm: (val: number) => void;
  setCountertopEdgeFinish: (finish: CountertopEdgeFinish) => void;
  setCountertopHasBacksplash: (has: boolean) => void;
  setCountertopBacksplashHeightMm: (h: number) => void;
  setSinkDrawerAdaptation: (mode: 'false-front' | 'u-shape-drawer' | 'none') => void;
  setCountertopFrontRailOrientation: (orientation: 'vertical' | 'horizontal' | 'suppressed') => void;
  exportMarmoleriaPdfReport: () => void;
}

/**
 * ViewModel hook for Module editing and piece resolution (MVVM Pattern).
 * Fetches sheet, edge band, and hardware data directly from IndexedDB.
 */
export function useModuleViewModel(initialDb?: IDBDatabase): ModuleViewModelState {
  const [width, setWidth] = useState<number>(DEFAULT_UI_CONFIG.dimensions.width.default);
  const [height, setHeight] = useState<number>(DEFAULT_UI_CONFIG.dimensions.height.default);
  const [depth, setDepth] = useState<number>(DEFAULT_UI_CONFIG.dimensions.depth.default);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('modular-empty');
  const [userTemplates, setUserTemplates] = useState<UserTemplate[]>([]);
  const [pieceJointOverrides, setPieceJointOverrides] = useState<Record<string, JointKind>>({});
  const [materials, setMaterials] = useState<Material[]>(() => {
    try {
      return getSeedMaterials().materials;
    } catch {
      return [];
    }
  });
  const [edgeBands, setEdgeBands] = useState<EdgeBand[]>(() => {
    try {
      return getSeedEdgeBands().edgeBands;
    } catch {
      return [];
    }
  });
  const [hardware, setHardware] = useState<Hardware[]>(() => {
    try {
      return getSeedHardware().hardware;
    } catch {
      return [];
    }
  });
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>(() => {
    try {
      return getSeedMaterials().materials[0]?.id ?? '';
    } catch {
      return '';
    }
  });
  const [selectedEdgeBandId, setSelectedEdgeBandId] = useState<string>(() => {
    try {
      return getSeedEdgeBands().edgeBands[0]?.id ?? '';
    } catch {
      return '';
    }
  });
  const [activeTab, setActiveTab] = useState<ModuleViewModelState['activeTab']>('3d');
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [selectedMachiningPieceId, setSelectedMachiningPieceId] = useState<string | null>(null);
  const [projectConfig, setProjectConfig] = useState<ProjectConfig | null>(null);
  const [explodedRatio, setExplodedRatio] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modular Builder Interactive State (default: Estructura Hueco Libre)
  const [isCustomModular, setIsCustomModular] = useState<boolean>(false);
  const [roofType, setRoofTypeState] = useState<RoofType>(
    DEFAULT_UI_CONFIG.defaultCarcassSettings.roofType as RoofType,
  );
  const [jointPriority, setJointPriorityState] = useState<JointPriority>(
    DEFAULT_UI_CONFIG.defaultCarcassSettings.jointPriority as JointPriority,
  );
  const [hasBacking, setHasBackingState] = useState<boolean>(
    DEFAULT_UI_CONFIG.defaultCarcassSettings.hasBacking,
  );
  const [gridType, setGridTypeState] = useState<'1-bay' | '2-bays-vertical' | '3-bays-vertical' | '2-bays-horizontal'>('1-bay');
  const [bays, setBaysState] = useState<BayContent[]>([
    { type: 'empty' },
  ]);
  const [activeBayIndex, setActiveBayIndex] = useState<number>(0);
  const [frontsMaterialId, setFrontsMaterialId] = useState<string>('');
  const [drawerBoxesMaterialId, setDrawerBoxesMaterialId] = useState<string>('');
  const [backingsMaterialId, setBackingsMaterialId] = useState<string>('');

  // Base structure state (Point 7)
  const [railOrientation, setRailOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [hasMiddleBrace, setHasMiddleBrace] = useState<boolean>(false);
  const [middleBraceWidthMm, setMiddleBraceWidthMm] = useState<number>(80);
  const [hasWallHangingRail, setHasWallHangingRail] = useState<boolean>(false);
  const [wallHangingRailWidthMm, setWallHangingRailWidthMm] = useState<number>(100);
  const [hasPlinth, setHasPlinth] = useState<boolean>(false);
  const [plinthHeightMm, setPlinthHeightMm] = useState<number>(100);
  const [plinthSetbackMm, setPlinthSetbackMm] = useState<number>(50);

  // Backing, Island, and Structural Rails (Points 4, 5, 6)
  const [backingType, setBackingTypeState] = useState<BackingType>('groove');
  const [backingThicknessMm, setBackingThicknessMmState] = useState<number>(3);
  const [isIslandCabinet, setIsIslandCabinetState] = useState<boolean>(false);
  const [rearStructuralRails, setRearStructuralRailsState] = useState<RearStructuralRails>('none');
  const [rearStructuralRailsWidthMm, setRearStructuralRailsWidthMmState] = useState<number>(80);

  // Piece-level overrides (Point 10)
  const [pieceMaterialOverrides, setPieceMaterialOverrides] = useState<Record<string, string>>({});
  const [pieceThicknessOverrides, setPieceThicknessOverrides] = useState<Record<string, number>>({});
  const [pieceEdgeBandOverrides, setPieceEdgeBandOverrides] = useState<Record<string, PieceEdgeBandOverride>>({});

  // Custom piece machining operations (Point 8)
  const [customPieceOperations, setCustomPieceOperations] = useState<Record<string, CustomPieceOperation[]>>({});

  // Interactive Kinematics state (Point 11)
  const [kinematicsState, setKinematicsState] = useState<Record<string, number>>({});

  // Wall Shelves state
  const [wallShelvesBracketType, setWallShelvesBracketType] = useState<BracketType>('l-bracket');
  const [wallShelvesWallType, setWallShelvesWallType] = useState<WallType>('solid-brick');
  const [wallShelvesLoadCategory, setWallShelvesLoadCategory] = useState<LoadCategory>('medium');
  const [wallShelvesBoundaryCondition, setWallShelvesBoundaryCondition] = useState<BoundaryCondition>('free-ends');
  const [wallShelvesOverhangMode, setWallShelvesOverhangMode] = useState<OverhangMode>('balanced-cantilever');
  const [wallShelvesShelfCount, setWallShelvesShelfCountState] = useState<number>(3);
  const [wallShelvesVerticalSpacingMm, setWallShelvesVerticalSpacingMmState] = useState<number>(320);
  const [wallShelvesBaseElevationYMm, setWallShelvesBaseElevationYMm] = useState<number>(800);

  const setWallShelvesShelfCount = useCallback((count: number) => {
    const validCount = Math.max(1, Math.min(8, Math.round(count)));
    setWallShelvesShelfCountState(validCount);
    setHeight((validCount - 1) * wallShelvesVerticalSpacingMm + 18);
  }, [wallShelvesVerticalSpacingMm, setHeight]);

  const setWallShelvesVerticalSpacingMm = useCallback((spacing: number) => {
    const validSpacing = Math.max(150, Math.min(800, Math.round(spacing)));
    setWallShelvesVerticalSpacingMmState(validSpacing);
    setHeight((wallShelvesShelfCount - 1) * validSpacing + 18);
  }, [wallShelvesShelfCount, setHeight]);

  // Countertop & Built-in Equipment state (Phase 3)
  const [countertopEnabled, setCountertopEnabled] = useState<boolean>(false);
  const [countertopMaterialId, setCountertopMaterialId] = useState<string>(DEFAULT_COUNTERTOP_CONFIG.materialId);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('none');
  const [countertopFrontOverhangMm, setCountertopFrontOverhangMm] = useState<number>(DEFAULT_COUNTERTOP_CONFIG.frontOverhangMm);
  const [countertopEdgeFinish, setCountertopEdgeFinish] = useState<CountertopEdgeFinish>(DEFAULT_COUNTERTOP_CONFIG.edgeFinish);
  const [countertopHasBacksplash, setCountertopHasBacksplash] = useState<boolean>(DEFAULT_COUNTERTOP_CONFIG.hasBacksplash);
  const [countertopBacksplashHeightMm, setCountertopBacksplashHeightMm] = useState<number>(DEFAULT_COUNTERTOP_CONFIG.backsplashHeightMm);
  const [sinkDrawerAdaptation, setSinkDrawerAdaptation] = useState<'false-front' | 'u-shape-drawer' | 'none'>(DEFAULT_COUNTERTOP_CONFIG.sinkDrawerAdaptation);
  const [countertopFrontRailOrientation, setCountertopFrontRailOrientation] = useState<'vertical' | 'horizontal' | 'suppressed'>(DEFAULT_COUNTERTOP_CONFIG.frontRailOrientation);

  // Templates list exposed to UI: single base empty carcass + wall shelves + user templates
  const templates = useMemo<TemplateDefinition[]>(() => {
    return [
      BASE_EMPTY_TEMPLATE,
      WALL_SHELVING_TEMPLATE,
      ...userTemplates.map(createUserTemplateDefinition),
    ];
  }, [userTemplates]);

  // Handle template selection and sync builder options with preset or user template
  const handleSelectTemplate = useCallback((id: string) => {
    setSelectedTemplateId(id);
    setIsCustomModular(false);
    setActiveBayIndex(0);

    if (id === 'wall-shelves') {
      setWidth(1200);
      setHeight(960);
      setDepth(250);
      setRoofTypeState('none');
      setJointPriorityState('lateral-over-bottom');
      setHasBackingState(false);
      setRailOrientation('horizontal');
      setHasMiddleBrace(false);
      setHasWallHangingRail(false);
      setHasPlinth(false);
      setGridTypeState('1-bay');
      setBaysState([{ type: 'empty' }]);
      setPieceJointOverrides({});
      setPieceMaterialOverrides({});
      setPieceThicknessOverrides({});
      setPieceEdgeBandOverrides({});
      setCustomPieceOperations({});
      setKinematicsState({});
    } else if (id === 'base-cabinet' || id === 'modular-empty') {
      setRoofTypeState('front-back-rails');
      setJointPriorityState('lateral-over-bottom');
      setHasBackingState(true);
      setRailOrientation('horizontal');
      setHasMiddleBrace(false);
      setHasWallHangingRail(false);
      setHasPlinth(false);
      setGridTypeState('1-bay');
      setBaysState([{ type: 'empty' }]);
      setPieceJointOverrides({});
      setPieceMaterialOverrides({});
      setPieceThicknessOverrides({});
      setPieceEdgeBandOverrides({});
      setCustomPieceOperations({});
      setKinematicsState({});
    } else {
      const userTpl = userTemplates.find((t) => t.id === id);
      if (userTpl) {
        setWidth(userTpl.dimensions.width);
        setHeight(userTpl.dimensions.height);
        setDepth(userTpl.dimensions.depth);
        setRoofTypeState(userTpl.carcassSettings.roofType);
        setJointPriorityState(userTpl.carcassSettings.jointPriority);
        setHasBackingState(userTpl.carcassSettings.hasBacking);
        if (userTpl.carcassSettings.railOrientation) setRailOrientation(userTpl.carcassSettings.railOrientation);
        if (userTpl.carcassSettings.hasMiddleBrace !== undefined) setHasMiddleBrace(userTpl.carcassSettings.hasMiddleBrace);
        if (userTpl.carcassSettings.middleBraceWidthMm) setMiddleBraceWidthMm(userTpl.carcassSettings.middleBraceWidthMm);
        if (userTpl.carcassSettings.hasWallHangingRail !== undefined) setHasWallHangingRail(userTpl.carcassSettings.hasWallHangingRail);
        if (userTpl.carcassSettings.wallHangingRailWidthMm) setWallHangingRailWidthMm(userTpl.carcassSettings.wallHangingRailWidthMm);
        if (userTpl.carcassSettings.hasPlinth !== undefined) setHasPlinth(userTpl.carcassSettings.hasPlinth);
        if (userTpl.carcassSettings.plinthHeightMm) setPlinthHeightMm(userTpl.carcassSettings.plinthHeightMm);
        if (userTpl.carcassSettings.plinthSetbackMm) setPlinthSetbackMm(userTpl.carcassSettings.plinthSetbackMm);
        if (userTpl.carcassSettings.backingType) setBackingTypeState(userTpl.carcassSettings.backingType);
        if (userTpl.carcassSettings.backingThicknessMm) setBackingThicknessMmState(userTpl.carcassSettings.backingThicknessMm);
        if (userTpl.carcassSettings.isIslandCabinet !== undefined) setIsIslandCabinetState(userTpl.carcassSettings.isIslandCabinet);
        if (userTpl.carcassSettings.rearStructuralRails) setRearStructuralRailsState(userTpl.carcassSettings.rearStructuralRails);
        if (userTpl.carcassSettings.rearStructuralRailsWidthMm) setRearStructuralRailsWidthMmState(userTpl.carcassSettings.rearStructuralRailsWidthMm);
        setGridTypeState(userTpl.gridType);
        setBaysState(userTpl.bays);
        if (userTpl.materials?.carcassMaterialId) setSelectedMaterialId(userTpl.materials.carcassMaterialId);
        if (userTpl.materials?.frontsMaterialId) setFrontsMaterialId(userTpl.materials.frontsMaterialId);
        if (userTpl.materials?.drawerBoxesMaterialId) setDrawerBoxesMaterialId(userTpl.materials.drawerBoxesMaterialId);
        if (userTpl.materials?.backingsMaterialId) setBackingsMaterialId(userTpl.materials.backingsMaterialId);
        if (userTpl.materials?.edgeBandId) setSelectedEdgeBandId(userTpl.materials.edgeBandId);
        if (userTpl.jointOverrides) setPieceJointOverrides(userTpl.jointOverrides);
        else setPieceJointOverrides({});
      }
    }
  }, [userTemplates]);

  // Builder setters that activate custom modular mode
  const setRoofType = useCallback((roof: RoofType) => {
    setRoofTypeState(roof);
    setIsCustomModular(true);
  }, []);

  const setJointPriority = useCallback((priority: JointPriority) => {
    setJointPriorityState(priority);
    setIsCustomModular(true);
  }, []);

  const setHasBacking = useCallback((backing: boolean) => {
    setHasBackingState(backing);
    setIsCustomModular(true);
  }, []);

  const setGridType = useCallback((type: '1-bay' | '2-bays-vertical' | '3-bays-vertical' | '2-bays-horizontal') => {
    setGridTypeState(type);
    setIsCustomModular(true);
    setBaysState((prev) => {
      const targetCount = type === '3-bays-vertical' ? 3 : type === '1-bay' ? 1 : 2;
      const next = [...prev];
      while (next.length < targetCount) {
        next.push({ type: 'empty' });
      }
      return next.slice(0, targetCount);
    });
    setActiveBayIndex((idx) => {
      const targetCount = type === '3-bays-vertical' ? 3 : type === '1-bay' ? 1 : 2;
      return idx >= targetCount ? 0 : idx;
    });
  }, []);

  const setBayContentType = useCallback(
    (bayIndex: number, type: 'empty' | 'shelves' | 'drawer-stack' | 'doors' | 'pull-out-tray' | 'bi-fold-closure') => {
      setIsCustomModular(true);
      setBaysState((prev) => {
        const next = [...prev];
        if (type === 'empty') {
          next[bayIndex] = { type: 'empty' };
        } else if (type === 'shelves') {
          next[bayIndex] = { type: 'shelves', count: 2, shelfType: 'adjustable', setbackMm: 20 };
        } else if (type === 'drawer-stack') {
          next[bayIndex] = {
            type: 'drawer-stack',
            drawerTracks: [
              { type: 'fixed', valueMm: 140 },
              { type: 'fractional', valueFr: 1 },
              { type: 'fractional', valueFr: 1 },
            ],
            frontMount: 'applied',
            slideType: 'telescopic',
            gapMm: 2.5,
            bottomMount: 'bottom-screwed',
          };
        } else if (type === 'doors') {
          next[bayIndex] = { type: 'doors', count: 2, mountType: 'full-overlay' };
        } else if (type === 'pull-out-tray') {
          next[bayIndex] = { type: 'pull-out-tray', lipHeightMm: 45, slideType: 'telescopic' };
        } else if (type === 'bi-fold-closure') {
          next[bayIndex] = {
            type: 'bi-fold-closure',
            leafTracks: [{ type: 'fractional', valueFr: 1 }, { type: 'fractional', valueFr: 1 }],
            hingeType: 'aventos',
            openingDirection: 'vertical-lift',
          };
        }
        return next;
      });
    },
    [],
  );

  const addShelf = useCallback((bayIndex: number) => {
    setIsCustomModular(true);
    setBaysState((prev) => {
      const next = [...prev];
      const current = next[bayIndex];
      if (current?.type === 'shelves') {
        next[bayIndex] = { ...current, count: Math.min(8, current.count + 1) };
      } else {
        next[bayIndex] = { type: 'shelves', count: 1, shelfType: 'adjustable', setbackMm: 20 };
      }
      return next;
    });
  }, []);

  const removeShelf = useCallback((bayIndex: number) => {
    setIsCustomModular(true);
    setBaysState((prev) => {
      const next = [...prev];
      const current = next[bayIndex];
      if (current?.type === 'shelves') {
        const newCount = Math.max(0, current.count - 1);
        next[bayIndex] = newCount === 0 ? { type: 'empty' } : { ...current, count: newCount };
      }
      return next;
    });
  }, []);

  const setShelfType = useCallback((bayIndex: number, shelfType: 'adjustable' | 'fixed') => {
    setIsCustomModular(true);
    setBaysState((prev) => {
      const next = [...prev];
      const current = next[bayIndex];
      if (current?.type === 'shelves') {
        next[bayIndex] = { ...current, shelfType };
      }
      return next;
    });
  }, []);

  const setShelfAntiSag = useCallback((bayIndex: number, hasAntiSagBrace: boolean) => {
    setIsCustomModular(true);
    setBaysState((prev) => {
      const next = [...prev];
      const current = next[bayIndex];
      if (current?.type === 'shelves') {
        next[bayIndex] = { ...current, hasAntiSagBrace };
      }
      return next;
    });
  }, []);

  const addDrawer = useCallback((bayIndex: number) => {
    setIsCustomModular(true);
    setBaysState((prev) => {
      const next = [...prev];
      const current = next[bayIndex];
      if (current?.type === 'drawer-stack') {
        if (current.drawerTracks.length < 6) {
          next[bayIndex] = {
            ...current,
            drawerTracks: [...current.drawerTracks, { type: 'fractional', valueFr: 1 }],
          };
        }
      } else {
        next[bayIndex] = {
          type: 'drawer-stack',
          drawerTracks: [{ type: 'fractional', valueFr: 1 }, { type: 'fractional', valueFr: 1 }],
          frontMount: 'applied',
          slideType: 'telescopic',
          gapMm: 2.5,
          bottomMount: 'bottom-screwed',
        };
      }
      return next;
    });
  }, []);

  const removeDrawer = useCallback((bayIndex: number) => {
    setIsCustomModular(true);
    setBaysState((prev) => {
      const next = [...prev];
      const current = next[bayIndex];
      if (current?.type === 'drawer-stack') {
        if (current.drawerTracks.length > 1) {
          next[bayIndex] = {
            ...current,
            drawerTracks: current.drawerTracks.slice(0, current.drawerTracks.length - 1),
          };
        } else {
          next[bayIndex] = { type: 'empty' };
        }
      }
      return next;
    });
  }, []);

  const setDrawerFrontMount = useCallback((bayIndex: number, frontMount: DrawerFrontMount) => {
    setIsCustomModular(true);
    setBaysState((prev) => {
      const next = [...prev];
      const current = next[bayIndex];
      if (current?.type === 'drawer-stack') {
        next[bayIndex] = { ...current, frontMount };
      }
      return next;
    });
  }, []);

  const setDrawerSlideType = useCallback((bayIndex: number, slideType: DrawerSlideType) => {
    setIsCustomModular(true);
    setBaysState((prev) => {
      const next = [...prev];
      const current = next[bayIndex];
      if (current?.type === 'drawer-stack') {
        next[bayIndex] = { ...current, slideType };
      }
      return next;
    });
  }, []);

  const setDrawerDistributionPreset = useCallback(
    (bayIndex: number, preset: 'equal' | 'cutlery-top' | 'custom', topHeightMm: number = 140) => {
      setIsCustomModular(true);
      setBaysState((prev) => {
        const next = [...prev];
        const current = next[bayIndex];
        if (current?.type !== 'drawer-stack') return prev;

        const count = current.drawerTracks.length;
        let newTracks: TrackSize[];

        if (preset === 'equal') {
          newTracks = Array.from({ length: count }, () => ({ type: 'fractional', valueFr: 1 }));
        } else if (preset === 'cutlery-top') {
          if (count === 1) {
            newTracks = [{ type: 'fractional', valueFr: 1 }];
          } else {
            newTracks = [
              { type: 'fixed', valueMm: topHeightMm },
              ...Array.from({ length: count - 1 }, () => ({ type: 'fractional' as const, valueFr: 1 })),
            ];
          }
        } else {
          newTracks = current.drawerTracks.length > 0 ? [...current.drawerTracks] : Array.from({ length: count }, () => ({ type: 'fractional', valueFr: 1 }));
        }

        next[bayIndex] = { ...current, drawerTracks: newTracks };
        return next;
      });
    },
    [],
  );

  const setDrawerTopHeight = useCallback((bayIndex: number, heightMm: number) => {
    setIsCustomModular(true);
    setBaysState((prev) => {
      const next = [...prev];
      const current = next[bayIndex];
      if (current?.type !== 'drawer-stack') return prev;

      const tracks = [...current.drawerTracks];
      if (tracks.length > 0) {
        tracks[0] = { type: 'fixed', valueMm: Math.max(60, Math.min(500, Math.round(heightMm))) };
        next[bayIndex] = { ...current, drawerTracks: tracks };
      }
      return next;
    });
  }, []);

  const setDrawerTrack = useCallback((bayIndex: number, trackIndex: number, track: TrackSize) => {
    setIsCustomModular(true);
    setBaysState((prev) => {
      const next = [...prev];
      const current = next[bayIndex];
      if (current?.type !== 'drawer-stack') return prev;

      const tracks = [...current.drawerTracks];
      if (trackIndex >= 0 && trackIndex < tracks.length) {
        tracks[trackIndex] = track;
        next[bayIndex] = { ...current, drawerTracks: tracks };
      }
      return next;
    });
  }, []);

  const setDrawerTracks = useCallback((bayIndex: number, tracks: TrackSize[]) => {
    setIsCustomModular(true);
    setBaysState((prev) => {
      const next = [...prev];
      const current = next[bayIndex];
      if (current?.type !== 'drawer-stack') return prev;
      if (tracks.length === 0) return prev;

      next[bayIndex] = { ...current, drawerTracks: tracks };
      return next;
    });
  }, []);

  const setDrawerGap = useCallback((bayIndex: number, gapMm: number) => {
    setIsCustomModular(true);
    setBaysState((prev) => {
      const next = [...prev];
      const current = next[bayIndex];
      if (current?.type !== 'drawer-stack') return prev;

      next[bayIndex] = { ...current, gapMm: Math.max(1, Math.min(10, gapMm)) };
      return next;
    });
  }, []);

  const setDrawerTransoms = useCallback((bayIndex: number, hasTransomDividers: boolean) => {
    setIsCustomModular(true);
    setBaysState((prev) => {
      const next = [...prev];
      const current = next[bayIndex];
      if (current?.type !== 'drawer-stack') return prev;

      next[bayIndex] = { ...current, hasTransomDividers };
      return next;
    });
  }, []);

  const setDrawerType = useCallback((bayIndex: number, drawerType: DrawerType) => {
    setIsCustomModular(true);
    setBaysState((prev) => {
      const next = [...prev];
      const current = next[bayIndex];
      if (current?.type !== 'drawer-stack') return prev;

      next[bayIndex] = { ...current, drawerType };
      return next;
    });
  }, []);

  const setDrawerBottomMount = useCallback((bayIndex: number, bottomMount: DrawerBottomMount) => {
    setIsCustomModular(true);
    setBaysState((prev) => {
      const next = [...prev];
      const current = next[bayIndex];
      if (current?.type !== 'drawer-stack') return prev;

      next[bayIndex] = { ...current, bottomMount };
      return next;
    });
  }, []);

  const setDrawerTopPullGap = useCallback((bayIndex: number, topPullGapMm: number) => {
    setIsCustomModular(true);
    setBaysState((prev) => {
      const next = [...prev];
      const current = next[bayIndex];
      if (current?.type !== 'drawer-stack') return prev;

      next[bayIndex] = { ...current, topPullGapMm: Math.max(0, Math.min(80, Math.round(topPullGapMm))) };
      return next;
    });
  }, []);

  const setDrawerBoxSideHeightOffset = useCallback((bayIndex: number, boxSideHeightOffsetMm: number) => {
    setIsCustomModular(true);
    setBaysState((prev) => {
      const next = [...prev];
      const current = next[bayIndex];
      if (current?.type !== 'drawer-stack') return prev;

      next[bayIndex] = { ...current, boxSideHeightOffsetMm: Math.max(0, Math.min(150, Math.round(boxSideHeightOffsetMm))) };
      return next;
    });
  }, []);

  const setDoorCount = useCallback((bayIndex: number, count: 1 | 2) => {
    setIsCustomModular(true);
    setBaysState((prev) => {
      const next = [...prev];
      const current = next[bayIndex];
      if (current?.type === 'doors') {
        next[bayIndex] = { ...current, count };
      } else {
        next[bayIndex] = { type: 'doors', count, mountType: 'full-overlay' };
      }
      return next;
    });
  }, []);

  const setDoorMountType = useCallback((bayIndex: number, mountType: DoorMountType) => {
    setIsCustomModular(true);
    setBaysState((prev) => {
      const next = [...prev];
      const current = next[bayIndex];
      if (current?.type === 'doors') {
        next[bayIndex] = { ...current, mountType };
      }
      return next;
    });
  }, []);

  const setBifoldDirection = useCallback((bayIndex: number, openingDirection: 'vertical-lift' | 'horizontal-book') => {
    setIsCustomModular(true);
    setBaysState((prev) => {
      const next = [...prev];
      const current = next[bayIndex];
      if (current?.type === 'bi-fold-closure') {
        next[bayIndex] = { ...current, openingDirection };
      }
      return next;
    });
  }, []);

  const setDoorInteriorShelvesCount = useCallback((bayIndex: number, count: number) => {
    setIsCustomModular(true);
    setBaysState((prev) => {
      const next = [...prev];
      const current = next[bayIndex];
      if (current?.type === 'doors' || current?.type === 'bi-fold-closure') {
        next[bayIndex] = { ...current, interiorShelvesCount: Math.max(0, Math.min(8, Math.round(count))) };
      }
      return next;
    });
  }, []);

  const setDoorShelfType = useCallback((bayIndex: number, shelfType: 'adjustable' | 'fixed') => {
    setIsCustomModular(true);
    setBaysState((prev) => {
      const next = [...prev];
      const current = next[bayIndex];
      if (current?.type === 'doors' || current?.type === 'bi-fold-closure') {
        next[bayIndex] = { ...current, shelfType };
      }
      return next;
    });
  }, []);

  const setBackingType = useCallback((type: BackingType) => {
    setBackingTypeState(type);
    setIsCustomModular(true);
  }, []);

  const setBackingThicknessMm = useCallback((thickness: number) => {
    setBackingThicknessMmState(thickness);
    setIsCustomModular(true);
  }, []);

  const setIsIslandCabinet = useCallback((val: boolean) => {
    setIsIslandCabinetState(val);
    setIsCustomModular(true);
  }, []);

  const setRearStructuralRails = useCallback((val: RearStructuralRails) => {
    setRearStructuralRailsState(val);
    setIsCustomModular(true);
  }, []);

  const setRearStructuralRailsWidthMm = useCallback((val: number) => {
    setRearStructuralRailsWidthMmState(val);
    setIsCustomModular(true);
  }, []);

  // Load catalogs, user templates, and project config from IndexedDB on startup
  useEffect(() => {
    let isMounted = true;

    async function loadData(): Promise<void> {
      try {
        setIsLoading(true);
        const [loadedMats, loadedBands, loadedHw, loadedConfig, loadedUserTpls] = await Promise.all([
          loadMaterialsFromDb(initialDb),
          loadEdgeBandsFromDb(initialDb),
          loadHardwareFromDb(initialDb),
          loadProjectConfigFromDb(DEFAULT_PROJECT_ID, initialDb),
          loadUserTemplatesFromDb(initialDb),
        ]);

        if (!isMounted) return;

        setMaterials(loadedMats);
        setEdgeBands(loadedBands);
        setHardware(loadedHw);
        setProjectConfig(loadedConfig);
        setUserTemplates(loadedUserTpls);

        if (loadedMats[0]) {
          setSelectedMaterialId(loadedMats[0].id);
        }
        if (loadedBands[0]) {
          setSelectedEdgeBandId(loadedBands[0].id);
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'No se pudieron cargar los catálogos del taller');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [initialDb]);

  // User templates persistence actions
  const saveCurrentUserTemplate = useCallback(
    async (name: string, description?: string) => {
      try {
        setIsSaving(true);
        const newTemplate: UserTemplate = {
          id: `user-tpl-${Date.now()}`,
          schemaVersion: 1,
          name: name.trim(),
          description: description?.trim() || undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          dimensions: { width, height, depth },
          carcassSettings: {
            roofType,
            jointPriority,
            hasBacking,
            railOrientation,
            hasMiddleBrace,
            middleBraceWidthMm,
            hasWallHangingRail,
            wallHangingRailWidthMm,
            hasPlinth,
            plinthHeightMm,
            plinthSetbackMm,
            backingType,
            backingThicknessMm,
            isIslandCabinet,
            rearStructuralRails,
            rearStructuralRailsWidthMm,
          },
          gridType,
          bays,
          materials: {
            carcassMaterialId: selectedMaterialId,
            frontsMaterialId,
            drawerBoxesMaterialId,
            backingsMaterialId,
            edgeBandId: selectedEdgeBandId,
          },
          jointOverrides: pieceJointOverrides,
        };
        await saveUserTemplateToDb(newTemplate, initialDb);
        setUserTemplates((prev) => [...prev.filter((t) => t.id !== newTemplate.id), newTemplate]);
        setSelectedTemplateId(newTemplate.id);
        setStatusMessage(`Plantilla "${name}" guardada con éxito.`);
        setTimeout(() => setStatusMessage(null), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al guardar plantilla.');
      } finally {
        setIsSaving(false);
      }
    },
    [
      width,
      height,
      depth,
      roofType,
      jointPriority,
      hasBacking,
      railOrientation,
      hasMiddleBrace,
      middleBraceWidthMm,
      hasWallHangingRail,
      wallHangingRailWidthMm,
      hasPlinth,
      plinthHeightMm,
      plinthSetbackMm,
      gridType,
      bays,
      selectedMaterialId,
      frontsMaterialId,
      drawerBoxesMaterialId,
      backingsMaterialId,
      selectedEdgeBandId,
      pieceJointOverrides,
      initialDb,
    ],
  );

  const deleteUserTemplate = useCallback(
    async (id: string) => {
      try {
        setIsSaving(true);
        await deleteUserTemplateFromDb(id, initialDb);
        setUserTemplates((prev) => prev.filter((t) => t.id !== id));
        if (selectedTemplateId === id) {
          handleSelectTemplate('modular-empty');
        }
        setStatusMessage('Plantilla eliminada.');
        setTimeout(() => setStatusMessage(null), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al eliminar plantilla.');
      } finally {
        setIsSaving(false);
      }
    },
    [selectedTemplateId, initialDb, handleSelectTemplate],
  );

  // Catalog Database CRUD Actions
  const saveMaterial = useCallback(
    async (mat: Material) => {
      await saveMaterialToDb(mat, initialDb);
      const mats = await loadMaterialsFromDb(initialDb);
      setMaterials(mats);
    },
    [initialDb],
  );

  const deleteMaterial = useCallback(
    async (matId: string) => {
      await deleteMaterialFromDb(matId, initialDb);
      const mats = await loadMaterialsFromDb(initialDb);
      setMaterials(mats);
    },
    [initialDb],
  );

  const saveEdgeBand = useCallback(
    async (eb: EdgeBand) => {
      await saveEdgeBandToDb(eb, initialDb);
      const bands = await loadEdgeBandsFromDb(initialDb);
      setEdgeBands(bands);
    },
    [initialDb],
  );

  const deleteEdgeBand = useCallback(
    async (ebId: string) => {
      await deleteEdgeBandFromDb(ebId, initialDb);
      const bands = await loadEdgeBandsFromDb(initialDb);
      setEdgeBands(bands);
    },
    [initialDb],
  );

  const saveHardware = useCallback(
    async (hw: Hardware) => {
      await saveHardwareToDb(hw, initialDb);
      const items = await loadHardwareFromDb(initialDb);
      setHardware(items);
    },
    [initialDb],
  );

  const deleteHardware = useCallback(
    async (hwId: string) => {
      await deleteHardwareFromDb(hwId, initialDb);
      const items = await loadHardwareFromDb(initialDb);
      setHardware(items);
    },
    [initialDb],
  );

  const resetCatalogs = useCallback(async () => {
    await resetCatalogsToSeed(initialDb);
    const mats = await loadMaterialsFromDb(initialDb);
    const bands = await loadEdgeBandsFromDb(initialDb);
    const items = await loadHardwareFromDb(initialDb);
    setMaterials(mats);
    setEdgeBands(bands);
    setHardware(items);
  }, [initialDb]);

  // Piece-level joint overrides
  const setPieceJointOverride = useCallback((pieceId: string, jointKind: JointKind | null) => {
    setPieceJointOverrides((prev) => {
      const next = { ...prev };
      if (jointKind === null) {
        delete next[pieceId];
      } else {
        next[pieceId] = jointKind;
      }
      return next;
    });
  }, []);

  // Piece-level overrides (Point 10)
  const setPieceMaterial = useCallback((pieceId: string, materialId: string | null) => {
    setPieceMaterialOverrides((prev) => {
      const next = { ...prev };
      if (!materialId) {
        delete next[pieceId];
      } else {
        next[pieceId] = materialId;
      }
      return next;
    });
  }, []);

  const setPieceThickness = useCallback((pieceId: string, thicknessMm: number | null) => {
    setPieceThicknessOverrides((prev) => {
      const next = { ...prev };
      if (!thicknessMm || thicknessMm <= 0) {
        delete next[pieceId];
      } else {
        next[pieceId] = thicknessMm;
      }
      return next;
    });
  }, []);

  const setPieceEdgeBands = useCallback((pieceId: string, override: PieceEdgeBandOverride | null) => {
    setPieceEdgeBandOverrides((prev) => {
      const next = { ...prev };
      if (!override) {
        delete next[pieceId];
      } else {
        next[pieceId] = override;
      }
      return next;
    });
  }, []);

  // Custom piece machining operations (Point 8)
  const addCustomPieceOperation = useCallback((pieceId: string, op: CustomPieceOperation) => {
    setCustomPieceOperations((prev) => {
      const list = prev[pieceId] ? [...prev[pieceId]] : [];
      list.push(op);
      return { ...prev, [pieceId]: list };
    });
  }, []);

  const removeCustomPieceOperation = useCallback((pieceId: string, opId: string) => {
    setCustomPieceOperations((prev) => {
      const list = prev[pieceId] ? prev[pieceId].filter((o) => o.id !== opId) : [];
      return { ...prev, [pieceId]: list };
    });
  }, []);

  // Selected material
  const activeMaterial = useMemo(
    () => materials.find((m) => m.id === selectedMaterialId) ?? materials[0],
    [materials, selectedMaterialId],
  );

  // Wall Shelving definition & calculation
  const wallShelvingDefinition = useMemo<WallShelvingDefinition | null>(() => {
    if (selectedTemplateId !== 'wall-shelves' || !activeMaterial) return null;
    const thickness = typeof activeMaterial.thicknessMm === 'number' ? activeMaterial.thicknessMm : 18;
    return {
      id: 'wall-shelves-module',
      widthMm: width,
      depthMm: depth,
      thicknessMm: thickness,
      shelfCount: wallShelvesShelfCount,
      verticalSpacingMm: wallShelvesVerticalSpacingMm,
      bracketType: wallShelvesBracketType,
      wallType: wallShelvesWallType,
      loadCategory: wallShelvesLoadCategory,
      boundaryCondition: wallShelvesBoundaryCondition,
      overhangMode: wallShelvesOverhangMode,
      materialId: activeMaterial.id,
      edgeBandId: selectedEdgeBandId || undefined,
      baseElevationYMm: wallShelvesBaseElevationYMm,
    };
  }, [
    selectedTemplateId,
    activeMaterial,
    width,
    depth,
    wallShelvesShelfCount,
    wallShelvesVerticalSpacingMm,
    wallShelvesBracketType,
    wallShelvesWallType,
    wallShelvesLoadCategory,
    wallShelvesBoundaryCondition,
    wallShelvesOverhangMode,
    selectedEdgeBandId,
    wallShelvesBaseElevationYMm,
  ]);

  const wallShelvingOutput = useMemo<WallShelvingOutput | null>(() => {
    if (!wallShelvingDefinition) return null;
    return buildWallShelving(wallShelvingDefinition);
  }, [wallShelvingDefinition]);

  // Active Countertop Material and Definition (Phase 3)
  const activeCountertopMaterial = useMemo<CountertopMaterial>(() => {
    return (
      DEFAULT_COUNTERTOP_MATERIALS.find((m) => m.id === countertopMaterialId) ??
      DEFAULT_COUNTERTOP_MATERIALS[0]!
    );
  }, [countertopMaterialId]);

  const countertopDefinition = useMemo<CountertopDefinition>(() => {
    const placements = [];
    if (selectedEquipmentId !== 'none') {
      placements.push({
        equipmentId: selectedEquipmentId,
        centerXMm: width / 2,
        centerOffsetYMm: 0,
        sinkDrawerAdaptation,
        frontRailOrientation: countertopFrontRailOrientation,
      });
    }

    return {
      schemaVersion: 1,
      id: `${selectedTemplateId}-countertop`,
      name: `Mesada ${activeCountertopMaterial.name}`,
      materialId: activeCountertopMaterial.id,
      widthMm: width,
      depthMm: depth + countertopFrontOverhangMm,
      frontOverhangMm: countertopFrontOverhangMm,
      leftOverhangMm: 0,
      rightOverhangMm: 0,
      backOverhangMm: 0,
      edgeFinish: countertopEdgeFinish,
      miteredSkirtHeightMm: 0,
      cornerRadii: { frontLeftMm: 0, frontRightMm: 0, backLeftMm: 0, backRightMm: 0 },
      backsplash: {
        hasSplash: countertopHasBacksplash,
        heightMm: countertopBacksplashHeightMm,
        thicknessMm: activeCountertopMaterial.thicknessMm,
      },
      leftSplash: { hasSplash: false, heightMm: 60, thicknessMm: 20 },
      rightSplash: { hasSplash: false, heightMm: 60, thicknessMm: 20 },
      placements,
    };
  }, [
    selectedTemplateId,
    activeCountertopMaterial,
    width,
    depth,
    countertopFrontOverhangMm,
    countertopEdgeFinish,
    countertopHasBacksplash,
    countertopBacksplashHeightMm,
    selectedEquipmentId,
    sinkDrawerAdaptation,
    countertopFrontRailOrientation,
  ]);

  const countertopCalculation = useMemo<CountertopCalculationResult | null>(() => {
    if (!countertopEnabled) return null;
    return calculateCountertop(
      countertopDefinition,
      activeCountertopMaterial,
      DEFAULT_EQUIPMENT_ITEMS,
      [width],
    );
  }, [countertopEnabled, countertopDefinition, activeCountertopMaterial, width]);


  // Resolves pieces dynamically whenever parameters, template, or materials change
  const { currentModule, resolvedPieces, placementTree } = useMemo(() => {
    if (!activeMaterial || width <= 0 || height <= 0 || depth <= 0) {
      return { currentModule: null, resolvedPieces: [], placementTree: null };
    }

    try {
      if (selectedTemplateId === 'wall-shelves') {
        if (!wallShelvingOutput) {
          return { currentModule: null, resolvedPieces: [], placementTree: null };
        }
        const positions = wallShelvingOutput.placementTree.resolvePositions();
        const resolvedPieces: ResolvedPieceWithCutSize[] = wallShelvingOutput.module.pieces.map((p) => {
          const cut = calculatePieceCutSize(p, edgeBands);
          const pos = positions.get(p.id) ?? { x: 0, y: 0, z: 0 };
          const bandedList = [
            cut.bandedEdges.bottom,
            cut.bandedEdges.right,
            cut.bandedEdges.top,
            cut.bandedEdges.left,
          ].filter((b): b is NonNullable<typeof b> => Boolean(b));

          return {
            ...p,
            positionMm: pos,
            dimensionsMm: {
              width: p.contour.points[1]!.x,
              height: p.contour.points[2]!.y,
            },
            cutDimensionsMm: cut.cutDimensionsMm,
            cutContour: createRectangularContour(cut.cutDimensionsMm.width, cut.cutDimensionsMm.height),
            bandedEdges: bandedList,
          };
        });

        return {
          currentModule: wallShelvingOutput.module,
          resolvedPieces,
          placementTree: wallShelvingOutput.placementTree,
        };
      }

      if (isCustomModular || selectedTemplateId.startsWith('modular-') || selectedTemplateId.startsWith('user-')) {
        const gridDef: BayGridDefinition | undefined =
          gridType === '2-bays-vertical'
            ? {
                axis: 'horizontal',
                tracks: [
                  { type: 'fractional', valueFr: 1 },
                  { type: 'fractional', valueFr: 1 },
                ],
              }
            : gridType === '3-bays-vertical'
            ? {
                axis: 'horizontal',
                tracks: [
                  { type: 'fractional', valueFr: 1 },
                  { type: 'fractional', valueFr: 1 },
                  { type: 'fractional', valueFr: 1 },
                ],
              }
            : gridType === '2-bays-horizontal'
            ? {
                axis: 'vertical',
                tracks: [
                  { type: 'fractional', valueFr: 1 },
                  { type: 'fractional', valueFr: 1 },
                ],
              }
            : undefined;

        const expectedBayCount = gridDef ? gridDef.tracks.length : 1;
        const normalizedBays: BayContent[] = [];
        for (let i = 0; i < expectedBayCount; i++) {
          normalizedBays.push(bays[i] ?? { type: 'empty' });
        }

        const modularDef: ModularModuleDefinition = {
          id: `mod-${selectedTemplateId}`,
          carcass: {
            width,
            height,
            depth,
            jointPriority,
            roofType,
            railWidthMm: 80,
            railOrientation,
            hasMiddleBrace,
            middleBraceWidthMm,
            hasWallHangingRail,
            wallHangingRailWidthMm,
            hasPlinth,
            plinthHeightMm,
            plinthSetbackMm,
            hasBacking,
            backingType,
            backingThicknessMm: (() => {
              const raw = materials.find((m) => m.id === backingsMaterialId)?.thicknessMm;
              return typeof raw === 'number' ? raw : backingThicknessMm;
            })(),
            isIslandCabinet,
            rearStructuralRails,
            rearStructuralRailsWidthMm,
          },
          grid: gridDef,
          bays: normalizedBays,
          materials: {
            carcassMaterialId: activeMaterial.id,
            frontsMaterialId: frontsMaterialId || activeMaterial.id,
            drawerBoxesMaterialId: drawerBoxesMaterialId || activeMaterial.id,
            backingsMaterialId: backingsMaterialId || activeMaterial.id,
            pieceOverrides: pieceMaterialOverrides,
            pieceThicknessOverrides,
            pieceEdgeBandOverrides,
          },
          edgeBandId: selectedEdgeBandId || undefined,
        };

        const backingMat = materials.find((m) => m.id === backingsMaterialId);
        const resolvedBackingThickness = typeof backingMat?.thicknessMm === 'number'
          ? backingMat.thicknessMm
          : backingThicknessMm;
        const boxMat = materials.find((m) => m.id === drawerBoxesMaterialId);
        const resolvedBoxThickness = typeof boxMat?.thicknessMm === 'number'
          ? boxMat.thicknessMm
          : 15;
        const frontMat = materials.find((m) => m.id === frontsMaterialId);
        const resolvedFrontThickness = typeof frontMat?.thicknessMm === 'number'
          ? frontMat.thicknessMm
          : 18;

        const built = buildModularModule(modularDef, {
          carcassThicknessMm: typeof activeMaterial.thicknessMm === 'number' ? activeMaterial.thicknessMm : 18,
          frontThicknessMm: resolvedFrontThickness,
          boxThicknessMm: resolvedBoxThickness,
          backingThicknessMm: resolvedBackingThickness,
          drawerBottomScrewedDeductionWidthMm: projectConfig?.hardware?.drawerBottomScrewedDeductionWidthMm,
          drawerBottomScrewedDeductionDepthMm: projectConfig?.hardware?.drawerBottomScrewedDeductionDepthMm,
          edgeBands,
        });

        let finalPieces = built.resolvedPieces;
        if (countertopEnabled && selectedEquipmentId !== 'none') {
          const eq = DEFAULT_EQUIPMENT_ITEMS.find((e) => e.id === selectedEquipmentId);
          if (eq) {
            const placement = {
              equipmentId: eq.id,
              centerXMm: width / 2,
              centerOffsetYMm: 0,
              sinkDrawerAdaptation,
              frontRailOrientation: countertopFrontRailOrientation,
            };
            const adapted = adaptCabinetForEquipment(finalPieces, eq, placement, 0);
            finalPieces = adapted.cabinetPieces as ResolvedPieceWithCutSize[];
          }
        }

        return {
          currentModule: {
            ...built.module,
            pieces: finalPieces,
          },
          resolvedPieces: finalPieces,
          placementTree: built.placementTree,
        };
      }

      const template = getTemplateById(selectedTemplateId, userTemplates);
      const built = template.build(
        { width, height, depth },
        activeMaterial,
        edgeBands,
        selectedEdgeBandId || undefined,
        projectConfig ?? undefined,
      );

      let finalPieces = built.resolvedPieces;
      if (countertopEnabled && selectedEquipmentId !== 'none') {
        const eq = DEFAULT_EQUIPMENT_ITEMS.find((e) => e.id === selectedEquipmentId);
        if (eq) {
          const placement = {
            equipmentId: eq.id,
            centerXMm: width / 2,
            centerOffsetYMm: 0,
            sinkDrawerAdaptation,
            frontRailOrientation: countertopFrontRailOrientation,
          };
          const adapted = adaptCabinetForEquipment(finalPieces, eq, placement, 0);
          finalPieces = adapted.cabinetPieces as ResolvedPieceWithCutSize[];
        }
      }

      return {
        currentModule: {
          ...built.module,
          pieces: finalPieces,
        },
        resolvedPieces: finalPieces,
        placementTree: built.placementTree,
      };
    } catch {
      return { currentModule: null, resolvedPieces: [], placementTree: null };
    }
  }, [
    width,
    height,
    depth,
    selectedTemplateId,
    activeMaterial,
    selectedEdgeBandId,
    edgeBands,
    projectConfig,
    isCustomModular,
    roofType,
    jointPriority,
    hasBacking,
    backingType,
    backingThicknessMm,
    isIslandCabinet,
    rearStructuralRails,
    rearStructuralRailsWidthMm,
    railOrientation,
    hasMiddleBrace,
    middleBraceWidthMm,
    hasWallHangingRail,
    wallHangingRailWidthMm,
    hasPlinth,
    plinthHeightMm,
    plinthSetbackMm,
    pieceMaterialOverrides,
    pieceThicknessOverrides,
    pieceEdgeBandOverrides,
    gridType,
    bays,
    frontsMaterialId,
    drawerBoxesMaterialId,
    backingsMaterialId,
    userTemplates,
    wallShelvingOutput,
    countertopEnabled,
    selectedEquipmentId,
    sinkDrawerAdaptation,
    countertopFrontRailOrientation,
  ]);

  // Resolves 3D spatial boxes and bounding box
  const spatialData = useMemo(() => {
    if (!currentModule || !placementTree) {
      const zero = { x: 0, y: 0, z: 0 };
      return {
        boxes: [],
        bounds: { min: zero, max: zero, center: zero, size: zero },
      };
    }
    const resolved = resolveModuleSpatialBoxes(currentModule.pieces, placementTree);
    if (!countertopEnabled || !countertopCalculation) {
      return resolved;
    }

    const extraBoxes: SpatialPieceBox[] = [];
    const slabThick = activeCountertopMaterial.thicknessMm;
    const slabW = countertopDefinition.widthMm;
    const slabD = countertopDefinition.depthMm;
    const slabX = -countertopDefinition.leftOverhangMm;
    const slabY = height;
    const slabZ = -countertopDefinition.frontOverhangMm;

    extraBoxes.push({
      pieceId: `${countertopDefinition.id}-slab`,
      role: 'countertop',
      materialId: activeCountertopMaterial.id,
      thicknessMm: slabThick,
      positionMm: { x: slabX, y: slabY, z: slabZ },
      sizeMm: { x: slabW, y: slabThick, z: slabD },
      centerMm: { x: slabX + slabW / 2, y: slabY + slabThick / 2, z: slabZ + slabD / 2 },
    });

    if (countertopDefinition.backsplash.hasSplash) {
      const splashH = countertopDefinition.backsplash.heightMm;
      const splashThick = countertopDefinition.backsplash.thicknessMm;
      const splashX = 0;
      const splashY = height + slabThick;
      const splashZ = depth - splashThick;
      extraBoxes.push({
        pieceId: `${countertopDefinition.id}-splash-back`,
        role: 'countertop-backsplash',
        materialId: activeCountertopMaterial.id,
        thicknessMm: splashThick,
        positionMm: { x: splashX, y: splashY, z: splashZ },
        sizeMm: { x: width, y: splashH, z: splashThick },
        centerMm: { x: splashX + width / 2, y: splashY + splashH / 2, z: splashZ + splashThick / 2 },
      });
    }

    const allBoxes = [...resolved.boxes, ...extraBoxes];
    let minX = resolved.bounds.min.x;
    let minY = resolved.bounds.min.y;
    let minZ = resolved.bounds.min.z;
    let maxX = resolved.bounds.max.x;
    let maxY = resolved.bounds.max.y;
    let maxZ = resolved.bounds.max.z;

    for (const b of extraBoxes) {
      minX = Math.min(minX, b.positionMm.x);
      minY = Math.min(minY, b.positionMm.y);
      minZ = Math.min(minZ, b.positionMm.z);
      maxX = Math.max(maxX, b.positionMm.x + b.sizeMm.x);
      maxY = Math.max(maxY, b.positionMm.y + b.sizeMm.y);
      maxZ = Math.max(maxZ, b.positionMm.z + b.sizeMm.z);
    }

    return {
      boxes: allBoxes,
      bounds: {
        min: { x: minX, y: minY, z: minZ },
        max: { x: maxX, y: maxY, z: maxZ },
        center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2, z: (minZ + maxZ) / 2 },
        size: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ },
      },
    };
  }, [
    currentModule,
    placementTree,
    countertopEnabled,
    countertopCalculation,
    activeCountertopMaterial,
    countertopDefinition,
    height,
    depth,
    width,
  ]);

  // Custom operations flattened list
  const customOperationsList = useMemo(() => {
    return Object.values(customPieceOperations).flat();
  }, [customPieceOperations]);

  // Identifies mobile kinematic mechanisms (drawers, doors, trays, flaps)
  const kinematicMechanisms = useMemo(() => {
    return identifyKinematicMechanisms(spatialData.boxes);
  }, [spatialData.boxes]);

  // Calculates kinematic transforms for interactive mechanism opening
  const kinematicBoxes = useMemo(() => {
    return calculateKinematicBoxes(spatialData.boxes, kinematicMechanisms, kinematicsState);
  }, [spatialData.boxes, kinematicMechanisms, kinematicsState]);

  // Mechanism kinematics opening (Point 11)
  const setMechanismOpenRatio = useCallback(
    (mechanismId: string | null, ratio: number) => {
      const clamped = Math.max(0, Math.min(1, ratio));
      setKinematicsState((prev) => {
        if (!mechanismId) {
          const next: Record<string, number> = {};
          for (const m of kinematicMechanisms) {
            next[m.id] = clamped;
          }
          return next;
        }
        return { ...prev, [mechanismId]: clamped };
      });
    },
    [kinematicMechanisms],
  );

  // Derives drill machining operations from module joints (with piece-level overrides & custom operations)
  const { machiningOperations, pieceMachiningList } = useMemo(() => {
    if (!currentModule) {
      return { machiningOperations: [], pieceMachiningList: [] };
    }
    const piecesForMachining = resolvedPieces.length > 0 ? resolvedPieces : currentModule.pieces;
    const ops = deriveModuleDrillOperations(
      piecesForMachining,
      currentModule.joints,
      projectConfig?.machining,
      undefined,
      pieceJointOverrides,
      customOperationsList,
    );
    const list = groupOperationsByPiece(currentModule.pieces, ops, customOperationsList);
    return { machiningOperations: ops, pieceMachiningList: list };
  }, [currentModule, resolvedPieces, projectConfig, pieceJointOverrides, customOperationsList]);

  // Builds machining sheets for workshop manual machines
  const machiningSheets = useMemo(() => {
    if (resolvedPieces.length === 0) return [];
    return buildModuleMachiningSheets(resolvedPieces, machiningOperations, customOperationsList);
  }, [resolvedPieces, machiningOperations, customOperationsList]);

  // Checks deflection for shelves using project configuration
  const shelfDeflections = useMemo(() => {
    if (resolvedPieces.length === 0) return new Map<string, ShelfDeflectionResult>();
    return checkModuleShelvesDeflection(
      resolvedPieces,
      materials,
      projectConfig?.deflection,
    );
  }, [resolvedPieces, materials, projectConfig]);

  const shelfDeflectionWarnings = useMemo(() => {
    return Array.from(shelfDeflections.values()).filter((d) => d.hasWarning);
  }, [shelfDeflections]);

  // Generates Bill of Materials
  const bom = useMemo(() => {
    if (!currentModule || resolvedPieces.length === 0) return null;
    return generateBillOfMaterials(
      {
        moduleId: currentModule.id,
        parameters: currentModule.parameters,
        pieces: resolvedPieces,
        joints: currentModule.joints,
        placementTree: new PlacementTree(currentModule.rootPieceId),
        jointGraph: new JointGraph(currentModule.joints),
      },
      edgeBands,
    );
  }, [currentModule, resolvedPieces, edgeBands]);

  // Generates Assembly Sheet
  const assemblySheet = useMemo<AssemblySheet | null>(() => {
    if (!currentModule || resolvedPieces.length === 0) return null;
    try {
      return generateAssemblySheet({
        module: {
          moduleId: currentModule.id,
          pieces: resolvedPieces,
          joints: currentModule.joints,
        },
        machiningConfig: projectConfig?.machining,
      });
    } catch {
      return null;
    }
  }, [currentModule, resolvedPieces, projectConfig]);

  // Generates Costs
  const cost = useMemo(() => {
    if (!bom || !activeMaterial) return null;
    try {
      const includeGauges = Boolean(projectConfig?.nesting?.includeAssemblyGaugesInCutPlan);
      const gaugePieces = includeGauges
        ? (assemblySheet?.gauges ?? []).flatMap((g) => {
            const count = Math.min(2, Math.max(1, g.occurrences.length));
            const items = [];
            for (let i = 0; i < count; i++) {
              items.push({
                id: i === 0 ? g.piece.id : `${g.piece.id}-${i + 1}`,
                pieceId: i === 0 ? g.piece.id : `${g.piece.id}-${i + 1}`,
                materialId: activeMaterial.id,
                cutWidthMm: g.clearSpanMm,
                cutHeightMm: g.widthMm,
                canRotate: true,
                isAuxiliary: true,
              });
            }
            return items;
          })
        : [];

      const nestingItems = [
        ...resolvedPieces.map((p) => {
          const pieceMat = materials.find((m) => m.id === p.materialId);
          return {
            id: p.id,
            pieceId: p.id,
            materialId: p.materialId,
            cutWidthMm: p.cutDimensionsMm.width,
            cutHeightMm: p.cutDimensionsMm.height,
            canRotate: pieceMat ? !pieceMat.hasGrain : !activeMaterial.hasGrain,
            isAuxiliary: p.isAuxiliary,
          };
        }),
        ...gaugePieces,
      ];

      const nesting = runMultiMaterialGuillotineNesting({
        items: nestingItems,
        sheetLookup: (matId) => {
          const mat = materials.find((m) => m.id === matId) ?? activeMaterial;
          const sLen = typeof mat.sheetSizeMm.length === 'number' ? mat.sheetSizeMm.length : 2800;
          const sWid = typeof mat.sheetSizeMm.width === 'number' ? mat.sheetSizeMm.width : 2070;
          return {
            materialId: mat.id,
            lengthMm: sLen,
            widthMm: sWid,
            sawKerfMm: projectConfig?.nesting.sawKerfMm,
            trimMarginMm: projectConfig?.nesting.sheetTrimMarginMm,
          };
        },
        optimizationGoal: projectConfig?.nesting.optimizationGoal,
      });

      return calculateModuleCost({
        bom,
        nestingResult: nesting,
        materials,
        edgeBands,
        hardware,
        costConfig: projectConfig?.cost,
      });
    } catch {
      return null;
    }
  }, [bom, activeMaterial, resolvedPieces, materials, edgeBands, hardware, projectConfig, assemblySheet]);

  // Save module to IndexedDB
  const saveModule = useCallback(async () => {
    if (!currentModule) return;
    try {
      setIsSaving(true);
      await saveItem('modules', currentModule, initialDb);
      setStatusMessage(`Módulo "${currentModule.id}" guardado en la base de datos.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el módulo');
    } finally {
      setIsSaving(false);
    }
  }, [currentModule, initialDb]);

  // Load module from IndexedDB
  const loadModule = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      const loaded = await loadItem<Module>('modules', id, initialDb);
      if (loaded) {
        if (loaded.parameters['width']) setWidth(loaded.parameters['width']);
        if (loaded.parameters['height']) setHeight(loaded.parameters['height']);
        if (loaded.parameters['depth']) setDepth(loaded.parameters['depth']);
        setStatusMessage(`Módulo "${id}" cargado desde la base de datos.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar el módulo');
    } finally {
      setIsLoading(false);
    }
  }, [initialDb]);

  const exportCsv = useCallback(() => {
    if (resolvedPieces.length === 0) return;
    const auxPieces: ResolvedPieceWithCutSize[] = (assemblySheet?.gauges ?? []).map((g) => ({
      id: g.piece.id,
      role: g.piece.role,
      materialId: g.piece.materialId,
      contour: g.piece.contour,
      thicknessMm: g.piece.thicknessMm,
      faces: g.piece.faces,
      structural: g.piece.structural,
      referenceFace: g.piece.referenceFace,
      isAuxiliary: true,
      positionMm: { x: 0, y: 0, z: 0 },
      dimensionsMm: { width: g.clearSpanMm, height: g.widthMm },
      cutDimensionsMm: { width: g.clearSpanMm, height: g.widthMm },
      cutContour: g.piece.contour,
      bandedEdges: [],
    }));
    const allPieces = [...resolvedPieces, ...auxPieces];
    const csvContent = exportCutListCsv(allPieces);
    const fileName = `cut-list-${currentModule?.id ?? 'module'}.csv`;
    triggerBrowserDownload(fileName, csvContent, 'text/csv;charset=utf-8;');
    setStatusMessage(`Lista de corte exportada a ${fileName}.`);
  }, [resolvedPieces, currentModule, assemblySheet]);

  const exportPdf = useCallback(() => {
    if (resolvedPieces.length === 0 || !activeMaterial) return;
    const includeGauges = Boolean(projectConfig?.nesting?.includeAssemblyGaugesInCutPlan);
    const gaugePieces = includeGauges
      ? (assemblySheet?.gauges ?? []).flatMap((g) => {
          const count = Math.min(2, Math.max(1, g.occurrences.length));
          const items = [];
          for (let i = 0; i < count; i++) {
            items.push({
              id: i === 0 ? g.piece.id : `${g.piece.id}-${i + 1}`,
              pieceId: i === 0 ? g.piece.id : `${g.piece.id}-${i + 1}`,
              materialId: activeMaterial.id,
              cutWidthMm: g.clearSpanMm,
              cutHeightMm: g.widthMm,
              canRotate: true,
              isAuxiliary: true,
            });
          }
          return items;
        })
      : [];

    const nestingItems = [
      ...resolvedPieces.map((p) => {
        const pieceMat = materials.find((m) => m.id === p.materialId);
        return {
          id: p.id,
          pieceId: p.id,
          materialId: p.materialId,
          cutWidthMm: p.cutDimensionsMm.width,
          cutHeightMm: p.cutDimensionsMm.height,
          canRotate: pieceMat ? !pieceMat.hasGrain : !activeMaterial.hasGrain,
          isAuxiliary: p.isAuxiliary,
        };
      }),
      ...gaugePieces,
    ];

    const nesting = runMultiMaterialGuillotineNesting({
      items: nestingItems,
      sheetLookup: (matId) => {
        const mat = materials.find((m) => m.id === matId) ?? activeMaterial;
        const sLen = typeof mat.sheetSizeMm.length === 'number' ? mat.sheetSizeMm.length : 2800;
        const sWid = typeof mat.sheetSizeMm.width === 'number' ? mat.sheetSizeMm.width : 2070;
        return {
          materialId: mat.id,
          lengthMm: sLen,
          widthMm: sWid,
          sawKerfMm: projectConfig?.nesting.sawKerfMm,
          trimMarginMm: projectConfig?.nesting.sheetTrimMarginMm,
        };
      },
      optimizationGoal: projectConfig?.nesting.optimizationGoal,
    });

    const doc = exportCutPlanPdf(nesting, `Plano de Corte - ${currentModule?.id ?? 'Módulo'}`);
    const pdfBlob = doc.output('blob');
    const fileName = `plano-corte-${currentModule?.id ?? 'modulo'}.pdf`;
    triggerBrowserDownload(fileName, pdfBlob, 'application/pdf');
    setStatusMessage(`Plano de corte (nesting) exportado a ${fileName}.`);
  }, [resolvedPieces, activeMaterial, currentModule, projectConfig, assemblySheet]);

  // Export sequential assembly guide as PDF
  const exportAssemblyPdf = useCallback(() => {
    if (selectedTemplateId === 'wall-shelves' && wallShelvingOutput && wallShelvingDefinition) {
      const doc = exportWallShelvesInstallationPdf(
        wallShelvingOutput,
        wallShelvingDefinition,
        `Plano de Replanteo en Pared - ${currentModule?.id ?? 'Estantería'}`,
      );
      const pdfBlob = doc.output('blob');
      const fileName = `plano-replanteo-pared-${currentModule?.id ?? 'estanteria'}.pdf`;
      triggerBrowserDownload(fileName, pdfBlob, 'application/pdf');
      setStatusMessage(`Plano de replanteo en pared exportado a ${fileName}.`);
      return;
    }
    if (!assemblySheet) return;
    const doc = exportAssemblyGuidePdf(assemblySheet, `Guía de Armado - ${currentModule?.id ?? 'Módulo'}`);
    const pdfBlob = doc.output('blob');
    const fileName = `guia-armado-${currentModule?.id ?? 'modulo'}.pdf`;
    triggerBrowserDownload(fileName, pdfBlob, 'application/pdf');
    setStatusMessage(`Guía de armado exportada a ${fileName}.`);
  }, [selectedTemplateId, wallShelvingOutput, wallShelvingDefinition, assemblySheet, currentModule]);

  // Export technical countertop / marmoleria drawing as PDF
  const exportMarmoleriaPdfReport = useCallback(() => {
    if (!countertopCalculation) return;
    const doc = exportMarmoleriaPdf(
      countertopCalculation,
      `Plano de Marmolería — ${currentModule?.id ?? 'Mesada'}`,
    );
    const pdfBlob = doc.output('blob');
    const fileName = `plano-marmoleria-${currentModule?.id ?? 'mesada'}.pdf`;
    triggerBrowserDownload(fileName, pdfBlob, 'application/pdf');
    setStatusMessage(`Plano de marmolería exportado a ${fileName}.`);
  }, [countertopCalculation, currentModule]);


  // Export workshop machining sheets as PDF (single piece or full module)
  const exportMachiningPdf = useCallback(
    (pieceId?: string) => {
      if (machiningSheets.length === 0) return;
      const targetSheets = pieceId
        ? machiningSheets.filter((s) => s.pieceId === pieceId)
        : machiningSheets;
      if (targetSheets.length === 0) return;

      const doc = exportMachiningSheetPdf(
        targetSheets,
        pieceId
          ? `Plano de Mecanizado - ${pieceId}`
          : `Planos de Mecanizado - ${currentModule?.id ?? 'Módulo'}`,
      );
      const pdfBlob = doc.output('blob');
      const fileName = pieceId
        ? `mecanizado-${pieceId}.pdf`
        : `mecanizado-${currentModule?.id ?? 'modulo'}.pdf`;
      triggerBrowserDownload(fileName, pdfBlob, 'application/pdf');
      setStatusMessage(`Planos de mecanizado exportados a ${fileName}.`);
    },
    [machiningSheets, currentModule],
  );

  // Export workshop machining sheets as AutoCAD R12 DXF (single piece or full module)
  const exportMachiningDxf = useCallback(
    (pieceId?: string) => {
      if (machiningSheets.length === 0) return;
      if (pieceId) {
        const targetSheet = machiningSheets.find((s) => s.pieceId === pieceId);
        if (!targetSheet) return;
        const dxfContent = exportMachiningSheetToDxf(targetSheet, {
          face: 'face-A',
          includeGrooveCenterline: true,
        });
        const fileName = `${targetSheet.pieceId}-face-A.dxf`;
        triggerBrowserDownload(fileName, dxfContent, 'application/dxf');
        setStatusMessage(`Archivo DXF exportado: ${fileName}`);
      } else {
        for (const sheet of machiningSheets) {
          const dxfContent = exportMachiningSheetToDxf(sheet, {
            face: 'face-A',
            includeGrooveCenterline: true,
          });
          const fileName = `${sheet.pieceId}-face-A.dxf`;
          triggerBrowserDownload(fileName, dxfContent, 'application/dxf');
        }
        setStatusMessage(`Se exportaron ${machiningSheets.length} archivos DXF.`);
      }
    },
    [machiningSheets],
  );

  // Update in-memory project configuration
  const updateProjectConfig = useCallback((newConfig: ProjectConfig) => {
    setProjectConfig(newConfig);
  }, []);

  // Save project configuration to IndexedDB
  const saveProjectConfig = useCallback(async () => {
    if (!projectConfig) return;
    try {
      setIsSaving(true);
      await saveProjectConfigToDb(projectConfig);
      setStatusMessage(`Configuración del proyecto "${projectConfig.projectName}" guardada.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar la configuración');
    } finally {
      setIsSaving(false);
    }
  }, [projectConfig]);

  // Import configuration JSON file
  const importProjectConfigFile = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const parsed = importProjectConfigJson(text);
      setProjectConfig(parsed);
      await saveProjectConfigToDb(parsed);
      setStatusMessage(`Configuración importada exitosamente desde ${file.name}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al importar archivo de configuración');
    }
  }, []);

  // Export configuration as JSON file
  const exportProjectConfigFile = useCallback(() => {
    if (!projectConfig) return;
    const jsonStr = exportProjectConfigJson(projectConfig);
    const fileName = `${projectConfig.projectId}-config.json`;
    triggerBrowserDownload(fileName, jsonStr, 'application/json');
    setStatusMessage(`Configuración exportada a ${fileName}.`);
  }, [projectConfig]);

  // Reset configuration to base file defaults
  const resetProjectConfigToDefaults = useCallback(async () => {
    try {
      const defConfig = getDefaultProjectConfig();
      const currentId = projectConfig?.projectId ?? DEFAULT_PROJECT_ID;
      const resetConfig: ProjectConfig = { ...defConfig, projectId: currentId };
      setProjectConfig(resetConfig);
      await saveProjectConfigToDb(resetConfig);
      setStatusMessage('Configuración restaurada a los valores predeterminados del archivo.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al restablecer configuración');
    }
  }, [projectConfig]);

  const jointStrategy = projectConfig?.machining?.jointStrategy ?? 'confirmat';
  const setJointStrategy = useCallback((strategy: JointStrategy) => {
    setProjectConfig((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        machining: {
          ...prev.machining,
          jointStrategy: strategy,
        },
      };
    });
  }, []);

  return {
    width,
    height,
    depth,
    selectedTemplateId,
    templates,
    userTemplates,
    saveCurrentUserTemplate,
    deleteUserTemplate,
    saveMaterial,
    deleteMaterial,
    saveEdgeBand,
    deleteEdgeBand,
    saveHardware,
    deleteHardware,
    resetCatalogs,
    pieceJointOverrides,
    setPieceJointOverride,
    selectedMaterialId,
    selectedEdgeBandId,
    materials,
    edgeBands,
    hardware,
    isLoading,
    isSaving,
    statusMessage,
    error,
    currentModule,
    resolvedPieces,
    bom,
    cost,
    activeTab,
    selectedPieceId,
    explodedRatio,
    spatialBoxes: spatialData.boxes,
    spatialBounds: spatialData.bounds,
    machiningOperations,
    pieceMachiningList,
    machiningSheets,
    selectedMachiningPieceId,
    assemblySheet,
    shelfDeflections,
    shelfDeflectionWarnings,
    projectConfig,
    isCustomModular,
    roofType,
    jointPriority,
    hasBacking,
    gridType,
    bays,
    activeBayIndex,
    frontsMaterialId,
    drawerBoxesMaterialId,
    backingsMaterialId,
    setWidth,
    setHeight,
    setDepth,
    setSelectedTemplateId: handleSelectTemplate,
    setSelectedMaterialId,
    setSelectedEdgeBandId,
    setActiveTab,
    setSelectedPieceId,
    setSelectedMachiningPieceId,
    setExplodedRatio,
    setRoofType,
    setJointPriority,
    setHasBacking,
    setGridType,
    setActiveBayIndex,
    setBayContentType,
    addShelf,
    removeShelf,
    setShelfType,
    setShelfAntiSag,
    addDrawer,
    removeDrawer,
    setDrawerFrontMount,
    setDrawerSlideType,
    setDrawerDistributionPreset,
    setDrawerTopHeight,
    setDrawerTrack,
    setDrawerTracks,
    setDrawerGap,
    setDrawerTransoms,
    setDrawerType,
    setDrawerBottomMount,
    setDrawerTopPullGap,
    setDrawerBoxSideHeightOffset,
    setDoorCount,
    setDoorMountType,
    setDoorInteriorShelvesCount,
    setDoorShelfType,
    setBifoldDirection,
    backingType,
    backingThicknessMm,
    isIslandCabinet,
    rearStructuralRails,
    rearStructuralRailsWidthMm,
    setBackingType,
    setBackingThicknessMm,
    setIsIslandCabinet,
    setRearStructuralRails,
    setRearStructuralRailsWidthMm,
    setFrontsMaterialId,
    setDrawerBoxesMaterialId,
    setBackingsMaterialId,
    jointStrategy,
    setJointStrategy,
    saveModule,
    loadModule,
    exportCsv,
    exportPdf,
    exportMachiningPdf,
    exportMachiningDxf,
    exportAssemblyPdf,
    updateProjectConfig,
    saveProjectConfig,
    importProjectConfigFile,
    exportProjectConfigFile,
    resetProjectConfigToDefaults,
    railOrientation,
    hasMiddleBrace,
    middleBraceWidthMm,
    hasWallHangingRail,
    wallHangingRailWidthMm,
    hasPlinth,
    plinthHeightMm,
    plinthSetbackMm,
    setRailOrientation,
    setHasMiddleBrace,
    setMiddleBraceWidthMm,
    setHasWallHangingRail,
    setWallHangingRailWidthMm,
    setHasPlinth,
    setPlinthHeightMm,
    setPlinthSetbackMm,
    pieceMaterialOverrides,
    pieceThicknessOverrides,
    pieceEdgeBandOverrides,
    setPieceMaterial,
    setPieceThickness,
    setPieceEdgeBands,
    customPieceOperations,
    addCustomPieceOperation,
    removeCustomPieceOperation,
    kinematicsState,
    kinematicMechanisms,
    kinematicBoxes,
    setMechanismOpenRatio,
    wallShelvesBracketType,
    wallShelvesWallType,
    wallShelvesLoadCategory,
    wallShelvesBoundaryCondition,
    wallShelvesOverhangMode,
    wallShelvesShelfCount,
    wallShelvesVerticalSpacingMm,
    wallShelvesBaseElevationYMm,
    wallShelvingDefinition,
    wallShelvingOutput,
    setWallShelvesBracketType,
    setWallShelvesWallType,
    setWallShelvesLoadCategory,
    setWallShelvesBoundaryCondition,
    setWallShelvesOverhangMode,
    setWallShelvesShelfCount,
    setWallShelvesVerticalSpacingMm,
    setWallShelvesBaseElevationYMm,
    // Countertop & Equipment
    countertopEnabled,
    countertopMaterialId,
    countertopMaterials: DEFAULT_COUNTERTOP_MATERIALS,
    equipmentCatalog: DEFAULT_EQUIPMENT_ITEMS,
    selectedEquipmentId,
    countertopFrontOverhangMm,
    countertopEdgeFinish,
    countertopHasBacksplash,
    countertopBacksplashHeightMm,
    sinkDrawerAdaptation,
    countertopFrontRailOrientation,
    countertopDefinition,
    countertopCalculation,
    setCountertopEnabled,
    setCountertopMaterialId,
    setSelectedEquipmentId,
    setCountertopFrontOverhangMm,
    setCountertopEdgeFinish,
    setCountertopHasBacksplash,
    setCountertopBacksplashHeightMm,
    setSinkDrawerAdaptation,
    setCountertopFrontRailOrientation,
    exportMarmoleriaPdfReport,
  };
}
