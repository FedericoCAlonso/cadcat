import { describe, it, expect } from 'vitest';
import {
  calculateJointDrillSpacings,
  deriveModuleDrillOperations,
  groupOperationsByPiece,
  buildBaseCabinet,
  buildDoorCabinet,
  createPiece,
  createJoint,
  createRectangularContour,
} from '../src/resolver';
import type { Material } from '../src/model';

const testMaterial: Material = {
  schemaVersion: 1,
  id: 'mat-test-18',
  name: 'Melamine White 18mm',
  thicknessMm: 18,
  sheetSizeMm: { length: 2750, width: 1830 },
  hasGrain: false,
  milling: { hidden: 'yes', visible: 'no', onStructuralPiece: 'limited' },
};

describe('Machining Derivation - Joint Drill Spacings', () => {
  it('calculates 2 drill points for contact lengths <= 600mm', () => {
    const points560 = calculateJointDrillSpacings(560, 50);
    expect(points560).toEqual([50, 510]);

    const points400 = calculateJointDrillSpacings(400, 37);
    expect(points400).toEqual([37, 363]);
  });

  it('calculates 3 drill points for contact lengths > 600mm', () => {
    const points800 = calculateJointDrillSpacings(800, 50);
    expect(points800).toEqual([50, 400, 750]);
  });
});

describe('Machining Derivation - Specific Joint Rules', () => {
  it('derives confirmat operations: through holes on face A and blind core on edge', () => {
    const side = createPiece({
      id: 'p-side',
      role: 'side-left',
      materialId: testMaterial.id,
      contour: createRectangularContour(560, 800),
      thicknessMm: 18,
    });

    const bottom = createPiece({
      id: 'p-bottom',
      role: 'bottom',
      materialId: testMaterial.id,
      contour: createRectangularContour(564, 560),
      thicknessMm: 18,
    });

    const joint = createJoint({
      a: { pieceId: 'p-side', faceId: 'inner' },
      b: { pieceId: 'p-bottom', faceId: 'left-edge' },
      kind: 'confirmat',
    });

    const ops = deriveModuleDrillOperations([side, bottom], [joint]);

    // 2 holes along 560mm length = 4 operations total (2 on side, 2 on bottom)
    expect(ops).toHaveLength(4);

    const sideOps = ops.filter((o) => o.pieceId === 'p-side');
    expect(sideOps).toHaveLength(2);
    expect(sideOps[0]!.diameterMm).toBe(7);
    expect(sideOps[0]!.depthMm).toBe(18);
    expect(sideOps[0]!.isThrough).toBe(true);
    expect(sideOps[0]!.faceType).toBe('face-A');

    const bottomOps = ops.filter((o) => o.pieceId === 'p-bottom');
    expect(bottomOps).toHaveLength(2);
    expect(bottomOps[0]!.diameterMm).toBe(5);
    expect(bottomOps[0]!.depthMm).toBe(50);
    expect(bottomOps[0]!.isThrough).toBe(false);
    expect(bottomOps[0]!.faceType).toBe('edge');
  });

  it('derives cam-dowel (minifix) operations: anchor hole, cam pocket at 34mm setback, and edge channel', () => {
    const side = createPiece({
      id: 'p-side',
      role: 'side-left',
      materialId: testMaterial.id,
      contour: createRectangularContour(560, 800),
      thicknessMm: 18,
    });

    const shelf = createPiece({
      id: 'p-shelf',
      role: 'shelf',
      materialId: testMaterial.id,
      contour: createRectangularContour(564, 560),
      thicknessMm: 18,
    });

    const joint = createJoint({
      a: { pieceId: 'p-side', faceId: 'inner' },
      b: { pieceId: 'p-shelf', faceId: 'left-edge' },
      kind: 'cam-dowel',
    });

    const ops = deriveModuleDrillOperations([side, shelf], [joint]);

    // 2 dowel anchors on side, 2 cam pockets on shelf face, 2 bolt channels in shelf edge = 6 ops
    expect(ops).toHaveLength(6);

    const shelfPockets = ops.filter(
      (o) => o.pieceId === 'p-shelf' && o.faceType === 'face-A',
    );
    expect(shelfPockets).toHaveLength(2);
    expect(shelfPockets[0]!.diameterMm).toBe(15);
    expect(shelfPockets[0]!.depthMm).toBe(13.5);
    expect(shelfPockets[0]!.positionMm.y).toBe(34); // setback from edge

    const shelfEdgeChannels = ops.filter(
      (o) => o.pieceId === 'p-shelf' && o.faceType === 'edge',
    );
    expect(shelfEdgeChannels).toHaveLength(2);
    expect(shelfEdgeChannels[0]!.diameterMm).toBe(8);
  });

  it('derives hinge operations: 35mm cup hole on door and System 32 mounting plate holes on carcase side', () => {
    const door = createPiece({
      id: 'p-door',
      role: 'door-left',
      materialId: testMaterial.id,
      contour: createRectangularContour(596, 796),
      thicknessMm: 18,
    });

    const side = createPiece({
      id: 'p-side',
      role: 'side-left',
      materialId: testMaterial.id,
      contour: createRectangularContour(560, 800),
      thicknessMm: 18,
    });

    const hingeJoint = createJoint({
      a: { pieceId: 'p-door', faceId: 'inner' },
      b: { pieceId: 'p-side', faceId: 'inner' },
      kind: 'hinge',
      offsetMm: 100,
    });

    const ops = deriveModuleDrillOperations([door, side], [hingeJoint]);

    // 1 cup hole on door + 2 plate holes on side = 3 ops
    expect(ops).toHaveLength(3);

    const doorCup = ops.find((o) => o.pieceId === 'p-door')!;
    expect(doorCup.diameterMm).toBe(35);
    expect(doorCup.depthMm).toBe(12);
    expect(doorCup.positionMm.x).toBe(21.5);
    expect(doorCup.positionMm.y).toBe(100);

    const sidePlateHoles = ops.filter((o) => o.pieceId === 'p-side');
    expect(sidePlateHoles).toHaveLength(2);
    expect(sidePlateHoles[0]!.positionMm.x).toBe(37); // System 32 front setback
    expect(sidePlateHoles[0]!.positionMm.y).toBe(84);  // 100 - 16
    expect(sidePlateHoles[1]!.positionMm.y).toBe(116); // 100 + 16
  });

  it('derives shelf-pin support holes on carcase side', () => {
    const side = createPiece({
      id: 'p-side',
      role: 'side-left',
      materialId: testMaterial.id,
      contour: createRectangularContour(560, 800),
      thicknessMm: 18,
    });

    const shelf = createPiece({
      id: 'p-shelf',
      role: 'shelf',
      materialId: testMaterial.id,
      contour: createRectangularContour(564, 540),
      thicknessMm: 18,
    });

    const pinJoint = createJoint({
      a: { pieceId: 'p-side', faceId: 'inner' },
      b: { pieceId: 'p-shelf', faceId: 'left-edge' },
      kind: 'shelf-pin',
      offsetMm: 400,
    });

    const ops = deriveModuleDrillOperations([side, shelf], [pinJoint]);

    // 2 holes on carcase side (front and rear)
    expect(ops).toHaveLength(2);
    expect(ops[0]!.diameterMm).toBe(5);
    expect(ops[0]!.positionMm.x).toBe(37);
    expect(ops[0]!.positionMm.y).toBe(400);

    expect(ops[1]!.positionMm.x).toBe(560 - 37);
    expect(ops[1]!.positionMm.y).toBe(400);
  });
});

