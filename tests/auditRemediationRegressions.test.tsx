import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  buildModularModule,
  deriveModuleGrooveOperations,
  deriveModuleDrillOperations,
  generateBillOfMaterials,
  PlacementTree,
  JointGraph,
  getContourBoundingBox,
  TEMPLATES,
  exportMachiningSheetToDxf,
  type PieceMachiningSheet,
} from '../src/resolver';
import {
  projectSchema,
  type Material,
  type EdgeBand,
} from '../src/model';
import {
  deleteDatabase,
  saveProjectToDb,
  loadAllProjectsFromDb,
  importBackupBundleToDb,
} from '../src/storage';
import { ModuleForm } from '../src/ui/ModuleForm';
import { loadDefaultProjectConfigFile, loadModularPresetsConfigFile } from '../src/config';

const mockMaterials: Material[] = [
  {
    id: 'mat-egger-white-18',
    name: 'Egger Blanco 18mm',
    thicknessMm: 18,
    sheetSizeMm: { length: 2800, width: 2070 },
    hasGrain: false,
    milling: { hidden: 'yes', visible: 'no', onStructuralPiece: 'limited' },
  },
  {
    id: 'mat-mdf-white-3',
    name: 'MDF Blanco 3mm',
    thicknessMm: 3,
    sheetSizeMm: { length: 2800, width: 2070 },
    hasGrain: false,
    milling: { hidden: 'yes', visible: 'no', onStructuralPiece: 'no' },
  },
];

const mockEdgeBands: EdgeBand[] = [
  {
    id: 'eb-white-08',
    name: 'Melamínico Blanco 0.8mm',
    kind: 'adhesive',
    thicknessMm: 0.8,
    pricePerMeter: 'TO_CONFIRM',
  },
];

