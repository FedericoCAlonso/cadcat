import { useState, useMemo, useCallback } from 'react';
import type { CustomPieceOperation, CustomDrillOperation } from '../model';
import {
  type ResolvedPieceWithCutSize,
  type SpatialPieceBox,
  type SnapResult,
  buildPieceMachiningSheet,
  calculatePieceContactProjections,
  generatePieceSnapGuides,
  resolveMagneticSnap,
  generateFastenerDrillOperations,
} from '../resolver';

export type MachiningOpType = 'drill' | 'groove' | 'rebate' | 'cutout' | 'fastener';

export interface UseMachiningEditorViewModelProps {
  piece: ResolvedPieceWithCutSize | null;
  customOperations: CustomPieceOperation[];
  spatialBoxes?: SpatialPieceBox[];
  onAddOperation: (pieceId: string, op: CustomPieceOperation) => void;
  onRemoveOperation: (pieceId: string, opId: string) => void;
  onClose: () => void;
}

export function useMachiningEditorViewModel(props: UseMachiningEditorViewModelProps) {
  const { piece, customOperations, spatialBoxes = [], onAddOperation, onRemoveOperation, onClose } = props;

  const [faceType, setFaceType] = useState<'face-A' | 'face-B'>('face-A');
  const [opType, setOpType] = useState<MachiningOpType>('groove');
  const [enableSnaps, setEnableSnaps] = useState<boolean>(true);

  // Drill inputs
  const [drillX, setDrillX] = useState<number>(50);
  const [drillY, setDrillY] = useState<number>(50);
  const [drillDia, setDrillDia] = useState<number>(8);
  const [drillDep, setDrillDep] = useState<number>(12);
  const [drillThrough, setDrillThrough] = useState<boolean>(false);

  // Groove inputs
  const [grooveAxis, setGrooveAxis] = useState<'x' | 'y'>('x');
  const [grooveOffset, setGrooveOffset] = useState<number>(20);
  const [grooveWidth, setGrooveWidth] = useState<number>(4);
  const [grooveDepth, setGrooveDepth] = useState<number>(8);

  // Rebate inputs
  const [rebateEdge, setRebateEdge] = useState<'top' | 'bottom' | 'left' | 'right'>('top');
  const [rebateWidth, setRebateWidth] = useState<number>(10);
  const [rebateDepth, setRebateDepth] = useState<number>(5);

  // Cutout inputs
  const [cutoutX, setCutoutX] = useState<number>(100);
  const [cutoutY, setCutoutY] = useState<number>(100);
  const [cutoutW, setCutoutW] = useState<number>(60);
  const [cutoutH, setCutoutH] = useState<number>(60);
  const [cutoutDep, setCutoutDep] = useState<number>(18);
  const [cutoutThrough, setCutoutThrough] = useState<boolean>(true);

  // Fastener wizard inputs
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

  // Piece dimensions
  const pieceWidth = piece?.dimensionsMm?.width ?? 500;
  const pieceHeight = piece?.dimensionsMm?.height ?? 700;
  const pieceThickness = piece?.thicknessMm ?? 18;

  // Custom operations on this piece
  const pieceCustomOps = useMemo(() => {
    if (!piece) return [];
    return customOperations.filter((op) => op.pieceId === piece.id);
  }, [piece, customOperations]);

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
      } else if (opType === 'cutout') {
        setCutoutX(targetX);
        setCutoutY(targetY);
      } else if (opType === 'groove') {
        setGrooveOffset(grooveAxis === 'x' ? targetY : targetX);
      }
    },
    [cursorPosMm, opType, grooveAxis],
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
    pieceThickness,
    grooveAxis,
    grooveOffset,
    grooveWidth,
    grooveDepth,
    rebateEdge,
    rebateWidth,
    rebateDepth,
    cutoutX,
    cutoutY,
    cutoutW,
    cutoutH,
    cutoutDep,
    cutoutThrough,
    onAddOperation,
  ]);

  // Apply fastener distribution along projection centerline
  const handleApplyFasteners = useCallback(
    (projectionIdOverride?: string) => {
      if (!piece) return;
      const projId = projectionIdOverride || selectedProjectionId;
      const proj = currentFaceProjections.find((p) => p.id === projId) ?? currentFaceProjections[0];
      if (!proj) return;

      const ops: CustomDrillOperation[] = generateFastenerDrillOperations(
        piece.id,
        pieceThickness,
        proj,
        {
          count: fastenerCount,
          setbackStartMm,
          setbackEndMm,
          diameterMm: fastenerDiameterMm,
          depthMm: pieceThickness,
          kind: fastenerKind,
        },
        faceType,
        fastenerIsThrough,
      );

      for (const op of ops) {
        onAddOperation(piece.id, op);
      }
    },
    [
      piece,
      selectedProjectionId,
      currentFaceProjections,
      pieceThickness,
      fastenerCount,
      setbackStartMm,
      setbackEndMm,
      fastenerDiameterMm,
      fastenerKind,
      faceType,
      fastenerIsThrough,
      onAddOperation,
    ],
  );

  return {
    piece,
    pieceWidth,
    pieceHeight,
    pieceThickness,
    faceType,
    setFaceType,
    opType,
    setOpType,
    enableSnaps,
    setEnableSnaps,
    // Drill state
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
    // Groove state
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
    // Calculated data
    projections,
    currentFaceProjections,
    snapGuides,
    pieceCustomOps,
    previewSheet,
    // Action handlers
    handleAddOperation,
    handleRemoveOperation: (opId: string) => piece && onRemoveOperation(piece.id, opId),
    onClose,
  };
}
