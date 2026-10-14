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
} from './componentSolver';

export {
  type ModularBuildOptions,
  type ModularEngineOutput,
  buildModularModule,
} from './compositionEngine';

export {
  type ModularPreset,
  MODULAR_PRESETS,
  getModularPresetById,
} from './presets';
