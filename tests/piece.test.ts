import { describe, it, expect } from 'vitest';
import {
  createPiece,
  createPieceFaces,
  createRectangularContour,
  getContourSegments,
  isDefaultStructuralRole,
  calculateSegmentLength,
  isPieceVisible,
  canPieceRotate,
} from '../src/resolver';

describe('Contour and Segment Calculations', () => {
  it('creates rectangular contour with positive dimensions', () => {
    const contour = createRectangularContour(600, 800);
    expect(contour.points).toEqual([
      { x: 0, y: 0 },
      { x: 600, y: 0 },
      { x: 600, y: 800 },
      { x: 0, y: 800 },
    ]);
  });

  it('rejects invalid contour dimensions', () => {
    expect(() => createRectangularContour(0, 800)).toThrow();
    expect(() => createRectangularContour(600, -50)).toThrow();
  });

  it('calculates segment length correctly', () => {
    const length = calculateSegmentLength({ x: 0, y: 0 }, { x: 300, y: 400 });
    expect(length).toBe(500);
  });

  it('extracts contour segments for rectangular contour', () => {
    const contour = createRectangularContour(600, 800);
    const segments = getContourSegments(contour);

    expect(segments).toHaveLength(4);
    expect(segments[0]).toMatchObject({
      index: 0,
      faceId: 'bottom-edge',
      lengthMm: 600,
    });
    expect(segments[1]).toMatchObject({
      index: 1,
      faceId: 'right-edge',
      lengthMm: 800,
    });
    expect(segments[2]).toMatchObject({
      index: 2,
      faceId: 'top-edge',
      lengthMm: 600,
    });
    expect(segments[3]).toMatchObject({
      index: 3,
      faceId: 'left-edge',
      lengthMm: 800,
    });
  });

  it('allows custom edge face ids', () => {
    const contour = createRectangularContour(500, 300);
    const customNames = ['front', 'side-b', 'back', 'side-a'];
    const segments = getContourSegments(contour, customNames);

    expect(segments.map((s) => s.faceId)).toEqual(customNames);
  });
});

describe('Face Generation and Piece Factory', () => {
  it('generates two large faces and one face per contour segment', () => {
    const contour = createRectangularContour(600, 800);
    const faces = createPieceFaces(contour);

    expect(faces).toHaveLength(6);
    expect(faces[0]?.id).toBe('face-a');
    expect(faces[1]?.id).toBe('face-b');
    expect(faces[2]?.id).toBe('bottom-edge');
    expect(faces[3]?.id).toBe('right-edge');
    expect(faces[4]?.id).toBe('top-edge');
    expect(faces[5]?.id).toBe('left-edge');
    expect(faces.every((f) => f.visible === false)).toBe(true);
  });

  it('makes a piece from contour and thickness with correct defaults', () => {
    const contour = createRectangularContour(600, 800);
    const piece = createPiece({
      id: 'piece-side-left',
      role: 'side-left',
      materialId: 'mat-egger-white-18',
      contour,
      thicknessMm: 18,
    });

    expect(piece.id).toBe('piece-side-left');
    expect(piece.role).toBe('side-left');
    expect(piece.materialId).toBe('mat-egger-white-18');
    expect(piece.thicknessMm).toBe(18);
    expect(piece.faces).toHaveLength(6);
    expect(piece.structural).toBe(true);
    expect(piece.referenceFace).toBe('A');
  });

  it('assigns structural flag based on role defaults or explicit override', () => {
    expect(isDefaultStructuralRole('side-left')).toBe(true);
    expect(isDefaultStructuralRole('bottom')).toBe(true);
    expect(isDefaultStructuralRole('shelf')).toBe(false);

    const contour = createRectangularContour(500, 300);

    const shelf = createPiece({
      id: 'shelf-1',
      role: 'shelf',
      materialId: 'mat-egger-white-18',
      contour,
      thicknessMm: 18,
    });
    expect(shelf.structural).toBe(false);

    const structuralShelf = createPiece({
      id: 'shelf-fixed',
      role: 'shelf',
      materialId: 'mat-egger-white-18',
      contour,
      thicknessMm: 18,
      structural: true,
      referenceFace: 'B',
    });
    expect(structuralShelf.structural).toBe(true);
    expect(structuralShelf.referenceFace).toBe('B');
  });

  it('rejects piece creation with non-positive thickness', () => {
    const contour = createRectangularContour(600, 800);
    expect(() =>
      createPiece({
        id: 'bad-piece',
        role: 'side',
        materialId: 'mat-1',
        contour,
        thicknessMm: 0,
      }),
    ).toThrow();
  });
});

