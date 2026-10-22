import { describe, it, expect } from 'vitest';
import { buildDrawerSubAssembly } from '../src/resolver/templates/drawer';
import {
  computeTreeGeometry,
  createMatrixGrid,
  splitCellAtPath,
  updateTrackAtPath,
  addTrackAtPath,
  removeTrackAtPath,
  getCellAtPath,
} from '../src/resolver/composition/bayCellTree';
import { type BayContentSubdivided } from '../src/resolver/composition/types';
import { type Material } from '../src/model';

const testMaterial: Material = {
  schemaVersion: 1,
  id: 'mat-test-18',
  name: 'Melamine White 18mm',
  thicknessMm: 18,
  sheetSizeMm: { length: 2750, width: 1830 },
  hasGrain: false,
  milling: { hidden: 'yes', visible: 'no', onStructuralPiece: 'limited' },
};

describe('Fine Craft & Organizer Drawers (6mm / 9mm Box Construction)', () => {
  it('constructs 6mm drawer box using glued joints without confirmat screws into edge', () => {
    const res = buildDrawerSubAssembly(
      {
        idPrefix: 'test-craft',
        index: 1,
        openingWidthMm: 400,
        depthMm: 350,
        frontHeightMm: 120,
        boxHeightMm: 90,
        baseYMm: 18,
        carcaseThicknessMm: 18,
        materialId: testMaterial.id,
        slideType: 'wood-runner',
        boxThicknessMm: 6,
        drawerType: 'simple-interior',
      },
      'carcase-side-left',
    );

    // Box sides should be 6mm thick
    const sideL = res.pieces.find((p) => p.role === 'drawer-side' && p.id.includes('-l-'));
    expect(sideL).toBeDefined();
    expect(sideL?.thicknessMm).toBe(6);

    // Confirmat screws MUST NOT be used on 6mm box
    const confirmatJoints = res.joints.filter((j) => j.kind === 'confirmat');
    expect(confirmatJoints).toHaveLength(0);

    // Box joints should be 'glue'
    const glueJoints = res.joints.filter((j) => j.kind === 'glue');
    expect(glueJoints.length).toBeGreaterThanOrEqual(2);

    // Bottom must not be screwed into 6mm edge; it should be grooved or glued
    const bottomJoints = res.joints.filter((j) => j.kind === 'groove' || j.kind === 'glue');
    expect(bottomJoints.length).toBeGreaterThan(0);
  });

  it('supports monolithic 6mm drawer with 6mm front thickness', () => {
    const res = buildDrawerSubAssembly(
      {
        idPrefix: 'test-mono',
        index: 1,
        openingWidthMm: 300,
        depthMm: 250,
        frontHeightMm: 80,
        boxHeightMm: 60,
        baseYMm: 18,
        carcaseThicknessMm: 18,
        materialId: testMaterial.id,
        slideType: 'wood-runner',
        boxThicknessMm: 6,
        frontThicknessMm: 6,
        drawerType: 'simple-interior',
      },
      'carcase-side-left',
    );

    const front = res.pieces.find((p) => p.role === 'drawer-front');
    expect(front).toBeDefined();
    expect(front?.thicknessMm).toBe(6);

    // Flush inset: front Z offset is 0
    const frontNode = res.placementNodes.find((n) => n.pieceId === front?.id);
    expect(frontNode?.relativeOffset.z).toBe(0);

    // No confirmat joints
    expect(res.joints.filter((j) => j.kind === 'confirmat')).toHaveLength(0);
  });
});

