import {
  type Module,
  type Piece,
  type Joint,
} from '../model';
import { JointGraph } from './joint';
import { PlacementTree, type Position3D } from './tree';
import { createRectangularContour } from './piece';

export interface ResolvedPiece extends Piece {
  positionMm: Position3D;
  dimensionsMm: {
    width: number;
    height: number;
  };
}

export interface ResolvedModule {
  moduleId: string;
  parameters: Record<string, number>;
  pieces: ResolvedPiece[];
  joints: Joint[];
  placementTree: PlacementTree;
  jointGraph: JointGraph;
}

export interface SizeCalculationRule {
  pieceId: string;
  axis: 'x' | 'y' | 'z';
  spanBetween: [string, string]; // [pieceAId, pieceBId]
}

export interface ModuleResolverDefinition {
  module: Module;
  placementTree?: PlacementTree;
  sizeRules?: SizeCalculationRule[];
}

/**
 * Topologically sort piece IDs based on dependency graph.
 * Detects and throws on circular dependencies.
 */
export function sortDependencies(
  nodes: string[],
  dependencies: Map<string, Set<string>>,
): string[] {
  const sorted: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(node: string, path: string[]): void {
    if (visiting.has(node)) {
      const cyclePath = [...path, node].join(' -> ');
      throw new Error(`Circular dependency detected: ${cyclePath}`);
    }
    if (!visited.has(node)) {
      visiting.add(node);
      const deps = dependencies.get(node);
      if (deps) {
        for (const dep of deps) {
          visit(dep, [...path, node]);
        }
      }
      visiting.delete(node);
      visited.add(node);
      sorted.push(node);
    }
  }

  for (const node of nodes) {
    if (!visited.has(node)) {
      visit(node, []);
    }
  }

  return sorted;
}

/**
 * Resolve piece positions and sizes for a module.
 */
export function resolveModule(definition: ModuleResolverDefinition): ResolvedModule {
  const { module, sizeRules = [] } = definition;
  const jointGraph = new JointGraph(module.joints);

  // Initialize or use provided placement tree
  const rootId = module.rootPieceId;
  const placementTree = definition.placementTree ?? new PlacementTree(rootId);

  // Build dependency graph
  const dependencies = new Map<string, Set<string>>();
  for (const piece of module.pieces) {
    dependencies.set(piece.id, new Set());
  }

  // Placement dependencies
  for (const piece of module.pieces) {
    const node = placementTree.getNode(piece.id);
    if (node?.parentPieceId) {
      dependencies.get(piece.id)?.add(node.parentPieceId);
    }
  }

  // Size span dependencies
  for (const rule of sizeRules) {
    const [depA, depB] = rule.spanBetween;
    const pieceDeps = dependencies.get(rule.pieceId);
    if (pieceDeps) {
      pieceDeps.add(depA);
      pieceDeps.add(depB);
    }
  }

  // Joint-based loop dependencies (pieces spanning between two opposing pieces)
  for (const piece of module.pieces) {
    const joints = jointGraph.getJointsForPiece(piece.id);
    const leftJoint = joints.find((j) => (j.a.pieceId === piece.id ? j.a.faceId : j.b.faceId) === 'left-edge');
    const rightJoint = joints.find((j) => (j.a.pieceId === piece.id ? j.a.faceId : j.b.faceId) === 'right-edge');

    if (leftJoint && rightJoint) {
      const leftNeighbor = leftJoint.a.pieceId === piece.id ? leftJoint.b.pieceId : leftJoint.a.pieceId;
      const rightNeighbor = rightJoint.a.pieceId === piece.id ? rightJoint.b.pieceId : rightJoint.a.pieceId;
      if (leftNeighbor !== piece.id && rightNeighbor !== piece.id && leftNeighbor !== rightNeighbor) {
        dependencies.get(piece.id)?.add(leftNeighbor);
        dependencies.get(piece.id)?.add(rightNeighbor);
      }
    }
  }

  // Check for circular dependencies and sort
  const pieceIds = module.pieces.map((p) => p.id);
  sortDependencies(pieceIds, dependencies);

  // Resolve positions using placement tree
  const positions = placementTree.resolvePositions();

  // Map piece by id
  const pieceMap = new Map<string, Piece>();
  for (const p of module.pieces) {
    pieceMap.set(p.id, p);
  }

  // Resolve pieces
  const resolvedPieces: ResolvedPiece[] = module.pieces.map((piece) => {
    const pos = positions.get(piece.id) ?? { x: 0, y: 0, z: 0 };
    let width = piece.contour.points[1]?.x ?? 0;
    let height = piece.contour.points[2]?.y ?? 0;

    // Check if joints close a loop between two opposing pieces (e.g. shelf between two sides)
    const joints = jointGraph.getJointsForPiece(piece.id);
    const leftJoint = joints.find((j) => (j.a.pieceId === piece.id ? j.a.faceId : j.b.faceId) === 'left-edge');
    const rightJoint = joints.find((j) => (j.a.pieceId === piece.id ? j.a.faceId : j.b.faceId) === 'right-edge');

    if (leftJoint && rightJoint) {
      const leftPieceId = leftJoint.a.pieceId === piece.id ? leftJoint.b.pieceId : leftJoint.a.pieceId;
      const rightPieceId = rightJoint.a.pieceId === piece.id ? rightJoint.b.pieceId : rightJoint.a.pieceId;
      const leftPos = positions.get(leftPieceId);
      const rightPos = positions.get(rightPieceId);
      const leftPiece = pieceMap.get(leftPieceId);

      if (leftPos && rightPos && leftPiece) {
        const innerLeftX = leftPos.x + leftPiece.thicknessMm;
        const innerRightX = rightPos.x;
        const calculatedSpan = innerRightX - innerLeftX;
        if (calculatedSpan > 0) {
          width = calculatedSpan;
          pos.x = innerLeftX;
        }
      }
    }

    // Apply explicit size calculation rules if provided
    for (const rule of sizeRules) {
      if (rule.pieceId === piece.id) {
        const [idA, idB] = rule.spanBetween;
        const posA = positions.get(idA);
        const posB = positions.get(idB);
        const pieceA = pieceMap.get(idA);
        if (posA && posB && pieceA) {
          const span = posB[rule.axis] - (posA[rule.axis] + pieceA.thicknessMm);
          if (span > 0) {
            if (rule.axis === 'x') width = span;
            if (rule.axis === 'y') height = span;
          }
        }
      }
    }

    // Apply manual overrides from module.overrides if present
    const override = module.overrides[piece.id];
    if (override) {
      if (override.property === 'width' && typeof override.value === 'number') {
        width = override.value;
      }
      if (override.property === 'height' && typeof override.value === 'number') {
        height = override.value;
      }
      if (override.property === 'thicknessMm' && typeof override.value === 'number') {
        piece.thicknessMm = override.value;
      }
    }

    // Update contour with resolved width and height
    const resolvedContour = createRectangularContour(width, height);

    return {
      ...piece,
      contour: resolvedContour,
      dimensionsMm: { width, height },
      positionMm: pos,
    };
  });

  return {
    moduleId: module.id,
    parameters: { ...module.parameters },
    pieces: resolvedPieces,
    joints: module.joints,
    placementTree,
    jointGraph,
  };
}
