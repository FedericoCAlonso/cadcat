import { describe, it, expect } from 'vitest';
import 'fake-indexeddb/auto';
import {
  type ResolvedPieceWithCutSize,
  type BillOfMaterials,
  createPiece,
  createRectangularContour,
  consolidateProjectPieces,
  consolidateProjectBom,
  runProjectNesting,
} from '../src/resolver';
import {
  type Material,
  type Project,
  type ProjectModuleItem,
} from '../src/model';
import {
  openDatabase,
  saveProjectToDb,
  loadProjectFromDb,
  loadAllProjectsFromDb,
  deleteProjectFromDb,
} from '../src/storage';

describe('Multi-Module Project Architecture & Sheet Yield Optimization', () => {
  const whiteMat18: Material = {
    schemaVersion: 1,
    id: 'mat-melamine-white-18',
    name: 'Melamina Blanca 18mm',
    thicknessMm: 18,
    sheetSizeMm: { length: 2800, width: 2070 },
    hasGrain: false,
    milling: { hidden: 'yes', visible: 'no', onStructuralPiece: 'limited' },
    pricePerSheet: 50.0,
  };

  const rawMdf3: Material = {
    schemaVersion: 1,
    id: 'mat-mdf-raw-3',
    name: 'Fibrofácil Crudo 3mm',
    thicknessMm: 3,
    sheetSizeMm: { length: 2800, width: 1830 },
    hasGrain: false,
    milling: { hidden: 'yes', visible: 'no', onStructuralPiece: 'limited' },
    pricePerSheet: 20.0,
  };

  function createSampleModulePieces(_moduleId: string, prefix: string, count: number): ResolvedPieceWithCutSize[] {
    const pieces: ResolvedPieceWithCutSize[] = [];
    for (let i = 1; i <= count; i++) {
      const p = createPiece({
        id: `${prefix}-p${i}`,
        role: `${prefix}-role-${i}`,
        materialId: whiteMat18.id,
        contour: createRectangularContour(500, 300),
        thicknessMm: 18,
      });
      pieces.push({
        ...p,
        positionMm: { x: 0, y: 0, z: 0 },
        dimensionsMm: { width: 500, height: 300 },
        cutDimensionsMm: { width: 500, height: 300 },
        cutContour: p.contour,
        bandedEdges: [{ faceId: 'left', edgeBandId: 'eb-white-045', thicknessMm: 0.45, lengthMm: 300 }],
      });
    }
    return pieces;
  }

  it('consolidates pieces from multiple modules taking quantity into account', () => {
    const mod1Pieces = createSampleModulePieces('mod-1', 'bajo-800', 4);
    const mod2Pieces = createSampleModulePieces('mod-2', 'cajonero-400', 6);

    const consolidated = consolidateProjectPieces([
      {
        moduleId: 'mod-1',
        moduleName: 'Bajo Mesada 800',
        quantity: 1,
        pieces: mod1Pieces,
      },
      {
        moduleId: 'mod-2',
        moduleName: 'Cajonero 400',
        quantity: 2,
        pieces: mod2Pieces,
      },
    ]);

    // 4 from mod 1 (qty 1) + 6 * 2 from mod 2 (qty 2) = 16 pieces total
    expect(consolidated).toHaveLength(16);

    // Verify unique IDs and instance tags
    const mod2Items = consolidated.filter((p) => p.moduleId === 'mod-2');
    expect(mod2Items).toHaveLength(12);
    expect(mod2Items.filter((p) => p.moduleInstanceIndex === 1)).toHaveLength(6);
    expect(mod2Items.filter((p) => p.moduleInstanceIndex === 2)).toHaveLength(6);

    // Ensure all pieces have unique IDs
    const ids = new Set(consolidated.map((p) => p.id));
    expect(ids.size).toBe(16);
  });

  it('consolidates Bill of Materials and hardware across modules with quantities', () => {
    const mod1Pieces = createSampleModulePieces('mod-1', 'bajo-800', 2);
    const bom1: BillOfMaterials = {
      moduleId: 'mod-1',
      totalPieceCount: 2,
      totalCutAreaM2: 0.3,
      totalEdgeBandMeters: 0.6,
      totalHardwareCount: 8,
      pieces: [],
      hardware: [{ hardwareId: 'hw-confirmat-7x50', name: 'Confirmat 7x50', jointKind: 'confirmat', count: 8 }],
      edgeBands: [{ edgeBandId: 'eb-white-045', kind: 'thin', lengthMm: 600, lengthMeters: 0.6 }],
    };

    const mod2Pieces = createSampleModulePieces('mod-2', 'cajonero-400', 3);
    const bom2: BillOfMaterials = {
      moduleId: 'mod-2',
      totalPieceCount: 3,
      totalCutAreaM2: 0.45,
      totalEdgeBandMeters: 0.9,
      totalHardwareCount: 12,
      pieces: [],
      hardware: [{ hardwareId: 'hw-confirmat-7x50', name: 'Confirmat 7x50', jointKind: 'confirmat', count: 12 }],
      edgeBands: [{ edgeBandId: 'eb-white-045', kind: 'thin', lengthMm: 900, lengthMeters: 0.9 }],
    };

    const projectBom = consolidateProjectBom([
      {
        moduleId: 'mod-1',
        moduleName: 'Bajo 800',
        quantity: 1,
        pieces: mod1Pieces,
        bom: bom1,
      },
      {
        moduleId: 'mod-2',
        moduleName: 'Cajonero 400',
        quantity: 3,
        pieces: mod2Pieces,
        bom: bom2,
      },
    ]);

    // mod 1 has 2 pieces * 1 = 2
    // mod 2 has 3 pieces * 3 = 9
    expect(projectBom.totalPieceCount).toBe(11);

    // Hardware confirmat: 8 * 1 + 12 * 3 = 44 screws
    const confirmat = projectBom.hardware.find((h) => h.hardwareId === 'hw-confirmat-7x50');
    expect(confirmat?.count).toBe(44);

    // Edgeband: 0.6 * 1 + 0.9 * 3 = 3.3 meters
    const edgeBand = projectBom.edgeBands.find((e) => e.edgeBandId === 'eb-white-045');
    expect(Math.abs((edgeBand?.lengthMeters ?? 0) - 3.3)).toBeLessThan(0.01);
  });

  it('runs global guillotine nesting combining pieces from all modules into unified cut sheets', () => {
    // Module 1: Large side panels
    const largeSides: ResolvedPieceWithCutSize[] = [
      {
        ...createPiece({
          id: 'side-1',
          role: 'side',
          materialId: whiteMat18.id,
          contour: createRectangularContour(700, 560),
          thicknessMm: 18,
        }),
        positionMm: { x: 0, y: 0, z: 0 },
        dimensionsMm: { width: 700, height: 560 },
        cutDimensionsMm: { width: 700, height: 560 },
        cutContour: createRectangularContour(700, 560),
        bandedEdges: [],
      },
      {
        ...createPiece({
          id: 'side-2',
          role: 'side',
          materialId: whiteMat18.id,
          contour: createRectangularContour(700, 560),
          thicknessMm: 18,
        }),
        positionMm: { x: 0, y: 0, z: 0 },
        dimensionsMm: { width: 700, height: 560 },
        cutDimensionsMm: { width: 700, height: 560 },
        cutContour: createRectangularContour(700, 560),
        bandedEdges: [],
      },
    ];

    // Module 2: Small drawer pieces
    const smallDrawerPieces: ResolvedPieceWithCutSize[] = [
      {
        ...createPiece({
          id: 'drawer-box-1',
          role: 'drawer-box',
          materialId: whiteMat18.id,
          contour: createRectangularContour(400, 120),
          thicknessMm: 18,
        }),
        positionMm: { x: 0, y: 0, z: 0 },
        dimensionsMm: { width: 400, height: 120 },
        cutDimensionsMm: { width: 400, height: 120 },
        cutContour: createRectangularContour(400, 120),
        bandedEdges: [],
      },
      {
        ...createPiece({
          id: 'drawer-box-2',
          role: 'drawer-box',
          materialId: whiteMat18.id,
          contour: createRectangularContour(400, 120),
          thicknessMm: 18,
        }),
        positionMm: { x: 0, y: 0, z: 0 },
        dimensionsMm: { width: 400, height: 120 },
        cutDimensionsMm: { width: 400, height: 120 },
        cutContour: createRectangularContour(400, 120),
        bandedEdges: [],
      },
    ];

    const nestingResult = runProjectNesting(
      [
        {
          moduleId: 'mod-under-counter',
          moduleName: 'Bajo Mesada',
          quantity: 1,
          pieces: largeSides,
        },
        {
          moduleId: 'mod-drawer',
          moduleName: 'Cajonera',
          quantity: 2,
          pieces: smallDrawerPieces,
        },
      ],
      {
        materials: [whiteMat18, rawMdf3],
        sawKerfMm: 4.0,
        trimMarginMm: 10.0,
      },
    );

    expect(nestingResult.resultsByMaterial[whiteMat18.id]).toBeDefined();
    const whiteNesting = nestingResult.resultsByMaterial[whiteMat18.id]!;

    // Total placed pieces: 2 large + 2 small * 2 = 6 pieces
    const totalPlaced = whiteNesting.sheets.reduce((acc, s) => acc + s.placedPieces.length, 0);
    expect(totalPlaced).toBe(6);

    // All fit comfortably on 1 standard board (2800 x 2070 mm)
    expect(whiteNesting.sheets.length).toBe(1);
    expect(whiteNesting.overallUtilizationPercentage).toBeGreaterThan(0);
  });

  it('persists and retrieves full multi-module project in IndexedDB', async () => {
    const db = await openDatabase('test_db_project', 4);

    const initialMod: ProjectModuleItem = {
      id: 'mod-base-1',
      name: 'Bajo Mesada 800',
      quantity: 1,
      templateId: 'base-modular',
      width: 800,
      height: 720,
      depth: 560,
      selectedMaterialId: whiteMat18.id,
      selectedEdgeBandId: 'eb-white-045',
      frontsMaterialId: whiteMat18.id,
      drawerBoxesMaterialId: whiteMat18.id,
      backingsMaterialId: rawMdf3.id,
      isCustomModular: true,
      roofType: 'front-back-rails',
      jointPriority: 'lateral-over-bottom',
      hasBacking: true,
      backingType: 'groove',
      backingThicknessMm: 3,
      isIslandCabinet: false,
      rearStructuralRails: 'none',
      rearStructuralRailsWidthMm: 100,
      partitionPassThroughRoof: false,
      gridType: '1-bay',
      bays: [],
      jointStrategy: 'confirmat',
    };

    const sampleProject: Project = {
      schemaVersion: 1,
      id: 'proj-cocina-garcia',
      name: 'Cocina García',
      clientName: 'Juan García',
      description: 'Muebles de cocina completos',
      modules: [
        initialMod,
        {
          ...initialMod,
          id: 'mod-cajonero-2',
          name: 'Cajonero 400',
          quantity: 2,
          width: 400,
        },
      ],
      activeModuleId: 'mod-base-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveProjectToDb(sampleProject, db);

    const loaded = await loadProjectFromDb('proj-cocina-garcia', db);
    expect(loaded).toBeDefined();
    expect(loaded?.id).toBe('proj-cocina-garcia');
    expect(loaded?.name).toBe('Cocina García');
    expect(loaded?.modules).toHaveLength(2);
    expect(loaded?.modules[1]?.name).toBe('Cajonero 400');
    expect(loaded?.modules[1]?.quantity).toBe(2);

    const all = await loadAllProjectsFromDb(db);
    expect(all.length).toBeGreaterThanOrEqual(1);

    await deleteProjectFromDb('proj-cocina-garcia', db);
    const afterDelete = await loadProjectFromDb('proj-cocina-garcia', db);
    expect(afterDelete).toBeNull();

    db.close();
  });
});
