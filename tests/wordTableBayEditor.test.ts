import { describe, it, expect } from 'vitest';
import {
  createMatrixGrid,
  computeTreeGeometry,
  updateDividerAtPath,
  distributeTracksEvenlyAtPath,
  splitCellAtPath,
} from '../src/resolver/composition/bayCellTree';
import { buildModularModule } from '../src/resolver/composition/compositionEngine';
import { resolveModuleSpatialBoxes } from '../src/resolver/spatial3d';
import { type ModularModuleDefinition, type BayContent } from '../src/resolver/composition/types';

describe('Word Table Style Bay Editor & Drawer Construction (v0.19.3)', () => {
  it('creates an aligned 3x2 matrix with continuous horizontal shelves and customizable edges', () => {
    // 3 rows x 2 columns with horizontal continuity (Word-table model)
    const grid = createMatrixGrid(3, 2, 'horizontal-continuous', 18);
    expect(grid.type).toBe('subdivided');

    const { cells, dividers } = computeTreeGeometry(grid, 900, 750, 18);
    expect(cells.length).toBe(6);

    // 2 horizontal shelf dividers across the width
    const horizShelves = dividers.filter((d) => d.axis === 'vertical');
    expect(horizShelves.length).toBe(2);
    for (const hs of horizShelves) {
      expect(hs.width).toBe(900);
      expect(hs.height).toBe(18);
    }

    // 3 vertical dividers (one inside each row)
    const vertPartitions = dividers.filter((d) => d.axis === 'horizontal');
    expect(vertPartitions.length).toBe(3);
    for (const vp of vertPartitions) {
      expect(vp.thicknessMm).toBe(18);
    }
  });

  it('selects and modifies edge properties (thickness to 6mm Guatambú with dado grooves)', () => {
    let grid = createMatrixGrid(2, 2, 'horizontal-continuous', 18);
    const { dividers } = computeTreeGeometry(grid, 800, 600, 18);
    expect(dividers.length).toBe(3);

    // Pick a vertical divider edge
    const vertEdge = dividers.find((d) => d.axis === 'horizontal')!;
    expect(vertEdge).toBeDefined();

    // Update the divider edge to 6mm Guatambú dado-groove
    grid = updateDividerAtPath(grid, vertEdge.path, {
      dividerThicknessMm: 6,
      jointType: 'dado-groove',
    });

    const res = computeTreeGeometry(grid, 800, 600, 18);
    const updatedEdge = res.dividers.find((d) => d.axis === 'horizontal' && d.path.join('-') === vertEdge.path.join('-'))!;
    expect(updatedEdge.thicknessMm).toBe(6);
    expect(updatedEdge.jointType).toBe('dado-groove');
  });

  it('distributes tracks evenly across a non-uniform split (Word table "Distribuir uniformemente")', () => {
    let tree: BayContent = splitCellAtPath(
      { type: 'empty' },
      [],
      'vertical',
      [
        { type: 'fixed', valueMm: 120 },
        { type: 'fractional', valueFr: 2 },
        { type: 'fixed', valueMm: 180 },
      ],
      18,
    );

    tree = distributeTracksEvenlyAtPath(tree, []);
    const sub = tree as any;
    expect(sub.tracks).toEqual([
      { type: 'fractional', valueFr: 1 },
      { type: 'fractional', valueFr: 1 },
      { type: 'fractional', valueFr: 1 },
    ]);
  });

  it('builds wooden runner drawers without applied sobretapa (inset, simple-interior by default)', () => {
    const def: ModularModuleDefinition = {
      id: 'mod-wood-runner-inset',
      carcass: {
        width: 600,
        height: 500,
        depth: 350,
        jointPriority: 'lateral-over-bottom',
        roofType: 'solid-panel',
        hasBacking: false,
      },
      materials: {
        carcassMaterialId: 'mat-egger-white-18',
        frontsMaterialId: 'mat-egger-white-18',
        drawerBoxesMaterialId: 'mat-egger-white-18',
        backingsMaterialId: 'mat-mdf-white-3',
      },
      bays: [
        {
          type: 'drawer-stack',
          drawerTracks: [{ type: 'fractional', valueFr: 1 }],
          slideType: 'wood-runner',
          // frontMount and drawerType not specified; must default to inset / simple-interior
        },
      ],
    };

    const output = buildModularModule(def, { carcassThicknessMm: 18 });
    const { module, placementTree } = output;
    const { boxes } = resolveModuleSpatialBoxes(module.pieces, placementTree);

    // Front must be inset (frontOffsetZ = 0, NOT -18mm overlapping the exterior)
    const drawerFront = boxes.find((b) => b.role === 'drawer-front');
    expect(drawerFront).toBeDefined();
    expect(drawerFront!.positionMm.z).toBe(0); // Inset flush with carcase front opening

    // Front width must fit inside opening: openingWidth - 2 * gap (600 - 36 - 4 = 560mm)
    // NOT applied width (600 - 4 = 596mm)
    expect(drawerFront!.sizeMm.x).toBeLessThan(570);
    expect(drawerFront!.sizeMm.x).toBeCloseTo(560, 0);

    // No separate box-front piece should exist in simple-interior
    const duplicateBoxFront = module.pieces.find((p) => p.role === 'drawer-box-front');
    expect(duplicateBoxFront).toBeUndefined();
  });
});
