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
  TEMPLATES,
  getTemplateById,
  resolveModuleSpatialBoxes,
  type SpatialPieceBox,
  type ModuleSpatialBounds,
  deriveModuleDrillOperations,
  groupOperationsByPiece,
} from '../resolver';
import { type DrillOperation, type PieceMachining } from '../model';
import { runGuillotineNesting } from '../workers';

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
  activeTab: 'form' | 'pieces' | '3d';
  selectedPieceId: string | null;
  explodedRatio: number;
  spatialBoxes: SpatialPieceBox[];
  spatialBounds: ModuleSpatialBounds;
  machiningOperations: DrillOperation[];
  pieceMachiningList: PieceMachining[];
  setWidth: (width: number) => void;
  setHeight: (height: number) => void;
  setDepth: (depth: number) => void;
  setSelectedTemplateId: (id: string) => void;
  setSelectedMaterialId: (id: string) => void;
  setSelectedEdgeBandId: (id: string) => void;
  setActiveTab: (tab: 'form' | 'pieces' | '3d') => void;
  setSelectedPieceId: (id: string | null) => void;
  setExplodedRatio: (ratio: number) => void;
  saveModule: () => Promise<void>;
  loadModule: (id: string) => Promise<void>;
  exportCsv: () => void;
  exportPdf: () => void;
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
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [selectedEdgeBandId, setSelectedEdgeBandId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'form' | 'pieces' | '3d'>('3d');
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [explodedRatio, setExplodedRatio] = useState<number>(0);
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
      const template = getTemplateById(selectedTemplateId);
      const built = template.build(
        { width, height, depth },
        activeMaterial,
        edgeBands,
        selectedEdgeBandId || undefined,
      );
      return {
        currentModule: built.module,
        resolvedPieces: built.resolvedPieces,
        placementTree: built.placementTree,
      };
    } catch {
      return { currentModule: null, resolvedPieces: [], placementTree: null };
    }
  }, [width, height, depth, selectedTemplateId, activeMaterial, selectedEdgeBandId, edgeBands]);

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
    const ops = deriveModuleDrillOperations(currentModule.pieces, currentModule.joints);
    const list = groupOperationsByPiece(currentModule.pieces, ops);
    return { machiningOperations: ops, pieceMachiningList: list };
  }, [currentModule]);

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

  const exportCsv = useCallback(() => {
    if (resolvedPieces.length === 0) return;
    const csvContent = exportCutListCsv(resolvedPieces);
    const fileName = `cut-list-${currentModule?.id ?? 'module'}.csv`;
    triggerBrowserDownload(fileName, csvContent, 'text/csv;charset=utf-8;');
    setStatusMessage(`Exported cut list to ${fileName}.`);
  }, [resolvedPieces, currentModule]);

  const exportPdf = useCallback(() => {
    if (resolvedPieces.length === 0 || !activeMaterial) return;
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

    const doc = exportCutPlanPdf(nesting, `Cut Plan - ${currentModule?.id ?? 'Module'}`);
    const pdfBlob = doc.output('blob');
    const fileName = `cut-plan-${currentModule?.id ?? 'module'}.pdf`;
    triggerBrowserDownload(fileName, pdfBlob, 'application/pdf');
    setStatusMessage(`Exported cut plan to ${fileName}.`);
  }, [resolvedPieces, activeMaterial, currentModule]);

  return {
    width,
    height,
    depth,
    selectedTemplateId,
    templates: TEMPLATES,
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
    setWidth,
    setHeight,
    setDepth,
    setSelectedTemplateId,
    setSelectedMaterialId,
    setSelectedEdgeBandId,
    setActiveTab,
    setSelectedPieceId,
    setExplodedRatio,
    saveModule,
    loadModule,
    exportCsv,
    exportPdf,
  };
}
