import { describe, it, expect } from 'vitest';
import {
  createPiece,
  createPieceFaces,
  createRectangularContour,
  getContourSegments,
  isDefaultStructuralRole,
  calculateSegmentLength,
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
