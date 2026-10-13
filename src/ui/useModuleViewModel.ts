import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  type Material,
  type EdgeBand,
  type Hardware,
  type Module,
} from '../model';
import {
  loadMaterialsFromDb,
  loadEdgeBandsFromDb,
  loadHardwareFromDb,
  saveItem,
  loadItem,
} from '../storage';
import {
  buildBaseCabinetModule,
  generateBillOfMaterials,
  calculateModuleCost,
  PlacementTree,
  JointGraph,
  type ResolvedPieceWithCutSize,
  type BillOfMaterials,
  type ModuleCostSummary,
} from '../resolver';
import { runGuillotineNesting } from '../workers';

export interface ModuleViewModelState {
  width: number;
  height: number;
  depth: number;
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
  setWidth: (width: number) => void;
  setHeight: (height: number) => void;
  setDepth: (depth: number) => void;
  setSelectedMaterialId: (id: string) => void;
  setSelectedEdgeBandId: (id: string) => void;
  saveModule: () => Promise<void>;
  loadModule: (id: string) => Promise<void>;
}

/**
 * ViewModel hook for Module editing and piece resolution (MVVM Pattern).
 * Fetches sheet, edge band, and hardware data directly from IndexedDB.
 */
export function useModuleViewModel(initialDb?: IDBDatabase): ModuleViewModelState {
  const [width, setWidth] = useState<number>(600);
  const [height, setHeight] = useState<number>(800);
  const [depth, setDepth] = useState<number>(560);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [selectedEdgeBandId, setSelectedEdgeBandId] = useState<string>('');
  const [materials, setMaterials] = useState<Material[]>([]);
  const [edgeBands, setEdgeBands] = useState<EdgeBand[]>([]);
  const [hardware, setHardware] = useState<Hardware[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load catalogs from IndexedDB on startup
  useEffect(() => {
    let isMounted = true;

    async function loadData(): Promise<void> {
      try {
        setIsLoading(true);
        const [loadedMats, loadedBands, loadedHw] = await Promise.all([
          loadMaterialsFromDb(initialDb),
          loadEdgeBandsFromDb(initialDb),
          loadHardwareFromDb(initialDb),
        ]);

        if (!isMounted) return;

        setMaterials(loadedMats);
        setEdgeBands(loadedBands);
        setHardware(loadedHw);

        if (loadedMats[0]) {
          setSelectedMaterialId(loadedMats[0].id);
        }
        if (loadedBands[0]) {
          setSelectedEdgeBandId(loadedBands[0].id);
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load database catalogs');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [initialDb]);

  // Selected material thickness
  const activeMaterial = useMemo(
    () => materials.find((m) => m.id === selectedMaterialId) ?? materials[0],
    [materials, selectedMaterialId],
  );

  const materialThickness = useMemo(() => {
    if (!activeMaterial) return 18;
    return typeof activeMaterial.thicknessMm === 'number' ? activeMaterial.thicknessMm : 18;
  }, [activeMaterial]);

  // Resolves pieces dynamically whenever parameters or materials change
  const { currentModule, resolvedPieces } = useMemo(() => {
    if (!activeMaterial || width <= 0 || height <= 0 || depth <= 0) {
      return { currentModule: null, resolvedPieces: [] };
    }

    try {
      const built = buildBaseCabinetModule(
        {
          widthMm: width,
          heightMm: height,
          depthMm: depth,
          materialId: activeMaterial.id,
          materialThicknessMm: materialThickness,
          edgeBandId: selectedEdgeBandId || undefined,
        },
        edgeBands,
      );
      return { currentModule: built.module, resolvedPieces: built.resolvedPieces };
    } catch {
      return { currentModule: null, resolvedPieces: [] };
    }
  }, [width, height, depth, activeMaterial, materialThickness, selectedEdgeBandId, edgeBands]);

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

  // Generates Costs
  const cost = useMemo(() => {
    if (!bom || !activeMaterial) return null;
    try {
      const nestingItems = resolvedPieces.map((p) => ({
        id: p.id,
        pieceId: p.id,
        materialId: p.materialId,
        cutWidthMm: p.cutDimensionsMm.width,
        cutHeightMm: p.cutDimensionsMm.height,
        canRotate: !activeMaterial.hasGrain,
      }));

      const sheetLength = typeof activeMaterial.sheetSizeMm.length === 'number'
        ? activeMaterial.sheetSizeMm.length
        : 2800;
      const sheetWidth = typeof activeMaterial.sheetSizeMm.width === 'number'
        ? activeMaterial.sheetSizeMm.width
        : 2070;

      const nesting = runGuillotineNesting({
        items: nestingItems,
        sheet: {
          materialId: activeMaterial.id,
          lengthMm: sheetLength,
          widthMm: sheetWidth,
        },
      });

      return calculateModuleCost({
        bom,
        nestingResult: nesting,
        materials,
        edgeBands,
        hardware,
      });
    } catch {
      return null;
    }
  }, [bom, activeMaterial, resolvedPieces, materials, edgeBands, hardware]);

  // Save module to IndexedDB
  const saveModule = useCallback(async () => {
    if (!currentModule) return;
    try {
      setIsSaving(true);
      await saveItem('modules', currentModule, initialDb);
      setStatusMessage(`Module "${currentModule.id}" saved to IndexedDB.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save module');
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
        setStatusMessage(`Module "${id}" loaded from IndexedDB.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load module');
    } finally {
      setIsLoading(false);
    }
  }, [initialDb]);

  return {
    width,
    height,
    depth,
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
    setWidth,
    setHeight,
    setDepth,
    setSelectedMaterialId,
    setSelectedEdgeBandId,
    saveModule,
    loadModule,
  };
}
