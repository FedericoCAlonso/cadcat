import {
  type IBayContentResolver,
  type BayResolutionContext,
  type ComponentSolverResult,
} from './types';
import { type BayContentEmpty } from '../types';

export class EmptyBayResolver implements IBayContentResolver<BayContentEmpty> {
  public readonly type = 'empty' as const;

  public resolve(_context: BayResolutionContext<BayContentEmpty>): ComponentSolverResult {
    return {
      pieces: [],
      joints: [],
      placementNodes: [],
      subAssemblies: [],
    };
  }
}
