import { useState, useMemo, useCallback } from 'react';
import {
  type CustomPieceOperation,
  type ToolItem,
  type Material,
  type MachiningConfig,
  type DrillOperation,
  type CornerTreatment,
  type EdgeProfileKind,
  DEFAULT_TOOLS,
} from '../model';
import {
  type ResolvedPieceWithCutSize,
  type SpatialPieceBox,
  type SnapResult,
  buildPieceMachiningSheet,
  calculatePieceContactProjections,
  generatePieceSnapGuides,
  resolveMagneticSnap,
  generateFastenerDrillOperations,
  validatePieceMachiningRules,
  type MachiningValidationIssue,
  calculatePocketCornerRelief,
  exportPieceToDxf,
  triggerBrowserDownload,
} from '../resolver';

export type MachiningOpType =
  | 'drill'
  | 'hole-series'
  | 'groove'
  | 'rebate'
  | 'cutout'
  | 'edge-profile'
  | 'fastener';

export type DatumCorner = 'bottom-left' | 'top-left' | 'bottom-right' | 'top-right';
export type RotationDeg = 0 | 90 | 180 | 270;
export type DimensionMode = 'datum' | 'pitch';

export interface BenchOperationRow {
  id: string;
  opNumber: number;
  kind: string;
  label: string;
  faceType: 'face-A' | 'face-B';
  xMm: number;
  yMm: number;
  datumX: number;
  datumY: number;
  sizeDescription: string;
  depthMm: number;
  toolDescription: string;
  isCustom: boolean;
}

export interface UseMachiningEditorViewModelProps {
  piece: ResolvedPieceWithCutSize | null;
  customOperations: CustomPieceOperation[];
  spatialBoxes?: SpatialPieceBox[];
  tools?: ToolItem[];
  material?: Material | null;
  materials?: Material[];
  derivedOperations?: DrillOperation[];
  config?: Partial<MachiningConfig>;
  onAddOperation: (pieceId: string, op: CustomPieceOperation) => void;
  onRemoveOperation: (pieceId: string, opId: string) => void;
  onClose: () => void;
}