describe('Machining Derivation - Integrated Modules & Grouping', () => {
  it('derives all operations for base cabinet and groups by piece', () => {
    const built = buildBaseCabinet(
      { width: 600, height: 800, depth: 560 },
      testMaterial,
    );

    const ops = deriveModuleDrillOperations(built.module.pieces, built.module.joints);
    expect(ops.length).toBeGreaterThan(10);

    const grouped = groupOperationsByPiece(built.module.pieces, ops);
    expect(grouped).toHaveLength(built.module.pieces.length);

    const sideL = grouped.find((g) => g.pieceId === 'base-side-left')!;
    expect(sideL.operations.length).toBeGreaterThan(0);
  });

  it('derives door cabinet operations with hinge cups and shelf pins', () => {
    const built = buildDoorCabinet(
      { width: 600, height: 800, depth: 560 },
      testMaterial,
    );

    const ops = deriveModuleDrillOperations(built.module.pieces, built.module.joints);
    const cupOps = ops.filter((o) => o.diameterMm === 35);
    expect(cupOps.length).toBeGreaterThanOrEqual(2); // At least 2 hinges on door

    const shelfPinOps = ops.filter((o) => o.sourceJointKind === 'shelf-pin');
    expect(shelfPinOps.length).toBeGreaterThanOrEqual(2);
  });
});
