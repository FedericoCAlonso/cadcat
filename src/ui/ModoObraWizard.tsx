import {
  type ReactElement,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { type HandMode, triggerHaptic } from '../resolver/thumbArc';
import { ThumbArcInput } from './ThumbArcInput';
import { WorkshopContextDiagram } from './WorkshopContextDiagram';
import { DEFAULT_UI_CONFIG } from '../config';
import { type ProjectModuleItem } from '../model/project';
import { type Material } from '../model/material';
import { type RoofType, type BackingType, type BayContent } from '../resolver';

export type ObraGridType = '1-bay' | '2-bays-vertical' | '3-bays-vertical' | '2-bays-horizontal';
export type ObraBayContentType = 'empty' | 'shelves' | 'drawer-stack' | 'doors' | 'pull-out-tray' | 'bi-fold-closure';

export interface ModoObraWizardProps {
  // Project & Module management
  projectModules?: ProjectModuleItem[];
  activeModuleId?: string;
  onSetActiveModule?: (id: string) => void;
  onAddProjectModule?: () => void;
  templates?: Array<{ id: string; name: string; description?: string; category?: string }>;
  selectedTemplateId?: string;
  onTemplateChange?: (templateId: string) => void;

  // Dimensions
  width: number;
  height: number;
  depth: number;
  thickness: number;
  onWidthChange: (val: number) => void;
  onHeightChange: (val: number) => void;
  onDepthChange: (val: number) => void;
  onThicknessChange?: (val: number) => void;

  // Base structure
  hasPlinth?: boolean;
  plinthHeightMm?: number;
  onHasPlinthChange?: (val: boolean) => void;
  onPlinthHeightChange?: (val: number) => void;
  hasWallHangingRail?: boolean;
  onHasWallHangingRailChange?: (val: boolean) => void;

  // Roof / Top panel
  roofType?: RoofType;
  onRoofTypeChange?: (roof: RoofType) => void;

  // Backing
  hasBacking?: boolean;
  backingType?: BackingType;
  onHasBackingChange?: (val: boolean) => void;
  onBackingTypeChange?: (val: BackingType) => void;

  // Bays / Grid
  gridType?: ObraGridType;
  bays?: BayContent[];
  activeBayIndex?: number;
  onGridTypeChange?: (grid: ObraGridType) => void;
  onActiveBayIndexChange?: (idx: number) => void;

  // Bay content actions
  onBayContentTypeChange?: (bayIdx: number, type: ObraBayContentType) => void;
  onAddShelf?: (bayIdx: number) => void;
  onRemoveShelf?: (bayIdx: number, shelfIdx?: number) => void;
  onShelfTypeChange?: (bayIdx: number, type: 'fixed' | 'adjustable') => void;
  onAddDrawer?: (bayIdx: number) => void;
  onRemoveDrawer?: (bayIdx: number, drawerIdx?: number) => void;
  onDoorCountChange?: (bayIdx: number, count: 1 | 2) => void;
  onDoorHingeSideChange?: (bayIdx: number, hingeSide: 'left' | 'right') => void;
  onDoorInteriorShelvesCountChange?: (bayIdx: number, count: number) => void;

  // Materials
  materials?: Material[];
  selectedMaterialId?: string;
  onMaterialChange?: (id: string) => void;
  frontsMaterialId?: string;
  onFrontsMaterialChange?: (id: string) => void;
  drawerBoxesMaterialId?: string;
  onDrawerBoxesMaterialChange?: (id: string) => void;
  backingsMaterialId?: string;
  onBackingsMaterialChange?: (id: string) => void;

  // Global UI controls
  handMode: HandMode;
  onHandModeChange: (mode: HandMode) => void;
  onSwitchToExpertMode: () => void;
  onView3dClick?: () => void;
  is3dViewActive?: boolean;
}

export type DimensionSubField = 'width' | 'height' | 'depth' | 'thickness';

export interface ObraStepDefinition {
  id: string;
  stepNumber: number;
  title: string;
  subtitle: string;
}

export type MaterialRole = 'carcass' | 'fronts' | 'drawers' | 'backing';

export const OBRA_STEPS: ObraStepDefinition[] = [
  { id: 'module-type', stepNumber: 1, title: 'Módulo y Tipo', subtitle: 'Seleccioná el mueble a relevar' },
  { id: 'dimensions', stepNumber: 2, title: 'Medidas Principales', subtitle: 'Ancho, alto, profundidad y placa' },
  { id: 'base-support', stepNumber: 3, title: 'Base / Apoyo', subtitle: 'Zócalo, patas regulables o suspendido' },
  { id: 'roof-structure', stepNumber: 4, title: 'Techo / Amarres', subtitle: 'Tapa sólida, fajas o sin tapa a techo' },
  { id: 'backing', stepNumber: 5, title: 'Fondo Trasero', subtitle: 'Ranurado 3mm, clavado o sin fondo' },
  { id: 'bays-equipment', stepNumber: 6, title: 'Vanos y Equipamiento', subtitle: 'División vertical y equipamiento interior' },
  { id: 'material', stepNumber: 7, title: 'Tablero / Melamina', subtitle: 'Placas para casco, frentes, cajones y fondos' },
];

/**
 * Modo Obra: Fully immersive gesture-driven mobile wizard for workshops and job sites.
 * Features 8 comprehensive carpentry configuration steps, zero vertical scroll,
 * radial thumb dial physics, and persistent 3D inspection.
 */
export function ModoObraWizard({
  projectModules = [],
  activeModuleId,
  onSetActiveModule,
  onAddProjectModule,
  templates = [],
  selectedTemplateId = 'base-modular',
  onTemplateChange,
  width,
  height,
  depth,
  thickness,
  onWidthChange,
  onHeightChange,
  onDepthChange,
  onThicknessChange,
  hasPlinth = false,
  plinthHeightMm = 100,
  onHasPlinthChange,
  onPlinthHeightChange,
  hasWallHangingRail = false,
  onHasWallHangingRailChange,
  roofType = 'front-back-rails',
  onRoofTypeChange,
  hasBacking = true,
  backingType = 'groove',
  onHasBackingChange,
  onBackingTypeChange,
  gridType = '1-bay',
  bays = [],
  activeBayIndex = 0,
  onGridTypeChange,
  onActiveBayIndexChange,
  onBayContentTypeChange,
  onAddShelf,
  onRemoveShelf,
  onShelfTypeChange,
  onAddDrawer,
  onRemoveDrawer,
  onDoorCountChange,
  onDoorHingeSideChange,
  onDoorInteriorShelvesCountChange,
  materials = [],
  selectedMaterialId = '',
  onMaterialChange,
  frontsMaterialId = '',
  onFrontsMaterialChange,
  drawerBoxesMaterialId = '',
  onDrawerBoxesMaterialChange,
  backingsMaterialId = '',
  onBackingsMaterialChange,
  handMode,
  onHandModeChange,
  onSwitchToExpertMode,
  onView3dClick,
  is3dViewActive = false,
}: ModoObraWizardProps): ReactElement {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [dimensionField, setDimensionField] = useState<DimensionSubField>('width');

  const activeStep = OBRA_STEPS[currentStepIndex] ?? OBRA_STEPS[0]!;

  const goToNextStep = useCallback(() => {
    if (currentStepIndex < OBRA_STEPS.length - 1) {
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

  // Dimension fields list for carousel navigation in Step 2
  const dimensionFieldsList = useMemo<Array<{ id: DimensionSubField; label: string; shortLabel: string; value: number }>>(() => [
    { id: 'width', label: 'Ancho Total', shortLabel: 'Ancho', value: width },
    { id: 'height', label: 'Alto Total', shortLabel: 'Alto', value: height },
    { id: 'depth', label: 'Profundidad', shortLabel: 'Prof.', value: depth },
    { id: 'thickness', label: 'Espesor Placa', shortLabel: 'Espesor', value: thickness },
  ], [width, height, depth, thickness]);

  const activeDimIndex = dimensionFieldsList.findIndex((d) => d.id === dimensionField);
  const currentDimConfig = dimensionFieldsList[activeDimIndex >= 0 ? activeDimIndex : 0]!;

  const goToNextDimension = useCallback(() => {
    const nextIdx = (activeDimIndex + 1) % dimensionFieldsList.length;
    setDimensionField(dimensionFieldsList[nextIdx]!.id);
    triggerHaptic('tick');
  }, [activeDimIndex, dimensionFieldsList]);

  const goToPrevDimension = useCallback(() => {
    const prevIdx = (activeDimIndex - 1 + dimensionFieldsList.length) % dimensionFieldsList.length;
    setDimensionField(dimensionFieldsList[prevIdx]!.id);
    triggerHaptic('tick');
  }, [activeDimIndex, dimensionFieldsList]);

  // Active bay reference
  const currentBay: BayContent | undefined = bays[activeBayIndex];
  const safeBayCount = gridType === '3-bays-vertical' ? 3 : gridType === '2-bays-vertical' ? 2 : 1;

  // Active module title
  const activeModule = useMemo(() => {
    return projectModules.find((m) => m.id === activeModuleId) ?? projectModules[0];
  }, [projectModules, activeModuleId]);

  // Contextual role detection for multi-role materials
  const [activeMaterialRole, setActiveMaterialRole] = useState<MaterialRole>('carcass');

  const hasDoorsOrFronts = useMemo(() => {
    return (
      Boolean(frontsMaterialId) ||
      bays.some(
        (b) =>
          b.type === 'doors' ||
          b.type === 'bi-fold-closure' ||
          (b.type === 'drawer-stack' && b.drawerType !== 'simple-interior'),
      )
    );
  }, [frontsMaterialId, bays]);

  const hasDrawers = useMemo(() => {
    return (
      Boolean(drawerBoxesMaterialId) ||
      bays.some((b) => b.type === 'drawer-stack' || b.type === 'pull-out-tray')
    );
  }, [drawerBoxesMaterialId, bays]);

  const hasBackingBoard = useMemo(() => {
    return Boolean(backingsMaterialId) || (hasBacking && backingType !== 'none');
  }, [backingsMaterialId, hasBacking, backingType]);

  const availableRoles = useMemo(() => {
    const list: Array<{
      id: MaterialRole;
      label: string;
      shortLabel: string;
      icon: string;
      description: string;
      currentMaterialName: string;
      isInherited: boolean;
    }> = [
      {
        id: 'carcass',
        label: 'Casco / Estructura',
        shortLabel: 'Casco',
        icon: '🏛️',
        description: 'Placa principal para laterales, piso, techo y estantes interiores.',
        currentMaterialName: materials.find((m) => m.id === selectedMaterialId)?.name ?? 'Sin seleccionar',
        isInherited: false,
      },
    ];

    if (hasDoorsOrFronts) {
      const isCustom = Boolean(frontsMaterialId);
      const effectiveMat = materials.find((m) => m.id === (frontsMaterialId || selectedMaterialId));
      list.push({
        id: 'fronts',
        label: 'Frentes y Puertas',
        shortLabel: 'Frentes',
        icon: '🚪',
        description: 'Placa exterior para hojas de puerta y tapas frontales de cajón.',
        currentMaterialName: isCustom ? (effectiveMat?.name ?? 'Personalizado') : `Igual al Casco (${effectiveMat?.name ?? ''})`,
        isInherited: !isCustom,
      });
    }

    if (hasDrawers) {
      const isCustom = Boolean(drawerBoxesMaterialId);
      const effectiveMat = materials.find((m) => m.id === (drawerBoxesMaterialId || selectedMaterialId));
      list.push({
        id: 'drawers',
        label: 'Cajas de Cajones',
        shortLabel: 'Cajones',
        icon: '🗄️',
        description: 'Placa para laterales, contrafrentes y traseras de cajones interiores.',
        currentMaterialName: isCustom ? (effectiveMat?.name ?? 'Personalizado') : `Igual al Casco (${effectiveMat?.name ?? ''})`,
        isInherited: !isCustom,
      });
    }

    if (hasBackingBoard) {
      const isCustom = Boolean(backingsMaterialId && backingsMaterialId !== selectedMaterialId);
      const effectiveMat = materials.find((m) => m.id === (backingsMaterialId || selectedMaterialId));
      list.push({
        id: 'backing',
        label: 'Fondos y Traseras',
        shortLabel: 'Fondos',
        icon: '🪵',
        description: 'Placa para fondos del mueble y fondos de cajón (usualmente 3 mm o 18 mm).',
        currentMaterialName: effectiveMat?.name ?? 'Sin seleccionar',
        isInherited: !isCustom,
      });
    }

    return list;
  }, [
    materials,
    selectedMaterialId,
    frontsMaterialId,
    drawerBoxesMaterialId,
    backingsMaterialId,
    hasDoorsOrFronts,
    hasDrawers,
    hasBackingBoard,
  ]);

  const effectiveMaterialRole: MaterialRole = availableRoles.some((r) => r.id === activeMaterialRole)
    ? activeMaterialRole
    : 'carcass';

  const activeRoleConfig = availableRoles.find((r) => r.id === effectiveMaterialRole) ?? availableRoles[0]!;

  const currentRoleMaterialId = useMemo(() => {
    switch (effectiveMaterialRole) {
      case 'fronts':
        return frontsMaterialId || selectedMaterialId;
      case 'drawers':
        return drawerBoxesMaterialId || selectedMaterialId;
      case 'backing':
        return backingsMaterialId || selectedMaterialId;
      case 'carcass':
      default:
        return selectedMaterialId;
    }
  }, [effectiveMaterialRole, selectedMaterialId, frontsMaterialId, drawerBoxesMaterialId, backingsMaterialId]);

  const handleSelectMaterialForRole = useCallback(
    (matId: string) => {
      triggerHaptic('major');
      switch (effectiveMaterialRole) {
        case 'fronts':
          onFrontsMaterialChange?.(matId);
          break;
        case 'drawers':
          onDrawerBoxesMaterialChange?.(matId);
          break;
        case 'backing':
          onBackingsMaterialChange?.(matId);
          break;
        case 'carcass':
        default:
          onMaterialChange?.(matId);
          break;
      }
    },
    [effectiveMaterialRole, onMaterialChange, onFrontsMaterialChange, onDrawerBoxesMaterialChange, onBackingsMaterialChange],
  );

  const handleResetRoleToCarcass = useCallback(() => {
    triggerHaptic('tick');
    if (effectiveMaterialRole === 'fronts') {
      onFrontsMaterialChange?.('');
    } else if (effectiveMaterialRole === 'drawers') {
      onDrawerBoxesMaterialChange?.('');
    } else if (effectiveMaterialRole === 'backing') {
      onBackingsMaterialChange?.(selectedMaterialId);
    }
  }, [effectiveMaterialRole, selectedMaterialId, onFrontsMaterialChange, onDrawerBoxesMaterialChange, onBackingsMaterialChange]);

  return (
    <section
      className="modo-obra-immersive-wrapper"
      aria-label="Modo Obra - Control con una mano"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        maxHeight: '100dvh',
        width: '100%',
        maxWidth: '540px',
        margin: '0 auto',
        backgroundColor: 'var(--md-sys-color-surface)',
        overflow: 'hidden',
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. Ultra-Compact 2-Row Top Bar (Zero Overlap Layout) */}
      <header
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
          padding: 'max(0.35rem, env(safe-area-inset-top, 0.35rem)) 0.6rem 0.3rem',
          borderBottom: '1px solid var(--md-sys-color-outline-variant)',
          backgroundColor: 'var(--md-sys-color-surface-container)',
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        {/* Row 1: Module Selector (Left) & Global Controls (Right) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            gap: '0.4rem',
          }}
        >
          {/* Module Picker / Add Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0, flexShrink: 1 }}>
            {projectModules.length > 0 && onSetActiveModule ? (
              <select
                value={activeModuleId ?? activeModule?.id}
                onChange={(e) => onSetActiveModule(e.target.value)}
                aria-label="Seleccionar módulo activo del proyecto"
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  padding: '0.25rem 0.45rem',
                  borderRadius: '10px',
                  border: '1px solid var(--md-sys-color-outline)',
                  backgroundColor: 'var(--md-sys-color-surface)',
                  color: 'var(--md-sys-color-on-surface)',
                  maxWidth: '140px',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
              >
                {projectModules.map((mod, idx) => (
                  <option key={mod.id} value={mod.id}>
                    {`📦 ${mod.name || `Módulo ${idx + 1}`}`}
                  </option>
                ))}
              </select>
            ) : (
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: 'var(--md-sys-color-on-surface)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {activeModule ? `📦 ${activeModule.name}` : '🏗️ Obra'}
              </span>
            )}

            {onAddProjectModule && (
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('major');
                  onAddProjectModule();
                }}
                className="m3-button m3-button--filled"
                aria-label="Agregar nuevo módulo a la obra"
                title="Agregar nuevo mueble a la obra"
                style={{
                  minWidth: '36px',
                  height: '34px',
                  padding: '0 0.35rem',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                ➕
              </button>
            )}
          </div>

          {/* Right Controls: Hand Mode Toggle & Expert Mode Switch */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => {
                const nextMode: HandMode = handMode === 'right' ? 'left' : 'right';
                onHandModeChange(nextMode);
                triggerHaptic('tick');
              }}
              aria-label={`Cambiar mano: actualmente ${handMode === 'right' ? 'Diestro' : 'Zurdo'}`}
              title={`Mano activa: ${handMode === 'right' ? 'Diestro' : 'Zurdo'}`}
              style={{
                height: '34px',
                padding: '0 0.5rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: '1px solid var(--md-sys-color-outline-variant)',
                backgroundColor: 'var(--md-sys-color-surface)',
                color: 'var(--md-sys-color-on-surface)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {handMode === 'right' ? '🖐️ D' : '🖐️ Z'}
            </button>

            <button
              type="button"
              onClick={onSwitchToExpertMode}
              aria-label="Cambiar a Modo Experto (formulario completo)"
              title="Abrir formulario técnico completo"
              className="m3-button m3-button--tonal"
              style={{
                height: '34px',
                padding: '0 0.55rem',
                borderRadius: '10px',
                fontSize: '0.76rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                backgroundColor: 'var(--md-sys-color-surface-container-highest)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                color: 'var(--md-sys-color-primary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <span aria-hidden="true">⚙️</span>
              <span>Modo Experto</span>
            </button>
          </div>
        </div>

        {/* Row 2: Step Title Context & Progress Indicator */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            gap: '0.4rem',
            paddingTop: '0.1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0, overflow: 'hidden' }}>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 800,
                color: 'var(--md-sys-color-primary)',
                whiteSpace: 'nowrap',
              }}
            >
              {`Paso ${activeStep.stepNumber} de ${OBRA_STEPS.length}:`}
            </span>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--md-sys-color-on-surface)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {activeStep.title}
            </span>
          </div>

          {/* Step Progress Line / Dots */}
          <div style={{ display: 'flex', gap: '3px', alignItems: 'center', flexShrink: 0 }}>
            {OBRA_STEPS.map((s, idx) => (
              <span
                key={s.id}
                style={{
                  width: idx === currentStepIndex ? '14px' : '5px',
                  height: '4px',
                  borderRadius: '2px',
                  backgroundColor:
                    idx === currentStepIndex
                      ? 'var(--md-sys-color-primary)'
                      : 'var(--md-sys-color-outline-variant)',
                  transition: 'all 0.2s ease',
                }}
              />
            ))}
          </div>
        </div>
      </header>

      {/* 2. Scrollable Middle Body Container */}
      <main
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: '0.35rem 0.6rem',
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          boxSizing: 'border-box',
          width: '100%',
        }}
      >
        {/* Step Subtitle / Accessibility Header */}
        <div style={{ width: '100%', textAlign: 'center', marginBottom: '0.25rem' }}>
          <h2 className="visually-hidden">{activeStep.title}</h2>
          <p
            style={{
              margin: '0',
              fontSize: '0.76rem',
              color: 'var(--md-sys-color-outline)',
            }}
          >
            {activeStep.subtitle}
          </p>
        </div>

        {/* STEP 1: MÓDULO Y TIPO (PLANTILLA) */}
        {activeStep.id === 'module-type' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.45rem', margin: '0 auto' }}>
            {/* Context Technical Schematic Diagram */}
            <WorkshopContextDiagram
              step="module-type"
              selectedTemplateId={selectedTemplateId}
            />

            {/* Template Selection Grid (Directly at bottom in the Thumb Zone!) */}
            <div style={{ marginTop: '0.1rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--md-sys-color-primary)', display: 'block', marginBottom: '0.35rem' }}>
                Seleccionar Plantilla:
              </span>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '0.5rem',
                  width: '100%',
                }}
              >
                {templates.slice(0, 8).map((tpl) => {
                  const isSelected = selectedTemplateId === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic('major');
                        onTemplateChange?.(tpl.id);
                      }}
                      style={{
                        minHeight: '62px',
                        padding: '0.5rem',
                        borderRadius: '16px',
                        border: isSelected
                          ? '2px solid var(--md-sys-color-primary)'
                          : '1px solid var(--md-sys-color-outline-variant)',
                        backgroundColor: isSelected
                          ? 'var(--md-sys-color-primary-container)'
                          : 'var(--md-sys-color-surface-container-high)',
                        color: isSelected
                          ? 'var(--md-sys-color-on-primary-container)'
                          : 'var(--md-sys-color-on-surface)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                        {tpl.name.includes('Alacena')
                          ? '🧗 '
                          : tpl.name.includes('Cajonera')
                            ? '🗄️ '
                            : tpl.name.includes('Torre')
                              ? '🏛️ '
                              : '🪵 '}
                        {tpl.name}
                      </span>
                      {tpl.category && (
                        <span style={{ fontSize: '0.72rem', opacity: 0.8, marginTop: '2px' }}>
                          {tpl.category}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: MEDIDAS PRINCIPALES */}
        {activeStep.id === 'dimensions' && (
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              flex: 1,
              minHeight: 0,
              gap: '0.35rem',
              padding: '0.1rem 0',
            }}
          >
            {/* Top: Context Technical Schematic Diagram with interactive Cotas */}
            <WorkshopContextDiagram
              step="dimensions"
              width={width}
              height={height}
              depth={depth}
              thickness={thickness}
              activeDimension={dimensionField}
              onSelectDimension={setDimensionField}
            />

            {/* Contextual Carpentry Dimension Header with Prev/Next Controls */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                maxWidth: '460px',
                padding: '0.35rem 0.5rem',
                borderRadius: '12px',
                backgroundColor: 'var(--md-sys-color-surface-container)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                boxSizing: 'border-box',
                gap: '0.4rem',
              }}
            >
              <button
                type="button"
                onClick={goToPrevDimension}
                aria-label="Medida anterior"
                title="Medida anterior"
                className="m3-button m3-button--tonal"
                style={{
                  minWidth: '40px',
                  width: '40px',
                  height: '40px',
                  minHeight: '40px',
                  borderRadius: '10px',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  backgroundColor: 'var(--md-sys-color-surface-container-high)',
                  flexShrink: 0,
                }}
              >
                ◀
              </button>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <span style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
                    {currentDimConfig.label}:
                  </span>
                  <span style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--md-sys-color-primary)' }}>
                    {`${currentDimConfig.value} mm`}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--md-sys-color-outline)', fontWeight: 600 }}>
                    {`(${activeDimIndex + 1}/4)`}
                  </span>
                </div>
                <span style={{ fontSize: '0.68rem', color: 'var(--md-sys-color-on-surface-variant)', marginTop: '1px' }}>
                  {dimensionField === 'width' && 'Costado exterior a costado exterior'}
                  {dimensionField === 'height' && 'Altura exterior de piso/zócalo a tapa'}
                  {dimensionField === 'depth' && 'Profundidad de casco exterior'}
                  {dimensionField === 'thickness' && 'Espesor nominal del tablero melamínico'}
                </span>
              </div>

              <button
                type="button"
                onClick={goToNextDimension}
                aria-label="Medida siguiente"
                title="Medida siguiente"
                className="m3-button m3-button--tonal"
                style={{
                  minWidth: '40px',
                  width: '40px',
                  height: '40px',
                  minHeight: '40px',
                  borderRadius: '10px',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  backgroundColor: 'var(--md-sys-color-surface-container-high)',
                  flexShrink: 0,
                }}
              >
                ▶
              </button>
            </div>

            {/* Middle: Active Dimension Tactile Controls (Keypad / Presets / Steppers) */}
            <div
              style={{
                width: '100%',
                maxWidth: '460px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                minHeight: 0,
              }}
            >
              {dimensionField === 'width' && (
                <ThumbArcInput
                  id="obra-dim-width"
                  label="Ancho Total del Mueble"
                  value={width}
                  onChange={onWidthChange}
                  min={DEFAULT_UI_CONFIG.dimensions.width.min}
                  max={DEFAULT_UI_CONFIG.dimensions.width.max}
                  step={1}
                  coarseStep={10}
                  extraCoarseStep={50}
                  unit="mm"
                  helpText="Ancho exterior de costado a costado."
                  handMode={handMode}
                  onHandModeChange={onHandModeChange}
                  quickPresets={[400, 500, 600, 800, 900, 1000, 1200]}
                  compact={true}
                  showArc={false}
                />
              )}

              {dimensionField === 'height' && (
                <ThumbArcInput
                  id="obra-dim-height"
                  label="Alto Total del Mueble"
                  value={height}
                  onChange={onHeightChange}
                  min={DEFAULT_UI_CONFIG.dimensions.height.min}
                  max={DEFAULT_UI_CONFIG.dimensions.height.max}
                  step={1}
                  coarseStep={10}
                  extraCoarseStep={50}
                  unit="mm"
                  helpText="Altura exterior desde el piso/zócalo hasta la tapa superior."
                  handMode={handMode}
                  onHandModeChange={onHandModeChange}
                  quickPresets={[700, 750, 800, 850, 900, 1800, 2100]}
                  compact={true}
                  showArc={false}
                />
              )}

              {dimensionField === 'depth' && (
                <ThumbArcInput
                  id="obra-dim-depth"
                  label="Profundidad Total"
                  value={depth}
                  onChange={onDepthChange}
                  min={DEFAULT_UI_CONFIG.dimensions.depth.min}
                  max={DEFAULT_UI_CONFIG.dimensions.depth.max}
                  step={1}
                  coarseStep={10}
                  extraCoarseStep={50}
                  unit="mm"
                  helpText="Profundidad exterior (bajo mesada: 580mm, alacena: 320-350mm)."
                  handMode={handMode}
                  onHandModeChange={onHandModeChange}
                  quickPresets={[300, 320, 350, 450, 500, 550, 580, 600]}
                  compact={true}
                  showArc={false}
                />
              )}

              {dimensionField === 'thickness' && (
                <ThumbArcInput
                  id="obra-dim-thickness"
                  label="Espesor de Placa"
                  value={thickness}
                  onChange={(val) => onThicknessChange?.(val)}
                  min={12}
                  max={30}
                  step={1}
                  coarseStep={3}
                  unit="mm"
                  helpText="Espesor nominal del tablero melamínico (18 mm estándar)."
                  handMode={handMode}
                  onHandModeChange={onHandModeChange}
                  quickPresets={[15, 18, 25]}
                  compact={true}
                  showArc={false}
                />
              )}
            </div>

            {/* Bottom (Thumb Reach Zone): Full-width 4-Dimension Segmented Overview Bar */}
            <div
              role="tablist"
              aria-label="Selector de medidas principales"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '0.35rem',
                width: '100%',
                maxWidth: '460px',
                boxSizing: 'border-box',
                marginTop: 'auto',
              }}
            >
              {dimensionFieldsList.map((f) => {
                const isSelected = f.id === dimensionField;
                return (
                  <button
                    key={f.id}
                    role="tab"
                    aria-selected={isSelected}
                    type="button"
                    onClick={() => {
                      triggerHaptic('tick');
                      setDimensionField(f.id);
                    }}
                    aria-label={`Seleccionar medida: ${f.label}`}
                    title={`${f.label} (${f.value} mm)`}
                    style={{
                      minHeight: '48px',
                      padding: '0.3rem 0.2rem',
                      borderRadius: '12px',
                      border: isSelected
                        ? '2px solid var(--md-sys-color-primary)'
                        : '1px solid var(--md-sys-color-outline-variant)',
                      backgroundColor: isSelected
                        ? 'var(--md-sys-color-primary-container)'
                        : 'var(--md-sys-color-surface-container-high)',
                      color: isSelected
                        ? 'var(--md-sys-color-on-primary-container)'
                        : 'var(--md-sys-color-on-surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: isSelected ? '0 2px 6px rgba(0,0,0,0.12)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        opacity: isSelected ? 1 : 0.8,
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                      }}
                    >
                      {f.shortLabel}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '1px', marginTop: '1px' }}>
                      <span style={{ fontSize: '0.96rem', fontWeight: 800 }}>{f.value}</span>
                      <span style={{ fontSize: '0.62rem', opacity: 0.7 }}>mm</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: BASE / ESTRUCTURA DE PISO */}
        {activeStep.id === 'base-support' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.45rem', margin: '0 auto' }}>
            {/* Context Technical Schematic Diagram */}
            <WorkshopContextDiagram
              step="base-support"
              hasPlinth={hasPlinth}
              hasWallHangingRail={hasWallHangingRail}
              selectedTemplateId={selectedTemplateId}
            />

            {/* Base Option Buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.45rem' }}>
              {[
                {
                  id: 'plinth-integrated',
                  label: '🪚 Con Zócalo / Plinto (100 mm)',
                  desc: 'Frente y laterales con retroceso para elevar el módulo del piso.',
                  active: hasPlinth && !hasWallHangingRail,
                  onSelect: () => {
                    onHasPlinthChange?.(true);
                    onHasWallHangingRailChange?.(false);
                  },
                },
                {
                  id: 'floor-direct',
                  label: '🪵 Apoyo Directo al Piso',
                  desc: 'Costados apoyan directo con regatones plásticos sanitarios.',
                  active: !hasPlinth && !hasWallHangingRail,
                  onSelect: () => {
                    onHasPlinthChange?.(false);
                    onHasWallHangingRailChange?.(false);
                  },
                },
                {
                  id: 'wall-hanging',
                  label: '🧗 Suspendido / Flotante (Alacena)',
                  desc: 'Sin base inferior. Incluye faja trasera de fijación a pared.',
                  active: hasWallHangingRail || (!hasPlinth && selectedTemplateId.includes('wall')),
                  onSelect: () => {
                    onHasPlinthChange?.(false);
                    onHasWallHangingRailChange?.(true);
                  },
                },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic('major');
                    opt.onSelect();
                  }}
                  style={{
                    minHeight: '52px',
                    padding: '0.6rem 0.8rem',
                    borderRadius: '14px',
                    border: opt.active
                      ? '2px solid var(--md-sys-color-primary)'
                      : '1px solid var(--md-sys-color-outline-variant)',
                    backgroundColor: opt.active
                      ? 'var(--md-sys-color-primary-container)'
                      : 'var(--md-sys-color-surface-container-high)',
                    color: opt.active
                      ? 'var(--md-sys-color-on-primary-container)'
                      : 'var(--md-sys-color-on-surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '0.92rem', fontWeight: 700 }}>{opt.label}</span>
                  <span style={{ fontSize: '0.74rem', opacity: 0.85, marginTop: '2px' }}>{opt.desc}</span>
                </button>
              ))}
            </div>

            {hasPlinth && onPlinthHeightChange && (
              <div
                style={{
                  padding: '0.6rem',
                  borderRadius: '14px',
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  marginTop: '0.15rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Altura de Base / Zócalo:</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--md-sys-color-primary)' }}>
                    {`${plinthHeightMm} mm`}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.35rem', marginTop: '0.4rem' }}>
                  {[80, 100, 120, 150].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                        triggerHaptic('tick');
                        onPlinthHeightChange(h);
                      }}
                      style={{
                        minHeight: '44px',
                        borderRadius: '10px',
                        border: plinthHeightMm === h
                          ? '2px solid var(--md-sys-color-primary)'
                          : '1px solid var(--md-sys-color-outline-variant)',
                        backgroundColor: plinthHeightMm === h
                          ? 'var(--md-sys-color-primary-container)'
                          : 'var(--md-sys-color-surface)',
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                      }}
                    >
                      {`${h}mm`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: TECHO / AMARRES SUPERIORES (Incluye alacena sin tapa hasta el techo) */}
        {activeStep.id === 'roof-structure' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.45rem', margin: '0 auto' }}>
            {/* Context Technical Schematic Diagram */}
            <WorkshopContextDiagram
              step="roof-structure"
              roofType={roofType}
              selectedTemplateId={selectedTemplateId}
            />

            {/* Option Buttons in Thumb Zone */}
            {[
              {
                id: 'solid-panel',
                roof: 'solid-panel' as RoofType,
                title: '🪵 Tapa Ciega Completa',
                badge: 'Estándar cerrado',
                desc: 'Tablero melamínico entero de 18 mm. Recomendado para alacenas bajas tradicionales y torres de hornos.',
              },
              {
                id: 'none',
                roof: 'none' as RoofType,
                title: '🚫 Sin Tapa (Hasta el Techo)',
                badge: 'Solución anti-mugre',
                desc: 'Abierto superiormente. Para alacenas que van a cielorraso: evita la acumulación de grasa y polvo inaccesible, aprovecha la altura máxima y ahorra placa.',
              },
              {
                id: 'front-back-rails',
                roof: 'front-back-rails' as RoofType,
                title: '📏 2 Fajas de Amarre (80 mm)',
                badge: 'Bajo mesada',
                desc: 'Fajas superior frontal y trasera. Estándar para muebles bajo mesada para asentar la mesada de granito, cuarzo o madera.',
              },
            ].map((opt) => {
              const isSelected = roofType === opt.roof;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic('major');
                    onRoofTypeChange?.(opt.roof);
                  }}
                  style={{
                    minHeight: '64px',
                    padding: '0.65rem 0.85rem',
                    borderRadius: '14px',
                    border: isSelected
                      ? '2px solid var(--md-sys-color-primary)'
                      : '1px solid var(--md-sys-color-outline-variant)',
                    backgroundColor: isSelected
                      ? 'var(--md-sys-color-primary-container)'
                      : 'var(--md-sys-color-surface-container-high)',
                    color: isSelected
                      ? 'var(--md-sys-color-on-primary-container)'
                      : 'var(--md-sys-color-on-surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.94rem', fontWeight: 700 }}>{opt.title}</span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.15rem 0.45rem',
                        borderRadius: '8px',
                        backgroundColor: isSelected
                          ? 'var(--md-sys-color-primary)'
                          : 'var(--md-sys-color-surface-container-highest)',
                        color: isSelected
                          ? 'var(--md-sys-color-on-primary)'
                          : 'var(--md-sys-color-outline)',
                      }}
                    >
                      {opt.badge}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.74rem', opacity: 0.85, marginTop: '4px', lineHeight: 1.3 }}>
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* STEP 5: FONDO TRASERO */}
        {activeStep.id === 'backing' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.45rem', margin: '0 auto' }}>
            {/* Context Technical Schematic Diagram */}
            <WorkshopContextDiagram
              step="backing"
              hasBacking={hasBacking}
              backingType={backingType}
            />

            {/* Backing Option Buttons in Thumb Zone */}
            {[
              {
                id: 'groove',
                title: '🔲 Fondo Ranurado (3 mm)',
                badge: 'Taller profesional',
                desc: 'MDF de 3 mm embutido en ranura a 10 mm del borde posterior. Escuadra perfecta y terminación oculta.',
                onSelect: () => {
                  onHasBackingChange?.(true);
                  onBackingTypeChange?.('groove');
                },
                active: hasBacking && backingType === 'groove',
              },
              {
                id: 'applied-back',
                title: '🔨 Fondo Clavado / Atornillado',
                badge: 'Montaje rápido',
                desc: 'Tablero fijado por detrás con tornillos o clavos perimetrales.',
                onSelect: () => {
                  onHasBackingChange?.(true);
                  onBackingTypeChange?.('overlay');
                },
                active: hasBacking && backingType !== 'groove',
              },
              {
                id: 'none',
                title: '❌ Sin Fondo',
                badge: 'Vanos abiertos',
                desc: 'Mueble abierto por detrás. Necesario para cajas de térmicas, llaves de paso o ventilación.',
                onSelect: () => {
                  onHasBackingChange?.(false);
                  onBackingTypeChange?.('none');
                },
                active: !hasBacking,
              },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  triggerHaptic('major');
                  opt.onSelect();
                }}
                style={{
                  minHeight: '60px',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '14px',
                  border: opt.active
                    ? '2px solid var(--md-sys-color-primary)'
                    : '1px solid var(--md-sys-color-outline-variant)',
                  backgroundColor: opt.active
                    ? 'var(--md-sys-color-primary-container)'
                    : 'var(--md-sys-color-surface-container-high)',
                  color: opt.active
                    ? 'var(--md-sys-color-on-primary-container)'
                    : 'var(--md-sys-color-on-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.94rem', fontWeight: 700 }}>{opt.title}</span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '8px',
                      backgroundColor: opt.active
                        ? 'var(--md-sys-color-primary)'
                        : 'var(--md-sys-color-surface-container-highest)',
                      color: opt.active
                        ? 'var(--md-sys-color-on-primary)'
                        : 'var(--md-sys-color-outline)',
                    }}
                  >
                    {opt.badge}
                  </span>
                </div>
                <span style={{ fontSize: '0.74rem', opacity: 0.85, marginTop: '4px', lineHeight: 1.3 }}>
                  {opt.desc}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* STEP 6: DISTRIBUCIÓN Y EQUIPAMIENTO DE VANOS */}
        {activeStep.id === 'bays-equipment' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.45rem', margin: '0 auto' }}>
            {/* Context Technical Schematic Diagram */}
            <WorkshopContextDiagram
              step="bays-equipment"
              width={width}
              gridType={gridType}
              bays={bays}
              activeBayIndex={activeBayIndex}
            />

            {/* Bay count selection buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem', width: '100%' }}>
              {[
                { type: '1-bay' as ObraGridType, label: '1 Vano', desc: 'Sin división', enabled: true },
                { type: '2-bays-vertical' as ObraGridType, label: '2 Vanos', desc: '1 divisoria', enabled: true },
                {
                  type: '3-bays-vertical' as ObraGridType,
                  label: '3 Vanos',
                  desc: '2 divisorias',
                  enabled: width >= 800,
                },
              ].map((opt) => {
                const isSelected = gridType === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    disabled={!opt.enabled}
                    onClick={() => {
                      triggerHaptic('major');
                      onGridTypeChange?.(opt.type);
                    }}
                    style={{
                      minHeight: '48px',
                      padding: '0.25rem 0.2rem',
                      borderRadius: '12px',
                      border: isSelected
                        ? '2px solid var(--md-sys-color-primary)'
                        : '1px solid var(--md-sys-color-outline-variant)',
                      backgroundColor: isSelected
                        ? 'var(--md-sys-color-primary-container)'
                        : 'var(--md-sys-color-surface-container-high)',
                      color: isSelected
                        ? 'var(--md-sys-color-on-primary-container)'
                        : 'var(--md-sys-color-on-surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: opt.enabled ? 1 : 0.4,
                      cursor: opt.enabled ? 'pointer' : 'not-allowed',
                      textAlign: 'center',
                    }}
                  >
                    <span style={{ fontSize: '0.84rem', fontWeight: 800 }}>{opt.label}</span>
                    <span style={{ fontSize: '0.67rem', opacity: 0.8, marginTop: '1px' }}>{opt.desc}</span>
                  </button>
                );
              })}
            </div>

            {/* Column Selector when safeBayCount > 1 */}
            {safeBayCount > 1 && (
              <div
                style={{
                  padding: '0.4rem 0.5rem',
                  borderRadius: '12px',
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.3rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
                    Columna a equipar:
                  </span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--md-sys-color-primary)' }}>
                    {`Editando Columna ${activeBayIndex + 1} de ${safeBayCount}`}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${safeBayCount}, 1fr)`, gap: '0.35rem' }}>
                  {Array.from({ length: safeBayCount }).map((_, idx) => {
                    const isBayActive = activeBayIndex === idx;
                    const bayObj = bays[idx];
                    const bayIcon =
                      bayObj?.type === 'shelves' ? '📚' :
                      bayObj?.type === 'drawer-stack' ? '🗄️' :
                      bayObj?.type === 'doors' ? '🚪' : '⬜';
                    const bayName =
                      bayObj?.type === 'shelves' ? 'Estantes' :
                      bayObj?.type === 'drawer-stack' ? 'Cajonera' :
                      bayObj?.type === 'doors' ? 'Puertas' : 'Libre';

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          triggerHaptic('tick');
                          onActiveBayIndexChange?.(idx);
                        }}
                        style={{
                          minHeight: '44px',
                          padding: '0.2rem 0.35rem',
                          borderRadius: '10px',
                          border: isBayActive
                            ? '2px solid var(--md-sys-color-primary)'
                            : '1px solid var(--md-sys-color-outline-variant)',
                          backgroundColor: isBayActive
                            ? 'var(--md-sys-color-primary-container)'
                            : 'var(--md-sys-color-surface)',
                          color: isBayActive
                            ? 'var(--md-sys-color-on-primary-container)'
                            : 'var(--md-sys-color-on-surface)',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <span>{`Columna ${idx + 1}`}</span>
                        <span style={{ fontSize: '0.67rem', opacity: 0.85, fontWeight: 500 }}>
                          {`${bayIcon} ${bayName}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Equipment Types (Estantes, Cajonera, Puertas, Vano Libre) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.35rem', width: '100%' }}>
              {[
                { type: 'shelves' as const, label: '📚 Estantes' },
                { type: 'drawer-stack' as const, label: '🗄️ Cajonera' },
                { type: 'doors' as const, label: '🚪 Puerta(s)' },
                { type: 'empty' as const, label: '⬜ Vano Libre' },
              ].map((eq) => {
                const isSelected = currentBay?.type === eq.type;
                return (
                  <button
                    key={eq.type}
                    type="button"
                    onClick={() => {
                      triggerHaptic('major');
                      onBayContentTypeChange?.(activeBayIndex, eq.type);
                    }}
                    style={{
                      minHeight: '44px',
                      borderRadius: '12px',
                      border: isSelected
                        ? '2px solid var(--md-sys-color-primary)'
                        : '1px solid var(--md-sys-color-outline-variant)',
                      backgroundColor: isSelected
                        ? 'var(--md-sys-color-primary-container)'
                        : 'var(--md-sys-color-surface-container-high)',
                      color: isSelected
                        ? 'var(--md-sys-color-on-primary-container)'
                        : 'var(--md-sys-color-on-surface)',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {eq.label}
                  </button>
                );
              })}
            </div>

            {/* Sub-controls based on equipment type */}
            {currentBay?.type === 'shelves' && (
              <div
                style={{
                  padding: '0.55rem 0.65rem',
                  borderRadius: '12px',
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>Cantidad de Estantes:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button
                      type="button"
                      disabled={!currentBay.count || currentBay.count <= 1}
                      onClick={() => {
                        triggerHaptic('tick');
                        onRemoveShelf?.(activeBayIndex);
                      }}
                      style={{
                        minWidth: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        border: '1px solid var(--md-sys-color-outline-variant)',
                        backgroundColor: 'var(--md-sys-color-surface)',
                        fontWeight: 700,
                        fontSize: '1.1rem',
                        cursor: 'pointer',
                      }}
                    >
                      -
                    </button>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, minWidth: '24px', textAlign: 'center' }}>
                      {currentBay.count ?? 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('tick');
                        onAddShelf?.(activeBayIndex);
                      }}
                      style={{
                        minWidth: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        border: '1px solid var(--md-sys-color-outline-variant)',
                        backgroundColor: 'var(--md-sys-color-surface)',
                        fontWeight: 700,
                        fontSize: '1.1rem',
                        cursor: 'pointer',
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Fixed vs Adjustable */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                  {['fixed', 'adjustable'].map((st) => {
                    const isFix = st === 'fixed';
                    const active = (currentBay.shelfType ?? 'adjustable') === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          triggerHaptic('tick');
                          onShelfTypeChange?.(activeBayIndex, st as 'fixed' | 'adjustable');
                        }}
                        style={{
                          height: '38px',
                          borderRadius: '8px',
                          border: active
                            ? '2px solid var(--md-sys-color-primary)'
                            : '1px solid var(--md-sys-color-outline-variant)',
                          backgroundColor: active
                            ? 'var(--md-sys-color-primary-container)'
                            : 'var(--md-sys-color-surface)',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {isFix ? '📌 Estantes Fijos' : '⚙️ Regulables'}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {currentBay?.type === 'drawer-stack' && (
              <div
                style={{
                  padding: '0.55rem 0.65rem',
                  borderRadius: '12px',
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>Cantidad de Cajones:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button
                      type="button"
                      disabled={!currentBay.drawerTracks || currentBay.drawerTracks.length <= 1}
                      onClick={() => {
                        triggerHaptic('tick');
                        const curLen = currentBay.drawerTracks?.length ?? 3;
                        onRemoveDrawer?.(activeBayIndex, curLen - 1);
                      }}
                      style={{
                        minWidth: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        border: '1px solid var(--md-sys-color-outline-variant)',
                        backgroundColor: 'var(--md-sys-color-surface)',
                        fontWeight: 700,
                        fontSize: '1.1rem',
                        cursor: 'pointer',
                      }}
                    >
                      -
                    </button>
                    <span style={{ fontSize: '1.05rem', fontWeight: 800, minWidth: '24px', textAlign: 'center' }}>
                      {currentBay.drawerTracks ? currentBay.drawerTracks.length : 3}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        triggerHaptic('tick');
                        onAddDrawer?.(activeBayIndex);
                      }}
                      style={{
                        minWidth: '40px',
                        height: '40px',
                        borderRadius: '10px',
                        border: '1px solid var(--md-sys-color-outline-variant)',
                        backgroundColor: 'var(--md-sys-color-surface)',
                        fontWeight: 700,
                        fontSize: '1.1rem',
                        cursor: 'pointer',
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )}

            {currentBay?.type === 'doors' && (
              <div
                style={{
                  padding: '0.55rem 0.65rem',
                  borderRadius: '12px',
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem',
                }}
              >
                {/* 1 or 2 Doors */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Hojas de Puerta:</span>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    {[1, 2].map((cnt) => {
                      const isCnt = (currentBay.count ?? 1) === cnt;
                      return (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => {
                            triggerHaptic('tick');
                            onDoorCountChange?.(activeBayIndex, cnt as 1 | 2);
                          }}
                          style={{
                            minWidth: '50px',
                            height: '38px',
                            borderRadius: '8px',
                            border: isCnt
                              ? '2px solid var(--md-sys-color-primary)'
                              : '1px solid var(--md-sys-color-outline-variant)',
                            backgroundColor: isCnt
                              ? 'var(--md-sys-color-primary-container)'
                              : 'var(--md-sys-color-surface)',
                            fontWeight: 700,
                            fontSize: '0.84rem',
                            cursor: 'pointer',
                          }}
                        >
                          {cnt === 1 ? '1 Hoja' : '2 Hojas'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* If 1 Door: Hinge Side Left or Right */}
                {(currentBay.count ?? 1) === 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Lado Bisagras:</span>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      {[
                        { side: 'left' as const, label: '👈 Izquierda' },
                        { side: 'right' as const, label: '👉 Derecha' },
                      ].map((hSide) => {
                        const isSide = (currentBay.hingeSide ?? 'left') === hSide.side;
                        return (
                          <button
                            key={hSide.side}
                            type="button"
                            onClick={() => {
                              triggerHaptic('tick');
                              onDoorHingeSideChange?.(activeBayIndex, hSide.side);
                            }}
                            style={{
                              height: '38px',
                              padding: '0 0.6rem',
                              borderRadius: '8px',
                              border: isSide
                                ? '2px solid var(--md-sys-color-primary)'
                                : '1px solid var(--md-sys-color-outline-variant)',
                              backgroundColor: isSide
                                ? 'var(--md-sys-color-primary-container)'
                                : 'var(--md-sys-color-surface)',
                              color: isSide
                                ? 'var(--md-sys-color-on-primary-container)'
                                : 'var(--md-sys-color-on-surface)',
                              fontWeight: 700,
                              fontSize: '0.82rem',
                              cursor: 'pointer',
                            }}
                          >
                            {hSide.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Interior shelves behind door */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Estantes interiores:</span>
                  <div style={{ display: 'flex', gap: '0.3rem' }}>
                    {[0, 1, 2, 3].map((num) => {
                      const isNum = (currentBay.interiorShelvesCount ?? 0) === num;
                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => {
                            triggerHaptic('tick');
                            onDoorInteriorShelvesCountChange?.(activeBayIndex, num);
                          }}
                          style={{
                            minWidth: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            border: isNum
                              ? '2px solid var(--md-sys-color-primary)'
                              : '1px solid var(--md-sys-color-outline-variant)',
                            backgroundColor: isNum
                              ? 'var(--md-sys-color-primary-container)'
                              : 'var(--md-sys-color-surface)',
                            color: isNum
                              ? 'var(--md-sys-color-on-primary-container)'
                              : 'var(--md-sys-color-on-surface)',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                          }}
                        >
                          {num}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {currentBay?.type === 'empty' && (
              <span style={{ fontSize: '0.78rem', color: 'var(--md-sys-color-outline)', textAlign: 'center', marginTop: '0.35rem' }}>
                Columna sin accesorios interiores (hueco libre).
              </span>
            )}
          </div>
        )}

        {/* STEP 7: MATERIAL / TABLERO DE MELAMINA */}
        {activeStep.id === 'material' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.45rem', margin: '0 auto' }}>
            {/* Context Technical Schematic Diagram */}
            <WorkshopContextDiagram
              step="material"
              materialRole={activeMaterialRole}
            />

            {/* 1. Banner descriptivo del rol activo + Botón de Sincronización con el Casco (at Top) */}
            <div
              style={{
                padding: '0.5rem 0.7rem',
                borderRadius: '12px',
                backgroundColor: 'var(--md-sys-color-surface-container-high)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: 0 }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--md-sys-color-primary)' }}>
                  {activeRoleConfig.icon} {activeRoleConfig.label}
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--md-sys-color-on-surface-variant)',
                    lineHeight: '1.25',
                  }}
                >
                  {activeRoleConfig.description}
                </span>
              </div>

              {effectiveMaterialRole !== 'carcass' && (
                <button
                  type="button"
                  onClick={handleResetRoleToCarcass}
                  title="Restablecer para usar el mismo tablero que el Casco"
                  aria-label="Restablecer para usar la misma placa que el casco"
                  style={{
                    minHeight: '38px',
                    padding: '0 0.55rem',
                    borderRadius: '8px',
                    border: '1px solid var(--md-sys-color-outline)',
                    backgroundColor: 'var(--md-sys-color-surface)',
                    color: 'var(--md-sys-color-primary)',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  🔗 Igual al Casco
                </button>
              )}
            </div>

            {/* 2. Selector Segmentado de Roles (Horizontal Scrollable Chips con >48px touch target) */}
            <div
              role="tablist"
              aria-label="Roles de placa o tablero"
              style={{
                display: 'flex',
                gap: '0.45rem',
                width: '100%',
                overflowX: 'auto',
                paddingBottom: '0.2rem',
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {availableRoles.map((role) => {
                const isActive = effectiveMaterialRole === role.id;
                return (
                  <button
                    key={role.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => {
                      triggerHaptic('tick');
                      setActiveMaterialRole(role.id);
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      justifyContent: 'center',
                      minWidth: '125px',
                      minHeight: '48px',
                      padding: '0.35rem 0.65rem',
                      borderRadius: '12px',
                      border: isActive
                        ? '2px solid var(--md-sys-color-primary)'
                        : '1px solid var(--md-sys-color-outline-variant)',
                      backgroundColor: isActive
                        ? 'var(--md-sys-color-primary-container)'
                        : 'var(--md-sys-color-surface-container)',
                      color: isActive
                        ? 'var(--md-sys-color-on-primary-container)'
                        : 'var(--md-sys-color-on-surface)',
                      cursor: 'pointer',
                      flexShrink: 0,
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <span>{role.icon}</span>
                      <span>{role.shortLabel}</span>
                    </span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        opacity: 0.85,
                        marginTop: '2px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '120px',
                      }}
                    >
                      {role.currentMaterialName}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 3. Grilla Táctil de Placas del Catálogo (Directly at bottom above footer!) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.45rem',
                width: '100%',
              }}
            >
              {materials.map((mat) => {
                const isSelected = currentRoleMaterialId === mat.id;
                return (
                  <button
                    key={mat.id}
                    type="button"
                    onClick={() => handleSelectMaterialForRole(mat.id)}
                    style={{
                      minHeight: '62px',
                      padding: '0.5rem',
                      borderRadius: '14px',
                      border: isSelected
                        ? '2px solid var(--md-sys-color-primary)'
                        : '1px solid var(--md-sys-color-outline-variant)',
                      backgroundColor: isSelected
                        ? 'var(--md-sys-color-primary-container)'
                        : 'var(--md-sys-color-surface-container-high)',
                      color: isSelected
                        ? 'var(--md-sys-color-on-primary-container)'
                        : 'var(--md-sys-color-on-surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      textAlign: 'center',
                      position: 'relative',
                    }}
                  >
                    {isSelected && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '4px',
                          right: '6px',
                          fontSize: '0.8rem',
                          fontWeight: 800,
                          color: 'var(--md-sys-color-primary)',
                        }}
                      >
                        ✓
                      </span>
                    )}
                    <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>{mat.name}</span>
                    <span style={{ fontSize: '0.74rem', opacity: 0.85, marginTop: '2px' }}>
                      {`${mat.thicknessMm} mm · Tablero de taller`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* 3. Ergonomic Bottom Navigation Bar (Single Row ~50px + safe-area) */}
      <footer
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.35rem 0.6rem max(0.35rem, env(safe-area-inset-bottom, 0.35rem))',
          backgroundColor: 'var(--md-sys-color-surface-container)',
          borderTop: '1px solid var(--md-sys-color-outline-variant)',
          flexShrink: 0,
          zIndex: 10,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        <button
          type="button"
          onClick={goToPrevStep}
          disabled={currentStepIndex === 0}
          className="m3-button m3-button--tonal"
          aria-label="Paso anterior (o deslizar hacia abajo)"
          style={{
            flex: 1,
            minHeight: '44px',
            padding: '0 0.35rem',
            borderRadius: '12px',
            fontSize: '0.84rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            opacity: currentStepIndex === 0 ? 0.35 : 1,
          }}
        >
          ◀ Anterior
        </button>

        {/* Persistent 3D Inspector Button */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic('major');
            onView3dClick?.();
          }}
          className={`m3-button ${is3dViewActive ? 'm3-button--tonal' : 'm3-button--filled'}`}
          aria-label={is3dViewActive ? 'Volver al formulario de obra' : 'Ver modelo 3D en pantalla completa'}
          style={{
            flex: 1.25,
            minHeight: '44px',
            padding: '0 0.4rem',
            borderRadius: '12px',
            fontSize: '0.84rem',
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.25rem',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.1)',
          }}
        >
          <span>{is3dViewActive ? '✏️ Volver a Ajustes' : '👁️ Ver Modelo 3D'}</span>
        </button>

        <button
          type="button"
          onClick={goToNextStep}
          disabled={currentStepIndex === OBRA_STEPS.length - 1}
          className="m3-button m3-button--filled"
          aria-label="Siguiente paso (o deslizar hacia arriba)"
          style={{
            flex: 1,
            minHeight: '44px',
            padding: '0 0.35rem',
            borderRadius: '12px',
            fontSize: '0.84rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            opacity: currentStepIndex === OBRA_STEPS.length - 1 ? 0.35 : 1,
          }}
        >
          Siguiente ▶
        </button>
      </footer>
    </section>
  );
}
