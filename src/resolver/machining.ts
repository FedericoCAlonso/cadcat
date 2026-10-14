import {
  type Piece,
  type Joint,
  type JointKind,
  type MachiningConfig,
  machiningConfigSchema,
} from '../model';
import { type DrillOperation, type PieceMachining } from '../model/operation';
import type { ResolvedPiece } from './resolver';
import defaultProjectConfigJson from '../config/defaultProjectConfig.json';
import {
  calculateJointDrillSpacings,
  deriveContactGeometry,
  deriveFaceType,
} from './machining/geometry';
import {
  type IJointMachiningStrategy,
  type IJointMachiningRegistry,
  type JointMachiningContext,
} from './machining/types';
import {
  JointMachiningRegistry,
  defaultJointMachiningRegistry,
} from './machining/registry';

export type MachiningShopDefaults = MachiningConfig;

export const DEFAULT_MACHINING_SHOP_VALUES: MachiningConfig = machiningConfigSchema.parse(
  defaultProjectConfigJson.machining,
);

export {
  calculateJointDrillSpacings,
  deriveContactGeometry,
  deriveFaceType,
  type IJointMachiningStrategy,
  type IJointMachiningRegistry,
  type JointMachiningContext,
  JointMachiningRegistry,
  defaultJointMachiningRegistry,
};

export * from './machining/strategies';

/**
 * Derives drill operations for all pieces in a module from its joints.
 * Uses exact 3D positioning when available and supports configurable joint strategies
 * through a registry of strategies (adhering to OCP and SRP).
 */
export function deriveModuleDrillOperations(
  pieces: (Piece | ResolvedPiece)[],
  joints: Joint[],
  shopDefaults: Partial<MachiningConfig> = DEFAULT_MACHINING_SHOP_VALUES,
  registry: IJointMachiningRegistry = defaultJointMachiningRegistry,
  pieceJointOverrides?: Record<string, JointKind>,
  customOperations: import('../model/operation').CustomPieceOperation[] = [],
): DrillOperation[] {
  const defaults: MachiningConfig = {
    ...DEFAULT_MACHINING_SHOP_VALUES,
    ...shopDefaults,
  };

  const pieceMap = new Map<string, Piece | ResolvedPiece>();
  for (const p of pieces) {
    pieceMap.set(p.id, p);
  }

  const operations: DrillOperation[] = [];
  let opIndex = 1;
  const generateOpId = () => `op-drill-${opIndex++}`;

  for (const joint of joints) {
    const pieceA = pieceMap.get(joint.a.pieceId);
    const pieceB = pieceMap.get(joint.b.pieceId);
    if (!pieceA || !pieceB) continue;

    const overrideA = pieceJointOverrides?.[joint.a.pieceId];
    const overrideB = pieceJointOverrides?.[joint.b.pieceId];
    const pieceOverride = overrideA ?? overrideB;

    const baseKind = pieceOverride ?? joint.kind;
    const effectiveKind: JointKind | string =
      !pieceOverride && baseKind === 'confirmat' && defaults.jointStrategy
        ? defaults.jointStrategy
        : baseKind;

    const strategy = registry.getStrategy(joint, effectiveKind);
    if (strategy) {
      const ops = strategy.generateOperations({
        pieceA,
        pieceB,
        joint,
        effectiveKind,
        config: defaults,
        generateOpId,
      });
      operations.push(...ops);
    }
  }

  // Merge any custom drill operations (Point 8)
  for (const cop of customOperations) {
    if (cop.kind === 'drill') {
      operations.push({
        schemaVersion: 1,
        id: cop.id,
        pieceId: cop.pieceId,
        faceId: cop.faceType === 'face-B' ? 'outer' : 'inner',
        faceType: cop.faceType,
        diameterMm: cop.diameterMm,
        depthMm: cop.depthMm,
        isThrough: cop.isThrough,
        positionMm: { x: cop.xMm, y: cop.yMm },
        origin: 'manual',
        description: cop.description ?? 'Perforación manual',
      });
    }
  }

  return operations;
}

/**
 * Groups derived operations by piece and determines whether flipping/turning the piece is needed.
 */
export function groupOperationsByPiece(
  pieces: Piece[],
  operations: DrillOperation[],
  customOperations: import('../model/operation').CustomPieceOperation[] = [],
): PieceMachining[] {
  const opMap = new Map<string, DrillOperation[]>();
  for (const op of operations) {
    const list = opMap.get(op.pieceId) ?? [];
    list.push(op);
    opMap.set(op.pieceId, list);
  }

  return pieces.map((piece) => {
    const pieceOps = opMap.get(piece.id) ?? [];
    const pieceCustomOps = customOperations.filter((o) => o.pieceId === piece.id);
    const hasFaceA = pieceOps.some((o) => o.faceType === 'face-A');
    const hasFaceB = pieceOps.some((o) => o.faceType === 'face-B');
    const hasFaceBCustom = pieceCustomOps.some((o) => o.faceType === 'face-B');
    const requiresTurn = (hasFaceA && (hasFaceB || hasFaceBCustom)) || hasFaceB || hasFaceBCustom;

    return {
      schemaVersion: 1,
      pieceId: piece.id,
      role: piece.role,
      operations: pieceOps,
      customOperations: pieceCustomOps,
      requiresTurn,
    };
  });
}
