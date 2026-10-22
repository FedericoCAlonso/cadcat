import { describe, it, expect } from 'vitest';
import {
  computeLeafCells,
  getCellAtPath,
  updateCellAtPath,
  splitCellAtPath,
  removeSplitAtPath,
} from '../src/resolver/composition/bayCellTree';
import { type BayContent } from '../src/resolver/composition/types';

describe('bayCellTree - Word table style interactive cell operations', () => {
  it('computes geometry for a single un-subdivided leaf cell', () => {
    const root: BayContent = { type: 'shelves', count: 2, shelfType: 'adjustable' };
    const cells = computeLeafCells(root, 600, 720);

    expect(cells.length).toBe(1);
    expect(cells[0]!.width).toBe(600);
    expect(cells[0]!.height).toBe(720);
    expect(cells[0]!.x).toBe(0);
    expect(cells[0]!.y).toBe(0);
    expect(cells[0]!.path).toEqual([]);
    expect(cells[0]!.content.type).toBe('shelves');
  });

  it('splits a cell horizontally into top zone (150mm) and bottom zone (rest)', () => {
    const initial: BayContent = { type: 'empty' };
    // Split horizontally (axis: 'vertical' in gridSolver terminology: horizontal shelf dividing Y)
    const subdivided = splitCellAtPath(
      initial,
      [],
      'vertical',
      [
        { type: 'fixed', valueMm: 150 },
        { type: 'fractional', valueFr: 1 },
      ],
      18,
    );

    const cells = computeLeafCells(subdivided, 600, 720, 18);
    expect(cells.length).toBe(2);

    // Row 1: 150mm
    expect(cells[0]!.height).toBe(150);
    expect(cells[0]!.width).toBe(600);
    expect(cells[0]!.y).toBe(0);
    expect(cells[0]!.path).toEqual([0]);

    // Row 2: 720 - 150 - 18 = 552mm
    expect(cells[1]!.height).toBe(552);
    expect(cells[1]!.width).toBe(600);
    expect(cells[1]!.y).toBe(168); // 150 + 18mm divider
    expect(cells[1]!.path).toEqual([1]);
  });

  it('splits the top row vertically into 2 cubbies (staggered / desfasado from bottom row)', () => {
    let tree: BayContent = { type: 'empty' };
    // 1. Split into 2 rows
    tree = splitCellAtPath(
      tree,
      [],
      'vertical',
      [
        { type: 'fixed', valueMm: 150 },
        { type: 'fractional', valueFr: 1 },
      ],
      18,
    );

    // 2. Split top row (path [0]) vertically into 2 columns with 6mm Guatambú
    tree = splitCellAtPath(
      tree,
      [0],
      'horizontal', // axis 'horizontal' divides X
      [
        { type: 'fractional', valueFr: 1 },
        { type: 'fractional', valueFr: 1 },
      ],
      6,
      'mat-plywood-guatambu-6',
      'dado-groove',
    );

    const cells = computeLeafCells(tree, 600, 720, 18);
    // Should have 3 leaf cells: top-left, top-right, and bottom full width!
    expect(cells.length).toBe(3);

    // Top-left: (600 - 6) / 2 = 297mm
    expect(cells[0]!.path).toEqual([0, 0]);
    expect(cells[0]!.width).toBe(297);
    expect(cells[0]!.height).toBe(150);
    expect(cells[0]!.x).toBe(0);
    expect(cells[0]!.y).toBe(0);

    // Top-right
    expect(cells[1]!.path).toEqual([0, 1]);
    expect(cells[1]!.width).toBe(297);
    expect(cells[1]!.height).toBe(150);
    expect(cells[1]!.x).toBe(303); // 297 + 6
    expect(cells[1]!.y).toBe(0);

    // Bottom (full width, uninterrupted!)
    expect(cells[2]!.path).toEqual([1]);
    expect(cells[2]!.width).toBe(600);
    expect(cells[2]!.height).toBe(552);
    expect(cells[2]!.x).toBe(0);
    expect(cells[2]!.y).toBe(168);
  });

  it('updates cell content at path immutably', () => {
    let tree: BayContent = splitCellAtPath(
      { type: 'empty' },
      [],
      'vertical',
      [{ type: 'fixed', valueMm: 150 }, { type: 'fractional', valueFr: 1 }],
      18,
    );

    // Equip bottom cell with shelves
    tree = updateCellAtPath(tree, [1], {
      type: 'shelves',
      count: 2,
      shelfType: 'adjustable',
    });

    const bottomCell = getCellAtPath(tree, [1]);
    expect(bottomCell?.type).toBe('shelves');
    if (bottomCell?.type === 'shelves') {
      expect(bottomCell.count).toBe(2);
    }

    // Top cell remains empty
    const topCell = getCellAtPath(tree, [0]);
    expect(topCell?.type).toBe('empty');
  });

  it('removes split and merges back into single cell', () => {
    let tree: BayContent = splitCellAtPath(
      { type: 'empty' },
      [],
      'vertical',
      [{ type: 'fixed', valueMm: 150 }, { type: 'fractional', valueFr: 1 }],
      18,
    );

    tree = removeSplitAtPath(tree, [0]);
    expect(tree.type).toBe('empty');
  });
});
