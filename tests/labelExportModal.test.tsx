import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { LabelExportModal } from '../src/ui/LabelExportModal';
import { type Piece, type Material, type EdgeBand } from '../src/model';

const testMaterial: Material = {
  schemaVersion: 1,
  id: 'mat-white-18',
  name: 'Melamina Blanca 18mm',
  thicknessMm: 18,
  sheetSizeMm: { length: 2750, width: 1830 },
  hasGrain: false,
  milling: { hidden: 'yes', visible: 'no', onStructuralPiece: 'limited' },
};

const testEdgeBand: EdgeBand = {
  schemaVersion: 1,
  id: 'eb-white-04',
  thicknessMm: 0.45,
  kind: 'adhesive',
  pricePerMeter: 50,
};

const testPieces: Piece[] = [
  {
    id: 'piece-1',
    role: 'side-left',
    materialId: 'mat-white-18',
    thicknessMm: 18,
    contour: {
      points: [
        { x: 0, y: 0 },
        { x: 500, y: 0 },
        { x: 500, y: 700 },
        { x: 0, y: 700 },
      ],
    },
    faces: [],
    structural: true,
    referenceFace: 'A',
  },
];

describe('LabelExportModal Component', () => {
  it('does not render when isOpen is false', () => {
    const html = renderToString(
      <LabelExportModal
        isOpen={false}
        onClose={vi.fn()}
        pieces={testPieces}
        materials={[testMaterial]}
        edgeBands={[testEdgeBand]}
      />
    );
    expect(html).toBe('');
  });

  it('renders modal dialog with standard label formats and actions when isOpen is true', () => {
    const html = renderToString(
      <LabelExportModal
        isOpen={true}
        onClose={vi.fn()}
        pieces={testPieces}
        materials={[testMaterial]}
        edgeBands={[testEdgeBand]}
        moduleName="Bajo Mesada"
        orderId="ORD-99"
        clientName="Juan Pérez"
      />
    );

    expect(html).toContain('Impresión de Etiquetas de Taller');
    expect(html).toContain('Rollo Térmico 100 x 50 mm');
    expect(html).toContain('Hoja A4 Troquelada 105 x 48 mm');
    expect(html).toContain('Hoja A4 Troquelada 105 x 37 mm');
    expect(html).toContain('Total de Piezas:');
    expect(html).toContain('Descargar PDF de Etiquetas');
  });
});
