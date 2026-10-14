import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { PieceListView } from '../src/ui/PieceListView';
import type { ResolvedPieceWithCutSize } from '../src/resolver';
import type { Material, EdgeBand } from '../src/model';

const mockPieces: ResolvedPieceWithCutSize[] = [
  {
    id: 'base-side-l',
    role: 'side-left',
    materialId: 'mat-melamina-blanco',
    thicknessMm: 18,
    contour: { points: [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 500, y: 700 }, { x: 0, y: 700 }] },
    faces: [],
    structural: true,
    referenceFace: 'A',
    positionMm: { x: 0, y: 0, z: 0 },
    dimensionsMm: { width: 500, height: 700 },
    cutDimensionsMm: { width: 498, height: 700 },
    cutContour: { points: [{ x: 0, y: 0 }, { x: 498, y: 0 }, { x: 498, y: 700 }, { x: 0, y: 700 }] },
    bandedEdges: [{ faceId: 'right-edge', edgeBandId: 'eb-1', thicknessMm: 2, lengthMm: 700 }],
  },
  {
    id: 'base-back',
    role: 'back',
    materialId: 'mat-fondo-blanco',
    thicknessMm: 3,
    contour: { points: [{ x: 0, y: 0 }, { x: 564, y: 0 }, { x: 564, y: 680 }, { x: 0, y: 680 }] },
    faces: [],
    structural: false,
    referenceFace: 'A',
    positionMm: { x: 18, y: 18, z: 480 },
    dimensionsMm: { width: 564, height: 680 },
    cutDimensionsMm: { width: 564, height: 680 },
    cutContour: { points: [{ x: 0, y: 0 }, { x: 564, y: 0 }, { x: 564, y: 680 }, { x: 0, y: 680 }] },
    bandedEdges: [],
  },
];

const mockMaterials: Material[] = [
  {
    schemaVersion: 1,
    id: 'mat-melamina-blanco',
    name: 'Melamina Blanca 18mm',
    thicknessMm: 18,
    sheetSizeMm: { length: 2750, width: 1830 },
    hasGrain: false,
    milling: { hidden: 'yes', visible: 'yes', onStructuralPiece: 'yes' },
  },
  {
    schemaVersion: 1,
    id: 'mat-fondo-blanco',
    name: 'Fibroplus Blanco 3mm',
    thicknessMm: 3,
    sheetSizeMm: { length: 2750, width: 1830 },
    hasGrain: false,
    milling: { hidden: 'yes', visible: 'yes', onStructuralPiece: 'yes' },
  },
];

const mockEdgeBands: EdgeBand[] = [
  { schemaVersion: 1, id: 'eb-1', kind: 'adhesive', thicknessMm: 2, pricePerMeter: 1.5 },
];

describe('PieceListView Grouped Plate Cutting List (Point 10)', () => {
  it('renders pieces separated into plate groups by material with headers and subtotals', () => {
    const html = renderToString(
      <PieceListView
        pieces={mockPieces}
        materials={mockMaterials}
        edgeBands={mockEdgeBands}
        selectedPieceId={null}
        onSelectPiece={vi.fn()}
      />,
    );

    // Checks that plates are organized into their respective sheets
    expect(html).toContain('Agrupar por Placa');
    expect(html).toContain('Melamina Blanca 18mm');
    expect(html).toContain('Espesor base:');
    expect(html).toContain('Fibroplus Blanco 3mm');
  });

  it('renders inline modification inspector when a piece is selected in the list', () => {
    const html = renderToString(
      <PieceListView
        pieces={mockPieces}
        materials={mockMaterials}
        edgeBands={mockEdgeBands}
        selectedPieceId="base-side-l"
        onSelectPiece={vi.fn()}
        onSetPieceMaterial={vi.fn()}
        onSetPieceThickness={vi.fn()}
        onSetPieceEdgeBands={vi.fn()}
        onOpenMachiningModal={vi.fn()}
      />,
    );

    expect(html).toContain('Modificar Placa Seleccionada:');
    expect(html).toContain('base-side-l');
    expect(html).toContain('Material:');
    expect(html).toContain('Espesor (mm):');
    expect(html).toContain('Cantos / Tapacantos:');
    expect(html).toContain('Mecanizados de Placa');
    expect(html).toContain('Cerrar Inspector');
  });
});
