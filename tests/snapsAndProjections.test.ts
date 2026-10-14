import { describe, it, expect } from 'vitest';
import {
  calculatePieceContactProjections,
  generatePieceSnapGuides,
  resolveMagneticSnap,
  calculateFastenerDistributionPoints,
  generateFastenerDrillOperations,
  createPiece,
  createRectangularContour,
} from '../src/resolver';
import type { SpatialPieceBox } from '../src/resolver/spatial3d';

describe('CAD Smart Snaps & Contact Projections', () => {
  const dummyPiece = createPiece({
    id: 'side-left-1',
    role: 'side-left',
    materialId: 'mat-1',
    thicknessMm: 18,
    contour: createRectangularContour(500, 800),
  });

  const sampleBoxes: SpatialPieceBox[] = [
    // Left side panel: X: 0..18, Y: 0..800, Z: 0..500
    {
      pieceId: 'side-left-1',
      role: 'side-left',
      materialId: 'mat-1',
      thicknessMm: 18,
      positionMm: { x: 0, y: 0, z: 0 },
      sizeMm: { x: 18, y: 800, z: 500 },
      centerMm: { x: 9, y: 400, z: 250 },
    },
    // Shelf 1 touching side-left at X = 18..582, Y = 300..318, Z = 0..500
    {
      pieceId: 'shelf-1',
      role: 'shelf',
      materialId: 'mat-1',
      thicknessMm: 18,
      positionMm: { x: 18, y: 300, z: 0 },
      sizeMm: { x: 564, y: 18, z: 500 },
      centerMm: { x: 300, y: 309, z: 250 },
    },
    // Bottom panel touching side-left at X = 18..582, Y = 0..18, Z = 0..500
    {
      pieceId: 'bottom-1',
      role: 'bottom',
      materialId: 'mat-1',
      thicknessMm: 18,
      positionMm: { x: 18, y: 0, z: 0 },
      sizeMm: { x: 564, y: 18, z: 500 },
      centerMm: { x: 300, y: 9, z: 250 },
    },
  ];

  it('calculates contact footprint projections and centerlines on the side panel', () => {
    const projections = calculatePieceContactProjections('side-left-1', dummyPiece, sampleBoxes);
    expect(projections).toHaveLength(2);

    const shelfProj = projections.find((p) => p.sourcePieceId === 'shelf-1');
    expect(shelfProj).toBeDefined();
    expect(shelfProj?.face).toBe('face-A');
    expect(shelfProj?.axis).toBe('horizontal');
    expect(shelfProj?.yMm).toBe(300);
    expect(shelfProj?.heightMm).toBe(18);
    expect(shelfProj?.widthMm).toBe(500);
    expect(shelfProj?.centerLineMm).toBe(309); // 300 + 18/2
    expect(shelfProj?.label).toContain('Estante 1 (18 mm)');

    const bottomProj = projections.find((p) => p.sourcePieceId === 'bottom-1');
    expect(bottomProj).toBeDefined();
    expect(bottomProj?.yMm).toBe(0);
    expect(bottomProj?.heightMm).toBe(18);
    expect(bottomProj?.centerLineMm).toBe(9); // 0 + 18/2
  });

  it('generates midpoints, quarters, thirds, system-32, and projection snap guides', () => {
    const projections = calculatePieceContactProjections('side-left-1', dummyPiece, sampleBoxes);
    const { xGuides, yGuides } = generatePieceSnapGuides(500, 800, projections);

    // Midpoints
    expect(xGuides.some((g) => g.kind === 'midpoint' && g.valueMm === 250)).toBe(true);
    expect(yGuides.some((g) => g.kind === 'midpoint' && g.valueMm === 400)).toBe(true);

    // System 32 offsets (37mm from front/back)
    expect(xGuides.some((g) => g.kind === 'system32' && g.valueMm === 37)).toBe(true);
    expect(xGuides.some((g) => g.kind === 'system32' && g.valueMm === 500 - 37)).toBe(true);

    // Projection Centerline Snap
    expect(yGuides.some((g) => g.kind === 'projection-center' && g.valueMm === 309)).toBe(true);
    expect(yGuides.some((g) => g.kind === 'projection-center' && g.valueMm === 9)).toBe(true);
  });

  it('resolves magnetic snap within threshold', () => {
    const projections = calculatePieceContactProjections('side-left-1', dummyPiece, sampleBoxes);
    const guides = generatePieceSnapGuides(500, 800, projections);

    // Cursor at (35, 307) -> should snap to X=37 (diff 2 <= 12) and Y=309 (diff 2 <= 12)
    const snap = resolveMagneticSnap(35, 307, guides, 12);
    expect(snap.isSnappedX).toBe(true);
    expect(snap.isSnappedY).toBe(true);
    expect(snap.xMm).toBe(37);
    expect(snap.yMm).toBe(309);
    expect(snap.label).toContain('37 mm');
    expect(snap.label).toContain('Eje central: Estante 1');

    // Cursor far away from any guide at (200, 150) -> no snap
    const noSnap = resolveMagneticSnap(200, 150, guides, 12);
    expect(noSnap.isSnappedX).toBe(false);
    expect(noSnap.isSnappedY).toBe(false);
    expect(noSnap.xMm).toBe(200);
    expect(noSnap.yMm).toBe(150);
  });

  it('calculates equidistant fastener distributions along projection centerline', () => {
    const projections = calculatePieceContactProjections('side-left-1', dummyPiece, sampleBoxes);
    const shelfProj = projections.find((p) => p.sourcePieceId === 'shelf-1')!;

    // 2 screws: 50mm from start (0 + 50 = 50) and 50mm from end (500 - 50 = 450)
    const points2 = calculateFastenerDistributionPoints(shelfProj, {
      count: 2,
      setbackStartMm: 50,
      setbackEndMm: 50,
    });
    expect(points2).toHaveLength(2);
    expect(points2[0]).toEqual({ xMm: 50, yMm: 309 });
    expect(points2[1]).toEqual({ xMm: 450, yMm: 309 });

    // 3 screws: 50mm, midpoint (250mm), 450mm
    const points3 = calculateFastenerDistributionPoints(shelfProj, {
      count: 3,
      setbackStartMm: 50,
      setbackEndMm: 50,
    });
    expect(points3).toHaveLength(3);
    expect(points3[0]).toEqual({ xMm: 50, yMm: 309 });
    expect(points3[1]).toEqual({ xMm: 250, yMm: 309 });
    expect(points3[2]).toEqual({ xMm: 450, yMm: 309 });

    // Generates ready-to-apply CustomDrillOperation
    const ops = generateFastenerDrillOperations('side-left-1', 18, shelfProj, {
      count: 2,
      kind: 'confirmat',
      diameterMm: 5,
    });
    expect(ops).toHaveLength(2);
    expect(ops[0]!.pieceId).toBe('side-left-1');
    expect(ops[0]!.diameterMm).toBe(5);
    expect(ops[0]!.isThrough).toBe(true);
    expect(ops[0]!.depthMm).toBe(18);
    expect(ops[0]!.xMm).toBe(50);
    expect(ops[0]!.yMm).toBe(309);
  });
});