export function useMachiningEditorViewModel(props: UseMachiningEditorViewModelProps) {
  const {
    piece,
    customOperations,
    spatialBoxes = [],
    tools = DEFAULT_TOOLS,
    material = null,
    materials = [],
    derivedOperations = [],
    config,
    onAddOperation,
    onRemoveOperation,
    onClose,
  } = props;

  const [faceType, setFaceType] = useState<'face-A' | 'face-B'>('face-A');
  const [opType, setOpType] = useState<MachiningOpType>('groove');
  const [enableSnaps, setEnableSnaps] = useState<boolean>(true);

  // Advanced Shop View Configurations
  const [datumCorner, setDatumCorner] = useState<DatumCorner>('bottom-left');
  const [rotationDeg, setRotationDeg] = useState<RotationDeg>(0);
  const [showDimensions, setShowDimensions] = useState<boolean>(true);
  const [dimensionMode, setDimensionMode] = useState<DimensionMode>('datum');
  const [showGrid, setShowGrid] = useState<boolean>(false);
  const [gridPitch, setGridPitch] = useState<32 | 50>(32);
  const [showProjections, setShowProjections] = useState<boolean>(true);
  const [showEdgeBanding, setShowEdgeBanding] = useState<boolean>(true);
  const [showCoordsTable, setShowCoordsTable] = useState<boolean>(false);
  const [completedOps, setCompletedOps] = useState<Record<string, boolean>>({});

  // Filtered tools by kind
  const drillTools = useMemo(() => tools.filter((t) => t.kind === 'drill-bit'), [tools]);
  const routerStraightTools = useMemo(
    () => tools.filter((t) => t.kind === 'straight-router-bit'),
    [tools],
  );
  const routerProfileTools = useMemo(
    () => tools.filter((t) => t.kind === 'profile-router-bit'),
    [tools],
  );

  // 1. Drill inputs
  const [drillToolId, setDrillToolId] = useState<string>('tool-drill-8');
  const [drillX, setDrillX] = useState<number>(50);
  const [drillY, setDrillY] = useState<number>(50);
  const [drillDia, setDrillDia] = useState<number>(8);
  const [drillDep, setDrillDep] = useState<number>(12);
  const [drillThrough, setDrillThrough] = useState<boolean>(false);

  // 2. System 32 Hole Series inputs
  const [seriesToolId, setSeriesToolId] = useState<string>('tool-drill-5');
  const [seriesStartX, setSeriesStartX] = useState<number>(37);
  const [seriesStartY, setSeriesStartY] = useState<number>(100);
  const [seriesAxis, setSeriesAxis] = useState<'x' | 'y'>('y');
  const [seriesPitch, setSeriesPitch] = useState<number>(32);
  const [seriesCount, setSeriesCount] = useState<number>(5);
  const [seriesDiameter, setSeriesDiameter] = useState<number>(5);
  const [seriesDepth, setSeriesDepth] = useState<number>(12);
  const [seriesThrough, setSeriesThrough] = useState<boolean>(false);

  // 3. Groove inputs
  const [grooveToolId, setGrooveToolId] = useState<string>('tool-router-straight-3');
  const [grooveAxis, setGrooveAxis] = useState<'x' | 'y'>('x');
  const [grooveOffset, setGrooveOffset] = useState<number>(20);
  const [grooveWidth, setGrooveWidth] = useState<number>(4);
  const [grooveDepth, setGrooveDepth] = useState<number>(8);

  // 4. Rebate inputs
  const [rebateEdge, setRebateEdge] = useState<'top' | 'bottom' | 'left' | 'right'>('top');
  const [rebateWidth, setRebateWidth] = useState<number>(10);
  const [rebateDepth, setRebateDepth] = useState<number>(5);

  // 5. Cutout inputs
  const [cutoutToolId, setCutoutToolId] = useState<string>('tool-router-straight-10');
  const [cutoutX, setCutoutX] = useState<number>(100);
  const [cutoutY, setCutoutY] = useState<number>(100);
  const [cutoutW, setCutoutW] = useState<number>(150);
  const [cutoutH, setCutoutH] = useState<number>(100);
  const [cutoutDep, setCutoutDep] = useState<number>(18);
  const [cutoutThrough, setCutoutThrough] = useState<boolean>(true);
  const [cutoutCornerRadius, setCutoutCornerRadius] = useState<number>(5);
  const [cutoutCornerTreatment, setCutoutCornerTreatment] = useState<CornerTreatment>('dog-bone');
  const [cutoutTBoneAxis, setCutoutTBoneAxis] = useState<'x' | 'y'>('x');

  // 6. Edge Profile inputs
  const [profileToolId, setProfileToolId] = useState<string>('tool-router-chamfer-45');
  const [profileEdge, setProfileEdge] = useState<'top' | 'bottom' | 'left' | 'right' | 'all-edges'>('top');
  const [profileKind, setProfileKind] = useState<EdgeProfileKind>('chamfer-45');
  const [profileWidth, setProfileWidth] = useState<number>(3);
  const [profileDepth, setProfileDepth] = useState<number>(3);

  // 7. Fastener wizard inputs
  const [selectedProjectionId, setSelectedProjectionId] = useState<string>('');
  const [fastenerCount, setFastenerCount] = useState<2 | 3 | 4 | 5>(2);
  const [fastenerKind, setFastenerKind] = useState<'confirmat' | 'dowel' | 'minifix'>('confirmat');
  const [fastenerDiameterMm, setFastenerDiameterMm] = useState<number>(5);
  const [fastenerIsThrough, setFastenerIsThrough] = useState<boolean>(true);
  const [setbackStartMm, setSetbackStartMm] = useState<number>(50);
  const [setbackEndMm, setSetbackEndMm] = useState<number>(50);

  // Interactive canvas cursor & snap feedback
  const [cursorPosMm, setCursorPosMm] = useState<{ x: number; y: number } | null>(null);
  const [snapResult, setSnapResult] = useState<SnapResult | null>(null);

  // Tool change callbacks
  const handleSelectDrillTool = useCallback(
    (toolId: string) => {
      setDrillToolId(toolId);
      const tool = tools.find((t) => t.id === toolId);
      if (tool) {
        setDrillDia(tool.diameterMm);
        if (tool.drillType === 'through') {
          setDrillThrough(true);
        }
      }
    },
    [tools],
  );

  const handleSelectSeriesTool = useCallback(
    (toolId: string) => {
      setSeriesToolId(toolId);
      const tool = tools.find((t) => t.id === toolId);
      if (tool) {
        setSeriesDiameter(tool.diameterMm);
      }
    },
    [tools],
  );

  const handleSelectGrooveTool = useCallback(
    (toolId: string) => {
      setGrooveToolId(toolId);
      const tool = tools.find((t) => t.id === toolId);
      if (tool) {
        setGrooveWidth(tool.diameterMm);
      }
    },
    [tools],
  );

  const handleSelectCutoutTool = useCallback(
    (toolId: string) => {
      setCutoutToolId(toolId);
      const tool = tools.find((t) => t.id === toolId);
      if (tool) {
        setCutoutCornerRadius(tool.diameterMm / 2);
      }
    },
    [tools],
  );

  const handleSelectProfileTool = useCallback(
    (toolId: string) => {
      setProfileToolId(toolId);
      const tool = tools.find((t) => t.id === toolId);
      if (tool && tool.profileKind && tool.profileKind !== 'straight') {
        setProfileKind(tool.profileKind);
        if (tool.profileRadiusMm) {
          setProfileWidth(tool.profileRadiusMm);
          setProfileDepth(tool.profileRadiusMm);
        }
      }
    },
    [tools],
  );

  // Piece dimensions
  const pieceWidth = piece?.dimensionsMm?.width ?? 500;
  const pieceHeight = piece?.dimensionsMm?.height ?? 700;
  const pieceThickness = piece?.thicknessMm ?? 18;

  // Find effective material for piece
  const effectiveMaterial = useMemo(() => {
    if (material) return material;
    if (piece?.materialId && materials.length > 0) {
      return materials.find((m) => m.id === piece.materialId) ?? null;
    }
    return null;
  }, [material, piece?.materialId, materials]);

  // Custom operations on this piece
  const pieceCustomOps = useMemo(() => {
    if (!piece) return [];
    return customOperations.filter((op) => op.pieceId === piece.id);
  }, [piece, customOperations]);

  // Real-time Workshop Validation Issues (Rule 8.1, boundary, collisions)
  const validationIssues: MachiningValidationIssue[] = useMemo(() => {
    if (!piece) return [];
    return validatePieceMachiningRules({
      piece,
      material: effectiveMaterial,
      customOperations: pieceCustomOps,
      derivedOperations,
      config,
    });
  }, [piece, effectiveMaterial, pieceCustomOps, derivedOperations, config]);

  // Contact Projections of other pieces touching this piece
  const projections = useMemo(() => {
    if (!piece || spatialBoxes.length === 0) return [];
    return calculatePieceContactProjections(piece.id, piece, spatialBoxes);
  }, [piece, spatialBoxes]);

  // Projections on currently selected face
  const currentFaceProjections = useMemo(() => {
    return projections.filter((p) => p.face === faceType);
  }, [projections, faceType]);

  // Snap Guides for current piece face
  const snapGuides = useMemo(() => {
    return generatePieceSnapGuides(pieceWidth, pieceHeight, currentFaceProjections);
  }, [pieceWidth, pieceHeight, currentFaceProjections]);

  // Machining sheet for technical drawing rendering
  const previewSheet = useMemo(() => {
    if (!piece) return null;
    return buildPieceMachiningSheet(piece, [], pieceCustomOps);
  }, [piece, pieceCustomOps]);

  // Interactive pointer move over SVG canvas
  const handlePointerMove = useCallback(
    (rawX: number, rawY: number) => {
      const clampedX = Math.max(0, Math.min(pieceWidth, Math.round(rawX)));
      const clampedY = Math.max(0, Math.min(pieceHeight, Math.round(rawY)));

      if (!enableSnaps) {
        setCursorPosMm({ x: clampedX, y: clampedY });
        setSnapResult(null);
        return;
      }

      const snap = resolveMagneticSnap(clampedX, clampedY, snapGuides, 14);
      setCursorPosMm({ x: snap.xMm, y: snap.yMm });
      setSnapResult(snap);
    },
    [enableSnaps, pieceWidth, pieceHeight, snapGuides],
  );

  const handlePointerLeave = useCallback(() => {
    setCursorPosMm(null);
    setSnapResult(null);
  }, []);

  // Click on canvas sets coordinates for current tool
  const handleCanvasClick = useCallback(
    (rawX: number, rawY: number) => {
      const targetX = cursorPosMm ? cursorPosMm.x : Math.round(rawX);
      const targetY = cursorPosMm ? cursorPosMm.y : Math.round(rawY);

      if (opType === 'drill') {
        setDrillX(targetX);
        setDrillY(targetY);
      } else if (opType === 'hole-series') {
        if (seriesAxis === 'y') {
          setSeriesStartX(targetX);
          setSeriesStartY(targetY);
        } else {
          setSeriesStartX(targetX);
          setSeriesStartY(targetY);
        }
      } else if (opType === 'cutout') {
        setCutoutX(targetX);
        setCutoutY(targetY);
      } else if (opType === 'groove') {
        setGrooveOffset(grooveAxis === 'x' ? targetY : targetX);
      }
    },
    [cursorPosMm, opType, grooveAxis, seriesAxis],
  );

  // Add individual operation
  const handleAddOperation = useCallback(() => {
    if (!piece) return;
    const id = `cust-${opType}-${Date.now()}`;
    let op: CustomPieceOperation;

    if (opType === 'drill') {
      op = {
        kind: 'drill',
        id,
        pieceId: piece.id,
        faceType,
        xMm: drillX,
        yMm: drillY,
        diameterMm: drillDia,
        depthMm: drillThrough ? pieceThickness : drillDep,
        isThrough: drillThrough,
        toolId: drillToolId,
        description: `Perforación Ø${drillDia}mm`,
      };
    } else if (opType === 'hole-series') {
      op = {
        kind: 'hole-series',
        id,
        pieceId: piece.id,
        faceType,
        startXMm: seriesStartX,
        startYMm: seriesStartY,
        axis: seriesAxis,
        pitchMm: seriesPitch,
        count: seriesCount,
        diameterMm: seriesDiameter,
        depthMm: seriesThrough ? pieceThickness : seriesDepth,
        isThrough: seriesThrough,
        toolId: seriesToolId,
        description: `Serie Sistema 32 (${seriesCount}x Ø${seriesDiameter}mm)`,
      };
    } else if (opType === 'groove') {
      op = {
        kind: 'groove',
        id,
        pieceId: piece.id,
        faceType,
        axis: grooveAxis,
        offsetMm: grooveOffset,
        widthMm: grooveWidth,
        depthMm: grooveDepth,
        toolId: grooveToolId,
        description: `Ranura eje ${grooveAxis.toUpperCase()}`,
      };
    } else if (opType === 'rebate') {
      op = {
        kind: 'rebate',
        id,
        pieceId: piece.id,
        faceType,
        edge: rebateEdge,
        widthMm: rebateWidth,
        depthMm: rebateDepth,
        description: `Rebaje en canto ${rebateEdge}`,
      };
    } else if (opType === 'cutout') {
      op = {
        kind: 'cutout',
        id,
        pieceId: piece.id,
        faceType,
        xMm: cutoutX,
        yMm: cutoutY,
        widthMm: cutoutW,
        heightMm: cutoutH,
        depthMm: cutoutThrough ? pieceThickness : cutoutDep,
        isThrough: cutoutThrough,
        cornerRadiusMm: cutoutCornerRadius,
        cornerTreatment: cutoutCornerTreatment,
        toolId: cutoutToolId,
        description: `Cajeado ${cutoutW}x${cutoutH}mm (${cutoutCornerTreatment})`,
      };
    } else if (opType === 'edge-profile') {
      op = {
        kind: 'edge-profile',
        id,
        pieceId: piece.id,
        faceType,
        edge: profileEdge,
        profileKind,
        widthMm: profileWidth,
        depthMm: profileDepth,
        toolId: profileToolId,
        description: `Perfil ${profileKind} en ${profileEdge}`,
      };
    } else {
      return;
    }

    onAddOperation(piece.id, op);
  }, [
    piece,
    opType,
    faceType,
    drillX,
    drillY,
    drillDia,
    drillDep,
    drillThrough,
    drillToolId,
    seriesStartX,
    seriesStartY,
    seriesAxis,
    seriesPitch,
    seriesCount,
    seriesDiameter,
    seriesDepth,
    seriesThrough,
    seriesToolId,
    pieceThickness,
    grooveAxis,
    grooveOffset,
    grooveWidth,
    grooveDepth,
    grooveToolId,
    rebateEdge,
    rebateWidth,
    rebateDepth,
    cutoutX,
    cutoutY,
    cutoutW,
    cutoutH,
    cutoutDep,
    cutoutThrough,
    cutoutCornerRadius,
    cutoutCornerTreatment,
    cutoutToolId,
    profileEdge,
    profileKind,
    profileWidth,
    profileDepth,
    profileToolId,
    onAddOperation,
  ]);

  // Apply Fastener wizard operations
  const handleApplyFasteners = useCallback(() => {
    if (!piece) return;
    const projection = projections.find((p) => p.id === selectedProjectionId);
    if (!projection) return;

    const derivedFasteners = generateFastenerDrillOperations(
      piece.id,
      pieceThickness,
      projection,
      {
        count: fastenerCount,
        kind: fastenerKind,
        diameterMm: fastenerDiameterMm,
        depthMm: fastenerIsThrough ? pieceThickness : 12,
        setbackStartMm,
        setbackEndMm,
      },
      faceType,
      fastenerIsThrough,
    );

    for (const fOp of derivedFasteners) {
      onAddOperation(piece.id, fOp);
    }
  }, [
    piece,
    projections,
    selectedProjectionId,
    fastenerCount,
    fastenerKind,
    fastenerDiameterMm,
    fastenerIsThrough,
    pieceThickness,
    faceType,
    setbackStartMm,
    setbackEndMm,
    onAddOperation,
  ]);

  // Helper for generating corner relief SVG path in canvas coordinates
  const getPocketCornerReliefPath = useCallback(
    (pocket: {
      xMm: number;
      yMm: number;
      widthMm: number;
      heightMm: number;
      cornerRadiusMm?: number;
      cornerTreatment?: CornerTreatment;
    }) => {
      const res = calculatePocketCornerRelief({
        xMm: pocket.xMm,
        yMm: pocket.yMm,
        widthMm: pocket.widthMm,
        heightMm: pocket.heightMm,
        cornerRadiusMm: pocket.cornerRadiusMm ?? 0,
        cornerTreatment: pocket.cornerTreatment ?? 'natural-radius',
      });
      return res.svgPath;
    },
    [],
  );

  const handleExportDxf = useCallback(() => {
    if (!piece) return;
    const dxfContent = exportPieceToDxf(piece, {
      face: faceType,
      customOperations: pieceCustomOps,
      derivedOperations,
      includeGrooveCenterline: true,
    });
    const fileName = `${piece.id}-${faceType}.dxf`;
    triggerBrowserDownload(fileName, dxfContent, 'application/dxf');
  }, [piece, faceType, pieceCustomOps, derivedOperations]);

  const toDatumCoords = useCallback(
    (xMm: number, yMm: number) => {
      let datumX = xMm;
      let datumY = yMm;
      if (datumCorner === 'top-left') {
        datumX = xMm;
        datumY = pieceHeight - yMm;
      } else if (datumCorner === 'bottom-right') {
        datumX = pieceWidth - xMm;
        datumY = yMm;
      } else if (datumCorner === 'top-right') {
        datumX = pieceWidth - xMm;
        datumY = pieceHeight - yMm;
      }
      return {
        x: Math.round(datumX * 10) / 10,
        y: Math.round(datumY * 10) / 10,
      };
    },
    [datumCorner, pieceWidth, pieceHeight],
  );

  const handleRotateClockwise = useCallback(() => {
    setRotationDeg((prev) => ((prev + 90) % 360) as RotationDeg);
  }, []);

  const handleRotateReset = useCallback(() => {
    setRotationDeg(0);
  }, []);

  const toggleOpCompleted = useCallback((opId: string) => {
    setCompletedOps((prev) => ({ ...prev, [opId]: !prev[opId] }));
  }, []);

  // One-click Cup Hinges preset (Ø35mm at 21.5mm from front/left edge, 100mm from ends)
  const applyCupHingesPreset = useCallback(
    (options?: { setbackMm?: number; topDistMm?: number; bottomDistMm?: number; edge?: 'left' | 'right' }) => {
      if (!piece) return;
      const setback = options?.setbackMm ?? 21.5;
      const topDist = options?.topDistMm ?? 100;
      const bottomDist = options?.bottomDistMm ?? 100;
      const isRight = options?.edge === 'right';
      const xPos = isRight ? pieceWidth - setback : setback;
      const depth = 11.5;
      const dia = 35;

      const op1: CustomPieceOperation = {
        kind: 'drill',
        id: `hinge-bottom-${Date.now()}`,
        pieceId: piece.id,
        faceType,
        xMm: xPos,
        yMm: bottomDist,
        diameterMm: dia,
        depthMm: depth,
        isThrough: false,
        description: 'Cazoleta Bisagra Ø35mm (Inferior)',
      };
      const op2: CustomPieceOperation = {
        kind: 'drill',
        id: `hinge-top-${Date.now() + 1}`,
        pieceId: piece.id,
        faceType,
        xMm: xPos,
        yMm: pieceHeight - topDist,
        diameterMm: dia,
        depthMm: depth,
        isThrough: false,
        description: 'Cazoleta Bisagra Ø35mm (Superior)',
      };

      onAddOperation(piece.id, op1);
      onAddOperation(piece.id, op2);
    },
    [piece, pieceWidth, pieceHeight, faceType, onAddOperation],
  );

  // One-click System 32 Shelf Pins row preset (Front & Rear rows at 37mm setback, 32mm pitch)
  const applySystem32ShelfPinsPreset = useCallback(
    (options?: { frontSetbackMm?: number; rearSetbackMm?: number; pitchMm?: number }) => {
      if (!piece) return;
      const frontSetback = options?.frontSetbackMm ?? 37;
      const rearSetback = options?.rearSetbackMm ?? 37;
      const pitch = options?.pitchMm ?? 32;
      const dia = 5;
      const depth = 12;
      const marginY = 96;

      const availableY = pieceHeight - 2 * marginY;
      const count = Math.max(2, Math.floor(availableY / pitch) + 1);

      const opFront: CustomPieceOperation = {
        kind: 'hole-series',
        id: `sys32-front-${Date.now()}`,
        pieceId: piece.id,
        faceType,
        startXMm: frontSetback,
        startYMm: marginY,
        axis: 'y',
        pitchMm: pitch,
        count,
        diameterMm: dia,
        depthMm: depth,
        isThrough: false,
        description: `Cremallera Sist. 32 Frontal (${count}x Ø5)`,
      };

      const opRear: CustomPieceOperation = {
        kind: 'hole-series',
        id: `sys32-rear-${Date.now() + 1}`,
        pieceId: piece.id,
        faceType,
        startXMm: pieceWidth - rearSetback,
        startYMm: marginY,
        axis: 'y',
        pitchMm: pitch,
        count,
        diameterMm: dia,
        depthMm: depth,
        isThrough: false,
        description: `Cremallera Sist. 32 Trasera (${count}x Ø5)`,
      };

      onAddOperation(piece.id, opFront);
      onAddOperation(piece.id, opRear);
    },
    [piece, pieceWidth, pieceHeight, faceType, onAddOperation],
  );

  // One-click Backing Groove preset
  const applyBackingGroovePreset = useCallback(
    (options?: { offsetMm?: number; widthMm?: number; depthMm?: number; axis?: 'x' | 'y' }) => {
      if (!piece) return;
      const offset = options?.offsetMm ?? 15;
      const width = options?.widthMm ?? 4;
      const depth = options?.depthMm ?? 8;
      const axis = options?.axis ?? 'y';

      const op: CustomPieceOperation = {
        kind: 'groove',
        id: `groove-back-${Date.now()}`,
        pieceId: piece.id,
        faceType,
        axis,
        offsetMm: offset,
        widthMm: width,
        depthMm: depth,
        description: `Ranura para Fondo (${width}x${depth}mm a ${offset}mm)`,
      };

      onAddOperation(piece.id, op);
    },
    [piece, faceType, onAddOperation],
  );

  // Bench table listing all operations on active face with Datum-referenced coordinates
  const benchOperationsTable: BenchOperationRow[] = useMemo(() => {
    if (!piece) return [];
    const rows: BenchOperationRow[] = [];
    let num = 1;

    // Derived ops
    if (previewSheet) {
      const ops = faceType === 'face-A' ? previewSheet.faceAOperations : previewSheet.faceBOperations;
      for (const op of ops) {
        const { x: dX, y: dY } = toDatumCoords(op.xMm, op.yMm);
        rows.push({
          id: op.id,
          opNumber: num++,
          kind: 'drill',
          label: op.description || `Perforación Ø${op.diameterMm}mm`,
          faceType,
          xMm: op.xMm,
          yMm: op.yMm,
          datumX: dX,
          datumY: dY,
          sizeDescription: `Ø${op.diameterMm} mm`,
          depthMm: op.depthMm,
          toolDescription: op.isThrough ? 'Pasante' : `${op.depthMm} mm prof.`,
          isCustom: false,
        });
      }
    }

    // Custom ops
    for (const cop of pieceCustomOps.filter((c) => c.faceType === faceType)) {
      const x = (cop as any).xMm ?? (cop as any).startXMm ?? (cop as any).offsetMm ?? 0;
      const y = (cop as any).yMm ?? (cop as any).startYMm ?? (cop as any).offsetMm ?? 0;
      const { x: dX, y: dY } = toDatumCoords(x, y);

      let sizeDesc = '';
      let depth = 0;
      if (cop.kind === 'drill') {
        sizeDesc = `Ø${cop.diameterMm} mm`;
        depth = cop.depthMm;
      } else if (cop.kind === 'hole-series') {
        sizeDesc = `${cop.count}x Ø${cop.diameterMm} (Paso ${cop.pitchMm}mm)`;
        depth = cop.depthMm;
      } else if (cop.kind === 'groove') {
        sizeDesc = `Ranura Eje ${cop.axis.toUpperCase()} (${cop.widthMm}mm)`;
        depth = cop.depthMm;
      } else if (cop.kind === 'rebate') {
        sizeDesc = `Rebaje Canto ${cop.edge} (${cop.widthMm}mm)`;
        depth = cop.depthMm;
      } else if (cop.kind === 'cutout') {
        sizeDesc = `Cajeado ${cop.widthMm} × ${cop.heightMm} mm`;
        depth = cop.depthMm;
      } else if (cop.kind === 'edge-profile') {
        sizeDesc = `Perfil ${cop.profileKind} (${cop.edge})`;
        depth = cop.depthMm;
      }

      rows.push({
        id: cop.id,
        opNumber: num++,
        kind: cop.kind,
        label: cop.description || `${cop.kind.toUpperCase()} (Taller)`,
        faceType,
        xMm: x,
        yMm: y,
        datumX: dX,
        datumY: dY,
        sizeDescription: sizeDesc,
        depthMm: depth,
        toolDescription: (cop as any).isThrough ? 'Pasante' : `${depth} mm prof.`,
        isCustom: true,
      });
    }

    return rows;
  }, [piece, previewSheet, faceType, pieceCustomOps, toDatumCoords]);

  return {
    piece,
    handleExportDxf,
    pieceWidth,
    pieceHeight,
    pieceThickness,
    faceType,
    setFaceType,
    opType,
    setOpType,
    enableSnaps,
    setEnableSnaps,
    // Tool catalogs
    tools,
    drillTools,
    routerStraightTools,
    routerProfileTools,
    // Drill state
    drillToolId,
    handleSelectDrillTool,
    drillX,
    setDrillX,
    drillY,
    setDrillY,
    drillDia,
    setDrillDia,
    drillDep,
    setDrillDep,
    drillThrough,
    setDrillThrough,
    // Hole Series state
    seriesToolId,
    handleSelectSeriesTool,
    seriesStartX,
    setSeriesStartX,
    seriesStartY,
    setSeriesStartY,
    seriesAxis,
    setSeriesAxis,
    seriesPitch,
    setSeriesPitch,
    seriesCount,
    setSeriesCount,
    seriesDiameter,
    setSeriesDiameter,
    seriesDepth,
    setSeriesDepth,
    seriesThrough,
    setSeriesThrough,
    // Groove state
    grooveToolId,
    handleSelectGrooveTool,
    grooveAxis,
    setGrooveAxis,
    grooveOffset,
    setGrooveOffset,
    grooveWidth,
    setGrooveWidth,
    grooveDepth,
    setGrooveDepth,
    // Rebate state
    rebateEdge,
    setRebateEdge,
    rebateWidth,
    setRebateWidth,
    rebateDepth,
    setRebateDepth,
    // Cutout state
    cutoutToolId,
    handleSelectCutoutTool,
    cutoutX,
    setCutoutX,
    cutoutY,
    setCutoutY,
    cutoutW,
    setCutoutW,
    cutoutH,
    setCutoutH,
    cutoutDep,
    setCutoutDep,
    cutoutThrough,
    setCutoutThrough,
    cutoutCornerRadius,
    setCutoutCornerRadius,
    cutoutCornerTreatment,
    setCutoutCornerTreatment,
    cutoutTBoneAxis,
    setCutoutTBoneAxis,
    // Edge Profile state
    profileToolId,
    handleSelectProfileTool,
    profileEdge,
    setProfileEdge,
    profileKind,
    setProfileKind,
    profileWidth,
    setProfileWidth,
    profileDepth,
    setProfileDepth,
    // Fastener wizard state
    selectedProjectionId,
    setSelectedProjectionId,
    fastenerCount,
    setFastenerCount,
    fastenerKind,
    setFastenerKind,
    fastenerDiameterMm,
    setFastenerDiameterMm,
    fastenerIsThrough,
    setFastenerIsThrough,
    setbackStartMm,
    setSetbackStartMm,
    setbackEndMm,
    setSetbackEndMm,
    handleApplyFasteners,
    // Interactive snap state & handlers
    cursorPosMm,
    snapResult,
    handlePointerMove,
    handlePointerLeave,
    handleCanvasClick,
    // Calculated data & validation
    projections,
    currentFaceProjections,
    snapGuides,
    pieceCustomOps,
    previewSheet,
    validationIssues,
    getPocketCornerReliefPath,
    // Advanced Shop View Configuration State & Handlers
    datumCorner,
    setDatumCorner,
    toDatumCoords,
    rotationDeg,
    setRotationDeg,
    handleRotateClockwise,
    handleRotateReset,
    showDimensions,
    setShowDimensions,
    dimensionMode,
    setDimensionMode,
    showGrid,
    setShowGrid,
    gridPitch,
    setGridPitch,
    showProjections,
    setShowProjections,
    showEdgeBanding,
    setShowEdgeBanding,
    showCoordsTable,
    setShowCoordsTable,
    completedOps,
    toggleOpCompleted,
    // Shop one-click presets
    applyCupHingesPreset,
    applySystem32ShelfPinsPreset,
    applyBackingGroovePreset,
    benchOperationsTable,
    // Action handlers
    handleAddOperation,
    handleRemoveOperation: (opId: string) => piece && onRemoveOperation(piece.id, opId),
    onClose,
  };
}
