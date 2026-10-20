import {
  type ReactElement,
  type TouchEvent,
  useState,
  useRef,
  useCallback,
} from 'react';
import { type HandMode, triggerHaptic } from '../resolver/thumbArc';
import { ThumbArcInput } from './ThumbArcInput';
import { DEFAULT_UI_CONFIG } from '../config';

export interface ModoObraStep {
  id: string;
  title: string;
  field: 'width' | 'height' | 'depth' | 'thickness';
  unit: string;
  min: number;
  max: number;
  step: number;
  coarseStep: number;
  presets: number[];
  helpText: string;
}

export const MODO_OBRA_STEPS: ModoObraStep[] = [
  {
    id: 'step-width',
    title: 'Ancho Total del Mueble',
    field: 'width',
    unit: 'mm',
    min: DEFAULT_UI_CONFIG.dimensions.width.min,
    max: DEFAULT_UI_CONFIG.dimensions.width.max,
    step: 1,
    coarseStep: 10,
    presets: [400, 500, 600, 800, 900, 1000, 1200],
    helpText: 'Ancho exterior de costado a costado.',
  },
  {
    id: 'step-height',
    title: 'Alto Total del Mueble',
    field: 'height',
    unit: 'mm',
    min: DEFAULT_UI_CONFIG.dimensions.height.min,
    max: DEFAULT_UI_CONFIG.dimensions.height.max,
    step: 1,
    coarseStep: 10,
    presets: [700, 750, 800, 850, 900, 1800, 2100],
    helpText: 'Altura exterior desde el piso/zócalo hasta la tapa superior.',
  },
  {
    id: 'step-depth',
    title: 'Profundidad Total',
    field: 'depth',
    unit: 'mm',
    min: DEFAULT_UI_CONFIG.dimensions.depth.min,
    max: DEFAULT_UI_CONFIG.dimensions.depth.max,
    step: 1,
    coarseStep: 10,
    presets: [300, 350, 450, 500, 550, 580, 600],
    helpText: 'Profundidad exterior del mueble (mesada estándar: 580-600 mm).',
  },
  {
    id: 'step-thickness',
    title: 'Espesor de Placa',
    field: 'thickness',
    unit: 'mm',
    min: 12,
    max: 30,
    step: 1,
    coarseStep: 1,
    presets: [15, 18, 25],
    helpText: 'Espesor nominal del tablero melamínico (18 mm recomendado).',
  },
];

export interface ModoObraWizardProps {
  width: number;
  height: number;
  depth: number;
  thickness: number;
  onWidthChange: (val: number) => void;
  onHeightChange: (val: number) => void;
  onDepthChange: (val: number) => void;
  onThicknessChange?: (val: number) => void;
  handMode: HandMode;
  onHandModeChange: (mode: HandMode) => void;
  onSwitchToExpertMode: () => void;
  onView3dClick?: () => void;
  is3dViewActive?: boolean;
}

/**
 * Modo Obra: Gesture-controlled mobile-first interface.
 * Features vertical swipe navigation between steps, ergonomic radial thumb dial,
 * and a persistent 3D model inspection trigger at the bottom.
 */
