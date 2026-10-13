import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ModuleForm } from '../src/ui/ModuleForm';
import { PieceListView } from '../src/ui/PieceListView';
import { App } from '../src/ui/App';
import type { Material, EdgeBand } from '../src/model';
import type { ResolvedPieceWithCutSize } from '../src/resolver';

const mockMaterials: Material[] = [
  {
    schemaVersion: 1,
    id: 'mat-1',
    name: 'Egger White 18mm',
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
    pricePerMeter: 'TO_CONFIRM',
  },
];

describe('ModuleForm Component', () => {
  it('renders input fields for width, height, depth and dropdowns for materials and edge bands', () => {
    const html = renderToString(
      <ModuleForm
        width={600}
        height={800}
        depth={560}
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
      />,
    );

    expect(html).toContain('Width (mm):');
    expect(html).toContain('value="600"');
    expect(html).toContain('Height (mm):');
    expect(html).toContain('value="800"');
    expect(html).toContain('Depth (mm):');
    expect(html).toContain('value="560"');
    expect(html).toContain('Egger White 18mm');
    expect(html).toContain('Save Module to Database');
  });
});

describe('PieceListView Component', () => {
  it('renders piece rows with finished dimensions, cut dimensions, and thickness', () => {
    const samplePieces: ResolvedPieceWithCutSize[] = [
      {
        id: 'piece-side-left',
        role: 'side-left',
        materialId: 'mat-1',
        contour: {
          points: [
            { x: 0, y: 0 },
            { x: 558, y: 0 },
            { x: 558, y: 800 },
            { x: 0, y: 800 },
          ],
        },
        thicknessMm: 18,
        faces: [],
        structural: true,
        referenceFace: 'A',
        positionMm: { x: 0, y: 0, z: 0 },
        dimensionsMm: { width: 560, height: 800 },
        cutDimensionsMm: { width: 558, height: 800 },
        cutContour: {
          points: [
            { x: 0, y: 0 },
            { x: 558, y: 0 },
            { x: 558, y: 800 },
            { x: 0, y: 800 },
          ],
        },
        bandedEdges: [
          { faceId: 'right-edge', edgeBandId: 'eb-1', thicknessMm: 2, lengthMm: 800 },
        ],
      },
    ];

    const html = renderToString(<PieceListView pieces={samplePieces} />);

    expect(html).toContain('side-left');
    expect(html).toContain('560 x 800 mm');
    expect(html).toContain('558 x 800 mm');
    expect(html).toContain('18 mm');
    expect(html).toContain('right-edge (2mm)');
  });

  it('renders empty placeholder when pieces array is empty', () => {
    const html = renderToString(<PieceListView pieces={[]} />);
    expect(html).toContain('No pieces resolved. Adjust module parameters.');
  });
});

describe('App MVVM Integration', () => {
  it('renders application header and main container', () => {
    const html = renderToString(<App />);
    expect(html).toContain('Mobilius');
    expect(html).toContain('Furniture design progressive web application.');
  });
});
