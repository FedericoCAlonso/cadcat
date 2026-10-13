import { describe, it, expect } from 'vitest';
import {
  exportCutListCsv,
  exportCutPlanPdf,
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

  it('exports standard CSV headers and rows with cut sizes', () => {
    const csv = exportCutListCsv(samplePieces);

    expect(csv).toContain('Piece ID,Role,Material ID,Finished Width (mm),Finished Height (mm),Cut Width (mm),Cut Height (mm),Thickness (mm),Structural,Edge Bands');
    expect(csv).toContain('piece-side-left,side-left,mat-egger-white-18,560,800,558,800,18,Yes,right-edge (2mm)');
    expect(csv).toContain('piece-bottom,bottom,mat-egger-white-18,564,560,562,560,18,Yes,right-edge (0.8mm)');
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
      },
    ],
    unplacedPieces: [],
    totalSheets: 2,
    overallUtilizationPercentage: 28.85,
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
    };

    const doc = exportCutPlanPdf(emptyNesting);
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBe(1);
  });
});
