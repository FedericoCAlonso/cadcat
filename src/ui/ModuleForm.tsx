import { useState, useMemo, useEffect, type ReactElement } from 'react';
import type { Material, EdgeBand, JointStrategy, JointKind, Project, ProjectModuleItem, ColumnObstacle, FalseSquare } from '../model';
import type {
  TemplateDefinition,
  RoofType,
  JointPriority,
  BackingType,
  RearStructuralRails,
  BayContent,
  DrawerSlideType,
  DrawerFrontMount,
  DrawerType,
  DrawerBottomMount,
  DoorMountType,
  TrackSize,
  BayBoundingBox,
  BracketType,
  WallType,
  LoadCategory,
  BoundaryCondition,
  OverhangMode,
  WallShelvingOutput,
  PieceEdgeBandOverride,
  ResolvedPieceWithCutSize,
  KinematicMechanism,
  ShelfDeflectionResult,
  BillOfMaterials,
  ModuleCostSummary,
  PieceMachiningSheet,
} from '../resolver';
import { resolveTracks } from '../resolver';
import { translateTemplateName, t } from './localization';
import { NumericInput } from './NumericInput';
import { BayDistributionModal } from './BayDistributionModal';
import { DEFAULT_UI_CONFIG } from '../config';
import { useOneHandDevice, ONE_HAND_MOBILE_MAX_WIDTH_PX } from './useOneHandDevice';
import { PieceInspectorCard } from './PieceInspectorCard';
import { WallShelvesSection } from './WallShelvesSection';
import { StructureSection } from './StructureSection';
import { InterferencesSection } from './InterferencesSection';
import { DistributionSection } from './DistributionSection';
import { InteriorSection } from './InteriorSection';
import { MaterialsSection } from './MaterialsSection';
import { PanelStickyHeader } from './PanelStickyHeader';
import { ModuleBar } from './ModuleBar';
import { ScrollFadeTabs } from './ScrollFadeTabs';
import { Accordion } from './Accordion';
import { PanelSummaryFooter } from './PanelSummaryFooter';

export type FormSection = 'dimensions' | 'structure' | 'distribution' | 'interior' | 'materials' | 'interferences' | 'all';

function useIsMobileDevice(maxWidth = ONE_HAND_MOBILE_MAX_WIDTH_PX): boolean {
  const isOneHand = useOneHandDevice();
  const [isNarrow, setIsNarrow] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= maxWidth;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => {
      setIsNarrow(window.innerWidth <= maxWidth);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [maxWidth]);

  return isOneHand || isNarrow;
}

function safeScrollToTop(): void {
  if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
    if (typeof window.navigator !== 'undefined' && window.navigator.userAgent?.includes('jsdom')) {
      return;
    }
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // JSDOM or environments without full scrollTo support
    }
  }
}

export interface ModuleFormProps {
  // Multi-Module Project Management
  project?: Project | null;
  projectModules?: ProjectModuleItem[];
  activeModuleId?: string;
  onSetActiveModule?: (moduleId: string) => void;
  onAddProjectModule?: (name?: string, templateId?: string) => void;
  onDuplicateProjectModule?: (moduleId: string) => void;
  onRemoveProjectModule?: (moduleId: string) => void;
  onUpdateProjectModuleQuantity?: (moduleId: string, quantity: number) => void;
  onUpdateProjectModuleName?: (moduleId: string, name: string) => void;
  onSaveProject?: () => Promise<void> | void;
  projectScope?: 'current-module' | 'all-modules';
  onProjectScopeChange?: (scope: 'current-module' | 'all-modules') => void;

