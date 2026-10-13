import { describe, it, expect } from 'vitest';
import {
  createJoint,
  JointGraph,
  PlacementTree,
  resolveModule,
  createPiece,
  createRectangularContour,
} from '../src/resolver';
import type { Module } from '../src/model';

describe('Joint and JointGraph', () => {
  it('creates valid joint and queries graph connections', () => {
    const joint = createJoint({
      a: { pieceId: 'side-left', faceId: 'inner' },
      b: { pieceId: 'shelf', faceId: 'left-edge' },
      kind: 'dowel',
    });

    const graph = new JointGraph([joint]);

    expect(graph.getAllJoints()).toHaveLength(1);
    expect(graph.getJointsForPiece('side-left')).toHaveLength(1);
    expect(graph.getJointsForPiece('shelf')).toHaveLength(1);
    expect(graph.getJointsBetween('side-left', 'shelf')).toHaveLength(1);
    expect(graph.getNeighbors('side-left')).toEqual(['shelf']);
  });
});

describe('PlacementTree', () => {
  it('computes absolute positions from root and relative offsets', () => {
    const tree = new PlacementTree('bottom');

    tree.setNode({
      pieceId: 'side-left',
      parentPieceId: 'bottom',
      relativeOffset: { x: 0, y: 0, z: 0 },
    });

    tree.setNode({
      pieceId: 'shelf',
      parentPieceId: 'side-left',
      relativeOffset: { x: 18, y: 350, z: 0 },
    });

    const positions = tree.resolvePositions();

    expect(positions.get('bottom')).toEqual({ x: 0, y: 0, z: 0 });
    expect(positions.get('side-left')).toEqual({ x: 0, y: 0, z: 0 });
    expect(positions.get('shelf')).toEqual({ x: 18, y: 350, z: 0 });
  });

  it('rejects circular dependencies in placement tree', () => {
    const tree = new PlacementTree('piece-a');

    tree.setNode({
      pieceId: 'piece-b',
      parentPieceId: 'piece-c',
      relativeOffset: { x: 10, y: 0, z: 0 },
    });

    tree.setNode({
      pieceId: 'piece-c',
      parentPieceId: 'piece-b',
      relativeOffset: { x: 10, y: 0, z: 0 },
    });

    expect(() => tree.resolvePositions()).toThrow(/Circular dependency detected/);
  });
});

