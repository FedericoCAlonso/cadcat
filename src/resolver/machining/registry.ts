import { type Joint, type JointKind } from '../../model';
import { type IJointMachiningStrategy, type IJointMachiningRegistry } from './types';
import {
  ConfirmatJointStrategy,
  DowelAndConfirmatJointStrategy,
  ScrewJointStrategy,
  CamDowelJointStrategy,
  DowelJointStrategy,
  HingeJointStrategy,
  ShelfPinJointStrategy,
  SlideJointStrategy,
} from './strategies';

export class JointMachiningRegistry implements IJointMachiningRegistry {
  private strategies: IJointMachiningStrategy[] = [];

  public constructor() {
    this.registerDefaults();
  }

  public register(strategy: IJointMachiningStrategy): void {
    // Unshift so newer / custom strategies can take precedence if they handle the same kind
    this.strategies.unshift(strategy);
  }

  public getStrategy(joint: Joint, effectiveKind: JointKind | string): IJointMachiningStrategy | undefined {
    return this.strategies.find((s) => s.canHandle(joint, effectiveKind));
  }

  public getAllStrategies(): IJointMachiningStrategy[] {
    return [...this.strategies];
  }

  private registerDefaults(): void {
    this.strategies = [
      new ConfirmatJointStrategy(),
      new DowelAndConfirmatJointStrategy(),
      new ScrewJointStrategy(),
      new CamDowelJointStrategy(),
      new DowelJointStrategy(),
      new HingeJointStrategy(),
      new ShelfPinJointStrategy(),
      new SlideJointStrategy(),
    ];
  }
}

/**
 * Default global machining registry instance (OCP).
 */
export const defaultJointMachiningRegistry: JointMachiningRegistry = new JointMachiningRegistry();