  width?: number;
  height?: number;
  depth?: number;
  templates?: TemplateDefinition[];
  selectedTemplateId?: string;
  materials?: Material[];
  /** Standard sheet thicknesses (mm) offered first in thickness selectors. */
  standardThicknessesMm?: readonly number[];
  edgeBands?: EdgeBand[];
  selectedMaterialId?: string;
  selectedEdgeBandId?: string;
  jointStrategy?: JointStrategy;
  isSaving?: boolean;
  onWidthChange?: (val: number) => void;
  onHeightChange?: (val: number) => void;
  onDepthChange?: (val: number) => void;
  onTemplateChange?: (id: string) => void;
  onMaterialChange?: (id: string) => void;
  onEdgeBandChange?: (id: string) => void;
  onSave?: () => void;
  onExportCsv?: () => void;
  onExportPdf?: () => void;
  // Production summary and debounced costing (Stage 4)
  bom?: BillOfMaterials | null;
  consolidatedBom?: BillOfMaterials | null;
  cost?: ModuleCostSummary | null;
  consolidatedCost?: ModuleCostSummary | null;
  isCostCalculating?: boolean;
  // Modular builder state & actions
  isCustomModular?: boolean;
  roofType?: RoofType;
  jointPriority?: JointPriority;
  hasBacking?: boolean;
  gridType?: '1-bay' | '2-bays-vertical' | '3-bays-vertical' | '2-bays-horizontal';
  bayTracks?: TrackSize[];
  bayBoxes?: BayBoundingBox[];
  bays?: BayContent[];
  activeBayIndex?: number;
  frontsMaterialId?: string;
  drawerBoxesMaterialId?: string;
  backingsMaterialId?: string;
  onRoofTypeChange?: (roof: RoofType) => void;
  onJointPriorityChange?: (priority: JointPriority) => void;
  onHasBackingChange?: (hasBacking: boolean) => void;
  onGridTypeChange?: (gridType: '1-bay' | '2-bays-vertical' | '3-bays-vertical' | '2-bays-horizontal') => void;
  onBayTracksChange?: (tracks: TrackSize[]) => void;
  onActiveBayIndexChange?: (idx: number) => void;
  onBayContentTypeChange?: (
    bayIndex: number,
    type: 'empty' | 'shelves' | 'drawer-stack' | 'doors' | 'pull-out-tray' | 'bi-fold-closure' | 'subdivided',
  ) => void;
  onBayContentChange?: (bayIndex: number, content: BayContent) => void;
  onSubdividedAxisChange?: (bayIndex: number, axis: 'horizontal' | 'vertical') => void;
  onSubdividedTracksChange?: (bayIndex: number, tracks: TrackSize[]) => void;
  onSubdividedThicknessChange?: (bayIndex: number, thicknessMm: number) => void;
  onSubdividedJointTypeChange?: (bayIndex: number, jointType: 'dado-groove' | 'confirmat') => void;
  onSubdividedMaterialChange?: (bayIndex: number, materialId: string) => void;
  onSubdividedCellContentChange?: (bayIndex: number, cellIndex: number, content: BayContent) => void;
  onAddShelf?: (bayIndex: number) => void;
  onRemoveShelf?: (bayIndex: number) => void;
  onShelfTypeChange?: (bayIndex: number, type: 'adjustable' | 'fixed') => void;
  onShelfAntiSagChange?: (bayIndex: number, hasAntiSag: boolean) => void;
  onShelfTracksChange?: (bayIndex: number, tracks: TrackSize[]) => void;
  onShelfHasDoorsChange?: (bayIndex: number, hasDoors: boolean) => void;
  onShelfDoorCountChange?: (bayIndex: number, count: 1 | 2) => void;
  onShelfDoorMountTypeChange?: (bayIndex: number, mount: DoorMountType) => void;
  onShelfDoorHingeSideChange?: (bayIndex: number, hingeSide: 'left' | 'right') => void;
  onAddDrawer?: (bayIndex: number) => void;
  onRemoveDrawer?: (bayIndex: number) => void;
  onDrawerFrontMountChange?: (bayIndex: number, mount: DrawerFrontMount) => void;
  onDrawerSlideTypeChange?: (bayIndex: number, slide: DrawerSlideType) => void;
  onDrawerSlideClearanceChange?: (bayIndex: number, clearanceMm: number) => void;
  onDrawerTracksChange?: (bayIndex: number, tracks: TrackSize[]) => void;
  onDrawerGapChange?: (bayIndex: number, gapMm: number) => void;
  onDrawerTransomsChange?: (bayIndex: number, hasTransoms: boolean) => void;
  partitionPassThroughRoof?: boolean;
  onPartitionPassThroughRoofChange?: (val: boolean) => void;
  structuralSpanWarnings?: string[];
  maxDrawerSpanMm?: number;
  onDrawerTypeChange?: (bayIndex: number, type: DrawerType) => void;
  onDrawerBottomMountChange?: (bayIndex: number, mount: DrawerBottomMount) => void;
  onDrawerTopPullGapChange?: (bayIndex: number, gapMm: number) => void;
  onDrawerBoxSideHeightOffsetChange?: (bayIndex: number, offsetMm: number) => void;
  onDoorCountChange?: (bayIndex: number, count: 1 | 2) => void;
  onDoorMountTypeChange?: (bayIndex: number, mount: DoorMountType) => void;
  onBifoldDirectionChange?: (bayIndex: number, dir: 'vertical-lift' | 'horizontal-book') => void;
  onFrontsMaterialChange?: (id: string) => void;
  onDrawerBoxesMaterialChange?: (id: string) => void;
  onBackingsMaterialChange?: (id: string) => void;
  onJointStrategyChange?: (strategy: JointStrategy) => void;
  onView3dClick?: () => void;
  onSwitchToSiteMode?: () => void;
  onSaveUserTemplate?: (name: string, description?: string) => Promise<void> | void;
  onDeleteUserTemplate?: (id: string) => Promise<void> | void;
  // Base structure & reinforcement props (Point 7)
  railOrientation?: 'horizontal' | 'vertical';
  hasMiddleBrace?: boolean;
  middleBraceWidthMm?: number;
  hasWallHangingRail?: boolean;
  wallHangingRailWidthMm?: number;
  hasPlinth?: boolean;
  plinthHeightMm?: number;
  plinthSetbackMm?: number;
  onRailOrientationChange?: (val: 'horizontal' | 'vertical') => void;
  onHasMiddleBraceChange?: (val: boolean) => void;
  onMiddleBraceWidthChange?: (val: number) => void;
  onHasWallHangingRailChange?: (val: boolean) => void;
  onWallHangingRailWidthChange?: (val: number) => void;
  onHasPlinthChange?: (val: boolean) => void;
  onPlinthHeightChange?: (val: number) => void;
  onPlinthSetbackChange?: (val: number) => void;
  // Door interior shelves (Point 3)
  onDoorInteriorShelvesCountChange?: (bayIndex: number, count: number) => void;
  onDoorShelfTypeChange?: (bayIndex: number, shelfType: 'adjustable' | 'fixed') => void;
  // Backing, Island & Rear Rails (Points 4, 5, 6)
  backingType?: BackingType;
  backingThicknessMm?: number;
  isIslandCabinet?: boolean;
  rearStructuralRails?: RearStructuralRails;
  rearStructuralRailsWidthMm?: number;
  onBackingTypeChange?: (val: BackingType) => void;
  onBackingThicknessChange?: (val: number) => void;
  onIsIslandCabinetChange?: (val: boolean) => void;
  onRearStructuralRailsChange?: (val: RearStructuralRails) => void;
  onRearStructuralRailsWidthChange?: (val: number) => void;
  // Architectural Interferences Lab (Hito 2)
  enableInterferencesLab?: boolean;
  /** Whether the architectural interferences section and controls are visible in the UI. */
  showInterferences?: boolean;
  columnObstacle?: ColumnObstacle;
  falseSquare?: FalseSquare;
  onColumnObstacleChange?: (col: ColumnObstacle) => void;
  onFalseSquareChange?: (fs: FalseSquare) => void;
  // Wall Shelves props
  wallShelvesBracketType?: BracketType;
  wallShelvesWallType?: WallType;
  wallShelvesLoadCategory?: LoadCategory;
  wallShelvesBoundaryCondition?: BoundaryCondition;
  wallShelvesOverhangMode?: OverhangMode;
  wallShelvesShelfCount?: number;
  wallShelvesVerticalSpacingMm?: number;
  wallShelvesBaseElevationYMm?: number;
  wallShelvingOutput?: WallShelvingOutput | null;
  onWallShelvesBracketTypeChange?: (type: BracketType) => void;
  onWallShelvesWallTypeChange?: (type: WallType) => void;
  onWallShelvesLoadCategoryChange?: (cat: LoadCategory) => void;
  onWallShelvesBoundaryConditionChange?: (cond: BoundaryCondition) => void;
  onWallShelvesOverhangModeChange?: (mode: OverhangMode) => void;
  onWallShelvesShelfCountChange?: (count: number) => void;
  onWallShelvesVerticalSpacingMmChange?: (spacing: number) => void;
  onWallShelvesBaseElevationYMmChange?: (elev: number) => void;
  onViewAssemblyClick?: () => void;
  // Piece Inspector
  activePieceId?: string | null;
  onSelectPiece?: (pieceId: string | null) => void;
  pieces?: ResolvedPieceWithCutSize[];
  pieceMaterialOverrides?: Record<string, string>;
  pieceThicknessOverrides?: Record<string, number>;
  pieceEdgeBandOverrides?: Record<string, PieceEdgeBandOverride>;
  pieceJointOverrides?: Record<string, JointKind>;
  onSetPieceMaterial?: (pieceId: string, materialId: string | null) => void;
  onSetPieceThickness?: (pieceId: string, thicknessMm: number | null) => void;
  onSetPieceEdgeBands?: (pieceId: string, overrides: PieceEdgeBandOverride | null) => void;
  onSetPieceJointOverride?: (pieceId: string, jointKind: JointKind | null) => void;
  onOpenMachiningModal?: (pieceId: string) => void;
  kinematicMechanisms?: KinematicMechanism[];
  kinematicsState?: Record<string, number>;
  onMechanismOpenRatioChange?: (mechanismId: string, ratio: number) => void;
  shelfDeflections?: Map<string, ShelfDeflectionResult>;
  machiningSheets?: PieceMachiningSheet[];
  isMobile?: boolean;
}

/**
 * Module configuration form component with Argentine Spanish localization and M3 styles.
 * Supports interactive builder controls: drawers, shelves, covers, doors, partitions, and roofs.
 */
