import { describe, it, expect } from 'vitest';
import { createPiece, createRectangularContour } from '../src/resolver/piece';
import { applyFrontEdgeBand, applyRearEdgeBand } from '../src/resolver/frontEdge';
import { determinePieceSpatialSize, resolveDepthEdgeFaceIds } from '../src/resolver/spatial3d';

const make = (role: string, w: number, h: number) =>
  createPiece({ id: role, role, materialId: 'm', contour: createRectangularContour(w, h), thicknessMm: 18 });

const banded = (p: ReturnType<typeof make>) =>
  p.faces.filter((f) => f.edgeBandId).map((f) => f.id);

describe('front/rear edge reference follows the 3D depth axis (front at z = 0)', () => {
  it('side panels: contour X is depth, front is left-edge, rear is right-edge', () => {
    const side = make('side-left', 560, 720);
    expect(determinePieceSpatialSize(side)).toEqual({ x: 18, y: 720, z: 560 });
    applyFrontEdgeBand(side, 'eb');
    expect(banded(side)).toEqual(['left-edge']);
    applyRearEdgeBand(side, 'eb2');
    expect(banded(side).sort()).toEqual(['left-edge', 'right-edge']);
  });

  it('horizontal panels: contour Y is depth, front is bottom-edge, rear is top-edge', () => {
    const bottom = make('bottom', 764, 560);
    expect(determinePieceSpatialSize(bottom).z).toBe(560);
    applyFrontEdgeBand(bottom, 'eb');
    expect(banded(bottom)).toEqual(['bottom-edge']);
    expect(resolveDepthEdgeFaceIds('shelf')).toEqual({ front: 'bottom-edge', rear: 'top-edge' });
  });

  it('panels without depth extent (back, doors) are left untouched', () => {
    const back = make('back', 700, 700);
    expect(resolveDepthEdgeFaceIds('back')).toBeUndefined();
    applyFrontEdgeBand(back, 'eb');
    expect(banded(back)).toEqual([]);
  });
});
