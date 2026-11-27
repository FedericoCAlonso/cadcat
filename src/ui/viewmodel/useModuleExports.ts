import { useCallback, useMemo } from 'react';
import {
  type Material,
  type EdgeBand,
  type Hardware,
  type Project,
  type ProjectConfig,
  type ProjectModuleItem,
  type UserTemplate,
  type Module,
} from '../../model';
import {
  exportProjectConfigJson,
  loadAllProjectsFromDb,
  buildBackupBundleJson,
} from '../../storage';
import { APP_VERSION } from '../../version';
import {
  consolidateProjectPieces,
  runProjectNesting,
  exportCutListCsv,
  exportPlacacentroCsv,
  exportCutPlanPdf,
  exportCommercialQuotePdf,
  exportAssemblyGuidePdf,
  exportWallShelvesInstallationPdf,
  exportMarmoleriaPdf,
  exportMachiningSheetPdf,
  exportMachiningSheetToDxf,
  type ModuleToConsolidate,
  type ConsolidatedPiece,
  type ResolvedPieceWithCutSize,
  type AssemblySheet,
  type PieceMachiningSheet,
  type WallShelvingOutput,
  type WallShelvingDefinition,
  type CountertopCalculationResult,
  type CommercialQuoteResult,
} from '../../resolver';
import { translateRoleKey } from '../../locales';
import { triggerBrowserDownload } from '../browserDownload';

export interface UseModuleExportsParams {
  project: Project | null;
  projectModules: ProjectModuleItem[];
  activeModuleId: string;
  activeModuleItem?: ProjectModuleItem;
  currentModule: Module | null;
  selectedTemplateId: string;
  projectScope: 'current-module' | 'all-modules';
  activeMaterial?: Material;
  materials: Material[];
  edgeBands: EdgeBand[];
  hardware: Hardware[];
  userTemplates: UserTemplate[];
  projectConfig: ProjectConfig | null;
  resolvedPieces: ResolvedPieceWithCutSize[];
  consolidatedPieces: ConsolidatedPiece[];
  modulesToConsolidate: ModuleToConsolidate[];
  activeModuleToConsolidate: ModuleToConsolidate[];
  assemblySheet: AssemblySheet | null;
  machiningSheets: PieceMachiningSheet[];
  wallShelvingOutput: WallShelvingOutput | null;
  wallShelvingDefinition: WallShelvingDefinition | null;
  countertopCalculation: CountertopCalculationResult | null;
  commercialQuote: CommercialQuoteResult | null;
  initialDb?: IDBDatabase;
  serializeCurrentModule: () => ProjectModuleItem;
  setStatusMessage: (msg: string) => void;
  setError: (err: string | null) => void;
}