export function ModuleForm(props: ModuleFormProps): ReactElement {
  const {
    project,
    projectModules,
    activeModuleId,
    onSetActiveModule,
    onAddProjectModule,
    onDuplicateProjectModule,
    onRemoveProjectModule,
    onUpdateProjectModuleQuantity,
    onUpdateProjectModuleName,
    onSaveProject,
    projectScope = 'current-module',
    onProjectScopeChange,
    width = 600,
    height = 720,
    depth = 560,
    templates,
    selectedTemplateId,
    materials = [],
    standardThicknessesMm,
    edgeBands = [],
    selectedMaterialId = '',
    selectedEdgeBandId = '',
    jointStrategy = 'confirmat',
    isSaving = false,
    onWidthChange = () => {},
    onHeightChange = () => {},
    onDepthChange = () => {},
    onTemplateChange,
    onMaterialChange = () => {},
    onEdgeBandChange = () => {},
    onSave = () => {},
    onExportCsv,
    onExportPdf,
    bom,
    consolidatedBom,
    cost,
    consolidatedCost,
    isCostCalculating = false,
    onSaveUserTemplate,
    onDeleteUserTemplate,
    roofType = 'front-back-rails',
    jointPriority = 'lateral-over-bottom',
    hasBacking = true,
    gridType = '1-bay',
    bayTracks,
    bayBoxes = [],
    bays = [{ type: 'shelves', count: 1, shelfType: 'adjustable', setbackMm: 20 }],
    activeBayIndex = 0,
    frontsMaterialId = '',
    drawerBoxesMaterialId = '',
    backingsMaterialId = '',
    onRoofTypeChange,
    onJointPriorityChange,
    onHasBackingChange,
    onGridTypeChange,
    onBayTracksChange,
    onActiveBayIndexChange,
    onBayContentTypeChange,
    onBayContentChange,
    onSubdividedAxisChange: _onSubdividedAxisChange,
    onSubdividedTracksChange: _onSubdividedTracksChange,
    onSubdividedThicknessChange: _onSubdividedThicknessChange,
    onSubdividedJointTypeChange: _onSubdividedJointTypeChange,
    onSubdividedMaterialChange: _onSubdividedMaterialChange,
    onSubdividedCellContentChange: _onSubdividedCellContentChange,
    onAddShelf,
    onRemoveShelf,
    onShelfTypeChange,
    onShelfAntiSagChange,
    onShelfTracksChange,
    onShelfHasDoorsChange,
    onShelfDoorCountChange,
    onShelfDoorMountTypeChange,
    onShelfDoorHingeSideChange,
    onAddDrawer,
    onRemoveDrawer,
    onDrawerFrontMountChange,
    onDrawerSlideTypeChange,
    onDrawerSlideClearanceChange,
    onDrawerTracksChange,
    onDrawerGapChange,
    onDrawerTransomsChange,
    partitionPassThroughRoof = false,
    onPartitionPassThroughRoofChange,
    structuralSpanWarnings = [],
    maxDrawerSpanMm = 900,
    onDrawerTypeChange,
    onDrawerBottomMountChange,
    onDrawerTopPullGapChange,
    onDrawerBoxSideHeightOffsetChange,
    onDoorCountChange,
    onDoorMountTypeChange,
    onBifoldDirectionChange,
    onFrontsMaterialChange,
    onDrawerBoxesMaterialChange,
    onBackingsMaterialChange,
    onJointStrategyChange,
    onView3dClick,
    onSwitchToSiteMode,
    railOrientation = 'horizontal',
    hasMiddleBrace = false,
    middleBraceWidthMm = 80,
    hasWallHangingRail = false,
    wallHangingRailWidthMm = 100,
    hasPlinth = false,
    plinthHeightMm = 100,
    plinthSetbackMm = 50,
    onRailOrientationChange,
    onHasMiddleBraceChange,
    onMiddleBraceWidthChange,
    onHasWallHangingRailChange,
    onWallHangingRailWidthChange,
    onHasPlinthChange,
    onPlinthHeightChange,
    onPlinthSetbackChange,
    onDoorInteriorShelvesCountChange,
    onDoorShelfTypeChange,
    backingType = 'groove',
    backingThicknessMm = 3,
    isIslandCabinet = false,
    rearStructuralRails = 'none',
    rearStructuralRailsWidthMm = 80,
    onBackingTypeChange,
    onBackingThicknessChange,
    onIsIslandCabinetChange,
    onRearStructuralRailsChange,
    onRearStructuralRailsWidthChange,
    enableInterferencesLab: _enableInterferencesLab = false,
    showInterferences = DEFAULT_UI_CONFIG.showInterferences,
    columnObstacle,
    falseSquare,
    onColumnObstacleChange,
    onFalseSquareChange,
    wallShelvesBracketType = 'l-bracket',
    wallShelvesWallType = 'solid-brick',
    wallShelvesLoadCategory = 'medium',
    wallShelvesBoundaryCondition = 'free-ends',
    wallShelvesOverhangMode = 'balanced-cantilever',
    wallShelvesShelfCount = 3,
    wallShelvesVerticalSpacingMm = 320,
    wallShelvesBaseElevationYMm = 800,
    wallShelvingOutput,
    onWallShelvesBracketTypeChange,
    onWallShelvesWallTypeChange,
    onWallShelvesLoadCategoryChange,
    onWallShelvesBoundaryConditionChange,
    onWallShelvesOverhangModeChange,
    onWallShelvesShelfCountChange,
    onWallShelvesVerticalSpacingMmChange,
    onWallShelvesBaseElevationYMmChange,
    onViewAssemblyClick,
    activePieceId,
    onSelectPiece,
    pieces = [],
    pieceMaterialOverrides,
    pieceThicknessOverrides,
    pieceEdgeBandOverrides,
    pieceJointOverrides,
    onSetPieceMaterial,
    onSetPieceThickness,
    onSetPieceEdgeBands,
    onSetPieceJointOverride,
    onOpenMachiningModal,
    kinematicMechanisms,
    kinematicsState,
    onMechanismOpenRatioChange,
    shelfDeflections,
    isMobile: isMobileProp,
  } = props;

  const isWallShelves = selectedTemplateId === 'wall-shelves';

  const currentBayCount =
    bayBoxes.length > 0
      ? bayBoxes.length
      : bayTracks && bayTracks.length > 0
      ? bayTracks.length
      : gridType === '3-bays-vertical'
      ? 3
      : gridType === '1-bay'
      ? 1
      : 2;
  const currentActiveIndex = Math.min(activeBayIndex, currentBayCount - 1);
  const activeBay = bays[currentActiveIndex] ?? { type: 'empty' };

  const rawThickness = materials?.find((m) => m.id === selectedMaterialId)?.thicknessMm;
  const matThickness = typeof rawThickness === 'number' ? rawThickness : 18;
  const estimatedBayCavityHeight = Math.max(
    100,
    Math.round(
      gridType === '2-bays-horizontal'
        ? (height - 3 * matThickness) / 2
        : roofType === 'solid-panel'
        ? height - 2 * matThickness
        : height - matThickness,
    ),
  );

  const activeBayBox = bayBoxes[currentActiveIndex];
  const activeBayWidth = activeBayBox?.width ?? Math.max(100, Math.round(width - 2 * matThickness));
  const activeBayHeight = activeBayBox?.height ?? estimatedBayCavityHeight;
  const activeBayDepth = activeBayBox?.depth ?? Math.max(100, Math.round(depth - 20));

  const resolvedDrawerHeights = (() => {
    if (activeBay.type !== 'drawer-stack' || !activeBay.drawerTracks || activeBay.drawerTracks.length === 0) {
      return [];
    }
    const useTransoms = Boolean(activeBay.hasTransomDividers && activeBay.frontMount === 'inset');
    const res = resolveTracks(
      estimatedBayCavityHeight,
      activeBay.drawerTracks,
      useTransoms ? matThickness : 0,
    );
    return res.tracks.map((t) => t.sizeMm);
  })();

  const resolvedShelfHeights = (() => {
    if (activeBay.type !== 'shelves') {
      return [];
    }
    const count = activeBay.count ?? 1;
    const tracks =
      activeBay.shelfTracks && activeBay.shelfTracks.length > 1
        ? activeBay.shelfTracks
        : Array.from({ length: Math.max(1, count) + 1 }, () => ({ type: 'fractional' as const, valueFr: 1 }));
    const res = resolveTracks(estimatedBayCavityHeight, tracks, matThickness);
    return res.tracks.map((t) => t.sizeMm);
  })();

  const shelfQuickRecipes = useMemo(
    () => [
      {
        label: '1 estante (Iguales)',
        tracks: [
          { type: 'fractional', valueFr: 1 },
          { type: 'fractional', valueFr: 1 },
        ] as TrackSize[],
      },
      {
        label: '2 estantes (Iguales)',
        tracks: [
          { type: 'fractional', valueFr: 1 },
          { type: 'fractional', valueFr: 1 },
          { type: 'fractional', valueFr: 1 },
        ] as TrackSize[],
      },
      {
        label: '3 estantes (Iguales)',
        tracks: [
          { type: 'fractional', valueFr: 1 },
          { type: 'fractional', valueFr: 1 },
          { type: 'fractional', valueFr: 1 },
          { type: 'fractional', valueFr: 1 },
        ] as TrackSize[],
      },
      {
        label: 'Abajo grande (350mm)',
        tracks: [
          { type: 'fixed', valueMm: 350 },
          { type: 'fractional', valueFr: 1 },
          { type: 'fractional', valueFr: 1 },
        ] as TrackSize[],
      },
      {
        label: 'Arriba grande (350mm)',
        tracks: [
          { type: 'fractional', valueFr: 1 },
          { type: 'fractional', valueFr: 1 },
          { type: 'fixed', valueMm: 350 },
        ] as TrackSize[],
      },
    ],
    [],
  );

  const selectedPiece = useMemo(() => {
    if (!activePieceId || !pieces) return null;
    return pieces.find((p) => p.id === activePieceId) ?? null;
  }, [activePieceId, pieces]);

  const pieceMech = useMemo(() => {
    if (!selectedPiece || !kinematicMechanisms) return null;
    return kinematicMechanisms.find((m) => m.pieceIds.includes(selectedPiece.id)) ?? null;
  }, [selectedPiece, kinematicMechanisms]);

  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const detectedMobile = useIsMobileDevice();
  const isMobileDevice = isMobileProp ?? detectedMobile;

  // Accordion and Anchor State
  const [openSection, setOpenSection] = useState<FormSection | null>('dimensions');
  const [isAllExpanded, setIsAllExpanded] = useState<boolean>(false);

  const sectionsList = useMemo(() => {
    if (isWallShelves) {
      return [
        { id: 'dimensions' as FormSection, label: 'Medidas y Ménsulas', icon: '📏' },
        { id: 'materials' as FormSection, label: 'Materiales', icon: '🎨' },
      ];
    }
    return [
      { id: 'dimensions' as FormSection, label: 'Medidas y Plantilla', icon: '📏' },
      { id: 'structure' as FormSection, label: 'Estructura', icon: '🏗️' },
      { id: 'distribution' as FormSection, label: 'Vanos', icon: '🔲' },
      { id: 'interior' as FormSection, label: 'Interior', icon: '🚪' },
      { id: 'materials' as FormSection, label: 'Materiales', icon: '🎨' },
      ...(showInterferences ? [{ id: 'interferences' as FormSection, label: 'Interferencias', icon: '📐' }] : []),
    ];
  }, [isWallShelves, showInterferences]);

  // Section index for mobile step navigation
  const currentStepIndex = sectionsList.findIndex((s) => s.id === openSection);
  const prevStep = currentStepIndex > 0 ? sectionsList[currentStepIndex - 1] : null;
  const nextStep =
    currentStepIndex >= 0 && currentStepIndex < sectionsList.length - 1
      ? sectionsList[currentStepIndex + 1]
      : null;

  const currentSectionTitle = useMemo(() => {
    if (isAllExpanded) return 'Todas las Secciones';
    if (!openSection) return 'Parámetros CAD';
    const found = sectionsList.find((s) => s.id === openSection);
    return found ? found.label : 'Medidas y Armado';
  }, [isAllExpanded, openSection, sectionsList]);

  const handleToggleSection = (sectionId: FormSection) => {
    if (isAllExpanded) {
      setIsAllExpanded(false);
      setOpenSection(sectionId);
    } else {
      setOpenSection((prev) => (prev === sectionId ? null : sectionId));
    }
  };

  const handleSelectTab = (sectionId: FormSection) => {
    setOpenSection(sectionId);
    setIsAllExpanded(false);
  };

  const handleToggleAll = () => {
    if (isAllExpanded) {
      setIsAllExpanded(false);
      setOpenSection(null);
    } else {
      setIsAllExpanded(true);
    }
  };

  // Dynamic Summaries for Accordion Headers (Minor Item 1: Template name instead of dimensions repetition)
  const currentTemplate = templates?.find((tpl) => tpl.id === selectedTemplateId);
  const templateSummary = currentTemplate
    ? currentTemplate.id.startsWith('user-')
      ? currentTemplate.name
      : translateTemplateName(currentTemplate.id, currentTemplate.name)
    : '';

  const structureSummary = useMemo(() => {
    const roofLabel = roofType === 'solid-panel' ? 'Tapa completa' : 'Listones';
    const backingLabel = hasBacking
      ? backingType === 'groove'
        ? 'Fondo ranurado'
        : 'Fondo aplicado'
      : 'Sin fondo';
    return `${roofLabel} · ${backingLabel}`;
  }, [roofType, hasBacking, backingType]);

  const distributionSummary = useMemo(() => {
    const count = currentBayCount;
    const bayText = count === 1 ? '1 vano' : `${count} vanos`;
    const orientationText = gridType === '2-bays-horizontal' ? 'horiz.' : 'vert.';
    return count > 1 ? `${bayText} ${orientationText}` : bayText;
  }, [currentBayCount, gridType]);

  const interiorSummary = useMemo(() => {
    if (activeBay.type === 'drawer-stack') {
      const count = activeBay.drawerTracks?.length ?? 1;
      return `Cajones · ${count}`;
    }
    if (activeBay.type === 'shelves') {
      const count = activeBay.count ?? 1;
      return `Estantes · ${count}`;
    }
    if (activeBay.type === 'doors') {
      const count = activeBay.count ?? 1;
      return `Puertas · ${count}`;
    }
    if (activeBay.type === 'pull-out-tray') {
      return 'Bandeja extraíble';
    }
    if (activeBay.type === 'bi-fold-closure') {
      return 'Puerta plegable';
    }
    if (activeBay.type === 'subdivided') {
      return 'Matriz especial';
    }
    return 'Vano vacío';
  }, [activeBay]);

  const materialsSummary = useMemo(() => {
    const mat = materials.find((m) => m.id === selectedMaterialId);
    const matName = mat ? mat.name : `${matThickness} mm`;
    const jointName =
      jointStrategy === 'confirmat'
        ? 'Confirmat'
        : jointStrategy === 'dowel-and-confirmat'
        ? 'Tarugo + Confirmat'
        : jointStrategy === 'cam-dowel'
        ? 'Minifix + Tarugo'
        : 'Tornillos';
    return `${matName} · ${jointName}`;
  }, [materials, selectedMaterialId, matThickness, jointStrategy]);

  const interferencesSummary = useMemo(() => {
    const isObstacleActive = columnObstacle?.enabled;
    const isFalseSquareActive = falseSquare?.enabled;
    if (isObstacleActive && isFalseSquareActive) return 'Columna y Falso Escuadra';
    if (isObstacleActive) return 'Columna activa';
    if (isFalseSquareActive) return 'Falsa escuadra';
    return 'Ninguna';
  }, [columnObstacle, falseSquare]);

  const [isDistributionModalOpen, setIsDistributionModalOpen] = useState(false);

  const hasDoorsOrFronts =
    Boolean(frontsMaterialId) ||
    bays.some(
      (b) =>
        b.type === 'doors' ||
        b.type === 'bi-fold-closure' ||
        (b.type === 'drawer-stack' && b.drawerType !== 'simple-interior'),
    );

  const hasDrawers =
    Boolean(drawerBoxesMaterialId) ||
    bays.some((b) => b.type === 'drawer-stack' || b.type === 'pull-out-tray');

  const hasBackingBoard =
    Boolean(backingsMaterialId) || (hasBacking && backingType !== 'none');

  const activeInterferenceCount =
    (columnObstacle?.enabled ? 1 : 0) + (falseSquare?.enabled ? 1 : 0);

  const totalProjectUnits = projectModules?.reduce((acc, m) => acc + (m.quantity || 1), 0) ?? 1;

  return (
    <section aria-labelledby="form-heading" className="m3-card module-form">
      {/* 1. Sticky Header with Current Section & Dimensions */}
      <PanelStickyHeader
        currentSectionName={currentSectionTitle}
        width={width}
        height={height}
        depth={depth}
        onWidthChange={onWidthChange}
        onHeightChange={onHeightChange}
        onDepthChange={onDepthChange}
        onSwitchToSiteMode={onSwitchToSiteMode}
        isMobileDevice={isMobileDevice}
        activeInterferenceCount={showInterferences ? activeInterferenceCount : 0}
        onOpenInterferences={
          showInterferences
            ? () => {
                setOpenSection('interferences');
                setIsAllExpanded(false);
                if (typeof document !== 'undefined') {
                  const el = document.getElementById('accordion-section-interferences');
                  if (el && typeof el.scrollIntoView === 'function') {
                    try {
                      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    } catch {}
                  }
                }
              }
            : undefined
        }
      />

      {/* Main scrollable body for accordion sections and builder controls */}
      <div className="module-form__content">
        {/* 2. Compact Module & Project Bar */}
      <ModuleBar
        project={project}
        projectModules={projectModules}
        activeModuleId={activeModuleId}
        onSetActiveModule={onSetActiveModule}
        onAddProjectModule={onAddProjectModule}
        onDuplicateProjectModule={onDuplicateProjectModule}
        onRemoveProjectModule={onRemoveProjectModule}
        onUpdateProjectModuleQuantity={onUpdateProjectModuleQuantity}
        onUpdateProjectModuleName={onUpdateProjectModuleName}
        onSaveModule={onSave}
        onSaveProject={onSaveProject}
        onOpenDistributionModal={() => setIsDistributionModalOpen(true)}
        isSubdividedBay={activeBay.type === 'subdivided'}
      />

      {/* 3. Sticky Horizontal Tabs with Scroll Fade (< 1024px) */}
      <ScrollFadeTabs
        tabs={sectionsList}
        activeTabId={openSection}
        onSelectTab={handleSelectTab}
        isAllExpanded={isAllExpanded}
        onToggleAll={handleToggleAll}
      />

      {/* Desktop Toolbar (>= 1024px) for Contraer / Abrir todo */}
      <div className="panel-accordion-desktop-toolbar">
        <button
          type="button"
          onClick={handleToggleAll}
          className="panel-accordion-desktop-toolbar__btn"
          title={isAllExpanded ? 'Contraer todas las secciones' : 'Abrir todas las secciones'}
          aria-label={isAllExpanded ? 'Contraer todo' : 'Abrir todo'}
        >
          <span aria-hidden="true">{isAllExpanded ? '▲' : '▼'}</span>
          <span>{isAllExpanded ? 'Contraer todo' : 'Abrir todo'}</span>
        </button>
      </div>

      {/* 4. Piece Inspector (Prominent when a piece is clicked) */}
      <PieceInspectorCard
        selectedPiece={selectedPiece}
        machiningSheets={props.machiningSheets}
        pieceMech={pieceMech}
        kinematicsState={kinematicsState}
        onMechanismOpenRatioChange={onMechanismOpenRatioChange}
        materials={materials}
        standardThicknessesMm={standardThicknessesMm}
        pieceMaterialOverrides={pieceMaterialOverrides}
        onSetPieceMaterial={onSetPieceMaterial}
        pieceThicknessOverrides={pieceThicknessOverrides}
        onSetPieceThickness={onSetPieceThickness}
        pieceEdgeBandOverrides={pieceEdgeBandOverrides}
        onSetPieceEdgeBands={onSetPieceEdgeBands}
        edgeBands={edgeBands}
        pieceJointOverrides={pieceJointOverrides}
        jointStrategy={jointStrategy}
        onSetPieceJointOverride={onSetPieceJointOverride}
        onOpenMachiningModal={onOpenMachiningModal}
        shelfDeflections={shelfDeflections}
        onSelectPiece={onSelectPiece}
      />

      {/* 5. Accordion Sections */}
      {isWallShelves ? (
        <>
          <Accordion
            id="dimensions"
            icon="📏"
            title="Medidas y Ménsulas"
            summary={templateSummary}
            isOpen={isAllExpanded || openSection === 'dimensions'}
            onToggle={() => handleToggleSection('dimensions')}
          >
            <WallShelvesSection
              width={width}
              depth={depth}
              onWidthChange={onWidthChange}
              onDepthChange={onDepthChange}
              wallShelvesShelfCount={wallShelvesShelfCount}
              onWallShelvesShelfCountChange={onWallShelvesShelfCountChange}
              wallShelvesVerticalSpacingMm={wallShelvesVerticalSpacingMm}
              onWallShelvesVerticalSpacingMmChange={onWallShelvesVerticalSpacingMmChange}
              wallShelvesBaseElevationYMm={wallShelvesBaseElevationYMm}
              onWallShelvesBaseElevationYMmChange={onWallShelvesBaseElevationYMmChange}
              wallShelvesBracketType={wallShelvesBracketType}
              onWallShelvesBracketTypeChange={onWallShelvesBracketTypeChange}
              wallShelvesWallType={wallShelvesWallType}
              onWallShelvesWallTypeChange={onWallShelvesWallTypeChange}
              wallShelvesLoadCategory={wallShelvesLoadCategory}
              onWallShelvesLoadCategoryChange={onWallShelvesLoadCategoryChange}
              wallShelvesOverhangMode={wallShelvesOverhangMode}
              onWallShelvesOverhangModeChange={onWallShelvesOverhangModeChange}
              wallShelvesBoundaryCondition={wallShelvesBoundaryCondition}
              onWallShelvesBoundaryConditionChange={onWallShelvesBoundaryConditionChange}
              materials={materials}
              standardThicknessesMm={standardThicknessesMm}
              selectedMaterialId={selectedMaterialId}
              onMaterialChange={onMaterialChange}
              edgeBands={edgeBands}
              selectedEdgeBandId={selectedEdgeBandId}
              onEdgeBandChange={onEdgeBandChange}
              wallShelvingOutput={wallShelvingOutput}
              onViewAssemblyClick={onViewAssemblyClick}
              activeSection="dimensions"
            />
          </Accordion>

          <Accordion
            id="materials"
            icon="🎨"
            title="Materiales"
            summary={materialsSummary}
            isOpen={isAllExpanded || openSection === 'materials'}
            onToggle={() => handleToggleSection('materials')}
          >
            <WallShelvesSection
              width={width}
              depth={depth}
              onWidthChange={onWidthChange}
              onDepthChange={onDepthChange}
              wallShelvesShelfCount={wallShelvesShelfCount}
              onWallShelvesShelfCountChange={onWallShelvesShelfCountChange}
              wallShelvesVerticalSpacingMm={wallShelvesVerticalSpacingMm}
              onWallShelvesVerticalSpacingMmChange={onWallShelvesVerticalSpacingMmChange}
              wallShelvesBaseElevationYMm={wallShelvesBaseElevationYMm}
              onWallShelvesBaseElevationYMmChange={onWallShelvesBaseElevationYMmChange}
              wallShelvesBracketType={wallShelvesBracketType}
              onWallShelvesBracketTypeChange={onWallShelvesBracketTypeChange}
              wallShelvesWallType={wallShelvesWallType}
              onWallShelvesWallTypeChange={onWallShelvesWallTypeChange}
              wallShelvesLoadCategory={wallShelvesLoadCategory}
              onWallShelvesLoadCategoryChange={onWallShelvesLoadCategoryChange}
              wallShelvesOverhangMode={wallShelvesOverhangMode}
              onWallShelvesOverhangModeChange={onWallShelvesOverhangModeChange}
              wallShelvesBoundaryCondition={wallShelvesBoundaryCondition}
              onWallShelvesBoundaryConditionChange={onWallShelvesBoundaryConditionChange}
              materials={materials}
              standardThicknessesMm={standardThicknessesMm}
              selectedMaterialId={selectedMaterialId}
              onMaterialChange={onMaterialChange}
              edgeBands={edgeBands}
              selectedEdgeBandId={selectedEdgeBandId}
              onEdgeBandChange={onEdgeBandChange}
              wallShelvingOutput={wallShelvingOutput}
              onViewAssemblyClick={onViewAssemblyClick}
              activeSection="materials"
            />
          </Accordion>
        </>
      ) : (
        <>
          {/* SECCIÓN 1: Medidas y Plantilla */}
          <Accordion
            id="dimensions"
            icon="📏"
            title="Medidas y Plantilla"
            summary={templateSummary}
            isOpen={isAllExpanded || openSection === 'dimensions'}
            onToggle={() => handleToggleSection('dimensions')}
          >
            {templates && templates.length > 0 && onTemplateChange && (
              <div className="form-group template-selection-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="select-template">
                    Plantilla base o personalizada:
                    <span className="visually-hidden">Module Template:</span>
                  </label>
                  {onSaveUserTemplate && (
                    <button
                      type="button"
                      className="m3-button m3-button--tonal"
                      style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
                      onClick={() => setIsSavingTemplate(!isSavingTemplate)}
                    >
                      💾 {t('userTemplates.saveButton')}
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                  <select
                    id="select-template"
                    value={selectedTemplateId}
                    onChange={(e) => onTemplateChange(e.target.value)}
                    className="m3-select"
                    style={{ flex: 1 }}
                  >
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.id.startsWith('user-') ? `⭐ ${tpl.name}` : translateTemplateName(tpl.id, tpl.name)}
                      </option>
                    ))}
                  </select>

                  {selectedTemplateId?.startsWith('user-') && onDeleteUserTemplate && (
                    <button
                      type="button"
                      className="m3-button m3-button--outlined"
                      style={{ padding: '0.25rem 0.5rem', color: 'var(--md-sys-color-error)' }}
                      title={t('userTemplates.delete')}
                      onClick={() => {
                        const currentTpl = templates.find((tpl) => tpl.id === selectedTemplateId);
                        const name = currentTpl?.name ?? selectedTemplateId;
                        if (window.confirm(t('userTemplates.deleteConfirm', { name }))) {
                          onDeleteUserTemplate(selectedTemplateId);
                        }
                      }}
                    >
                      🗑️
                    </button>
                  )}
                </div>

                {isSavingTemplate && (
                  <div className="m3-card" style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'var(--md-sys-color-surface-container)' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>{t('userTemplates.saveTitle')}</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <input
                        type="text"
                        className="m3-input"
                        placeholder={t('userTemplates.namePlaceholder')}
                        value={newTemplateName}
                        onChange={(e) => setNewTemplateName(e.target.value)}
                        style={{ width: '100%' }}
                      />
                      <input
                        type="text"
                        className="m3-input"
                        placeholder={t('userTemplates.descPlaceholder')}
                        value={newTemplateDesc}
                        onChange={(e) => setNewTemplateDesc(e.target.value)}
                        style={{ width: '100%' }}
                      />
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="m3-button m3-button--outlined"
                          style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                          onClick={() => {
                            setIsSavingTemplate(false);
                            setNewTemplateName('');
                            setNewTemplateDesc('');
                          }}
                        >
                          {t('userTemplates.cancel')}
                        </button>
                        <button
                          type="button"
                          className="m3-button m3-button--filled"
                          style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                          disabled={!newTemplateName.trim()}
                          onClick={async () => {
                            if (!newTemplateName.trim()) return;
                            await onSaveUserTemplate?.(newTemplateName, newTemplateDesc);
                            setIsSavingTemplate(false);
                            setNewTemplateName('');
                            setNewTemplateDesc('');
                          }}
                        >
                          {t('userTemplates.save')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="dimension-row-grid">
              {/* Ancho */}
              <div className="form-group dimension-cell">
                <label htmlFor="input-width">
                  {t('form.dimensions.width')}
                  <span className="visually-hidden">Width (mm):</span>
                </label>
                <NumericInput
                  id="input-width"
                  min={DEFAULT_UI_CONFIG.dimensions.width.min}
                  max={DEFAULT_UI_CONFIG.dimensions.width.max}
                  step={DEFAULT_UI_CONFIG.dimensions.width.step}
                  value={width}
                  showStepper={true}
                  restoreOnInvalid={true}
                  unit="mm"
                  onChange={onWidthChange}
                />
              </div>

              {/* Alto */}
              <div className="form-group dimension-cell">
                <label htmlFor="input-height">
                  {t('form.dimensions.height')}
                  <span className="visually-hidden">Height (mm):</span>
                </label>
                <NumericInput
                  id="input-height"
                  min={DEFAULT_UI_CONFIG.dimensions.height.min}
                  max={DEFAULT_UI_CONFIG.dimensions.height.max}
                  step={DEFAULT_UI_CONFIG.dimensions.height.step}
                  value={height}
                  showStepper={true}
                  restoreOnInvalid={true}
                  unit="mm"
                  onChange={onHeightChange}
                />
              </div>

              {/* Profundidad */}
              <div className="form-group dimension-cell">
                <label htmlFor="input-depth">
                  {t('form.dimensions.depth')}
                  <span className="visually-hidden">Depth (mm):</span>
                </label>
                <NumericInput
                  id="input-depth"
                  min={DEFAULT_UI_CONFIG.dimensions.depth.min}
                  max={DEFAULT_UI_CONFIG.dimensions.depth.max}
                  step={DEFAULT_UI_CONFIG.dimensions.depth.step}
                  value={depth}
                  showStepper={true}
                  restoreOnInvalid={true}
                  unit="mm"
                  onChange={onDepthChange}
                />
              </div>
            </div>
          </Accordion>

          {/* SECCIÓN 2: Estructura del Casco */}
          <Accordion
            id="structure"
            icon="🏗️"
            title="Estructura"
            summary={structureSummary}
            isOpen={isAllExpanded || openSection === 'structure'}
            onToggle={() => handleToggleSection('structure')}
          >
            <StructureSection
              structuralSpanWarnings={structuralSpanWarnings}
              roofType={roofType}
              onRoofTypeChange={onRoofTypeChange}
              jointPriority={jointPriority}
              onJointPriorityChange={onJointPriorityChange}
              isIslandCabinet={isIslandCabinet}
              hasBacking={hasBacking}
              backingThicknessMm={backingThicknessMm}
              backingType={backingType}
              onIsIslandCabinetChange={onIsIslandCabinetChange}
              onHasBackingChange={onHasBackingChange}
              onBackingThicknessChange={onBackingThicknessChange}
              onBackingTypeChange={onBackingTypeChange}
              gridType={gridType}
              partitionPassThroughRoof={partitionPassThroughRoof}
              onPartitionPassThroughRoofChange={onPartitionPassThroughRoofChange}
              rearStructuralRails={rearStructuralRails}
              rearStructuralRailsWidthMm={rearStructuralRailsWidthMm}
              onRearStructuralRailsChange={onRearStructuralRailsChange}
              onRearStructuralRailsWidthChange={onRearStructuralRailsWidthChange}
              railOrientation={railOrientation}
              onRailOrientationChange={onRailOrientationChange}
              hasMiddleBrace={hasMiddleBrace}
              middleBraceWidthMm={middleBraceWidthMm}
              onHasMiddleBraceChange={onHasMiddleBraceChange}
              onMiddleBraceWidthChange={onMiddleBraceWidthChange}
              hasWallHangingRail={hasWallHangingRail}
              wallHangingRailWidthMm={wallHangingRailWidthMm}
              onHasWallHangingRailChange={onHasWallHangingRailChange}
              onWallHangingRailWidthChange={onWallHangingRailWidthChange}
              hasPlinth={hasPlinth}
              plinthHeightMm={plinthHeightMm}
              plinthSetbackMm={plinthSetbackMm}
              onHasPlinthChange={onHasPlinthChange}
              onPlinthHeightChange={onPlinthHeightChange}
              onPlinthSetbackChange={onPlinthSetbackChange}
              onSaveUserTemplate={onSaveUserTemplate}
            />
          </Accordion>

          {/* SECCIÓN 3: Distribución de Vanos */}
          <Accordion
            id="distribution"
            icon="🔲"
            title="Vanos"
            summary={distributionSummary}
            isOpen={isAllExpanded || openSection === 'distribution'}
            onToggle={() => handleToggleSection('distribution')}
          >
            <DistributionSection
              gridType={gridType}
              onGridTypeChange={onGridTypeChange}
              activeBay={activeBay}
              onOpenDistributionModal={() => setIsDistributionModalOpen(true)}
              bayTracks={bayTracks}
              onBayTracksChange={onBayTracksChange}
              bayBoxes={bayBoxes}
              currentActiveIndex={currentActiveIndex}
              onActiveBayIndexChange={onActiveBayIndexChange}
            />
          </Accordion>

          {/* SECCIÓN 4: Equipamiento Interior */}
          <Accordion
            id="interior"
            icon="🚪"
            title="Interior"
            summary={interiorSummary}
            isOpen={isAllExpanded || openSection === 'interior'}
            onToggle={() => handleToggleSection('interior')}
          >
            <InteriorSection
              currentBayCount={currentBayCount}
              currentActiveIndex={currentActiveIndex}
              onActiveBayIndexChange={onActiveBayIndexChange}
              activeBay={activeBay}
              onBayContentTypeChange={onBayContentTypeChange}
              onOpenDistributionModal={() => setIsDistributionModalOpen(true)}
              onRemoveDrawer={onRemoveDrawer}
              onAddDrawer={onAddDrawer}
              onDrawerTracksChange={onDrawerTracksChange}
              resolvedDrawerHeights={resolvedDrawerHeights}
              estimatedBayCavityHeight={estimatedBayCavityHeight}
              onDrawerTypeChange={onDrawerTypeChange}
              onDrawerTopPullGapChange={onDrawerTopPullGapChange}
              onDrawerBoxSideHeightOffsetChange={onDrawerBoxSideHeightOffsetChange}
              onDrawerBottomMountChange={onDrawerBottomMountChange}
              onDrawerFrontMountChange={onDrawerFrontMountChange}
              onDrawerTransomsChange={onDrawerTransomsChange}
              width={width}
              maxDrawerSpanMm={maxDrawerSpanMm}
              gridType={gridType}
              onDrawerSlideTypeChange={onDrawerSlideTypeChange}
              onDrawerSlideClearanceChange={onDrawerSlideClearanceChange}
              onDrawerGapChange={onDrawerGapChange}
              onRemoveShelf={onRemoveShelf}
              onAddShelf={onAddShelf}
              onShelfTracksChange={onShelfTracksChange}
              shelfQuickRecipes={shelfQuickRecipes}
              resolvedShelfHeights={resolvedShelfHeights}
              onShelfTypeChange={onShelfTypeChange}
              onShelfAntiSagChange={onShelfAntiSagChange}
              onShelfHasDoorsChange={onShelfHasDoorsChange}
              onShelfDoorCountChange={onShelfDoorCountChange}
              onShelfDoorMountTypeChange={onShelfDoorMountTypeChange}
              onShelfDoorHingeSideChange={onShelfDoorHingeSideChange}
              onDoorCountChange={onDoorCountChange}
              onDoorMountTypeChange={onDoorMountTypeChange}
              onDoorInteriorShelvesCountChange={onDoorInteriorShelvesCountChange}
              onDoorShelfTypeChange={onDoorShelfTypeChange}
              onBifoldDirectionChange={onBifoldDirectionChange}
            />
          </Accordion>

          {/* SECCIÓN 5: Materiales por Rol */}
          <Accordion
            id="materials"
            icon="🎨"
            title="Materiales"
            summary={materialsSummary}
            isOpen={isAllExpanded || openSection === 'materials'}
            onToggle={() => handleToggleSection('materials')}
          >
            <MaterialsSection
              materials={materials}
              standardThicknessesMm={standardThicknessesMm}
              selectedMaterialId={selectedMaterialId}
              onMaterialChange={onMaterialChange}
              hasDoorsOrFronts={hasDoorsOrFronts}
              frontsMaterialId={frontsMaterialId}
              onFrontsMaterialChange={onFrontsMaterialChange}
              hasDrawers={hasDrawers}
              drawerBoxesMaterialId={drawerBoxesMaterialId}
              onDrawerBoxesMaterialChange={onDrawerBoxesMaterialChange}
              hasBackingBoard={hasBackingBoard}
              backingsMaterialId={backingsMaterialId}
              onBackingsMaterialChange={onBackingsMaterialChange}
              onBackingThicknessChange={onBackingThicknessChange}
              edgeBands={edgeBands}
              selectedEdgeBandId={selectedEdgeBandId}
              onEdgeBandChange={onEdgeBandChange}
              jointStrategy={jointStrategy}
              onJointStrategyChange={onJointStrategyChange}
            />
          </Accordion>

          {/* SECCIÓN 6: Interferencias Arquitectónicas (Oculta según flag showInterferences) */}
          {showInterferences && (
            <Accordion
              id="interferences"
              icon="📐"
              title="Interferencias"
              summary={interferencesSummary}
              isOpen={isAllExpanded || openSection === 'interferences'}
              onToggle={() => handleToggleSection('interferences')}
            >
              <InterferencesSection
                width={width}
                height={height}
                depth={depth}
                columnObstacle={columnObstacle}
                falseSquare={falseSquare}
                onColumnObstacleChange={onColumnObstacleChange}
                onFalseSquareChange={onFalseSquareChange}
              />
            </Accordion>
          )}
        </>
      )}

      {/* Alcance de Exportación si hay múltiples módulos */}
      {projectModules && projectModules.length > 1 && onProjectScopeChange && (
        <div style={{ marginTop: '1rem', marginBottom: '0.75rem', padding: '0.75rem', backgroundColor: 'var(--md-sys-color-surface-container)', borderRadius: '8px' }}>
          <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--md-sys-color-on-surface)', marginBottom: '0.4rem' }}>
            Alcance para descargas (CSV / PDF):
          </span>
          <div className="m3-segmented-button" role="radiogroup" aria-label="Alcance para exportaciones" style={{ width: '100%' }}>
            <button
              type="button"
              role="radio"
              aria-checked={projectScope !== 'all-modules'}
              className={`m3-segmented-button__item ${projectScope !== 'all-modules' ? 'selected' : ''}`}
              onClick={() => onProjectScopeChange('current-module')}
              style={{ flex: 1, minHeight: '44px', padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
            >
              📌 Módulo Actual
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={projectScope === 'all-modules'}
              className={`m3-segmented-button__item ${projectScope === 'all-modules' ? 'selected' : ''}`}
              onClick={() => onProjectScopeChange('all-modules')}
              style={{ flex: 1, minHeight: '44px', padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
            >
              📦 Todo el Proyecto ({totalProjectUnits} uds.)
            </button>
          </div>
        </div>
      )}

      {/* Navegación por Pasos en Móvil cuando hay una sección activa */}
      {isMobileDevice && openSection && !isAllExpanded && (
        <div
          className="expert-mobile-section-footer"
          style={{
            marginTop: '1.25rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--md-sys-color-outline-variant)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          {/* Volver a Vista Continua Completa */}
          <button
            type="button"
            className="m3-button m3-button--tonal"
            style={{
              minHeight: '42px',
              width: '100%',
              fontSize: '0.84rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              borderRadius: '12px',
            }}
            onClick={() => {
              handleToggleAll();
              safeScrollToTop();
            }}
          >
            <span>👁️</span>
            <span>Ver Todo el Formulario Continuo</span>
          </button>

          {/* Fila: Paso Anterior / Paso Siguiente */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {prevStep ? (
              <button
                type="button"
                className="m3-button m3-button--outlined"
                style={{
                  minHeight: '48px',
                  flex: 1,
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.3rem',
                }}
                onClick={() => {
                  handleSelectTab(prevStep.id);
                  safeScrollToTop();
                }}
              >
                <span>{`◀ ${prevStep.icon} ${prevStep.label}`}</span>
              </button>
            ) : (
              <div style={{ flex: 1 }} />
            )}

            {nextStep ? (
              <button
                type="button"
                className="m3-button m3-button--filled"
                style={{
                  minHeight: '48px',
                  flex: 1,
                  fontSize: '0.82rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.3rem',
                }}
                onClick={() => {
                  handleSelectTab(nextStep.id);
                  safeScrollToTop();
                }}
              >
                <span>{`${nextStep.icon} ${nextStep.label} ▶`}</span>
              </button>
            ) : (
              <button
                type="button"
                className="m3-button m3-button--filled"
                style={{
                  minHeight: '48px',
                  flex: 1,
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.3rem',
                }}
                onClick={onSave}
                disabled={isSaving}
              >
                <span>{isSaving ? 'Guardando...' : '💾 Guardar Módulo'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Botones de acción estándar (en móvil si aplica botón 3D) */}
      {isMobileDevice && onView3dClick && (
        <div className="form-actions m3-button-row" style={{ marginBottom: '0.5rem' }}>
          <button
            type="button"
            onClick={onView3dClick}
            className="m3-btn m3-btn--filled"
            style={{ width: '100%' }}
          >
            🧊 Ver Resultado en 3D
          </button>
        </div>
      )}
      </div>

      {/* Pie Fijo con Resumen de Producción y Costos (Etapa 4) */}
      <PanelSummaryFooter
        bom={bom ?? null}
        consolidatedBom={consolidatedBom ?? null}
        cost={cost ?? null}
        consolidatedCost={consolidatedCost ?? null}
        isCostCalculating={isCostCalculating}
        materials={materials}
        activeMaterialId={selectedMaterialId}
        activeModuleQuantity={projectModules?.find((m) => m.id === activeModuleId)?.quantity ?? 1}
        scope={projectScope === 'all-modules' ? 'project' : 'module'}
        onScopeChange={(newScope) => {
          onProjectScopeChange?.(newScope === 'project' ? 'all-modules' : 'current-module');
        }}
        isSaving={isSaving}
        onSave={onSave}
        onExportCsv={onExportCsv}
        onExportPdf={onExportPdf}
      />

      {/* Modal de Distribución Interior Compleja (Matriz estilo Word) */}
      <BayDistributionModal
        isOpen={isDistributionModalOpen}
        onClose={() => setIsDistributionModalOpen(false)}
        onApply={(updatedContent) => {
          if (onBayContentChange) {
            onBayContentChange(currentActiveIndex, updatedContent);
          } else {
            onBayContentTypeChange?.(currentActiveIndex, updatedContent as any);
          }
        }}
        bayIndex={currentActiveIndex}
        bayWidth={activeBayWidth}
        bayHeight={activeBayHeight}
        bayDepth={activeBayDepth}
        initialContent={activeBay}
        materials={materials}
        standardThicknessesMm={standardThicknessesMm}
      />
    </section>
  );
}
