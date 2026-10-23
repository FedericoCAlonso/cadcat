import {
  type ReactElement,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { type HandMode, triggerHaptic } from '../resolver/thumbArc';
import { ThumbArcInput } from './ThumbArcInput';
import { WorkshopContextDiagram, type WorkshopStepId } from './WorkshopContextDiagram';
import { DEFAULT_UI_CONFIG } from '../config';
import { type ProjectModuleItem } from '../model/project';
import { type Material } from '../model/material';
import {
  DEFAULT_STANDARD_THICKNESSES_MM,
  getMaterialThicknessMm,
  listThicknessOptions,
  filterMaterialsByThickness,
} from '../model/standardThickness';
import { type RoofType, type BackingType, type BayContent, type BayBoundingBox } from '../resolver';
import { resolveBackingReserveMm } from '../resolver/composition/backingReserve';
import { BayDistributionModal } from './BayDistributionModal';

export type ObraGridType = '1-bay' | '2-bays-vertical' | '3-bays-vertical' | '2-bays-horizontal';
export type ObraBayContentType = 'empty' | 'shelves' | 'drawer-stack' | 'doors' | 'pull-out-tray' | 'bi-fold-closure' | 'subdivided';

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
  backingThicknessMm?: number;
  onHasBackingChange?: (val: boolean) => void;
  onBackingTypeChange?: (val: BackingType) => void;
  onBackingThicknessChange?: (val: number) => void;

  // Bays / Grid
  gridType?: ObraGridType;
  bays?: BayContent[];
  bayBoxes?: BayBoundingBox[];
  activeBayIndex?: number;
  onGridTypeChange?: (grid: ObraGridType) => void;
  onActiveBayIndexChange?: (idx: number) => void;

  // Bay content actions
  onBayContentTypeChange?: (bayIdx: number, type: ObraBayContentType) => void;
  onBayContentChange?: (bayIdx: number, content: BayContent) => void;
  onAddShelf?: (bayIdx: number) => void;
  onRemoveShelf?: (bayIdx: number, shelfIdx?: number) => void;
  onShelfTypeChange?: (bayIdx: number, type: 'fixed' | 'adjustable') => void;
  onAddDrawer?: (bayIdx: number) => void;
  onRemoveDrawer?: (bayIdx: number, drawerIdx?: number) => void;
  onDoorCountChange?: (bayIdx: number, count: 1 | 2) => void;
  onDoorHingeSideChange?: (bayIdx: number, hingeSide: 'left' | 'right') => void;
  onDoorInteriorShelvesCountChange?: (bayIdx: number, count: number) => void;

  // Materials & Standard Thicknesses
  materials?: Material[];
  standardThicknessesMm?: readonly number[];
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
  id: WorkshopStepId;
  stepNumber: number;
  title: string;
  shortTitle: string;
  subtitle: string;
}

export type MaterialRole = 'carcass' | 'fronts' | 'drawers' | 'backing';

/**
 * Reorganized 7 coherent workshop stages:
 * 1. Módulo y Tipo -> 2. Medidas Principales -> 3. Placas y Espesores ->
 * 4. Base y Techo -> 5. Fondo Trasero -> 6. División de Vanos -> 7. Equipamiento Interior
 */
