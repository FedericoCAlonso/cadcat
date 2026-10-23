import { describe, it, expect } from 'vitest';
import { createPiece, createRectangularContour } from '../src/resolver/piece';
import { createJoint } from '../src/resolver/joint';
import { deriveModuleGrooveOperations } from '../src/resolver/machining/grooveDeriver';

const mk = (id: string, role: string, w: number, h: number, t: number, pos: { x: number; y: number; z: number }) => ({
  ...createPiece({ id, role, materialId: 'm', contour: createRectangularContour(w, h), thicknessMm: t }),
  dimensionsMm: { width: w, height: h },
  positionMm: pos,
});

describe('grooveDeriver placement', () => {
  const opts = { backingThicknessMm: 3, backingGrooveDistanceMm: 15, backingGrooveDepthMm: 8, backingGrooveToleranceMm: 0.5 };

  it('centers backing groove on the back panel and faces the back', () => {
    const left = mk('c-side-left', 'side-left', 560, 720, 18, { x: 0, y: 0, z: 0 });
    const right = mk('c-side-right', 'side-right', 560, 720, 18, { x: 782, y: 0, z: 0 });
    const roof = mk('c-roof', 'top', 764, 560, 18, { x: 18, y: 702, z: 0 });
    const back = mk('c-back', 'back', 780, 700, 3, { x: 10, y: 10, z: 560 - 15 - 3 });
    const joints = [
      createJoint({ a: { pieceId: left.id, faceId: 'inner' }, b: { pieceId: back.id, faceId: 'left-edge' }, kind: 'groove' }),
      createJoint({ a: { pieceId: right.id, faceId: 'inner' }, b: { pieceId: back.id, faceId: 'right-edge' }, kind: 'groove' }),
      createJoint({ a: { pieceId: roof.id, faceId: 'bottom' }, b: { pieceId: back.id, faceId: 'top-edge' }, kind: 'groove' }),
    ];
    const ops = deriveModuleGrooveOperations([left, right, roof, back], joints, opts);
    const l = ops.find((o) => o.pieceId === left.id)!;
    // back occupies depth [542, 545]; groove [541.75, 545.25]
    expect(l.axis).toBe('y');
    expect(l.offsetMm).toBeCloseTo(541.8, 1);
    expect(l.widthMm).toBeCloseTo(3.5, 1);
    expect(l.faceType).toBe('face-A');
    expect(ops.find((o) => o.pieceId === right.id)!.faceType).toBe('face-A');
    const r = ops.find((o) => o.pieceId === roof.id)!;
    expect(r.axis).toBe('x');
    expect(r.faceType).toBe('face-A');
  });

  it('cuts the groove on the underside of a rear rail', () => {
    const rail = mk('c-rail-back', 'rail', 764, 80, 18, { x: 18, y: 702, z: 480 });
    const back = mk('c-back', 'back', 780, 700, 3, { x: 10, y: 10, z: 542 });
    const j = createJoint({ a: { pieceId: rail.id, faceId: 'inner' }, b: { pieceId: back.id, faceId: 'top-edge' }, kind: 'groove' });
    const ops = deriveModuleGrooveOperations([rail, back], [j], opts);
    expect(ops[0]!.faceType).toBe('face-B');
  });

  it('thin horizontal shelf into a side panel runs along depth at the shelf height', () => {
    const side = mk('c-side-left', 'side-left', 560, 720, 18, { x: 0, y: 0, z: 0 });
    const shelf = mk('c-shelf', 'shelf', 400, 540, 6, { x: 18, y: 300, z: 0 });
    const j = createJoint({ a: { pieceId: side.id, faceId: 'inner' }, b: { pieceId: shelf.id, faceId: 'left-edge' }, kind: 'groove' });
    const op = deriveModuleGrooveOperations([side, shelf], [j], opts)[0]!;
    expect(op.axis).toBe('x');
    expect(op.offsetMm).toBeCloseTo(299.8, 1);
    expect(op.faceType).toBe('face-A');
  });
});
