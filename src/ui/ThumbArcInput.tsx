import {
  type ReactElement,
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
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
}

/**
 * Mobile-first gesture-controlled radial input (Modo Obra).
 * Enables ergonomic thumb-sweep adjustment for one-handed operation in workshop and site environments.
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
}: ThumbArcInputProps): ReactElement {
  // Hand mode state (controlled or local fallback)
  const [internalHandMode, setInternalHandMode] = useState<HandMode>('right');
  const activeHandMode = controlledHandMode ?? internalHandMode;

  const handleHandModeToggle = useCallback(() => {
    const nextMode: HandMode = activeHandMode === 'right' ? 'left' : 'right';
    if (onHandModeChange) {
      onHandModeChange(nextMode);
    } else {
      setInternalHandMode(nextMode);
    }
    triggerHaptic('tick');
  }, [activeHandMode, onHandModeChange]);

  // Direct editing modal/input state
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

  // Touch / Pointer tracking state for radial arc
  const arcContainerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const prevAngleRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const accumulatedValueRef = useRef<number>(value);

  // Keep accumulated value in sync when value changes from outside
  useEffect(() => {
    if (!isDraggingRef.current) {
      accumulatedValueRef.current = value;
    }
  }, [value]);

  const arcConfig: ThumbArcConfig = {
    ...DEFAULT_THUMB_ARC_CONFIG,
    min,
    max,
    step,
    coarseStep,
    handMode: activeHandMode,
  };

  const baseWidth = compact ? 340 : 360;
  const baseHeight = compact ? 185 : 260;
  const baseSvgHeight = compact ? 185 : 270;
  const baseRadius = compact ? 210 : 275;

  // SVG Geometry for visual arc (calibrated for regular or compact viewport)
  const svgTrack = computeThumbArcSvgPath(baseWidth, baseSvgHeight, activeHandMode, baseRadius);

  // Knob position along visual arc based on value percentage
  // Sweeping up (elevating thumb) increases value (+); sweeping down decreases (-).
  const valueRatio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const knobAngleDeg = activeHandMode === 'right'
    ? -165 + valueRatio * 60
    : -15 - valueRatio * 60;
  const knobAngleRad = (knobAngleDeg * Math.PI) / 180;
  const knobX = svgTrack.center.x + svgTrack.radius * Math.cos(knobAngleRad);
  const knobY = svgTrack.center.y + svgTrack.radius * Math.sin(knobAngleRad);

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

      // 1. Direct hit on the visual knob (< 35px) captures immediately regardless of angular tolerance
      const isOverKnob = isPointOnKnob(normalizedPoint, { x: knobX, y: knobY }, 35);

      // 2. Proportional hit on the radial arc corridor with expanded tolerance (55px)
      const isOnArc = isPointOnThumbArc(normalizedPoint, baseWidth, baseSvgHeight, activeHandMode, {
        radius: baseRadius,
        radialTolerance: 55,
      });

      if (!isOverKnob && !isOnArc) {
        return;
      }

      arcContainerRef.current.setPointerCapture(e.pointerId);
      isDraggingRef.current = true;

      const pivot = getThumbPivotPoint(rect.width, rect.height, activeHandMode);
      const point = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      const angle = calculatePointAngle(point, pivot);
      prevAngleRef.current = angle;
      lastTimeRef.current = performance.now();
      accumulatedValueRef.current = value;
      triggerHaptic('tick');
    },
    [activeHandMode, value, baseWidth, baseSvgHeight, baseRadius, knobX, knobY],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current || !arcContainerRef.current) return;

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
      const nextAccumulated = accumulatedValueRef.current + valueDelta;
      accumulatedValueRef.current = nextAccumulated;

      const clamped = clampAndStepValue(nextAccumulated, min, max, step);
      if (clamped !== value) {
        const haptic = evaluateHapticFeedback(value, clamped, arcConfig);
        triggerHaptic(haptic);
        onChange(clamped);
      }
    },
    [activeHandMode, arcConfig, min, max, step, value, onChange],
  );

  const handlePointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current && arcContainerRef.current) {
      try {
        arcContainerRef.current.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture release safety
      }
    }
    isDraggingRef.current = false;
  }, []);

  // Quick stepper adjustments
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
        padding: compact ? '0.45rem 0.6rem' : '0.85rem 0.75rem',
        borderRadius: compact ? '18px' : '24px',
        backgroundColor: 'var(--md-sys-color-surface-container)',
        border: '1px solid var(--md-sys-color-outline-variant)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
        position: 'relative',
        userSelect: 'none',
        width: '100%',
        maxWidth: '460px',
        margin: '0 auto',
        boxSizing: 'border-box',
      }}
    >
      {/* Top Header: Label & Hand Mode Switch (Hidden when compact) */}
      {!compact && (
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

          {/* Hand Mode Toggle Button */}
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

      {/* Numerical Readout & Direct Tapping */}
      <div style={{ width: '100%', margin: compact ? '0.2rem 0 0.35rem' : '0.75rem 0', textAlign: 'center' }}>
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

      {/* Thumb Radial Sweep Arc Area */}
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
          borderRadius: compact ? '16px' : '24px',
          backgroundColor: 'var(--md-sys-color-surface)',
          border: '1px solid var(--md-sys-color-outline-variant)',
          cursor: 'default',
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
            strokeWidth={compact ? '30' : '36'}
            strokeLinecap="round"
          />

          {/* Active Highlight Arc */}
          <path
            d={svgTrack.pathD}
            fill="none"
            stroke="var(--md-sys-color-primary-container)"
            strokeWidth={compact ? '18' : '22'}
            strokeLinecap="round"
          />

          {/* Knob handle along the natural thumb zone */}
          <circle
            cx={knobX.toFixed(1)}
            cy={knobY.toFixed(1)}
            r={compact ? '18' : '22'}
            fill="var(--md-sys-color-primary)"
            stroke="var(--md-sys-color-surface)"
            strokeWidth="3.5"
            filter="drop-shadow(0px 3px 6px rgba(0,0,0,0.28))"
          />
          <circle
            cx={knobX.toFixed(1)}
            cy={knobY.toFixed(1)}
            r={compact ? '7' : '8'}
            fill="var(--md-sys-color-on-primary)"
          />
        </svg>

        {/* Floating guidance overlay */}
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
      </div>

      {/* Stepper Buttons (Touch Targets) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: compact ? '0.35rem' : '0.5rem',
          width: '100%',
          marginTop: compact ? '0.45rem' : '0.85rem',
        }}
      >
        <button
          type="button"
          onClick={() => applyDelta(-coarseStep)}
          className="m3-button m3-button--tonal"
          aria-label={`Restar ${coarseStep} ${unit}`}
          style={{
            minHeight: compact ? '42px' : '48px',
            fontSize: compact ? '0.88rem' : '0.95rem',
            fontWeight: 700,
            borderRadius: '12px',
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
            minHeight: compact ? '42px' : '48px',
            fontSize: compact ? '0.88rem' : '0.95rem',
            fontWeight: 700,
            borderRadius: '12px',
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
            minHeight: compact ? '42px' : '48px',
            fontSize: compact ? '0.88rem' : '0.95rem',
            fontWeight: 700,
            borderRadius: '12px',
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
            minHeight: compact ? '42px' : '48px',
            fontSize: compact ? '0.88rem' : '0.95rem',
            fontWeight: 700,
            borderRadius: '12px',
          }}
        >
          {`+${coarseStep}`}
        </button>
      </div>

      {/* Quick Presets Pills (if provided) */}
      {quickPresets && quickPresets.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: compact ? '0.3rem' : '0.4rem',
            width: '100%',
            marginTop: compact ? '0.4rem' : '0.75rem',
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
                  minHeight: compact ? '36px' : '44px',
                  padding: compact ? '0 0.65rem' : '0 0.85rem',
                  fontSize: compact ? '0.8rem' : '0.85rem',
                  fontWeight: isSelected ? 700 : 500,
                  borderRadius: '16px',
                }}
              >
                {`${preset} ${unit}`}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
