import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildModularModule,
  JointGraph,
  generateBillOfMaterials,
  generateAssemblySheet,
  exportAssemblyGuidePdf,
  deriveModuleDrillOperations,
  deriveModuleGrooveOperations,
  buildModuleMachiningSheets,
  exportMachiningSheetPdf,
  runProjectNesting,
  exportCutPlanPdf,
  calculatePieceCutSize,
  CamDowelJointStrategy,
  createPiece,
  createJoint,
  createRectangularContour,
  type ModularModuleDefinition,
} from '../src/resolver';
import { getSeedMaterials, getSeedEdgeBands } from '../src/catalog';
import { loadDefaultProjectConfigFile, loadModularPresetsConfigFile } from '../src/config';
import type { JointStrategy } from '../src/model';
import { M3ConfirmDialog, M3PromptDialog } from '../src/ui/M3Dialog';

const defaultConfig = loadDefaultProjectConfigFile();
const presets = loadModularPresetsConfigFile();
const materials = getSeedMaterials().materials;
const edgeBands = getSeedEdgeBands().edgeBands;
const matWhite18 = materials.find((m) => m.id === 'mat-egger-white-18')!;
const matOak18 = materials.find((m) => m.id === 'mat-egger-oak-18')!;
const ebWhite08 = edgeBands.find((e) => e.id === 'eb-white-08')!;

function resolvePresetFull(presetId: string, jointStrategy: JointStrategy = 'confirmat') {
  const preset = presets.find((p) => p.id === presetId)!;
  const def: ModularModuleDefinition = {
    id: `module-${preset.id}`,
    carcass: {
      width: preset.defaultDimensions.width,
      height: preset.defaultDimensions.height,
      depth: preset.defaultDimensions.depth,
      ...preset.carcass,
      backingType: 'groove',
      backingThicknessMm: 3,
    },
    grid: preset.grid,
    bays: preset.bays,
    materials: {
      carcassMaterialId: matWhite18.id,
      frontsMaterialId: presetId === 'preset-door-cabinet-2' ? matOak18.id : matWhite18.id,
      drawerBoxesMaterialId: matWhite18.id,
      backingsMaterialId: 'mat-mdf-raw-3',
    },
    edgeBandId: ebWhite08.id,
  };

  const built = buildModularModule(def, {
    carcassThicknessMm: 18,
    frontThicknessMm: 18,
    boxThicknessMm: 18,
    backingThicknessMm: 3,
    edgeBands,
    hardwareConfig: defaultConfig.hardware,
  });

  const resolvedPieces = built.resolvedPieces.map((p) => {
    const cut = calculatePieceCutSize(p, edgeBands);
    return {
      ...p,
      dimensionsMm: cut.finishedDimensionsMm,
      cutDimensionsMm: cut.cutDimensionsMm,
      bandedEdges: [
        cut.bandedEdges.top,
        cut.bandedEdges.bottom,
        cut.bandedEdges.left,
        cut.bandedEdges.right,
      ].filter((b): b is NonNullable<typeof b> => Boolean(b)),
    };
  });

  const machiningConfig = {
    ...defaultConfig.machining,
    jointStrategy,
  };

  const drillOps = deriveModuleDrillOperations(
    resolvedPieces,
    built.module.joints,
    machiningConfig,
  );
  const grooveOps = deriveModuleGrooveOperations(resolvedPieces, built.module.joints, {
    backingThicknessMm: 3,
  });
  const machiningSheets = buildModuleMachiningSheets(resolvedPieces, drillOps, grooveOps);

  const bom = generateBillOfMaterials(
    {
      moduleId: built.module.id,
      parameters: built.module.parameters,
      pieces: built.resolvedPieces,
      joints: built.module.joints,
      placementTree: built.placementTree,
      jointGraph: new JointGraph(built.module.joints),
    },
    edgeBands,
    undefined,
    jointStrategy,
  );

  const assemblySheet = generateAssemblySheet({
    module: {
      moduleId: built.module.id,
      pieces: resolvedPieces,
      joints: built.module.joints,
    },
    moduleName: preset.name,
    machiningConfig,
    machiningSheets,
    moduleDimensions: {
      width: def.carcass.width,
      height: def.carcass.height,
      depth: def.carcass.depth,
    },
  });

  return { preset, built, resolvedPieces, drillOps, grooveOps, machiningSheets, bom, assemblySheet };
}