export function ModoObraWizard({
  width,
  height,
  depth,
  thickness,
  onWidthChange,
  onHeightChange,
  onDepthChange,
  onThicknessChange,
  handMode,
  onHandModeChange,
  onSwitchToExpertMode,
  onView3dClick,
  is3dViewActive = false,
}: ModoObraWizardProps): ReactElement {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const touchStartYRef = useRef<number>(0);
  const touchStartXRef = useRef<number>(0);

  const activeStep = MODO_OBRA_STEPS[currentStepIndex] ?? MODO_OBRA_STEPS[0]!;

  const goToNextStep = useCallback(() => {
    if (currentStepIndex < MODO_OBRA_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
      triggerHaptic('major');
    }
  }, [currentStepIndex]);

  const goToPrevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
      triggerHaptic('major');
    }
  }, [currentStepIndex]);

  // Vertical swipe handling on the main card container (Swipe Up = Next, Swipe Down = Prev)
  const handleTouchStart = useCallback((e: TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartYRef.current = touch.clientY;
      touchStartXRef.current = touch.clientX;
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      const touch = e.changedTouches[0];
      if (!touch) return;

      const dy = touch.clientY - touchStartYRef.current;
      const dx = touch.clientX - touchStartXRef.current;

      // Only trigger if primarily vertical swipe and greater than threshold (50px)
      if (Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx) * 1.5) {
        if (dy < 0) {
          // Swiped UP -> Go to Next Step
          goToNextStep();
        } else {
          // Swiped DOWN -> Go to Previous Step
          goToPrevStep();
        }
      }
    },
    [goToNextStep, goToPrevStep],
  );

  const getCurrentValue = (): number => {
    switch (activeStep.field) {
      case 'width':
        return width;
      case 'height':
        return height;
      case 'depth':
        return depth;
      case 'thickness':
        return thickness;
      default:
        return 0;
    }
  };

  const handleStepValueChange = (newVal: number) => {
    switch (activeStep.field) {
      case 'width':
        onWidthChange(newVal);
        break;
      case 'height':
        onHeightChange(newVal);
        break;
      case 'depth':
        onDepthChange(newVal);
        break;
      case 'thickness':
        onThicknessChange?.(newVal);
        break;
    }
  };

  return (
    <div
      className="modo-obra-container"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100%',
        width: '100%',
        maxWidth: '480px',
        margin: '0 auto',
        padding: '0.75rem 0.5rem 5rem', // Bottom padding reserves space for persistent 3D bar
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {/* Top Header Mode Toggle: [ 🏗️ Modo Obra ] ⟷ [ ⚙️ Modo Experto ] */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.25rem 0.5rem 0.75rem',
          borderBottom: '1px solid var(--md-sys-color-outline-variant)',
          marginBottom: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: '20px',
              backgroundColor: 'var(--md-sys-color-primary)',
              color: 'var(--md-sys-color-on-primary)',
              fontSize: '0.85rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.3rem',
            }}
          >
            🏗️ Modo Obra
          </span>
        </div>

        <button
          type="button"
          onClick={onSwitchToExpertMode}
          className="m3-button m3-button--outlined"
          aria-label="Cambiar a Modo Experto (formulario completo)"
          title="Ver formulario completo con todos los parámetros"
          style={{
            minHeight: '48px',
            fontSize: '0.85rem',
            fontWeight: 600,
            borderRadius: '24px',
            padding: '0 0.9rem',
          }}
        >
          ⚙️ Modo Experto
        </button>
      </div>

      {/* Step Indicators and Navigation Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.2rem 0.5rem',
          marginBottom: '0.75rem',
        }}
      >
        <span
          style={{
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'var(--md-sys-color-outline)',
          }}
        >
          {`Paso ${currentStepIndex + 1} de ${MODO_OBRA_STEPS.length}`}
        </span>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          {MODO_OBRA_STEPS.map((step, idx) => (
            <button
              key={step.id}
              type="button"
              onClick={() => {
                setCurrentStepIndex(idx);
                triggerHaptic('tick');
              }}
              aria-label={`Ir al paso ${idx + 1}: ${step.title}`}
              style={{
                width: idx === currentStepIndex ? '24px' : '10px',
                height: '10px',
                borderRadius: '5px',
                backgroundColor:
                  idx === currentStepIndex
                    ? 'var(--md-sys-color-primary)'
                    : 'var(--md-sys-color-outline-variant)',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            />
          ))}
        </div>
      </div>

      {/* Main Gesture Card: Thumb Radial Sweep Dial */}
      <div style={{ width: '100%', flex: 1 }}>
        <ThumbArcInput
          id={activeStep.id}
          label={activeStep.title}
          value={getCurrentValue()}
          onChange={handleStepValueChange}
          min={activeStep.min}
          max={activeStep.max}
          step={activeStep.step}
          coarseStep={activeStep.coarseStep}
          unit={activeStep.unit}
          helpText={activeStep.helpText}
          handMode={handMode}
          onHandModeChange={onHandModeChange}
          quickPresets={activeStep.presets}
        />
      </div>

      {/* Gesture Instruction & Step Buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.5rem',
          marginTop: '1rem',
          padding: '0 0.5rem',
        }}
      >
        <button
          type="button"
          onClick={goToPrevStep}
          disabled={currentStepIndex === 0}
          className="m3-button m3-button--tonal"
          aria-label="Paso anterior (deslizar hacia abajo)"
          style={{
            minHeight: '48px',
            borderRadius: '16px',
            fontSize: '0.9rem',
            fontWeight: 600,
            opacity: currentStepIndex === 0 ? 0.4 : 1,
            flex: 1,
          }}
        >
          🔼 Anterior
        </button>

        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--md-sys-color-outline)',
            textAlign: 'center',
            flex: 1.2,
          }}
        >
          ↕️ Deslizá vertical para cambiar de paso
        </span>

        <button
          type="button"
          onClick={goToNextStep}
          disabled={currentStepIndex === MODO_OBRA_STEPS.length - 1}
          className="m3-button m3-button--filled"
          aria-label="Siguiente paso (deslizar hacia arriba)"
          style={{
            minHeight: '48px',
            borderRadius: '16px',
            fontSize: '0.9rem',
            fontWeight: 700,
            opacity: currentStepIndex === MODO_OBRA_STEPS.length - 1 ? 0.4 : 1,
            flex: 1,
          }}
        >
          Siguiente 🔽
        </button>
      </div>

      {/* Persistent Bottom 3D Inspection Bar (Point 1.3) */}
      <div
        className="modo-obra-bottom-bar"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom, 0px))',
          backgroundColor: 'var(--md-sys-color-surface)',
          borderTop: '1px solid var(--md-sys-color-outline-variant)',
          boxShadow: '0 -4px 16px rgba(0, 0, 0, 0.08)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '1rem',
          zIndex: 100,
        }}
      >
        <button
          type="button"
          onClick={() => {
            triggerHaptic('major');
            onView3dClick?.();
          }}
          className={`m3-button ${is3dViewActive ? 'm3-button--tonal' : 'm3-button--filled'}`}
          aria-label={is3dViewActive ? 'Volver al formulario de medidas' : 'Ver modelo 3D en pantalla completa'}
          style={{
            width: '100%',
            maxWidth: '440px',
            minHeight: '52px',
            borderRadius: '26px',
            fontSize: '1.05rem',
            fontWeight: 700,
            boxShadow: '0 3px 8px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          <span>{is3dViewActive ? '✏️ Volver a Medidas' : '👁️ Ver Modelo 3D'}</span>
        </button>
      </div>
    </div>
  );
}
