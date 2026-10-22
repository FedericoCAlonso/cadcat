import { describe, it, expect } from 'vitest';
import { buildModularModule } from '../src/resolver/composition/compositionEngine';
import { resolveModuleSpatialBoxes } from '../src/resolver/spatial3d';
import { deriveModuleDrillOperations } from '../src/resolver/machining';
import { type ModularModuleDefinition } from '../src/resolver/composition/types';

describe('Precise Subdivided Bay Anchors, Alignment & Machining Bounds', () => {
  it('correctly places Top-Left Drawer Band in a horizontally then vertically split bay', () => {
    // Carcass: 800W x 900H x 400D with 18mm boards.
    // Interior: X in [18, 782] (width 764mm), Y in [18, 882] (height 864mm).
    // Bay top is at Y = 882mm.
    const def: ModularModuleDefinition = {
      id: 'mod-top-left-drawers',
      carcass: {
        width: 800,
        height: 900,
        depth: 400,
        jointPriority: 'lateral-over-bottom',
        roofType: 'solid-panel',
        hasBacking: true,
        backingType: 'groove',
        backingThicknessMm: 3,
      },
      materials: {
        carcassMaterialId: 'mat-egger-white-18',
        frontsMaterialId: 'mat-egger-white-18',
        drawerBoxesMaterialId: 'mat-egger-white-18',
        backingsMaterialId: 'mat-mdf-white-3',
      },
      bays: [
        {
          type: 'subdivided',
          axis: 'vertical', // Horizontal shelf dividing Y (Track 0 = Top, Track 1 = Bottom)
          tracks: [
            { type: 'fixed', valueMm: 200 },    // Top band: 200mm
            { type: 'fractional', valueFr: 1 }, // Bottom zone: remaining (864 - 200 - 18 = 646mm)
          ],
          dividerThicknessMm: 18,
          jointType: 'confirmat',
          bays: [
            // Top band (Track 0) -> Split horizontally into 2 columns
            {
              type: 'subdivided',
              axis: 'horizontal', // Vertical partition dividing X (Col 0 = Left, Col 1 = Right)
              tracks: [
                { type: 'fractional', valueFr: 1 }, // Col 0: Left drawer
                { type: 'fractional', valueFr: 1 }, // Col 1: Right cubby
              ],
              dividerThicknessMm: 18,
              jointType: 'confirmat',
              bays: [
                // Col 0: 1 drawer
                {
                  type: 'drawer-stack',
                  drawerTracks: [{ type: 'fractional', valueFr: 1 }],
                  frontMount: 'applied',
                  slideType: 'wood-runner',
                  drawerType: 'standard',
                },
                // Col 1: Empty cubby
                { type: 'empty' },
              ],
            },
            // Bottom zone (Track 1) -> 2 adjustable shelves
            {
              type: 'shelves',
              count: 2,
              shelfType: 'adjustable',
            },
          ],
        },
      ],
    };

    const output = buildModularModule(def, { carcassThicknessMm: 18 });
    const { module, placementTree, resolvedPieces } = output;
    const { boxes } = resolveModuleSpatialBoxes(module.pieces, placementTree);

    // 1. Verify Horizontal Divider Shelf position in 3D
    // Top of bay is 882. Top zone is 200mm.
    // So shelf divider must be at Y = 882 - 200 - 18 = 664mm.
    const shelfDivider = boxes.find(
      (b) => b.role === 'shelf' && b.sizeMm.x > 700 && Math.abs(b.positionMm.y - 664) <= 2,
    );
    expect(shelfDivider).toBeDefined();
    expect(shelfDivider!.positionMm.y).toBeCloseTo(664, 0);
    expect(shelfDivider!.positionMm.x).toBeCloseTo(18, 0);
    expect(shelfDivider!.sizeMm.x).toBeCloseTo(764, 0);

    // 2. Verify Vertical Partition in the Top Zone
    // Spans only inside the top zone: Y in [682, 882] (height = 200mm).
    // X is centered in the 764mm opening: (764 - 18) / 2 = 373mm column width.
    // Partition X should be around 18 + 373 = 391mm.
    const topPartition = boxes.find(
      (b) => b.role === 'partition' && b.sizeMm.y <= 210,
    );
    expect(topPartition).toBeDefined();
    expect(topPartition!.positionMm.y).toBeCloseTo(682, 0);
    expect(topPartition!.positionMm.x).toBeCloseTo(391, 0);
    expect(topPartition!.sizeMm.y).toBeCloseTo(200, 0);

    // 3. Verify Drawer Front is in Top-Left (NOT bottom, NOT right!)
    const drawerFront = boxes.find((b) => b.role === 'drawer-front');
    expect(drawerFront).toBeDefined();
    // Y must be in the top zone: >= 664mm
    expect(drawerFront!.positionMm.y).toBeGreaterThanOrEqual(664);
    // X must be in the left column: < 391mm
    expect(drawerFront!.positionMm.x).toBeLessThan(391);
    expect(drawerFront!.positionMm.x).toBeGreaterThanOrEqual(0);

    // 4. Verify Drawer Box Sides are strictly in Top-Left
    const drawerSideL = boxes.find((b) => b.pieceId.includes('box-side-l'));
    const drawerSideR = boxes.find((b) => b.pieceId.includes('box-side-r'));
    expect(drawerSideL).toBeDefined();
    expect(drawerSideR).toBeDefined();
    expect(drawerSideL!.positionMm.y).toBeGreaterThanOrEqual(664);
    expect(drawerSideR!.positionMm.y).toBeGreaterThanOrEqual(664);
    expect(drawerSideL!.positionMm.x).toBeLessThan(391);
    expect(drawerSideR!.positionMm.x).toBeLessThan(391);

    // 5. Verify Bottom Shelves are strictly below the shelf divider (Y < 664)
    const interiorShelves = boxes.filter(
      (b) => b.role === 'shelf' && b.pieceId.includes('cell-2'),
    );
    expect(interiorShelves.length).toBe(2);
    for (const s of interiorShelves) {
      expect(s.positionMm.y).toBeLessThan(664);
      expect(s.positionMm.y).toBeGreaterThan(18);
      // Adjustable shelves have 1mm lateral pin clearance on each side (x = 18 + 1 = 19)
      expect(s.positionMm.x).toBeGreaterThanOrEqual(18);
      expect(s.positionMm.x).toBeLessThanOrEqual(20);
      expect(s.sizeMm.x).toBeCloseTo(762, 0); // 764mm bay - 2mm clearance
    }

    // 6. Verify Machining Operations: All drill holes must fall STRICTLY INSIDE piece boundaries
    const drillOps = deriveModuleDrillOperations(resolvedPieces, module.joints);
    expect(drillOps.length).toBeGreaterThan(0);

    const pieceMap = new Map(resolvedPieces.map((p) => [p.id, p]));

    for (const op of drillOps) {
      const piece = pieceMap.get(op.pieceId);
      expect(piece).toBeDefined();

      const pW = piece!.contour.points[1]?.x ?? 0;
      const pH = piece!.contour.points[2]?.y ?? 0;

      // Drill position must not be negative or exceed board dimensions
      expect(op.positionMm.x).toBeGreaterThanOrEqual(0);
      expect(op.positionMm.x).toBeLessThanOrEqual(pW + 1);

      expect(op.positionMm.y).toBeGreaterThanOrEqual(0);
      expect(op.positionMm.y).toBeLessThanOrEqual(pH + 1);
    }

    // Specifically verify slide holes on the top-zone vertical partition
    const partitionSlideOps = drillOps.filter(
      (op) => op.pieceId === topPartition!.pieceId && op.sourceJointKind === 'slide',
    );
    for (const op of partitionSlideOps) {
      // Must be within [0, 200] height of this partition
      expect(op.positionMm.y).toBeGreaterThanOrEqual(0);
      expect(op.positionMm.y).toBeLessThanOrEqual(200);
    }
  });

  it('correctly handles vertical split first then horizontal split without coordinate drift', () => {
    // 800W x 700H x 350D
    const def: ModularModuleDefinition = {
      id: 'mod-vert-first',
      carcass: {
        width: 800,
        height: 700,
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
          type: 'subdivided',
          axis: 'horizontal', // Vertical partition dividing X into Left and Right
          tracks: [
            { type: 'fractional', valueFr: 1 },
            { type: 'fractional', valueFr: 1 },
          ],
          dividerThicknessMm: 18,
          jointType: 'confirmat',
          bays: [
            // Left Bay: 1 shelf
            {
              type: 'shelves',
              count: 1,
              shelfType: 'adjustable',
            },
            // Right Bay: Split horizontally into 2 rows (Top drawer, Bottom empty)
            {
              type: 'subdivided',
              axis: 'vertical',
              tracks: [
                { type: 'fixed', valueMm: 160 },
                { type: 'fractional', valueFr: 1 },
              ],
              dividerThicknessMm: 18,
              jointType: 'confirmat',
              bays: [
                {
                  type: 'drawer-stack',
                  drawerTracks: [{ type: 'fractional', valueFr: 1 }],
                  frontMount: 'applied',
                  slideType: 'wood-runner',
                  drawerType: 'standard',
                },
                { type: 'empty' },
              ],
            },
          ],
        },
      ],
    };

    const output = buildModularModule(def, { carcassThicknessMm: 18 });
    const { module, placementTree, resolvedPieces } = output;
    const { boxes } = resolveModuleSpatialBoxes(module.pieces, placementTree);

    // Main divider partition dividing Left and Right
    const mainPartition = boxes.find(
      (b) => b.role === 'partition' && b.sizeMm.y >= 650,
    );
    expect(mainPartition).toBeDefined();
    const partitionX = mainPartition!.positionMm.x;
    expect(partitionX).toBeCloseTo(391, 0);

    // Left bay shelf must be strictly to the left of the main partition
    const leftShelf = boxes.find(
      (b) => b.role === 'shelf' && b.positionMm.x < 100,
    );
    expect(leftShelf).toBeDefined();
    // Adjustable shelf has 1mm gap on each side
    expect(leftShelf!.positionMm.x).toBeGreaterThanOrEqual(18);
    expect(leftShelf!.positionMm.x).toBeLessThanOrEqual(20);
    expect(leftShelf!.positionMm.x + leftShelf!.sizeMm.x).toBeLessThanOrEqual(partitionX);

    // Right bay divider shelf must start at the partition and end at carcass right
    const rightDividerShelf = boxes.find(
      (b) => b.role === 'shelf' && b.positionMm.x > 350,
    );
    expect(rightDividerShelf).toBeDefined();
    expect(rightDividerShelf!.positionMm.x).toBeCloseTo(partitionX + 18, 0);
    expect(rightDividerShelf!.positionMm.x + rightDividerShelf!.sizeMm.x).toBeCloseTo(782, 0);

    // Right bay drawer must be strictly in the right bay (X > 391) and in the top zone
    const drawerFront = boxes.find((b) => b.role === 'drawer-front');
    expect(drawerFront).toBeDefined();
    expect(drawerFront!.positionMm.x).toBeGreaterThan(partitionX);
    expect(drawerFront!.positionMm.y).toBeGreaterThan(450); // In top zone

    // Machining sanity check: all operations within piece bounds
    const drillOps = deriveModuleDrillOperations(resolvedPieces, module.joints);
    const pieceMap = new Map(resolvedPieces.map((p) => [p.id, p]));

    for (const op of drillOps) {
      const piece = pieceMap.get(op.pieceId);
      expect(piece).toBeDefined();
      const pW = piece!.contour.points[1]?.x ?? 0;
      const pH = piece!.contour.points[2]?.y ?? 0;
      expect(op.positionMm.x).toBeGreaterThanOrEqual(0);
      expect(op.positionMm.x).toBeLessThanOrEqual(pW + 1);
      expect(op.positionMm.y).toBeGreaterThanOrEqual(0);
      expect(op.positionMm.y).toBeLessThanOrEqual(pH + 1);
    }
  });
});
