import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  type Material,
  type EdgeBand,
  type Hardware,
  type Module,
  type DrillOperation,
  type PieceMachining,
  type ProjectConfig,
} from '../model';
import {
  loadMaterialsFromDb,
  loadEdgeBandsFromDb,
  loadHardwareFromDb,
  saveItem,
  loadItem,
  loadProjectConfigFromDb,
  saveProjectConfigToDb,
  getDefaultProjectConfig,
  exportProjectConfigJson,
  importProjectConfigJson,
  DEFAULT_PROJECT_ID,
} from '../storage';
import { getSeedMaterials, getSeedEdgeBands, getSeedHardware } from '../catalog';
import {
  generateBillOfMaterials,
  calculateModuleCost,
  PlacementTree,
  JointGraph,
  exportCutListCsv,
  exportCutPlanPdf,
  triggerBrowserDownload,
  type ResolvedPieceWithCutSize,
  type BillOfMaterials,
  type ModuleCostSummary,
  type TemplateDefinition,
  ALL_TEMPLATES,
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
  type BayContent,
  type DrawerSlideType,
  type DrawerFrontMount,
  type DoorMountType,
  type BayGridDefinition,
  type TrackSize,
  type ModularModuleDefinition,
  buildModularModule,
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
  activeTab: 'form' | 'pieces' | '3d' | 'machining' | 'settings' | 'assembly';
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
  setWidth: (width: number) => void;
  setHeight: (height: number) => void;
  setDepth: (depth: number) => void;
  setSelectedTemplateId: (id: string) => void;
  setSelectedMaterialId: (id: string) => void;
  setSelectedEdgeBandId: (id: string) => void;
  setActiveTab: (tab: 'form' | 'pieces' | '3d' | 'machining' | 'settings' | 'assembly') => void;
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
  setDrawerGap: (bayIndex: number, gapMm: number) => void;
  setDrawerTransoms: (bayIndex: number, hasTransoms: boolean) => void;
  setDoorCount: (bayIndex: number, count: 1 | 2) => void;
  setDoorMountType: (bayIndex: number, mount: DoorMountType) => void;
  setBifoldDirection: (bayIndex: number, dir: 'vertical-lift' | 'horizontal-book') => void;
  setFrontsMaterialId: (id: string) => void;
  setDrawerBoxesMaterialId: (id: string) => void;
  setBackingsMaterialId: (id: string) => void;
  saveModule: () => Promise<void>;
  loadModule: (id: string) => Promise<void>;
  exportCsv: () => void;
  exportPdf: () => void;
  exportMachiningPdf: (pieceId?: string) => void;
  exportAssemblyPdf: () => void;
  updateProjectConfig: (config: ProjectConfig) => void;
  saveProjectConfig: () => Promise<void>;
  importProjectConfigFile: (file: File) => Promise<void>;
  exportProjectConfigFile: () => void;
  resetProjectConfigToDefaults: () => Promise<void>;
}

/**
 * ViewModel hook for Module editing and piece resolution (MVVM Pattern).
 * Fetches sheet, edge band, and hardware data directly from IndexedDB.
 */
