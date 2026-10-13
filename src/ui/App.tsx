import type { ReactElement } from 'react';
import './theme.css';
import { useModuleViewModel } from './useModuleViewModel';
import { ModuleForm } from './ModuleForm';
import { PieceListView } from './PieceListView';
import { Viewport3D } from './Viewport3D';
import { MachiningSheetView } from './MachiningSheetView';
import { ProjectSettingsView } from './ProjectSettingsView';

/**
 * Main application View component.
 * Implements Google Material Design 3 (M3) layout and MVVM pattern.
 */
export function App(): ReactElement {
  const vm = useModuleViewModel();

  return (
    <div className="app-wrapper">
      <header className="m3-top-app-bar">
        <div>
          <h1 className="m3-top-app-bar__title">Mobilius</h1>
          <p className="m3-top-app-bar__subtitle">Furniture design progressive web application.</p>
        </div>

        <nav aria-label="Main Navigation" className="m3-tabs">
          <button
            type="button"
            className={`m3-tab-button ${vm.activeTab === '3d' ? 'active' : ''}`}
            onClick={() => vm.setActiveTab('3d')}
          >
            🧊 3D Viewport
          </button>
          <button
            type="button"
            className={`m3-tab-button ${vm.activeTab === 'machining' ? 'active' : ''}`}
            onClick={() => vm.setActiveTab('machining')}
          >
            🛠️ Mecanizado
          </button>
          <button
            type="button"
            className={`m3-tab-button ${vm.activeTab === 'pieces' ? 'active' : ''}`}
            onClick={() => vm.setActiveTab('pieces')}
          >
            📋 Piece List
          </button>
          <button
            type="button"
            className={`m3-tab-button ${vm.activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => vm.setActiveTab('settings')}
          >
            ⚙️ Configuración
          </button>
          <button
            type="button"
            className={`m3-tab-button ${vm.activeTab === 'form' ? 'active' : ''}`}
            onClick={() => vm.setActiveTab('form')}
          >
            📐 Parameters
          </button>
        </nav>
      </header>

      <main className="m3-container">
        {vm.isLoading && <p className="loading-state">Loading catalogs from database...</p>}
        {vm.error && <p className="error-state" role="alert">{vm.error}</p>}
        {vm.statusMessage && <p className="status-message">{vm.statusMessage}</p>}

        {!vm.isLoading && (
          <div className="layout-grid layout-grid--two-col">
            <aside aria-label="Module Parameters">
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
              />
            </aside>

            <section aria-label="Module Visualization">
              {vm.activeTab === '3d' && (
                <Viewport3D
                  boxes={vm.spatialBoxes}
                  bounds={vm.spatialBounds}
                  pieces={vm.resolvedPieces}
                  explodedRatio={vm.explodedRatio}
                  onExplodedRatioChange={vm.setExplodedRatio}
                  selectedPieceId={vm.selectedPieceId}
                  onSelectPiece={vm.setSelectedPieceId}
                  shelfDeflections={vm.shelfDeflections}
                />
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
                />
              )}

              {vm.activeTab === 'form' && (
                <div className="m3-card">
                  <h3 className="m3-card__title">Module Overview</h3>
                  <p className="m3-card__subtitle">
                    Pieces resolved: {vm.resolvedPieces.length} | Edge bands:{' '}
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
    </div>
  );
}
