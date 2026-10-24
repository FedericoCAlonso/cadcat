import {
  type ReactElement,
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
  useMemo,
  useCallback,
  useEffect,
} from 'react';
import {
  type HandMode,
  type ThumbArcConfig,
  type Point2D,
  DEFAULT_THUMB_ARC_CONFIG,
  calculatePointAngle,
  normalizeAngularDelta,
  getThumbPivotPoint,
  calculateArcDeltaValue,
  clampAndStepValue,
  evaluateHapticFeedback,
  triggerHaptic,
  computeThumbArcSvgPath,
  isPointOnThumbArc,
  isPointOnKnob,
} from '../resolver/thumbArc';

export interface ThumbArcOption {
  id: string;
  label: string;
  sublabel?: string;
  badge?: string;
  disabled?: boolean;
}

export interface ThumbArcInputProps {
  id?: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  coarseStep?: number;
  unit?: string;
  helpText?: string;
  handMode?: HandMode;
  onHandModeChange?: (mode: HandMode) => void;
  quickPresets?: number[];
  ariaLabel?: string;
  compact?: boolean;
  extraCoarseStep?: number;
  showArc?: boolean;
  /**
   * When true, renders ONLY the radial thumb arc with the readout embedded in its concave pocket,
   * omitting external stepper/preset button rows. Tapping the upper half of the arc increments (+1 / next),
   * and tapping the lower half decrements (-1 / prev).
   */
  arcOnly?: boolean;
  /**
   * Optional discrete options mode: the radial arc acts as a jog dial / selector wheel across options.
   */
  options?: ThumbArcOption[];
  selectedOptionId?: string;
  onSelectOption?: (id: string) => void;
  onIncrement?: () => void;
  onDecrement?: () => void;
}

/**
 * Mobile-first gesture-controlled radial input (Modo Taller / Obra).
 * Supports both continuous numeric values (mm / counts) and discrete option lists.
 * Tapping the upper half of the arc increments (+1 or next option);
 * tapping the lower half decrements (-1 or previous option).
 */
