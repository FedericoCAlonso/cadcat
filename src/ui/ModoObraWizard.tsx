import {
  type ReactElement,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { type HandMode, triggerHaptic } from '../resolver/thumbArc';
import { ThumbArcInput, type ThumbArcOption } from './ThumbArcInput';
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
import { APP_VERSION } from '../version';
import { forcePurgeCacheAndReload } from '../registerServiceWorker';

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
 * Reorganized 7 coherent workshop stages unified around the Thumb Arc philosophy:
 * 1. Módulo y Tipo -> 2. Medidas Principales -> 3. Placas y Espesores ->
 * 4. Base y Techo -> 5. Fondo Trasero -> 6. División de Vanos -> 7. Equipamiento Interior
 */
export const OBRA_STEPS: ObraStepDefinition[] = [
  {
    id: 'module-type',
    stepNumber: 1,
    title: 'Módulo y Tipo',
    shortTitle: 'Tipo',
    subtitle: 'Deslizá el arco o tocá + / − para elegir la plantilla',
  },
  {
    id: 'dimensions',
    stepNumber: 2,
    title: 'Medidas Principales',
    shortTitle: 'Medidas',
    subtitle: 'Tocá una cota en el plano y ajustá con el arco radial',
  },
  {
    id: 'material',
    stepNumber: 3,
    title: 'Placas y Espesores',
    shortTitle: 'Placas',
    subtitle: 'Elegí el rol en el esquema y girá el arco para elegir placa o espesor',
  },
  {
    id: 'base-roof',
    stepNumber: 4,
    title: 'Base y Techo',
    shortTitle: 'Casco',
    subtitle: 'Tocá Base o Techo en el esquema y ajustá con el arco',
  },
  {
    id: 'backing',
    stepNumber: 5,
    title: 'Fondo Trasero',
    shortTitle: 'Fondo',
    subtitle: 'Anclaje y espesor de fondo por vano con tope interior automático',
  },
  {
    id: 'bays-grid',
    stepNumber: 6,
    title: 'División de Vanos',
    shortTitle: 'Vanos',
    subtitle: 'Columnas de izquierda a derecha y matriz especial con el arco',
  },
  {
    id: 'bays-equipment',
    stepNumber: 7,
    title: 'Equipamiento Interior',
    shortTitle: 'Interior',
    subtitle: 'Tocá un vano en el plano y ajustá su equipamiento con el arco',
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
  const [materialArcAxis, setMaterialArcAxis] = useState<'plate' | 'thickness'>('plate');
  const [activeShellZone, setActiveShellZone] = useState<'base' | 'plinth-height' | 'roof'>('base');
  const [activeBackingZone, setActiveBackingZone] = useState<'anchor' | 'thickness'>('anchor');
  const [activeGridZone, setActiveGridZone] = useState<'count' | 'bay'>('count');
  const [activeEquipAxis, setActiveEquipAxis] = useState<
    'type' | 'count' | 'shelf-mount' | 'door-hinge' | 'door-shelves'
  >('type');
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

  // Dimension fields list for Step 2
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

  // Options lists for ThumbArcInput across stages
  const templateArcOptions = useMemo<ThumbArcOption[]>(
    () =>
      templates.map((tpl) => ({
        id: tpl.id,
        label: tpl.name,
        sublabel: tpl.category ? `Categoría: ${tpl.category}` : 'Plantilla de taller',
      })),
    [templates],
  );

  const materialArcOptions = useMemo<ThumbArcOption[]>(() => {
    const sourceList =
      filteredRoleMaterials.length <= 1 && materials.length > 1
        ? materials
        : filteredRoleMaterials;
    return sourceList.map((mat) => ({
      id: mat.id,
      label: mat.name,
      sublabel: `${getMaterialThicknessMm(mat) ?? 18} mm · ${activeRoleConfig.label}`,
    }));
  }, [filteredRoleMaterials, materials, activeRoleConfig.label]);

  const thicknessArcOptions = useMemo<ThumbArcOption[]>(
    () => [
      { id: 'all', label: 'Todos los espesores', sublabel: 'Mostrar catálogo completo' },
      ...thicknessOptions.map((th) => ({
        id: String(th),
        label: `${th} mm${standardThicknessesMm.includes(th) ? ' ★' : ''}`,
        sublabel: standardThicknessesMm.includes(th) ? 'Espesor estándar de taller' : 'Espesor de catálogo',
      })),
    ],
    [thicknessOptions, standardThicknessesMm],
  );

  const baseSupportOptions = useMemo<ThumbArcOption[]>(
    () => [
      {
        id: 'plinth-integrated',
        label: '🪚 Con Zócalo / Plinto',
        sublabel: `Elevado ${plinthHeightMm} mm con retroceso frontal`,
      },
      {
        id: 'floor-direct',
        label: '🪵 Apoyo Directo al Piso',
        sublabel: 'Costados apoyan directo con regatón sanitario',
      },
      {
        id: 'wall-hanging',
        label: '🧗 Suspendido / Flotante',
        sublabel: 'Fijación aérea a muro para alacenas',
      },
    ],
    [plinthHeightMm],
  );

  const currentBaseOptionId = hasWallHangingRail
    ? 'wall-hanging'
    : hasPlinth
      ? 'plinth-integrated'
      : 'floor-direct';

  const handleSelectBaseOption = useCallback(
    (optId: string) => {
      if (optId === 'plinth-integrated') {
        onHasPlinthChange?.(true);
        onHasWallHangingRailChange?.(false);
      } else if (optId === 'floor-direct') {
        onHasPlinthChange?.(false);
        onHasWallHangingRailChange?.(false);
      } else if (optId === 'wall-hanging') {
        onHasPlinthChange?.(false);
        onHasWallHangingRailChange?.(true);
      }
    },
    [onHasPlinthChange, onHasWallHangingRailChange],
  );

  const roofArcOptions = useMemo<ThumbArcOption[]>(
    () => [
      {
        id: 'solid-panel',
        label: '🪵 Tapa Ciega Completa',
        sublabel: `Tablero entero de ${thickness} mm`,
      },
      {
        id: 'none',
        label: '🚫 Sin Tapa (Hasta el Techo)',
        sublabel: 'Solución anti-mugre a tope con cielorraso',
      },
      {
        id: 'front-back-rails',
        label: '📏 2 Fajas de Amarre (80 mm)',
        sublabel: 'Faja frontal y trasera para recibir mesada',
      },
    ],
    [thickness],
  );

  const backingAnchorOptions = useMemo<ThumbArcOption[]>(
    () => [
      {
        id: 'groove',
        label: `🔲 Fondo Ranurado (${backingThicknessMm} mm)`,
        sublabel: `Descuenta -${backingReserveMm} mm → Útil: ${usableDepthMm} mm`,
      },
      {
        id: 'overlay',
        label: `🔨 Fondo Clavado / Aplicado (${backingThicknessMm} mm)`,
        sublabel: `A tope detrás → Útil: ${Math.max(1, depth - backingThicknessMm)} mm`,
      },
      {
        id: 'none',
        label: '❌ Sin Fondo',
        sublabel: `Vanos abiertos pasantes (${depth} mm útiles)`,
      },
    ],
    [backingThicknessMm, backingReserveMm, usableDepthMm, depth],
  );

  const currentBackingOptionId = !hasBacking ? 'none' : backingType === 'groove' ? 'groove' : 'overlay';

  const handleSelectBackingOption = useCallback(
    (optId: string) => {
      if (optId === 'groove') {
        onHasBackingChange?.(true);
        onBackingTypeChange?.('groove');
      } else if (optId === 'overlay') {
        onHasBackingChange?.(true);
        onBackingTypeChange?.('overlay');
      } else {
        onHasBackingChange?.(false);
        onBackingTypeChange?.('none');
      }
    },
    [onHasBackingChange, onBackingTypeChange],
  );

  const backingThicknessArcOptions = useMemo<ThumbArcOption[]>(
    () =>
      [3, 5.5, 6, 9, 15, 18].map((th) => ({
        id: String(th),
        label: th >= 15 ? `${th} mm (Estructural)` : `${th} mm`,
        sublabel: `Profundidad interior útil: ${Math.max(1, depth - resolveBackingReserveMm({ hasBacking: true, backingType, backingThicknessMm: th }))} mm`,
      })),
    [depth, backingType],
  );

  const gridCountOptions = useMemo<ThumbArcOption[]>(
    () => [
      { id: '1-bay', label: '1 Vano', sublabel: 'Sin divisoria · 1 Fondo a tope' },
      { id: '2-bays-vertical', label: '2 Vanos', sublabel: 'Vano 1 (Izq) + Vano 2 (Der) · 2 Fondos' },
      {
        id: '3-bays-vertical',
        label: '3 Vanos',
        sublabel: 'Izq + Centro + Der · 3 Fondos',
        disabled: width < 800,
      },
    ],
    [width],
  );

  const baySelectorArcOptions = useMemo<ThumbArcOption[]>(
    () =>
      Array.from({ length: safeBayCount }).map((_, idx) => {
        const box = bayBoxes[idx];
        const bw = box?.width ?? Math.round((width - (safeBayCount + 1) * thickness) / safeBayCount);
        const pos =
          safeBayCount === 1 ? 'Único' : idx === 0 ? 'Izquierda' : idx === safeBayCount - 1 ? 'Derecha' : 'Centro';
        return {
          id: String(idx),
          label: `Vano ${idx + 1} (${pos})`,
          sublabel: `Luz útil: ${bw} × ${box?.height ?? activeBayHeight} × ${box?.depth ?? usableDepthMm} mm`,
        };
      }),
    [safeBayCount, bayBoxes, width, thickness, activeBayHeight, usableDepthMm],
  );

  const equipmentArcOptions = useMemo<ThumbArcOption[]>(
    () => [
      { id: 'shelves', label: '📚 Estantes', sublabel: `Estantes a tope con fondo (${activeBayDepth} mm)` },
      { id: 'drawer-stack', label: '🗄️ Cajonera', sublabel: `Cajones con correderas (máx ${activeBayDepth} mm)` },
      { id: 'doors', label: '🚪 Puerta(s)', sublabel: 'Hojas batientes con bisagras cazoleta' },
      { id: 'empty', label: '⬜ Vano Libre', sublabel: 'Hueco abierto sin herrajes interiores' },
    ],
    [activeBayDepth],
  );

  const equipmentTypeOptions = useMemo<ThumbArcOption[]>(
    () => [
      ...equipmentArcOptions,
      { id: 'subdivided', label: '🍱 Edición Especial (Matriz)', sublabel: 'Subdivisión asimétrica mm/% y 6mm' },
    ],
    [equipmentArcOptions],
  );

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
          gap: '0.12rem',
          padding: 'max(0.18rem, env(safe-area-inset-top, 0.18rem)) 0.5rem 0.15rem',
          borderBottom: '1px solid var(--md-sys-color-outline-variant)',
          backgroundColor: 'var(--md-sys-color-surface-container)',
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            gap: '0.4rem',
          }}
        >
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

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            gap: '0.4rem',
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

          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => void forcePurgeCacheAndReload()}
              title="Actualizar caché a la última versión"
              aria-label={`Versión v${APP_VERSION}. Tocar para forzar actualización`}
              style={{
                fontSize: '0.62rem',
                fontWeight: 700,
                color: 'var(--md-sys-color-outline)',
                backgroundColor: 'transparent',
                border: 'none',
                padding: '0 4px',
                cursor: 'pointer',
              }}
            >
              {`v${APP_VERSION}`}
            </button>
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

      {/* 2. Unified 2-Block Body: [Top: Expanded CAD Canvas (flex: 1)] + [Bottom: Cohesive Anti-Occlusion Console] */}
      <main
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          padding: '0.12rem 0.45rem',
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          boxSizing: 'border-box',
          width: '100%',
          gap: '0.15rem',
        }}
      >
        <h2 className="visually-hidden">{activeStep.title}</h2>

        {/* ─────────────────────────────────────────────────────────────
            ETAPA 1: MÓDULO Y TIPO (Esquema grande + Arco selector de plantilla)
           ───────────────────────────────────────────────────────────── */}
        {activeStep.id === 'module-type' && (
          <div
            style={{
              width: '100%',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.18rem',
            }}
          >
            <WorkshopContextDiagram
              step="module-type"
              subtitle={activeStep.subtitle}
              selectedTemplateId={selectedTemplateId}
              width={width}
              height={height}
              depth={depth}
              plinthHeightMm={plinthHeightMm}
            />

            <div
              className="obra-bottom-console"
              style={{
                width: '100%',
                maxWidth: '460px',
                margin: '0 auto',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
              }}
            >
              {/* Quick scrollable pills of templates */}
              <div
                role="tablist"
                aria-label="Plantillas de mueble disponibles"
                style={{
                  display: 'flex',
                  gap: '0.35rem',
                  width: '100%',
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                  paddingBottom: '2px',
                  flexShrink: 0,
                }}
              >
                {templates.slice(0, 8).map((tpl) => {
                  const isSelected = selectedTemplateId === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => {
                        triggerHaptic('major');
                        onTemplateChange?.(tpl.id);
                      }}
                      style={{
                        minHeight: '38px',
                        padding: '0 0.65rem',
                        borderRadius: '18px',
                        border: isSelected
                          ? '2px solid var(--md-sys-color-primary)'
                          : '1px solid var(--md-sys-color-outline-variant)',
                        backgroundColor: isSelected
                          ? 'var(--md-sys-color-primary-container)'
                          : 'var(--md-sys-color-surface-container-high)',
                        color: isSelected
                          ? 'var(--md-sys-color-on-primary-container)'
                          : 'var(--md-sys-color-on-surface)',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {tpl.name}
                    </button>
                  );
                })}
              </div>

              {/* Universal Thumb Arc Selector */}
              <ThumbArcInput
                id="obra-arc-template"
                label="Plantilla de Mueble"
                value={0}
                onChange={() => {}}
                handMode={handMode}
                onHandModeChange={onHandModeChange}
                arcOnly={true}
                options={templateArcOptions}
                selectedOptionId={selectedTemplateId}
                onSelectOption={(tplId) => onTemplateChange?.(tplId)}
              />
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            ETAPA 2: MEDIDAS PRINCIPALES (Esquema grande + Arco milimétrico puro)
           ───────────────────────────────────────────────────────────── */}
        {activeStep.id === 'dimensions' && (
          <div
            style={{
              width: '100%',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.18rem',
            }}
          >
            <WorkshopContextDiagram
              step="dimensions"
              subtitle={activeStep.subtitle}
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

            <div
              className="obra-bottom-console"
              style={{
                width: '100%',
                maxWidth: '460px',
                margin: '0 auto',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
              }}
            >
              {/* Compact 4-Dimension Segmented Pills + Prev/Next */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  width: '100%',
                  flexShrink: 0,
                }}
              >
              <button
                type="button"
                onClick={goToPrevDimension}
                aria-label="Medida anterior"
                title="Medida anterior"
                style={{
                  minWidth: '38px',
                  height: '42px',
                  borderRadius: '10px',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  backgroundColor: 'var(--md-sys-color-surface-container-high)',
                  fontWeight: 800,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                ◀
              </button>

              <div
                role="tablist"
                aria-label="Selector de medidas principales"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '0.25rem',
                  flex: 1,
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
                        minHeight: '42px',
                        padding: '0.2rem 0.15rem',
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
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase' }}>
                        {f.shortLabel}
                      </span>
                      <span style={{ fontSize: '0.84rem', fontWeight: 800 }}>{`${f.value}mm`}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={goToNextDimension}
                aria-label="Medida siguiente"
                title="Medida siguiente"
                style={{
                  minWidth: '38px',
                  height: '42px',
                  borderRadius: '10px',
                  border: '1px solid var(--md-sys-color-outline-variant)',
                  backgroundColor: 'var(--md-sys-color-surface-container-high)',
                  fontWeight: 800,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                ▶
              </button>
            </div>

            {/* Bottom: Pure Radial Thumb Arc (No external button grids!) */}
            {dimensionField === 'width' && (
              <ThumbArcInput
                id="obra-dim-width"
                label={`Ancho Total: (${activeDimIndex + 1}/4)`}
                value={width}
                onChange={onWidthChange}
                min={DEFAULT_UI_CONFIG.dimensions.width.min}
                max={DEFAULT_UI_CONFIG.dimensions.width.max}
                step={1}
                coarseStep={10}
                unit="mm"
                helpText="Tap arriba +1 mm · Tap abajo -1 mm"
                handMode={handMode}
                onHandModeChange={onHandModeChange}
                arcOnly={true}
              />
            )}

            {dimensionField === 'height' && (
              <ThumbArcInput
                id="obra-dim-height"
                label={`Alto Total: (${activeDimIndex + 1}/4)`}
                value={height}
                onChange={onHeightChange}
                min={DEFAULT_UI_CONFIG.dimensions.height.min}
                max={DEFAULT_UI_CONFIG.dimensions.height.max}
                step={1}
                coarseStep={10}
                unit="mm"
                helpText="Tap arriba +1 mm · Tap abajo -1 mm"
                handMode={handMode}
                onHandModeChange={onHandModeChange}
                arcOnly={true}
              />
            )}

            {dimensionField === 'depth' && (
              <ThumbArcInput
                id="obra-dim-depth"
                label={`Profundidad: (${activeDimIndex + 1}/4)`}
                value={depth}
                onChange={onDepthChange}
                min={DEFAULT_UI_CONFIG.dimensions.depth.min}
                max={DEFAULT_UI_CONFIG.dimensions.depth.max}
                step={1}
                coarseStep={10}
                unit="mm"
                helpText={`Luz útil interior: ${usableDepthMm} mm`}
                handMode={handMode}
                onHandModeChange={onHandModeChange}
                arcOnly={true}
              />
            )}

            {dimensionField === 'thickness' && (
              <ThumbArcInput
                id="obra-dim-thickness"
                label={`Espesor Placa: (${activeDimIndex + 1}/4)`}
                value={thickness}
                onChange={(val) => onThicknessChange?.(val)}
                min={3}
                max={30}
                step={1}
                coarseStep={3}
                unit="mm"
                helpText="Tap arriba +1 mm · Tap abajo -1 mm"
                handMode={handMode}
                onHandModeChange={onHandModeChange}
                arcOnly={true}
              />
            )}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            ETAPA 3: PLACAS Y ESPESORES (Esquema 4 roles + Arco de Placas/Espesores)
           ───────────────────────────────────────────────────────────── */}
        {activeStep.id === 'material' && (
          <div
            style={{
              width: '100%',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.28rem',
            }}
          >
            <WorkshopContextDiagram
              step="material"
              subtitle={activeStep.subtitle}
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

            <div
              className="obra-bottom-console"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                width: '100%',
                maxWidth: '460px',
                margin: '0 auto',
                flexShrink: 0,
              }}
            >
              {/* Middle Strip: Role Tabs + Thickness/Material Pills */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  width: '100%',
                  flexShrink: 0,
                }}
              >
              {/* Role Tabs + Sync Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', width: '100%' }}>
                <div
                  role="tablist"
                  aria-label="Roles de placa o tablero"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '0.25rem',
                    flex: 1,
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
                          minHeight: '38px',
                          padding: '0.2rem',
                          borderRadius: '10px',
                          border: isActive
                            ? '2px solid var(--md-sys-color-primary)'
                            : '1px solid var(--md-sys-color-outline-variant)',
                          backgroundColor: isActive
                            ? 'var(--md-sys-color-primary-container)'
                            : 'var(--md-sys-color-surface-container)',
                          color: isActive
                            ? 'var(--md-sys-color-on-primary-container)'
                            : 'var(--md-sys-color-on-surface)',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {`${role.icon} ${role.shortLabel}`}
                      </button>
                    );
                  })}
                </div>

                {effectiveMaterialRole !== 'carcass' && (
                  <button
                    type="button"
                    onClick={handleResetRoleToCarcass}
                    title="Restablecer para usar el mismo tablero que el Casco"
                    aria-label="Restablecer para usar la misma placa que el casco"
                    style={{
                      minHeight: '38px',
                      padding: '0 0.45rem',
                      borderRadius: '10px',
                      border: '1px solid var(--md-sys-color-outline)',
                      backgroundColor: 'var(--md-sys-color-surface)',
                      color: 'var(--md-sys-color-primary)',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                    }}
                  >
                    🔗 Igual al Casco
                  </button>
                )}
              </div>

              {/* Sub-bar: Standard Thickness Filter Chips + Plate Quick Pills */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.25rem',
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                  alignItems: 'center',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setMaterialArcAxis('thickness');
                    handleSelectThicknessChipForRole(null);
                  }}
                  style={{
                    minHeight: '32px',
                    padding: '0 0.45rem',
                    borderRadius: '8px',
                    border:
                      roleThicknessFilterMm === null && materialArcAxis === 'thickness'
                        ? '1.5px solid var(--md-sys-color-primary)'
                        : '1px solid var(--md-sys-color-outline-variant)',
                    backgroundColor:
                      roleThicknessFilterMm === null
                        ? 'var(--md-sys-color-primary-container)'
                        : 'var(--md-sys-color-surface)',
                    fontSize: '0.68rem',
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
                      onClick={() => {
                        setMaterialArcAxis('plate');
                        handleSelectThicknessChipForRole(thMm);
                      }}
                      style={{
                        minHeight: '32px',
                        padding: '0 0.45rem',
                        borderRadius: '8px',
                        border: isSelected
                          ? '1.5px solid var(--md-sys-color-primary)'
                          : '1px solid var(--md-sys-color-outline-variant)',
                        backgroundColor: isSelected
                          ? 'var(--md-sys-color-primary-container)'
                          : 'var(--md-sys-color-surface)',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                      }}
                    >
                      {`${thMm} mm${isStd ? ' ★' : ''}`}
                    </button>
                  );
                })}
                {filteredRoleMaterials.map((mat) => {
                  const isMatSelected = currentRoleMaterialId === mat.id;
                  return (
                    <button
                      key={mat.id}
                      type="button"
                      onClick={() => {
                        setMaterialArcAxis('plate');
                        handleSelectMaterialForRole(mat.id);
                      }}
                      style={{
                        minHeight: '32px',
                        padding: '0 0.5rem',
                        borderRadius: '8px',
                        border: isMatSelected
                          ? '1.5px solid var(--md-sys-color-primary)'
                          : '1px solid var(--md-sys-color-outline-variant)',
                        backgroundColor: isMatSelected
                          ? 'var(--md-sys-color-primary-container)'
                          : 'var(--md-sys-color-surface-container-high)',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                      }}
                    >
                      {mat.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom: Universal Thumb Arc for Plate / Thickness selection */}
            {materialArcAxis === 'thickness' ? (
              <ThumbArcInput
                id="obra-arc-material-thickness"
                label={`${activeRoleConfig.label} · Espesor`}
                value={0}
                onChange={() => {}}
                handMode={handMode}
                onHandModeChange={onHandModeChange}
                arcOnly={true}
                options={thicknessArcOptions}
                selectedOptionId={roleThicknessFilterMm === null ? 'all' : String(roleThicknessFilterMm)}
                onSelectOption={(id) =>
                  handleSelectThicknessChipForRole(id === 'all' ? null : Number(id))
                }
              />
            ) : (
              <ThumbArcInput
                id="obra-arc-material-plate"
                label={`${activeRoleConfig.label} · ${activeRoleConfig.description}`}
                value={0}
                onChange={() => {}}
                handMode={handMode}
                onHandModeChange={onHandModeChange}
                arcOnly={true}
                options={materialArcOptions}
                selectedOptionId={currentRoleMaterialId}
                onSelectOption={handleSelectMaterialForRole}
              />
            )}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            ETAPA 4: BASE Y TECHO (Esquema grande + Arco para Base / Zócalo / Techo)
           ───────────────────────────────────────────────────────────── */}
        {activeStep.id === 'base-roof' && (
          <div
            style={{
              width: '100%',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.18rem',
            }}
          >
            <WorkshopContextDiagram
              step="base-roof"
              subtitle={activeStep.subtitle}
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

            <div
              className="obra-bottom-console"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                width: '100%',
                maxWidth: '460px',
                margin: '0 auto',
                flexShrink: 0,
              }}
            >
              {/* Middle Strip: Quick Pills for Base Options & Roof Options */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  width: '100%',
                  flexShrink: 0,
                }}
              >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.25rem' }}>
                {baseSupportOptions.map((opt) => {
                  const isActive = currentBaseOptionId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic('major');
                        setActiveShellZone('base');
                        handleSelectBaseOption(opt.id);
                      }}
                      style={{
                        minHeight: '36px',
                        padding: '0.2rem 0.25rem',
                        borderRadius: '10px',
                        border: isActive
                          ? '2px solid var(--md-sys-color-primary)'
                          : '1px solid var(--md-sys-color-outline-variant)',
                        backgroundColor: isActive
                          ? 'var(--md-sys-color-primary-container)'
                          : 'var(--md-sys-color-surface-container-high)',
                        color: isActive
                          ? 'var(--md-sys-color-on-primary-container)'
                          : 'var(--md-sys-color-on-surface)',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.25rem' }}>
                {roofArcOptions.map((opt) => {
                  const isSelected = roofType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic('major');
                        setActiveShellZone('roof');
                        onRoofTypeChange?.(opt.id as RoofType);
                      }}
                      style={{
                        minHeight: '36px',
                        padding: '0.2rem 0.25rem',
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
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom: Universal Thumb Arc for Base / Plinth Height / Roof */}
            {activeShellZone === 'plinth-height' && hasPlinth && !hasWallHangingRail ? (
              <ThumbArcInput
                id="obra-arc-plinth-height"
                label="Altura de Zócalo / Plinto"
                value={plinthHeightMm}
                onChange={(val) => onPlinthHeightChange?.(val)}
                min={50}
                max={200}
                step={1}
                coarseStep={10}
                unit="mm"
                helpText="Tap arriba +1 mm · Tap abajo -1 mm"
                handMode={handMode}
                onHandModeChange={onHandModeChange}
                arcOnly={true}
              />
            ) : activeShellZone === 'roof' ? (
              <ThumbArcInput
                id="obra-arc-roof"
                label="Cierre Superior (Techo)"
                value={0}
                onChange={() => {}}
                handMode={handMode}
                onHandModeChange={onHandModeChange}
                arcOnly={true}
                options={roofArcOptions}
                selectedOptionId={roofType}
                onSelectOption={(id) => onRoofTypeChange?.(id as RoofType)}
              />
            ) : (
              <ThumbArcInput
                id="obra-arc-base"
                label="Apoyo Inferior (Base)"
                value={0}
                onChange={() => {}}
                handMode={handMode}
                onHandModeChange={onHandModeChange}
                arcOnly={true}
                options={baseSupportOptions}
                selectedOptionId={currentBaseOptionId}
                onSelectOption={handleSelectBaseOption}
              />
            )}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            ETAPA 5: FONDO TRASERO (Esquema de corte CAD + Arco Anclaje / Espesor)
           ───────────────────────────────────────────────────────────── */}
        {activeStep.id === 'backing' && (
          <div
            style={{
              width: '100%',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.18rem',
            }}
          >
            <WorkshopContextDiagram
              step="backing"
              subtitle={activeStep.subtitle}
              depth={depth}
              hasBacking={hasBacking}
              backingType={backingType}
              backingThicknessMm={backingThicknessMm}
              activeBackingZone={activeBackingZone}
              onSelectBackingZone={(zone) => {
                triggerHaptic('tick');
                setActiveBackingZone(zone);
              }}
              gridType={gridType}
            />

            <div
              className="obra-bottom-console"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                width: '100%',
                maxWidth: '460px',
                margin: '0 auto',
                flexShrink: 0,
              }}
            >
              {/* Middle Strip: Sub-parameter pills (Anclaje vs Espesor de Fondo) */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.35rem',
                  width: '100%',
                  flexShrink: 0,
                }}
              >
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('tick');
                  setActiveBackingZone('anchor');
                }}
                style={{
                  flex: 1,
                  minHeight: '40px',
                  borderRadius: '10px',
                  border:
                    activeBackingZone === 'anchor'
                      ? '2px solid var(--md-sys-color-primary)'
                      : '1px solid var(--md-sys-color-outline-variant)',
                  backgroundColor:
                    activeBackingZone === 'anchor'
                      ? 'var(--md-sys-color-primary-container)'
                      : 'var(--md-sys-color-surface-container-high)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🔩 Anclaje de Fondo
              </button>

              {hasBacking && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('tick');
                    setActiveBackingZone('thickness');
                  }}
                  style={{
                    flex: 1,
                    minHeight: '40px',
                    borderRadius: '10px',
                    border:
                      activeBackingZone === 'thickness'
                        ? '2px solid var(--md-sys-color-primary)'
                        : '1px solid var(--md-sys-color-outline-variant)',
                    backgroundColor:
                      activeBackingZone === 'thickness'
                        ? 'var(--md-sys-color-primary-container)'
                        : 'var(--md-sys-color-surface-container-high)',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {`📏 Espesor Fondo (${backingThicknessMm} mm)`}
                </button>
              )}
            </div>

            {/* Bottom: Universal Thumb Arc */}
            {activeBackingZone === 'thickness' && hasBacking ? (
              <ThumbArcInput
                id="obra-arc-backing-thickness"
                label="Espesor de Placa de Fondo"
                value={0}
                onChange={() => {}}
                handMode={handMode}
                onHandModeChange={onHandModeChange}
                arcOnly={true}
                options={backingThicknessArcOptions}
                selectedOptionId={String(backingThicknessMm)}
                onSelectOption={(id) => {
                  const th = Number(id);
                  onBackingThicknessChange?.(th);
                  const match = filterMaterialsByThickness(materials, th)[0];
                  if (match) {
                    onBackingsMaterialChange?.(match.id);
                  }
                }}
              />
            ) : (
              <ThumbArcInput
                id="obra-arc-backing-anchor"
                label="Anclaje de Fondo por Vano"
                value={0}
                onChange={() => {}}
                handMode={handMode}
                onHandModeChange={onHandModeChange}
                arcOnly={true}
                options={backingAnchorOptions}
                selectedOptionId={currentBackingOptionId}
                onSelectOption={handleSelectBackingOption}
              />
            )}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            ETAPA 6: DIVISIÓN DE VANOS (Esquema grande + Arco de Vanos)
           ───────────────────────────────────────────────────────────── */}
        {activeStep.id === 'bays-grid' && (
          <div
            style={{
              width: '100%',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.18rem',
            }}
          >
            <WorkshopContextDiagram
              step="bays-grid"
              subtitle={activeStep.subtitle}
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
                setActiveGridZone('bay');
                onActiveBayIndexChange?.(idx);
              }}
            />

            <div
              className="obra-bottom-console"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                width: '100%',
                maxWidth: '460px',
                margin: '0 auto',
                flexShrink: 0,
              }}
            >
              {/* Middle Strip: 1 Vano / 2 Vanos / 3 Vanos + Matriz Especial */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: '0.3rem',
                  width: '100%',
                  flexShrink: 0,
                }}
              >
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
                      setActiveGridZone('count');
                      onGridTypeChange?.(opt.type);
                    }}
                    style={{
                      minHeight: '40px',
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
                      fontWeight: 800,
                      opacity: opt.enabled ? 1 : 0.4,
                      cursor: opt.enabled ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  triggerHaptic('major');
                  setIsDistributionModalOpen(true);
                }}
                style={{
                  minHeight: '40px',
                  borderRadius: '10px',
                  border: '1px solid var(--md-sys-color-primary)',
                  backgroundColor: 'var(--md-sys-color-surface-container-high)',
                  color: 'var(--md-sys-color-primary)',
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                🍱 Matriz
              </button>
            </div>

            {/* Bottom: Universal Thumb Arc for Bay Count or Active Bay */}
            {activeGridZone === 'bay' && safeBayCount > 1 ? (
              <ThumbArcInput
                id="obra-arc-active-bay"
                label="Vano Seleccionado (Izq ➔ Der)"
                value={0}
                onChange={() => {}}
                handMode={handMode}
                onHandModeChange={onHandModeChange}
                arcOnly={true}
                options={baySelectorArcOptions}
                selectedOptionId={String(activeBayIndex)}
                onSelectOption={(id) => onActiveBayIndexChange?.(Number(id))}
              />
            ) : (
              <ThumbArcInput
                id="obra-arc-grid-count"
                label="Cantidad de Vanos (Columnas)"
                value={0}
                onChange={() => {}}
                handMode={handMode}
                onHandModeChange={onHandModeChange}
                arcOnly={true}
                options={gridCountOptions}
                selectedOptionId={gridType}
                onSelectOption={(id) => onGridTypeChange?.(id as ObraGridType)}
              />
            )}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            ETAPA 7: EQUIPAMIENTO INTERIOR (Esquema dinámico + Arco Universal)
           ───────────────────────────────────────────────────────────── */}
        {activeStep.id === 'bays-equipment' && (
          <div
            style={{
              width: '100%',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.18rem',
            }}
          >
            <WorkshopContextDiagram
              step="bays-equipment"
              subtitle={activeStep.subtitle}
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

            <div
              className="obra-bottom-console"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                width: '100%',
                maxWidth: '460px',
                margin: '0 auto',
                flexShrink: 0,
              }}
            >
              {/* Middle Strip: Equipment Type Pills + Contextual Sub-Axis Pills */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  width: '100%',
                  flexShrink: 0,
                }}
              >
              {/* Equipment types row */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.25rem',
                  overflowX: 'auto',
                  scrollbarWidth: 'none',
                }}
              >
                {equipmentTypeOptions.map((eq) => {
                  const isSelected = currentBay?.type === eq.id;
                  return (
                    <button
                      key={eq.id}
                      type="button"
                      onClick={() => {
                        triggerHaptic('major');
                        if (eq.id === 'subdivided') {
                          setIsDistributionModalOpen(true);
                        } else {
                          setActiveEquipAxis('type');
                          onBayContentTypeChange?.(activeBayIndex, eq.id as ObraBayContentType);
                        }
                      }}
                      style={{
                        minHeight: '36px',
                        padding: '0 0.5rem',
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
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      {eq.label}
                    </button>
                  );
                })}
              </div>

              {/* Contextual sub-parameter selector bar for active equipment */}
              {currentBay?.type === 'shelves' && (
                <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setActiveEquipAxis('count')}
                    style={{
                      flex: 1,
                      minHeight: '34px',
                      borderRadius: '8px',
                      border:
                        activeEquipAxis === 'count'
                          ? '1.5px solid var(--md-sys-color-primary)'
                          : '1px solid var(--md-sys-color-outline-variant)',
                      backgroundColor:
                        activeEquipAxis === 'count'
                          ? 'var(--md-sys-color-primary-container)'
                          : 'var(--md-sys-color-surface)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {`🔢 Estantes: ${currentBay.count ?? 1}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveShelf?.(activeBayIndex)}
                    aria-label="Quitar estante"
                    style={{
                      minWidth: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      border: '1px solid var(--md-sys-color-outline-variant)',
                      backgroundColor: 'var(--md-sys-color-surface)',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => onAddShelf?.(activeBayIndex)}
                    aria-label="Agregar estante"
                    style={{
                      minWidth: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      border: '1px solid var(--md-sys-color-outline-variant)',
                      backgroundColor: 'var(--md-sys-color-surface)',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveEquipAxis('shelf-mount')}
                    style={{
                      flex: 1,
                      minHeight: '34px',
                      borderRadius: '8px',
                      border:
                        activeEquipAxis === 'shelf-mount'
                          ? '1.5px solid var(--md-sys-color-primary)'
                          : '1px solid var(--md-sys-color-outline-variant)',
                      backgroundColor:
                        activeEquipAxis === 'shelf-mount'
                          ? 'var(--md-sys-color-primary-container)'
                          : 'var(--md-sys-color-surface)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {currentBay.shelfType === 'fixed' ? '📌 Fijos' : '⚙️ Regulables'}
                  </button>
                </div>
              )}

              {currentBay?.type === 'drawer-stack' && (
                <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setActiveEquipAxis('count')}
                    style={{
                      flex: 1,
                      minHeight: '34px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--md-sys-color-primary)',
                      backgroundColor: 'var(--md-sys-color-primary-container)',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {`🔢 Cajones: ${currentBay.drawerTracks?.length ?? 3} (Prof. útil: ${activeBayDepth} mm)`}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const len = currentBay.drawerTracks?.length ?? 3;
                      onRemoveDrawer?.(activeBayIndex, len - 1);
                    }}
                    style={{
                      minWidth: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      border: '1px solid var(--md-sys-color-outline-variant)',
                      backgroundColor: 'var(--md-sys-color-surface)',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    -
                  </button>
                  <button
                    type="button"
                    onClick={() => onAddDrawer?.(activeBayIndex)}
                    style={{
                      minWidth: '34px',
                      height: '34px',
                      borderRadius: '8px',
                      border: '1px solid var(--md-sys-color-outline-variant)',
                      backgroundColor: 'var(--md-sys-color-surface)',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    +
                  </button>
                </div>
              )}

              {currentBay?.type === 'doors' && (
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button
                    type="button"
                    onClick={() => setActiveEquipAxis('count')}
                    style={{
                      flex: 1,
                      minHeight: '34px',
                      borderRadius: '8px',
                      border:
                        activeEquipAxis === 'count'
                          ? '1.5px solid var(--md-sys-color-primary)'
                          : '1px solid var(--md-sys-color-outline-variant)',
                      backgroundColor:
                        activeEquipAxis === 'count'
                          ? 'var(--md-sys-color-primary-container)'
                          : 'var(--md-sys-color-surface)',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {`🚪 ${(currentBay.count ?? 1) === 2 ? '2 Hojas' : '1 Hoja'}`}
                  </button>
                  {(currentBay.count ?? 1) === 1 && (
                    <button
                      type="button"
                      onClick={() => setActiveEquipAxis('door-hinge')}
                      style={{
                        flex: 1,
                        minHeight: '34px',
                        borderRadius: '8px',
                        border:
                          activeEquipAxis === 'door-hinge'
                            ? '1.5px solid var(--md-sys-color-primary)'
                            : '1px solid var(--md-sys-color-outline-variant)',
                        backgroundColor:
                          activeEquipAxis === 'door-hinge'
                            ? 'var(--md-sys-color-primary-container)'
                            : 'var(--md-sys-color-surface)',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {`Bisagra: ${(currentBay.hingeSide ?? 'left') === 'left' ? '👈 Izq' : '👉 Der'}`}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveEquipAxis('door-shelves')}
                    style={{
                      flex: 1,
                      minHeight: '34px',
                      borderRadius: '8px',
                      border:
                        activeEquipAxis === 'door-shelves'
                          ? '1.5px solid var(--md-sys-color-primary)'
                          : '1px solid var(--md-sys-color-outline-variant)',
                      backgroundColor:
                        activeEquipAxis === 'door-shelves'
                          ? 'var(--md-sys-color-primary-container)'
                          : 'var(--md-sys-color-surface)',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {`📚 Est. Int: ${currentBay.interiorShelvesCount ?? 0}`}
                  </button>
                </div>
              )}
            </div>

            {/* Bottom: Universal Thumb Arc controlling the active equipment parameter */}
            {currentBay?.type === 'shelves' && activeEquipAxis === 'count' ? (
              <ThumbArcInput
                id="obra-arc-shelves-count"
                label={`Cantidad de Estantes (Vano ${activeBayIndex + 1})`}
                value={currentBay.count ?? 1}
                onChange={(targetVal) => {
                  const cur = currentBay.count ?? 1;
                  const diff = Math.round(targetVal) - cur;
                  if (diff > 0) {
                    for (let i = 0; i < diff; i++) onAddShelf?.(activeBayIndex);
                  } else if (diff < 0) {
                    const removals = Math.min(cur - 1, Math.abs(diff));
                    for (let i = 0; i < removals; i++) onRemoveShelf?.(activeBayIndex);
                  }
                }}
                onIncrement={() => onAddShelf?.(activeBayIndex)}
                onDecrement={() => {
                  if ((currentBay.count ?? 1) > 1) onRemoveShelf?.(activeBayIndex);
                }}
                min={1}
                max={8}
                step={1}
                coarseStep={1}
                unit="estantes"
                helpText={`A tope con fondo (${activeBayDepth} mm) · Tap + / −`}
                handMode={handMode}
                onHandModeChange={onHandModeChange}
                arcOnly={true}
              />
            ) : currentBay?.type === 'shelves' && activeEquipAxis === 'shelf-mount' ? (
              <ThumbArcInput
                id="obra-arc-shelves-mount"
                label={`Montaje de Estantes (Vano ${activeBayIndex + 1})`}
                value={0}
                onChange={() => {}}
                handMode={handMode}
                onHandModeChange={onHandModeChange}
                arcOnly={true}
                options={[
                  { id: 'adjustable', label: '⚙️ Estantes Regulables', sublabel: 'Sobre pitones / cremallera' },
                  { id: 'fixed', label: '📌 Estantes Fijos', sublabel: 'Estructurales con confirmat / minifix' },
                ]}
                selectedOptionId={currentBay.shelfType ?? 'adjustable'}
                onSelectOption={(id) => onShelfTypeChange?.(activeBayIndex, id as 'fixed' | 'adjustable')}
              />
            ) : currentBay?.type === 'drawer-stack' && activeEquipAxis === 'count' ? (
              <ThumbArcInput
                id="obra-arc-drawers-count"
                label={`Cantidad de Cajones (Vano ${activeBayIndex + 1})`}
                value={currentBay.drawerTracks?.length ?? 3}
                onChange={(targetVal) => {
                  const cur = currentBay.drawerTracks?.length ?? 3;
                  const diff = Math.round(targetVal) - cur;
                  if (diff > 0) {
                    for (let i = 0; i < diff; i++) onAddDrawer?.(activeBayIndex);
                  } else if (diff < 0) {
                    const removals = Math.min(cur - 1, Math.abs(diff));
                    for (let i = 0; i < removals; i++) onRemoveDrawer?.(activeBayIndex, cur - 1 - i);
                  }
                }}
                onIncrement={() => onAddDrawer?.(activeBayIndex)}
                onDecrement={() => {
                  const cur = currentBay.drawerTracks?.length ?? 3;
                  if (cur > 1) onRemoveDrawer?.(activeBayIndex, cur - 1);
                }}
                min={1}
                max={6}
                step={1}
                coarseStep={1}
                unit="cajones"
                helpText={`Profundidad útil: ${activeBayDepth} mm · Tap + / −`}
                handMode={handMode}
                onHandModeChange={onHandModeChange}
                arcOnly={true}
              />
            ) : currentBay?.type === 'doors' && activeEquipAxis === 'count' ? (
              <ThumbArcInput
                id="obra-arc-doors-count"
                label={`Hojas de Puerta (Vano ${activeBayIndex + 1})`}
                value={0}
                onChange={() => {}}
                handMode={handMode}
                onHandModeChange={onHandModeChange}
                arcOnly={true}
                options={[
                  { id: '1', label: '🚪 1 Hoja Batiente', sublabel: 'Puerta simple' },
                  { id: '2', label: '🚪🚪 2 Hojas Batientes', sublabel: 'Par de puertas con encuentro central' },
                ]}
                selectedOptionId={String(currentBay.count ?? 1)}
                onSelectOption={(id) => onDoorCountChange?.(activeBayIndex, Number(id) as 1 | 2)}
              />
            ) : currentBay?.type === 'doors' && activeEquipAxis === 'door-hinge' ? (
              <ThumbArcInput
                id="obra-arc-doors-hinge"
                label={`Lado de Bisagras (Vano ${activeBayIndex + 1})`}
                value={0}
                onChange={() => {}}
                handMode={handMode}
                onHandModeChange={onHandModeChange}
                arcOnly={true}
                options={[
                  { id: 'left', label: '👈 Bisagras a la Izquierda', sublabel: 'Abre hacia la izquierda' },
                  { id: 'right', label: '👉 Bisagras a la Derecha', sublabel: 'Abre hacia la derecha' },
                ]}
                selectedOptionId={currentBay.hingeSide ?? 'left'}
                onSelectOption={(id) => onDoorHingeSideChange?.(activeBayIndex, id as 'left' | 'right')}
              />
            ) : currentBay?.type === 'doors' && activeEquipAxis === 'door-shelves' ? (
              <ThumbArcInput
                id="obra-arc-doors-shelves"
                label={`Estantes tras Puerta (Vano ${activeBayIndex + 1})`}
                value={currentBay.interiorShelvesCount ?? 0}
                onChange={(val) => onDoorInteriorShelvesCountChange?.(activeBayIndex, val)}
                min={0}
                max={4}
                step={1}
                coarseStep={1}
                unit="estantes"
                helpText={`Retraídos y a tope con fondo (${activeBayDepth} mm)`}
                handMode={handMode}
                onHandModeChange={onHandModeChange}
                arcOnly={true}
              />
            ) : (
              <ThumbArcInput
                id="obra-arc-equipment-type"
                label={`Equipamiento Vano ${activeBayIndex + 1}`}
                value={0}
                onChange={() => {}}
                handMode={handMode}
                onHandModeChange={onHandModeChange}
                arcOnly={true}
                options={equipmentArcOptions}
                selectedOptionId={
                  currentBay?.type && currentBay.type !== 'subdivided' ? currentBay.type : 'empty'
                }
                onSelectOption={(id) => {
                  onBayContentTypeChange?.(activeBayIndex, id as ObraBayContentType);
                }}
              />
            )}
            </div>
          </div>
        )}
      </main>

      {/* 3. Ergonomic Bottom Navigation Bar (Single Row ~46px + safe-area) */}
      <footer
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          padding: '0.22rem 0.5rem max(0.22rem, env(safe-area-inset-bottom, 0.22rem))',
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
            minHeight: '40px',
            padding: '0 0.35rem',
            borderRadius: '10px',
            fontSize: '0.82rem',
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
            minHeight: '40px',
            padding: '0 0.4rem',
            borderRadius: '10px',
            fontSize: '0.82rem',
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
            minHeight: '40px',
            padding: '0 0.35rem',
            borderRadius: '10px',
            fontSize: '0.82rem',
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
