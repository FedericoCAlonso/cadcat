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
  buildModuleMachiningSheets,
  exportMachiningSheetPdf,
  type PieceMachiningSheet,
  checkModuleShelvesDeflection,
  type ShelfDeflectionResult,
  generateAssemblySheet,
  exportAssemblyGuidePdf,
  type AssemblySheet,
} from '../resolver';
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
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [selectedEdgeBandId, setSelectedEdgeBandId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'form' | 'pieces' | '3d' | 'machining' | 'settings' | 'assembly'>('3d');
  const [selectedPieceId, setSelectedPieceId] = useState<string | null>(null);
  const [selectedMachiningPieceId, setSelectedMachiningPieceId] = useState<string | null>(null);
  const [projectConfig, setProjectConfig] = useState<ProjectConfig | null>(null);
  const [explodedRatio, setExplodedRatio] = useState<number>(0);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [edgeBands, setEdgeBands] = useState<EdgeBand[]>([]);
  const [hardware, setHardware] = useState<Hardware[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  }, [width, height, depth, selectedTemplateId, activeMaterial, selectedEdgeBandId, edgeBands, projectConfig]);

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
          sawKerfMm: projectConfig?.nesting.sawKerfMm,
          trimMarginMm: projectConfig?.nesting.sheetTrimMarginMm,
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
    setStatusMessage(`Exported cut list to ${fileName}.`);
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
        sawKerfMm: projectConfig?.nesting.sawKerfMm,
        trimMarginMm: projectConfig?.nesting.sheetTrimMarginMm,
      },
      optimizationGoal: projectConfig?.nesting.optimizationGoal,
    });

    const doc = exportCutPlanPdf(nesting, `Cut Plan - ${currentModule?.id ?? 'Module'}`);
    const pdfBlob = doc.output('blob');
    const fileName = `cut-plan-${currentModule?.id ?? 'module'}.pdf`;
    triggerBrowserDownload(fileName, pdfBlob, 'application/pdf');
    setStatusMessage(`Exported cut plan to ${fileName}.`);
  }, [resolvedPieces, activeMaterial, currentModule, projectConfig, assemblySheet]);

  // Export sequential assembly guide as PDF
  const exportAssemblyPdf = useCallback(() => {
    if (!assemblySheet) return;
    const doc = exportAssemblyGuidePdf(assemblySheet, `Assembly Guide - ${currentModule?.id ?? 'Module'}`);
    const pdfBlob = doc.output('blob');
    const fileName = `assembly-guide-${currentModule?.id ?? 'module'}.pdf`;
    triggerBrowserDownload(fileName, pdfBlob, 'application/pdf');
    setStatusMessage(`Exported assembly guide to ${fileName}.`);
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
      setStatusMessage(`Exported machining sheets to ${fileName}.`);
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
    machiningSheets,
    selectedMachiningPieceId,
    assemblySheet,
    shelfDeflections,
    shelfDeflectionWarnings,
    projectConfig,
    setWidth,
    setHeight,
    setDepth,
    setSelectedTemplateId,
    setSelectedMaterialId,
    setSelectedEdgeBandId,
    setActiveTab,
    setSelectedPieceId,
    setSelectedMachiningPieceId,
    setExplodedRatio,
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
