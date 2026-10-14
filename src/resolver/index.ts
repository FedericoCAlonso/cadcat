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
  type BOMMaterialGroup,
  type BillOfMaterials,
  getHardwareCountForJoint,
  generateBOMPieces,
  generateBOMEdgeBands,
  generateBOMHardware,
  groupBOMPiecesByMaterial,
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
  translatePieceLabel,
  triggerBrowserDownload,
} from './export';

export {
  type TemplateDefinition,
  type TemplateBuildResult,
  TEMPLATES,
  MODULAR_TEMPLATES,
  ALL_TEMPLATES,
  getTemplateById,
  buildBaseCabinet,
  buildDrawerUnit,
  DEFAULT_BASE_CABINET_PARAMS,
  DEFAULT_DRAWER_UNIT_PARAMS,
  DEFAULT_DRAWER_SLIDE_CLEARANCE_MM,
  DEFAULT_DRAWER_GAP_MM,
  buildDoorCabinet,
  type DoorCabinetParams,
  DEFAULT_DOOR_CABINET_PARAMS,
  buildPartitionCabinet,
  type PartitionCabinetParams,
  DEFAULT_PARTITION_CABINET_PARAMS,
  buildDoorSubAssembly,
  calculateHingeCount,
  calculateHingePositions,
  type DoorConfig,
  type DoorMountType,
  type DoorSubAssemblyResult,
  buildDrawerSubAssembly,
  DRAWER_SLIDE_CLEARANCES_MM,
  type DrawerSlideType,
  type DrawerConfig,
  type DrawerSubAssemblyResult,
  buildShelf,
  type ShelfConfig,
  type ShelfMountType,
  type ShelfResult,
  buildPartition,
  type PartitionConfig,
  type PartitionResult,
} from './templates';

export {
  type SpatialPieceBox,
  type ModuleSpatialBounds,
  type ExplodedPieceBox,
  determinePieceSpatialSize,
  resolveModuleSpatialBoxes,
  calculateExplodedBoxes,
} from './spatial3d';

export {
  type MachiningShopDefaults,
  DEFAULT_MACHINING_SHOP_VALUES,
  calculateJointDrillSpacings,
  deriveContactGeometry,
  deriveFaceType,
  deriveModuleDrillOperations,
  groupOperationsByPiece,
} from './machining';

export {
  type SheetOperationItem,
  type PieceBandedEdges,
  type PieceMachiningSheet,
  buildPieceMachiningSheet,
  buildModuleMachiningSheets,
  renderPieceMachiningSvg,
  exportMachiningSheetPdf,
} from './machiningSheet';

export {
  GRAVITY_ACCELERATION_M_S2,
  DEFAULT_ELASTIC_MODULUS_MPA,
  DEFAULT_DEFLECTION_CONFIG,
  type ShelfDeflectionInput,
  type ShelfDeflectionResult,
  calculateShelfDeflection,
  checkPieceDeflection,
  checkModuleShelvesDeflection,
} from './deflection';

export {
  type SpanOccurrence,
  type AssemblyGauge,
  type DeriveGaugesInput,
  deriveAssemblyGauges,
  deriveAuxiliaryGaugePieces,
} from './gauges';

export {
  type AssemblyStep,
  type AssemblySheet,
  type GenerateAssemblySheetInput,
  generateAssemblySheet,
  exportAssemblyGuidePdf,
} from './assemblySheet';

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
  type DrawerFrontMount,
  type BayContent,
  type ModuleMaterialRoles,
  type ModularModuleDefinition,
  type AnchorSolverInput,
  type AnchorSolverResult,
  resolveCarcass,
  type ResolveTracksResult,
  type SubdivideBayResult,
  resolveTracks,
  subdivideBay,
  formatTracksToGridString,
  parseGridStringToTracks,
  type ComponentSolverOptions,
  type ComponentSolverResult,
  resolveBayContent,
  type ModularBuildOptions,
  type ModularEngineOutput,
  buildModularModule,
  type ModularPreset,
  MODULAR_PRESETS,
  getModularPresetById,
} from './composition';