describe('Ola 2 — SSOT AssemblySheet, Machining Precision, CutPlanPDF, SOLID & WCAG', () => {
  describe('AssemblySheet SSOT Hardware & Operations Parity', () => {
    it.each([
      'preset-empty',
      'preset-base-shelf',
      'preset-door-cabinet-2',
      'preset-drawer-unit-3',
      'preset-partition-combo',
    ])('matches BOM total hardware count 1:1 for %s', (presetId) => {
      const { bom, assemblySheet } = resolvePresetFull(presetId);
      const guideTotal = assemblySheet.totalHardwareBOM.reduce((sum, h) => sum + h.quantity, 0);
      expect(guideTotal).toBe(bom.totalHardwareCount);
    });

    it.each<JointStrategy>(['confirmat', 'cam-dowel', 'dowel', 'screw', 'dowel-and-confirmat'] as JointStrategy[])(
      'respects jointStrategy=%s in AssemblySheet totalHardwareBOM matching BOM',
      (strategy) => {
        const { bom, assemblySheet } = resolvePresetFull('preset-empty', strategy);
        const guideTotal = assemblySheet.totalHardwareBOM.reduce((sum, h) => sum + h.quantity, 0);
        expect(guideTotal).toBe(bom.totalHardwareCount);

        if (strategy === 'cam-dowel') {
          expect(assemblySheet.totalHardwareBOM.some((h) => h.type === 'minifix')).toBe(true);
          expect(assemblySheet.totalHardwareBOM.some((h) => h.type === 'confirmat')).toBe(false);
          expect(assemblySheet.panelDetails.some((p) => p.hardwareInstalled.some((h) => h.type === 'minifix'))).toBe(true);
        } else if ((strategy as string) === 'dowel') {
          expect(assemblySheet.totalHardwareBOM.some((h) => h.type === 'dowel')).toBe(true);
          expect(assemblySheet.panelDetails.some((p) => p.hardwareInstalled.some((h) => h.type === 'dowel'))).toBe(true);
        } else if (strategy === 'screw') {
          expect(assemblySheet.totalHardwareBOM.some((h) => h.type === 'wood-screw')).toBe(true);
          expect(assemblySheet.panelDetails.some((p) => p.hardwareInstalled.some((h) => h.type === 'wood-screw'))).toBe(true);
        } else if (strategy === 'dowel-and-confirmat') {
          expect(assemblySheet.totalHardwareBOM.some((h) => h.type === 'confirmat')).toBe(true);
          expect(assemblySheet.totalHardwareBOM.some((h) => h.type === 'dowel')).toBe(true);
          expect(assemblySheet.panelDetails.some((p) => p.hardwareInstalled.some((h) => h.type === 'dowel'))).toBe(true);
        }
      },
    );

    it('includes edge operations and grooves in AssemblySheet panelDetails matching PieceMachiningSheet.totalOperations', () => {
      const { machiningSheets, assemblySheet } = resolvePresetFull('preset-partition-combo');
      for (const detail of assemblySheet.panelDetails) {
        const sheet = machiningSheets.find((s) => s.pieceId === detail.pieceId);
        if (sheet && sheet.totalOperations > 0) {
          expect(detail.operations.length).toBe(sheet.totalOperations);
        }
      }
    });

    it('removes hardcoded 2mm tip, English gauge label, and technical module IDs in AssemblySheet & PDF', () => {
      const { assemblySheet } = resolvePresetFull('preset-base-shelf');
      const prepStep = assemblySheet.steps[0]!;
      expect(prepStep.workshopTips?.join(' ')).toContain('0.8 mm');
      expect(prepStep.workshopTips?.join(' ')).not.toContain('tapacantos de 2 mm');
      expect(assemblySheet.steps.some((s) => s.instruction.includes('gauge '))).toBe(false);
      expect(assemblySheet.title).not.toContain('module-preset-');

      const doc = exportAssemblyGuidePdf(assemblySheet);
      const pages = (doc as unknown as { internal: { pages: string[][] } }).internal.pages;
      const pdfText = pages.flat().join('\n');
      expect(pdfText).not.toContain('module-preset-');
    });
  });

  describe('CutPlanPDF Canonical W x H & Human Material Names', () => {
    it('keeps W x H cut dimensions un-inverted for vertical grained doors and renders material name', () => {
      const { resolvedPieces, bom, assemblySheet } = resolvePresetFull('preset-door-cabinet-2');
      const nesting = runProjectNesting(
        [
          {
            moduleId: 'mod-1',
            moduleName: 'Alacena',
            quantity: 1,
            pieces: resolvedPieces,
            bom,
            gauges: assemblySheet.gauges,
          },
        ],
        {
          materials,
          grainDirectionMode: 'auto',
          sawKerfMm: defaultConfig.nesting.sawKerfMm,
          trimMarginMm: defaultConfig.nesting.sheetTrimMarginMm,
        },
      );

      const oakResult = nesting.resultsByMaterial[matOak18.id]!;
      const doorPlacement = oakResult.sheets[0]!.placedPieces.find((p) =>
        p.name?.includes('door'),
      )!;
      expect(doorPlacement.displayCutWidthMm).toBeLessThan(doorPlacement.displayCutHeightMm!);

      const materialNameMap = Object.fromEntries(materials.map((m) => [m.id, m.name]));
      const doc = exportCutPlanPdf(nesting, 'Plano de Corte — Alacena', materialNameMap);
      const pages = (doc as unknown as { internal: { pages: string[][] } }).internal.pages;
      const pdfText = pages.flat().join('\n');
      expect(pdfText).toContain(
        `${doorPlacement.displayCutWidthMm} x ${doorPlacement.displayCutHeightMm} mm`,
      );
      expect(pdfText).not.toContain('mat-egger-oak-18');
      expect(pdfText).toContain(matOak18.name);
    });
  });

  describe('Machining Safety & Spanish Localization', () => {
    it('clamps Minifix cam pocket depth safely on 15 mm boards so melamine is not pierced', () => {
      const strategy = new CamDowelJointStrategy();
      const side = createPiece({
        id: 'side-l',
        role: 'side-left',
        materialId: 'mat-15',
        contour: createRectangularContour(500, 700),
        thicknessMm: 15,
      });
      const shelf = createPiece({
        id: 'shelf-1',
        role: 'shelf',
        materialId: 'mat-15',
        contour: createRectangularContour(500, 500),
        thicknessMm: 15,
      });
      const joint = createJoint({
        a: { pieceId: 'side-l', faceId: 'inner' },
        b: { pieceId: 'shelf-1', faceId: 'left-edge' },
        kind: 'cam-dowel',
      });

      let idx = 0;
      const ops = strategy.generateOperations({
        pieceA: side,
        pieceB: shelf,
        joint,
        effectiveKind: 'cam-dowel',
        config: defaultConfig.machining,
        generateOpId: () => `op-${++idx}`,
      });
      const pocket = ops.find((o) => o.diameterMm === defaultConfig.machining.minifixPocketDiameterMm)!;
      expect(pocket.depthMm).toBe(12);
      expect(pocket.depthMm).toBeLessThanOrEqual(shelf.thicknessMm - 3);
      expect(pocket.description).toContain('Caja excéntrica Minifix');
    });

    it('renders friendly piece and material names in MachiningPDF without English descriptions', () => {
      const { machiningSheets } = resolvePresetFull('preset-empty');
      const materialNameMap = Object.fromEntries(materials.map((m) => [m.id, m.name]));
      const doc = exportMachiningSheetPdf(machiningSheets, 'Planos de Mecanizado', materialNameMap);
      const pages = (doc as unknown as { internal: { pages: string[][] } }).internal.pages;
      const pdfText = pages.flat().join('\n');
      expect(pdfText).not.toContain('Confirmat through hole');
      expect(pdfText).not.toContain('mat-egger-white-18');
      expect(pdfText).toContain(matWhite18.name);
    });
  });

  describe('SOLID Architecture Purity', () => {
    it('keeps src/resolver/ free of Three.js and DOM download dependencies', () => {
      const resolverRoot = path.resolve(process.cwd(), 'src/resolver');
      const walk = (dir: string): string[] => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        return entries.flatMap((entry) => {
          const full = path.join(dir, entry.name);
          return entry.isDirectory() ? walk(full) : entry.name.endsWith('.ts') ? [full] : [];
        });
      };
      const files = walk(resolverRoot);
      for (const file of files) {
        const src = fs.readFileSync(file, 'utf-8');
        expect(src, `Found three import in ${file}`).not.toMatch(/from\s+['"]three['"]/);
        expect(src, `Found DOM download in ${file}`).not.toContain('document.createElement');
      }
    });

    it('replaces all blocking window.confirm / window.prompt calls in src/ui/', () => {
      const uiRoot = path.resolve(process.cwd(), 'src/ui');
      const walk = (dir: string): string[] => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        return entries.flatMap((entry) => {
          const full = path.join(dir, entry.name);
          return entry.isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
        });
      };
      for (const file of walk(uiRoot)) {
        const src = fs.readFileSync(file, 'utf-8');
        expect(src, `window.confirm found in ${file}`).not.toMatch(/window\.confirm\s*\(/);
        expect(src, `window.prompt found in ${file}`).not.toMatch(/window\.prompt\s*\??\.?\(/);
      }
    });
  });

  describe('WCAG 2.1 AA M3 Dialogs & Focus Trap', () => {
    it('renders M3ConfirmDialog with alertdialog semantics, Escape close, and confirm callback', () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      act(() => {
        root.render(
          <M3ConfirmDialog
            isOpen={true}
            title="Eliminar elemento"
            message="¿Confirmás esta acción?"
            onConfirm={onConfirm}
            onCancel={onCancel}
          />,
        );
      });

      expect(container.querySelector('[role="alertdialog"]')).toBeTruthy();
      const confirmBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Confirmar',
      )!;
      act(() => {
        confirmBtn.click();
      });
      expect(onConfirm).toHaveBeenCalledTimes(1);

      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });
      expect(onCancel).toHaveBeenCalledTimes(1);

      act(() => {
        root.unmount();
      });
      container.remove();
    });

    it('renders M3PromptDialog with dialog semantics and submits trimmed value', () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      act(() => {
        root.render(
          <M3PromptDialog
            isOpen={true}
            title="Nueva plantilla"
            label="Nombre:"
            defaultValue="  Mi Mueble  "
            onConfirm={onConfirm}
            onCancel={onCancel}
          />,
        );
      });

      expect(container.querySelector('[role="dialog"]')).toBeTruthy();
      const saveBtn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent?.trim() === 'Guardar',
      )!;
      act(() => {
        saveBtn.click();
      });
      expect(onConfirm).toHaveBeenCalledWith('Mi Mueble');

      act(() => {
        root.unmount();
      });
      container.remove();
    });
  });
});
