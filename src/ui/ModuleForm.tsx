import { useState, type ReactElement } from 'react';
import type { Material, EdgeBand, JointStrategy, Project, ProjectModuleItem } from '../model';
import type {
  TemplateDefinition,
  RoofType,
  JointPriority,
  BackingType,
  RearStructuralRails,
  BayContent,
  DrawerSlideType,
  DrawerFrontMount,
  DrawerType,
  DrawerBottomMount,
  DoorMountType,
  TrackSize,
  BracketType,
  WallType,
  LoadCategory,
  BoundaryCondition,
  OverhangMode,
  WallShelvingOutput,
} from '../resolver';
import { resolveTracks } from '../resolver';
import { translateTemplateName, translateEdgeBandKind, t } from './localization';
import { NumericInput } from './NumericInput';
import { DrawerTracksInput } from './DrawerTracksInput';
import { DEFAULT_UI_CONFIG } from '../config';

export interface ModuleFormProps {
  // Multi-Module Project Management
  project?: Project | null;
  projectModules?: ProjectModuleItem[];
  activeModuleId?: string;
  onSetActiveModule?: (moduleId: string) => void;
  onAddProjectModule?: (name?: string, templateId?: string) => void;
  onDuplicateProjectModule?: (moduleId: string) => void;
  onRemoveProjectModule?: (moduleId: string) => void;
  onUpdateProjectModuleQuantity?: (moduleId: string, quantity: number) => void;
  onUpdateProjectModuleName?: (moduleId: string, name: string) => void;
  onSaveProject?: () => Promise<void> | void;
  projectScope?: 'current-module' | 'all-modules';
  onProjectScopeChange?: (scope: 'current-module' | 'all-modules') => void;

  width: number;
  height: number;
  depth: number;
  templates?: TemplateDefinition[];
  selectedTemplateId?: string;
  materials: Material[];
  edgeBands: EdgeBand[];
  selectedMaterialId: string;
  selectedEdgeBandId: string;
  jointStrategy?: JointStrategy;
  isSaving: boolean;
  onWidthChange: (val: number) => void;
  onHeightChange: (val: number) => void;
  onDepthChange: (val: number) => void;
  onTemplateChange?: (id: string) => void;
  onMaterialChange: (id: string) => void;
  onEdgeBandChange: (id: string) => void;
  onSave: () => void;
  onExportCsv?: () => void;
  onExportPdf?: () => void;
  // Modular builder state & actions
  isCustomModular?: boolean;
  roofType?: RoofType;
  jointPriority?: JointPriority;
  hasBacking?: boolean;
  gridType?: '1-bay' | '2-bays-vertical' | '3-bays-vertical' | '2-bays-horizontal';
  bays?: BayContent[];
  activeBayIndex?: number;
  frontsMaterialId?: string;
  drawerBoxesMaterialId?: string;
  backingsMaterialId?: string;
  onRoofTypeChange?: (roof: RoofType) => void;
  onJointPriorityChange?: (priority: JointPriority) => void;
  onHasBackingChange?: (hasBacking: boolean) => void;
  onGridTypeChange?: (gridType: '1-bay' | '2-bays-vertical' | '3-bays-vertical' | '2-bays-horizontal') => void;
  onActiveBayIndexChange?: (idx: number) => void;
  onBayContentTypeChange?: (
    bayIndex: number,
    type: 'empty' | 'shelves' | 'drawer-stack' | 'doors' | 'pull-out-tray' | 'bi-fold-closure',
  ) => void;
  onAddShelf?: (bayIndex: number) => void;
  onRemoveShelf?: (bayIndex: number) => void;
  onShelfTypeChange?: (bayIndex: number, type: 'adjustable' | 'fixed') => void;
  onShelfAntiSagChange?: (bayIndex: number, hasAntiSag: boolean) => void;
  onAddDrawer?: (bayIndex: number) => void;
  onRemoveDrawer?: (bayIndex: number) => void;
  onDrawerFrontMountChange?: (bayIndex: number, mount: DrawerFrontMount) => void;
  onDrawerSlideTypeChange?: (bayIndex: number, slide: DrawerSlideType) => void;
  onDrawerSlideClearanceChange?: (bayIndex: number, clearanceMm: number) => void;
  onDrawerTracksChange?: (bayIndex: number, tracks: TrackSize[]) => void;
  onDrawerGapChange?: (bayIndex: number, gapMm: number) => void;
  onDrawerTransomsChange?: (bayIndex: number, hasTransoms: boolean) => void;
  onDrawerTypeChange?: (bayIndex: number, type: DrawerType) => void;
  onDrawerBottomMountChange?: (bayIndex: number, mount: DrawerBottomMount) => void;
  onDrawerTopPullGapChange?: (bayIndex: number, gapMm: number) => void;
  onDrawerBoxSideHeightOffsetChange?: (bayIndex: number, offsetMm: number) => void;
  onDoorCountChange?: (bayIndex: number, count: 1 | 2) => void;
  onDoorMountTypeChange?: (bayIndex: number, mount: DoorMountType) => void;
  onBifoldDirectionChange?: (bayIndex: number, dir: 'vertical-lift' | 'horizontal-book') => void;
  onFrontsMaterialChange?: (id: string) => void;
  onDrawerBoxesMaterialChange?: (id: string) => void;
  onBackingsMaterialChange?: (id: string) => void;
  partitionPassThroughRoof?: boolean;
  onPartitionPassThroughRoofChange?: (val: boolean) => void;
  structuralSpanWarnings?: string[];
  maxDrawerSpanMm?: number;
  onJointStrategyChange?: (strategy: JointStrategy) => void;
  onView3dClick?: () => void;
  onSwitchToSiteMode?: () => void;
  onSaveUserTemplate?: (name: string, description?: string) => Promise<void> | void;
  onDeleteUserTemplate?: (id: string) => Promise<void> | void;
  // Base structure & reinforcement props (Point 7)
  railOrientation?: 'horizontal' | 'vertical';
  hasMiddleBrace?: boolean;
  middleBraceWidthMm?: number;
  hasWallHangingRail?: boolean;
  wallHangingRailWidthMm?: number;
  hasPlinth?: boolean;
  plinthHeightMm?: number;
  plinthSetbackMm?: number;
  onRailOrientationChange?: (val: 'horizontal' | 'vertical') => void;
  onHasMiddleBraceChange?: (val: boolean) => void;
  onMiddleBraceWidthChange?: (val: number) => void;
  onHasWallHangingRailChange?: (val: boolean) => void;
  onWallHangingRailWidthChange?: (val: number) => void;
  onHasPlinthChange?: (val: boolean) => void;
  onPlinthHeightChange?: (val: number) => void;
  onPlinthSetbackChange?: (val: number) => void;
  // Door interior shelves (Point 3)
  onDoorInteriorShelvesCountChange?: (bayIndex: number, count: number) => void;
  onDoorShelfTypeChange?: (bayIndex: number, shelfType: 'adjustable' | 'fixed') => void;
  // Backing, Island & Rear Rails (Points 4, 5, 6)
  backingType?: BackingType;
  backingThicknessMm?: number;
  isIslandCabinet?: boolean;
  rearStructuralRails?: RearStructuralRails;
  rearStructuralRailsWidthMm?: number;
  onBackingTypeChange?: (val: BackingType) => void;
  onBackingThicknessChange?: (val: number) => void;
  onIsIslandCabinetChange?: (val: boolean) => void;
  onRearStructuralRailsChange?: (val: RearStructuralRails) => void;
  onRearStructuralRailsWidthChange?: (val: number) => void;
  // Wall Shelves props
  wallShelvesBracketType?: BracketType;
  wallShelvesWallType?: WallType;
  wallShelvesLoadCategory?: LoadCategory;
  wallShelvesBoundaryCondition?: BoundaryCondition;
  wallShelvesOverhangMode?: OverhangMode;
  wallShelvesShelfCount?: number;
  wallShelvesVerticalSpacingMm?: number;
  wallShelvesBaseElevationYMm?: number;
  wallShelvingOutput?: WallShelvingOutput | null;
  onWallShelvesBracketTypeChange?: (type: BracketType) => void;
  onWallShelvesWallTypeChange?: (type: WallType) => void;
  onWallShelvesLoadCategoryChange?: (cat: LoadCategory) => void;
  onWallShelvesBoundaryConditionChange?: (cond: BoundaryCondition) => void;
  onWallShelvesOverhangModeChange?: (mode: OverhangMode) => void;
  onWallShelvesShelfCountChange?: (count: number) => void;
  onWallShelvesVerticalSpacingMmChange?: (spacing: number) => void;
  onWallShelvesBaseElevationYMmChange?: (elev: number) => void;
  onViewAssemblyClick?: () => void;
}

/**
 * Module configuration form component with Argentine Spanish localization and M3 styles.
 * Supports interactive builder controls: drawers, shelves, covers, doors, partitions, and roofs.
 */
