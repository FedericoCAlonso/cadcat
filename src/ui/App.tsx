import { useState, useEffect, useRef, type ReactElement } from 'react';
import './theme.css';
import { useModuleViewModel } from './useModuleViewModel';
import { ModuleForm } from './ModuleForm';
import { ModoObraWizard } from './ModoObraWizard';
import { PieceListView } from './PieceListView';
import { Viewport3D } from './Viewport3D';
import { MachiningSheetView } from './MachiningSheetView';
import { ProjectSettingsView } from './ProjectSettingsView';
import { AssemblySheetView } from './AssemblySheetView';
import { CatalogManagerView } from './CatalogManagerView';
import { MachiningEditorModal } from './MachiningEditorModal';
import { CountertopEditorView } from './CountertopEditorView';
import { forcePurgeCacheAndReload } from '../registerServiceWorker';
import { APP_VERSION } from '../version';
import { useTheme } from './useTheme';
import { ThemeToggle } from './ThemeToggle';
import { triggerHaptic } from '../resolver/thumbArc';

/**
 * Main application View component.
 * Implements Google Material Design 3 (M3) layout and MVVM pattern.
 */
export function App(): ReactElement {
  const vm = useModuleViewModel();
  const { themeMode, effectiveTheme, setThemeMode } = useTheme();
  const [machiningPieceId, setMachiningPieceId] = useState<string | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.getRegistration().then((reg) => {
        if (!reg) return;
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                setUpdateAvailable(true);
              }
            });
          }
        });
      });
    }
  }, []);

  const [isLandscape, setIsLandscape] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth > window.innerHeight;
  });

  const [isMoreSheetOpen, setIsMoreSheetOpen] = useState<boolean>(false);

  const prevLandscapeRef = useRef<boolean>(isLandscape);

  useEffect(() => {
    const handleResize = () => {
      const landscape = window.innerWidth > window.innerHeight;
      setIsLandscape(landscape);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  useEffect(() => {
    if (prevLandscapeRef.current !== isLandscape) {
      prevLandscapeRef.current = isLandscape;
      if (vm.uiMode === 'site' && vm.isOneHandDevice && vm.activeTab === '3d') {
        triggerHaptic('major');
      }
    }
  }, [isLandscape, vm.uiMode, vm.isOneHandDevice, vm.activeTab]);

  const logoFileName = effectiveTheme === 'dark' ? 'cadcat-icon-dark.svg' : 'cadcat-icon-light.svg';
  const logoUrl = `${import.meta.env?.BASE_URL || '/'}icons/${logoFileName}`;
  const isSiteImmersive = vm.uiMode === 'site' && vm.isOneHandDevice;

  return (
    <div className={`app-wrapper ${isSiteImmersive ? 'app-wrapper--site-immersive' : ''}`}>
      {!isSiteImmersive && (
        <header className="m3-top-app-bar">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <img
              src={logoUrl}
              alt="CadCat Icon"
              width="42"
              height="42"
              style={{
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
                flexShrink: 0,
                imageRendering: 'pixelated',
              }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h1 className="m3-top-app-bar__title">CadCat</h1>
                <span className="m3-badge m3-badge--neutral" style={{ fontSize: '0.65rem', padding: '0.1rem 0.45rem', fontWeight: 600 }}>
                  Taller CAD
                </span>
              </div>
              <p className="m3-top-app-bar__subtitle">
                <span>Diseño paramétrico y despiece de muebles para taller.</span>
                <span className="visually-hidden"> Furniture design progressive web application.</span>
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
            <ThemeToggle
              themeMode={themeMode}
              effectiveTheme={effectiveTheme}
              onThemeChange={setThemeMode}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-outline)', opacity: 0.9, fontWeight: 600 }}>
              {`v${APP_VERSION}`}
            </span>
          </div>
        </div>

        <nav aria-label="Navegación principal" className="m3-tabs">
          <button
            type="button"
            className={`m3-tab-button ${vm.activeTab === '3d' || vm.activeTab === 'form' ? 'active' : ''}`}
            onClick={() => vm.setActiveTab('3d')}
          >
            <span aria-hidden="true">🧊 </span>
            <span>Vista 3D</span>
            <span className="visually-hidden"> 3D Viewport</span>
          </button>
          <button
            type="button"
            className={`m3-tab-button ${vm.activeTab === 'pieces' ? 'active' : ''}`}
            onClick={() => vm.setActiveTab('pieces')}
          >
            <span aria-hidden="true">📋 </span>
            <span>Despiece</span>
            <span className="visually-hidden"> Piece List</span>
          </button>
          <button
            type="button"
            className={`m3-tab-button ${vm.activeTab === 'machining' ? 'active' : ''}`}
            onClick={() => vm.setActiveTab('machining')}
          >
            <span aria-hidden="true">🛠️ </span>
            <span>Mecanizado</span>
          </button>
          <button
            type="button"
            className={`m3-tab-button ${vm.activeTab === 'assembly' ? 'active' : ''}`}
            onClick={() => vm.setActiveTab('assembly')}
          >
            <span aria-hidden="true">📖 </span>
            <span>Guía de Armado</span>
            <span className="visually-hidden"> Assembly Guide</span>
          </button>
          <button
            type="button"
            className={`m3-tab-button ${vm.activeTab === 'countertop' ? 'active' : ''}`}
            onClick={() => vm.setActiveTab('countertop')}
          >
            <span aria-hidden="true">🪨 </span>
            <span>Mesada</span>
            <span className="visually-hidden"> Countertop and Stone Shop Drawing</span>
          </button>
          <button
            type="button"
            className={`m3-tab-button ${vm.activeTab === 'catalogs' ? 'active' : ''}`}
            onClick={() => vm.setActiveTab('catalogs')}
          >
            <span aria-hidden="true">🗄️ </span>
            <span>Catálogos</span>
          </button>
          <button
            type="button"
            className={`m3-tab-button ${vm.activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => vm.setActiveTab('settings')}
          >
            <span aria-hidden="true">⚙️ </span>
            <span>Configuración</span>
          </button>
        </nav>
      </header>
      )}

      <main className={`m3-container ${isSiteImmersive ? 'm3-container--site-immersive' : ''}`}>
        {vm.isLoading && (
          <p className="loading-state">
            <span>Cargando catálogos de base de datos...</span>
            <span className="visually-hidden"> Loading catalogs from database...</span>
          </p>
        )}
        {vm.error && <p className="error-state" role="alert">{vm.error}</p>}
        {!isSiteImmersive && vm.statusMessage && <p className="status-message">{vm.statusMessage}</p>}
        {!isSiteImmersive && updateAvailable && (
          <div className="m3-banner m3-banner--warning" role="alert" style={{ margin: '0 0 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span>🎉 ¡Nueva versión de CadCat disponible con mejoras de cajones y CAD móvil!</span>
            <button
              type="button"
              className="m3-button m3-button--primary"
              style={{ padding: '0.3rem 0.75rem', fontSize: '0.85rem' }}
              onClick={() => void forcePurgeCacheAndReload()}
            >
              Actualizar ahora
            </button>
          </div>
        )}

        {/* Prominent View Mode Switcher for Handheld Mobile Phones (One-Hand Obra vs Expert) */}
        {vm.isOneHandDevice && vm.uiMode === 'expert' && (
          <div
            className="m3-banner"
            role="region"
            aria-label="Selector de Modo de Trabajo"
            style={{
              margin: '0 0 1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
              padding: '0.75rem 1rem',
              borderRadius: '16px',
              backgroundColor: 'var(--md-sys-color-primary-container)',
              color: 'var(--md-sys-color-on-primary-container)',
              border: '1px solid var(--md-sys-color-primary)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.4rem' }}>📱</span>
              <div>
                <strong style={{ fontSize: '0.92rem', display: 'block' }}>Modo Taller / Obra Disponible</strong>
                <span style={{ fontSize: '0.78rem', opacity: 0.9 }}>
                  Diseñá con una sola mano mediante gestos ergonómicos y dial radial.
                </span>
              </div>
            </div>
            <button
              type="button"
              className="m3-button m3-button--filled"
              style={{
                minHeight: '44px',
                borderRadius: '22px',
                fontSize: '0.88rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
              onClick={() => vm.setUiMode('site')}
            >
              <span>🏗️</span>
              <span>Cambiar a Modo Obra</span>
            </button>
          </div>
        )}

        {/* Full-screen 3D Viewport in Modo Obra */}
        {isSiteImmersive && vm.activeTab === '3d' && (
          <div
            className={`modo-obra-3d-fullscreen ${isLandscape ? 'modo-obra-3d-fullscreen--landscape' : ''}`}
            role="region"
            aria-label="Inspección 3D en Modo Obra"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              backgroundColor: 'var(--md-sys-color-surface)',
              display: 'flex',
              flexDirection: 'column',
              width: '100vw',
              height: '100dvh',
              overflowY: isLandscape ? 'hidden' : 'auto',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {/* Top header: in portrait displays module name and rotation hint; in landscape collapses to maximize CAD canvas */}
            {!isLandscape ? (
              <header
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'max(0.4rem, env(safe-area-inset-top, 0.4rem)) 0.75rem 0.4rem',
                  borderBottom: '1px solid var(--md-sys-color-outline-variant)',
                  backgroundColor: 'var(--md-sys-color-surface-container)',
                  flexShrink: 0,
                  zIndex: 10,
                }}
              >
                <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--md-sys-color-primary)' }}>
                  {`👁️ 3D · ${vm.projectModules.find((m) => m.id === vm.activeModuleId)?.name || 'Módulo'}`}
                </span>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    fontSize: '0.75rem',
                    color: 'var(--md-sys-color-outline)',
                    fontWeight: 600,
                  }}
                  title="Girá el teléfono en horizontal para vista panorámica CAD"
                >
                  <span>🔄 Girar para CAD</span>
                </div>
              </header>
            ) : (
              /* Floating subtle badge in landscape mode */
              <div
                style={{
                  position: 'absolute',
                  top: 'max(0.5rem, env(safe-area-inset-top, 0.5rem))',
                  left: 'max(0.75rem, env(safe-area-inset-left, 0.75rem))',
                  zIndex: 80,
                  backgroundColor: 'rgba(25, 25, 25, 0.8)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  color: '#ffffff',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  pointerEvents: 'none',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                }}
              >
                <span>📐 Vista Panorámica CAD</span>
                <span style={{ opacity: 0.8, fontSize: '0.72rem' }}>
                  {`· ${vm.projectModules.find((m) => m.id === vm.activeModuleId)?.name || 'Módulo'}`}
                </span>
              </div>
            )}

            <div
              style={{
                flex: isLandscape ? 1 : 'none',
                position: 'relative',
                width: '100%',
                minHeight: isLandscape ? 0 : 'auto',
                overflow: isLandscape ? 'hidden' : 'visible',
              }}
            >
              <Viewport3D
                boxes={vm.spatialBoxes}
                bounds={vm.spatialBounds}
                pieces={vm.resolvedPieces}
                explodedRatio={vm.explodedRatio}
                onExplodedRatioChange={vm.setExplodedRatio}
                selectedPieceId={vm.selectedPieceId}
                onSelectPiece={vm.setSelectedPieceId}
                shelfDeflections={vm.shelfDeflections}
                pieceJointOverrides={vm.pieceJointOverrides}
                onSetPieceJointOverride={vm.setPieceJointOverride}
                defaultJointStrategy={vm.jointStrategy}
                kinematicBoxes={vm.kinematicBoxes}
                kinematicMechanisms={vm.kinematicMechanisms}
                kinematicsState={vm.kinematicsState}
                onMechanismOpenRatioChange={vm.setMechanismOpenRatio}
                materials={vm.materials}
                edgeBands={vm.edgeBands}
                pieceMaterialOverrides={vm.pieceMaterialOverrides}
                pieceThicknessOverrides={vm.pieceThicknessOverrides}
                pieceEdgeBandOverrides={vm.pieceEdgeBandOverrides}
                onSetPieceMaterial={vm.setPieceMaterial}
                onSetPieceThickness={vm.setPieceThickness}
                onSetPieceEdgeBands={vm.setPieceEdgeBands}
                countertopCalculation={vm.countertopCalculation}
                interferences={vm.interferences}
              />

              {/* Botón Flotante Ergonómico (FAB) para volver al editor */}
              <button
                type="button"
                className="m3-button m3-button--filled modo-obra-floating-back-fab"
                aria-label="Volver al editor"
                title="Volver al editor de taller"
                onClick={() => {
                  triggerHaptic('major');
                  vm.setActiveTab('form');
                }}
                style={{
                  position: 'fixed',
                  bottom: isLandscape
                    ? 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))'
                    : 'max(1.2rem, env(safe-area-inset-bottom, 1.2rem))',
                  [vm.handMode === 'right' ? 'right' : 'left']: isLandscape
                    ? 'max(0.75rem, env(safe-area-inset-right, 0.75rem))'
                    : 'max(1rem, env(safe-area-inset-right, 1rem))',
                  zIndex: 100,
                  minHeight: isLandscape ? '44px' : '52px',
                  padding: isLandscape ? '0 1rem' : '0 1.25rem',
                  borderRadius: isLandscape ? '22px' : '26px',
                  fontSize: isLandscape ? '0.85rem' : '0.92rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  backgroundColor: 'var(--md-sys-color-primary)',
                  color: 'var(--md-sys-color-on-primary)',
                  boxShadow: '0 4px 18px rgba(0, 0, 0, 0.35)',
                  border: '2px solid rgba(255, 255, 255, 0.35)',
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)',
                  whiteSpace: 'nowrap',
                }}
              >
                <span aria-hidden="true" style={{ fontSize: isLandscape ? '1rem' : '1.15rem' }}>✏️</span>
                <span>Volver al Editor</span>
              </button>
            </div>
          </div>
        )}

        {!vm.isLoading && (
          <div
            className="layout-grid layout-grid--two-col"
            data-mobile-view={vm.activeTab === 'form' ? 'form' : 'workspace'}
          >
            <aside aria-label="Module Parameters" className="layout-aside">
              {vm.uiMode === 'site' && vm.isOneHandDevice ? (
                <ModoObraWizard
                  projectModules={vm.projectModules}
                  activeModuleId={vm.activeModuleId}
                  onSetActiveModule={vm.setActiveModule}
                  onAddProjectModule={vm.addProjectModule}
                  templates={vm.templates}
                  selectedTemplateId={vm.selectedTemplateId}
                  onTemplateChange={vm.setSelectedTemplateId}
                  width={vm.width}
                  height={vm.height}
                  depth={vm.depth}
                  thickness={
                    typeof vm.materials.find((m) => m.id === vm.selectedMaterialId)?.thicknessMm === 'number'
                      ? (vm.materials.find((m) => m.id === vm.selectedMaterialId)!.thicknessMm as number)
                      : 18
                  }
                  onWidthChange={vm.setWidth}
                  onHeightChange={vm.setHeight}
                  onDepthChange={vm.setDepth}
                  onThicknessChange={(th) => {
                    const match = vm.materials.find((m) => m.thicknessMm === th);
                    if (match) {
                      vm.setSelectedMaterialId(match.id);
                    }
                  }}
                  hasPlinth={vm.hasPlinth}
                  plinthHeightMm={vm.plinthHeightMm}
                  onHasPlinthChange={vm.setHasPlinth}
                  onPlinthHeightChange={vm.setPlinthHeightMm}
                  hasWallHangingRail={vm.hasWallHangingRail}
                  onHasWallHangingRailChange={vm.setHasWallHangingRail}
                  roofType={vm.roofType}
                  onRoofTypeChange={vm.setRoofType}
                  hasBacking={vm.hasBacking}
                  backingType={vm.backingType}
                  onHasBackingChange={vm.setHasBacking}
                  onBackingTypeChange={vm.setBackingType}
                  gridType={vm.gridType}
                  bays={vm.bays}
                  activeBayIndex={vm.activeBayIndex}
                  onGridTypeChange={vm.setGridType}
                  onActiveBayIndexChange={vm.setActiveBayIndex}
                  onBayContentTypeChange={vm.setBayContentType}
                  onAddShelf={vm.addShelf}
                  onRemoveShelf={vm.removeShelf}
                  onShelfTypeChange={vm.setShelfType}
                  onAddDrawer={vm.addDrawer}
                  onRemoveDrawer={vm.removeDrawer}
                  onDoorCountChange={vm.setDoorCount}
                  onDoorHingeSideChange={vm.setDoorHingeSide}
                  onDoorInteriorShelvesCountChange={vm.setDoorInteriorShelvesCount}
                  materials={vm.materials}
                  selectedMaterialId={vm.selectedMaterialId}
                  onMaterialChange={vm.setSelectedMaterialId}
                  frontsMaterialId={vm.frontsMaterialId}
                  onFrontsMaterialChange={vm.setFrontsMaterialId}
                  drawerBoxesMaterialId={vm.drawerBoxesMaterialId}
                  onDrawerBoxesMaterialChange={vm.setDrawerBoxesMaterialId}
                  backingsMaterialId={vm.backingsMaterialId}
                  onBackingsMaterialChange={vm.setBackingsMaterialId}
                  handMode={vm.handMode}
                  onHandModeChange={vm.setHandMode}
                  onSwitchToExpertMode={() => vm.setUiMode('expert')}
                  onView3dClick={() => vm.setActiveTab(vm.activeTab === '3d' ? 'form' : '3d')}
                  is3dViewActive={vm.activeTab === '3d'}
                />
              ) : (
                <ModuleForm
                project={vm.project}
                projectModules={vm.projectModules}
                activeModuleId={vm.activeModuleId}
                onSetActiveModule={vm.setActiveModule}
                onAddProjectModule={vm.addProjectModule}
                onDuplicateProjectModule={vm.duplicateProjectModule}
                onRemoveProjectModule={vm.removeProjectModule}
                onUpdateProjectModuleQuantity={vm.updateProjectModuleQuantity}
                onUpdateProjectModuleName={vm.updateProjectModuleName}
                onSaveProject={() => void vm.saveProject()}
                projectScope={vm.projectScope}
                onProjectScopeChange={vm.setProjectScope}
                width={vm.width}
                height={vm.height}
                depth={vm.depth}
                templates={vm.templates}
                selectedTemplateId={vm.selectedTemplateId}
                materials={vm.materials}
                edgeBands={vm.edgeBands}
                selectedMaterialId={vm.selectedMaterialId}
                selectedEdgeBandId={vm.selectedEdgeBandId}
                isSaving={vm.isSaving}
                onWidthChange={vm.setWidth}
                onHeightChange={vm.setHeight}
                onDepthChange={vm.setDepth}
                onTemplateChange={vm.setSelectedTemplateId}
                onMaterialChange={vm.setSelectedMaterialId}
                onEdgeBandChange={vm.setSelectedEdgeBandId}
                onSave={() => void vm.saveModule()}
                onExportCsv={vm.exportCsv}
                onExportPdf={vm.exportPdf}
                onSaveUserTemplate={vm.saveCurrentUserTemplate}
                onDeleteUserTemplate={vm.deleteUserTemplate}
                isCustomModular={vm.isCustomModular}
                roofType={vm.roofType}
                jointPriority={vm.jointPriority}
                hasBacking={vm.hasBacking}
                gridType={vm.gridType}
                bays={vm.bays}
                activeBayIndex={vm.activeBayIndex}
                frontsMaterialId={vm.frontsMaterialId}
                drawerBoxesMaterialId={vm.drawerBoxesMaterialId}
                backingsMaterialId={vm.backingsMaterialId}
                onRoofTypeChange={vm.setRoofType}
                onJointPriorityChange={vm.setJointPriority}
                onHasBackingChange={vm.setHasBacking}
                onGridTypeChange={vm.setGridType}
                onActiveBayIndexChange={vm.setActiveBayIndex}
                onBayContentTypeChange={vm.setBayContentType}
                onAddShelf={vm.addShelf}
                onRemoveShelf={vm.removeShelf}
                onShelfTypeChange={vm.setShelfType}
                onShelfAntiSagChange={vm.setShelfAntiSag}
                onAddDrawer={vm.addDrawer}
                onRemoveDrawer={vm.removeDrawer}
                onDrawerFrontMountChange={vm.setDrawerFrontMount}
                onDrawerSlideTypeChange={vm.setDrawerSlideType}
                onDrawerTracksChange={vm.setDrawerTracks}
                onDrawerGapChange={vm.setDrawerGap}
                onDrawerTransomsChange={vm.setDrawerTransoms}
                onDrawerTypeChange={vm.setDrawerType}
                onDrawerBottomMountChange={vm.setDrawerBottomMount}
                onDrawerTopPullGapChange={vm.setDrawerTopPullGap}
                onDrawerBoxSideHeightOffsetChange={vm.setDrawerBoxSideHeightOffset}
                onDrawerSlideClearanceChange={vm.setDrawerSlideClearance}
                partitionPassThroughRoof={vm.partitionPassThroughRoof}
                onPartitionPassThroughRoofChange={vm.setPartitionPassThroughRoof}
                structuralSpanWarnings={vm.structuralSpanWarnings}
                maxDrawerSpanMm={vm.projectConfig?.hardware?.maxDrawerSpanMm ?? 900}
                onDoorCountChange={vm.setDoorCount}
                onDoorMountTypeChange={vm.setDoorMountType}
                onDoorInteriorShelvesCountChange={vm.setDoorInteriorShelvesCount}
                onDoorShelfTypeChange={vm.setDoorShelfType}
                onBifoldDirectionChange={vm.setBifoldDirection}
                backingType={vm.backingType}
                backingThicknessMm={vm.backingThicknessMm}
                isIslandCabinet={vm.isIslandCabinet}
                rearStructuralRails={vm.rearStructuralRails}
                rearStructuralRailsWidthMm={vm.rearStructuralRailsWidthMm}
                onBackingTypeChange={vm.setBackingType}
                onBackingThicknessChange={vm.setBackingThicknessMm}
                onIsIslandCabinetChange={vm.setIsIslandCabinet}
                onRearStructuralRailsChange={vm.setRearStructuralRails}
                onRearStructuralRailsWidthChange={vm.setRearStructuralRailsWidthMm}
                onFrontsMaterialChange={vm.setFrontsMaterialId}
                onDrawerBoxesMaterialChange={vm.setDrawerBoxesMaterialId}
                onBackingsMaterialChange={vm.setBackingsMaterialId}
                jointStrategy={vm.jointStrategy}
                onJointStrategyChange={vm.setJointStrategy}
                railOrientation={vm.railOrientation}
                onRailOrientationChange={vm.setRailOrientation}
                hasMiddleBrace={vm.hasMiddleBrace}
                onHasMiddleBraceChange={vm.setHasMiddleBrace}
                middleBraceWidthMm={vm.middleBraceWidthMm}
                onMiddleBraceWidthChange={vm.setMiddleBraceWidthMm}
                hasWallHangingRail={vm.hasWallHangingRail}
                onHasWallHangingRailChange={vm.setHasWallHangingRail}
                wallHangingRailWidthMm={vm.wallHangingRailWidthMm}
                onWallHangingRailWidthChange={vm.setWallHangingRailWidthMm}
                hasPlinth={vm.hasPlinth}
                onHasPlinthChange={vm.setHasPlinth}
                plinthHeightMm={vm.plinthHeightMm}
                onPlinthHeightChange={vm.setPlinthHeightMm}
                plinthSetbackMm={vm.plinthSetbackMm}
                onPlinthSetbackChange={vm.setPlinthSetbackMm}
                wallShelvesBracketType={vm.wallShelvesBracketType}
                wallShelvesWallType={vm.wallShelvesWallType}
                wallShelvesLoadCategory={vm.wallShelvesLoadCategory}
                wallShelvesBoundaryCondition={vm.wallShelvesBoundaryCondition}
                wallShelvesOverhangMode={vm.wallShelvesOverhangMode}
                wallShelvesShelfCount={vm.wallShelvesShelfCount}
                wallShelvesVerticalSpacingMm={vm.wallShelvesVerticalSpacingMm}
                wallShelvesBaseElevationYMm={vm.wallShelvesBaseElevationYMm}
                wallShelvingOutput={vm.wallShelvingOutput}
                onWallShelvesBracketTypeChange={vm.setWallShelvesBracketType}
                onWallShelvesWallTypeChange={vm.setWallShelvesWallType}
                onWallShelvesLoadCategoryChange={vm.setWallShelvesLoadCategory}
                onWallShelvesBoundaryConditionChange={vm.setWallShelvesBoundaryCondition}
                onWallShelvesOverhangModeChange={vm.setWallShelvesOverhangMode}
                onWallShelvesShelfCountChange={vm.setWallShelvesShelfCount}
                onWallShelvesVerticalSpacingMmChange={vm.setWallShelvesVerticalSpacingMm}
                onWallShelvesBaseElevationYMmChange={vm.setWallShelvesBaseElevationYMm}
                enableInterferencesLab={vm.projectConfig?.features?.enableInterferencesLab ?? false}
                columnObstacle={vm.columnObstacle}
                falseSquare={vm.falseSquare}
                onColumnObstacleChange={vm.setColumnObstacle}
                onFalseSquareChange={vm.setFalseSquare}
                onView3dClick={() => vm.setActiveTab('3d')}
                onViewAssemblyClick={() => vm.setActiveTab('assembly')}
                onSwitchToSiteMode={vm.isOneHandDevice ? () => vm.setUiMode('site') : undefined}
              />
            )}
          </aside>

          <section aria-label="Module Visualization" className="layout-main">
            {!isSiteImmersive && (vm.activeTab === '3d' || vm.activeTab === 'form') && (
              <>
                <Viewport3D
                  boxes={vm.spatialBoxes}
                  bounds={vm.spatialBounds}
                  pieces={vm.resolvedPieces}
                  explodedRatio={vm.explodedRatio}
                  onExplodedRatioChange={vm.setExplodedRatio}
                  selectedPieceId={vm.selectedPieceId}
                  onSelectPiece={vm.setSelectedPieceId}
                  shelfDeflections={vm.shelfDeflections}
                  pieceJointOverrides={vm.pieceJointOverrides}
                  onSetPieceJointOverride={vm.setPieceJointOverride}
                  defaultJointStrategy={vm.jointStrategy}
                  kinematicBoxes={vm.kinematicBoxes}
                  kinematicMechanisms={vm.kinematicMechanisms}
                  kinematicsState={vm.kinematicsState}
                  onMechanismOpenRatioChange={vm.setMechanismOpenRatio}
                  materials={vm.materials}
                  edgeBands={vm.edgeBands}
                  pieceMaterialOverrides={vm.pieceMaterialOverrides}
                  pieceThicknessOverrides={vm.pieceThicknessOverrides}
                  pieceEdgeBandOverrides={vm.pieceEdgeBandOverrides}
                  onSetPieceMaterial={vm.setPieceMaterial}
                  onSetPieceThickness={vm.setPieceThickness}
                  onSetPieceEdgeBands={vm.setPieceEdgeBands}
                  onOpenMachiningModal={(id) => setMachiningPieceId(id)}
                  machiningSheets={vm.machiningSheets}
                  countertopCalculation={vm.countertopCalculation}
                  interferences={vm.interferences}
                />
                <button
                  type="button"
                  className="builder-floating-action"
                  onClick={() => vm.setActiveTab('form')}
                  aria-label={
                    vm.uiMode === 'site' && vm.isOneHandDevice
                      ? 'Volver a Modo Obra'
                      : 'Modificar o armar mueble'
                  }
                >
                  {vm.uiMode === 'site' && vm.isOneHandDevice
                    ? '🏗️ Volver a Medidas'
                    : '🛠️ Armar Módulo'}
                </button>
              </>
            )}

              {vm.activeTab === 'machining' && (
                <MachiningSheetView
                  sheets={vm.machiningSheets}
                  selectedPieceId={vm.selectedMachiningPieceId}
                  onSelectPiece={vm.setSelectedMachiningPieceId}
                  onExportPdf={vm.exportMachiningPdf}
                  onExportDxf={vm.exportMachiningDxf}
                />
              )}

              {vm.activeTab === 'pieces' && (
                <PieceListView
                  pieces={vm.projectScope === 'all-modules' ? vm.consolidatedPieces : vm.resolvedPieces}
                  projectScope={vm.projectScope}
                  onProjectScopeChange={vm.setProjectScope}
                  projectModulesCount={vm.projectModules.length}
                  currentModuleName={vm.projectModules.find((m) => m.id === vm.activeModuleId)?.name ?? 'Módulo Actual'}
                  shelfDeflections={vm.shelfDeflections}
                  selectedPieceId={vm.selectedPieceId}
                  onSelectPiece={vm.setSelectedPieceId}
                  pieceJointOverrides={vm.pieceJointOverrides}
                  onSetPieceJointOverride={vm.setPieceJointOverride}
                  defaultJointStrategy={vm.jointStrategy}
                  materials={vm.materials}
                  edgeBands={vm.edgeBands}
                  pieceMaterialOverrides={vm.pieceMaterialOverrides}
                  pieceThicknessOverrides={vm.pieceThicknessOverrides}
                  pieceEdgeBandOverrides={vm.pieceEdgeBandOverrides}
                  onSetPieceMaterial={vm.setPieceMaterial}
                  onSetPieceThickness={vm.setPieceThickness}
                  onSetPieceEdgeBands={vm.setPieceEdgeBands}
                  onOpenMachiningModal={(id) => setMachiningPieceId(id)}
                  enablePieceLabels={vm.projectConfig?.features?.enablePieceLabels ?? true}
                  orderId={vm.projectConfig?.projectId ?? 'ORD-001'}
                  clientName={vm.projectConfig?.clientName ?? 'Cliente Taller'}
                  moduleId={vm.activeModuleId}
                  machiningList={vm.pieceMachiningList}
                />
              )}

              {vm.activeTab === 'assembly' && (
                <AssemblySheetView
                  assemblySheet={vm.assemblySheet}
                  pieces={vm.resolvedPieces}
                  wallShelvingOutput={vm.wallShelvingOutput}
                  wallShelvingDefinition={vm.wallShelvingDefinition}
                  onExportPdf={vm.exportAssemblyPdf}
                  selectedPieceId={vm.selectedPieceId}
                  onSelectPiece={vm.setSelectedPieceId}
                />
              )}

              {vm.activeTab === 'countertop' && (
                <CountertopEditorView
                  countertopEnabled={vm.countertopEnabled}
                  onToggleCountertop={vm.setCountertopEnabled}
                  countertopCalculation={vm.countertopCalculation}
                  countertopDefinition={vm.countertopDefinition}
                  countertopMaterials={vm.countertopMaterials}
                  equipmentCatalog={vm.equipmentCatalog}
                  selectedMaterialId={vm.countertopMaterialId}
                  onSelectMaterial={vm.setCountertopMaterialId}
                  selectedEquipmentId={vm.selectedEquipmentId}
                  onSelectEquipment={vm.setSelectedEquipmentId}
                  sinkDrawerAdaptation={vm.sinkDrawerAdaptation}
                  onSelectSinkDrawerAdaptation={vm.setSinkDrawerAdaptation}
                  frontRailOrientation={vm.countertopFrontRailOrientation}
                  onSelectFrontRailOrientation={vm.setCountertopFrontRailOrientation}
                  frontOverhangMm={vm.countertopFrontOverhangMm}
                  onFrontOverhangChange={vm.setCountertopFrontOverhangMm}
                  edgeFinish={vm.countertopEdgeFinish}
                  onEdgeFinishChange={vm.setCountertopEdgeFinish}
                  hasBacksplash={vm.countertopHasBacksplash}
                  onToggleBacksplash={vm.setCountertopHasBacksplash}
                  backsplashHeightMm={vm.countertopBacksplashHeightMm}
                  onBacksplashHeightChange={vm.setCountertopBacksplashHeightMm}
                  onExportPdf={vm.exportMarmoleriaPdfReport}
                />
              )}

              {vm.activeTab === 'settings' && (
                <ProjectSettingsView
                  config={vm.projectConfig}
                  isSaving={vm.isSaving}
                  onUpdateConfig={vm.updateProjectConfig}
                  onSaveConfig={() => void vm.saveProjectConfig()}
                  onExportConfig={vm.exportProjectConfigFile}
                  onImportConfigFile={(file) => void vm.importProjectConfigFile(file)}
                  onResetConfig={() => void vm.resetProjectConfigToDefaults()}
                  materials={vm.materials}
                  edgeBands={vm.edgeBands}
                  hardware={vm.hardware}
                  onSaveMaterial={vm.saveMaterial}
                  onDeleteMaterial={vm.deleteMaterial}
                  onSaveEdgeBand={vm.saveEdgeBand}
                  onDeleteEdgeBand={vm.deleteEdgeBand}
                  onSaveHardware={vm.saveHardware}
                  onDeleteHardware={vm.deleteHardware}
                  onResetCatalogs={vm.resetCatalogs}
                  onForcePurgeCacheAndReload={forcePurgeCacheAndReload}
                />
              )}

              {vm.activeTab === 'catalogs' && (
                <div className="m3-card" style={{ width: '100%' }}>
                  <h3 className="m3-card__title">
                    <span>🗄️ Gestión de Catálogos e Insumos</span>
                  </h3>
                  <p className="m3-card__subtitle">
                    Base de datos local (IndexedDB) de tableros/placas, tapacantos y herrajes de taller.
                  </p>
                  <CatalogManagerView
                    materials={vm.materials}
                    edgeBands={vm.edgeBands}
                    hardware={vm.hardware}
                    onSaveMaterial={vm.saveMaterial}
                    onDeleteMaterial={vm.deleteMaterial}
                    onSaveEdgeBand={vm.saveEdgeBand}
                    onDeleteEdgeBand={vm.deleteEdgeBand}
                    onSaveHardware={vm.saveHardware}
                    onDeleteHardware={vm.deleteHardware}
                    onResetCatalogs={vm.resetCatalogs}
                  />
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* Material Design 3 Bottom Navigation Bar for Mobile (< 1024px) - 4 Destinations Standard */}
      {!isSiteImmersive && (
        <nav aria-label="Navegación móvil" className="m3-bottom-nav">
          <button
            type="button"
            className={`m3-bottom-nav__item ${vm.activeTab === 'form' ? 'active' : ''}`}
            onClick={() => {
              triggerHaptic('tick');
              vm.setActiveTab('form');
              setIsMoreSheetOpen(false);
            }}
          >
            <div className="m3-bottom-nav__indicator">
              <span className="m3-bottom-nav__icon" aria-hidden="true">🛠️</span>
            </div>
            <span className="m3-bottom-nav__label">Armar</span>
            <span className="visually-hidden"> Parameters and Modular Builder</span>
          </button>

          <button
            type="button"
            className={`m3-bottom-nav__item ${vm.activeTab === '3d' ? 'active' : ''}`}
            onClick={() => {
              triggerHaptic('tick');
              vm.setActiveTab('3d');
              setIsMoreSheetOpen(false);
            }}
          >
            <div className="m3-bottom-nav__indicator">
              <span className="m3-bottom-nav__icon" aria-hidden="true">🧊</span>
            </div>
            <span className="m3-bottom-nav__label">Vista 3D</span>
          </button>

          <button
            type="button"
            className={`m3-bottom-nav__item ${vm.activeTab === 'pieces' ? 'active' : ''}`}
            onClick={() => {
              triggerHaptic('tick');
              vm.setActiveTab('pieces');
              setIsMoreSheetOpen(false);
            }}
          >
            <div className="m3-bottom-nav__indicator">
              <span className="m3-bottom-nav__icon" aria-hidden="true">📋</span>
            </div>
            <span className="m3-bottom-nav__label">Despiece</span>
          </button>

          <button
            type="button"
            className={`m3-bottom-nav__item ${['machining', 'assembly', 'countertop', 'catalogs', 'settings'].includes(vm.activeTab) ? 'active' : ''}`}
            onClick={() => {
              triggerHaptic('tick');
              setIsMoreSheetOpen((prev) => !prev);
            }}
            aria-label="Más herramientas y vistas de taller"
            aria-expanded={isMoreSheetOpen}
          >
            <div className="m3-bottom-nav__indicator">
              <span className="m3-bottom-nav__icon" aria-hidden="true">
                {vm.activeTab === 'machining'
                  ? '🛠️'
                  : vm.activeTab === 'assembly'
                  ? '📖'
                  : vm.activeTab === 'countertop'
                  ? '🪨'
                  : vm.activeTab === 'catalogs'
                  ? '🗄️'
                  : vm.activeTab === 'settings'
                  ? '⚙️'
                  : '📑'}
              </span>
            </div>
            <span className="m3-bottom-nav__label">
              {vm.activeTab === 'machining'
                ? 'Mecanizado'
                : vm.activeTab === 'assembly'
                ? 'Armado'
                : vm.activeTab === 'countertop'
                ? 'Mesada'
                : vm.activeTab === 'catalogs'
                ? 'Catálogos'
                : vm.activeTab === 'settings'
                ? 'Taller'
                : 'Más...'}
            </span>
          </button>
        </nav>
      )}

      {/* Material Design 3 Modal Bottom Sheet for Secondary Tools */}
      {!isSiteImmersive && isMoreSheetOpen && (
        <div
          className="m3-bottom-sheet-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Herramientas adicionales de taller"
          onClick={() => setIsMoreSheetOpen(false)}
        >
          <div
            className="m3-bottom-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="m3-bottom-sheet__handle" aria-hidden="true" />
            <div className="m3-bottom-sheet__header">
              <h3 className="m3-bottom-sheet__title">📑 Herramientas de Taller</h3>
              <button
                type="button"
                className="m3-button m3-button--tonal"
                onClick={() => setIsMoreSheetOpen(false)}
                aria-label="Cerrar menú"
                style={{ minHeight: '38px', minWidth: '38px', borderRadius: '19px', padding: 0 }}
              >
                ✕
              </button>
            </div>

            <div className="m3-bottom-sheet__grid">
              <button
                type="button"
                className={`m3-bottom-sheet__item ${vm.activeTab === 'machining' ? 'active' : ''}`}
                onClick={() => {
                  triggerHaptic('major');
                  vm.setActiveTab('machining');
                  setIsMoreSheetOpen(false);
                }}
              >
                <span className="m3-bottom-sheet__item-icon">🛠️</span>
                <div className="m3-bottom-sheet__item-text">
                  <strong>Mecanizado de Placas</strong>
                  <span>Ranurados, cremalleras y fresados CNC</span>
                </div>
              </button>

              <button
                type="button"
                className={`m3-bottom-sheet__item ${vm.activeTab === 'assembly' ? 'active' : ''}`}
                onClick={() => {
                  triggerHaptic('major');
                  vm.setActiveTab('assembly');
                  setIsMoreSheetOpen(false);
                }}
              >
                <span className="m3-bottom-sheet__item-icon">📖</span>
                <div className="m3-bottom-sheet__item-text">
                  <strong>Guía de Armado</strong>
                  <span>Pasos de ensamble y lista de herrajes</span>
                </div>
              </button>

              <button
                type="button"
                className={`m3-bottom-sheet__item ${vm.activeTab === 'countertop' ? 'active' : ''}`}
                onClick={() => {
                  triggerHaptic('major');
                  vm.setActiveTab('countertop');
                  setIsMoreSheetOpen(false);
                }}
              >
                <span className="m3-bottom-sheet__item-icon">🪨</span>
                <div className="m3-bottom-sheet__item-text">
                  <strong>Mesadas y Calados</strong>
                  <span>Cálculo de bacha, anafe y voladizos</span>
                </div>
              </button>

              <button
                type="button"
                className={`m3-bottom-sheet__item ${vm.activeTab === 'catalogs' ? 'active' : ''}`}
                onClick={() => {
                  triggerHaptic('major');
                  vm.setActiveTab('catalogs');
                  setIsMoreSheetOpen(false);
                }}
              >
                <span className="m3-bottom-sheet__item-icon">🗄️</span>
                <div className="m3-bottom-sheet__item-text">
                  <strong>Catálogos de Materiales</strong>
                  <span>Placas, tapacantos y herrajes</span>
                </div>
              </button>

              <button
                type="button"
                className={`m3-bottom-sheet__item ${vm.activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => {
                  triggerHaptic('major');
                  vm.setActiveTab('settings');
                  setIsMoreSheetOpen(false);
                }}
              >
                <span className="m3-bottom-sheet__item-icon">⚙️</span>
                <div className="m3-bottom-sheet__item-text">
                  <strong>Configuración del Taller</strong>
                  <span>Fijaciones, holguras, tolerancias y caché</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive 2D Machining Editor Modal (Point 8) */}
      {machiningPieceId && (
        <MachiningEditorModal
          piece={vm.resolvedPieces.find((p) => p.id === machiningPieceId) ?? null}
          customOperations={Object.values(vm.customPieceOperations).flat()}
          spatialBoxes={vm.spatialBoxes}
          materials={vm.materials}
          config={vm.projectConfig?.machining}
          derivedOperations={vm.machiningOperations}
          onAddOperation={vm.addCustomPieceOperation}
          onRemoveOperation={vm.removeCustomPieceOperation}
          onClose={() => setMachiningPieceId(null)}
        />
      )}
    </div>
  );
}
