import { describe, it, expect } from 'vitest';
import {
  generateBillOfMaterials,
  generateBOMHardware,
  generateBOMEdgeBands,
  generateBOMPieces,
  createPiece,
  createJoint,
  JointGraph,
  createRectangularContour,
  type ResolvedPiece,
  type ResolvedModule,
  PlacementTree,
} from '../src/resolver';
import type { EdgeBand, Joint } from '../src/model';

const testEdgeBands: EdgeBand[] = [
  {
    schemaVersion: 1,
    id: 'eb-white-08',
    kind: 'adhesive',
    thicknessMm: 0.8,
    pricePerMeter: 1.2,
  },
  {
    schemaVersion: 1,
    id: 'eb-oak-20',
    kind: 'adhesive',
    thicknessMm: 2.0,
    pricePerMeter: 2.8,
  },
];

describe('Bill of Materials (BOM)', () => {
  function makeSampleResolvedModule(): ResolvedModule {
    const sideLeft = createPiece({
      id: 'side-left',
      role: 'side-left',
      materialId: 'mat-egger-white-18',
      contour: createRectangularContour(560, 800),
      thicknessMm: 18,
    });
    const sideLeftFace = sideLeft.faces.find((f) => f.id === 'right-edge');
    if (sideLeftFace) sideLeftFace.edgeBandId = 'eb-oak-20'; // 2.0 mm on front

    const sideRight = createPiece({
      id: 'side-right',
      role: 'side-right',
      materialId: 'mat-egger-white-18',
      contour: createRectangularContour(560, 800),
      thicknessMm: 18,
    });
    const sideRightFace = sideRight.faces.find((f) => f.id === 'right-edge');
    if (sideRightFace) sideRightFace.edgeBandId = 'eb-oak-20'; // 2.0 mm on front

    const bottom = createPiece({
      id: 'bottom',
      role: 'bottom',
      materialId: 'mat-egger-white-18',
      contour: createRectangularContour(564, 560),
      thicknessMm: 18,
    });
    const bottomFace = bottom.faces.find((f) => f.id === 'right-edge');
    if (bottomFace) bottomFace.edgeBandId = 'eb-white-08'; // 0.8 mm on front

    const resolvedSideLeft: ResolvedPiece = {
      ...sideLeft,
      dimensionsMm: { width: 560, height: 800 },
      positionMm: { x: 0, y: 0, z: 0 },
    };

    const resolvedSideRight: ResolvedPiece = {
      ...sideRight,
      dimensionsMm: { width: 560, height: 800 },
      positionMm: { x: 582, y: 0, z: 0 },
    };

    const resolvedBottom: ResolvedPiece = {
      ...bottom,
      dimensionsMm: { width: 564, height: 560 },
      positionMm: { x: 18, y: 0, z: 0 },
    };

    const joints: Joint[] = [
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
        a: { pieceId: 'bottom', faceId: 'face-a' },
        b: { pieceId: 'shelf', faceId: 'face-b' },
        kind: 'butt',
      }),
    ];

    const tree = new PlacementTree('side-left');
    const graph = new JointGraph(joints);

    return {
      moduleId: 'base-module-600',
      parameters: { width: 600, height: 800, depth: 560 },
      pieces: [resolvedSideLeft, resolvedSideRight, resolvedBottom],
      joints,
      placementTree: tree,
      jointGraph: graph,
    };
  }

  it('generates BOM pieces with cut sizes and areas', () => {
    const mod = makeSampleResolvedModule();
    const items = generateBOMPieces(mod.pieces, testEdgeBands);

    expect(items).toHaveLength(3);
    const sideItem = items.find((p) => p.pieceId === 'side-left');
    expect(sideItem).toBeDefined();
    // Finished: 560x800, cut width = 560 - 2.0 = 558 mm, cut height = 800 mm
    expect(sideItem?.cutDimensionsMm).toEqual({ width: 558, height: 800 });
    expect(sideItem?.areaM2).toBeCloseTo((558 * 800) / 1_000_000, 4);
    expect(sideItem?.bandedEdges).toHaveLength(1);
  });

  it('summarizes edge band meters by type', () => {
    const mod = makeSampleResolvedModule();
    const edgeSummary = generateBOMEdgeBands(mod.pieces, testEdgeBands);

    expect(edgeSummary).toHaveLength(2);

    // eb-oak-20 is on side-left (800mm) and side-right (800mm) = 1600mm = 1.6m
    const oakBand = edgeSummary.find((eb) => eb.edgeBandId === 'eb-oak-20');
    expect(oakBand).toBeDefined();
    expect(oakBand?.lengthMm).toBe(1600);
    expect(oakBand?.lengthMeters).toBe(1.6);

    // eb-white-08 is on bottom (560mm) = 560mm = 0.56m
    const whiteBand = edgeSummary.find((eb) => eb.edgeBandId === 'eb-white-08');
    expect(whiteBand).toBeDefined();
    expect(whiteBand?.lengthMm).toBe(560);
    expect(whiteBand?.lengthMeters).toBe(0.56);
  });

  it('counts hardware from joints', () => {
    const mod = makeSampleResolvedModule();
    const hardware = generateBOMHardware(mod);

    // Two confirmat joints (2 each) = 4 confirmat screws
    // One butt joint = 0 hardware
    expect(hardware).toHaveLength(1);
    expect(hardware[0]?.hardwareId).toBe('hw-confirmat-7x50');
    expect(hardware[0]?.count).toBe(4);
  });

  it('generates a complete Bill of Materials structure', () => {
    const mod = makeSampleResolvedModule();
    const bom = generateBillOfMaterials(mod, testEdgeBands);

    expect(bom.moduleId).toBe('base-module-600');
    expect(bom.totalPieceCount).toBe(3);
    expect(bom.totalHardwareCount).toBe(4);
    expect(bom.totalEdgeBandMeters).toBeCloseTo(1.6 + 0.56, 2);
    expect(bom.totalCutAreaM2).toBeGreaterThan(0);
  });
});