export function useModuleViewModel(initialDb?: IDBDatabase): ModuleViewModelState {
  const [width, setWidth] = useState<number>(600);
  const [height, setHeight] = useState<number>(800);
  const [depth, setDepth] = useState<number>(560);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('base-cabinet');
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
  const [activeTab, setActiveTab] = useState<'form' | 'pieces' | '3d' | 'machining' | 'settings' | 'assembly'>('3d');
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [selectedMachiningPieceId, setSelectedMachiningPieceId] = useState<string | null>(null);
  const [projectConfig, setProjectConfig] = useState<ProjectConfig | null>(null);
  const [explodedRatio, setExplodedRatio] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modular Builder Interactive State
  const [isCustomModular, setIsCustomModular] = useState<boolean>(false);
  const [roofType, setRoofTypeState] = useState<RoofType>('front-back-rails');
  const [jointPriority, setJointPriorityState] = useState<JointPriority>('lateral-over-bottom');
  const [hasBacking, setHasBackingState] = useState<boolean>(true);
  const [gridType, setGridTypeState] = useState<'1-bay' | '2-bays-vertical' | '3-bays-vertical' | '2-bays-horizontal'>('1-bay');
  const [bays, setBaysState] = useState<BayContent[]>([
    { type: 'shelves', count: 1, shelfType: 'adjustable', setbackMm: 20 },
  ]);
  const [activeBayIndex, setActiveBayIndex] = useState<number>(0);
  const [frontsMaterialId, setFrontsMaterialId] = useState<string>('');
  const [drawerBoxesMaterialId, setDrawerBoxesMaterialId] = useState<string>('');
  const [backingsMaterialId, setBackingsMaterialId] = useState<string>('');

  // Handle template selection and sync builder options with preset
  const handleSelectTemplate = useCallback((id: string) => {
    setSelectedTemplateId(id);
    setIsCustomModular(false);
    setActiveBayIndex(0);

    if (id === 'base-cabinet' || id === 'modular-empty') {
      setRoofTypeState('front-back-rails');
      setJointPriorityState('lateral-over-bottom');
      setHasBackingState(true);
      setGridTypeState('1-bay');
      setBaysState(id === 'modular-empty' ? [{ type: 'empty' }] : [{ type: 'shelves', count: 1, shelfType: 'adjustable', setbackMm: 20 }]);
    } else if (id === 'door-cabinet' || id === 'modular-door-cabinet') {
      setRoofTypeState('solid-panel');
      setJointPriorityState('lateral-over-bottom');
      setHasBackingState(true);
      setGridTypeState('1-bay');
      setBaysState([{ type: 'doors', count: 2, mountType: 'full-overlay' }]);
    } else if (id === 'drawer-unit' || id === 'modular-drawer-unit-3') {
      setRoofTypeState('front-back-rails');
      setJointPriorityState('lateral-over-bottom');
      setHasBackingState(true);
      setGridTypeState('1-bay');
      setBaysState([
        {
          type: 'drawer-stack',
          drawerTracks: [
            { type: 'fixed', valueMm: 140 },
            { type: 'fractional', valueFr: 1 },
            { type: 'fractional', valueFr: 1 },
          ],
          frontMount: 'applied',
          slideType: 'telescopic',
          gapMm: 2.5,
        },
      ]);
    } else if (id === 'partition-cabinet' || id === 'modular-partition-combo') {
      setRoofTypeState('front-back-rails');
      setJointPriorityState('lateral-over-bottom');
      setHasBackingState(true);
      setGridTypeState('2-bays-vertical');
      setBaysState([
        { type: 'shelves', count: 2, shelfType: 'adjustable', setbackMm: 20 },
        {
          type: 'drawer-stack',
          drawerTracks: [
            { type: 'fractional', valueFr: 1 },
            { type: 'fractional', valueFr: 1 },
            { type: 'fractional', valueFr: 1 },
          ],
          frontMount: 'applied',
          slideType: 'telescopic',
        },
      ]);
    } else if (id === 'modular-pullout-tray') {
      setRoofTypeState('front-back-rails');
      setJointPriorityState('lateral-over-bottom');
      setHasBackingState(true);
      setGridTypeState('1-bay');
      setBaysState([{ type: 'pull-out-tray', lipHeightMm: 45, slideType: 'telescopic' }]);
    } else if (id === 'modular-bifold-closure') {
      setRoofTypeState('solid-panel');
      setJointPriorityState('lateral-over-bottom');
      setHasBackingState(true);
      setGridTypeState('1-bay');
      setBaysState([{ type: 'bi-fold-closure', hingeType: 'aventos', openingDirection: 'vertical-lift' }]);
    }
  }, []);

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

  // Load catalogs and project config from IndexedDB on startup
  useEffect(() => {
    let isMounted = true;

    async function loadData(): Promise<void> {
      try {
        setIsLoading(true);
        const [loadedMats, loadedBands, loadedHw, loadedConfig] = await Promise.all([
          loadMaterialsFromDb(initialDb),
          loadEdgeBandsFromDb(initialDb),
          loadHardwareFromDb(initialDb),
          loadProjectConfigFromDb(DEFAULT_PROJECT_ID, initialDb),
        ]);

        if (!isMounted) return;

        setMaterials(loadedMats);
        setEdgeBands(loadedBands);
        setHardware(loadedHw);
        setProjectConfig(loadedConfig);

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

  // Selected material
  const activeMaterial = useMemo(
    () => materials.find((m) => m.id === selectedMaterialId) ?? materials[0],
    [materials, selectedMaterialId],
  );

  // Resolves pieces dynamically whenever parameters, template, or materials change
  const { currentModule, resolvedPieces, placementTree } = useMemo(() => {
    if (!activeMaterial || width <= 0 || height <= 0 || depth <= 0) {
      return { currentModule: null, resolvedPieces: [], placementTree: null };
    }

    try {
      if (isCustomModular || selectedTemplateId.startsWith('modular-')) {
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
            hasBacking,
          },
          grid: gridDef,
          bays: normalizedBays,
          materials: {
            carcassMaterialId: activeMaterial.id,
            frontsMaterialId: frontsMaterialId || activeMaterial.id,
            drawerBoxesMaterialId: drawerBoxesMaterialId || activeMaterial.id,
            backingsMaterialId: backingsMaterialId || activeMaterial.id,
          },
          edgeBandId: selectedEdgeBandId || undefined,
        };

        const built = buildModularModule(modularDef, {
          carcassThicknessMm: typeof activeMaterial.thicknessMm === 'number' ? activeMaterial.thicknessMm : 18,
          frontThicknessMm: 18,
          boxThicknessMm: 15,
          edgeBands,
        });

        return {
          currentModule: built.module,
          resolvedPieces: built.resolvedPieces,
          placementTree: built.placementTree,
        };
      }

      const template = getTemplateById(selectedTemplateId);
      const built = template.build(
        { width, height, depth },
        activeMaterial,
        edgeBands,
        selectedEdgeBandId || undefined,
        projectConfig ?? undefined,
      );
      return {
        currentModule: built.module,
        resolvedPieces: built.resolvedPieces,
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
    gridType,
    bays,
    frontsMaterialId,
    drawerBoxesMaterialId,
    backingsMaterialId,
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
    return resolveModuleSpatialBoxes(currentModule.pieces, placementTree);
  }, [currentModule, placementTree]);

  // Derives drill machining operations from module joints
  const { machiningOperations, pieceMachiningList } = useMemo(() => {
    if (!currentModule) {
      return { machiningOperations: [], pieceMachiningList: [] };
    }
    const ops = deriveModuleDrillOperations(
      currentModule.pieces,
      currentModule.joints,
      projectConfig?.machining,
    );
    const list = groupOperationsByPiece(currentModule.pieces, ops);
    return { machiningOperations: ops, pieceMachiningList: list };
  }, [currentModule, projectConfig]);

  // Builds machining sheets for workshop manual machines
  const machiningSheets = useMemo(() => {
    if (resolvedPieces.length === 0) return [];
    return buildModuleMachiningSheets(resolvedPieces, machiningOperations);
  }, [resolvedPieces, machiningOperations]);

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
      const gaugePieces = (assemblySheet?.gauges ?? []).map((g) => ({
        id: g.piece.id,
        pieceId: g.piece.id,
        materialId: activeMaterial.id,
        cutWidthMm: g.clearSpanMm,
        cutHeightMm: g.widthMm,
        canRotate: true,
        isAuxiliary: true,
      }));

      const nestingItems = [
        ...resolvedPieces.map((p) => ({
          id: p.id,
          pieceId: p.id,
          materialId: p.materialId,
          cutWidthMm: p.cutDimensionsMm.width,
          cutHeightMm: p.cutDimensionsMm.height,
          canRotate: !activeMaterial.hasGrain,
          isAuxiliary: p.isAuxiliary,
        })),
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
    const gaugePieces = (assemblySheet?.gauges ?? []).map((g) => ({
      id: g.piece.id,
      pieceId: g.piece.id,
      materialId: activeMaterial.id,
      cutWidthMm: g.clearSpanMm,
      cutHeightMm: g.widthMm,
      canRotate: true,
      isAuxiliary: true,
    }));

    const nestingItems = [
      ...resolvedPieces.map((p) => ({
        id: p.id,
        pieceId: p.id,
        materialId: p.materialId,
        cutWidthMm: p.cutDimensionsMm.width,
        cutHeightMm: p.cutDimensionsMm.height,
        canRotate: !activeMaterial.hasGrain,
        isAuxiliary: p.isAuxiliary,
      })),
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
    if (!assemblySheet) return;
    const doc = exportAssemblyGuidePdf(assemblySheet, `Guía de Armado - ${currentModule?.id ?? 'Módulo'}`);
    const pdfBlob = doc.output('blob');
    const fileName = `guia-armado-${currentModule?.id ?? 'modulo'}.pdf`;
    triggerBrowserDownload(fileName, pdfBlob, 'application/pdf');
    setStatusMessage(`Guía de armado exportada a ${fileName}.`);
  }, [assemblySheet, currentModule]);

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

  return {
    width,
    height,
    depth,
    selectedTemplateId,
    templates: ALL_TEMPLATES,
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
    setDrawerGap,
    setDrawerTransoms,
    setDoorCount,
    setDoorMountType,
    setBifoldDirection,
    setFrontsMaterialId,
    setDrawerBoxesMaterialId,
    setBackingsMaterialId,
    saveModule,
    loadModule,
    exportCsv,
    exportPdf,
    exportMachiningPdf,
    exportAssemblyPdf,
    updateProjectConfig,
    saveProjectConfig,
    importProjectConfigFile,
    exportProjectConfigFile,
    resetProjectConfigToDefaults,
  };
}
