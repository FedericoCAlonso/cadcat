import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { MachiningEditorModal } from '../src/ui/MachiningEditorModal';
import type { ResolvedPieceWithCutSize } from '../src/resolver';
import type { CustomPieceOperation } from '../src/model';

const mockPiece: ResolvedPieceWithCutSize = {
  id: 'base-side-l',
  role: 'side-left',
  materialId: 'mat-melamina',
  thicknessMm: 18,
  contour: { points: [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 500, y: 700 }, { x: 0, y: 700 }] },
  faces: [],
  structural: true,
  referenceFace: 'A',
  positionMm: { x: 0, y: 0, z: 0 },
  dimensionsMm: { width: 500, height: 700 },
  cutDimensionsMm: { width: 500, height: 700 },
  cutContour: { points: [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 500, y: 700 }, { x: 0, y: 700 }] },
  bandedEdges: [],
};

const mockOperations: CustomPieceOperation[] = [
  {
    kind: 'groove',
    id: 'groove-1',
    pieceId: 'base-side-l',
    faceType: 'face-A',
    axis: 'x',
    offsetMm: 20,
    widthMm: 4,
    depthMm: 8,
  },
  {
    kind: 'drill',
    id: 'drill-1',
    pieceId: 'base-side-l',
    faceType: 'face-A',
    xMm: 50,
    yMm: 100,
    diameterMm: 8,
    depthMm: 12,
    isThrough: false,
  },
];

describe('MachiningEditorModal Component (Point 8)', () => {
  it('renders modal with piece dimensions, SVG technical drawing preview and operations list', () => {
    const html = renderToString(
      <MachiningEditorModal
        piece={mockPiece}
        customOperations={mockOperations}
        onAddOperation={vi.fn()}
        onRemoveOperation={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(html).toContain('Editor de Mecanizados en Placa:');
    expect(html).toContain('base-side-l');
    expect(html).toContain('500 × 700 × 18 mm');
    expect(html).toContain('Vista Técnica 2D');
    expect(html).toContain('<svg');
    expect(html).toContain('Ranura');
    expect(html).toContain('Rebaje en Canto');
    expect(html).toContain('Fresado / Pasacables');
    expect(html).toContain('Perforación');
    expect(html).toContain('Mecanizados Personalizados');
    expect(html).toContain('GROOVE');
    expect(html).toContain('DRILL');
  });

  it('returns null when piece is null', () => {
    const html = renderToString(
      <MachiningEditorModal
        piece={null}
        customOperations={[]}
        onAddOperation={vi.fn()}
        onRemoveOperation={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(html).toBe('');
  });
});
