import { describe, it, expect } from 'vitest';
import {
  type Piece,
  type Material,
  type EdgeBand,
  LABEL_LAYOUT_PRESETS,
} from '../src/model';
import {
  extractPieceLabelData,
  exportLabelsPdf,
} from '../src/resolver/labels';

const mockMaterial: Material = {
  schemaVersion: 1,
  id: 'mat-white-18',
  name: 'Melamina Blanca 18mm',
  thicknessMm: 18,
  sheetSizeMm: { length: 2750, width: 1830 },
  hasGrain: true,
  milling: { hidden: 'yes', visible: 'no', onStructuralPiece: 'limited' },
};

const mockEdgeBand04: EdgeBand = {
  schemaVersion: 1,
  id: 'eb-white-04',
  thicknessMm: 0.4,
  kind: 'adhesive',
  pricePerMeter: 40,
};

const mockEdgeBand20: EdgeBand = {
  schemaVersion: 1,
  id: 'eb-white-20',
  thicknessMm: 2.0,
  kind: 'adhesive',
  pricePerMeter: 120,
};

const mockPieces: Piece[] = [
  {
    id: 'piece-side-left',
    role: 'side-left',
    materialId: 'mat-white-18',
    thicknessMm: 18,
    contour: {
      points: [
        { x: 0, y: 0 },
        { x: 560, y: 0 },
        { x: 560, y: 720 },
        { x: 0, y: 720 },
      ],
    },
    faces: [
      { id: 'bottom-edge', visible: true, edgeBandId: 'eb-white-20' }, // Piso: 2.0mm
      { id: 'right-edge', visible: true, edgeBandId: 'eb-white-04' },  // Frente: 0.4mm
      { id: 'top-edge', visible: true, edgeBandId: 'eb-white-04' },
      { id: 'left-edge', visible: false }, // Fondo sin canto
    ],
    structural: true,
    referenceFace: 'A',
  },
  {
    id: 'piece-bottom',
    role: 'bottom',
    materialId: 'mat-white-18',
    thicknessMm: 18,
    contour: {
      points: [
        { x: 0, y: 0 },
        { x: 764, y: 0 },
        { x: 764, y: 560 },
        { x: 0, y: 560 },
      ],
    },
    faces: [
      { id: 'bottom-edge', visible: true, edgeBandId: 'eb-white-04' }, // Frente: 0.4mm
      { id: 'right-edge', visible: false },
      { id: 'top-edge', visible: false },
      { id: 'left-edge', visible: false },
    ],
    structural: true,
    referenceFace: 'A',
  },
  {
    id: 'piece-gauge-1',
    role: 'assembly-gauge',
    materialId: 'mat-white-18',
    thicknessMm: 18,
    contour: {
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 764 },
        { x: 0, y: 764 },
      ],
    },
    faces: [],
    structural: false,
    referenceFace: 'A',
    isAuxiliary: true,
  },
];

