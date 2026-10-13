import type { ReactElement } from 'react';
import { useModuleViewModel } from './useModuleViewModel';
import { ModuleForm } from './ModuleForm';
import { PieceListView } from './PieceListView';

/**
 * Main application View component.
 * Integrates the ModuleForm and PieceListView bound to the useModuleViewModel.
 */
export function App(): ReactElement {
  const vm = useModuleViewModel();

  return (
    <main className="app-container">
      <header>
        <h1>Mobilius</h1>
        <p>Furniture design progressive web application.</p>
      </header>

      {vm.isLoading && <p className="loading-state">Loading catalogs from database...</p>}
      {vm.error && <p className="error-state" role="alert">{vm.error}</p>}
      {vm.statusMessage && <p className="status-message">{vm.statusMessage}</p>}

      {!vm.isLoading && (
        <div className="layout-grid">
          <ModuleForm
            width={vm.width}
            height={vm.height}
            depth={vm.depth}
            materials={vm.materials}
            edgeBands={vm.edgeBands}
            selectedMaterialId={vm.selectedMaterialId}
            selectedEdgeBandId={vm.selectedEdgeBandId}
            isSaving={vm.isSaving}
            onWidthChange={vm.setWidth}
            onHeightChange={vm.setHeight}
            onDepthChange={vm.setDepth}
            onMaterialChange={vm.setSelectedMaterialId}
            onEdgeBandChange={vm.setSelectedEdgeBandId}
            onSave={() => void vm.saveModule()}
            onExportCsv={vm.exportCsv}
            onExportPdf={vm.exportPdf}
          />

          <PieceListView pieces={vm.resolvedPieces} />
        </div>
      )}
    </main>
  );
}
