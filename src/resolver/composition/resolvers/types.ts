import { type Piece, type Joint, type SubAssembly } from '../../../model';
import { type PlacementNode } from '../../tree';
import {
  type BayBoundingBox,
  type BayContent,
  type ModuleMaterialRoles,
} from '../types';

export interface ComponentSolverOptions {
  carcassThicknessMm: number;
  frontThicknessMm?: number;
  boxThicknessMm?: number;
  backingThicknessMm?: number;
  drawerBottomScrewedDeductionWidthMm?: number;
  drawerBottomScrewedDeductionDepthMm?: number;
  edgeBandId?: string;
  rootPieceId: string;
  idPrefix?: string;
}

export interface ComponentSolverResult {
  pieces: Piece[];
  joints: Joint[];
  placementNodes: PlacementNode[];
  subAssemblies: SubAssembly[];
}

/**
 * Context passed to a bay content resolver (ISP).
 */
export interface BayResolutionContext<T extends BayContent = BayContent> {
  bay: BayBoundingBox;
  content: T;
  materials: ModuleMaterialRoles;
  options: ComponentSolverOptions;
}

/**
 * Strategy interface for resolving a specific bay content component (SRP, OCP, LSP).
 */
export interface IBayContentResolver<T extends BayContent = BayContent> {
  readonly type: T['type'];
  resolve(context: BayResolutionContext<T>): ComponentSolverResult;
}

/**
 * Registry interface for bay content resolvers (DIP).
 */
export interface IBayContentRegistry {
  register(resolver: IBayContentResolver): void;
  getResolver(type: string): IBayContentResolver | undefined;
}
