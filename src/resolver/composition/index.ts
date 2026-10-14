export {
  type JointPriority,
  type RoofType,
  type BackingType,
  type CarcassDefinition,
  type InteriorBounds,
  type TrackSize,
  type ResolvedTrack,
  type GridDivider,
  type BayGridDefinition,
  type BayBoundingBox,
  type DrawerSlideType,
  type DrawerFrontMount,
  type DoorMountType,
  type BayContent,
  type ModuleMaterialRoles,
  type PieceEdgeBandOverride,
  type ModularModuleDefinition,
} from './types';

export {
  type AnchorSolverInput,
  type AnchorSolverResult,
  resolveCarcass,
} from './anchorSolver';

export {
  type ResolveTracksResult,
  type SubdivideBayResult,
  resolveTracks,
  subdivideBay,
  formatTracksToGridString,
  parseGridStringToTracks,
} from './gridSolver';

export {
  type ComponentSolverOptions,
  type ComponentSolverResult,
  resolveBayContent,
  type IBayContentResolver,
  type IBayContentRegistry,
  type BayResolutionContext,
  BayContentRegistry,
  defaultBayContentRegistry,
  EmptyBayResolver,
  ShelvesBayResolver,
  DrawerStackBayResolver,
  DoorsBayResolver,
  PullOutTrayBayResolver,
  BiFoldClosureBayResolver,
} from './componentSolver';

export {
  type ModularBuildOptions,
  type ModularEngineOutput,
  buildModularModule,
} from './compositionEngine';

export {
  type ModularPreset,
  ModularPresetRegistry,
  defaultModularPresetRegistry,
  MODULAR_PRESETS,
  getModularPresetById,
} from './presets';
