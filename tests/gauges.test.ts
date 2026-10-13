import { describe, it, expect } from 'vitest';
import {
  createPiece,
  createJoint,
  createRectangularContour,
  JointGraph,
  deriveAssemblyGauges,
  deriveAuxiliaryGaugePieces,
  generateBillOfMaterials,
  calculateModuleCost,
  generateAssemblySheet,
  exportAssemblyGuidePdf,
  exportCutListCsv,
  type ResolvedPiece,
  type ResolvedPieceWithCutSize,
} from '../src/resolver';
import { runGuillotineNesting, type NestingItem, type SheetDefinition } from '../src/workers';
import type { Material } from '../src/model';

describe('Assembly Gauges & Auxiliary Pieces (Phase 2 WP2)', () => {
  const sampleMaterial: Material = {
    schemaVersion: 1,
    id: 'mat-egger-white-18',
    name: 'Egger White 18mm',
    thicknessMm: 18,
    sheetSizeMm: { length: 2800, width: 2070 },
    hasGrain: false,
    milling: { hidden: 'yes', visible: 'no', onStructuralPiece: 'limited' },
    pricePerSheet: 60.0,
  };

  function createTestCabinetPieces(): { pieces: ResolvedPiece[]; joints: ReturnType<typeof createJoint>[] } {
    // Left side: 800 high, standing vertically
    const sideLeft: ResolvedPiece = {
      ...createPiece({
        id: 'side-left',
        role: 'side-left',
        materialId: sampleMaterial.id,
        contour: createRectangularContour(560, 800),
        thicknessMm: 18,
      }),
      positionMm: { x: 0, y: 0, z: 0 },
      dimensionsMm: { width: 560, height: 800 },
    };

    // Right side: 800 high, standing vertically at x = 582
    const sideRight: ResolvedPiece = {
      ...createPiece({
        id: 'side-right',
        role: 'side-right',
        materialId: sampleMaterial.id,
        contour: createRectangularContour(560, 800),
        thicknessMm: 18,
      }),
      positionMm: { x: 582, y: 0, z: 0 },
      dimensionsMm: { width: 560, height: 800 },
    };

    // Bottom panel: at y = 0, thickness 18 (top face at y = 18)
    const bottom: ResolvedPiece = {
      ...createPiece({
        id: 'bottom',
        role: 'bottom',
        materialId: sampleMaterial.id,
        contour: createRectangularContour(564, 560),
        thicknessMm: 18,
      }),
      positionMm: { x: 18, y: 0, z: 0 },
      dimensionsMm: { width: 564, height: 560 },
    };

    // Shelf 1: at y = 300, thickness 18 (clear span from bottom top face 18 to shelf 1 bottom face 300 = 282mm)
    const shelf1: ResolvedPiece = {
      ...createPiece({
        id: 'shelf-1',
        role: 'shelf',
        materialId: sampleMaterial.id,
        contour: createRectangularContour(564, 540),
        thicknessMm: 18,
      }),
      positionMm: { x: 18, y: 300, z: 0 },
      dimensionsMm: { width: 564, height: 540 },
    };

    // Shelf 2: at y = 600, thickness 18 (clear span from shelf 1 top face 318 to shelf 2 bottom face 600 = 282mm)
    const shelf2: ResolvedPiece = {
      ...createPiece({
        id: 'shelf-2',
        role: 'shelf',
        materialId: sampleMaterial.id,
        contour: createRectangularContour(564, 540),
        thicknessMm: 18,
      }),
      positionMm: { x: 18, y: 600, z: 0 },
      dimensionsMm: { width: 564, height: 540 },
    };

    const pieces = [sideLeft, sideRight, bottom, shelf1, shelf2];

    const joints = [
      createJoint({
        a: { pieceId: 'side-left', faceId: 'inner' },
        b: { pieceId: 'bottom', faceId: 'left-edge' },
        kind: 'confirmat',
      }),
      createJoint({
        a: { pieceId: 'side-right', faceId: 'inner' },
        b: { pieceId: 'bottom', faceId: 'right-edge' },
        kind: 'confirmat',
      }),
      createJoint({
        a: { pieceId: 'side-left', faceId: 'inner' },
        b: { pieceId: 'shelf-1', faceId: 'left-edge' },
        kind: 'confirmat',
      }),
      createJoint({
        a: { pieceId: 'side-right', faceId: 'inner' },
        b: { pieceId: 'shelf-1', faceId: 'right-edge' },
        kind: 'confirmat',
      }),
      createJoint({
        a: { pieceId: 'side-left', faceId: 'inner' },
        b: { pieceId: 'shelf-2', faceId: 'left-edge' },
        kind: 'confirmat',
      }),
      createJoint({
        a: { pieceId: 'side-right', faceId: 'inner' },
        b: { pieceId: 'shelf-2', faceId: 'right-edge' },
        kind: 'confirmat',
      }),
    ];

    return { pieces, joints };
  }

  it('derives assembly gauges from module joint spans and groups identical spans', () => {
    const { pieces, joints } = createTestCabinetPieces();

    const gauges = deriveAssemblyGauges({ pieces, joints });

    expect(gauges.length).toBeGreaterThanOrEqual(1);

    // The clear span between bottom (top: 18) and shelf-1 (bottom: 300) is 282 mm
    // The clear span between shelf-1 (top: 318) and shelf-2 (bottom: 600) is 282 mm
    // Identical spans must be grouped into a single gauge
    const g282 = gauges.find((g) => Math.abs(g.clearSpanMm - 282) <= 1.0);
    expect(g282).toBeDefined();
    expect(g282?.label).toBe('G1');
    expect(g282?.widthMm).toBe(50); // Default gauge width
    expect(g282?.spansCount).toBe(2); // Serves both bottom->shelf1 and shelf1->shelf2

    // Verify gauge piece metadata
    const auxPiece = g282?.piece;
    expect(auxPiece).toBeDefined();
    expect(auxPiece?.role).toBe('assembly-gauge');
    expect(auxPiece?.isAuxiliary).toBe(true);
    expect(auxPiece?.structural).toBe(false);

    // Helper deriveAuxiliaryGaugePieces
    const auxPieces = deriveAuxiliaryGaugePieces({ pieces, joints });
    expect(auxPieces.length).toBe(gauges.length);
    expect(auxPieces[0]?.isAuxiliary).toBe(true);
  });

  it('respects defaultGaugeWidthMm from MachiningConfig when provided', () => {
    const { pieces, joints } = createTestCabinetPieces();

    const gauges = deriveAssemblyGauges(
      { pieces, joints },
      {
        confirmatThroughDiameterMm: 8,
        confirmatCoreDiameterMm: 5,
        confirmatCoreDepthMm: 50,
        minifixPocketDiameterMm: 15,
        minifixPocketDepthMm: 13.5,
        minifixPocketSetbackMm: 34,
        minifixBoltDiameterMm: 8,
        minifixDowelDiameterMm: 5,
        minifixDowelDepthMm: 11,
        dowelFaceDiameterMm: 8,
        dowelFaceDepthMm: 12,
        dowelEdgeDiameterMm: 8,
        dowelEdgeDepthMm: 25,
        hingeCupDiameterMm: 35,
        hingeCupDepthMm: 12,
        hingeCupEdgeSetbackMm: 21.5,
        hingePlateSetbackMm: 37,
        hingePlateDiameterMm: 5,
        hingePlateDepthMm: 12,
        shelfPinDiameterMm: 5,
        shelfPinDepthMm: 12,
        system32FrontSetbackMm: 37,
        jointDrillMarginMm: 50,
        maxSpanWithoutCenterDrillMm: 600,
        defaultGaugeWidthMm: 60, // Custom gauge width
      },
    );

    expect(gauges[0]?.widthMm).toBe(60);
  });

  it('strictly excludes auxiliary pieces from customer Bill of Materials (BOM)', () => {
    const { pieces, joints } = createTestCabinetPieces();
    const auxGauges = deriveAuxiliaryGaugePieces({ pieces, joints });

    // Combine primary pieces with auxiliary gauge pieces
    const allPieces: ResolvedPiece[] = [
      ...pieces,
      ...auxGauges.map((g) => ({
        ...g,
        positionMm: { x: 0, y: 0, z: 0 },
        dimensionsMm: { width: 282, height: 50 },
      })),
    ];

    expect(allPieces.some((p) => p.isAuxiliary === true)).toBe(true);

    const bom = generateBillOfMaterials(
      {
        moduleId: 'cabinet-with-gauges',
        parameters: {},
        pieces: allPieces,
        joints,
        placementTree: null as never,
        jointGraph: new JointGraph(joints),
      },
      [],
    );

    // Customer BOM must only contain the 5 structural panels, zero auxiliary gauges
    expect(bom.totalPieceCount).toBe(5);
    expect(bom.pieces.length).toBe(5);
    for (const p of bom.pieces) {
      expect(p.role).not.toBe('assembly-gauge');
    }
  });

  it('includes auxiliary pieces in the workshop cut list CSV export', () => {
    const { pieces, joints } = createTestCabinetPieces();
    const auxGauges = deriveAuxiliaryGaugePieces({ pieces, joints });

    const allPieces: ResolvedPieceWithCutSize[] = [
      ...pieces.map((p) => ({
        ...p,
        cutDimensionsMm: p.dimensionsMm,
        cutContour: p.contour,
        bandedEdges: [],
      })),
      ...auxGauges.map((g) => ({
        ...g,
        positionMm: { x: 0, y: 0, z: 0 },
        dimensionsMm: { width: 282, height: 50 },
        cutDimensionsMm: { width: 282, height: 50 },
        cutContour: g.contour,
        bandedEdges: [],
      })),
    ];

    const csv = exportCutListCsv(allPieces);

    // Shop cut list CSV must include auxiliary pieces for the workshop cutting line
    expect(csv).toContain('assembly-gauge');
    expect(csv).toContain('gauge-g1');
  });

  it('places auxiliary gauges into sheet offcuts with zero material cost', () => {
    const standardSheet: SheetDefinition = {
      materialId: sampleMaterial.id,
      lengthMm: 2800,
      widthMm: 2070,
      trimMarginMm: 10,
      sawKerfMm: 3.2,
    };

    // Primary cabinet panels
    const primaryItems: NestingItem[] = [
      { id: '1', pieceId: 'side-left', materialId: sampleMaterial.id, cutWidthMm: 560, cutHeightMm: 800, canRotate: false },
      { id: '2', pieceId: 'side-right', materialId: sampleMaterial.id, cutWidthMm: 560, cutHeightMm: 800, canRotate: false },
      { id: '3', pieceId: 'bottom', materialId: sampleMaterial.id, cutWidthMm: 564, cutHeightMm: 560, canRotate: false },
      { id: '4', pieceId: 'shelf-1', materialId: sampleMaterial.id, cutWidthMm: 564, cutHeightMm: 540, canRotate: false },
    ];

    // Auxiliary gauge strip
    const auxGaugeItem: NestingItem = {
      id: 'gauge-1',
      pieceId: 'gauge-g1',
      materialId: sampleMaterial.id,
      cutWidthMm: 282,
      cutHeightMm: 50,
      canRotate: true,
      isAuxiliary: true,
    };

    // Run nesting with both primary and auxiliary pieces
    const result = runGuillotineNesting({
      items: [...primaryItems, auxGaugeItem],
      sheet: standardSheet,
    });

    expect(result.unplacedPieces).toHaveLength(0);
    // Primary pieces easily fit on 1 sheet, and gauge fits in the leftover offcut
    expect(result.totalSheets).toBe(1);

    const sheet0 = result.sheets[0]!;
    const placedGauge = sheet0.placedPieces.find((p) => p.pieceId === 'gauge-g1');
    expect(placedGauge).toBeDefined();
    expect(placedGauge?.isAuxiliary).toBe(true);
    expect(placedGauge?.fitsInOffcut).toBe(true);

    // Material cost check:
    // With 1 sheet required for primary pieces and gauge fitted in offcut,
    // sheetCount is 1 (material total = 1 * $60 = $60), material cost for gauge is $0
    const cost = calculateModuleCost({
      bom: {
        moduleId: 'cabinet-offcut-test',
        pieces: [],
        totalPieceCount: 4,
        totalCutAreaM2: 1.2,
        edgeBands: [],
        totalEdgeBandMeters: 0,
        hardware: [],
        totalHardwareCount: 0,
      },
      nestingResult: result,
      materials: [sampleMaterial],
      edgeBands: [],
      hardware: [],
      costConfig: {
        wasteFactorPercent: 10,
        hourlyLaborRate: 35,
        pricePerCutPass: 2.0,
        cutPricingMode: 'per-pass',
      },
    });

    expect(cost.materialTotal).toBe(60); // Exactly 1 sheet of material, gauge cost = 0
    expect(cost.cutPassCost).toBe(result.totalCutPasses * 2.0); // Cut pass cost is added
    expect(cost.grandTotal).toBe(60 + cost.cutPassCost);
  });

  it('generates sequential assembly steps and exports assembly PDF', () => {
    const { pieces, joints } = createTestCabinetPieces();

    const sheet = generateAssemblySheet({
      module: {
        moduleId: 'base-cabinet-01',
        pieces,
        joints,
      },
    });

    expect(sheet.steps.length).toBeGreaterThanOrEqual(4);
    expect(sheet.gauges.length).toBeGreaterThanOrEqual(1);

    // Check step content references gauge
    const shelfStep = sheet.steps.find((s) => s.stepNumber > 1 && s.gaugesInvolved.includes('G1'));
    expect(shelfStep).toBeDefined();
    expect(shelfStep?.instruction).toContain('gauge G1');

    // Export PDF
    const pdfDoc = exportAssemblyGuidePdf(sheet);
    expect(pdfDoc).toBeDefined();
    expect(pdfDoc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});