export const OBRA_STEPS: ObraStepDefinition[] = [
  {
    id: 'module-type',
    stepNumber: 1,
    title: 'Módulo y Tipo',
    shortTitle: 'Tipo',
    subtitle: 'Seleccioná el mueble o plantilla a relevar',
  },
  {
    id: 'dimensions',
    stepNumber: 2,
    title: 'Medidas Principales',
    shortTitle: 'Medidas',
    subtitle: 'Ancho, alto, profundidad exterior y espesor base',
  },
  {
    id: 'material',
    stepNumber: 3,
    title: 'Placas y Espesores',
    shortTitle: 'Placas',
    subtitle: 'Espesor estándar y tablero para casco, frentes, cajones y fondos',
  },
  {
    id: 'base-roof',
    stepNumber: 4,
    title: 'Base y Techo',
    shortTitle: 'Casco',
    subtitle: 'Apoyo inferior (zócalo/piso/colgado) y cierre superior (tapa/fajas)',
  },
  {
    id: 'backing',
    stepNumber: 5,
    title: 'Fondo Trasero',
    shortTitle: 'Fondo',
    subtitle: 'Anclaje de fondo por vano, espesor y profundidad útil interior',
  },
  {
    id: 'bays-grid',
    stepNumber: 6,
    title: 'División de Vanos',
    shortTitle: 'Vanos',
    subtitle: 'Cantidad de columnas de izquierda a derecha y matriz especial',
  },
  {
    id: 'bays-equipment',
    stepNumber: 7,
    title: 'Equipamiento Interior',
    shortTitle: 'Interior',
    subtitle: 'Estantes, cajonera, puertas y accesorios para cada vano',
  },
];

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
  backingThicknessMm = 3,
  onHasBackingChange,
  onBackingTypeChange,
  onBackingThicknessChange,
  gridType = '1-bay',
  bays = [],
  bayBoxes = [],
  activeBayIndex = 0,
  onGridTypeChange,
  onActiveBayIndexChange,
  onBayContentTypeChange,
  onBayContentChange,
  onAddShelf,
  onRemoveShelf,
  onShelfTypeChange,
  onAddDrawer,
  onRemoveDrawer,
  onDoorCountChange,
  onDoorHingeSideChange,
  onDoorInteriorShelvesCountChange,
  materials = [],
  standardThicknessesMm = DEFAULT_STANDARD_THICKNESSES_MM,
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
  const [activeShellZone, setActiveShellZone] = useState<'base' | 'roof'>('base');
  const [isDistributionModalOpen, setIsDistributionModalOpen] = useState<boolean>(false);
  const [roleThicknessFilterMm, setRoleThicknessFilterMm] = useState<number | null>(null);

  const backingReserveMm = useMemo(
    () =>
      resolveBackingReserveMm({
        hasBacking,
        backingType,
        backingThicknessMm,
      }),
    [hasBacking, backingType, backingThicknessMm],
  );
  const usableDepthMm = useMemo(
    () => Math.max(1, Math.round((depth - backingReserveMm) * 10) / 10),
    [depth, backingReserveMm],
  );

  const activeBayBox = bayBoxes[activeBayIndex];
  const activeBayWidth = activeBayBox?.width ?? Math.max(100, Math.round(width - 2 * thickness));
  const activeBayHeight =
    activeBayBox?.height ??
    Math.max(100, Math.round(height - 2 * thickness - (hasPlinth && !hasWallHangingRail ? plinthHeightMm : 0)));
  const activeBayDepth = activeBayBox?.depth ?? usableDepthMm;

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
  const dimensionFieldsList = useMemo<
    Array<{ id: DimensionSubField; label: string; shortLabel: string; value: number }>
  >(
    () => [
      { id: 'width', label: 'Ancho Total', shortLabel: 'Ancho', value: width },
      { id: 'height', label: 'Alto Total', shortLabel: 'Alto', value: height },
      { id: 'depth', label: 'Profundidad', shortLabel: 'Prof.', value: depth },
      { id: 'thickness', label: 'Espesor Placa', shortLabel: 'Espesor', value: thickness },
    ],
    [width, height, depth, thickness],
  );

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

  // Contextual role detection for multi-role materials (Step 3)
  const [activeMaterialRole, setActiveMaterialRole] = useState<MaterialRole>('carcass');

  const availableRoles = useMemo(() => {
    const carcassMat = materials.find((m) => m.id === selectedMaterialId);
    const frontsMat = materials.find((m) => m.id === (frontsMaterialId || selectedMaterialId));
    const drawersMat = materials.find((m) => m.id === (drawerBoxesMaterialId || selectedMaterialId));
    const backingsMat = materials.find((m) => m.id === (backingsMaterialId || selectedMaterialId));

    const list: Array<{
      id: MaterialRole;
      label: string;
      shortLabel: string;
      icon: string;
      description: string;
      currentMaterialName: string;
      currentThicknessMm: number;
      isInherited: boolean;
    }> = [
      {
        id: 'carcass',
        label: 'Casco / Estructura',
        shortLabel: 'Casco',
        icon: '🏛️',
        description: 'Placa principal para laterales, piso, techo, divisorias y estantes.',
        currentMaterialName: carcassMat?.name ?? 'Sin seleccionar',
        currentThicknessMm: getMaterialThicknessMm(carcassMat) ?? thickness,
        isInherited: false,
      },
      {
        id: 'fronts',
        label: 'Frentes y Puertas',
        shortLabel: 'Frentes',
        icon: '🚪',
        description: 'Placa exterior para hojas de puerta y tapas frontales de cajón.',
        currentMaterialName: frontsMaterialId
          ? (frontsMat?.name ?? 'Personalizado')
          : `Igual al Casco (${frontsMat?.name ?? ''})`,
        currentThicknessMm: getMaterialThicknessMm(frontsMat) ?? thickness,
        isInherited: !frontsMaterialId,
      },
      {
        id: 'drawers',
        label: 'Cajas de Cajones',
        shortLabel: 'Cajones',
        icon: '🗄️',
        description: 'Placa para laterales, contrafrentes y traseras de cajones interiores.',
        currentMaterialName: drawerBoxesMaterialId
          ? (drawersMat?.name ?? 'Personalizado')
          : `Igual al Casco (${drawersMat?.name ?? ''})`,
        currentThicknessMm: getMaterialThicknessMm(drawersMat) ?? thickness,
        isInherited: !drawerBoxesMaterialId,
      },
      {
        id: 'backing',
        label: 'Fondos y Traseras',
        shortLabel: 'Fondos',
        icon: '🪵',
        description: 'Placa para fondos del mueble (por vano) y fondos de cajón.',
        currentMaterialName: backingsMat?.name ?? `${backingThicknessMm} mm`,
        currentThicknessMm: getMaterialThicknessMm(backingsMat) ?? backingThicknessMm,
        isInherited: !backingsMaterialId || backingsMaterialId === selectedMaterialId,
      },
    ];

    return list;
  }, [
    materials,
    selectedMaterialId,
    frontsMaterialId,
    drawerBoxesMaterialId,
    backingsMaterialId,
    thickness,
    backingThicknessMm,
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

  const thicknessOptions = useMemo(
    () => listThicknessOptions(materials, standardThicknessesMm),
    [materials, standardThicknessesMm],
  );

  const filteredRoleMaterials = useMemo(() => {
    if (roleThicknessFilterMm === null) return materials;
    const matches = filterMaterialsByThickness(materials, roleThicknessFilterMm);
    return matches.length > 0 ? matches : materials;
  }, [materials, roleThicknessFilterMm]);

  const handleSelectMaterialForRole = useCallback(
    (matId: string) => {
      triggerHaptic('major');
      const chosenMat = materials.find((m) => m.id === matId);
      const chosenThickness = getMaterialThicknessMm(chosenMat);

      switch (effectiveMaterialRole) {
        case 'fronts':
          onFrontsMaterialChange?.(matId);
          break;
        case 'drawers':
          onDrawerBoxesMaterialChange?.(matId);
          break;
        case 'backing':
          onBackingsMaterialChange?.(matId);
          if (chosenThickness !== undefined) {
            onBackingThicknessChange?.(chosenThickness);
          }
          break;
        case 'carcass':
        default:
          onMaterialChange?.(matId);
          if (chosenThickness !== undefined) {
            onThicknessChange?.(chosenThickness);
          }
          break;
      }
    },
    [
      effectiveMaterialRole,
      materials,
      onMaterialChange,
      onThicknessChange,
      onFrontsMaterialChange,
      onDrawerBoxesMaterialChange,
      onBackingsMaterialChange,
      onBackingThicknessChange,
    ],
  );

  const handleSelectThicknessChipForRole = useCallback(
    (thMm: number | null) => {
      triggerHaptic('tick');
      setRoleThicknessFilterMm(thMm);
      if (thMm === null) return;

      if (effectiveMaterialRole === 'backing') {
        onBackingThicknessChange?.(thMm);
      } else if (effectiveMaterialRole === 'carcass') {
        onThicknessChange?.(thMm);
      }

      const matches = filterMaterialsByThickness(materials, thMm);
      if (matches.length > 0 && !matches.some((m) => m.id === currentRoleMaterialId)) {
        const firstMatch = matches[0]!;
        switch (effectiveMaterialRole) {
          case 'fronts':
            onFrontsMaterialChange?.(firstMatch.id);
            break;
          case 'drawers':
            onDrawerBoxesMaterialChange?.(firstMatch.id);
            break;
          case 'backing':
            onBackingsMaterialChange?.(firstMatch.id);
            break;
          case 'carcass':
          default:
            onMaterialChange?.(firstMatch.id);
            break;
        }
      }
    },
    [
      effectiveMaterialRole,
      materials,
      currentRoleMaterialId,
      onBackingThicknessChange,
      onThicknessChange,
      onFrontsMaterialChange,
      onDrawerBoxesMaterialChange,
      onBackingsMaterialChange,
      onMaterialChange,
    ],
  );

  const handleResetRoleToCarcass = useCallback(() => {
    triggerHaptic('tick');
    setRoleThicknessFilterMm(null);
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

          {/* Right Controls: Edición Especial, Hand Mode Toggle & Expert Mode Switch */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('major');
                setIsDistributionModalOpen(true);
              }}
              aria-label="Edición especial de vanos (matriz de celdas)"
              title="Abrir editor de distribución compleja y matriz de celdas estilo Word"
              className="m3-button m3-button--tonal"
              style={{
                height: '34px',
                padding: '0 0.55rem',
                borderRadius: '10px',
                fontSize: '0.76rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.2rem',
                backgroundColor:
                  currentBay?.type === 'subdivided'
                    ? 'var(--md-sys-color-primary-container)'
                    : 'var(--md-sys-color-surface-container-high)',
                border:
                  currentBay?.type === 'subdivided'
                    ? '1.5px solid var(--md-sys-color-primary)'
                    : '1px solid var(--md-sys-color-outline-variant)',
                color:
                  currentBay?.type === 'subdivided'
                    ? 'var(--md-sys-color-on-primary-container)'
                    : 'var(--md-sys-color-on-surface)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <span>🍱</span>
              <span>Especial</span>
            </button>

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

        {/* Row 2: Step Title Context & Interactive Stepper Pills */}
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

          {/* Interactive Step Progress Dots */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
            {OBRA_STEPS.map((s, idx) => (
              <span
                key={s.id}
                role="presentation"
                onClick={() => {
                  triggerHaptic('tick');
                  setCurrentStepIndex(idx);
                }}
                title={`Ir a Paso ${s.stepNumber}: ${s.title}`}
                style={{
                  width: idx === currentStepIndex ? '16px' : '6px',
                  height: '6px',
                  borderRadius: '3px',
                  backgroundColor:
                    idx === currentStepIndex
                      ? 'var(--md-sys-color-primary)'
                      : idx < currentStepIndex
                        ? 'var(--md-sys-color-secondary)'
                        : 'var(--md-sys-color-outline-variant)',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer',
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
          justifyContent: 'flex-end',
          padding: '0.3rem 0.6rem',
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          boxSizing: 'border-box',
          width: '100%',
        }}
      >
        {/* Step Subtitle / Accessibility Header */}
        <div style={{ width: '100%', textAlign: 'center', marginBottom: '0.2rem' }}>
          <h2 className="visually-hidden">{activeStep.title}</h2>
          <p
            style={{
              margin: '0',
              fontSize: '0.74rem',
              color: 'var(--md-sys-color-outline)',
            }}
          >
            {activeStep.subtitle}
          </p>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            ETAPA 1: MÓDULO Y TIPO (PLANTILLA)
           ───────────────────────────────────────────────────────────── */}
        {activeStep.id === 'module-type' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.45rem', marginTop: 'auto' }}>
            <WorkshopContextDiagram
              step="module-type"
              selectedTemplateId={selectedTemplateId}
              width={width}
              height={height}
              depth={depth}
              plinthHeightMm={plinthHeightMm}
            />

            <div style={{ marginTop: '0.1rem' }}>
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--md-sys-color-primary)',
                  display: 'block',
                  marginBottom: '0.35rem',
                }}
              >
                Seleccionar Plantilla de Taller:
              </span>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '0.45rem',
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
                        minHeight: '58px',
                        padding: '0.45rem 0.5rem',
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
                      }}
                    >
                      <span style={{ fontSize: '0.86rem', fontWeight: 700 }}>
                        {tpl.name.includes('Alacena')
                          ? '🧗 '
                          : tpl.name.includes('Cajonera')
                            ? '🗄️ '
                            : tpl.name.includes('Torre')
                              ? '🏛️ '
                              : tpl.name.includes('Puerta')
                                ? '🚪 '
                                : '🪵 '}
                        {tpl.name}
                      </span>
                      {tpl.category && (
                        <span style={{ fontSize: '0.7rem', opacity: 0.8, marginTop: '2px' }}>
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

        {/* ─────────────────────────────────────────────────────────────
            ETAPA 2: MEDIDAS PRINCIPALES
           ───────────────────────────────────────────────────────────── */}
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
            <WorkshopContextDiagram
              step="dimensions"
              width={width}
              height={height}
              depth={depth}
              thickness={thickness}
              hasPlinth={hasPlinth}
              plinthHeightMm={plinthHeightMm}
              hasWallHangingRail={hasWallHangingRail}
              hasBacking={hasBacking}
              backingType={backingType}
              backingThicknessMm={backingThicknessMm}
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
                  minWidth: '44px',
                  width: '44px',
                  height: '44px',
                  minHeight: '44px',
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
                  {dimensionField === 'depth' && `Profundidad exterior (útil interior: ${usableDepthMm} mm)`}
                  {dimensionField === 'thickness' && 'Espesor nominal del tablero estructural'}
                </span>
              </div>

              <button
                type="button"
                onClick={goToNextDimension}
                aria-label="Medida siguiente"
                title="Medida siguiente"
                className="m3-button m3-button--tonal"
                style={{
                  minWidth: '44px',
                  width: '44px',
                  height: '44px',
                  minHeight: '44px',
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

            {/* Active Dimension Tactile Controls */}
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
                  min={3}
                  max={30}
                  step={1}
                  coarseStep={3}
                  unit="mm"
                  helpText="Espesor nominal del tablero (estándar: 3, 6, 9, 15, 18, 25 mm)."
                  handMode={handMode}
                  onHandModeChange={onHandModeChange}
                  quickPresets={[...standardThicknessesMm]}
                  compact={true}
                  showArc={false}
                />
              )}
            </div>

            {/* Bottom 4-Dimension Segmented Overview Bar */}
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

        {/* ─────────────────────────────────────────────────────────────
            ETAPA 3: PLACAS Y ESPESORES (Sincronización automática espesor <-> placa)
           ───────────────────────────────────────────────────────────── */}
        {activeStep.id === 'material' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.4rem', margin: '0 auto' }}>
            <WorkshopContextDiagram
              step="material"
              materialRole={effectiveMaterialRole}
              onSelectMaterialRole={(role) => {
                triggerHaptic('tick');
                setActiveMaterialRole(role);
                setRoleThicknessFilterMm(null);
              }}
              thickness={thickness}
              backingThicknessMm={backingThicknessMm}
              activeMaterialName={activeRoleConfig.currentMaterialName}
              activeRoleThicknessMm={activeRoleConfig.currentThicknessMm}
            />

            {/* 1. Banner descriptivo del rol activo + Botón Igual al Casco */}
            <div
              style={{
                padding: '0.45rem 0.65rem',
                borderRadius: '12px',
                backgroundColor: 'var(--md-sys-color-surface-container-high)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', minWidth: 0 }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--md-sys-color-primary)' }}>
                  {activeRoleConfig.icon} {activeRoleConfig.label} ({activeRoleConfig.currentThicknessMm} mm)
                </span>
                <span
                  style={{
                    fontSize: '0.7rem',
                    color: 'var(--md-sys-color-on-surface-variant)',
                    lineHeight: '1.2',
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
                    minHeight: '40px',
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

            {/* 2. Selector Segmentado de Roles (Casco, Frentes, Cajones, Fondos) */}
            <div
              role="tablist"
              aria-label="Roles de placa o tablero"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '0.35rem',
                width: '100%',
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
                      setRoleThicknessFilterMm(null);
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: '48px',
                      padding: '0.3rem 0.25rem',
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
                      textAlign: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.2rem',
                      }}
                    >
                      <span>{role.icon}</span>
                      <span>{role.shortLabel}</span>
                    </span>
                    <span
                      style={{
                        fontSize: '0.66rem',
                        opacity: 0.85,
                        marginTop: '1px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%',
                      }}
                    >
                      {`${role.currentThicknessMm}mm · ${role.currentMaterialName}`}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 3. Filtro de Espesores Estándar (Primero estándar, luego catálogo) */}
            <div
              role="group"
              aria-label="Filtrar placas por espesor estándar"
              style={{
                display: 'flex',
                gap: '0.3rem',
                overflowX: 'auto',
                paddingBottom: '0.1rem',
                scrollbarWidth: 'none',
              }}
            >
              <button
                type="button"
                onClick={() => handleSelectThicknessChipForRole(null)}
                style={{
                  minHeight: '38px',
                  padding: '0 0.55rem',
                  borderRadius: '10px',
                  border:
                    roleThicknessFilterMm === null
                      ? '2px solid var(--md-sys-color-primary)'
                      : '1px solid var(--md-sys-color-outline-variant)',
                  backgroundColor:
                    roleThicknessFilterMm === null
                      ? 'var(--md-sys-color-primary-container)'
                      : 'var(--md-sys-color-surface)',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                Todos los espesores
              </button>
              {thicknessOptions.map((thMm) => {
                const isSelected = roleThicknessFilterMm === thMm;
                const isStd = standardThicknessesMm.includes(thMm);
                return (
                  <button
                    key={thMm}
                    type="button"
                    onClick={() => handleSelectThicknessChipForRole(thMm)}
                    style={{
                      minHeight: '38px',
                      padding: '0 0.55rem',
                      borderRadius: '10px',
                      border: isSelected
                        ? '2px solid var(--md-sys-color-primary)'
                        : '1px solid var(--md-sys-color-outline-variant)',
                      backgroundColor: isSelected
                        ? 'var(--md-sys-color-primary-container)'
                        : 'var(--md-sys-color-surface)',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                    }}
                  >
                    {`${thMm} mm${isStd ? ' ★' : ''}`}
                  </button>
                );
              })}
            </div>

            {/* 4. Grilla Táctil de Placas del Catálogo */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.4rem',
                width: '100%',
              }}
            >
              {filteredRoleMaterials.map((mat) => {
                const isSelected = currentRoleMaterialId === mat.id;
                const matThickness = getMaterialThicknessMm(mat);
                return (
                  <button
                    key={mat.id}
                    type="button"
                    onClick={() => handleSelectMaterialForRole(mat.id)}
                    style={{
                      minHeight: '56px',
                      padding: '0.45rem',
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
                    <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{mat.name}</span>
                    <span style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: '2px' }}>
                      {`${matThickness ?? 18} mm · Tablero de taller`}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            ETAPA 4: BASE Y TECHO (Armazón Inferior y Cierre Superior)
           ───────────────────────────────────────────────────────────── */}
        {activeStep.id === 'base-roof' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.4rem', margin: '0 auto' }}>
            <WorkshopContextDiagram
              step="base-roof"
              hasPlinth={hasPlinth}
              plinthHeightMm={plinthHeightMm}
              hasWallHangingRail={hasWallHangingRail}
              roofType={roofType}
              height={height}
              thickness={thickness}
              activeShellZone={activeShellZone}
              onSelectShellZone={(zone) => {
                triggerHaptic('tick');
                setActiveShellZone(zone);
              }}
              selectedTemplateId={selectedTemplateId}
            />

            {/* Bloque 1: Base / Apoyo Inferior */}
            <fieldset
              style={{
                border: '1px solid var(--md-sys-color-outline-variant)',
                borderRadius: '14px',
                padding: '0.4rem 0.5rem',
                margin: 0,
                backgroundColor: 'var(--md-sys-color-surface-container-low)',
              }}
            >
              <legend
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: 'var(--md-sys-color-primary)',
                  padding: '0 0.35rem',
                }}
              >
                1. Base / Apoyo Inferior
              </legend>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem' }}>
                {[
                  {
                    id: 'plinth-integrated',
                    label: '🪚 Con Zócalo / Plinto',
                    sub: `${plinthHeightMm} mm retraído`,
                    active: hasPlinth && !hasWallHangingRail,
                    onSelect: () => {
                      setActiveShellZone('base');
                      onHasPlinthChange?.(true);
                      onHasWallHangingRailChange?.(false);
                    },
                  },
                  {
                    id: 'floor-direct',
                    label: '🪵 Apoyo Directo al Piso',
                    sub: 'Regatón sanitario',
                    active: !hasPlinth && !hasWallHangingRail,
                    onSelect: () => {
                      setActiveShellZone('base');
                      onHasPlinthChange?.(false);
                      onHasWallHangingRailChange?.(false);
                    },
                  },
                  {
                    id: 'wall-hanging',
                    label: '🧗 Suspendido / Flotante',
                    sub: 'Alacena a pared',
                    active: hasWallHangingRail || (!hasPlinth && selectedTemplateId.includes('wall')),
                    onSelect: () => {
                      setActiveShellZone('base');
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
                      minHeight: '54px',
                      padding: '0.35rem 0.3rem',
                      borderRadius: '12px',
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
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, lineHeight: 1.2 }}>{opt.label}</span>
                    <span style={{ fontSize: '0.66rem', opacity: 0.85, marginTop: '2px' }}>{opt.sub}</span>
                  </button>
                ))}
              </div>

              {hasPlinth && !hasWallHangingRail && onPlinthHeightChange && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.3rem', marginTop: '0.35rem' }}>
                  {[80, 100, 120, 150].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                        triggerHaptic('tick');
                        onPlinthHeightChange(h);
                      }}
                      style={{
                        minHeight: '38px',
                        borderRadius: '8px',
                        border:
                          plinthHeightMm === h
                            ? '2px solid var(--md-sys-color-primary)'
                            : '1px solid var(--md-sys-color-outline-variant)',
                        backgroundColor:
                          plinthHeightMm === h
                            ? 'var(--md-sys-color-primary-container)'
                            : 'var(--md-sys-color-surface)',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                      }}
                    >
                      {`Zócalo ${h}mm`}
                    </button>
                  ))}
                </div>
              )}
            </fieldset>

            {/* Bloque 2: Techo / Amarres Superiores */}
            <fieldset
              style={{
                border: '1px solid var(--md-sys-color-outline-variant)',
                borderRadius: '14px',
                padding: '0.4rem 0.5rem',
                margin: 0,
                backgroundColor: 'var(--md-sys-color-surface-container-low)',
              }}
            >
              <legend
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: 'var(--md-sys-color-primary)',
                  padding: '0 0.35rem',
                }}
              >
                2. Techo / Amarres Superiores
              </legend>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.35rem' }}>
                {[
                  {
                    id: 'solid-panel',
                    roof: 'solid-panel' as RoofType,
                    title: '🪵 Tapa Ciega Completa',
                    badge: 'Cerrado 18mm',
                  },
                  {
                    id: 'none',
                    roof: 'none' as RoofType,
                    title: '🚫 Sin Tapa (Hasta el Techo)',
                    badge: 'Anti-mugre',
                  },
                  {
                    id: 'front-back-rails',
                    roof: 'front-back-rails' as RoofType,
                    title: '📏 2 Fajas de Amarre',
                    badge: 'Bajo mesada',
                  },
                ].map((opt) => {
                  const isSelected = roofType === opt.roof;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic('major');
                        setActiveShellZone('roof');
                        onRoofTypeChange?.(opt.roof);
                      }}
                      style={{
                        minHeight: '56px',
                        padding: '0.35rem 0.3rem',
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
                        textAlign: 'center',
                      }}
                    >
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, lineHeight: 1.2 }}>{opt.title}</span>
                      <span style={{ fontSize: '0.66rem', opacity: 0.85, marginTop: '2px' }}>{opt.badge}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            ETAPA 5: FONDO TRASERO (Con reserva de fondo y espesor en vivo)
           ───────────────────────────────────────────────────────────── */}
        {activeStep.id === 'backing' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.4rem', margin: '0 auto' }}>
            <WorkshopContextDiagram
              step="backing"
              depth={depth}
              hasBacking={hasBacking}
              backingType={backingType}
              backingThicknessMm={backingThicknessMm}
              gridType={gridType}
            />

            {/* Opciones de Anclaje de Fondo */}
            {[
              {
                id: 'groove',
                title: `🔲 Fondo Ranurado (${backingThicknessMm} mm)`,
                badge: 'Taller profesional',
                desc: `Embutido en ranura. Descuenta ranura + placa (-${backingReserveMm} mm) → Prof. útil: ${usableDepthMm} mm.`,
                onSelect: () => {
                  onHasBackingChange?.(true);
                  onBackingTypeChange?.('groove');
                },
                active: hasBacking && backingType === 'groove',
              },
              {
                id: 'applied-back',
                title: `🔨 Fondo Clavado / Atornillado (${backingThicknessMm} mm)`,
                badge: 'Montaje rápido',
                desc: `Fijado por detrás a tope. Descuenta espesor de fondo → Prof. útil: ${Math.max(1, depth - backingThicknessMm)} mm.`,
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
                desc: `Mueble abierto por detrás para instalaciones o paso libre (${depth} mm útiles).`,
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
                  minHeight: '56px',
                  padding: '0.5rem 0.75rem',
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
                  <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>{opt.title}</span>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '0.12rem 0.45rem',
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
                <span style={{ fontSize: '0.72rem', opacity: 0.88, marginTop: '3px', lineHeight: 1.25 }}>
                  {opt.desc}
                </span>
              </button>
            ))}

            {/* Selector rápido de espesor de fondo cuando hasBacking está activo */}
            {hasBacking && (
              <div
                style={{
                  padding: '0.45rem 0.6rem',
                  borderRadius: '12px',
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>Espesor de Placa de Fondo:</span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--md-sys-color-primary)' }}>
                    {`${backingThicknessMm} mm · Prof. útil: ${usableDepthMm} mm`}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.3rem' }}>
                  {[3, 5.5, 6, 18].map((th) => {
                    const isTh = Math.abs(backingThicknessMm - th) < 0.1;
                    return (
                      <button
                        key={th}
                        type="button"
                        onClick={() => {
                          triggerHaptic('tick');
                          onBackingThicknessChange?.(th);
                          const match = filterMaterialsByThickness(materials, th)[0];
                          if (match) {
                            onBackingsMaterialChange?.(match.id);
                          }
                        }}
                        style={{
                          minHeight: '42px',
                          borderRadius: '10px',
                          border: isTh
                            ? '2px solid var(--md-sys-color-primary)'
                            : '1px solid var(--md-sys-color-outline-variant)',
                          backgroundColor: isTh
                            ? 'var(--md-sys-color-primary-container)'
                            : 'var(--md-sys-color-surface)',
                          fontWeight: 700,
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                        }}
                      >
                        {th === 18 ? '18mm Est.' : `${th} mm`}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            ETAPA 6: DIVISIÓN DE VANOS (Grilla occidental Izquierda a Derecha)
           ───────────────────────────────────────────────────────────── */}
        {activeStep.id === 'bays-grid' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.45rem', margin: '0 auto' }}>
            <WorkshopContextDiagram
              step="bays-grid"
              width={width}
              height={height}
              depth={depth}
              thickness={thickness}
              hasPlinth={hasPlinth}
              plinthHeightMm={plinthHeightMm}
              hasWallHangingRail={hasWallHangingRail}
              hasBacking={hasBacking}
              backingType={backingType}
              backingThicknessMm={backingThicknessMm}
              gridType={gridType}
              bays={bays}
              bayBoxes={bayBoxes}
              activeBayIndex={activeBayIndex}
              onSelectBayIndex={(idx) => {
                triggerHaptic('tick');
                onActiveBayIndexChange?.(idx);
              }}
            />

            {/* Selección de Cantidad de Vanos */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', width: '100%' }}>
              {[
                { type: '1-bay' as ObraGridType, label: '1 Vano', desc: 'Sin divisoria · 1 Fondo', enabled: true },
                { type: '2-bays-vertical' as ObraGridType, label: '2 Vanos', desc: 'Izq + Der · 2 Fondos', enabled: true },
                {
                  type: '3-bays-vertical' as ObraGridType,
                  label: '3 Vanos',
                  desc: '3 Columnas · 3 Fondos',
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
                      minHeight: '56px',
                      padding: '0.35rem 0.25rem',
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
                      opacity: opt.enabled ? 1 : 0.4,
                      cursor: opt.enabled ? 'pointer' : 'not-allowed',
                      textAlign: 'center',
                    }}
                  >
                    <span style={{ fontSize: '0.9rem', fontWeight: 800 }}>{opt.label}</span>
                    <span style={{ fontSize: '0.68rem', opacity: 0.85, marginTop: '2px' }}>{opt.desc}</span>
                  </button>
                );
              })}
            </div>

            {/* Tarjetas de selección de Vano (Orden Occidental: Vano 1 Izquierda -> Derecha) */}
            <div
              style={{
                padding: '0.45rem 0.55rem',
                borderRadius: '12px',
                backgroundColor: 'var(--md-sys-color-surface-container)',
                border: '1px solid var(--md-sys-color-outline-variant)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>
                  Vanos (Izquierda a Derecha):
                </span>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--md-sys-color-primary)' }}>
                  {`Vano ${activeBayIndex + 1} seleccionado (${activeBayWidth}×${activeBayHeight}×${activeBayDepth} mm)`}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${safeBayCount}, 1fr)`, gap: '0.35rem' }}>
                {Array.from({ length: safeBayCount }).map((_, idx) => {
                  const isBayActive = activeBayIndex === idx;
                  const box = bayBoxes[idx];
                  const bw = box?.width ?? Math.round((width - (safeBayCount + 1) * thickness) / safeBayCount);
                  const posLabel =
                    safeBayCount === 1
                      ? 'Único'
                      : idx === 0
                        ? 'Izquierda'
                        : idx === safeBayCount - 1
                          ? 'Derecha'
                          : 'Centro';

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        triggerHaptic('tick');
                        onActiveBayIndexChange?.(idx);
                      }}
                      style={{
                        minHeight: '48px',
                        padding: '0.25rem 0.35rem',
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
                      <span>{`Vano ${idx + 1} (${posLabel})`}</span>
                      <span style={{ fontSize: '0.68rem', opacity: 0.85, fontWeight: 600 }}>
                        {`Luz: ${bw} mm`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Acceso directo a Matriz de Subdivisión Especial */}
            <button
              type="button"
              onClick={() => {
                triggerHaptic('major');
                setIsDistributionModalOpen(true);
              }}
              style={{
                minHeight: '48px',
                width: '100%',
                borderRadius: '12px',
                border:
                  currentBay?.type === 'subdivided'
                    ? '2px solid var(--md-sys-color-primary)'
                    : '1px solid var(--md-sys-color-outline-variant)',
                backgroundColor:
                  currentBay?.type === 'subdivided'
                    ? 'var(--md-sys-color-primary-container)'
                    : 'var(--md-sys-color-surface-container-high)',
                color:
                  currentBay?.type === 'subdivided'
                    ? 'var(--md-sys-color-on-primary-container)'
                    : 'var(--md-sys-color-on-surface)',
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}
            >
              <span>🍱</span>
              <span>{`Abrir Edición Especial (Matriz) en Vano ${activeBayIndex + 1}`}</span>
            </button>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            ETAPA 7: EQUIPAMIENTO INTERIOR POR VANO
           ───────────────────────────────────────────────────────────── */}
        {activeStep.id === 'bays-equipment' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.4rem', margin: '0 auto' }}>
            <WorkshopContextDiagram
              step="bays-equipment"
              width={width}
              gridType={gridType}
              bays={bays}
              bayBoxes={bayBoxes}
              activeBayIndex={activeBayIndex}
              onSelectBayIndex={(idx) => {
                triggerHaptic('tick');
                onActiveBayIndexChange?.(idx);
              }}
            />

            {/* Quick Bay Count + Active Column Bar */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.3rem',
                width: '100%',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.3rem', width: '100%' }}>
                {[
                  { type: '1-bay' as ObraGridType, label: '1 Vano', enabled: true },
                  { type: '2-bays-vertical' as ObraGridType, label: '2 Vanos', enabled: true },
                  { type: '3-bays-vertical' as ObraGridType, label: '3 Vanos', enabled: width >= 800 },
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
                        minHeight: '38px',
                        borderRadius: '10px',
                        border: isSelected
                          ? '2px solid var(--md-sys-color-primary)'
                          : '1px solid var(--md-sys-color-outline-variant)',
                        backgroundColor: isSelected
                          ? 'var(--md-sys-color-primary-container)'
                          : 'var(--md-sys-color-surface-container-high)',
                        color: isSelected
                          ? 'var(--md-sys-color-on-primary-container)'
                          : 'var(--md-sys-color-on-surface)',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        opacity: opt.enabled ? 1 : 0.4,
                        cursor: opt.enabled ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {safeBayCount > 1 && (
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${safeBayCount}, 1fr)`, gap: '0.35rem' }}>
                  {Array.from({ length: safeBayCount }).map((_, idx) => {
                    const isBayActive = activeBayIndex === idx;
                    const bayObj = bays[idx];
                    const bayIcon =
                      bayObj?.type === 'shelves'
                        ? '📚'
                        : bayObj?.type === 'drawer-stack'
                          ? '🗄️'
                          : bayObj?.type === 'doors'
                            ? '🚪'
                            : bayObj?.type === 'subdivided'
                              ? '🍱'
                              : '⬜';
                    const bayName =
                      bayObj?.type === 'shelves'
                        ? 'Estantes'
                        : bayObj?.type === 'drawer-stack'
                          ? 'Cajonera'
                          : bayObj?.type === 'doors'
                            ? 'Puertas'
                            : bayObj?.type === 'subdivided'
                              ? 'Matriz'
                              : 'Libre';

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          triggerHaptic('tick');
                          onActiveBayIndexChange?.(idx);
                        }}
                        style={{
                          minHeight: '42px',
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
                          fontSize: '0.78rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.25rem',
                          cursor: 'pointer',
                        }}
                      >
                        <span>{`Columna ${idx + 1}:`}</span>
                        <span>{`${bayIcon} ${bayName}`}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Equipment Types (Estantes, Cajonera, Puertas, Vano Libre, Edición Especial) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.35rem', width: '100%' }}>
              {[
                { type: 'shelves' as const, label: '📚 Estantes', fullWidth: false },
                { type: 'drawer-stack' as const, label: '🗄️ Cajonera', fullWidth: false },
                { type: 'doors' as const, label: '🚪 Puerta(s)', fullWidth: false },
                { type: 'empty' as const, label: '⬜ Vano Libre', fullWidth: false },
                { type: 'subdivided' as const, label: '🍱 Edición Especial (Matriz)', fullWidth: true },
              ].map((eq) => {
                const isSelected = currentBay?.type === eq.type;
                return (
                  <button
                    key={eq.type}
                    type="button"
                    onClick={() => {
                      triggerHaptic('major');
                      if (eq.type === 'subdivided') {
                        setIsDistributionModalOpen(true);
                      } else {
                        onBayContentTypeChange?.(activeBayIndex, eq.type);
                      }
                    }}
                    style={{
                      minHeight: '46px',
                      gridColumn: eq.fullWidth ? 'span 2' : 'span 1',
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
            {currentBay?.type === 'subdivided' && (
              <div
                style={{
                  padding: '0.55rem 0.7rem',
                  borderRadius: '12px',
                  backgroundColor: 'var(--md-sys-color-primary-container)',
                  border: '1.5px solid var(--md-sys-color-primary)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  alignItems: 'center',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--md-sys-color-on-primary-container)' }}>
                  🍱 Distribución Especial de Celdas Activa (Prof. útil: {activeBayDepth} mm)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('major');
                    setIsDistributionModalOpen(true);
                  }}
                  className="m3-button m3-button--filled"
                  style={{
                    width: '100%',
                    minHeight: '44px',
                    borderRadius: '10px',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <span>✏️</span>
                  <span>Modificar Celdas y Divisiones</span>
                </button>
              </div>
            )}

            {currentBay?.type === 'shelves' && (
              <div
                style={{
                  padding: '0.5rem 0.65rem',
                  borderRadius: '12px',
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                    {`Cantidad de Estantes (a tope ${activeBayDepth}mm):`}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <button
                      type="button"
                      disabled={!currentBay.count || currentBay.count <= 1}
                      onClick={() => {
                        triggerHaptic('tick');
                        onRemoveShelf?.(activeBayIndex);
                      }}
                      style={{
                        minWidth: '42px',
                        height: '42px',
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
                        minWidth: '42px',
                        height: '42px',
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
                          minHeight: '40px',
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
                  padding: '0.5rem 0.65rem',
                  borderRadius: '12px',
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
                    {`Cantidad de Cajones (Prof. máx ${activeBayDepth}mm):`}
                  </span>
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
                        minWidth: '42px',
                        height: '42px',
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
                        minWidth: '42px',
                        height: '42px',
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
                  padding: '0.5rem 0.65rem',
                  borderRadius: '12px',
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
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
                            minWidth: '56px',
                            height: '38px',
                            borderRadius: '8px',
                            border: isCnt
                              ? '2px solid var(--md-sys-color-primary)'
                              : '1px solid var(--md-sys-color-outline-variant)',
                            backgroundColor: isCnt
                              ? 'var(--md-sys-color-primary-container)'
                              : 'var(--md-sys-color-surface)',
                            fontWeight: 700,
                            fontSize: '0.82rem',
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
                            minWidth: '38px',
                            height: '38px',
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
                            fontSize: '0.84rem',
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
              <span style={{ fontSize: '0.78rem', color: 'var(--md-sys-color-outline)', textAlign: 'center', marginTop: '0.2rem' }}>
                {`Vano ${activeBayIndex + 1} libre (Prof. útil a tope con fondo: ${activeBayDepth} mm).`}
              </span>
            )}
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

      {/* Modal de Distribución Interior Compleja (Matriz estilo Word) en Modo Obra */}
      <BayDistributionModal
        isOpen={isDistributionModalOpen}
        onClose={() => setIsDistributionModalOpen(false)}
        onApply={(updatedContent) => {
          onBayContentChange?.(activeBayIndex, updatedContent);
          setIsDistributionModalOpen(false);
        }}
        bayIndex={activeBayIndex}
        bayWidth={activeBayWidth}
        bayHeight={activeBayHeight}
        bayDepth={activeBayDepth}
        initialContent={currentBay ?? { type: 'empty' }}
        materials={materials}
      />
    </section>
  );
}
