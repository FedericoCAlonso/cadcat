import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ModuleForm } from '../src/ui/ModuleForm';
import { PieceListView } from '../src/ui/PieceListView';
import { MachiningSheetView } from '../src/ui/MachiningSheetView';
import { App } from '../src/ui/App';
import type { Material, EdgeBand } from '../src/model';
import type { ResolvedPieceWithCutSize, PieceMachiningSheet } from '../src/resolver';

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

describe('MachiningSheetView Component', () => {
  const sampleSheets: PieceMachiningSheet[] = [
    {
      pieceId: 'base-side-left',
      role: 'side-left',
      materialId: 'mat-1',
      dimensionsMm: { width: 560, height: 800, thickness: 18 },
      cutDimensionsMm: { width: 558, height: 800 },
      bandedEdges: { top: false, bottom: false, left: false, right: true },
      faceAOperations: [
        {
          id: 'op-1',
          faceType: 'face-A',
          faceId: 'inner',
          diameterMm: 7.0,
          depthMm: 18.0,
          isThrough: true,
          xMm: 50,
          yMm: 9,
          distFromLeftMm: 50,
          distFromBottomMm: 9,
          distFromRightMm: 510,
          distFromTopMm: 791,
          description: 'Confirmat hole',
          sourceJointKind: 'confirmat',
        },
      ],
      faceBOperations: [
        {
          id: 'op-b1',
          faceType: 'face-B',
          faceId: 'outer',
          diameterMm: 5.0,
          depthMm: 12.0,
          isThrough: false,
          xMm: 37,
          yMm: 400,
          distFromLeftMm: 37,
          distFromBottomMm: 400,
          distFromRightMm: 523,
          distFromTopMm: 400,
          description: 'Outer shelf pin',
          sourceJointKind: 'shelf-pin',
        },
      ],
      edgeOperations: [],
      totalOperations: 2,
      requiresTurn: true,
      turnInstructions: 'GIRAR LA PIEZA: Contiene operaciones en Cara B.',
    },
  ];

  it('renders piece chips, info bar, turn warning banner, and operations table', () => {
    const html = renderToString(
      <MachiningSheetView
        sheets={sampleSheets}
        selectedPieceId="base-side-left"
        onSelectPiece={vi.fn()}
        onExportPdf={vi.fn()}
      />,
    );

    expect(html).toContain('Planos de Mecanizado');
    expect(html).toContain('base-side-left');
    expect(html).toContain('560 x 800 x 18 mm');
    expect(html).toContain('ATENCIÓN: GIRAR LA PIEZA');
    expect(html).toContain('Cara A (Frente)');
    expect(html).toContain('Cara B (Reverso)');
    expect(html).toContain('Confirmat hole');
  });

  it('renders empty notice when sheets array is empty', () => {
    const html = renderToString(
      <MachiningSheetView
        sheets={[]}
        selectedPieceId={null}
        onSelectPiece={vi.fn()}
        onExportPdf={vi.fn()}
      />,
    );

    expect(html).toContain('No hay piezas disponibles en el módulo actual');
  });
});

describe('App MVVM Integration', () => {
  it('renders application header, tabs (including Mecanizado), and main container', () => {
    const html = renderToString(<App />);
    expect(html).toContain('Mobilius');
    expect(html).toContain('Furniture design progressive web application.');
    expect(html).toContain('Mecanizado');
  });
});