describe('Piece Label Data Extractor', () => {
  it('extracts print-ready label data deducting edgebands for cut sizes', () => {
    const labels = extractPieceLabelData(mockPieces, {
      orderId: 'ORD-101',
      clientName: 'Muebles Gómez',
      moduleId: 'MOD-01',
      moduleName: 'Bajo Mesada 80',
      materials: [mockMaterial],
      edgeBands: [mockEdgeBand04, mockEdgeBand20],
      includeAuxiliaryGauges: false,
    });

    // Auxiliary gauge filtered out by default
    expect(labels.length).toBe(2);

    const sideLeft = labels[0]!;
    expect(sideLeft.pieceId).toBe('piece-side-left');
    expect(sideLeft.orderId).toBe('ORD-101');
    expect(sideLeft.clientName).toBe('Muebles Gómez');
    expect(sideLeft.moduleId).toBe('MOD-01');
    expect(sideLeft.pieceIndex).toBe(1);
    expect(sideLeft.totalPieces).toBe(2);

    // Finished size is 560 x 720
    expect(sideLeft.finishedWidthMm).toBe(560);
    expect(sideLeft.finishedHeightMm).toBe(720);

    // Right edge has 0.4mm, bottom has 2.0mm, top has 0.4mm
    // Cut width = 560 - 0.4 = 559.6
    // Cut height = 720 - (2.0 + 0.4) = 717.6
    expect(sideLeft.cutWidthMm).toBe(559.6);
    expect(sideLeft.cutHeightMm).toBe(717.6);

    // Edge bands
    expect(sideLeft.edgeBands.bottom?.thicknessMm).toBe(2.0);
    expect(sideLeft.edgeBands.bottom?.note).toBe('PISO');
    expect(sideLeft.edgeBands.right?.thicknessMm).toBe(0.4);
    expect(sideLeft.edgeBands.right?.note).toBe('FRENTE');
    expect(sideLeft.edgeBands.left).toBeUndefined(); // Sin canto
  });

  it('includes auxiliary gauges when explicitly requested', () => {
    const labels = extractPieceLabelData(mockPieces, {
      materials: [mockMaterial],
      edgeBands: [mockEdgeBand04, mockEdgeBand20],
      includeAuxiliaryGauges: true,
    });

    expect(labels.length).toBe(3);
    const gauge = labels[2]!;
    expect(gauge.pieceName).toContain('Calibre Auxiliar');
    expect(gauge.totalPieces).toBe(3);
  });
});

describe('Universal Label PDF Generator', () => {
  it('has valid standard presets for thermal rolls and A4 sticker sheets', () => {
    expect(LABEL_LAYOUT_PRESETS['thermal-100x50'].isContinuousRoll).toBe(true);
    expect(LABEL_LAYOUT_PRESETS['thermal-100x50'].labelWidthMm).toBe(100);
    expect(LABEL_LAYOUT_PRESETS['thermal-100x50'].labelHeightMm).toBe(50);

    expect(LABEL_LAYOUT_PRESETS['a4-12-up'].isContinuousRoll).toBe(false);
    expect(LABEL_LAYOUT_PRESETS['a4-12-up'].labelsPerPage).toBe(12);
    expect(LABEL_LAYOUT_PRESETS['a4-12-up'].columns).toBe(2);
    expect(LABEL_LAYOUT_PRESETS['a4-12-up'].rows).toBe(6);
  });

  it('generates a 1-page-per-label continuous PDF for thermal roll printers', () => {
    const labels = extractPieceLabelData(mockPieces, {
      materials: [mockMaterial],
      edgeBands: [mockEdgeBand04, mockEdgeBand20],
      includeAuxiliaryGauges: false,
    });

    const doc = exportLabelsPdf(labels, {
      layout: LABEL_LAYOUT_PRESETS['thermal-100x50'],
    });

    // 2 pieces = 2 pages in thermal roll
    expect(doc.getNumberOfPages()).toBe(2);
    const pdfBytes = doc.output('arraybuffer');
    expect(pdfBytes.byteLength).toBeGreaterThan(1000);
  });

  it('generates a multi-label grid PDF on standard A4 paper', () => {
    // Duplicate pieces to make 14 labels (exceeding 12 per page)
    const pieces14: Piece[] = [];
    const piece0 = mockPieces[0]!;
    const piece1 = mockPieces[1]!;
    for (let i = 0; i < 7; i++) {
      pieces14.push({ ...piece0, id: `side-${i}` });
      pieces14.push({ ...piece1, id: `bottom-${i}` });
    }

    const labels = extractPieceLabelData(pieces14, {
      materials: [mockMaterial],
      edgeBands: [mockEdgeBand04, mockEdgeBand20],
    });

    const doc = exportLabelsPdf(labels, {
      layout: LABEL_LAYOUT_PRESETS['a4-12-up'], // 12 labels per page
    });

    // 14 labels in 12-per-page layout = 2 pages
    expect(doc.getNumberOfPages()).toBe(2);
    const pdfBytes = doc.output('arraybuffer');
    expect(pdfBytes.byteLength).toBeGreaterThan(1000);
  });
});