export function useModuleExports(params: UseModuleExportsParams) {
  const {
    project,
    projectModules,
    activeModuleId,
    activeModuleItem,
    currentModule,
    selectedTemplateId,
    projectScope,
    activeMaterial,
    materials,
    edgeBands,
    hardware,
    userTemplates,
    projectConfig,
    resolvedPieces,
    consolidatedPieces,
    modulesToConsolidate,
    activeModuleToConsolidate,
    assemblySheet,
    machiningSheets,
    wallShelvingOutput,
    wallShelvingDefinition,
    countertopCalculation,
    commercialQuote,
    initialDb,
    serializeCurrentModule,
    setStatusMessage,
    setError,
  } = params;

  const materialNameMap = useMemo<Record<string, string>>(
    () => Object.fromEntries(materials.map((m) => [m.id, m.name])),
    [materials],
  );

  const friendlyModuleName = activeModuleItem?.name?.trim() || 'Módulo Principal';

  const exportCsv = useCallback(() => {
    const isGlobal = projectScope === 'all-modules';
    const targetModules = isGlobal ? modulesToConsolidate : activeModuleToConsolidate;
    const piecesToExport = isGlobal
      ? consolidatedPieces
      : consolidateProjectPieces(activeModuleToConsolidate);
    if (piecesToExport.length === 0) return;

    const includeGauges = Boolean(projectConfig?.nesting?.includeAssemblyGaugesInCutPlan);
    const auxPieces: ResolvedPieceWithCutSize[] = [];
    if (includeGauges) {
      const pushGaugeStrips = (prefix: string, gauges: NonNullable<ModuleToConsolidate['gauges']>) => {
        for (const g of gauges) {
          const stripCount = Math.min(2, Math.max(1, g.occurrences.length));
          for (let i = 0; i < stripCount; i++) {
            const suffix = stripCount > 1 ? `-${i + 1}` : '';
            auxPieces.push({
              id: `${prefix}${g.piece.id}${suffix}`,
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
            });
          }
        }
      };

      if (isGlobal) {
        for (const mod of targetModules) {
          if (mod.gauges) pushGaugeStrips(`${mod.moduleId}__`, mod.gauges);
        }
      } else if (assemblySheet?.gauges) {
        pushGaugeStrips('', assemblySheet.gauges);
      }
    }

    const allPieces = [...piecesToExport, ...auxPieces];
    const csvContent = exportCutListCsv(allPieces);
    const fileName = isGlobal
      ? `cut-list-proyecto-${(project?.name ?? 'global').toLowerCase().replace(/\s+/g, '-')}.csv`
      : `cut-list-${currentModule?.id ?? 'module'}.csv`;

    triggerBrowserDownload(fileName, csvContent, 'text/csv;charset=utf-8;');
    setStatusMessage(
      `Lista de corte (${isGlobal ? 'Todo el Proyecto' : 'Módulo Actual'}) exportada a ${fileName}.`,
    );
  }, [
    projectScope,
    modulesToConsolidate,
    consolidatedPieces,
    activeModuleToConsolidate,
    assemblySheet,
    project,
    currentModule,
    projectConfig,
    setStatusMessage,
  ]);

  const exportPdf = useCallback(() => {
    if (!activeMaterial) return;

    const isGlobal = projectScope === 'all-modules';
    const targetModules = isGlobal ? modulesToConsolidate : activeModuleToConsolidate;
    const hasPieces = isGlobal ? consolidatedPieces.length > 0 : resolvedPieces.length > 0;
    if (!hasPieces) return;

    const nesting = runProjectNesting(targetModules, {
      materials,
      sawKerfMm: projectConfig?.nesting?.sawKerfMm,
      trimMarginMm: projectConfig?.nesting?.sheetTrimMarginMm,
      grainDirectionMode: projectConfig?.nesting?.grainDirectionMode,
      respectGrain: projectConfig?.nesting?.respectGrain,
      optimizationGoal: projectConfig?.nesting?.optimizationGoal,
      includeAssemblyGauges: projectConfig?.nesting?.includeAssemblyGaugesInCutPlan,
    });

    const projectName = project?.name ?? 'Proyecto';
    const title = isGlobal
      ? `Plano de Corte Consolidado — ${projectName}`
      : `Plano de Corte — ${friendlyModuleName}`;
    const doc = exportCutPlanPdf(nesting, title, materialNameMap);
    const pdfBlob = doc.output('blob');
    const fileName = isGlobal
      ? `plano-corte-proyecto-${projectName.toLowerCase().replace(/\s+/g, '-')}.pdf`
      : `plano-corte-${currentModule?.id ?? 'modulo'}.pdf`;

    triggerBrowserDownload(fileName, pdfBlob, 'application/pdf');
    setStatusMessage(
      isGlobal
        ? `Plano de corte global del proyecto exportado a ${fileName}.`
        : `Plano de corte (nesting) exportado a ${fileName}.`,
    );
  }, [
    activeMaterial,
    projectScope,
    consolidatedPieces,
    modulesToConsolidate,
    activeModuleToConsolidate,
    friendlyModuleName,
    materialNameMap,
    resolvedPieces,
    materials,
    projectConfig,
    project,
    currentModule,
    setStatusMessage,
  ]);

  const exportAssemblyPdf = useCallback(() => {
    if (selectedTemplateId === 'wall-shelves' && wallShelvingOutput && wallShelvingDefinition) {
      const doc = exportWallShelvesInstallationPdf(
        wallShelvingOutput,
        wallShelvingDefinition,
        `Plano de Replanteo en Pared — ${friendlyModuleName}`,
      );
      const pdfBlob = doc.output('blob');
      const fileName = `plano-replanteo-pared-${currentModule?.id ?? 'estanteria'}.pdf`;
      triggerBrowserDownload(fileName, pdfBlob, 'application/pdf');
      setStatusMessage(`Plano de replanteo en pared exportado a ${fileName}.`);
      return;
    }
    if (!assemblySheet) return;
    const doc = exportAssemblyGuidePdf(assemblySheet, `Guía de Armado — ${friendlyModuleName}`);
    const pdfBlob = doc.output('blob');
    const fileName = `guia-armado-${currentModule?.id ?? 'modulo'}.pdf`;
    triggerBrowserDownload(fileName, pdfBlob, 'application/pdf');
    setStatusMessage(`Guía de armado exportada a ${fileName}.`);
  }, [
    selectedTemplateId,
    wallShelvingOutput,
    wallShelvingDefinition,
    assemblySheet,
    friendlyModuleName,
    currentModule,
    setStatusMessage,
  ]);

  const exportMarmoleriaPdfReport = useCallback(() => {
    if (!countertopCalculation) return;
    const doc = exportMarmoleriaPdf(
      countertopCalculation,
      `Plano de Marmolería — ${friendlyModuleName}`,
    );
    const pdfBlob = doc.output('blob');
    const fileName = `plano-marmoleria-${currentModule?.id ?? 'mesada'}.pdf`;
    triggerBrowserDownload(fileName, pdfBlob, 'application/pdf');
    setStatusMessage(`Plano de marmolería exportado a ${fileName}.`);
  }, [countertopCalculation, friendlyModuleName, currentModule, setStatusMessage]);

  const exportMachiningPdf = useCallback(
    (pieceId?: string) => {
      if (machiningSheets.length === 0) return;
      const targetSheets = pieceId
        ? machiningSheets.filter((s) => s.pieceId === pieceId)
        : machiningSheets;
      if (targetSheets.length === 0) return;

      const singleTitle = targetSheets[0]
        ? `Plano de Mecanizado — ${translateRoleKey(targetSheets[0].role)}`
        : 'Plano de Mecanizado';

      const doc = exportMachiningSheetPdf(
        targetSheets,
        pieceId ? singleTitle : `Planos de Mecanizado — ${friendlyModuleName}`,
        materialNameMap,
      );
      const pdfBlob = doc.output('blob');
      const fileName = pieceId
        ? `mecanizado-${pieceId}.pdf`
        : `mecanizado-${currentModule?.id ?? 'modulo'}.pdf`;
      triggerBrowserDownload(fileName, pdfBlob, 'application/pdf');
      setStatusMessage(`Planos de mecanizado exportados a ${fileName}.`);
    },
    [machiningSheets, friendlyModuleName, materialNameMap, currentModule, setStatusMessage],
  );

  const exportMachiningDxf = useCallback(
    (pieceId?: string) => {
      if (machiningSheets.length === 0) return;
      const exportSheetFaces = (sheet: PieceMachiningSheet) => {
        let exportedCount = 0;
        const dxfA = exportMachiningSheetToDxf(sheet, {
          face: 'face-A',
          useCutDimensions: true,
          includeGrooveCenterline: true,
          encodeDepthInLayer: true,
          includeEdgeDrills: true,
        });
        triggerBrowserDownload(`${sheet.pieceId}-face-A.dxf`, dxfA, 'application/dxf');
        exportedCount += 1;

        if (sheet.requiresTurn) {
          const dxfB = exportMachiningSheetToDxf(sheet, {
            face: 'face-B',
            useCutDimensions: true,
            includeGrooveCenterline: true,
            encodeDepthInLayer: true,
          });
          triggerBrowserDownload(`${sheet.pieceId}-face-B.dxf`, dxfB, 'application/dxf');
          exportedCount += 1;
        }
        return exportedCount;
      };

      if (pieceId) {
        const targetSheet = machiningSheets.find((s) => s.pieceId === pieceId);
        if (!targetSheet) return;
        const count = exportSheetFaces(targetSheet);
        setStatusMessage(
          count > 1
            ? `Archivos DXF exportados (Cara A y Cara B): ${translateRoleKey(targetSheet.role)}`
            : `Archivo DXF exportado: ${translateRoleKey(targetSheet.role)}`,
        );
      } else {
        let totalFiles = 0;
        for (const sheet of machiningSheets) {
          totalFiles += exportSheetFaces(sheet);
        }
        setStatusMessage(`Se exportaron ${totalFiles} archivos DXF.`);
      }
    },
    [machiningSheets, setStatusMessage],
  );

  const exportProjectConfigFile = useCallback(() => {
    if (!projectConfig) return;
    const jsonStr = exportProjectConfigJson(projectConfig);
    const fileName = `${projectConfig.projectId}-config.json`;
    triggerBrowserDownload(fileName, jsonStr, 'application/json');
    setStatusMessage(`Configuración exportada a ${fileName}.`);
  }, [projectConfig, setStatusMessage]);

  const exportFullBackup = useCallback(
    async (preferShare = false) => {
      try {
        const currentPacked = serializeCurrentModule();
        const allMods = projectModules.map((m) => (m.id === activeModuleId ? currentPacked : m));
        const liveProject: Project = {
          schemaVersion: 1,
          id: project?.id ?? 'proj-default',
          name: project?.name ?? 'Proyecto CadCat',
          clientName: project?.clientName ?? 'Cliente Estándar',
          description: project?.description ?? '',
          modules: allMods,
          activeModuleId,
          createdAt: project?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const existingProjects = await loadAllProjectsFromDb(initialDb);
        const otherProjects = existingProjects.filter((p) => p.id !== liveProject.id);
        const jsonStr = buildBackupBundleJson({
          appVersion: APP_VERSION,
          projects: [liveProject, ...otherProjects],
          projectConfig,
          materials,
          edgeBands,
          hardware,
          userTemplates,
        });

        const safeSlug =
          (liveProject.name || 'cadcat')
            .toLowerCase()
            .replace(/[^a-z0-9-_]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'proyecto';
        const fileName = `${safeSlug}.cadcat.json`;

        if (
          preferShare &&
          typeof navigator !== 'undefined' &&
          typeof navigator.share === 'function' &&
          typeof File !== 'undefined'
        ) {
          const shareFile = new File([jsonStr], fileName, { type: 'application/json' });
          const canShareFiles =
            typeof navigator.canShare === 'function'
              ? navigator.canShare({ files: [shareFile] })
              : true;
          if (canShareFiles) {
            try {
              await navigator.share({
                title: `CadCat Backup · ${liveProject.name}`,
                text: `Respaldo completo CadCat (${allMods.length} módulos)`,
                files: [shareFile],
              });
              setStatusMessage(`Backup compartido (${fileName}).`);
              return;
            } catch (shareErr) {
              if (shareErr instanceof Error && shareErr.name === 'AbortError') {
                return;
              }
            }
          }
        }

        triggerBrowserDownload(fileName, jsonStr, 'application/json');
        setStatusMessage(`Backup completo exportado a ${fileName}.`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al exportar el respaldo completo');
      }
    },
    [
      serializeCurrentModule,
      projectModules,
      activeModuleId,
      project,
      initialDb,
      projectConfig,
      materials,
      edgeBands,
      hardware,
      userTemplates,
      setStatusMessage,
      setError,
    ],
  );

  const exportPlacacentroCsvAction = useCallback(() => {
    const isGlobal = projectScope === 'all-modules';
    const piecesToExport = isGlobal
      ? consolidatedPieces
      : consolidateProjectPieces(activeModuleToConsolidate);
    if (piecesToExport.length === 0) return;

    const csvContent = exportPlacacentroCsv(piecesToExport, materials, edgeBands, {
      includeAuxiliary: false,
      defaultModuleName: friendlyModuleName,
    });
    const safeName = (isGlobal ? project?.name ?? 'proyecto' : friendlyModuleName)
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'modulo';
    const fileName = `placacentro-${safeName}.csv`;

    triggerBrowserDownload(fileName, csvContent, 'text/csv;charset=utf-8;');
    setStatusMessage(`Planilla formato Placacentro (CorteCloud/Lepton) exportada a ${fileName}.`);
  }, [
    projectScope,
    consolidatedPieces,
    activeModuleToConsolidate,
    materials,
    edgeBands,
    friendlyModuleName,
    project,
    setStatusMessage,
  ]);

  const exportCommercialQuotePdfAction = useCallback(() => {
    if (!commercialQuote) return;
    const projectName = project?.name ?? projectConfig?.projectName ?? 'Proyecto CadCat';
    const clientName = project?.clientName ?? projectConfig?.clientName ?? 'Cliente';
    const doc = exportCommercialQuotePdf(commercialQuote, {
      projectName,
      clientName,
    });
    const pdfBlob = doc.output('blob');
    const safeSlug = projectName
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'presupuesto';
    const fileName = `presupuesto-cliente-${safeSlug}.pdf`;
    triggerBrowserDownload(fileName, pdfBlob, 'application/pdf');
    setStatusMessage(`Presupuesto comercial para cliente exportado a ${fileName}.`);
  }, [commercialQuote, project, projectConfig, setStatusMessage]);

  return {
    exportCsv,
    exportPlacacentroCsv: exportPlacacentroCsvAction,
    exportPdf,
    exportCommercialQuotePdf: exportCommercialQuotePdfAction,
    exportAssemblyPdf,
    exportMarmoleriaPdfReport,
    exportMachiningPdf,
    exportMachiningDxf,
    exportProjectConfigFile,
    exportFullBackup,
  };
}
