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

export {
  type BandedEdgeInfo,
  type PieceCutSize,
  type ResolvedPieceWithCutSize,
  createEdgeBandMap,
  getEdgeBandThickness,
  calculatePieceCutSize,
  applyEdgeBandRule,
  calculateEdgeBandLengths,
} from './edgeBand';

export {
  type BOMPieceItem,
  type BOMEdgeBandItem,
  type BOMHardwareItem,
  type BillOfMaterials,
  getHardwareCountForJoint,
  generateBOMPieces,
  generateBOMEdgeBands,
  generateBOMHardware,
  generateBillOfMaterials,
} from './bom';

export {
  type CostItem,
  type ModuleCostSummary,
  type CostCalculationInput,
  calculateModuleCost,
} from './cost';

export {
  type BaseCabinetInput,
  buildBaseCabinetModule,
} from './moduleBuilder';

export {
  exportCutListCsv,
  exportCutPlanPdf,
  triggerBrowserDownload,
} from './export';

export {
  type TemplateDefinition,
  type TemplateBuildResult,
  TEMPLATES,
  getTemplateById,
  buildBaseCabinet,
  buildDrawerUnit,
  DEFAULT_BASE_CABINET_PARAMS,
  DEFAULT_DRAWER_UNIT_PARAMS,
  DEFAULT_DRAWER_SLIDE_CLEARANCE_MM,
  DEFAULT_DRAWER_GAP_MM,
} from './templates';

export {
  type SpatialPieceBox,
  type ModuleSpatialBounds,
  type ExplodedPieceBox,
  determinePieceSpatialSize,
  resolveModuleSpatialBoxes,
  calculateExplodedBoxes,
} from './spatial3d';