describe('Mixed Track Distribution (Fixed Millimeters + Proportional % / fr)', () => {
  it('resolves a row with 100mm fixed cubby and remainder split 70% / 30%', () => {
    // Bay opening: 800mm wide x 500mm high
    // Vertical partition (axis: 'horizontal') with 18mm thickness
    // Tracks: [ 100mm fixed, 7fr, 3fr ]
    const initial = splitCellAtPath(
      { type: 'empty' },
      [],
      'horizontal',
      [
        { type: 'fixed', valueMm: 100 },
        { type: 'fractional', valueFr: 7 },
        { type: 'fractional', valueFr: 3 },
      ],
      18,
    );

    const geom = computeTreeGeometry(initial, 800, 500, 18);
    expect(geom.cells).toHaveLength(3);

    // Child 0: exact 100mm width
    expect(geom.cells[0]?.width).toBe(100);

    // Dividers: 2 dividers of 18mm = 36mm
    // Remainder for fr = 800 - 36 - 100 = 664mm
    // Child 1: 70% of 664mm = 464.8 -> 465mm
    // Child 2: 30% of 664mm = 199.2 -> 199mm
    expect(geom.cells[1]?.width).toBe(465);
    expect(geom.cells[2]?.width).toBe(199);

    // Sum of widths + dividers = 100 + 465 + 199 + 36 = 800mm exact
    expect(geom.cells[0]!.width + geom.cells[1]!.width + geom.cells[2]!.width + 36).toBe(800);
  });

  it('allows independent splits between rows (row 0 has 3 tracks, row 1 is 50/50)', () => {
    // 2 rows (continuity: shelves continuous)
    const root = createMatrixGrid(2, 1, 'horizontal-continuous', 18);

    // Split Row 0 into 100mm + 70/30
    const withRow0Split = splitCellAtPath(
      root,
      [0],
      'horizontal',
      [
        { type: 'fixed', valueMm: 100 },
        { type: 'fractional', valueFr: 7 },
        { type: 'fractional', valueFr: 3 },
      ],
      18,
    );

    // Split Row 1 into 50/50
    const withRow1Split = splitCellAtPath(
      withRow0Split,
      [1],
      'horizontal',
      [
        { type: 'fractional', valueFr: 1 },
        { type: 'fractional', valueFr: 1 },
      ],
      18,
    );

    const geom = computeTreeGeometry(withRow1Split, 900, 600, 18);
    // Row 0 has 3 leaf cells, Row 1 has 2 leaf cells -> Total 5 leaf cells
    expect(geom.cells).toHaveLength(5);

    // Row 0 first cell is 100mm
    const row0Cell0 = geom.cells.find((c) => c.path[0] === 0 && c.path[1] === 0);
    expect(row0Cell0?.width).toBe(100);

    // Row 1 cells: 900 - 18 = 882 / 2 = 441mm each
    const row1Cell0 = geom.cells.find((c) => c.path[0] === 1 && c.path[1] === 0);
    const row1Cell1 = geom.cells.find((c) => c.path[0] === 1 && c.path[1] === 1);
    expect(row1Cell0?.width).toBe(441);
    expect(row1Cell1?.width).toBe(441);
  });

  it('dynamically updates track sizing using updateTrackAtPath and addTrackAtPath', () => {
    const root = splitCellAtPath(
      { type: 'empty' },
      [],
      'horizontal',
      [
        { type: 'fractional', valueFr: 1 },
        { type: 'fractional', valueFr: 1 },
      ],
      18,
    );

    // Change first track to fixed 150mm
    const updated = updateTrackAtPath(root, [], 0, { type: 'fixed', valueMm: 150 });
    const sub = getCellAtPath(updated, []) as BayContentSubdivided;
    expect(sub.tracks[0]).toEqual({ type: 'fixed', valueMm: 150 });
    expect(sub.tracks[1]).toEqual({ type: 'fractional', valueFr: 1 });

    // Add a 3rd track
    const added = addTrackAtPath(updated, [], { type: 'fractional', valueFr: 2 });
    const subAdded = getCellAtPath(added, []) as BayContentSubdivided;
    expect(subAdded.tracks).toHaveLength(3);
    expect(subAdded.tracks[2]).toEqual({ type: 'fractional', valueFr: 2 });

    // Remove 2nd track
    const removed = removeTrackAtPath(added, [], 1);
    const subRemoved = getCellAtPath(removed, []) as BayContentSubdivided;
    expect(subRemoved.tracks).toHaveLength(2);
    expect(subRemoved.tracks[0]).toEqual({ type: 'fixed', valueMm: 150 });
    expect(subRemoved.tracks[1]).toEqual({ type: 'fractional', valueFr: 2 });
  });

  it('supports 6mm continuous reference spine grid', () => {
    const grid6mm = createMatrixGrid(
      3,
      2,
      'horizontal-continuous',
      6, // 6mm continuous spine
      'dado-groove',
      undefined,
      undefined,
      6, // 6mm inner dividers
    );

    const geom = computeTreeGeometry(grid6mm, 600, 600, 6);
    expect(geom.cells).toHaveLength(6); // 3 rows x 2 cols = 6 cells

    // All dividers should be 6mm
    for (const div of geom.dividers) {
      expect(div.thicknessMm).toBe(6);
      expect(div.jointType).toBe('dado-groove');
    }
  });
});
