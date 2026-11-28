import { describe, it, expect } from 'vitest';
import {
  exportCutListCsv,
  exportCutPlanPdf,
  translatePieceLabel,
  type ResolvedPieceWithCutSize,
} from '../src/resolver';
import type { NestingResult } from '../src/workers';

describe('Cut List CSV Export', () => {
  const samplePieces: ResolvedPieceWithCutSize[] = [
    {
      id: 'piece-side-left',
      role: 'side-left',
      materialId: 'mat-egger-white-18',
      contour: {
        points: [
          { x: 0, y: 0 },
          { x: 558, y: 0 },
          { x: 558, y: 800 },
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
        { faceId: 'right-edge', edgeBandId: 'eb-oak-20', thicknessMm: 2, lengthMm: 800 },
      ],
    },
    {
      id: 'piece-bottom',
      role: 'bottom',
      materialId: 'mat-egger-white-18',
      contour: {
        points: [
          { x: 0, y: 0 },
          { x: 562, y: 0 },
          { x: 562, y: 560 },
          { x: 0, y: 560 },
        ],
      },
      thicknessMm: 18,
      faces: [],
      structural: true,
      referenceFace: 'A',
      positionMm: { x: 18, y: 0, z: 0 },
      dimensionsMm: { width: 564, height: 560 },
      cutDimensionsMm: { width: 562, height: 560 },
      cutContour: {
        points: [
          { x: 0, y: 0 },
          { x: 562, y: 0 },
          { x: 562, y: 560 },
          { x: 0, y: 560 },
        ],
      },
      bandedEdges: [
        { faceId: 'right-edge', edgeBandId: 'eb-white-08', thicknessMm: 0.8, lengthMm: 560 },
      ],
    },
  ];

  it('exports standard Spanish CSV headers and rows with cut sizes', () => {
    const csv = exportCutListCsv(samplePieces, {
      'mat-egger-white-18': 'Melamina Blanca 18mm',
    });

    expect(csv).toContain('ID Pieza,Rol,Material,Ancho Final (mm),Alto Final (mm),Ancho Corte (mm),Alto Corte (mm),Espesor (mm),Estructural,Tapacantos,Pieza');
    expect(csv).toContain('piece-side-left,side-left,Melamina Blanca 18mm,560,800,558,800,18,Sí,Derecho (2 mm),Lateral izquierdo');
    expect(csv).toContain('piece-bottom,bottom,Melamina Blanca 18mm,564,560,562,560,18,Sí,Derecho (0.8 mm),Piso / Base');
  });
});

describe('Cut Plan PDF Export', () => {
  const sampleNesting: NestingResult = {
    sheets: [
      {
        sheetIndex: 0,
        materialId: 'mat-egger-white-18',
        sheetLengthMm: 2800,
        sheetWidthMm: 2070,
        placedPieces: [
          { pieceId: 'side-left', x: 10, y: 10, width: 558, height: 800, rotated: false },
          { pieceId: 'side-right', x: 571.2, y: 10, width: 558, height: 800, rotated: false },
        ],
        utilizationPercentage: 42.5,
        usedAreaM2: 0.89,
        wasteAreaM2: 4.90,
        cutPasses: 0,
      },
      {
        sheetIndex: 1,
        materialId: 'mat-egger-white-18',
        sheetLengthMm: 2800,
        sheetWidthMm: 2070,
        placedPieces: [
          { pieceId: 'shelf-1', x: 10, y: 10, width: 562, height: 500, rotated: false },
        ],
        utilizationPercentage: 15.2,
        usedAreaM2: 0.28,
        wasteAreaM2: 5.51,
        cutPasses: 0,
      },
    ],
    unplacedPieces: [],
    totalSheets: 2,
    overallUtilizationPercentage: 28.85,
    totalCutPasses: 0,
  };

  it('generates a valid multi-page PDF document from nesting result', () => {
    const doc = exportCutPlanPdf(sampleNesting, 'Base Cabinet Cut Plan');

    expect(doc).toBeDefined();
    // 2 sheets in nesting should create a 2-page PDF
    expect(doc.getNumberOfPages()).toBe(2);
  });

  it('handles empty nesting results gracefully', () => {
    const emptyNesting: NestingResult = {
      sheets: [],
      unplacedPieces: [],
      totalSheets: 0,
      overallUtilizationPercentage: 0,
      totalCutPasses: 0,
    };

    const doc = exportCutPlanPdf(emptyNesting);
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('translates technical piece identifiers and roles into Argentine Spanish descriptions', () => {
    expect(translatePieceLabel('base-side-left')).toBe('Lateral izquierdo');
    expect(translatePieceLabel('base-side-right')).toBe('Lateral derecho');
    expect(translatePieceLabel('base-bottom')).toBe('Piso');
    expect(translatePieceLabel('base-roof')).toBe('Techo');
    expect(translatePieceLabel('base-rail-front')).toBe('Faja sup. frontal');
    expect(translatePieceLabel('base-rail-back')).toBe('Faja sup. trasera');
    expect(translatePieceLabel('shelf-adj-1')).toBe('Estante móvil');
    expect(translatePieceLabel('drawer-front-1')).toBe('Frente cajón');
    expect(translatePieceLabel('drawer-box-side-left-1')).toBe('Lat. cajón izq');
    expect(translatePieceLabel('drawer-box-back-1')).toBe('Contrafrente cajón');
    expect(translatePieceLabel('gauge-g1')).toBe('Calibre G1');
    expect(translatePieceLabel('door-left')).toBe('Puerta izq');
    expect(translatePieceLabel('custom-piece-123')).toBe('custom-piece-123');
    expect(translatePieceLabel('mod-1__module-preset-door-cabinet-back__i1')).toBe('Fondo trasero');
    expect(translatePieceLabel('mod-1__drawer-box-side-l-1__i1')).toBe('Lat. cajón izq');
    expect(translatePieceLabel('mod-1__drawer-box-bottom-1__i1')).toBe('Fondo cajón');
    expect(translatePieceLabel('mod-1__drawer-box-side-l-1__i1', 'drawer-side')).toBe('Lateral de cajón');
    expect(translatePieceLabel('mod-1__drawer-box-bottom-1__i1', 'drawer-bottom')).toBe('Fondo de cajón');
    expect(translatePieceLabel('mod-1__rail-front__i1', 'rail')).toBe('Faja de amarre');
  });

  it('groups rotated and non-rotated identical pieces of a module together with canonical cut size', () => {
    const nestingWithRotated: NestingResult = {
      sheets: [
        {
          sheetIndex: 1, // 1-based as returned by runMultiMaterialGuillotineNesting
          materialId: 'mat-egger-white-18',
          sheetLengthMm: 2800,
          sheetWidthMm: 2070,
          placedPieces: [
            // 5 horizontal + 1 rotated of Module 1 (1400 x 350)
            { pieceId: 'mod-1__shelf-0__i1', moduleName: 'Estantes 1400', cutWidthMm: 1400, cutHeightMm: 350, x: 10, y: 10, width: 1400, height: 350, rotated: false },
            { pieceId: 'mod-1__shelf-1__i1', moduleName: 'Estantes 1400', cutWidthMm: 1400, cutHeightMm: 350, x: 10, y: 363.2, width: 1400, height: 350, rotated: false },
            { pieceId: 'mod-1__shelf-2__i1', moduleName: 'Estantes 1400', cutWidthMm: 1400, cutHeightMm: 350, x: 10, y: 716.4, width: 1400, height: 350, rotated: false },
            { pieceId: 'mod-1__shelf-3__i1', moduleName: 'Estantes 1400', cutWidthMm: 1400, cutHeightMm: 350, x: 10, y: 1069.6, width: 1400, height: 350, rotated: false },
            { pieceId: 'mod-1__shelf-4__i1', moduleName: 'Estantes 1400', cutWidthMm: 1400, cutHeightMm: 350, x: 10, y: 1422.8, width: 1400, height: 350, rotated: false },
            { pieceId: 'mod-1__shelf-5__i1', moduleName: 'Estantes 1400', cutWidthMm: 1400, cutHeightMm: 350, x: 1413.2, y: 10, width: 350, height: 1400, rotated: true },
            // 6 shelves of Module 2 (900 x 300)
            { pieceId: 'mod-2__shelf-0__i1', moduleName: 'Estantes 900', cutWidthMm: 900, cutHeightMm: 300, x: 1766.4, y: 10, width: 900, height: 300, rotated: false },
          ],
          utilizationPercentage: 55.4,
          usedAreaM2: 3.21,
          wasteAreaM2: 2.58,
          cutPasses: 10,
        },
      ],
      unplacedPieces: [],
      totalSheets: 1,
      overallUtilizationPercentage: 55.4,
      totalCutPasses: 10,
    };

    const doc = exportCutPlanPdf(nestingWithRotated, 'Plano Estantes');
    const page1Text = doc.output('datauristring');
    expect(doc.getNumberOfPages()).toBe(1);
    expect(page1Text.length).toBeGreaterThan(100);

    // Inspect internal jsPDF page stream for expected grouped text
    const internalPages = (doc as unknown as { internal: { pages: string[][] } }).internal.pages;
    const rawPageContent = (internalPages[1] ?? []).join('\n');
    expect(rawPageContent).toContain('Hoja 1 de 1');
    expect(rawPageContent).not.toContain('Hoja 2 de 1');
    expect(rawPageContent).toContain('Estante \\(Estantes 1400\\)');
    expect(rawPageContent).toContain('Estante \\(Estantes 900\\)');
    expect(rawPageContent).toContain('1400 x 350 mm');
    expect(rawPageContent).not.toContain('350 x 1400 mm');
  });

  it('renders a warning when unplacedPieces exist', () => {
    const nestingWithUnplaced: NestingResult = {
      sheets: [],
      unplacedPieces: [
        {
          id: 'too-big',
          pieceId: 'too-big',
          materialId: 'mat-egger-white-18',
          cutWidthMm: 3200,
          cutHeightMm: 500,
          canRotate: true,
        },
      ],
      totalSheets: 0,
      overallUtilizationPercentage: 0,
      totalCutPasses: 0,
    };

    const doc = exportCutPlanPdf(nestingWithUnplaced, 'Oversize Test');
    const internalPages = (doc as unknown as { internal: { pages: string[][] } }).internal.pages;
    const rawPageContent = (internalPages[1] ?? []).join('\n');
    expect(rawPageContent).toContain('1 pieza');
  });
});
