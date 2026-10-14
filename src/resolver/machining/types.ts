import {
  type Piece,
  type Joint,
  type JointKind,
  type MachiningConfig,
} from '../../model';
import { type DrillOperation } from '../../model/operation';
import { type ResolvedPiece } from '../resolver';

/**
 * Segregated context passed to joint machining strategies (ISP).
 */
export interface JointMachiningContext {
  pieceA: Piece | ResolvedPiece;
  pieceB: Piece | ResolvedPiece;
  joint: Joint;
  effectiveKind: JointKind | string;
  config: MachiningConfig;
  generateOpId: () => string;
}

/**
 * Strategy interface for generating drill operations for a specific joint type (SRP, OCP, LSP).
 */
export interface IJointMachiningStrategy {
  /**
   * Primary joint kind this strategy handles.
   */
  readonly kind: JointKind | string;

  /**
   * Determines if this strategy can handle the given joint and effective kind.
   */
  canHandle(joint: Joint, effectiveKind: JointKind | string): boolean;

  /**
   * Generates drill operations for the given joint and pieces according to configuration.
   */
  generateOperations(context: JointMachiningContext): DrillOperation[];
}

/**
 * Interface for the joint machining strategy registry (DIP).
 */
export interface IJointMachiningRegistry {
  register(strategy: IJointMachiningStrategy): void;
  getStrategy(joint: Joint, effectiveKind: JointKind | string): IJointMachiningStrategy | undefined;
}
