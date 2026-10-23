export {
  TO_CONFIRM,
  shopValueSchema,
  type ShopValue,
  capabilitySchema,
  type Capability,
  point2DSchema,
  type Point2D,
  contourSchema,
  type Contour,
  intervalSchema,
  type Interval,
  faceRefSchema,
  type FaceRef,
} from './common';

export {
  millingToleranceSchema,
  type MillingTolerance,
  sheetDimensionSchema,
  type SheetDimension,
  sheetSizeSchema,
  type SheetSize,
  materialSchema,
  type Material,
  materialCatalogSchema,
  type MaterialCatalog,
  validateMaterial,
  validateMaterialCatalog,
} from './material';

export {
  edgeBandKindSchema,
  type EdgeBandKind,
  edgeBandSchema,
  type EdgeBand,
  edgeBandCatalogSchema,
  type EdgeBandCatalog,
  validateEdgeBand,
  validateEdgeBandCatalog,
} from './edgeBand';

export {
  hardwareSchema,
  type Hardware,
  hardwareCatalogSchema,
  type HardwareCatalog,
  validateHardware,
  validateHardwareCatalog,
} from './hardware';

export {
  faceSchema,
  type Face,
  secondaryCutSchema,
  type SecondaryCut,
  pieceSchema,
  type Piece,
  validateFace,
  validatePiece,
} from './piece';

export {
  jointKindSchema,
  type JointKind,
  jointSchema,
  type Joint,
  validateJoint,
} from './joint';

export {
  subAssemblySchema,
  type SubAssembly,
  overrideSchema,
  type Override,
  moduleSchema,
  type Module,
  validateModule,
} from './module';

export {
  operationKindSchema,
  type OperationKind,
  faceTypeSchema,
  type FaceType,
  drillOperationSchema,
  type DrillOperation,
  customDrillOperationSchema,
  type CustomDrillOperation,
  customHoleSeriesOperationSchema,
  type CustomHoleSeriesOperation,
  customGrooveOperationSchema,
  type CustomGrooveOperation,
  customRebateOperationSchema,
  type CustomRebateOperation,
  cornerTreatmentSchema,
  type CornerTreatment,
  customPocketOperationSchema,
  type CustomPocketOperation,
  edgeProfileKindSchema,
  type EdgeProfileKind,
  customEdgeProfileOperationSchema,
  type CustomEdgeProfileOperation,
  customPieceOperationSchema,
  type CustomPieceOperation,
  customDrillToDrillOperation,
  customHoleSeriesToDrillOperations,
  pieceMachiningSchema,
  type PieceMachining,
} from './operation';

export {
  toolKindSchema,
  type ToolKind,
  drillBitKindSchema,
  type DrillBitKind,
  routerProfileKindSchema,
  type RouterProfileKind,
  toolItemSchema,
  type ToolItem,
  toolCatalogSchema,
  type ToolCatalog,
  validateToolItem,
  validateToolCatalog,
  DEFAULT_TOOLS,
} from './tool';

export {
  unitsConfigSchema,
  type UnitsConfig,
  jointStrategySchema,
  type JointStrategy,
  machiningConfigSchema,
  type MachiningConfig,
  nestingConfigSchema,
  type NestingConfig,
  costConfigSchema,
  type CostConfig,
  deflectionConfigSchema,
  type DeflectionConfig,
  hardwareConfigSchema,
  type HardwareConfig,
  projectConfigSchema,
  type ProjectConfig,
  validateProjectConfig,
} from './projectConfig';

export {
  userTemplateSchema,
  type UserTemplate,
  validateUserTemplate,
} from './userTemplate';

export {
  equipmentKindSchema,
  type EquipmentKind,
  cutoutSpecificationSchema,
  type CutoutSpecification,
  faucetHoleSpecificationSchema,
  type FaucetHoleSpecification,
  drainSiphonVolumeSchema,
  type DrainSiphonVolume,
  ventilationRequirementsSchema,
  type VentilationRequirements,
  equipmentItemSchema,
  type EquipmentItem,
  equipmentCatalogSchema,
  type EquipmentCatalog,
  countertopEquipmentPlacementSchema,
  type CountertopEquipmentPlacement,
  validateEquipmentItem,
  validateEquipmentCatalog,
  DEFAULT_EQUIPMENT_ITEMS,
} from './equipment';

export {
  countertopMaterialKindSchema,
  type CountertopMaterialKind,
  countertopMaterialSchema,
  type CountertopMaterial,
  countertopMaterialCatalogSchema,
  type CountertopMaterialCatalog,
  countertopBacksplashSchema,
  type CountertopBacksplash,
  countertopEdgeFinishSchema,
  type CountertopEdgeFinish,
  countertopCornerRadiiSchema,
  type CountertopCornerRadii,
  countertopDefinitionSchema,
  type CountertopDefinition,
  validateCountertopMaterial,
  validateCountertopDefinition,
  DEFAULT_COUNTERTOP_MATERIALS,
  DEFAULT_COUNTERTOP_CONFIG,
} from './countertop';

export {
  projectModuleItemSchema,
  type ProjectModuleItem,
  projectSchema,
  type Project,
  validateProject,
  createDefaultProject,
} from './project';

export {
  labelLayoutFormatSchema,
  type LabelLayoutFormat,
  labelLayoutConfigSchema,
  type LabelLayoutConfig,
  LABEL_LAYOUT_PRESETS,
  pieceLabelEdgeBandSchema,
  type PieceLabelEdgeBand,
  pieceLabelDataSchema,
  type PieceLabelData,
} from './labels';

export {
  columnObstacleSchema,
  type ColumnObstacle,
  type ParametricObstacle,
  type ObstacleType,
  type ObstacleReferenceEdge,
  falseSquareSchema,
  type FalseSquare,
  interferenceConfigSchema,
  type InterferenceConfig,
  DEFAULT_COLUMN_OBSTACLE,
  DEFAULT_FALSE_SQUARE,
  DEFAULT_INTERFERENCE_CONFIG,
} from './interferences';




export * from './standardThickness';