export function ModuleForm(props: ModuleFormProps): ReactElement {
  const {
    project,
    projectModules,
    activeModuleId,
    onSetActiveModule,
    onAddProjectModule,
    onDuplicateProjectModule,
    onRemoveProjectModule,
    onUpdateProjectModuleQuantity,
    onUpdateProjectModuleName,
    onSaveProject,
    projectScope = 'current-module',
    onProjectScopeChange,
    width,
    height,
    depth,
    templates,
    selectedTemplateId,
    materials,
    edgeBands,
    selectedMaterialId,
    selectedEdgeBandId,
    jointStrategy = 'confirmat',
    isSaving,
    onWidthChange,
    onHeightChange,
    onDepthChange,
    onTemplateChange,
    onMaterialChange,
    onEdgeBandChange,
    onSave,
    onExportCsv,
    onExportPdf,
    onSaveUserTemplate,
    onDeleteUserTemplate,
    roofType = 'front-back-rails',
    jointPriority = 'lateral-over-bottom',
    hasBacking = true,
    gridType = '1-bay',
    bays = [{ type: 'shelves', count: 1, shelfType: 'adjustable', setbackMm: 20 }],
    activeBayIndex = 0,
    frontsMaterialId = '',
    drawerBoxesMaterialId = '',
    backingsMaterialId = '',
    onRoofTypeChange,
    onJointPriorityChange,
    onHasBackingChange,
    onGridTypeChange,
    onActiveBayIndexChange,
    onBayContentTypeChange,
    onAddShelf,
    onRemoveShelf,
    onShelfTypeChange,
    onShelfAntiSagChange,
    onAddDrawer,
    onRemoveDrawer,
    onDrawerFrontMountChange,
    onDrawerSlideTypeChange,
    onDrawerSlideClearanceChange,
    onDrawerTracksChange,
    onDrawerGapChange,
    onDrawerTransomsChange,
    partitionPassThroughRoof = false,
    onPartitionPassThroughRoofChange,
    structuralSpanWarnings = [],
    maxDrawerSpanMm = 900,
    onDrawerTypeChange,
    onDrawerBottomMountChange,
    onDrawerTopPullGapChange,
    onDrawerBoxSideHeightOffsetChange,
    onDoorCountChange,
    onDoorMountTypeChange,
    onBifoldDirectionChange,
    onFrontsMaterialChange,
    onDrawerBoxesMaterialChange,
    onBackingsMaterialChange,
    onJointStrategyChange,
    onView3dClick,
    onSwitchToSiteMode,
    railOrientation = 'horizontal',
    hasMiddleBrace = false,
    middleBraceWidthMm = 80,
    hasWallHangingRail = false,
    wallHangingRailWidthMm = 100,
    hasPlinth = false,
    plinthHeightMm = 100,
    plinthSetbackMm = 50,
    onRailOrientationChange,
    onHasMiddleBraceChange,
    onMiddleBraceWidthChange,
    onHasWallHangingRailChange,
    onWallHangingRailWidthChange,
    onHasPlinthChange,
    onPlinthHeightChange,
    onPlinthSetbackChange,
    onDoorInteriorShelvesCountChange,
    onDoorShelfTypeChange,
    backingType = 'groove',
    backingThicknessMm = 3,
    isIslandCabinet = false,
    rearStructuralRails = 'none',
    rearStructuralRailsWidthMm = 80,
    onBackingTypeChange,
    onBackingThicknessChange,
    onIsIslandCabinetChange,
    onRearStructuralRailsChange,
    onRearStructuralRailsWidthChange,
    wallShelvesBracketType = 'l-bracket',
    wallShelvesWallType = 'solid-brick',
    wallShelvesLoadCategory = 'medium',
    wallShelvesBoundaryCondition = 'free-ends',
    wallShelvesOverhangMode = 'balanced-cantilever',
    wallShelvesShelfCount = 3,
    wallShelvesVerticalSpacingMm = 320,
    wallShelvesBaseElevationYMm = 800,
    wallShelvingOutput,
    onWallShelvesBracketTypeChange,
    onWallShelvesWallTypeChange,
    onWallShelvesLoadCategoryChange,
    onWallShelvesBoundaryConditionChange,
    onWallShelvesOverhangModeChange,
    onWallShelvesShelfCountChange,
    onWallShelvesVerticalSpacingMmChange,
    onWallShelvesBaseElevationYMmChange,
    onViewAssemblyClick,
  } = props;

  const isWallShelves = selectedTemplateId === 'wall-shelves';

  const currentBayCount = gridType === '3-bays-vertical' ? 3 : gridType === '1-bay' ? 1 : 2;
  const currentActiveIndex = Math.min(activeBayIndex, currentBayCount - 1);
  const activeBay = bays[currentActiveIndex] ?? { type: 'empty' };

  const rawThickness = materials.find((m) => m.id === selectedMaterialId)?.thicknessMm;
  const matThickness = typeof rawThickness === 'number' ? rawThickness : 18;
  const estimatedBayCavityHeight = Math.max(
    100,
    Math.round(
      gridType === '2-bays-horizontal'
        ? (height - 3 * matThickness) / 2
        : roofType === 'solid-panel'
        ? height - 2 * matThickness
        : height - matThickness,
    ),
  );

  const resolvedDrawerHeights = (() => {
    if (activeBay.type !== 'drawer-stack' || !activeBay.drawerTracks || activeBay.drawerTracks.length === 0) {
      return [];
    }
    const useTransoms = Boolean(activeBay.hasTransomDividers && activeBay.frontMount === 'inset');
    const res = resolveTracks(
      estimatedBayCavityHeight,
      activeBay.drawerTracks,
      useTransoms ? matThickness : 0,
    );
    return res.tracks.map((t) => t.sizeMm);
  })();

  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDesc, setNewTemplateDesc] = useState('');
  const [showAllRoleMaterials, setShowAllRoleMaterials] = useState(false);

  const hasDoorsOrFronts =
    Boolean(frontsMaterialId) ||
    bays.some(
      (b) =>
        b.type === 'doors' ||
        b.type === 'bi-fold-closure' ||
        (b.type === 'drawer-stack' && b.drawerType !== 'simple-interior'),
    );

  const hasDrawers =
    Boolean(drawerBoxesMaterialId) ||
    bays.some((b) => b.type === 'drawer-stack' || b.type === 'pull-out-tray');

  const hasBackingBoard =
    Boolean(backingsMaterialId) || (hasBacking && backingType !== 'none');

  const activeModuleItem = projectModules?.find((m) => m.id === activeModuleId) ?? projectModules?.[0];
  const totalProjectUnits = projectModules?.reduce((acc, m) => acc + (m.quantity || 1), 0) ?? 1;

  return (
    <section aria-labelledby="form-heading" className="m3-card module-form">
      {/* Project & Multi-Module Manager */}
      {projectModules && projectModules.length > 0 && onSetActiveModule && (
        <section
          aria-labelledby="project-modules-heading"
          className="m3-card"
          style={{
            marginBottom: '1rem',
            padding: '1rem',
            backgroundColor: 'var(--md-sys-color-surface-container)',
            borderRadius: 'var(--md-sys-shape-corner-md)',
            border: '1px solid var(--md-sys-color-outline-variant)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div>
              <h3 id="project-modules-heading" style={{ margin: 0, fontSize: '1rem', color: 'var(--md-sys-color-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>📦 Proyecto: {project?.name ?? 'Mobilius CAD'}</span>
              </h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                {totalProjectUnits} unidad(es) en {projectModules.length} tipo(s) de módulo
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {onSaveProject && (
                <button
                  type="button"
                  className="m3-button m3-button--tonal"
                  style={{
                    minHeight: '48px',
                    padding: '0 0.8rem',
                    fontSize: '0.85rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                  onClick={() => void onSaveProject()}
                  title="Guardar todos los módulos del proyecto en base de datos"
                  aria-label="Guardar proyecto completo"
                >
                  <span>💾</span>
                  <span>Guardar Proyecto</span>
                </button>
              )}
              {onAddProjectModule && (
                <button
                  type="button"
                  className="m3-button m3-button--primary"
                  style={{
                    minHeight: '48px',
                    padding: '0 0.9rem',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                  onClick={() => onAddProjectModule()}
                  aria-label="Agregar nuevo módulo al proyecto"
                >
                  <span>➕</span>
                  <span>Nuevo Módulo</span>
                </button>
              )}
            </div>
          </div>

          {/* Module Selector Chips Carousel */}
          <div
            className="module-chips-carousel"
            style={{
              display: 'flex',
              gap: '0.5rem',
              overflowX: 'auto',
              paddingBottom: '0.4rem',
              marginBottom: '0.75rem',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {projectModules.map((mod) => {
              const isActive = mod.id === (activeModuleId ?? activeModuleItem?.id);
              return (
                <button
                  key={mod.id}
                  type="button"
                  className={`m3-chip ${isActive ? 'm3-chip--selected' : ''}`}
                  style={{
                    minHeight: '48px',
                    padding: '0 1rem',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    flexShrink: 0,
                    cursor: 'pointer',
                  }}
                  onClick={() => onSetActiveModule(mod.id)}
                  aria-pressed={isActive}
                >
                  <span>{isActive ? '📌' : '📦'}</span>
                  <span>{mod.name}</span>
                  <span
                    className="m3-badge m3-badge--neutral"
                    style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.1rem 0.4rem' }}
                  >
                    x{mod.quantity}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Module Editor Card */}
          {activeModuleItem && (
            <div
              style={{
                backgroundColor: 'var(--md-sys-color-surface)',
                borderRadius: '8px',
                padding: '0.75rem',
                border: '1px solid var(--md-sys-color-outline-variant)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                <div style={{ flex: '1 1 200px' }}>
                  <label htmlFor="active-module-name" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Nombre del módulo activo:
                  </label>
                  <input
                    id="active-module-name"
                    type="text"
                    className="m3-input"
                    value={activeModuleItem.name}
                    onChange={(e) => onUpdateProjectModuleName?.(activeModuleItem.id, e.target.value)}
                    style={{ width: '100%', minHeight: '44px' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {onUpdateProjectModuleQuantity && (
                    <div>
                      <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                        Cantidad:
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <button
                          type="button"
                          className="m3-button m3-button--tonal"
                          style={{
                            minWidth: '48px',
                            minHeight: '48px',
                            fontSize: '1.25rem',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          disabled={activeModuleItem.quantity <= 1}
                          onClick={() => onUpdateProjectModuleQuantity(activeModuleItem.id, Math.max(1, activeModuleItem.quantity - 1))}
                          aria-label="Disminuir cantidad del módulo"
                        >
                          −
                        </button>
                        <span
                          style={{
                            minWidth: '42px',
                            textAlign: 'center',
                            fontWeight: 700,
                            fontSize: '1.1rem',
                            color: 'var(--md-sys-color-primary)',
                          }}
                        >
                          {activeModuleItem.quantity}
                        </span>
                        <button
                          type="button"
                          className="m3-button m3-button--tonal"
                          style={{
                            minWidth: '48px',
                            minHeight: '48px',
                            fontSize: '1.25rem',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onClick={() => onUpdateProjectModuleQuantity(activeModuleItem.id, activeModuleItem.quantity + 1)}
                          aria-label="Aumentar cantidad del módulo"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    {onDuplicateProjectModule && (
                      <button
                        type="button"
                        className="m3-button m3-button--tonal"
                        style={{
                          minHeight: '48px',
                          padding: '0 0.75rem',
                          fontSize: '0.82rem',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                        onClick={() => onDuplicateProjectModule(activeModuleItem.id)}
                        title="Duplicar este módulo con todas sus dimensiones y vanos"
                        aria-label="Duplicar módulo activo"
                      >
                        <span>📑</span>
                        <span>Duplicar</span>
                      </button>
                    )}

                    {onRemoveProjectModule && projectModules.length > 1 && (
                      <button
                        type="button"
                        className="m3-button m3-button--outlined"
                        style={{
                          minHeight: '48px',
                          padding: '0 0.75rem',
                          fontSize: '0.82rem',
                          color: 'var(--md-sys-color-error)',
                          borderColor: 'var(--md-sys-color-error)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                        }}
                        onClick={() => {
                          if (window.confirm(`¿Eliminar el módulo "${activeModuleItem.name}" del proyecto?`)) {
                            onRemoveProjectModule(activeModuleItem.id);
                          }
                        }}
                        title="Eliminar este módulo del proyecto"
                        aria-label="Eliminar módulo activo"
                      >
                        <span>🗑️</span>
                        <span>Eliminar</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      <div className="m3-card__header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 id="form-heading" className="m3-card__title">
              📐 Medidas y Armado del Módulo
              <span className="visually-hidden">Module Parameters and Builder</span>
            </h2>
            <p className="m3-card__subtitle">
              Personalizá dimensiones, tapa superior, vanos, cajones y estantes.
            </p>
          </div>
          {onSwitchToSiteMode && (
            <button
              type="button"
              onClick={onSwitchToSiteMode}
              className="m3-button m3-button--tonal"
              aria-label="Cambiar a Modo Obra (control gestual)"
              title="Cambiar al modo táctil con gestos para celular"
              style={{
                minHeight: '48px',
                borderRadius: '24px',
                fontSize: '0.85rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                backgroundColor: 'var(--md-sys-color-primary-container)',
                color: 'var(--md-sys-color-on-primary-container)',
                border: '1px solid var(--md-sys-color-primary)',
              }}
            >
              <span>🏗️</span>
              <span>Modo Obra (Táctil)</span>
            </button>
          )}
        </div>
      </div>

      {templates && templates.length > 0 && onTemplateChange && (
        <div className="form-group template-selection-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label htmlFor="select-template">
              Plantilla base o personalizada:
              <span className="visually-hidden">Module Template:</span>
            </label>
            {onSaveUserTemplate && (
              <button
                type="button"
                className="m3-button m3-button--tonal"
                style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}
                onClick={() => setIsSavingTemplate(!isSavingTemplate)}
              >
                💾 {t('userTemplates.saveButton')}
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
            <select
              id="select-template"
              value={selectedTemplateId}
              onChange={(e) => onTemplateChange(e.target.value)}
              className="m3-select"
              style={{ flex: 1 }}
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id.startsWith('user-') ? `⭐ ${t.name}` : translateTemplateName(t.id, t.name)}
                </option>
              ))}
            </select>

            {selectedTemplateId?.startsWith('user-') && onDeleteUserTemplate && (
              <button
                type="button"
                className="m3-button m3-button--outlined"
                style={{ padding: '0.25rem 0.5rem', color: 'var(--md-sys-color-error)' }}
                title={t('userTemplates.delete')}
                onClick={() => {
                  const currentTpl = templates.find((t) => t.id === selectedTemplateId);
                  const name = currentTpl?.name ?? selectedTemplateId;
                  if (window.confirm(t('userTemplates.deleteConfirm', { name }))) {
                    onDeleteUserTemplate(selectedTemplateId);
                  }
                }}
              >
                🗑️
              </button>
            )}
          </div>

          {isSavingTemplate && (
            <div className="m3-card" style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'var(--md-sys-color-surface-container)' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>{t('userTemplates.saveTitle')}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <input
                  type="text"
                  className="m3-input"
                  placeholder={t('userTemplates.namePlaceholder')}
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  style={{ width: '100%' }}
                />
                <input
                  type="text"
                  className="m3-input"
                  placeholder={t('userTemplates.descPlaceholder')}
                  value={newTemplateDesc}
                  onChange={(e) => setNewTemplateDesc(e.target.value)}
                  style={{ width: '100%' }}
                />
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="m3-button m3-button--outlined"
                    style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                    onClick={() => {
                      setIsSavingTemplate(false);
                      setNewTemplateName('');
                      setNewTemplateDesc('');
                    }}
                  >
                    {t('userTemplates.cancel')}
                  </button>
                  <button
                    type="button"
                    className="m3-button m3-button--filled"
                    style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                    disabled={!newTemplateName.trim()}
                    onClick={async () => {
                      if (!newTemplateName.trim()) return;
                      await onSaveUserTemplate?.(newTemplateName, newTemplateDesc);
                      setIsSavingTemplate(false);
                      setNewTemplateName('');
                      setNewTemplateDesc('');
                    }}
                  >
                    {t('userTemplates.save')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {isWallShelves ? (
        <>
          {/* Dimensiones y Cantidad de Estantes */}
          <fieldset className="builder-section">
            <legend className="builder-section-title">
              <span>📏 Dimensiones y Niveles</span>
            </legend>

            {/* Ancho */}
            <div className="form-group">
              <label htmlFor="input-shelf-width">Ancho del estante (Largo):</label>
              <NumericInput
                id="input-shelf-width"
                min={DEFAULT_UI_CONFIG.dimensions.width.min}
                max={DEFAULT_UI_CONFIG.dimensions.width.max}
                step={DEFAULT_UI_CONFIG.dimensions.width.step}
                value={width}
                showStepper={true}
                unit="mm"
                onChange={onWidthChange}
              />
            </div>

            {/* Profundidad */}
            <div className="form-group">
              <label htmlFor="input-shelf-depth">Profundidad del estante:</label>
              <NumericInput
                id="input-shelf-depth"
                min={DEFAULT_UI_CONFIG.dimensions.depth.min}
                max={DEFAULT_UI_CONFIG.dimensions.depth.max}
                step={DEFAULT_UI_CONFIG.dimensions.depth.step}
                value={depth}
                showStepper={true}
                unit="mm"
                onChange={onDepthChange}
              />
            </div>

            {/* Cantidad de estantes */}
            <div className="form-group">
              <label>Cantidad de estantes:</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="m3-button m3-button--tonal"
                  style={{ width: '40px', height: '40px', fontSize: '1.2rem', padding: 0 }}
                  onClick={() => onWallShelvesShelfCountChange?.(Math.max(1, (wallShelvesShelfCount ?? 3) - 1))}
                  disabled={(wallShelvesShelfCount ?? 3) <= 1}
                >
                  -
                </button>
                <span style={{ fontSize: '1.2rem', fontWeight: 700, minWidth: '40px', textAlign: 'center' }}>
                  {wallShelvesShelfCount ?? 3}
                </span>
                <button
                  type="button"
                  className="m3-button m3-button--tonal"
                  style={{ width: '40px', height: '40px', fontSize: '1.2rem', padding: 0 }}
                  onClick={() => onWallShelvesShelfCountChange?.(Math.min(8, (wallShelvesShelfCount ?? 3) + 1))}
                  disabled={(wallShelvesShelfCount ?? 3) >= 8}
                >
                  +
                </button>
                <span style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                  ({wallShelvesShelfCount ?? 3} niveles verticales)
                </span>
              </div>
            </div>

            {/* Separación vertical */}
            <div className="form-group">
              <label htmlFor="input-shelf-spacing">Separación vertical entre estantes:</label>
              <NumericInput
                id="input-shelf-spacing"
                min={150}
                max={600}
                step={20}
                value={wallShelvesVerticalSpacingMm ?? 320}
                showStepper={true}
                unit="mm"
                onChange={(val) => onWallShelvesVerticalSpacingMmChange?.(val)}
              />
            </div>

            {/* Altura sobre piso */}
            <div className="form-group">
              <label htmlFor="input-shelf-elevation">Altura base sobre piso (NPT):</label>
              <NumericInput
                id="input-shelf-elevation"
                min={100}
                max={2000}
                step={50}
                value={wallShelvesBaseElevationYMm ?? 800}
                showStepper={true}
                unit="mm"
                onChange={(val) => onWallShelvesBaseElevationYMmChange?.(val)}
              />
            </div>
          </fieldset>

          {/* Sistema de Fijación y Ménsulas */}
          <fieldset className="builder-section">
            <legend className="builder-section-title">
              <span>🔩 Sistema de Ménsulas y Fijación</span>
            </legend>

            {/* Tipo de Ménsula */}
            <div className="form-group">
              <label>Tipo de soporte / Ménsula:</label>
              <div className="builder-segmented-group" role="group">
                <button
                  type="button"
                  className={`builder-segmented-btn ${wallShelvesBracketType === 'l-bracket' ? 'selected' : ''}`}
                  onClick={() => onWallShelvesBracketTypeChange?.('l-bracket')}
                >
                  📐 Ménsula L
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${wallShelvesBracketType === 'floating-pin' ? 'selected' : ''}`}
                  onClick={() => onWallShelvesBracketTypeChange?.('floating-pin')}
                >
                  🔩 Perno Flotante
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${wallShelvesBracketType === 'track-bracket' ? 'selected' : ''}`}
                  onClick={() => onWallShelvesBracketTypeChange?.('track-bracket')}
                >
                  🪜 Cremallera
                </button>
              </div>
            </div>

            {/* Tipo de Pared */}
            <div className="form-group">
              <label>Tipo de pared:</label>
              <div className="builder-segmented-group" role="group">
                <button
                  type="button"
                  className={`builder-segmented-btn ${wallShelvesWallType === 'solid-brick' ? 'selected' : ''}`}
                  onClick={() => onWallShelvesWallTypeChange?.('solid-brick')}
                >
                  🧱 Maciza / Hormigón
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${wallShelvesWallType === 'hollow-brick' ? 'selected' : ''}`}
                  onClick={() => onWallShelvesWallTypeChange?.('hollow-brick')}
                >
                  🕳️ Ladrillo Hueco
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${wallShelvesWallType === 'drywall' ? 'selected' : ''}`}
                  onClick={() => onWallShelvesWallTypeChange?.('drywall')}
                >
                  📄 Durlock / Yeso
                </button>
              </div>
            </div>

            {/* Carga esperada */}
            <div className="form-group">
              <label>Carga esperada:</label>
              <div className="builder-segmented-group" role="group">
                <button
                  type="button"
                  className={`builder-segmented-btn ${wallShelvesLoadCategory === 'light' ? 'selected' : ''}`}
                  onClick={() => onWallShelvesLoadCategoryChange?.('light')}
                >
                  🪴 Liviana (15 kg/m²)
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${wallShelvesLoadCategory === 'medium' ? 'selected' : ''}`}
                  onClick={() => onWallShelvesLoadCategoryChange?.('medium')}
                >
                  👕 Media (30 kg/m²)
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${wallShelvesLoadCategory === 'heavy' ? 'selected' : ''}`}
                  onClick={() => onWallShelvesLoadCategoryChange?.('heavy')}
                >
                  📚 Pesada / Libros (60 kg/m²)
                </button>
              </div>
            </div>

            {/* Distribución de apoyos */}
            <div className="form-group">
              <label>Distribución de apoyos:</label>
              <div className="builder-segmented-group" role="group">
                <button
                  type="button"
                  className={`builder-segmented-btn ${wallShelvesOverhangMode === 'balanced-cantilever' ? 'selected' : ''}`}
                  onClick={() => onWallShelvesOverhangModeChange?.('balanced-cantilever')}
                >
                  ⚖️ Voladizo estético
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${wallShelvesOverhangMode === 'flush-ends' ? 'selected' : ''}`}
                  onClick={() => onWallShelvesOverhangModeChange?.('flush-ends')}
                >
                  ⏹️ A las puntas
                </button>
                {wallShelvesWallType === 'drywall' && (
                  <button
                    type="button"
                    className={`builder-segmented-btn ${wallShelvesOverhangMode === 'stud-aligned' ? 'selected' : ''}`}
                    onClick={() => onWallShelvesOverhangModeChange?.('stud-aligned')}
                  >
                    📏 A montantes (400mm)
                  </button>
                )}
              </div>
            </div>

            {/* Condición de colocación */}
            <div className="form-group">
              <label>Condición de colocación:</label>
              <div className="builder-segmented-group" role="group">
                <button
                  type="button"
                  className={`builder-segmented-btn ${wallShelvesBoundaryCondition === 'free-ends' ? 'selected' : ''}`}
                  onClick={() => onWallShelvesBoundaryConditionChange?.('free-ends')}
                >
                  ↔️ Extremos libres
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${wallShelvesBoundaryCondition === 'between-walls' ? 'selected' : ''}`}
                  onClick={() => onWallShelvesBoundaryConditionChange?.('between-walls')}
                >
                  🚪 Entre paredes / Nicho
                </button>
              </div>
              <small style={{ color: 'var(--md-sys-color-on-surface-variant)', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                {wallShelvesBoundaryCondition === 'free-ends'
                  ? 'Frente y laterales aplacados con tapacantos; fondo contra pared crudo.'
                  : 'Solo frente aplacado; laterales crudos con descuento de 3 mm de holgura total.'}
              </small>
            </div>
          </fieldset>

          {/* Material y Tapacantos */}
          <fieldset
            className="builder-section"
            style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', overflow: 'hidden' }}
          >
            <legend className="builder-section-title" style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <span>🎨 Materiales y Tapacantos</span>
            </legend>

            <div className="form-group" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
              <label htmlFor="select-shelf-material" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                Placa para Estantes:
              </label>
              <select
                id="select-shelf-material"
                value={selectedMaterialId}
                onChange={(e) => onMaterialChange(e.target.value)}
                className="m3-select"
                style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
              >
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.thicknessMm} mm)
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
              <label htmlFor="select-shelf-edgeband" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                Tapacantos para bordes vistos:
              </label>
              <select
                id="select-shelf-edgeband"
                value={selectedEdgeBandId}
                onChange={(e) => onEdgeBandChange(e.target.value)}
                className="m3-select"
                style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
              >
                {edgeBands.map((eb) => (
                  <option key={eb.id} value={eb.id}>
                    {eb.id} ({translateEdgeBandKind(eb.kind)}, {eb.thicknessMm} mm)
                  </option>
                ))}
              </select>
            </div>
          </fieldset>

          {/* Tarjeta de Diagnóstico Estructural en Tiempo Real */}
          {wallShelvingOutput && (
            <div
              className="m3-card"
              style={{
                marginTop: '1rem',
                padding: '1rem',
                background: wallShelvingOutput.bracketCalculation.warning
                  ? 'var(--md-sys-color-warning-container)'
                  : 'var(--md-sys-color-success-container)',
                border: wallShelvingOutput.bracketCalculation.warning
                  ? '1px solid var(--md-sys-color-warning-border)'
                  : '1px solid var(--md-sys-color-success-border)',
                borderRadius: '8px',
              }}
            >
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', color: 'var(--md-sys-color-on-surface)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {wallShelvingOutput.bracketCalculation.warning ? '⚠️ Advertencia Estructural' : '✅ Diagnóstico Estructural (Sagulator)'}
              </h4>

              {wallShelvingOutput.bracketCalculation.warning && (
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: 'var(--md-sys-color-on-warning-container)', fontWeight: 500 }}>
                  {wallShelvingOutput.bracketCalculation.warning}
                </p>
              )}

              <div style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div>
                  <strong>Ménsulas sugeridas:</strong> {wallShelvingOutput.bracketCalculation.bracketCountPerShelf} por estante ({wallShelvingOutput.bracketCalculation.totalBrackets} totales)
                </div>
                <div>
                  <strong>Separación entre ménsulas:</strong> {wallShelvingOutput.bracketCalculation.maxSpanMm} mm
                </div>
                <div>
                  <strong>Flecha calculada:</strong> {wallShelvingOutput.bracketCalculation.calculatedDeflectionMm} mm (Límite: {wallShelvingOutput.bracketCalculation.allowableDeflectionMm} mm)
                </div>
                <div>
                  <strong>Taco sugerido:</strong> {wallShelvingOutput.bracketCalculation.recommendedAnchor.brandModel}
                </div>
                <div>
                  <strong>Tornillo pared:</strong> {wallShelvingOutput.bracketCalculation.recommendedAnchor.screwDiameterMm}x{wallShelvingOutput.bracketCalculation.recommendedAnchor.screwLengthMm} mm (Tracción: ~{wallShelvingOutput.bracketCalculation.pullOutForceKg} kg/soporte)
                </div>
              </div>

              {onViewAssemblyClick && (
                <button
                  type="button"
                  className="m3-button m3-button--filled"
                  style={{ width: '100%', marginTop: '0.75rem', fontSize: '0.85rem' }}
                  onClick={onViewAssemblyClick}
                >
                  📐 Ver Plano de Replanteo en Pared ➔
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Ancho */}
          <div className="form-group">
        <label htmlFor="input-width">
          {t('form.dimensions.width')}
          <span className="visually-hidden">Width (mm):</span>
        </label>
        <NumericInput
          id="input-width"
          min={DEFAULT_UI_CONFIG.dimensions.width.min}
          max={DEFAULT_UI_CONFIG.dimensions.width.max}
          step={DEFAULT_UI_CONFIG.dimensions.width.step}
          value={width}
          showStepper={true}
          unit="mm"
          onChange={onWidthChange}
        />
      </div>

      {/* Alto */}
      <div className="form-group">
        <label htmlFor="input-height">
          {t('form.dimensions.height')}
          <span className="visually-hidden">Height (mm):</span>
        </label>
        <NumericInput
          id="input-height"
          min={DEFAULT_UI_CONFIG.dimensions.height.min}
          max={DEFAULT_UI_CONFIG.dimensions.height.max}
          step={DEFAULT_UI_CONFIG.dimensions.height.step}
          value={height}
          showStepper={true}
          unit="mm"
          onChange={onHeightChange}
        />
      </div>

      {/* Profundidad */}
      <div className="form-group">
        <label htmlFor="input-depth">
          {t('form.dimensions.depth')}
          <span className="visually-hidden">Depth (mm):</span>
        </label>
        <NumericInput
          id="input-depth"
          min={DEFAULT_UI_CONFIG.dimensions.depth.min}
          max={DEFAULT_UI_CONFIG.dimensions.depth.max}
          step={DEFAULT_UI_CONFIG.dimensions.depth.step}
          value={depth}
          showStepper={true}
          unit="mm"
          onChange={onDepthChange}
        />
      </div>

      {/* =========================================================================
          SECCIÓN 1: Casco y Tapa Superior
          ========================================================================= */}
      <fieldset className="builder-section">
        <legend className="builder-section-title">
          <span>🏗️ Estructura del Casco y Techo</span>
        </legend>

        {structuralSpanWarnings && structuralSpanWarnings.length > 0 && (
          <div
            className="m3-alert-banner warning"
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              backgroundColor: 'var(--md-sys-color-warning-container)',
              border: '1px solid var(--md-sys-color-warning-border)',
              color: 'var(--md-sys-color-on-warning-container)',
              fontSize: '0.82rem',
              marginBottom: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            {structuralSpanWarnings.map((warn, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ fontSize: '1rem' }}>⚠️</span>
                <span>{warn}</span>
              </div>
            ))}
          </div>
        )}

        {/* Tapa Superior / Techo */}
        <div className="form-group">
          <label>Tapa superior / Techo:</label>
          <div className="builder-segmented-group" role="group" aria-label="Tipo de tapa superior">
            <button
              type="button"
              className={`builder-segmented-btn ${roofType === 'front-back-rails' ? 'selected' : ''}`}
              onClick={() => onRoofTypeChange?.('front-back-rails')}
            >
              2 Fajas (80mm)
            </button>
            <button
              type="button"
              className={`builder-segmented-btn ${roofType === 'solid-panel' ? 'selected' : ''}`}
              onClick={() => onRoofTypeChange?.('solid-panel')}
            >
              Tapa entera
            </button>
            <button
              type="button"
              className={`builder-segmented-btn ${roofType === 'none' ? 'selected' : ''}`}
              onClick={() => onRoofTypeChange?.('none')}
            >
              Sin tapa
            </button>
          </div>
        </div>

        {/* Unión de Esquinas */}
        <div className="form-group">
          <label>Unión de esquinas:</label>
          <div className="builder-segmented-group" role="group" aria-label="Prioridad de unión de esquinas">
            <button
              type="button"
              className={`builder-segmented-btn ${jointPriority === 'lateral-over-bottom' ? 'selected' : ''}`}
              onClick={() => onJointPriorityChange?.('lateral-over-bottom')}
            >
              Laterales pasan
            </button>
            <button
              type="button"
              className={`builder-segmented-btn ${jointPriority === 'bottom-over-lateral' ? 'selected' : ''}`}
              onClick={() => onJointPriorityChange?.('bottom-over-lateral')}
            >
              Piso pasa
            </button>
          </div>
        </div>

        {/* Fondo y Módulo Isla (Puntos 4, 5, 6) */}
        <div className="form-group">
          <label htmlFor="form-backing-type">Fondo posterior / Módulo Isla:</label>
          <select
            id="form-backing-type"
            className="m3-select"
            style={{ width: '100%', fontSize: '0.85rem' }}
            value={
              isIslandCabinet
                ? 'island'
                : !hasBacking
                ? 'none'
                : backingThicknessMm >= 15
                ? 'solid-thick'
                : backingType === 'overlay'
                ? 'overlay'
                : 'groove'
            }
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'island') {
                onIsIslandCabinetChange?.(true);
                onHasBackingChange?.(false);
              } else if (val === 'none') {
                onIsIslandCabinetChange?.(false);
                onHasBackingChange?.(false);
              } else if (val === 'solid-thick') {
                onIsIslandCabinetChange?.(false);
                onHasBackingChange?.(true);
                onBackingThicknessChange?.(18);
                onBackingTypeChange?.('groove');
              } else if (val === 'overlay') {
                onIsIslandCabinetChange?.(false);
                onHasBackingChange?.(true);
                if (backingThicknessMm >= 15) onBackingThicknessChange?.(3);
                onBackingTypeChange?.('overlay');
              } else {
                // groove
                onIsIslandCabinetChange?.(false);
                onHasBackingChange?.(true);
                if (backingThicknessMm >= 15) onBackingThicknessChange?.(3);
                onBackingTypeChange?.('groove');
              }
            }}
          >
            <option value="groove">Con fondo ranurado</option>
            <option value="overlay">Fondo fino clavado / atornillado posterior</option>
            <option value="solid-thick">Fondo grueso estructural (18mm con confirmat)</option>
            <option value="island">🏝️ Mueble tipo Isla (Sin fondo, cantos traseros aplacados)</option>
            <option value="none">Sin fondo (Abierto)</option>
          </select>
        </div>

        {/* Selector de espesor de fondo cuando es fino (3mm o 6mm) */}
        {hasBacking && !isIslandCabinet && backingThicknessMm < 15 && (
          <div className="form-group" style={{ marginTop: '-0.25rem' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)' }}>Espesor del fondo posterior:</label>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                className={`m3-btn m3-btn--small ${backingThicknessMm <= 3 ? 'm3-btn--primary' : 'm3-btn--outlined'}`}
                style={{ flex: 1, minHeight: '38px', fontSize: '0.8rem' }}
                onClick={() => onBackingThicknessChange?.(3)}
              >
                3 mm (Estándar)
              </button>
              <button
                type="button"
                className={`m3-btn m3-btn--small ${backingThicknessMm > 3 ? 'm3-btn--primary' : 'm3-btn--outlined'}`}
                style={{ flex: 1, minHeight: '38px', fontSize: '0.8rem' }}
                onClick={() => onBackingThicknessChange?.(6)}
              >
                6 mm (Reforzado)
              </button>
            </div>
          </div>
        )}

        {/* Divisores pasantes hasta arriba (Decision 2) */}
        {gridType && gridType !== '1-bay' && (
          <div className="form-group" style={{ marginTop: '0.25rem' }}>
            <label className="m3-checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={Boolean(partitionPassThroughRoof)}
                onChange={(e) => onPartitionPassThroughRoofChange?.(e.target.checked)}
              />
              <span>Divisores pasantes hasta arriba (secciona la tapa/fajas por vano)</span>
            </label>
          </div>
        )}

        {/* Tirantes Estructurales de Amarre (Punto 6) */}
        <div className="form-group">
          <label htmlFor="form-rear-rails">Tirantes estructurales de amarre / escuadra:</label>
          <select
            id="form-rear-rails"
            className="m3-select"
            style={{ width: '100%', fontSize: '0.85rem' }}
            value={rearStructuralRails}
            onChange={(e) => onRearStructuralRailsChange?.(e.target.value as RearStructuralRails)}
          >
            <option value="none">Sin tirantes traseros</option>
            <option value="top-and-bottom">Superior e Inferior (Rigidez y escuadra)</option>
            <option value="top-only">Solo Superior</option>
          </select>
        </div>

        {rearStructuralRails !== 'none' && (
          <div className="form-group" style={{ marginTop: '0.25rem' }}>
            <label htmlFor="form-rear-rails-width" style={{ fontSize: '0.8rem', display: 'block' }}>
              Ancho de tirantes traseros (mm):
            </label>
            <NumericInput
              id="form-rear-rails-width"
              value={rearStructuralRailsWidthMm}
              min={50}
              max={200}
              step={10}
              onChange={(val) => onRearStructuralRailsWidthChange?.(val)}
            />
          </div>
        )}

        {/* Refuerzos Avanzados de Estructura y Zócalo (Punto 7) */}
        {roofType === 'front-back-rails' && (
          <div className="form-group m3-structure-card">
            <label htmlFor="input-rail-orientation" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
              Orientación de Fajas Superiores:
            </label>
            <select
              id="input-rail-orientation"
              className="m3-select"
              style={{ width: '100%', fontSize: '0.85rem' }}
              value={railOrientation}
              onChange={(e) => onRailOrientationChange?.(e.target.value as 'horizontal' | 'vertical')}
            >
              <option value="horizontal">Horizontal (Planos)</option>
              <option value="vertical">Vertical de Canto (Mayor resistencia)</option>
            </select>

            <div style={{ marginTop: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                <input
                  type="checkbox"
                  checked={Boolean(hasMiddleBrace)}
                  onChange={(e) => onHasMiddleBraceChange?.(e.target.checked)}
                />
                Refuerzo central entre fajas
              </label>
              {hasMiddleBrace && (
                <div style={{ marginTop: '0.35rem' }}>
                  <label htmlFor="input-middle-brace-width" style={{ fontSize: '0.75rem', display: 'block' }}>
                    Ancho refuerzo (mm):
                  </label>
                  <NumericInput
                    id="input-middle-brace-width"
                    value={middleBraceWidthMm}
                    min={40}
                    max={250}
                    step={10}
                    onChange={(val) => onMiddleBraceWidthChange?.(val)}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="form-group m3-structure-card">
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={Boolean(hasWallHangingRail)}
                onChange={(e) => onHasWallHangingRailChange?.(e.target.checked)}
              />
              Faja posterior de amarre / colgado a pared
            </label>
            {hasWallHangingRail && (
              <div style={{ marginTop: '0.35rem' }}>
                <label htmlFor="input-wall-rail-width" style={{ fontSize: '0.75rem', display: 'block' }}>
                  Ancho faja (mm):
                </label>
                <NumericInput
                  id="input-wall-rail-width"
                  value={wallHangingRailWidthMm}
                  min={50}
                  max={200}
                  step={10}
                  onChange={(val) => onWallHangingRailWidthChange?.(val)}
                />
              </div>
            )}
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={Boolean(hasPlinth)}
                onChange={(e) => onHasPlinthChange?.(e.target.checked)}
              />
              Zócalo / Plinto estructural integrado
            </label>
            {hasPlinth && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.35rem' }}>
                <div>
                  <label htmlFor="input-plinth-height" style={{ fontSize: '0.75rem', display: 'block' }}>
                    Alto zócalo (mm):
                  </label>
                  <NumericInput
                    id="input-plinth-height"
                    value={plinthHeightMm}
                    min={40}
                    max={200}
                    step={10}
                    onChange={(val) => onPlinthHeightChange?.(val)}
                  />
                </div>
                <div>
                  <label htmlFor="input-plinth-setback" style={{ fontSize: '0.75rem', display: 'block' }}>
                    Retranqueo (mm):
                  </label>
                  <NumericInput
                    id="input-plinth-setback"
                    value={plinthSetbackMm}
                    min={0}
                    max={150}
                    step={5}
                    onChange={(val) => onPlinthSetbackChange?.(val)}
                  />
                </div>
              </div>
            )}
          </div>

          {onSaveUserTemplate && (
            <div style={{ marginTop: '0.75rem' }}>
              <button
                type="button"
                className="m3-btn m3-btn--small m3-btn--tonal"
                style={{ width: '100%' }}
                onClick={() => {
                  const name = window.prompt?.('Nombre para la nueva plantilla de estructura base:', 'Módulo Base Personalizado');
                  if (name) {
                    void onSaveUserTemplate(name, 'Estructura base personalizada con refuerzos');
                  }
                }}
              >
                💾 Guardar Estructura como Módulo Base
              </button>
            </div>
          )}
        </div>
      </fieldset>

      {/* =========================================================================
          SECCIÓN 2: Distribución de Vanos
          ========================================================================= */}
      <fieldset className="builder-section">
        <legend className="builder-section-title">
          <span>🔲 Distribución de Vanos</span>
        </legend>
        <div className="form-group">
          <label>Divisiones del mueble:</label>
          <div className="builder-segmented-group" role="group" aria-label="Distribución de vanos">
            <button
              type="button"
              className={`builder-segmented-btn ${gridType === '1-bay' ? 'selected' : ''}`}
              onClick={() => onGridTypeChange?.('1-bay')}
            >
              1 Vano único
            </button>
            <button
              type="button"
              className={`builder-segmented-btn ${gridType === '2-bays-vertical' ? 'selected' : ''}`}
              onClick={() => onGridTypeChange?.('2-bays-vertical')}
            >
              2 Vanos (Parante)
            </button>
            <button
              type="button"
              className={`builder-segmented-btn ${gridType === '3-bays-vertical' ? 'selected' : ''}`}
              onClick={() => onGridTypeChange?.('3-bays-vertical')}
            >
              3 Vanos
            </button>
            <button
              type="button"
              className={`builder-segmented-btn ${gridType === '2-bays-horizontal' ? 'selected' : ''}`}
              onClick={() => onGridTypeChange?.('2-bays-horizontal')}
            >
              2 Niveles
            </button>
          </div>
        </div>
      </fieldset>

      {/* =========================================================================
          SECCIÓN 3: Equipamiento Interior (Cajones, Estantes, Puertas, Tapas)
          ========================================================================= */}
      <fieldset className="builder-section">
        <legend className="builder-section-title">
          <span>🚪 Equipamiento Interior</span>
        </legend>

        {/* Pestañas si hay más de 1 vano */}
        {currentBayCount > 1 && (
          <div className="builder-bay-tab-row" role="tablist" aria-label="Seleccionar vano para equipar">
            {Array.from({ length: currentBayCount }, (_, idx) => (
              <button
                key={idx}
                type="button"
                className={`m3-chip ${currentActiveIndex === idx ? 'm3-chip--selected' : ''}`}
                onClick={() => onActiveBayIndexChange?.(idx)}
                role="tab"
                aria-selected={currentActiveIndex === idx}
              >
                Vano {idx + 1} {idx === 0 ? '(Izq)' : idx === 1 ? '(Der)' : `(${idx + 1})`}
              </button>
            ))}
          </div>
        )}

        {/* Tipo de componente en el vano activo */}
        <div className="form-group">
          <label>¿Qué querés armar en este vano?</label>
          <div className="builder-chip-selector" role="group" aria-label="Componente interior">
            <button
              type="button"
              className={`builder-segmented-btn ${activeBay.type === 'drawer-stack' ? 'selected' : ''}`}
              onClick={() => onBayContentTypeChange?.(currentActiveIndex, 'drawer-stack')}
            >
              🗄️ Cajones
            </button>
            <button
              type="button"
              className={`builder-segmented-btn ${activeBay.type === 'shelves' ? 'selected' : ''}`}
              onClick={() => onBayContentTypeChange?.(currentActiveIndex, 'shelves')}
            >
              📚 Estantes
            </button>
            <button
              type="button"
              className={`builder-segmented-btn ${activeBay.type === 'doors' ? 'selected' : ''}`}
              onClick={() => onBayContentTypeChange?.(currentActiveIndex, 'doors')}
            >
              🚪 Puertas
            </button>
            <button
              type="button"
              className={`builder-segmented-btn ${activeBay.type === 'pull-out-tray' ? 'selected' : ''}`}
              onClick={() => onBayContentTypeChange?.(currentActiveIndex, 'pull-out-tray')}
            >
              📥 Bandeja
            </button>
            <button
              type="button"
              className={`builder-segmented-btn ${activeBay.type === 'bi-fold-closure' ? 'selected' : ''}`}
              onClick={() => onBayContentTypeChange?.(currentActiveIndex, 'bi-fold-closure')}
            >
              🔼 Bi-Fold
            </button>
            <button
              type="button"
              className={`builder-segmented-btn ${activeBay.type === 'empty' ? 'selected' : ''}`}
              onClick={() => onBayContentTypeChange?.(currentActiveIndex, 'empty')}
            >
              ⬜ Libre
            </button>
          </div>
        </div>

        {/* Controles para Cajones */}
        {activeBay.type === 'drawer-stack' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="form-group">
              <label>Cantidad de cajones:</label>
              <div className="m3-stepper-field">
                <button
                  type="button"
                  className="m3-stepper-btn"
                  aria-label="Quitar un cajón"
                  onClick={() => onRemoveDrawer?.(currentActiveIndex)}
                >
                  −
                </button>
                <div className="builder-stepper-display">
                  {`${activeBay.drawerTracks.length} Cajones`}
                </div>
                <button
                  type="button"
                  className="m3-stepper-btn"
                  aria-label="Agregar un cajón"
                  onClick={() => onAddDrawer?.(currentActiveIndex)}
                >
                  +
                </button>
              </div>
            </div>

            {/* Definición de pistas estilo CSS Grid (Proporciones y Medidas) */}
            <div className="form-group" style={{ padding: '0.75rem', backgroundColor: 'var(--md-sys-color-surface-container-low)', borderRadius: 'var(--md-sys-shape-corner-sm)', border: '1px solid var(--md-sys-color-outline-variant)' }}>
              <label htmlFor="input-grid-tracks" style={{ fontWeight: 600, color: 'var(--md-sys-color-primary)', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.35rem' }}>
                📐 Medidas de cajones (mm, fr o mixto):
              </label>
              <DrawerTracksInput
                tracks={activeBay.drawerTracks}
                onChange={(parsed) => onDrawerTracksChange?.(currentActiveIndex, parsed)}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
                <span style={{ font: 'var(--md-sys-typescale-label-small)', color: 'var(--md-sys-color-on-surface-variant)', marginRight: '0.25rem' }}>
                  Atajos rápidos:
                </span>
                {DEFAULT_UI_CONFIG.quickTrackRecipes.map((recipe, rIdx) => (
                  <button
                    key={rIdx}
                    type="button"
                    className="m3-chip"
                    style={{ height: '30px', padding: '0 0.65rem', fontSize: '0.78rem' }}
                    onClick={() =>
                      onDrawerTracksChange?.(currentActiveIndex, recipe.tracks as TrackSize[])
                    }
                  >
                    {recipe.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Visualizador de proporción y alturas calculadas */}
            {resolvedDrawerHeights.length > 0 && (
              <div className="form-group" style={{ padding: '0.65rem', backgroundColor: 'var(--md-sys-color-surface-container-low)', borderRadius: 'var(--md-sys-shape-corner-sm)', border: '1px solid var(--md-sys-color-outline-variant)' }}>
                <span style={{ font: 'var(--md-sys-typescale-label-medium)', fontWeight: 600, color: 'var(--md-sys-color-primary)', display: 'block', marginBottom: '0.4rem' }}>
                  📊 Alturas reales calculadas ({estimatedBayCavityHeight} mm luz libre):
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', borderRadius: '4px', overflow: 'hidden' }}>
                  {resolvedDrawerHeights.map((h, i) => {
                    const track = activeBay.drawerTracks[i];
                    const isFixed = track?.type === 'fixed';
                    const trackLabel = isFixed ? `${track.valueMm}mm fijo` : `${track?.valueFr ?? 1}fr prop.`;
                    const pct = Math.max(14, Math.round((h / Math.max(1, estimatedBayCavityHeight)) * 100));
                    return (
                      <div
                        key={i}
                        style={{
                          minHeight: `${Math.max(28, Math.round(pct * 0.75))}px`,
                          backgroundColor: isFixed ? 'var(--md-sys-color-tertiary-container)' : 'var(--md-sys-color-primary-container)',
                          color: isFixed ? 'var(--md-sys-color-on-tertiary-container)' : 'var(--md-sys-color-on-primary-container)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                        }}
                      >
                        <span>{`Cajón ${i + 1}${i === 0 ? ' (Superior)' : i === activeBay.drawerTracks.length - 1 ? ' (Inferior)' : ''}: (${trackLabel})`}</span>
                        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{`${h} mm`}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}


            <div className="form-group">
              <label>Tipo de cajón:</label>
              <div className="builder-segmented-group">
                <button
                  type="button"
                  className={`builder-segmented-btn ${activeBay.drawerType !== 'simple-interior' ? 'selected' : ''}`}
                  onClick={() => onDrawerTypeChange?.(currentActiveIndex, 'standard')}
                >
                  Estándar (Doble frente)
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${activeBay.drawerType === 'simple-interior' ? 'selected' : ''}`}
                  onClick={() => onDrawerTypeChange?.(currentActiveIndex, 'simple-interior')}
                >
                  Simple Interior (Placard / 1 tapa)
                </button>
              </div>
            </div>

            {/* Opciones para cajón simple interior de placard */}
            {activeBay.drawerType === 'simple-interior' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', padding: '0.65rem', backgroundColor: 'var(--md-sys-color-surface-container-low)', borderRadius: 'var(--md-sys-shape-corner-sm)', border: '1px solid var(--md-sys-color-outline-variant)' }}>
                <div>
                  <label htmlFor="drawer-top-pull" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                    Ranura superior para tirar:
                  </label>
                  <select
                    id="drawer-top-pull"
                    className="m3-select"
                    style={{ width: '100%', fontSize: '0.85rem' }}
                    value={activeBay.topPullGapMm ?? 0}
                    onChange={(e) => onDrawerTopPullGapChange?.(currentActiveIndex, Number(e.target.value))}
                  >
                    <option value="0">0 mm (Con tirador)</option>
                    <option value="25">25 mm (Mano / Uñero)</option>
                    <option value="30">30 mm (Acceso estándar)</option>
                    <option value="35">35 mm (Acceso amplio)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="drawer-side-offset" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                    Laterales más bajos que frente:
                  </label>
                  <select
                    id="drawer-side-offset"
                    className="m3-select"
                    style={{ width: '100%', fontSize: '0.85rem' }}
                    value={activeBay.boxSideHeightOffsetMm ?? 0}
                    onChange={(e) => onDrawerBoxSideHeightOffsetChange?.(currentActiveIndex, Number(e.target.value))}
                  >
                    <option value="0">Misma altura</option>
                    <option value="30">30 mm más bajos</option>
                    <option value="40">40 mm más bajos</option>
                    <option value="50">50 mm más bajos</option>
                  </select>
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Construcción del fondo:</label>
              <div className="builder-segmented-group">
                <button
                  type="button"
                  className={`builder-segmented-btn ${activeBay.bottomMount === 'grooved' ? 'selected' : ''}`}
                  onClick={() => onDrawerBottomMountChange?.(currentActiveIndex, 'grooved')}
                >
                  Ranurado (3-6 mm)
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${!activeBay.bottomMount || activeBay.bottomMount === 'bottom-screwed' ? 'selected' : ''}`}
                  onClick={() => onDrawerBottomMountChange?.(currentActiveIndex, 'bottom-screwed')}
                >
                  Atornillado/Clavado por debajo
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${activeBay.bottomMount === 'flush-thick' ? 'selected' : ''}`}
                  onClick={() => onDrawerBottomMountChange?.(currentActiveIndex, 'flush-thick')}
                >
                  Grueso embutido (15/18 mm)
                </button>
              </div>
            </div>

            {/* Montaje de frentes (solo si es estándar) */}
            {activeBay.drawerType !== 'simple-interior' && (
              <div className="form-group">
                <label>Montaje de frentes:</label>
                <div className="builder-segmented-group">
                  <button
                    type="button"
                    className={`builder-segmented-btn ${activeBay.frontMount === 'applied' ? 'selected' : ''}`}
                    onClick={() => onDrawerFrontMountChange?.(currentActiveIndex, 'applied')}
                  >
                    Aplicado (Solapado)
                  </button>
                  <button
                    type="button"
                    className={`builder-segmented-btn ${activeBay.frontMount === 'inset' ? 'selected' : ''}`}
                    onClick={() => onDrawerFrontMountChange?.(currentActiveIndex, 'inset')}
                  >
                    Embutido
                  </button>
                </div>
              </div>
            )}

            {/* Travesaños separadores para cajones embutidos */}
            {activeBay.frontMount === 'inset' && (
              <div className="form-group">
                <label>Travesaños horizontales entre cajones:</label>
                <div className="builder-segmented-group">
                  <button
                    type="button"
                    className={`builder-segmented-btn ${activeBay.hasTransomDividers ? 'selected' : ''}`}
                    onClick={() => onDrawerTransomsChange?.(currentActiveIndex, true)}
                  >
                    Con fajas separadoras
                  </button>
                  <button
                    type="button"
                    className={`builder-segmented-btn ${!activeBay.hasTransomDividers ? 'selected' : ''}`}
                    onClick={() => onDrawerTransomsChange?.(currentActiveIndex, false)}
                  >
                    Sin fajas (frente corrido)
                  </button>
                </div>
              </div>
            )}

            {width > maxDrawerSpanMm && (!gridType || gridType === '1-bay') && (
              <div
                className="m3-alert-banner warning"
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  backgroundColor: 'var(--md-sys-color-warning-container)',
                  border: '1px solid var(--md-sys-color-warning-border)',
                  color: 'var(--md-sys-color-on-warning-container)',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '10px',
                }}
              >
                <span>⚠️</span>
                <span>
                  <strong>Cajón muy ancho ({width} mm):</strong> Supera el estándar de {maxDrawerSpanMm} mm. Conviene dividir el mueble en 2 vanos verticales para asegurar el buen funcionamiento de las correderas.
                </span>
              </div>
            )}

            <div className="form-group">
              <label>Tipo de correderas:</label>
              <div className="builder-segmented-group">
                <button
                  type="button"
                  className={`builder-segmented-btn ${activeBay.slideType === 'telescopic' ? 'selected' : ''}`}
                  onClick={() => onDrawerSlideTypeChange?.(currentActiveIndex, 'telescopic')}
                >
                  Telescópicas (25.4mm)
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${activeBay.slideType === 'undermount' ? 'selected' : ''}`}
                  onClick={() => onDrawerSlideTypeChange?.(currentActiveIndex, 'undermount')}
                >
                  Ocultas (Bajo Fondo)
                </button>
              </div>
            </div>

            {/* Holgura lateral de correderas */}
            <div className="form-group">
              <label>Holgura lateral total de correderas:</label>
              <div className="m3-stepper-field">
                <button
                  type="button"
                  className="m3-stepper-btn"
                  aria-label="Disminuir holgura de correderas 0.5 mm"
                  onClick={() => {
                    const current = activeBay.slideClearanceMm ?? (activeBay.slideType === 'undermount' ? 10.0 : 25.4);
                    onDrawerSlideClearanceChange?.(currentActiveIndex, Math.max(5.0, Math.round((current - 0.5) * 10) / 10));
                  }}
                >
                  −
                </button>
                <div className="builder-stepper-display">
                  {`${(activeBay.slideClearanceMm ?? (activeBay.slideType === 'undermount' ? 10.0 : 25.4)).toFixed(1)} mm`}
                </div>
                <button
                  type="button"
                  className="m3-stepper-btn"
                  aria-label="Aumentar holgura de correderas 0.5 mm"
                  onClick={() => {
                    const current = activeBay.slideClearanceMm ?? (activeBay.slideType === 'undermount' ? 10.0 : 25.4);
                    onDrawerSlideClearanceChange?.(currentActiveIndex, Math.min(50.0, Math.round((current + 0.5) * 10) / 10));
                  }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Separación entre frentes (luz) */}
            <div className="form-group">
              <label>Separación entre frentes (luz):</label>
              <div className="m3-stepper-field">
                <button
                  type="button"
                  className="m3-stepper-btn"
                  aria-label="Disminuir separación entre cajones 0.5 mm"
                  onClick={() => {
                    const currentGap = activeBay.gapMm ?? 2.5;
                    onDrawerGapChange?.(currentActiveIndex, Math.max(1.0, Math.round((currentGap - 0.5) * 10) / 10));
                  }}
                >
                  −
                </button>
                <div className="builder-stepper-display">
                  {`${(activeBay.gapMm ?? 2.5).toFixed(1)} mm`}
                </div>
                <button
                  type="button"
                  className="m3-stepper-btn"
                  aria-label="Aumentar separación entre cajones 0.5 mm"
                  onClick={() => {
                    const currentGap = activeBay.gapMm ?? 2.5;
                    onDrawerGapChange?.(currentActiveIndex, Math.min(8.0, Math.round((currentGap + 0.5) * 10) / 10));
                  }}
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Controles para Estantes */}
        {activeBay.type === 'shelves' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="form-group">
              <label>Cantidad de estantes:</label>
              <div className="m3-stepper-field">
                <button
                  type="button"
                  className="m3-stepper-btn"
                  aria-label="Quitar un estante"
                  onClick={() => onRemoveShelf?.(currentActiveIndex)}
                >
                  −
                </button>
                <div className="builder-stepper-display">
                  {`${activeBay.count} ${activeBay.count === 1 ? 'Estante' : 'Estantes'}`}
                </div>
                <button
                  type="button"
                  className="m3-stepper-btn"
                  aria-label="Agregar un estante"
                  onClick={() => onAddShelf?.(currentActiveIndex)}
                >
                  +
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Tipo de fijación:</label>
              <div className="builder-segmented-group">
                <button
                  type="button"
                  className={`builder-segmented-btn ${activeBay.shelfType === 'adjustable' ? 'selected' : ''}`}
                  onClick={() => onShelfTypeChange?.(currentActiveIndex, 'adjustable')}
                >
                  Regulables (Pitagones 5mm)
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${activeBay.shelfType === 'fixed' ? 'selected' : ''}`}
                  onClick={() => onShelfTypeChange?.(currentActiveIndex, 'fixed')}
                >
                  Fijos (Confirmats)
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Refuerzo antialabeo:</label>
              <div className="builder-segmented-group">
                <button
                  type="button"
                  className={`builder-segmented-btn ${activeBay.hasAntiSagBrace ? 'selected' : ''}`}
                  onClick={() => onShelfAntiSagChange?.(currentActiveIndex, true)}
                >
                  Con faja de refuerzo
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${!activeBay.hasAntiSagBrace ? 'selected' : ''}`}
                  onClick={() => onShelfAntiSagChange?.(currentActiveIndex, false)}
                >
                  Sin refuerzo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Controles para Puertas */}
        {activeBay.type === 'doors' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="form-group">
              <label>Cantidad de hojas:</label>
              <div className="builder-segmented-group">
                <button
                  type="button"
                  className={`builder-segmented-btn ${activeBay.count === 1 ? 'selected' : ''}`}
                  onClick={() => onDoorCountChange?.(currentActiveIndex, 1)}
                >
                  1 Puerta batiente
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${activeBay.count === 2 ? 'selected' : ''}`}
                  onClick={() => onDoorCountChange?.(currentActiveIndex, 2)}
                >
                  2 Puertas batientes
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Montaje de puerta (Bisagra cazoleta):</label>
              <div className="builder-segmented-group" role="group" aria-label="Tipo de bisagra cazoleta">
                <button
                  type="button"
                  className={`builder-segmented-btn ${activeBay.mountType === 'codo-0' || activeBay.mountType === 'full-overlay' || activeBay.mountType === 'overlay' ? 'selected' : ''}`}
                  onClick={() => onDoorMountTypeChange?.(currentActiveIndex, 'codo-0')}
                  title="Bisagra recta / Solapado total. Tapa el canto lateral (Base a 37mm)"
                >
                  Codo 0 (Recta)
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${activeBay.mountType === 'codo-9' || activeBay.mountType === 'half-overlay' ? 'selected' : ''}`}
                  onClick={() => onDoorMountTypeChange?.(currentActiveIndex, 'codo-9')}
                  title="Bisagra acodada / Semi-solapada. Comparte tabique central (Base a 37mm)"
                >
                  Codo 9 (Acodada)
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${activeBay.mountType === 'codo-18' || activeBay.mountType === 'inset' ? 'selected' : ''}`}
                  onClick={() => onDoorMountTypeChange?.(currentActiveIndex, 'codo-18')}
                  title="Bisagra superacodada / Embutida. Puerta dentro del vano (Base a 37mm + espesor)"
                >
                  Codo 18 (Embutida)
                </button>
              </div>
            </div>

            {/* Estantes interiores detrás de puertas (Punto 3) */}
            <div className="form-group" style={{ marginTop: '0.25rem', borderTop: '1px solid var(--md-sys-color-outline-variant)', paddingTop: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                <span>📚 Estantes interiores:</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)', fontWeight: 'normal' }}>
                  ({activeBay.interiorShelvesCount ?? 0} estante{(activeBay.interiorShelvesCount ?? 0) === 1 ? '' : 's'})
                </span>
              </label>
              <div className="builder-segmented-group">
                {[0, 1, 2, 3].map((num) => (
                  <button
                    key={num}
                    type="button"
                    className={`builder-segmented-btn ${(activeBay.interiorShelvesCount ?? 0) === num ? 'selected' : ''}`}
                    onClick={() => onDoorInteriorShelvesCountChange?.(currentActiveIndex, num)}
                  >
                    {num === 0 ? 'Sin estantes' : `${num} est.`}
                  </button>
                ))}
              </div>
            </div>

            {(activeBay.interiorShelvesCount ?? 0) > 0 && (
              <div className="form-group">
                <label>Fijación de estantes interiores:</label>
                <div className="builder-segmented-group">
                  <button
                    type="button"
                    className={`builder-segmented-btn ${(activeBay.shelfType ?? 'adjustable') === 'adjustable' ? 'selected' : ''}`}
                    onClick={() => onDoorShelfTypeChange?.(currentActiveIndex, 'adjustable')}
                  >
                    Ajustables (Pernos)
                  </button>
                  <button
                    type="button"
                    className={`builder-segmented-btn ${activeBay.shelfType === 'fixed' ? 'selected' : ''}`}
                    onClick={() => onDoorShelfTypeChange?.(currentActiveIndex, 'fixed')}
                  >
                    Fijos (Confirmats)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Controles para Bandeja Extraíble */}
        {activeBay.type === 'pull-out-tray' && (
          <div className="m3-alert m3-alert--info">
            <span className="m3-alert__icon" aria-hidden="true">📥</span>
            <div>
              <strong>Bandeja deslizable reforzada:</strong> Corredera telescópica con barandas laterales de retención de 45mm.
            </div>
          </div>
        )}

        {/* Controles para Bi-Fold */}
        {activeBay.type === 'bi-fold-closure' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="form-group">
              <label>Dirección de apertura:</label>
              <div className="builder-segmented-group">
                <button
                  type="button"
                  className={`builder-segmented-btn ${activeBay.openingDirection === 'vertical-lift' ? 'selected' : ''}`}
                  onClick={() => onBifoldDirectionChange?.(currentActiveIndex, 'vertical-lift')}
                >
                  Elevable Vertical (Aventos)
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${activeBay.openingDirection === 'horizontal-book' ? 'selected' : ''}`}
                  onClick={() => onBifoldDirectionChange?.(currentActiveIndex, 'horizontal-book')}
                >
                  Libro Horizontal
                </button>
              </div>
            </div>

            {/* Estantes interiores para bi-fold */}
            <div className="form-group" style={{ marginTop: '0.25rem', borderTop: '1px solid var(--md-sys-color-outline-variant)', paddingTop: '0.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                <span>📚 Estantes interiores:</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)', fontWeight: 'normal' }}>
                  ({activeBay.interiorShelvesCount ?? 0} estante{(activeBay.interiorShelvesCount ?? 0) === 1 ? '' : 's'})
                </span>
              </label>
              <div className="builder-segmented-group">
                {[0, 1, 2, 3].map((num) => (
                  <button
                    key={num}
                    type="button"
                    className={`builder-segmented-btn ${(activeBay.interiorShelvesCount ?? 0) === num ? 'selected' : ''}`}
                    onClick={() => onDoorInteriorShelvesCountChange?.(currentActiveIndex, num)}
                  >
                    {num === 0 ? 'Sin estantes' : `${num} est.`}
                  </button>
                ))}
              </div>
            </div>

            {(activeBay.interiorShelvesCount ?? 0) > 0 && (
              <div className="form-group">
                <label>Fijación de estantes interiores:</label>
                <div className="builder-segmented-group">
                  <button
                    type="button"
                    className={`builder-segmented-btn ${(activeBay.shelfType ?? 'adjustable') === 'adjustable' ? 'selected' : ''}`}
                    onClick={() => onDoorShelfTypeChange?.(currentActiveIndex, 'adjustable')}
                  >
                    Ajustables (Pernos)
                  </button>
                  <button
                    type="button"
                    className={`builder-segmented-btn ${activeBay.shelfType === 'fixed' ? 'selected' : ''}`}
                    onClick={() => onDoorShelfTypeChange?.(currentActiveIndex, 'fixed')}
                  >
                    Fijos (Confirmats)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Controles para Hueco Libre */}
        {activeBay.type === 'empty' && (
          <p style={{ fontStyle: 'italic', color: 'var(--md-sys-color-on-surface-variant)', margin: '0.25rem 0' }}>
            Vano libre sin equipamiento interior. Seleccioná una opción arriba para agregar cajones, estantes o puertas.
          </p>
        )}
      </fieldset>

      {/* =========================================================================
          SECCIÓN 4: Materiales por Rol (Multi-Material)
          ========================================================================= */}
      <fieldset
        className="builder-section"
        style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', overflow: 'hidden' }}
      >
        <legend className="builder-section-title" style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span>🎨 Materiales y Tapacantos</span>
        </legend>

        {/* Material Casco */}
        <div className="form-group" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
          <label htmlFor="select-material" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
            Placa para Casco (Laterales, piso, techo):
            <span className="visually-hidden">Sheet Material:</span>
          </label>
          <select
            id="select-material"
            value={selectedMaterialId}
            onChange={(e) => onMaterialChange(e.target.value)}
            className="m3-select"
            style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
          >
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.thicknessMm} mm)
              </option>
            ))}
          </select>
        </div>

        {/* Material Frentes / Puertas (Contextual) */}
        {onFrontsMaterialChange && (hasDoorsOrFronts || showAllRoleMaterials) && (
          <div className="form-group" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
            <label htmlFor="select-fronts-material" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
              Placa para Frentes / Puertas / Tapas:
            </label>
            <select
              id="select-fronts-material"
              value={frontsMaterialId || selectedMaterialId}
              onChange={(e) => onFrontsMaterialChange(e.target.value)}
              className="m3-select"
              style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
            >
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.thicknessMm} mm)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Material Cajones (Contextual) */}
        {onDrawerBoxesMaterialChange && (hasDrawers || showAllRoleMaterials) && (
          <div className="form-group" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
            <label htmlFor="select-drawer-material" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
              Placa para Cajas de Cajones interiores:
            </label>
            <select
              id="select-drawer-material"
              value={drawerBoxesMaterialId || selectedMaterialId}
              onChange={(e) => onDrawerBoxesMaterialChange(e.target.value)}
              className="m3-select"
              style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
            >
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.thicknessMm} mm)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Material Fondos y Traseras (Contextual) */}
        {onBackingsMaterialChange && (hasBackingBoard || showAllRoleMaterials) && (
          <div className="form-group" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
            <label htmlFor="select-backings-material" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
              Placa para Fondos y Traseras:
            </label>
            <select
              id="select-backings-material"
              value={backingsMaterialId || selectedMaterialId}
              onChange={(e) => onBackingsMaterialChange(e.target.value)}
              className="m3-select"
              style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
            >
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.thicknessMm} mm)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Toggle para mostrar/ocultar todas las placas si alguna no aplica aún */}
        {(!showAllRoleMaterials && (!hasDoorsOrFronts || !hasDrawers || !hasBackingBoard)) && (
          <div style={{ marginBottom: '0.85rem' }}>
            <button
              type="button"
              className="m3-btn m3-btn--small m3-btn--text"
              style={{ fontSize: '0.78rem', padding: '0.2rem 0.4rem', textDecoration: 'underline', color: 'var(--md-sys-color-primary)' }}
              onClick={() => setShowAllRoleMaterials(true)}
            >
              ⚙️ Personalizar más materiales por rol...
            </button>
          </div>
        )}

        {/* Tapacantos */}
        <div className="form-group" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
          <label htmlFor="select-edgeband" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
            Tapacantos:
            <span className="visually-hidden">Edge Band:</span>
          </label>
          <select
            id="select-edgeband"
            value={selectedEdgeBandId}
            onChange={(e) => onEdgeBandChange(e.target.value)}
            className="m3-select"
            style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
          >
            <option value="">Sin tapacanto / Ninguno</option>
            {edgeBands.map((eb) => (
              <option key={eb.id} value={eb.id}>
                {eb.id} ({translateEdgeBandKind(eb.kind)}, {eb.thicknessMm} mm)
              </option>
            ))}
          </select>
        </div>

        {/* Fijaciones / Tipo de Uniones */}
        {onJointStrategyChange && (
          <div className="form-group" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
            <label htmlFor="select-joint-strategy" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
              Fijaciones / Tipo de Uniones:
            </label>
            <select
              id="select-joint-strategy"
              value={jointStrategy}
              onChange={(e) => onJointStrategyChange(e.target.value as JointStrategy)}
              className="m3-select"
              style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
            >
              <option value="confirmat">Confirmat (Tornillo soberbio Ø7 / Ø5 mm)</option>
              <option value="dowel-and-confirmat">Tarugo + Confirmat (Tarugo Ø8 mm + Confirmat Ø7 mm)</option>
              <option value="cam-dowel">Minifix + Tarugo (Caja excéntrica Ø15 mm + Tarugo Ø8 mm)</option>
              <option value="screw">Tornillo Autorroscante (Spax 4x50 mm)</option>
            </select>
          </div>
        )}
      </fieldset>
      </>
    )}

      {/* Alcance de Exportación si hay múltiples módulos */}
      {projectModules && projectModules.length > 1 && onProjectScopeChange && (
        <div style={{ marginTop: '1rem', marginBottom: '0.75rem', padding: '0.75rem', backgroundColor: 'var(--md-sys-color-surface-container)', borderRadius: '8px' }}>
          <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--md-sys-color-on-surface)', marginBottom: '0.4rem' }}>
            Alcance para descargas (CSV / PDF):
          </span>
          <div className="m3-segmented-button" role="radiogroup" aria-label="Alcance para exportaciones" style={{ width: '100%' }}>
            <button
              type="button"
              role="radio"
              aria-checked={projectScope !== 'all-modules'}
              className={`m3-segmented-button__item ${projectScope !== 'all-modules' ? 'selected' : ''}`}
              onClick={() => onProjectScopeChange('current-module')}
              style={{ flex: 1, minHeight: '44px', padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
            >
              📌 Módulo Actual
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={projectScope === 'all-modules'}
              className={`m3-segmented-button__item ${projectScope === 'all-modules' ? 'selected' : ''}`}
              onClick={() => onProjectScopeChange('all-modules')}
              style={{ flex: 1, minHeight: '44px', padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
            >
              📦 Todo el Proyecto ({totalProjectUnits} uds.)
            </button>
          </div>
        </div>
      )}

      {/* Botones de acción */}
      <div className="form-actions m3-button-row">
        {onView3dClick && (
          <button
            type="button"
            onClick={onView3dClick}
            className="m3-btn m3-btn--filled"
            style={{ width: '100%', marginBottom: '0.5rem' }}
          >
            🧊 Ver Resultado en 3D
          </button>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="m3-btn m3-btn--filled"
        >
          {isSaving ? 'Guardando...' : '💾 Guardar Módulo'}
          <span className="visually-hidden">Save Module to Database</span>
        </button>
        {onExportCsv && (
          <button
            type="button"
            onClick={onExportCsv}
            className="m3-btn m3-btn--tonal export-btn"
          >
            📄 Lista de Corte (CSV)
          </button>
        )}
        {onExportPdf && (
          <button
            type="button"
            onClick={onExportPdf}
            className="m3-btn m3-btn--outlined export-btn"
          >
            📑 Diagrama de Corte (PDF)
          </button>
        )}
      </div>
    </section>
  );
}
