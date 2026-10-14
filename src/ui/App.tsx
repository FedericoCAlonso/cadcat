import { useState, type ReactElement } from 'react';
import './theme.css';
import { useModuleViewModel } from './useModuleViewModel';
import { ModuleForm } from './ModuleForm';
import { PieceListView } from './PieceListView';
import { Viewport3D } from './Viewport3D';
import { MachiningSheetView } from './MachiningSheetView';
import { ProjectSettingsView } from './ProjectSettingsView';
import { AssemblySheetView } from './AssemblySheetView';
import { MachiningEditorModal } from './MachiningEditorModal';

/**
 * Main application View component.
 * Implements Google Material Design 3 (M3) layout and MVVM pattern.
 */
export function App(): ReactElement {
  const vm = useModuleViewModel();
  const [machiningPieceId, setMachiningPieceId] = useState<string | null>(null);

  return (
    <div className="app-wrapper">
      <header className="m3-top-app-bar">
        <div>
          <h1 className="m3-top-app-bar__title">Mobilius</h1>
          <p className="m3-top-app-bar__subtitle">
            <span>Diseño paramétrico y despiece de muebles para taller.</span>
            <span className="visually-hidden"> Furniture design progressive web application.</span>
          </p>
        </div>

        <nav aria-label="Navegación principal" className="m3-tabs">
          <button
            type="button"
            className={`m3-tab-button ${vm.activeTab === '3d' ? 'active' : ''}`}
            onClick={() => vm.setActiveTab('3d')}
          >
            <span aria-hidden="true">🧊 </span>
            <span>Vista 3D</span>
            <span className="visually-hidden"> 3D Viewport</span>
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
            className={`m3-tab-button ${vm.activeTab === 'pieces' ? 'active' : ''}`}
            onClick={() => vm.setActiveTab('pieces')}
          >
            <span aria-hidden="true">📋 </span>
            <span>Despiece</span>
            <span className="visually-hidden"> Piece List</span>
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
            className={`m3-tab-button ${vm.activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => vm.setActiveTab('settings')}
          >
            <span aria-hidden="true">⚙️ </span>
            <span>Configuración</span>
          </button>
          <button
            type="button"
            className={`m3-tab-button ${vm.activeTab === 'form' ? 'active' : ''}`}
            onClick={() => vm.setActiveTab('form')}
          >
            <span aria-hidden="true">🛠️ </span>
            <span>Armar</span>
            <span className="visually-hidden"> Parameters and Modular Builder</span>
          </button>
        </nav>
      </header>

      <main className="m3-container">
        {vm.isLoading && (
          <p className="loading-state">
            <span>Cargando catálogos de base de datos...</span>
            <span className="visually-hidden"> Loading catalogs from database...</span>
          </p>
        )}
        {vm.error && <p className="error-state" role="alert">{vm.error}</p>}
        {vm.statusMessage && <p className="status-message">{vm.statusMessage}</p>}

        {!vm.isLoading && (
          <div
            className="layout-grid layout-grid--two-col"
            data-mobile-view={vm.activeTab === 'form' ? 'form' : 'workspace'}
          >
            <aside aria-label="Module Parameters" className="layout-aside">
              <ModuleForm
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
                onDoorCountChange={vm.setDoorCount}
                onDoorMountTypeChange={vm.setDoorMountType}
                onBifoldDirectionChange={vm.setBifoldDirection}
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
                onView3dClick={() => vm.setActiveTab('3d')}
              />
            </aside>

            <section aria-label="Module Visualization" className="layout-main">
              {vm.activeTab === '3d' && (
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
                  />
                  <button
                    type="button"
                    className="builder-floating-action"
                    onClick={() => vm.setActiveTab('form')}
                    aria-label="Modificar o armar mueble"
                  >
                    🛠️ Armar Módulo
                  </button>
                </>
              )}

              {vm.activeTab === 'machining' && (
                <MachiningSheetView
                  sheets={vm.machiningSheets}
                  selectedPieceId={vm.selectedMachiningPieceId}
                  onSelectPiece={vm.setSelectedMachiningPieceId}
                  onExportPdf={vm.exportMachiningPdf}
                />
              )}

              {vm.activeTab === 'pieces' && (
                <PieceListView
                  pieces={vm.resolvedPieces}
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
                />
              )}

              {vm.activeTab === 'assembly' && (
                <AssemblySheetView
                  assemblySheet={vm.assemblySheet}
                  onExportPdf={vm.exportAssemblyPdf}
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
                />
              )}

              {vm.activeTab === 'form' && (
                <div className="m3-card">
                  <h3 className="m3-card__title">
                    <span>Resumen del Módulo</span>
                    <span className="visually-hidden"> Module Overview</span>
                  </h3>
                  <p className="m3-card__subtitle">
                    Piezas resueltas: {vm.resolvedPieces.length} | Tapacantos:{' '}
                    {vm.bom?.totalEdgeBandMeters.toFixed(2) ?? '0.00'} m
                  </p>
                  <PieceListView
                    pieces={vm.resolvedPieces}
                    shelfDeflections={vm.shelfDeflections}
                  />
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* Material Design 3 Bottom Navigation Bar for Mobile (< 1024px) */}
      <nav aria-label="Navegación móvil" className="m3-bottom-nav">
        <button
          type="button"
          className={`m3-bottom-nav__item ${vm.activeTab === 'form' ? 'active' : ''}`}
          onClick={() => vm.setActiveTab('form')}
        >
          <div className="m3-bottom-nav__indicator">
            <span className="m3-bottom-nav__icon" aria-hidden="true">🛠️</span>
          </div>
          <span className="m3-bottom-nav__label">Armar</span>
        </button>
        <button
          type="button"
          className={`m3-bottom-nav__item ${vm.activeTab === '3d' ? 'active' : ''}`}
          onClick={() => vm.setActiveTab('3d')}
        >
          <div className="m3-bottom-nav__indicator">
            <span className="m3-bottom-nav__icon" aria-hidden="true">🧊</span>
          </div>
          <span className="m3-bottom-nav__label">Vista 3D</span>
        </button>
        <button
          type="button"
          className={`m3-bottom-nav__item ${vm.activeTab === 'pieces' ? 'active' : ''}`}
          onClick={() => vm.setActiveTab('pieces')}
        >
          <div className="m3-bottom-nav__indicator">
            <span className="m3-bottom-nav__icon" aria-hidden="true">📋</span>
          </div>
          <span className="m3-bottom-nav__label">Despiece</span>
        </button>
        <button
          type="button"
          className={`m3-bottom-nav__item ${vm.activeTab === 'machining' ? 'active' : ''}`}
          onClick={() => vm.setActiveTab('machining')}
        >
          <div className="m3-bottom-nav__indicator">
            <span className="m3-bottom-nav__icon" aria-hidden="true">🛠️</span>
          </div>
          <span className="m3-bottom-nav__label">Mecanizado</span>
        </button>
        <button
          type="button"
          className={`m3-bottom-nav__item ${vm.activeTab === 'assembly' ? 'active' : ''}`}
          onClick={() => vm.setActiveTab('assembly')}
        >
          <div className="m3-bottom-nav__indicator">
            <span className="m3-bottom-nav__icon" aria-hidden="true">📖</span>
          </div>
          <span className="m3-bottom-nav__label">Armado</span>
        </button>
        <button
          type="button"
          className={`m3-bottom-nav__item ${vm.activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => vm.setActiveTab('settings')}
        >
          <div className="m3-bottom-nav__indicator">
            <span className="m3-bottom-nav__icon" aria-hidden="true">⚙️</span>
          </div>
          <span className="m3-bottom-nav__label">Taller</span>
        </button>
      </nav>

      {/* Interactive 2D Machining Editor Modal (Point 8) */}
      {machiningPieceId && (
        <MachiningEditorModal
          piece={vm.resolvedPieces.find((p) => p.id === machiningPieceId) ?? null}
          customOperations={Object.values(vm.customPieceOperations).flat()}
          spatialBoxes={vm.spatialBoxes}
          onAddOperation={vm.addCustomPieceOperation}
          onRemoveOperation={vm.removeCustomPieceOperation}
          onClose={() => setMachiningPieceId(null)}
        />
      )}
    </div>
  );
}
