import { describe, it, expect } from 'vitest';
import {
  calculatePieceCutSize,
  applyEdgeBandRule,
  calculateEdgeBandLengths,
  createPiece,
  createRectangularContour,
  type ResolvedPiece,
} from '../src/resolver';
import type { EdgeBand } from '../src/model';

const testEdgeBands: EdgeBand[] = [
  {
    schemaVersion: 1,
    id: 'eb-thin-08',
    kind: 'adhesive',
    thicknessMm: 0.8,
    pricePerMeter: 1.5,
  },
  {
    schemaVersion: 1,
    id: 'eb-thick-20',
    kind: 'adhesive',
    thicknessMm: 2.0,
    pricePerMeter: 3.0,
  },
];

describe('Edge Band Cut Size Rule (Section 8.3)', () => {
  it('deducts thickness on a piece with one banded edge', () => {
    const piece = createPiece({
      id: 'shelf-1',
      role: 'shelf',
      materialId: 'mat-1',
      contour: createRectangularContour(564, 500),
      thicknessMm: 18,
    });

    // Apply edge band to front edge (right-edge)
    const rightFace = piece.faces.find((f) => f.id === 'right-edge');
    if (rightFace) rightFace.edgeBandId = 'eb-thick-20';

    const result = calculatePieceCutSize(piece, testEdgeBands);

    expect(result.finishedDimensionsMm).toEqual({ width: 564, height: 500 });
    // Right deduction is 2.0 mm: cut width = 564 - 2.0 = 562 mm
    expect(result.cutDimensionsMm.width).toBe(562);
    expect(result.cutDimensionsMm.height).toBe(500);
    expect(result.totalDeductionMm).toEqual({ width: 2.0, height: 0 });
  });

  it('deducts thickness on opposite banded edges (left and right)', () => {
    const piece = createPiece({
      id: 'panel-2',
      role: 'rail',
      materialId: 'mat-1',
      contour: createRectangularContour(600, 100),
      thicknessMm: 18,
    });

    const leftFace = piece.faces.find((f) => f.id === 'left-edge');
    const rightFace = piece.faces.find((f) => f.id === 'right-edge');
    if (leftFace) leftFace.edgeBandId = 'eb-thin-08'; // 0.8 mm
    if (rightFace) rightFace.edgeBandId = 'eb-thick-20'; // 2.0 mm

    const result = calculatePieceCutSize(piece, testEdgeBands);

    // Cut width = 600 - (0.8 + 2.0) = 597.2 mm
    expect(result.cutDimensionsMm.width).toBeCloseTo(597.2, 5);
    expect(result.cutDimensionsMm.height).toBe(100);
    expect(result.totalDeductionMm.width).toBeCloseTo(2.8, 5);
  });

  it('deducts thickness on all 4 banded sides', () => {
    const piece = createPiece({
      id: 'door-1',
      role: 'door',
      materialId: 'mat-1',
      contour: createRectangularContour(400, 700),
      thicknessMm: 18,
    });

    // All edges banded with 2.0 mm ABS
    for (const face of piece.faces) {
      if (face.id.endsWith('-edge')) {
        face.edgeBandId = 'eb-thick-20';
      }
    }

    const result = calculatePieceCutSize(piece, testEdgeBands);

    // Cut width = 400 - (2.0 + 2.0) = 396 mm
    // Cut height = 700 - (2.0 + 2.0) = 696 mm
    expect(result.cutDimensionsMm.width).toBe(396);
    expect(result.cutDimensionsMm.height).toBe(696);
    expect(result.totalDeductionMm).toEqual({ width: 4.0, height: 4.0 });
  });

  it('applies edge band rule to a ResolvedPiece and produces cut contour', () => {
    const basePiece = createPiece({
      id: 'side-left',
      role: 'side-left',
      materialId: 'mat-1',
      contour: createRectangularContour(560, 800),
      thicknessMm: 18,
    });

    const frontFace = basePiece.faces.find((f) => f.id === 'right-edge');
    if (frontFace) frontFace.edgeBandId = 'eb-thick-20';

    const resolvedPiece: ResolvedPiece = {
      ...basePiece,
      dimensionsMm: { width: 560, height: 800 },
      positionMm: { x: 0, y: 0, z: 0 },
    };

    const bandedResolved = applyEdgeBandRule(resolvedPiece, testEdgeBands);

    expect(bandedResolved.cutDimensionsMm.width).toBe(558);
    expect(bandedResolved.cutDimensionsMm.height).toBe(800);
    expect(bandedResolved.cutContour.points).toEqual([
      { x: 0, y: 0 },
      { x: 558, y: 0 },
      { x: 558, y: 800 },
      { x: 0, y: 800 },
    ]);
    expect(bandedResolved.bandedEdges).toHaveLength(1);
    expect(bandedResolved.bandedEdges[0]?.thicknessMm).toBe(2.0);
  });

  it('calculates total edge band lengths per edge band type', () => {
    const piece1 = createPiece({
      id: 'p1',
      role: 'shelf',
      materialId: 'mat-1',
      contour: createRectangularContour(600, 400),
      thicknessMm: 18,
    });
    // Front edge (length 400 mm) has eb-thick-20
    const f1 = piece1.faces.find((f) => f.id === 'right-edge');
    if (f1) f1.edgeBandId = 'eb-thick-20';

    const piece2 = createPiece({
      id: 'p2',
      role: 'bottom',
      materialId: 'mat-1',
      contour: createRectangularContour(600, 500),
      thicknessMm: 18,
    });
    // Bottom edge (length 600 mm) has eb-thick-20, top edge (length 600 mm) has eb-thin-08
    const f2 = piece2.faces.find((f) => f.id === 'bottom-edge');
    const f3 = piece2.faces.find((f) => f.id === 'top-edge');
    if (f2) f2.edgeBandId = 'eb-thick-20';
    if (f3) f3.edgeBandId = 'eb-thin-08';

    const totals = calculateEdgeBandLengths([piece1, piece2], testEdgeBands);

    // eb-thick-20: 400 + 600 = 1000 mm
    // eb-thin-08: 600 mm
    expect(totals.get('eb-thick-20')).toBe(1000);
    expect(totals.get('eb-thin-08')).toBe(600);
  });

  it('throws an error if an edge band is missing from catalog', () => {
    const piece = createPiece({
      id: 'p-bad',
      role: 'shelf',
      materialId: 'mat-1',
      contour: createRectangularContour(500, 300),
      thicknessMm: 18,
    });

    const face = piece.faces.find((f) => f.id === 'right-edge');
    if (face) face.edgeBandId = 'eb-unknown';

    expect(() => calculatePieceCutSize(piece, testEdgeBands)).toThrow(/not found in catalog/);
  });
});
