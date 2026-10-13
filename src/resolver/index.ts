export {
  type ContourSegment,
  type CreatePieceInput,
  RECTANGULAR_EDGE_NAMES,
  isDefaultStructuralRole,
  createRectangularContour,
  calculateSegmentLength,
  getContourSegments,
  createPieceFaces,
  createPiece,
} from './piece';

export {
  type CreateJointInput,
  createJoint,
  JointGraph,
} from './joint';

export {
  type Position3D,
  type PlacementNode,
  PlacementTree,
} from './tree';

export {
  type ResolvedPiece,
  type ResolvedModule,
  type SizeCalculationRule,
  type ModuleResolverDefinition,
  sortDependencies,
  resolveModule,
} from './resolver';
