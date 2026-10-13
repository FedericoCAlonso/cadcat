import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Viewport3D } from '../src/ui/Viewport3D';
import { App } from '../src/ui/App';
import type { SpatialPieceBox, ModuleSpatialBounds, ResolvedPieceWithCutSize } from '../src/resolver';

const mockBoxes: SpatialPieceBox[] = [
  {
    pieceId: 'base-side-left',
    role: 'side-left',
    materialId: 'mat-1',
    thicknessMm: 18,
    positionMm: { x: 0, y: 0, z: 0 },
    sizeMm: { x: 18, y: 800, z: 560 },
    centerMm: { x: 9, y: 400, z: 280 },
  },
  {
    pieceId: 'base-side-right',
    role: 'side-right',
    materialId: 'mat-1',
    thicknessMm: 18,
    positionMm: { x: 582, y: 0, z: 0 },
    sizeMm: { x: 18, y: 800, z: 560 },
    centerMm: { x: 591, y: 400, z: 280 },
  },
];

const mockBounds: ModuleSpatialBounds = {
  min: { x: 0, y: 0, z: 0 },
  max: { x: 600, y: 800, z: 560 },
  center: { x: 300, y: 400, z: 280 },
  size: { x: 600, y: 800, z: 560 },
};

const mockPieces: ResolvedPieceWithCutSize[] = [
  {
    id: 'base-side-left',
    role: 'side-left',
    materialId: 'mat-1',
    thicknessMm: 18,
    contour: {
      points: [
        { x: 0, y: 0 },
        { x: 560, y: 0 },
        { x: 560, y: 800 },
        { x: 0, y: 800 },
      ],
    },
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

describe('Viewport3D Component', () => {
  it('renders 3D Viewport card with canvas wrapper and exploded slider', () => {
    const html = renderToString(
      <Viewport3D
        boxes={mockBoxes}
        bounds={mockBounds}
        pieces={mockPieces}
        explodedRatio={0.35}
        onExplodedRatioChange={vi.fn()}
        selectedPieceId={null}
        onSelectPiece={vi.fn()}
      />,
    );

    expect(html).toContain('3D Module Viewport');
    expect(html).toContain('data-testid="viewport-3d-canvas-wrapper"');
    expect(html).toContain('Exploded View:');
    expect(html).toContain('35%');
    expect(html).toContain('Isometric');
    expect(html).toContain('Front');
    expect(html).toContain('Top');
    expect(html).toContain('Side');
  });

  it('renders selected piece inspector when a piece is selected', () => {
    const html = renderToString(
      <Viewport3D
        boxes={mockBoxes}
        bounds={mockBounds}
        pieces={mockPieces}
        explodedRatio={0}
        onExplodedRatioChange={vi.fn()}
        selectedPieceId="base-side-left"
        onSelectPiece={vi.fn()}
      />,
    );

    expect(html).toContain('Selected Piece: base-side-left');
    expect(html).toContain('side-left');
    expect(html).toContain('560 × 800 mm');
    expect(html).toContain('558 × 800 mm');
    expect(html).toContain('Clear Selection');
  });
});

describe('App Component M3 Navigation Tabs', () => {
  it('renders Material 3 top app bar with navigation tabs', () => {
    const html = renderToString(<App />);

    expect(html).toContain('Mobilius');
    expect(html).toContain('3D Viewport');
    expect(html).toContain('Piece List');
    expect(html).toContain('Parameters');
  });
});