export function ThumbArcInput({
  id,
  label,
  value,
  onChange,
  min = 50,
  max = 3000,
  step = 1,
  coarseStep = 10,
  unit = 'mm',
  helpText,
  handMode: controlledHandMode,
  onHandModeChange,
  quickPresets,
  ariaLabel,
  compact = false,
  extraCoarseStep,
  showArc = true,
  arcOnly = false,
  options,
  selectedOptionId,
  onSelectOption,
  onIncrement,
  onDecrement,
}: ThumbArcInputProps): ReactElement {
  // Hand mode state (controlled or local fallback)
  const [internalHandMode, setInternalHandMode] = useState<HandMode>('right');
  const activeHandMode = controlledHandMode ?? internalHandMode;

  const isOptionsMode = Boolean(options && options.length > 0 && onSelectOption);
  const enabledOptions = useMemo(
    () => options?.filter((o) => !o.disabled) ?? [],
    [options],
  );
  const activeOptionIndex = isOptionsMode
    ? Math.max(
        0,
        enabledOptions.findIndex((o) => o.id === selectedOptionId),
      )
    : 0;
  const activeOption = isOptionsMode ? (enabledOptions[activeOptionIndex] ?? enabledOptions[0]) : undefined;

  const effectiveMin = isOptionsMode ? 0 : min;
  const effectiveMax = isOptionsMode ? Math.max(0, enabledOptions.length - 1) : max;
  const effectiveStep = isOptionsMode ? 1 : step;
  const effectiveCoarseStep = isOptionsMode ? 1 : coarseStep;
  const effectiveValue = isOptionsMode ? activeOptionIndex : value;

  const handleHandModeToggle = useCallback(() => {
    const nextMode: HandMode = activeHandMode === 'right' ? 'left' : 'right';
    if (onHandModeChange) {
      onHandModeChange(nextMode);
    } else {
      setInternalHandMode(nextMode);
    }
    triggerHaptic('tick');
  }, [activeHandMode, onHandModeChange]);

  // Direct editing modal/input state (for numeric mode)
  const [isDirectEditing, setIsDirectEditing] = useState<boolean>(false);
  const [directText, setDirectText] = useState<string>(String(value));

  useEffect(() => {
    if (!isDirectEditing) {
      setDirectText(String(value));
    }
  }, [value, isDirectEditing]);

  const handleDirectSubmit = useCallback(() => {
    const parsed = parseFloat(directText);
    if (!Number.isNaN(parsed)) {
      const clamped = clampAndStepValue(parsed, min, max, step);
      onChange(clamped);
      triggerHaptic('major');
    }
    setIsDirectEditing(false);
  }, [directText, min, max, step, onChange]);

  // Step / Option advance helper (used by arc upper/lower tap and steppers)
  const stepByDirection = useCallback(
    (direction: 1 | -1) => {
      if (direction === 1 && onIncrement) {
        triggerHaptic('tick');
        onIncrement();
        return;
      }
      if (direction === -1 && onDecrement) {
        triggerHaptic('tick');
        onDecrement();
        return;
      }

      if (isOptionsMode && onSelectOption && enabledOptions.length > 0) {
        const nextIdx = (activeOptionIndex + direction + enabledOptions.length) % enabledOptions.length;
        const target = enabledOptions[nextIdx];
        if (target) {
          triggerHaptic('major');
          onSelectOption(target.id);
        }
        return;
      }

      const next = clampAndStepValue(value + direction * step, min, max, step);
      if (next !== value) {
        triggerHaptic('tick');
        onChange(next);
      }
    },
    [
      onIncrement,
      onDecrement,
      isOptionsMode,
      onSelectOption,
      enabledOptions,
      activeOptionIndex,
      value,
      step,
      min,
      max,
      onChange,
    ],
  );

  // Touch / Pointer tracking state for radial arc
  const arcContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const didMoveRef = useRef<boolean>(false);
  const didEmitStepDuringDragRef = useRef<boolean>(false);
  const downClientPointRef = useRef<Point2D>({ x: 0, y: 0 });
  const prevClientPointRef = useRef<Point2D>({ x: 0, y: 0 });
  const downNormalizedPointRef = useRef<Point2D>({ x: 0, y: 0 });
  const prevAngleRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const accumulatedValueRef = useRef<number>(effectiveValue);
  const lastEmittedOptionIndexRef = useRef<number>(activeOptionIndex);
  const optionDragProgressRef = useRef<number>(0);

  useEffect(() => {
    if (!isDraggingRef.current) {
      accumulatedValueRef.current = effectiveValue;
      lastEmittedOptionIndexRef.current = activeOptionIndex;
      optionDragProgressRef.current = 0;
    }
  }, [effectiveValue, activeOptionIndex]);

  const numericSpan = Math.max(1, effectiveMax - effectiveMin);
  const adaptiveNumericMmPerRadian =
    numericSpan <= 20
      ? Math.max(6, numericSpan * 2.0)
      : numericSpan <= 60
        ? Math.max(30, numericSpan * 1.8)
        : DEFAULT_THUMB_ARC_CONFIG.mmPerRadian;

  const arcConfig: ThumbArcConfig = {
    ...DEFAULT_THUMB_ARC_CONFIG,
    min: effectiveMin,
    max: Math.max(effectiveMin, effectiveMax),
    step: effectiveStep,
    coarseStep: effectiveCoarseStep,
    mmPerRadian: isOptionsMode
      ? Math.max(6, enabledOptions.length * 2.4)
      : adaptiveNumericMmPerRadian,
    fastAngularVelocityThreshold:
      isOptionsMode || numericSpan <= 60
        ? 99
        : DEFAULT_THUMB_ARC_CONFIG.fastAngularVelocityThreshold,
    handMode: activeHandMode,
  };

  const baseWidth = 360;
  // +20% height increase for Modo Taller slider container (165 -> 198px) and SVG viewport (175 -> 210)
  const baseHeight = arcOnly ? 198 : compact ? 230 : 260;
  const baseSvgHeight = arcOnly ? 210 : compact ? 240 : 270;
  const baseRadius = arcOnly ? 260 : compact ? 245 : 275;

  // SVG Geometry for visual arc:
  // In arcOnly (Modo Taller), the arc is born at the 1/4 left mark (x = 90 of 360, y = 186) for right-hand mode
  // (or 3/4 mark x = 270 for left-hand mode), crossing past the horizontal midpoint (x = 180) up to (330, 26).
  const legacySvgTrack = computeThumbArcSvgPath(baseWidth, baseSvgHeight, activeHandMode, baseRadius);
  const arcCenter: Point2D = arcOnly
    ? { x: activeHandMode === 'right' ? 330 : 30, y: 286 }
    : legacySvgTrack.center;
  const arcRadius = arcOnly ? 260 : legacySvgTrack.radius;
  const minAngleDeg = arcOnly
    ? activeHandMode === 'right'
      ? -157.38
      : -22.62
    : activeHandMode === 'right'
      ? -165
      : -15;
  const maxAngleDeg = arcOnly
    ? -90
    : activeHandMode === 'right'
      ? -105
      : -75;
  const angleSpanDeg = maxAngleDeg - minAngleDeg;

  const svgTrack = useMemo(() => {
    if (!arcOnly) return legacySvgTrack;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    // Sweep clockwise from left-most angle to right-most angle so SVG arc flag is always 0 0 1
    const [cwStartDeg, cwEndDeg] =
      activeHandMode === 'right'
        ? [minAngleDeg, maxAngleDeg]
        : [maxAngleDeg, minAngleDeg];
    const startRad = toRad(cwStartDeg);
    const endRad = toRad(cwEndDeg);
    const startPoint: Point2D = {
      x: arcCenter.x + arcRadius * Math.cos(startRad),
      y: arcCenter.y + arcRadius * Math.sin(startRad),
    };
    const endPoint: Point2D = {
      x: arcCenter.x + arcRadius * Math.cos(endRad),
      y: arcCenter.y + arcRadius * Math.sin(endRad),
    };
    const pathD = `M ${startPoint.x.toFixed(1)} ${startPoint.y.toFixed(1)} A ${arcRadius} ${arcRadius} 0 0 1 ${endPoint.x.toFixed(1)} ${endPoint.y.toFixed(1)}`;
    return {
      pathD,
      startPoint,
      endPoint,
      center: arcCenter,
      radius: arcRadius,
    };
  }, [arcOnly, legacySvgTrack, activeHandMode, minAngleDeg, maxAngleDeg, arcCenter, arcRadius]);

  // Knob position along visual arc based on value percentage
  // Sweeping up (elevating thumb) increases value (+); sweeping down decreases (-).
  const valueRange = Math.max(1, effectiveMax - effectiveMin);
  const valueRatio =
    isOptionsMode && enabledOptions.length <= 1
      ? 0.5
      : Math.max(0, Math.min(1, (effectiveValue - effectiveMin) / valueRange));
  const knobAngleDeg = minAngleDeg + valueRatio * angleSpanDeg;
  const knobAngleRad = (knobAngleDeg * Math.PI) / 180;
  const knobX = svgTrack.center.x + svgTrack.radius * Math.cos(knobAngleRad);
  const knobY = svgTrack.center.y + svgTrack.radius * Math.sin(knobAngleRad);

  // Midpoint of the arc (50% ratio) to split upper half (+) vs lower half (-)
  const midAngleDeg = minAngleDeg + 0.5 * angleSpanDeg;
  const midAngleRad = (midAngleDeg * Math.PI) / 180;
  const midX = svgTrack.center.x + svgTrack.radius * Math.cos(midAngleRad);
  const midY = svgTrack.center.y + svgTrack.radius * Math.sin(midAngleRad);
  const midInnerX = svgTrack.center.x + (svgTrack.radius - 20) * Math.cos(midAngleRad);
  const midInnerY = svgTrack.center.y + (svgTrack.radius - 20) * Math.sin(midAngleRad);
  const midOuterX = svgTrack.center.x + (svgTrack.radius + 20) * Math.cos(midAngleRad);
  const midOuterY = svgTrack.center.y + (svgTrack.radius + 20) * Math.sin(midAngleRad);

  // Upper and lower label coordinates along the arc
  const upperBadgeDeg = minAngleDeg + 0.82 * angleSpanDeg;
  const upperBadgeRad = (upperBadgeDeg * Math.PI) / 180;
  const upperBadgeX = svgTrack.center.x + svgTrack.radius * Math.cos(upperBadgeRad);
  const upperBadgeY = svgTrack.center.y + svgTrack.radius * Math.sin(upperBadgeRad);

  const lowerBadgeDeg = minAngleDeg + 0.18 * angleSpanDeg;
  const lowerBadgeRad = (lowerBadgeDeg * Math.PI) / 180;
  const lowerBadgeX = svgTrack.center.x + svgTrack.radius * Math.cos(lowerBadgeRad);
  const lowerBadgeY = svgTrack.center.y + svgTrack.radius * Math.sin(lowerBadgeRad);

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!arcContainerRef.current) return;

      const rect = arcContainerRef.current.getBoundingClientRect();
      const scaleX = baseWidth / Math.max(1, rect.width);
      const scaleY = baseSvgHeight / Math.max(1, rect.height);
      const normalizedPoint: Point2D = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };

      if (!arcOnly) {
        const isOverKnob = isPointOnKnob(normalizedPoint, { x: knobX, y: knobY }, 35);
        const isOnArc = isPointOnThumbArc(normalizedPoint, baseWidth, baseSvgHeight, activeHandMode, {
          radius: baseRadius,
          radialTolerance: 55,
        });

        if (!isOverKnob && !isOnArc) {
          return;
        }
      }

      try {
        arcContainerRef.current.setPointerCapture(e.pointerId);
      } catch {
        // Safe fallback when synthetic events lack pointer capture
      }
      isDraggingRef.current = true;
      didMoveRef.current = false;
      didEmitStepDuringDragRef.current = false;
      downClientPointRef.current = { x: e.clientX, y: e.clientY };
      prevClientPointRef.current = { x: e.clientX, y: e.clientY };
      downNormalizedPointRef.current = normalizedPoint;

      const pivot = getThumbPivotPoint(rect.width, rect.height, activeHandMode);
      const point = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      const angle = calculatePointAngle(point, pivot);
      prevAngleRef.current = angle;
      lastTimeRef.current = performance.now();
      accumulatedValueRef.current = effectiveValue;
      lastEmittedOptionIndexRef.current = activeOptionIndex;
      optionDragProgressRef.current = 0;
      triggerHaptic('tick');
    },
    [
      arcOnly,
      activeHandMode,
      effectiveValue,
      activeOptionIndex,
      baseWidth,
      baseSvgHeight,
      baseRadius,
      knobX,
      knobY,
    ],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current || !arcContainerRef.current) return;

      const moveDist = Math.hypot(
        e.clientX - downClientPointRef.current.x,
        e.clientY - downClientPointRef.current.y,
      );
      if (moveDist > 10) {
        didMoveRef.current = true;
      }

      const dxClient = e.clientX - prevClientPointRef.current.x;
      const dyClient = e.clientY - prevClientPointRef.current.y;
      prevClientPointRef.current = { x: e.clientX, y: e.clientY };

      // Discrete Options Mode: smooth rotary/stepped dial without wind-up or endpoint lock
      if (isOptionsMode && onSelectOption && enabledOptions.length > 0) {
        const horizontalTangent = activeHandMode === 'right' ? dxClient : -dxClient;
        const verticalUpward = -dyClient;
        const projectedPixels = verticalUpward * 0.85 + horizontalTangent * 0.45;
        const pixelsPerOptionStep = 26;

        optionDragProgressRef.current += projectedPixels / pixelsPerOptionStep;

        while (Math.abs(optionDragProgressRef.current) >= 0.75) {
          const stepDir: 1 | -1 = optionDragProgressRef.current > 0 ? 1 : -1;
          optionDragProgressRef.current -= stepDir;
          const nextIdx =
            (lastEmittedOptionIndexRef.current + stepDir + enabledOptions.length) %
            enabledOptions.length;
          if (nextIdx !== lastEmittedOptionIndexRef.current) {
            lastEmittedOptionIndexRef.current = nextIdx;
            didEmitStepDuringDragRef.current = true;
            triggerHaptic('major');
            const targetOpt = enabledOptions[nextIdx];
            if (targetOpt) {
              onSelectOption(targetOpt.id);
            }
          }
        }
        return;
      }

      const rect = arcContainerRef.current.getBoundingClientRect();
      const pivot = getThumbPivotPoint(rect.width, rect.height, activeHandMode);
      const point = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      const currentAngle = calculatePointAngle(point, pivot);
      const now = performance.now();
      const dtSec = Math.max(0.001, (now - lastTimeRef.current) / 1000);

      const deltaRad = normalizeAngularDelta(prevAngleRef.current, currentAngle);
      const angularVelocity = deltaRad / dtSec;

      prevAngleRef.current = currentAngle;
      lastTimeRef.current = now;

      const valueDelta = calculateArcDeltaValue(deltaRad, arcConfig, angularVelocity);
      const safeMax = Math.max(effectiveMin, effectiveMax);
      const nextAccumulated = Math.max(
        effectiveMin,
        Math.min(safeMax, accumulatedValueRef.current + valueDelta),
      );
      accumulatedValueRef.current = nextAccumulated;

      const clamped = clampAndStepValue(nextAccumulated, effectiveMin, safeMax, effectiveStep);
      if (clamped !== effectiveValue) {
        didEmitStepDuringDragRef.current = true;
        const haptic = evaluateHapticFeedback(effectiveValue, clamped, arcConfig);
        triggerHaptic(haptic);
        onChange(clamped);
      }
    },
    [
      activeHandMode,
      arcConfig,
      effectiveMin,
      effectiveMax,
      effectiveStep,
      effectiveValue,
      isOptionsMode,
      onSelectOption,
      enabledOptions,
      onChange,
    ],
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) return;

      if (arcContainerRef.current) {
        try {
          arcContainerRef.current.releasePointerCapture(e.pointerId);
        } catch {
          // Pointer capture release safety
        }
      }
      isDraggingRef.current = false;

      // Tap gesture on the arc (without dragging):
      // Upper half of the arc -> +1 / next option; Lower half -> -1 / previous option
      if (!didMoveRef.current) {
        const normPt = downNormalizedPointRef.current;
        const isUpperHalf = normPt.y <= midY;
        stepByDirection(isUpperHalf ? 1 : -1);
      } else if (isOptionsMode && !didEmitStepDuringDragRef.current) {
        // Short flick/swipe gesture in options mode that didn't reach full drag step threshold:
        // guarantee 1 step in the swipe direction so short swipes never feel dead or stuck
        const totalDx = e.clientX - downClientPointRef.current.x;
        const totalDy = e.clientY - downClientPointRef.current.y;
        const horizontalTangent = activeHandMode === 'right' ? totalDx : -totalDx;
        const netProjected = -totalDy * 0.85 + horizontalTangent * 0.45;
        if (Math.abs(netProjected) >= 4) {
          stepByDirection(netProjected > 0 ? 1 : -1);
        }
      }
    },
    [midY, stepByDirection, isOptionsMode, activeHandMode],
  );

  // Quick stepper adjustments (for legacy / non-arcOnly mode)
  const applyDelta = useCallback(
    (delta: number) => {
      const next = clampAndStepValue(value + delta, min, max, step);
      if (next !== value) {
        triggerHaptic(Math.abs(delta) >= coarseStep ? 'major' : 'tick');
        onChange(next);
      }
    },
    [value, min, max, step, coarseStep, onChange],
  );

  return (
    <div
      id={id}
      className="thumb-arc-card"
      role="region"
      aria-label={ariaLabel || label}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: arcOnly ? '0.2rem' : undefined,
        padding: arcOnly
          ? '0'
          : compact
            ? '0.45rem 0.6rem max(0.45rem, env(safe-area-inset-bottom, 0.45rem))'
            : '0.85rem 0.75rem',
        borderRadius: arcOnly ? '0' : compact ? '18px' : '24px',
        backgroundColor: arcOnly ? 'transparent' : 'var(--md-sys-color-surface-container)',
        border: arcOnly ? 'none' : '1px solid var(--md-sys-color-outline-variant)',
        boxShadow: arcOnly ? 'none' : '0 4px 16px rgba(0, 0, 0, 0.06)',
        position: 'relative',
        userSelect: 'none',
        width: '100%',
        maxWidth: '460px',
        margin: compact || arcOnly ? 'auto auto 0' : '0 auto',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Header: Label & Hand Mode Switch (Hidden when compact or arcOnly) */}
      {!compact && !arcOnly && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            marginBottom: '0.5rem',
          }}
        >
          <div style={{ textAlign: 'left' }}>
            <span
              style={{
                fontSize: '0.82rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--md-sys-color-primary)',
              }}
            >
              🏗️ Modo Obra
            </span>
            <h3
              style={{
                margin: '0.15rem 0 0',
                fontSize: '1.18rem',
                fontWeight: 700,
                color: 'var(--md-sys-color-on-surface)',
              }}
            >
              {label}
            </h3>
          </div>

          <button
            type="button"
            onClick={handleHandModeToggle}
            className="m3-button m3-button--tonal"
            aria-label={`Cambiar a modo ${activeHandMode === 'right' ? 'zurdo' : 'diestro'}`}
            title={`Mano activa: ${activeHandMode === 'right' ? 'Diestro' : 'Zurdo'}`}
            style={{
              minHeight: '48px',
              minWidth: '48px',
              padding: '0 0.85rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              borderRadius: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              backgroundColor: 'var(--md-sys-color-surface-container-high)',
              color: 'var(--md-sys-color-on-surface)',
              border: '1px solid var(--md-sys-color-outline-variant)',
              cursor: 'pointer',
            }}
          >
            <span>{activeHandMode === 'right' ? '🖐️ Diestro' : '🖐️ Zurdo'}</span>
          </button>
        </div>
      )}

      {/* Numerical Readout & Direct Tapping (When not arcOnly) */}
      {!arcOnly && (
        <div style={{ width: '100%', margin: compact ? '0.15rem 0 0.25rem' : '0.75rem 0', textAlign: 'center' }}>
          {isDirectEditing ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}
            >
              <input
                type="number"
                value={directText}
                min={min}
                max={max}
                step={step}
                autoFocus
                onChange={(e) => setDirectText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleDirectSubmit();
                  if (e.key === 'Escape') setIsDirectEditing(false);
                }}
                style={{
                  fontSize: compact ? '1.6rem' : '2.2rem',
                  fontWeight: 800,
                  width: compact ? '140px' : '180px',
                  textAlign: 'center',
                  padding: '0.25rem 0.4rem',
                  borderRadius: '12px',
                  border: '2px solid var(--md-sys-color-primary)',
                  backgroundColor: 'var(--md-sys-color-surface)',
                  color: 'var(--md-sys-color-on-surface)',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={handleDirectSubmit}
                className="m3-button m3-button--filled"
                aria-label="Confirmar valor"
                style={{
                  minHeight: compact ? '40px' : '48px',
                  minWidth: compact ? '40px' : '48px',
                  borderRadius: '12px',
                  fontSize: '1rem',
                  fontWeight: 700,
                }}
              >
                ✓
              </button>
              <button
                type="button"
                onClick={() => setIsDirectEditing(false)}
                className="m3-button m3-button--outlined"
                aria-label="Cancelar edición"
                style={{
                  minHeight: compact ? '40px' : '48px',
                  minWidth: compact ? '40px' : '48px',
                  borderRadius: '12px',
                  fontSize: '1rem',
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <div
              onClick={() => setIsDirectEditing(true)}
              role="button"
              tabIndex={0}
              aria-label={`Valor actual: ${value} ${unit}. Tocar para editar con teclado.`}
              title="Tocar para editar con teclado"
              style={{
                display: 'inline-flex',
                alignItems: 'baseline',
                justifyContent: 'center',
                gap: '0.35rem',
                cursor: 'pointer',
                padding: compact ? '0.15rem 0.8rem' : '0.2rem 1rem',
                borderRadius: compact ? '14px' : '16px',
                backgroundColor: 'var(--md-sys-color-surface-container-high)',
                border: '1px dashed var(--md-sys-color-outline)',
              }}
            >
              <span
                style={{
                  fontSize: compact ? '2rem' : '2.75rem',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  color: 'var(--md-sys-color-primary)',
                  lineHeight: 1.1,
                }}
              >
                {value}
              </span>
              <span
                style={{
                  fontSize: compact ? '1rem' : '1.1rem',
                  fontWeight: 700,
                  color: 'var(--md-sys-color-on-surface-variant)',
                }}
              >
                {unit}
              </span>
              <span
                style={{
                  fontSize: '0.85rem',
                  marginLeft: '0.25rem',
                  opacity: 0.7,
                }}
              >
                ✏️
              </span>
            </div>
          )}

          {helpText && !compact && (
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--md-sys-color-outline)',
                marginTop: '0.35rem',
              }}
            >
              {helpText}
            </div>
          )}
        </div>
      )}

      {/* In compact mode (when not arcOnly): place Presets & Steppers ABOVE the thumb arc */}
      {compact && !arcOnly && (
        <>
          {quickPresets && quickPresets.length > 0 && (
            <div
              style={{
                display: 'flex',
                overflowX: 'auto',
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch',
                gap: '0.35rem',
                width: '100%',
                marginBottom: '0.35rem',
                padding: '0.1rem 0.2rem',
                justifyContent: quickPresets.length <= 4 ? 'center' : 'flex-start',
                boxSizing: 'border-box',
              }}
            >
              {quickPresets.map((preset) => {
                const isSelected = preset === value;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      onChange(preset);
                      triggerHaptic('major');
                    }}
                    className={`m3-button ${isSelected ? 'm3-button--filled' : 'm3-button--outlined'}`}
                    style={{
                      minHeight: '48px',
                      padding: '0 0.85rem',
                      fontSize: '0.86rem',
                      fontWeight: isSelected ? 700 : 600,
                      borderRadius: '24px',
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {`${preset} ${unit}`}
                  </button>
                );
              })}
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                extraCoarseStep && extraCoarseStep !== coarseStep && extraCoarseStep !== step
                  ? 'repeat(6, 1fr)'
                  : coarseStep === step
                    ? 'repeat(2, 1fr)'
                    : 'repeat(4, 1fr)',
              gap: '0.35rem',
              width: '100%',
              marginBottom: '0.45rem',
            }}
          >
            {extraCoarseStep && extraCoarseStep !== coarseStep && extraCoarseStep !== step && (
              <button
                type="button"
                onClick={() => applyDelta(-extraCoarseStep)}
                className="m3-button m3-button--tonal"
                aria-label={`Restar ${extraCoarseStep} ${unit}`}
                style={{
                  minHeight: '48px',
                  fontSize: '0.86rem',
                  fontWeight: 700,
                  borderRadius: '12px',
                  padding: 0,
                }}
              >
                {`-${extraCoarseStep}`}
              </button>
            )}
            {coarseStep !== step && (
              <button
                type="button"
                onClick={() => applyDelta(-coarseStep)}
                className="m3-button m3-button--tonal"
                aria-label={`Restar ${coarseStep} ${unit}`}
                style={{
                  minHeight: '48px',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  borderRadius: '14px',
                  padding: 0,
                }}
              >
                {`-${coarseStep}`}
              </button>
            )}
            <button
              type="button"
              onClick={() => applyDelta(-step)}
              className="m3-button m3-button--tonal"
              aria-label={`Restar ${step} ${unit}`}
              style={{
                minHeight: '48px',
                fontSize: '0.92rem',
                fontWeight: 700,
                borderRadius: '14px',
                padding: 0,
              }}
            >
              {`-${step}`}
            </button>
            <button
              type="button"
              onClick={() => applyDelta(step)}
              className="m3-button m3-button--tonal"
              aria-label={`Sumar ${step} ${unit}`}
              style={{
                minHeight: '48px',
                fontSize: '0.92rem',
                fontWeight: 700,
                borderRadius: '14px',
                padding: 0,
              }}
            >
              {`+${step}`}
            </button>
            {coarseStep !== step && (
              <button
                type="button"
                onClick={() => applyDelta(coarseStep)}
                className="m3-button m3-button--tonal"
                aria-label={`Sumar ${coarseStep} ${unit}`}
                style={{
                  minHeight: '48px',
                  fontSize: '0.92rem',
                  fontWeight: 700,
                  borderRadius: '14px',
                  padding: 0,
                }}
              >
                {`+${coarseStep}`}
              </button>
            )}
            {extraCoarseStep && extraCoarseStep !== coarseStep && extraCoarseStep !== step && (
              <button
                type="button"
                onClick={() => applyDelta(extraCoarseStep)}
                className="m3-button m3-button--tonal"
                aria-label={`Sumar ${extraCoarseStep} ${unit}`}
                style={{
                  minHeight: '48px',
                  fontSize: '0.86rem',
                  fontWeight: 700,
                  borderRadius: '12px',
                  padding: 0,
                }}
              >
                {`+${extraCoarseStep}`}
              </button>
            )}
          </div>
        </>
      )}

      {/* Full-Width Readout Banner OUTSIDE and ABOVE the Arc Slider Container when arcOnly={true} */}
      {arcOnly && (
        <div
          data-arc-readout="full-width-banner"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            backgroundColor: 'var(--md-sys-color-surface-container-high)',
            padding: '0.32rem 0.7rem',
            borderRadius: '12px',
            border: '1.5px solid var(--md-sys-color-outline-variant)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              textAlign: 'left',
              minWidth: 0,
              flex: 1,
            }}
          >
            <span
              style={{
                fontSize: '0.66rem',
                fontWeight: 800,
                color: 'var(--md-sys-color-outline)',
                textTransform: 'uppercase',
                letterSpacing: '0.03em',
                lineHeight: 1.15,
              }}
            >
              {label}
            </span>

            {isOptionsMode && activeOption ? (
              <>
                <span
                  style={{
                    fontSize: '0.98rem',
                    fontWeight: 900,
                    color: 'var(--md-sys-color-primary)',
                    lineHeight: 1.2,
                    marginTop: '2px',
                  }}
                >
                  {activeOption.label}
                </span>
                {activeOption.sublabel && (
                  <span
                    style={{
                      fontSize: '0.74rem',
                      color: 'var(--md-sys-color-on-surface-variant)',
                      marginTop: '1px',
                      lineHeight: 1.2,
                    }}
                  >
                    {activeOption.sublabel}
                  </span>
                )}
              </>
            ) : (
              !isOptionsMode &&
              helpText && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--md-sys-color-on-surface-variant)',
                    marginTop: '2px',
                    lineHeight: 1.15,
                  }}
                >
                  {helpText}
                </span>
              )
            )}
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {isOptionsMode && activeOption ? (
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  color: 'var(--md-sys-color-on-primary-container)',
                  backgroundColor: 'var(--md-sys-color-primary-container)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '8px',
                  whiteSpace: 'nowrap',
                }}
              >
                {`Opción ${activeOptionIndex + 1} de ${enabledOptions.length}`}
              </span>
            ) : isDirectEditing ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <input
                  type="number"
                  value={directText}
                  min={min}
                  max={max}
                  step={step}
                  autoFocus
                  onChange={(e) => setDirectText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleDirectSubmit();
                    if (e.key === 'Escape') setIsDirectEditing(false);
                  }}
                  style={{
                    fontSize: '1.3rem',
                    fontWeight: 800,
                    width: '92px',
                    textAlign: 'center',
                    padding: '0.15rem 0.3rem',
                    borderRadius: '8px',
                    border: '2px solid var(--md-sys-color-primary)',
                    backgroundColor: 'var(--md-sys-color-surface)',
                    color: 'var(--md-sys-color-on-surface)',
                  }}
                />
                <button
                  type="button"
                  onClick={handleDirectSubmit}
                  aria-label="Confirmar valor"
                  style={{
                    minHeight: '34px',
                    minWidth: '34px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--md-sys-color-primary)',
                    color: 'var(--md-sys-color-on-primary)',
                    border: 'none',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  ✓
                </button>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDirectEditing(true);
                }}
                aria-label={`Valor actual: ${value} ${unit}. Tocar para editar.`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'baseline',
                  gap: '0.25rem',
                  cursor: 'pointer',
                  backgroundColor: 'var(--md-sys-color-surface)',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '10px',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                }}
              >
                <span
                  style={{
                    fontSize: '1.65rem',
                    fontWeight: 900,
                    color: 'var(--md-sys-color-primary)',
                    lineHeight: 1.05,
                  }}
                >
                  {`${value} `}
                </span>
                <span
                  style={{
                    fontSize: '0.88rem',
                    fontWeight: 700,
                    color: 'var(--md-sys-color-on-surface-variant)',
                  }}
                >
                  {unit}
                </span>
                <span style={{ fontSize: '0.72rem', opacity: 0.75 }}>✏️</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Thumb Radial Sweep Arc Area (Anchored at the bottom for natural thumb sweep) */}
      {showArc && (
        <div
          ref={arcContainerRef}
          className="thumb-arc-track"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            height: `${baseHeight}px`,
            position: 'relative',
            overflow: 'hidden',
            borderRadius: arcOnly ? '14px' : compact ? '16px' : '24px',
            backgroundColor: 'var(--md-sys-color-surface)',
            border: '1px solid var(--md-sys-color-outline-variant)',
            cursor: 'pointer',
            touchAction: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.03)',
          }}
        >
          <svg
            viewBox={`0 0 ${baseWidth} ${baseSvgHeight}`}
            style={{
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          >
            {/* Base Arc Track */}
            <path
              d={svgTrack.pathD}
              fill="none"
              stroke="var(--md-sys-color-surface-container-highest)"
              strokeWidth={arcOnly ? '40' : compact ? '30' : '36'}
              strokeLinecap="round"
            />

            {/* Active Highlight Arc */}
            <path
              d={svgTrack.pathD}
              fill="none"
              stroke="var(--md-sys-color-primary-container)"
              strokeWidth={arcOnly ? '26' : compact ? '18' : '22'}
              strokeLinecap="round"
            />

            {/* Midpoint Divider Line separating Upper Half (+ / Next) and Lower Half (- / Prev) */}
            <line
              x1={midInnerX.toFixed(1)}
              y1={midInnerY.toFixed(1)}
              x2={midOuterX.toFixed(1)}
              y2={midOuterY.toFixed(1)}
              stroke="var(--md-sys-color-outline)"
              strokeWidth="2"
              strokeDasharray="3 2"
              opacity="0.65"
            />
            <circle
              cx={midX.toFixed(1)}
              cy={midY.toFixed(1)}
              r="3.5"
              fill="var(--md-sys-color-outline)"
              opacity="0.7"
            />

            {/* Upper Half Tap Indicator (+1 / Siguiente) */}
            <g transform={`translate(${upperBadgeX.toFixed(1)}, ${upperBadgeY.toFixed(1)})`}>
              <circle r="12" fill="var(--md-sys-color-primary)" opacity="0.18" />
              <text
                x="0"
                y="3.5"
                textAnchor="middle"
                fontSize="11"
                fontWeight="900"
                fill="var(--md-sys-color-primary)"
              >
                +
              </text>
            </g>

            {/* Lower Half Tap Indicator (-1 / Anterior) */}
            <g transform={`translate(${lowerBadgeX.toFixed(1)}, ${lowerBadgeY.toFixed(1)})`}>
              <circle r="12" fill="var(--md-sys-color-on-surface)" opacity="0.12" />
              <text
                x="0"
                y="3.5"
                textAnchor="middle"
                fontSize="12"
                fontWeight="900"
                fill="var(--md-sys-color-on-surface)"
              >
                −
              </text>
            </g>

            {/* Option Tick Marks along the arc when in discrete options mode */}
            {isOptionsMode &&
              enabledOptions.map((opt, idx) => {
                const ratio =
                  enabledOptions.length <= 1 ? 0.5 : idx / Math.max(1, enabledOptions.length - 1);
                const deg = minAngleDeg + ratio * angleSpanDeg;
                const rad = (deg * Math.PI) / 180;
                const tx = svgTrack.center.x + svgTrack.radius * Math.cos(rad);
                const ty = svgTrack.center.y + svgTrack.radius * Math.sin(rad);
                return (
                  <circle
                    key={opt.id}
                    cx={tx.toFixed(1)}
                    cy={ty.toFixed(1)}
                    r={idx === activeOptionIndex ? '5.5' : '3.5'}
                    fill={
                      idx === activeOptionIndex
                        ? 'var(--md-sys-color-on-primary)'
                        : 'var(--md-sys-color-primary)'
                    }
                    opacity={idx === activeOptionIndex ? 1 : 0.5}
                  />
                );
              })}

            {/* Knob handle along the natural thumb zone */}
            <circle
              cx={knobX.toFixed(1)}
              cy={knobY.toFixed(1)}
              r={arcOnly ? '22' : compact ? '18' : '22'}
              fill="var(--md-sys-color-primary)"
              stroke="var(--md-sys-color-surface)"
              strokeWidth="3.5"
              filter="drop-shadow(0px 3px 6px rgba(0,0,0,0.28))"
            />
            <circle
              cx={knobX.toFixed(1)}
              cy={knobY.toFixed(1)}
              r={arcOnly ? '8' : compact ? '7' : '8'}
              fill="var(--md-sys-color-on-primary)"
            />
          </svg>

          {/* Accessible Upper / Lower Arc Tap Buttons for fine adjustment (+1 / -1 or Next / Prev) */}
          {arcOnly && (
            <>
              <button
                type="button"
                data-arc-tap="upper"
                aria-label={isOptionsMode ? 'Opción siguiente (mitad superior del arco)' : `Sumar ${step} ${unit} (mitad superior del arco)`}
                title={isOptionsMode ? 'Tap mitad superior: Opción siguiente' : `Tap mitad superior: +${step} ${unit}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  stepByDirection(1);
                }}
                style={{
                  position: 'absolute',
                  top: '10px',
                  [activeHandMode === 'right' ? 'left' : 'right']: '10px',
                  minHeight: '36px',
                  padding: '0 0.6rem',
                  borderRadius: '18px',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  color: 'var(--md-sys-color-primary)',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  opacity: 0.92,
                }}
              >
                <span>▲</span>
                <span>{isOptionsMode ? 'Sig.' : `+${step}`}</span>
              </button>

              <button
                type="button"
                data-arc-tap="lower"
                aria-label={isOptionsMode ? 'Opción anterior (mitad inferior del arco)' : `Restar ${step} ${unit} (mitad inferior del arco)`}
                title={isOptionsMode ? 'Tap mitad inferior: Opción anterior' : `Tap mitad inferior: -${step} ${unit}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  stepByDirection(-1);
                }}
                style={{
                  position: 'absolute',
                  bottom: '8px',
                  [activeHandMode === 'right' ? 'left' : 'right']: '8px',
                  minHeight: '36px',
                  padding: '0 0.55rem',
                  borderRadius: '18px',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  color: 'var(--md-sys-color-on-surface)',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                  opacity: 0.92,
                }}
              >
                <span>▼</span>
                <span>{isOptionsMode ? 'Ant.' : `-${step}`}</span>
              </button>
            </>
          )}

          {/* Floating guidance overlay (when not arcOnly) */}
          {!arcOnly && (
            <div
              style={{
                position: 'absolute',
                bottom: compact ? '6px' : '10px',
                [activeHandMode === 'right' ? 'right' : 'left']: compact ? '10px' : '14px',
                fontSize: compact ? '0.72rem' : '0.78rem',
                fontWeight: 600,
                color: 'var(--md-sys-color-outline)',
                pointerEvents: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                backgroundColor: 'rgba(255,255,255,0.7)',
                padding: '0.15rem 0.45rem',
                borderRadius: '10px',
              }}
            >
              <span>⤴️ Deslizar pulgar (+)</span>
            </div>
          )}
        </div>
      )}

      {/* Stepper Buttons & Presets for non-compact mode (when not arcOnly) */}
      {!compact && !arcOnly && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '0.5rem',
              width: '100%',
              marginTop: '0.85rem',
            }}
          >
            <button
              type="button"
              onClick={() => applyDelta(-coarseStep)}
              className="m3-button m3-button--tonal"
              aria-label={`Restar ${coarseStep} ${unit}`}
              style={{
                minHeight: '48px',
                fontSize: '0.95rem',
                fontWeight: 700,
                borderRadius: '14px',
              }}
            >
              {`-${coarseStep}`}
            </button>
            <button
              type="button"
              onClick={() => applyDelta(-step)}
              className="m3-button m3-button--tonal"
              aria-label={`Restar ${step} ${unit}`}
              style={{
                minHeight: '48px',
                fontSize: '0.95rem',
                fontWeight: 700,
                borderRadius: '14px',
              }}
            >
              {`-${step}`}
            </button>
            <button
              type="button"
              onClick={() => applyDelta(step)}
              className="m3-button m3-button--tonal"
              aria-label={`Sumar ${step} ${unit}`}
              style={{
                minHeight: '48px',
                fontSize: '0.95rem',
                fontWeight: 700,
                borderRadius: '14px',
              }}
            >
              {`+${step}`}
            </button>
            <button
              type="button"
              onClick={() => applyDelta(coarseStep)}
              className="m3-button m3-button--tonal"
              aria-label={`Sumar ${coarseStep} ${unit}`}
              style={{
                minHeight: '48px',
                fontSize: '0.95rem',
                fontWeight: 700,
                borderRadius: '14px',
              }}
            >
              {`+${coarseStep}`}
            </button>
          </div>

          {quickPresets && quickPresets.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '0.4rem',
                width: '100%',
                marginTop: '0.75rem',
              }}
            >
              {quickPresets.map((preset) => {
                const isSelected = preset === value;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      onChange(preset);
                      triggerHaptic('major');
                    }}
                    className={`m3-button ${isSelected ? 'm3-button--filled' : 'm3-button--outlined'}`}
                    style={{
                      minHeight: '44px',
                      padding: '0 0.85rem',
                      fontSize: '0.85rem',
                      fontWeight: isSelected ? 700 : 500,
                      borderRadius: '18px',
                    }}
                  >
                    {`${preset} ${unit}`}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