describe('Module Size and Position Resolver', () => {
  function makeTestCabinet(moduleWidth: number): Module {
    const sideThickness = 18;
    const sideDepth = 560;
    const sideHeight = 800;

    const sideLeft = createPiece({
      id: 'side-left',
      role: 'side-left',
      materialId: 'mat-egger-white-18',
      contour: createRectangularContour(sideDepth, sideHeight),
      thicknessMm: sideThickness,
    });

    const sideRight = createPiece({
      id: 'side-right',
      role: 'side-right',
      materialId: 'mat-egger-white-18',
      contour: createRectangularContour(sideDepth, sideHeight),
      thicknessMm: sideThickness,
    });

    const shelf = createPiece({
      id: 'shelf-1',
      role: 'shelf',
      materialId: 'mat-egger-white-18',
      contour: createRectangularContour(100, sideDepth), // Initial temporary width
      thicknessMm: sideThickness,
    });

    const jointLeft = createJoint({
      a: { pieceId: 'side-left', faceId: 'inner' },
      b: { pieceId: 'shelf-1', faceId: 'left-edge' },
      kind: 'dowel',
    });

    const jointRight = createJoint({
      a: { pieceId: 'side-right', faceId: 'inner' },
      b: { pieceId: 'shelf-1', faceId: 'right-edge' },
      kind: 'dowel',
    });

    return {
      schemaVersion: 1,
      id: 'cabinet-module',
      parameters: { width: moduleWidth, height: sideHeight, depth: sideDepth },
      rootPieceId: 'side-left',
      pieces: [sideLeft, sideRight, shelf],
      joints: [jointLeft, jointRight],
      subAssemblies: [],
      overrides: {},
    };
  }

  it('resolves shelf width from the distance between two sides', () => {
    const module = makeTestCabinet(600);
    const placementTree = new PlacementTree(module.rootPieceId);

    placementTree.setNode({
      pieceId: 'side-right',
      parentPieceId: 'side-left',
      relativeOffset: { x: 600 - 18, y: 0, z: 0 },
    });

    placementTree.setNode({
      pieceId: 'shelf-1',
      parentPieceId: 'side-left',
      relativeOffset: { x: 18, y: 400, z: 0 },
    });

    const resolved = resolveModule({ module, placementTree });

    const resolvedShelf = resolved.pieces.find((p) => p.id === 'shelf-1');
    expect(resolvedShelf).toBeDefined();
    // Inner span: 600 - 18 (sideRight.x) - 18 (sideLeft thickness) = 564 mm
    expect(resolvedShelf?.dimensionsMm.width).toBe(564);
    expect(resolvedShelf?.positionMm.x).toBe(18);
  });

  it('updates dependent piece sizes when module width parameter changes', () => {
    const widthA = 600;
    const moduleA = makeTestCabinet(widthA);
    const treeA = new PlacementTree(moduleA.rootPieceId);
    treeA.setNode({
      pieceId: 'side-right',
      parentPieceId: 'side-left',
      relativeOffset: { x: widthA - 18, y: 0, z: 0 },
    });
    treeA.setNode({
      pieceId: 'shelf-1',
      parentPieceId: 'side-left',
      relativeOffset: { x: 18, y: 400, z: 0 },
    });

    const resolvedA = resolveModule({ module: moduleA, placementTree: treeA });
    const shelfA = resolvedA.pieces.find((p) => p.id === 'shelf-1');
    expect(shelfA?.dimensionsMm.width).toBe(564);

    // Change width to 800 mm
    const widthB = 800;
    const moduleB = makeTestCabinet(widthB);
    const treeB = new PlacementTree(moduleB.rootPieceId);
    treeB.setNode({
      pieceId: 'side-right',
      parentPieceId: 'side-left',
      relativeOffset: { x: widthB - 18, y: 0, z: 0 },
    });
    treeB.setNode({
      pieceId: 'shelf-1',
      parentPieceId: 'side-left',
      relativeOffset: { x: 18, y: 400, z: 0 },
    });

    const resolvedB = resolveModule({ module: moduleB, placementTree: treeB });
    const shelfB = resolvedB.pieces.find((p) => p.id === 'shelf-1');
    // Inner span: 800 - 18 - 18 = 764 mm
    expect(shelfB?.dimensionsMm.width).toBe(764);
  });

  it('detects circular dependencies in size rules and reports an error', () => {
    const module = makeTestCabinet(600);
    const tree = new PlacementTree(module.rootPieceId);

    tree.setNode({
      pieceId: 'side-right',
      parentPieceId: 'side-left',
      relativeOffset: { x: 582, y: 0, z: 0 },
    });

    tree.setNode({
      pieceId: 'shelf-1',
      parentPieceId: 'side-left',
      relativeOffset: { x: 18, y: 400, z: 0 },
    });

    expect(() =>
      resolveModule({
        module,
        placementTree: tree,
        sizeRules: [
          { pieceId: 'side-left', axis: 'x', spanBetween: ['shelf-1', 'side-right'] },
        ],
      }),
    ).toThrow(/Circular dependency detected/);
  });

  it('applies manual overrides to resolved piece dimensions', () => {
    const module = makeTestCabinet(600);
    module.overrides['shelf-1'] = {
      pieceId: 'shelf-1',
      property: 'width',
      value: 550,
    };

    const tree = new PlacementTree(module.rootPieceId);
    tree.setNode({
      pieceId: 'side-right',
      parentPieceId: 'side-left',
      relativeOffset: { x: 582, y: 0, z: 0 },
    });
    tree.setNode({
      pieceId: 'shelf-1',
      parentPieceId: 'side-left',
      relativeOffset: { x: 18, y: 400, z: 0 },
    });

    const resolved = resolveModule({ module, placementTree: tree });
    const shelf = resolved.pieces.find((p) => p.id === 'shelf-1');

    expect(shelf?.dimensionsMm.width).toBe(550);
  });
});
