import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { PieceListView } from '../src/ui/PieceListView';
import { ModuleForm } from '../src/ui/ModuleForm';
import type { ConsolidatedPiece } from '../src/resolver';
import {
  type Material,
  type EdgeBand,
  type ProjectModuleItem,
  projectModuleItemSchema,
  projectSchema,
} from '../src/model';

const mockMaterials: Material[] = [
  {
    schemaVersion: 1,
    id: 'mat-1',
    name: 'Melamina Blanca 18mm',
    thicknessMm: 18,
    sheetSizeMm: { length: 2800, width: 2070 },
    hasGrain: false,
    milling: { hidden: 'yes', visible: 'no', onStructuralPiece: 'limited' },
  },
];

const mockEdgeBands: EdgeBand[] = [
  {
    schemaVersion: 1,
    id: 'eb-1',
    kind: 'adhesive',
    thicknessMm: 0.8,
    pricePerMeter: 1.5,
  },
];

const mockConsolidatedPieces: ConsolidatedPiece[] = [
  {
    id: 'mod-1__side-l__i1',
    moduleId: 'mod-1',
    moduleName: 'Bajo Mesada 800',
    moduleInstanceIndex: 1,
    role: 'side-left',
    materialId: 'mat-1',
    thicknessMm: 18,
    contour: { points: [{ x: 0, y: 0 }, { x: 580, y: 0 }, { x: 580, y: 720 }, { x: 0, y: 720 }] },
    faces: [],
    structural: true,
    referenceFace: 'A',
    positionMm: { x: 0, y: 0, z: 0 },
    dimensionsMm: { width: 580, height: 720 },
    cutDimensionsMm: { width: 578, height: 720 },
    cutContour: { points: [{ x: 0, y: 0 }, { x: 578, y: 0 }, { x: 578, y: 720 }, { x: 0, y: 720 }] },
    bandedEdges: [{ faceId: 'front-edge', edgeBandId: 'eb-1', thicknessMm: 0.8, lengthMm: 720 }],
  },
  {
    id: 'mod-2__side-l__i1',
    moduleId: 'mod-2',
    moduleName: 'Alacena Superior',
    moduleInstanceIndex: 1,
    role: 'side-left',
    materialId: 'mat-1',
    thicknessMm: 18,
    contour: { points: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 600 }, { x: 0, y: 600 }] },
    faces: [],
    structural: true,
    referenceFace: 'A',
    positionMm: { x: 0, y: 0, z: 0 },
    dimensionsMm: { width: 300, height: 600 },
    cutDimensionsMm: { width: 298, height: 600 },
    cutContour: { points: [{ x: 0, y: 0 }, { x: 298, y: 0 }, { x: 298, y: 600 }, { x: 0, y: 600 }] },
    bandedEdges: [{ faceId: 'front-edge', edgeBandId: 'eb-1', thicknessMm: 0.8, lengthMm: 600 }],
  },
];

const mockProjectModules: ProjectModuleItem[] = [
  projectModuleItemSchema.parse({
    id: 'mod-1',
    name: 'Bajo Mesada 800',
    quantity: 2,
    templateId: 'base-modular',
    width: 800,
    height: 720,
    depth: 580,
    selectedMaterialId: 'mat-1',
    selectedEdgeBandId: 'eb-1',
  }),
  projectModuleItemSchema.parse({
    id: 'mod-2',
    name: 'Alacena Superior',
    quantity: 1,
    templateId: 'wall-shelves',
    width: 600,
    height: 600,
    depth: 300,
    selectedMaterialId: 'mat-1',
    selectedEdgeBandId: 'eb-1',
  }),
];

describe('Multi-Module UI Components (PieceListView & ModuleForm)', () => {
  it('renders M3 segmented button and module badges in PieceListView for full-project scope', () => {
    const onScopeChange = vi.fn();
    const html = renderToString(
      <PieceListView
        pieces={mockConsolidatedPieces}
        materials={mockMaterials}
        edgeBands={mockEdgeBands}
        projectScope="all-modules"
        onProjectScopeChange={onScopeChange}
        projectModulesCount={2}
        currentModuleName="Bajo Mesada 800"
      />,
    );

    // Segmented button for switching between current module and full project
    expect(html).toContain('📌 Módulo Actual');
    expect(html).toContain('Bajo Mesada 800');
    expect(html).toContain('📦 Todo el Proyecto');
    expect(html).toContain('2');
    expect(html).toContain('módulos');
    expect(html).toContain('Despiece Consolidado del Proyecto');

    // Badges for modules on piece rows
    expect(html).toContain('📦');
    expect(html).toContain('Bajo Mesada 800');
    expect(html).toContain('Alacena Superior');
  });

  it('renders Project & Module Manager in ModuleForm with M3 touch-friendly controls', () => {
    const onSetActiveModule = vi.fn();
    const onAddModule = vi.fn();
    const onDuplicateModule = vi.fn();
    const onRemoveModule = vi.fn();
    const onUpdateQuantity = vi.fn();
    const onUpdateName = vi.fn();
    const onScopeChange = vi.fn();

    const sampleProject = projectSchema.parse({
      schemaVersion: 1,
      id: 'proj-1',
      name: 'Cocina Integral Moderna',
      clientName: 'Cliente Ejemplo',
      description: 'Proyecto completo',
      createdAt: '2026-10-19T10:00:00Z',
      updatedAt: '2026-10-19T10:00:00Z',
      activeModuleId: 'mod-1',
      modules: mockProjectModules,
    });

    const html = renderToString(
      <ModuleForm
        project={sampleProject}
        projectModules={mockProjectModules}
        activeModuleId="mod-1"
        onSetActiveModule={onSetActiveModule}
        onAddProjectModule={onAddModule}
        onDuplicateProjectModule={onDuplicateModule}
        onRemoveProjectModule={onRemoveModule}
        onUpdateProjectModuleQuantity={onUpdateQuantity}
        onUpdateProjectModuleName={onUpdateName}
        projectScope="all-modules"
        onProjectScopeChange={onScopeChange}
        width={800}
        height={720}
        depth={580}
        materials={mockMaterials}
        edgeBands={mockEdgeBands}
        selectedMaterialId="mat-1"
        selectedEdgeBandId="eb-1"
        isSaving={false}
        onWidthChange={vi.fn()}
        onHeightChange={vi.fn()}
        onDepthChange={vi.fn()}
        onMaterialChange={vi.fn()}
        onEdgeBandChange={vi.fn()}
        onSave={vi.fn()}
        onExportCsv={vi.fn()}
        onExportPdf={vi.fn()}
      />,
    );

    // Project header & totals
    expect(html).toContain('📦 Proyecto:');
    expect(html).toContain('Cocina Integral Moderna');
    expect(html).toContain('unidad(es) en');
    expect(html).toContain('tipo(s) de módulo');
    expect(html).toContain('Nuevo Módulo');

    // Module Chips
    expect(html).toContain('Bajo Mesada 800');
    expect(html).toContain('x<!-- -->2');
    expect(html).toContain('Alacena Superior');
    expect(html).toContain('x<!-- -->1');

    // Active Module Stepper and Actions
    expect(html).toContain('value="Bajo Mesada 800"');
    expect(html).toContain('Disminuir cantidad del módulo');
    expect(html).toContain('Aumentar cantidad del módulo');
    expect(html).toContain('Duplicar');
    expect(html).toContain('Eliminar');

    // Export Scope Selector
    expect(html).toContain('Alcance para descargas (CSV / PDF):');
    expect(html).toContain('Todo el Proyecto');
  });
});
