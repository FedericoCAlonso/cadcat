import { describe, it, expect } from 'vitest';
import {
  buildPieceMachiningSheet,
  buildModuleMachiningSheets,
  renderPieceMachiningSvg,
  exportMachiningSheetPdf,
  buildBaseCabinet,
  buildDoorCabinet,
  deriveModuleDrillOperations,
  type ResolvedPieceWithCutSize,
} from '../src/resolver';
import type { Material, DrillOperation } from '../src/model';

const testMaterial: Material = {
  schemaVersion: 1,
  id: 'mat-test-18',
  name: 'Melamine White 18mm',
  thicknessMm: 18,
  sheetSizeMm: { length: 2750, width: 1830 },
  hasGrain: false,
  milling: { hidden: 'yes', visible: 'no', onStructuralPiece: 'limited' },
};

describe('Machining Sheet Resolver (machiningSheet)', () => {
  const samplePiece: ResolvedPieceWithCutSize = {
    id: 'test-side-left',
    role: 'side-left',
    materialId: 'mat-test-18',
    contour: {
      points: [
        { x: 0, y: 0 },
        { x: 560, y: 0 },
        { x: 560, y: 800 },
        { x: 0, y: 800 },
      ],
    },
    thicknessMm: 18,
    faces: [],
    structural: true,
    referenceFace: 'A',
    positionMm: { x: 0, y: 0, z: 0 },
    dimensionsMm: { width: 560, height: 800 },
    cutDimensionsMm: { width: 558, height: 800 },
    cutContour: {
      points: [
        { x: 0, y: 0 },
        { x: 558, y: 0 },
        { x: 558, y: 800 },
        { x: 0, y: 800 },
      ],
    },
    bandedEdges: [
      { faceId: 'right-edge', edgeBandId: 'eb-08', thicknessMm: 0.8, lengthMm: 800 },
    ],
  };

  const sampleOperations: DrillOperation[] = [
    {
      schemaVersion: 1,
      id: 'op-1',
      pieceId: 'test-side-left',
      faceId: 'inner',
      faceType: 'face-A',
      diameterMm: 7.0,
      depthMm: 18.0,
      isThrough: true,
      positionMm: { x: 50, y: 9 },
      origin: 'derived',
      sourceJointKind: 'confirmat',
      description: 'Confirmat hole 1',
    },
    {
      schemaVersion: 1,
      id: 'op-2',
      pieceId: 'test-side-left',
      faceId: 'inner',
      faceType: 'face-A',
      diameterMm: 7.0,
      depthMm: 18.0,
      isThrough: true,
      positionMm: { x: 510, y: 9 },
      origin: 'derived',
      sourceJointKind: 'confirmat',
      description: 'Confirmat hole 2',
    },
    {
      schemaVersion: 1,
      id: 'op-3',
      pieceId: 'test-side-left',
      faceId: 'bottom-edge',
      faceType: 'edge',
      diameterMm: 5.0,
      depthMm: 30.0,
      isThrough: false,
      positionMm: { x: 280, y: 9 },
      origin: 'derived',
      sourceJointKind: 'confirmat',
      description: 'Pilot core in edge',
    },
  ];

  it('builds piece machining sheet with reference edge dimensions and categorizes operations', () => {
    const sheet = buildPieceMachiningSheet(samplePiece, sampleOperations);

    expect(sheet.pieceId).toBe('test-side-left');
    expect(sheet.dimensionsMm.width).toBe(560);
    expect(sheet.dimensionsMm.height).toBe(800);
    expect(sheet.cutDimensionsMm.width).toBe(558);
    expect(sheet.bandedEdges.right).toBe(true);
    expect(sheet.bandedEdges.top).toBe(false);

    // 2 on face A, 1 on edge, 0 on face B
    expect(sheet.faceAOperations).toHaveLength(2);
    expect(sheet.edgeOperations).toHaveLength(1);
    expect(sheet.faceBOperations).toHaveLength(0);
    expect(sheet.requiresTurn).toBe(false);

    // Distance from Left (X=0) and Bottom (Y=0)
    const op1 = sheet.faceAOperations[0]!;
    expect(op1.distFromLeftMm).toBe(50);
    expect(op1.distFromBottomMm).toBe(9);
    expect(op1.distFromRightMm).toBe(560 - 50);
    expect(op1.distFromTopMm).toBe(800 - 9);
    expect(op1.isThrough).toBe(true);
  });

  it('detects operations on Face B and flags "requiresTurn" with clear instruction', () => {
    const opsWithFaceB: DrillOperation[] = [
      ...sampleOperations,
      {
        schemaVersion: 1,
        id: 'op-face-b',
        pieceId: 'test-side-left',
        faceId: 'outer',
        faceType: 'face-B',
        diameterMm: 5.0,
        depthMm: 12.0,
        isThrough: false,
        positionMm: { x: 100, y: 400 },
        origin: 'derived',
        sourceJointKind: 'shelf-pin',
        description: 'Outer shelf pin',
      },
    ];

    const sheet = buildPieceMachiningSheet(samplePiece, opsWithFaceB);
    expect(sheet.requiresTurn).toBe(true);
    expect(sheet.faceBOperations).toHaveLength(1);
    expect(sheet.turnInstructions).toContain('GIRAR LA PIEZA');
  });

  it('builds sheets for all pieces in a base cabinet', () => {
    const built = buildBaseCabinet(
      { width: 600, height: 800, depth: 560 },
      testMaterial,
    );

    const ops = deriveModuleDrillOperations(built.module.pieces, built.module.joints);
    const sheets = buildModuleMachiningSheets(built.resolvedPieces, ops);

    expect(sheets).toHaveLength(built.resolvedPieces.length);
    const sideSheet = sheets.find((s) => s.role === 'side-left')!;
    expect(sideSheet).toBeDefined();
    expect(sideSheet.totalOperations).toBeGreaterThan(0);
  });

  it('renders valid SVG technical drawing for Face A and Face B', () => {
    const sheet = buildPieceMachiningSheet(samplePiece, sampleOperations);

    // Face A SVG
    const svgA = renderPieceMachiningSvg(sheet, 'face-A');
    expect(svgA).toContain('<svg');
    expect(svgA).toContain('viewBox="0 0 640 420"');
    expect(svgA).toContain('Datum (0,0)');
    expect(svgA).toContain('Ø7x18');
    expect(svgA).toContain('X:50');
    expect(svgA).toContain('Y:9');

    // Face B SVG (blank face)
    const svgB = renderPieceMachiningSvg(sheet, 'face-B');
    expect(svgB).toContain('Sin operaciones en Cara B');
  });

  it('renders SVG for Face B with turn warning when Face B operations exist', () => {
    const opsWithFaceB: DrillOperation[] = [
      {
        schemaVersion: 1,
        id: 'op-b1',
        pieceId: 'test-side-left',
        faceId: 'outer',
        faceType: 'face-B',
        diameterMm: 35.0,
        depthMm: 12.0,
        isThrough: false,
        positionMm: { x: 21.5, y: 100 },
        origin: 'derived',
        sourceJointKind: 'hinge',
        description: 'Hinge cup',
      },
    ];

    const sheet = buildPieceMachiningSheet(samplePiece, opsWithFaceB);
    const svg = renderPieceMachiningSvg(sheet, 'face-B');

    expect(svg).toContain('GIRAR LA PIEZA');
    expect(svg).toContain('Ø35x12');
  });

  it('handles custom piece operations (groove, rebate, cutout, drill) and renders in SVG', () => {
    const customOps = [
      {
        kind: 'groove' as const,
        id: 'cust-groove-1',
        pieceId: 'test-side-left',
        faceType: 'face-A' as const,
        axis: 'x' as const,
        offsetMm: 20,
        widthMm: 4,
        depthMm: 8,
      },
      {
        kind: 'rebate' as const,
        id: 'cust-rebate-1',
        pieceId: 'test-side-left',
        faceType: 'face-A' as const,
        edge: 'top' as const,
        widthMm: 10,
        depthMm: 5,
      },
      {
        kind: 'cutout' as const,
        id: 'cust-cutout-1',
        pieceId: 'test-side-left',
        faceType: 'face-A' as const,
        xMm: 100,
        yMm: 200,
        widthMm: 60,
        heightMm: 60,
        depthMm: 18,
        isThrough: true,
      },
      {
        kind: 'drill' as const,
        id: 'cust-drill-1',
        pieceId: 'test-side-left',
        faceType: 'face-A' as const,
        xMm: 150,
        yMm: 300,
        diameterMm: 8,
        depthMm: 12,
        isThrough: false,
      },
    ];

    const sheet = buildPieceMachiningSheet(samplePiece, [], customOps);

    expect(sheet.customOperations).toHaveLength(4);
    // Custom drill was converted and placed in faceAOperations
    expect(sheet.faceAOperations).toHaveLength(1);
    expect(sheet.faceAOperations[0]?.diameterMm).toBe(8);

    const svg = renderPieceMachiningSvg(sheet, 'face-A');
    expect(svg).toContain('Ranura 4x8mm (Y: 20mm)');
    expect(svg).toContain('Rebaje top 10x5mm');
    expect(svg).toContain('Fresado 60x60x18mm');
    expect(svg).toContain('Ø8x12');
  });

  it('exports multi-page PDF machining sheets for workshop manual machines', () => {
    const built = buildDoorCabinet(
      { width: 600, height: 800, depth: 560 },
      testMaterial,
    );

    const ops = deriveModuleDrillOperations(built.module.pieces, built.module.joints);
    const sheets = buildModuleMachiningSheets(built.resolvedPieces, ops);

    const doc = exportMachiningSheetPdf(sheets);
    expect(doc).toBeDefined();
    // 1 page per piece
    expect(doc.getNumberOfPages()).toBe(sheets.length);
  });
});