describe('Piece Visibility and Grain Rotation Resolution', () => {
  const contour = createRectangularContour(400, 300);

  it('correctly identifies visible vs hidden pieces by role and attributes', () => {
    const door = createPiece({ id: 'door-1', role: 'door', materialId: 'm1', contour, thicknessMm: 18 });
    const side = createPiece({ id: 'side-1', role: 'side-left', materialId: 'm1', contour, thicknessMm: 18 });
    const shelf = createPiece({ id: 'shelf-1', role: 'shelf', materialId: 'm1', contour, thicknessMm: 18 });

    expect(isPieceVisible(door)).toBe(true);
    expect(isPieceVisible(side)).toBe(true);
    expect(isPieceVisible(shelf)).toBe(true);

    const rail = createPiece({ id: 'rail-1', role: 'rail', materialId: 'm1', contour, thicknessMm: 18 });
    const brace = createPiece({ id: 'brace-1', role: 'brace', materialId: 'm1', contour, thicknessMm: 18 });
    const transom = createPiece({ id: 'transom-1', role: 'transom', materialId: 'm1', contour, thicknessMm: 18 });
    const back = createPiece({ id: 'back-1', role: 'back', materialId: 'm1', contour, thicknessMm: 3 });
    const drawerBox = createPiece({ id: 'box-1', role: 'drawer-box', materialId: 'm1', contour, thicknessMm: 15 });
    const plinth = createPiece({ id: 'plinth-1', role: 'plinth', materialId: 'm1', contour, thicknessMm: 18 });

    expect(isPieceVisible(rail)).toBe(false);
    expect(isPieceVisible(brace)).toBe(false);
    expect(isPieceVisible(transom)).toBe(false);
    expect(isPieceVisible(back)).toBe(false);
    expect(isPieceVisible(drawerBox)).toBe(false);
    expect(isPieceVisible(plinth)).toBe(false);

    // Explicit override via visible attribute
    expect(isPieceVisible({ role: 'door', visible: false })).toBe(false);
    expect(isPieceVisible({ role: 'rail', visible: true })).toBe(true);

    // Auxiliary piece (gauges, spacers) is always hidden
    const auxPiece = createPiece({ id: 'gauge-1', role: 'other', materialId: 'm1', contour, thicknessMm: 18, isAuxiliary: true });
    expect(isPieceVisible(auxPiece)).toBe(false);
  });

  it('allows free rotation when material has no grain, regardless of mode or visibility', () => {
    const door = createPiece({ id: 'door-1', role: 'door', materialId: 'm1', contour, thicknessMm: 18 });
    const rail = createPiece({ id: 'rail-1', role: 'rail', materialId: 'm1', contour, thicknessMm: 18 });

    expect(canPieceRotate(door, false, 'auto')).toBe(true);
    expect(canPieceRotate(door, false, 'strict')).toBe(true);
    expect(canPieceRotate(door, false, 'free')).toBe(true);
    expect(canPieceRotate(rail, false, 'auto')).toBe(true);
  });

  it('resolves piece rotation correctly when material has grain', () => {
    const door = createPiece({ id: 'door-1', role: 'door', materialId: 'm1', contour, thicknessMm: 18 });
    const rail = createPiece({ id: 'rail-1', role: 'rail', materialId: 'm1', contour, thicknessMm: 18 });
    const back = createPiece({ id: 'back-1', role: 'back', materialId: 'm1', contour, thicknessMm: 3 });

    // Mode: free (all pieces can rotate)
    expect(canPieceRotate(door, true, 'free')).toBe(true);
    expect(canPieceRotate(rail, true, 'free')).toBe(true);

    // Mode: strict (no pieces can rotate)
    expect(canPieceRotate(door, true, 'strict')).toBe(false);
    expect(canPieceRotate(rail, true, 'strict')).toBe(false);

    // Mode: auto (hidden pieces rotate freely, visible pieces lock grain)
    expect(canPieceRotate(door, true, 'auto')).toBe(false);
    expect(canPieceRotate(rail, true, 'auto')).toBe(true);
    expect(canPieceRotate(back, true, 'auto')).toBe(true);
  });
});
