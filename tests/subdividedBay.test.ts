import { describe, it, expect } from 'vitest';
import { buildModularModule } from '../src/resolver/composition/compositionEngine';
import { deriveModuleGrooveOperations } from '../src/resolver/machining/grooveDeriver';
import { resolveModuleSpatialBoxes } from '../src/resolver/spatial3d';
import { type ModularModuleDefinition } from '../src/resolver/composition/types';

describe('SubdividedBayResolver & Thin Partitions (v0.19.0)', () => {
  it('subdivides a bay with 6mm Guatambú partitions into 3 pencil/paper cubbies with dado grooves', () => {
    const def: ModularModuleDefinition = {
      id: 'mod-artist-organizer',
      carcass: {
        width: 600,
        height: 400,
        depth: 300,
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
          axis: 'horizontal', // vertical partitions dividing X
          tracks: [
            { type: 'fractional', valueFr: 1 },
            { type: 'fractional', valueFr: 1 },
            { type: 'fractional', valueFr: 1 },
          ],
          dividerThicknessMm: 6,
          dividerMaterialId: 'mat-plywood-guatambu-6',
          jointType: 'dado-groove',
          bays: [
            { type: 'empty' },
            { type: 'empty' },
            { type: 'empty' },
          ],
        },
      ],
    };

    const output = buildModularModule(def, { carcassThicknessMm: 18 });
    const { module, placementTree } = output;

    // Check that 2 vertical divider partitions were generated
    const partitions = module.pieces.filter((p) => p.role === 'partition');
    expect(partitions.length).toBe(2);

    for (const p of partitions) {
      expect(p.thicknessMm).toBe(6);
      expect(p.materialId).toBe('mat-plywood-guatambu-6');
      expect(p.structural).toBe(false); // Non-structural thin partition
    }

    // Check that joints for partitions are 'groove' (dado encastre)
    const partitionJoints = module.joints.filter((j) =>
      partitions.some((p) => p.id === j.a.pieceId || p.id === j.b.pieceId),
    );
    expect(partitionJoints.length).toBeGreaterThanOrEqual(2);
    for (const j of partitionJoints) {
      expect(j.kind).toBe('groove');
    }

    // Verify machining groove derivation derives the dado grooves on bottom panel and roof
    const grooveOps = deriveModuleGrooveOperations(module.pieces, module.joints);
    const dadoOps = grooveOps.filter((op) => op.description?.includes('Ranura de encastre'));
    expect(dadoOps.length).toBeGreaterThanOrEqual(2);
    for (const op of dadoOps) {
      expect(op.depthMm).toBe(4);
      expect(op.widthMm).toBeCloseTo(6.5, 1);
    }

    // Verify 3D placement
    const { boxes } = resolveModuleSpatialBoxes(module.pieces, placementTree);
    expect(boxes.length).toBe(module.pieces.length);
    for (const b of boxes) {
      expect(b.sizeMm.x).toBeGreaterThan(0);
      expect(b.sizeMm.y).toBeGreaterThan(0);
      expect(b.sizeMm.z).toBeGreaterThan(0);
    }
  });

  it('subdivides a bay vertically into a top drawer zone (150mm) and a bottom shelves zone', () => {
    const def: ModularModuleDefinition = {
      id: 'mod-hybrid-artist',
      carcass: {
        width: 800,
        height: 720,
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
          axis: 'vertical', // horizontal shelf dividing Y
          tracks: [
            { type: 'fixed', valueMm: 150 },    // top zone (150mm drawer zone)
            { type: 'fractional', valueFr: 1 }, // bottom zone (remaining height)
          ],
          dividerThicknessMm: 18,
          jointType: 'confirmat',
          bays: [
            // Top cell: 1 compact drawer with wood runners
            {
              type: 'drawer-stack',
              drawerTracks: [{ type: 'fractional', valueFr: 1 }],
              frontMount: 'applied',
              slideType: 'wood-runner',
              drawerType: 'standard',
            },
            // Bottom cell: 2 adjustable shelves
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
    const { module, placementTree } = output;

    // Intermediate horizontal shelf
    const shelves = module.pieces.filter((p) => p.role === 'shelf');
    expect(shelves.length).toBeGreaterThanOrEqual(3); // 1 divider shelf + 2 interior shelves

    // Drawer pieces generated in the top zone
    const drawerFront = module.pieces.find((p) => p.role === 'drawer-front');
    expect(drawerFront).toBeDefined();

    // 3D spatial boxes
    const { boxes } = resolveModuleSpatialBoxes(module.pieces, placementTree);
    expect(boxes.length).toBe(module.pieces.length);

    // Verify drawer is placed higher than bottom shelves
    const dfBox = boxes.find((b) => b.pieceId === drawerFront?.id);
    expect(dfBox).toBeDefined();
    expect(dfBox!.positionMm.y).toBeGreaterThan(450); // In top zone
  });
});