describe('Audit Remediation Regressions (v0.33.0)', () => {
  beforeEach(async () => {
    await deleteDatabase();
  });

  it('preserves carcass bottom rear groove on drawer-unit modules', () => {
    const presets = loadModularPresetsConfigFile();
    const drawerPreset = presets.find((p) => p.id === 'preset-drawer-unit-3')!;
    const out = buildModularModule(
      {
        id: 'module-preset-drawer-unit-3',
        carcass: {
          width: drawerPreset.defaultDimensions.width,
          height: drawerPreset.defaultDimensions.height,
          depth: drawerPreset.defaultDimensions.depth,
          ...drawerPreset.carcass,
          backingType: 'groove',
          backingThicknessMm: 3,
        },
        bays: drawerPreset.bays,
        materials: drawerPreset.defaultMaterials,
      },
      { carcassThicknessMm: 18 },
    );

    const grooves = deriveModuleGrooveOperations(out.resolvedPieces, out.module.joints, {
      backingThicknessMm: 3,
    });
    const carcassBottomGroove = grooves.find((g) => g.pieceId.includes('carcass-bottom'));
    expect(carcassBottomGroove).toBeDefined();
  });

  it('keeps rail-front <-> partition drills strictly inside the 80mm rail height', () => {
    const presets = loadModularPresetsConfigFile();
    const combo = presets.find((p) => p.id === 'preset-partition-combo')!;
    const out = buildModularModule(
      {
        id: 'module-partition-combo',
        carcass: {
          width: combo.defaultDimensions.width,
          height: combo.defaultDimensions.height,
          depth: combo.defaultDimensions.depth,
          ...combo.carcass,
        },
        grid: combo.grid,
        bays: combo.bays,
        materials: combo.defaultMaterials,
      },
      { carcassThicknessMm: 18 },
    );

    const drills = deriveModuleDrillOperations(
      out.resolvedPieces,
      out.module.joints,
      loadDefaultProjectConfigFile().machining,
    );

    const railFront = out.module.pieces.find((p) => p.id.includes('rail-front'))!;
    const railDim = getContourBoundingBox(railFront.contour);
    const railDrills = drills.filter((d) => d.pieceId === railFront.id);
    expect(railDrills.length).toBeGreaterThan(0);
    for (const d of railDrills) {
      expect(d.positionMm.y).toBeGreaterThanOrEqual(0);
      expect(d.positionMm.y).toBeLessThanOrEqual(railDim.height);
      expect(d.positionMm.x).toBeGreaterThanOrEqual(0);
      expect(d.positionMm.x).toBeLessThanOrEqual(railDim.width);
    }
  });

  it('computes exact non-duplicated slide hardware counts in BOM and respects jointStrategy', () => {
    const presets = loadModularPresetsConfigFile();
    const drawerPreset = presets.find((p) => p.id === 'preset-drawer-unit-3')!;
    const out = buildModularModule(
      {
        id: 'mod-bom-drawers',
        carcass: {
          width: drawerPreset.defaultDimensions.width,
          height: drawerPreset.defaultDimensions.height,
          depth: drawerPreset.defaultDimensions.depth,
          ...drawerPreset.carcass,
        },
        bays: drawerPreset.bays,
        materials: drawerPreset.defaultMaterials,
      },
      { carcassThicknessMm: 18 },
    );
    const bom = generateBillOfMaterials(
      {
        moduleId: out.module.id,
        parameters: out.module.parameters,
        pieces: out.resolvedPieces,
        joints: out.module.joints,
        placementTree: new PlacementTree(out.module.rootPieceId),
        jointGraph: new JointGraph(out.module.joints),
      },
      mockEdgeBands,
      undefined,
      'screw',
    );

    // 3 drawers = 6 slide rails (3 pairs), NOT 12
    const slides = bom.hardware.find((h) => h.hardwareId === 'hw-slide-telescopic');
    expect(slides?.count).toBe(6);

    // Screw strategy must emit wood screws, not confirmat
    const screws = bom.hardware.find((h) => h.hardwareId === 'hw-screw-wood');
    expect(screws).toBeDefined();
    expect(screws!.count).toBeGreaterThan(0);
  });

  it('persists plinth, rails, and customPieceOperations in typed Project schema without loss', () => {
    const parsed = projectSchema.parse({
      schemaVersion: 1,
      id: 'proj-roundtrip',
      name: 'Cocina Completa',
      activeModuleId: 'mod-1',
      createdAt: '2026-11-27T00:00:00.000Z',
      updatedAt: '2026-11-27T00:00:00.000Z',
      modules: [
        {
          id: 'mod-1',
          name: 'Bajo Mesada',
          quantity: 1,
          templateId: 'modular',
          width: 800,
          height: 720,
          depth: 560,
          selectedMaterialId: 'mat-egger-white-18',
          selectedEdgeBandId: 'eb-white-08',
          hasPlinth: true,
          plinthHeightMm: 120,
          plinthSetbackMm: 60,
          railOrientation: 'vertical',
          hasMiddleBrace: true,
          middleBraceWidthMm: 90,
          hasWallHangingRail: true,
          wallHangingRailWidthMm: 100,
          customPieceOperations: {
            'side-left': [
              {
                kind: 'drill',
                id: 'custom-1',
                pieceId: 'side-left',
                faceType: 'face-A',
                xMm: 37,
                yMm: 100,
                diameterMm: 5,
                depthMm: 12,
                isThrough: false,
              },
            ],
          },
        },
      ],
    });

    expect(parsed.modules[0]?.hasPlinth).toBe(true);
    expect(parsed.modules[0]?.plinthHeightMm).toBe(120);
    expect(parsed.modules[0]?.railOrientation).toBe('vertical');
    expect(parsed.modules[0]?.customPieceOperations?.['side-left']?.length).toBe(1);
  });

  it('keeps existing IndexedDB projects intact when atomic backup import fails validation', async () => {
    const existing = projectSchema.parse({
      schemaVersion: 1,
      id: 'proj-existing',
      name: 'Proyecto Seguro',
      activeModuleId: 'm1',
      createdAt: '2026-11-27T00:00:00.000Z',
      updatedAt: '2026-11-27T00:00:00.000Z',
      modules: [
        {
          id: 'm1',
          name: 'Módulo 1',
          quantity: 1,
          templateId: 'modular',
          width: 600,
          height: 720,
          depth: 560,
          selectedMaterialId: 'mat-egger-white-18',
          selectedEdgeBandId: 'eb-white-08',
        },
      ],
    });
    await saveProjectToDb(existing);

    const invalidBundle = {
      format: 'cadcat-backup',
      schemaVersion: 1,
      exportedAt: '2026-11-27T00:00:00.000Z',
      projects: [{ id: 'broken-invalid-project' }],
      userTemplates: [],
      catalogs: { materials: [], edgeBands: [], hardware: [] },
    } as unknown as Parameters<typeof importBackupBundleToDb>[0];

    await expect(importBackupBundleToDb(invalidBundle)).rejects.toThrow();

    const after = await loadAllProjectsFromDb();
    expect(after.some((p) => p.id === 'proj-existing')).toBe(true);
  });

  it('keeps template selector accessible when wall-shelves template is active (no UX dead-end)', () => {
    const html = renderToString(
      <ModuleForm
        isMobile={false}
        width={1200}
        height={960}
        depth={250}
        selectedTemplateId="wall-shelves"
        templates={[
          ...TEMPLATES,
          { id: 'wall-shelves', name: 'Estantes de Pared', description: 'Estantes flotantes', build: TEMPLATES[0]!.build },
        ]}
        onTemplateChange={() => {}}
        materials={mockMaterials}
        edgeBands={mockEdgeBands}
      />,
    );

    expect(html).toContain('id="select-template"');
    expect(html).toContain('wall-shelves');
  });

  it('does not shift Face B DXF drill X by Face A front edgeband on asymmetric edgebanding', () => {
    const sheet: PieceMachiningSheet = {
      pieceId: 'side-left',
      role: 'side-left',
      materialId: 'mat-egger-white-18',
      dimensionsMm: { width: 560, height: 720, thickness: 18 },
      cutDimensionsMm: { width: 558, height: 720 },
      bandedEdges: { top: false, bottom: false, left: true, right: false },
      faceAOperations: [
        {
          id: 'op-a',
          faceType: 'face-A',
          faceId: 'face-A',
          diameterMm: 7,
          depthMm: 18,
          isThrough: true,
          xMm: 50,
          yMm: 9,
          distFromLeftMm: 50,
          distFromRightMm: 510,
          distFromBottomMm: 9,
          distFromTopMm: 711,
          description: 'Confirmat',
          sourceJointKind: 'confirmat',
        },
      ],
      faceBOperations: [
        {
          id: 'op-b',
          faceType: 'face-B',
          faceId: 'face-B',
          diameterMm: 7,
          depthMm: 18,
          isThrough: true,
          xMm: 510,
          yMm: 9,
          distFromLeftMm: 510,
          distFromRightMm: 50,
          distFromBottomMm: 9,
          distFromTopMm: 711,
          description: 'Confirmat',
          sourceJointKind: 'confirmat',
        },
      ],
      edgeOperations: [],
      customOperations: [],
      totalOperations: 1,
      requiresTurn: true,
      turnInstructions: 'Girar pieza',
    };

    const dxfA = exportMachiningSheetToDxf(sheet, { face: 'face-A', useCutDimensions: true });
    const dxfB = exportMachiningSheetToDxf(sheet, { face: 'face-B', useCutDimensions: true });

    // Face A deducts left 2mm -> X = 50 - 2 = 48.0
    expect(dxfA).toMatch(/CIRCLE[\s\S]*?\r?\n10\r?\n48\.0\r?\n/);
    // Face B flipped: its X=0 edge is Face A's right edge (unbanded) -> X remains 510.0 (48 + 510 = 558)
    expect(dxfB).toMatch(/CIRCLE[\s\S]*?\r?\n10\r?\n510\.0\r?\n/);
  });
});
