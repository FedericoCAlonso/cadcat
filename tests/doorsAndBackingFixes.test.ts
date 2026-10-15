import { describe, it, expect } from 'vitest';
import {
  buildModularModule,
  buildDoorCabinet,
  HingeJointStrategy,
  type ModularModuleDefinition,
} from '../src/resolver';
import type { Material, ProjectConfig } from '../src/model';
import defaultProjectConfigJson from '../src/config/defaultProjectConfig.json';

const defaultProjectConfig = defaultProjectConfigJson as unknown as ProjectConfig;

const testCarcassMaterial: Material = {
  schemaVersion: 1,
  id: 'mat-carcass-18',
  name: 'Melamina Blanca 18mm',
  thicknessMm: 18,
  sheetSizeMm: { length: 2750, width: 1830 },
  hasGrain: false,
  milling: { hidden: 'yes', visible: 'no', onStructuralPiece: 'limited' },
};

const testBackingMaterial: Material = {
  schemaVersion: 1,
  id: 'mat-mdf-white-3',
  name: 'Fibrofácil / MDF Fondo Blanco 3mm',
  thicknessMm: 3,
  sheetSizeMm: { length: 2750, width: 1830 },
  hasGrain: false,
  milling: { hidden: 'no', visible: 'no', onStructuralPiece: 'no' },
};

describe('Doors & Backing Calculations - 4 Specific Fixes', () => {
  // -------------------------------------------------------------------------
  // 1. Shelf depth and Z-offset behind doors (no collision)
  // -------------------------------------------------------------------------
  describe('Fix 1: Shelf depth and Z-offset behind doors', () => {
    it('sets back shelves behind inset doors (codo-18) so they do not collide', () => {
      const def: ModularModuleDefinition = {
        id: 'mod-doors-inset-shelves',
        carcass: {
          width: 600,
          height: 800,
          depth: 500,
          jointPriority: 'lateral-over-bottom',
          roofType: 'solid-panel',
          hasBacking: true,
          backingType: 'groove',
          backingGrooveDistanceMm: 15,
          backingGrooveDepthMm: 8,
          backingThicknessMm: 3,
        },
        grid: {
          axis: 'horizontal',
          tracks: [{ type: 'fractional', valueFr: 1 }],
        },
        bays: [
          {
            type: 'doors',
            count: 1,
            hingeSide: 'left',
            mountType: 'codo-18', // Inset door
            interiorShelvesCount: 2,
            shelfType: 'adjustable',
            shelvesSetbackMm: 20,
          },
        ],
        materials: {
          carcassMaterialId: testCarcassMaterial.id,
          frontsMaterialId: testCarcassMaterial.id,
          drawerBoxesMaterialId: testCarcassMaterial.id,
          backingsMaterialId: testBackingMaterial.id,
        },
      };

      const resolved = buildModularModule(def, {
        carcassThicknessMm: 18,
        frontThicknessMm: 18,
        boxThicknessMm: 15,
      });

      // Door is placed at z = 0, thickness = 18mm
      const doorPiece = resolved.module.pieces.find((p) => p.role.includes('door'))!;
      const doorPlacement = resolved.placementTree.getNode(doorPiece.id)!;
      expect(doorPlacement.relativeOffset.z).toBe(0);

      // Shelves behind the inset door must start at z = frontThickness (18) + setback (20) = 38mm
      const shelfPieces = resolved.module.pieces.filter((p) => p.role === 'shelf');
      expect(shelfPieces).toHaveLength(2);

      for (const shelf of shelfPieces) {
        const shelfPlacement = resolved.placementTree.getNode(shelf.id)!;
        expect(shelfPlacement.relativeOffset.z).toBe(38);

        // Shelf depth should be bay.depth - 38
        // bay.depth with groove is 500 - 15 - 3 = 482mm
        // shelfDepth = bay.depth (500) - 38 = 462mm
        const shelfDepth = shelf.contour.points[2]!.y; // height in 2D rectangle is piece length/depth
        expect(shelfDepth).toBe(462);

        // Check front edge of shelf (z = 38) does not intersect door (z in [0, 18])
        expect(shelfPlacement.relativeOffset.z).toBeGreaterThanOrEqual(18);
      }
    });

    it('sets back shelves by setbackMm for overlay doors (codo-0)', () => {
      const def: ModularModuleDefinition = {
        id: 'mod-doors-overlay-shelves',
        carcass: {
          width: 600,
          height: 800,
          depth: 500,
          jointPriority: 'lateral-over-bottom',
          roofType: 'solid-panel',
          hasBacking: false,
        },
        grid: {
          axis: 'horizontal',
          tracks: [{ type: 'fractional', valueFr: 1 }],
        },
        bays: [
          {
            type: 'doors',
            count: 1,
            hingeSide: 'left',
            mountType: 'codo-0',
            interiorShelvesCount: 1,
            shelfType: 'adjustable',
            shelvesSetbackMm: 20,
          },
        ],
        materials: {
          carcassMaterialId: testCarcassMaterial.id,
          frontsMaterialId: testCarcassMaterial.id,
          drawerBoxesMaterialId: testCarcassMaterial.id,
          backingsMaterialId: testBackingMaterial.id,
        },
      };

      const resolved = buildModularModule(def, {
        carcassThicknessMm: 18,
        frontThicknessMm: 18,
      });

      const shelf = resolved.module.pieces.find((p) => p.role === 'shelf')!;
      const shelfPlacement = resolved.placementTree.getNode(shelf.id)!;

      // For overlay door, shelf starts at z = 20mm
      expect(shelfPlacement.relativeOffset.z).toBe(20);
      // Shelf depth is 500 - 20 = 480mm
      const shelfDepth = shelf.contour.points[2]!.y;
      expect(shelfDepth).toBe(480);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Right door placement and hinge cup holes
  // -------------------------------------------------------------------------
  describe('Fix 2: Right door placement and hinge cup holes', () => {
    it('drills hinge cup hole on the right edge of a right-hinged door', () => {
      const strategy = new HingeJointStrategy();

      const leftDoor = {
        id: 'door-left',
        role: 'door-left',
        contour: { points: [{ x: 0, y: 0 }, { x: 395, y: 0 }, { x: 395, y: 760 }, { x: 0, y: 760 }] },
        thicknessMm: 18,
      };

      const rightDoor = {
        id: 'door-right',
        role: 'door-right',
        contour: { points: [{ x: 0, y: 0 }, { x: 395, y: 0 }, { x: 395, y: 760 }, { x: 0, y: 760 }] },
        thicknessMm: 18,
      };

      const carcaseSide = {
        id: 'side-right',
        role: 'side-right',
        contour: { points: [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 500, y: 800 }, { x: 0, y: 800 }] },
        thicknessMm: 18,
      };

      let opId = 0;
      const genId = () => `op-${++opId}`;

      // Left door joint operations
      const leftOps = strategy.generateOperations({
        pieceA: leftDoor as any,
        pieceB: carcaseSide as any,
        joint: {
          a: { pieceId: 'door-left', faceId: 'inner' },
          b: { pieceId: 'side-left', faceId: 'inner' },
          kind: 'hinge',
          offsetMm: 100,
        },
        effectiveKind: 'hinge',
        config: defaultProjectConfig.machining,
        generateOpId: genId,
      });

      const leftCup = leftOps.find((op) => op.pieceId === 'door-left')!;
      expect(leftCup.positionMm.x).toBe(21.5); // standard setback from left edge

      // Right door joint operations
      const rightOps = strategy.generateOperations({
        pieceA: rightDoor as any,
        pieceB: carcaseSide as any,
        joint: {
          a: { pieceId: 'door-right', faceId: 'inner' },
          b: { pieceId: 'side-right', faceId: 'inner' },
          kind: 'hinge',
          offsetMm: 100,
        },
        effectiveKind: 'hinge',
        config: defaultProjectConfig.machining,
        generateOpId: genId,
      });

      const rightCup = rightOps.find((op) => op.pieceId === 'door-right')!;
      // For right door with width 395mm: 395 - 21.5 = 373.5mm
      expect(rightCup.positionMm.x).toBe(395 - 21.5);
    });

    it('positions right door properly inside cabinet width in doorCabinet subassembly', () => {
      const result = buildDoorCabinet(
        {
          width: 800,
          height: 800,
          depth: 500,
          doorMountType: 'full-overlay',
        },
        testCarcassMaterial,
      );

      const rightDoor = result.module.pieces.find((p) => p.role === 'door-right')!;
      const rightPlacement = result.placementTree.getNode(rightDoor.id)!;

      // Right door must be within the cabinet span [0, 800], not >= 800
      expect(rightPlacement.relativeOffset.x).toBeGreaterThan(0);
      expect(rightPlacement.relativeOffset.x).toBeLessThan(800);
      // Right door end position: x + width must align with right reveal (800 - 1.5 = 798.5)
      const doorW = rightDoor.contour.points[1]!.x;
      const rightEdge = rightPlacement.relativeOffset.x + doorW;
      expect(rightEdge).toBeCloseTo(800 - 1.5, 0);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Concealed hinge crank types: Codo 0, Codo 9, Codo 18
  // -------------------------------------------------------------------------
  describe('Fix 3: Concealed hinge crank types (Codo 0, Codo 9, Codo 18)', () => {
    const strategy = new HingeJointStrategy();
    const door = {
      id: 'test-door',
      role: 'door-left',
      contour: { points: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 700 }, { x: 0, y: 700 }] },
      thicknessMm: 18,
    };
    const side = {
      id: 'test-side',
      role: 'side-left',
      contour: { points: [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 500, y: 800 }, { x: 0, y: 800 }] },
      thicknessMm: 18,
    };

    it('uses 37mm setback on carcase side for Codo 0 (Recta / Full Overlay)', () => {
      let opId = 0;
      const ops = strategy.generateOperations({
        pieceA: door as any,
        pieceB: side as any,
        joint: {
          a: { pieceId: 'test-door', faceId: 'inner' },
          b: { pieceId: 'test-side', faceId: 'inner' },
          kind: 'hinge',
          hingeCrank: 'codo-0',
          offsetMm: 120,
        },
        effectiveKind: 'hinge',
        config: defaultProjectConfig.machining,
        generateOpId: () => `op-${++opId}`,
      });

      const sideHoles = ops.filter((o) => o.pieceId === 'test-side');
      expect(sideHoles).toHaveLength(2);
      expect(sideHoles[0]!.positionMm.x).toBe(37);
      expect(sideHoles[1]!.positionMm.x).toBe(37);
    });

    it('uses 37mm setback on carcase side for Codo 9 (Acodada / Half Overlay)', () => {
      let opId = 0;
      const ops = strategy.generateOperations({
        pieceA: door as any,
        pieceB: side as any,
        joint: {
          a: { pieceId: 'test-door', faceId: 'inner' },
          b: { pieceId: 'test-side', faceId: 'inner' },
          kind: 'hinge',
          hingeCrank: 'codo-9',
          offsetMm: 120,
        },
        effectiveKind: 'hinge',
        config: defaultProjectConfig.machining,
        generateOpId: () => `op-${++opId}`,
      });

      const sideHoles = ops.filter((o) => o.pieceId === 'test-side');
      expect(sideHoles).toHaveLength(2);
      expect(sideHoles[0]!.positionMm.x).toBe(37);
      expect(sideHoles[1]!.positionMm.x).toBe(37);
    });

    it('uses 37mm + doorThickness (55mm for 18mm door) on carcase side for Codo 18 (Superacodada / Inset)', () => {
      let opId = 0;
      const ops = strategy.generateOperations({
        pieceA: door as any,
        pieceB: side as any,
        joint: {
          a: { pieceId: 'test-door', faceId: 'inner' },
          b: { pieceId: 'test-side', faceId: 'inner' },
          kind: 'hinge',
          hingeCrank: 'codo-18',
          offsetMm: 120,
        },
        effectiveKind: 'hinge',
        config: defaultProjectConfig.machining,
        generateOpId: () => `op-${++opId}`,
      });

      const sideHoles = ops.filter((o) => o.pieceId === 'test-side');
      expect(sideHoles).toHaveLength(2);
      // 37 + 18 = 55mm
      expect(sideHoles[0]!.positionMm.x).toBe(55);
      expect(sideHoles[1]!.positionMm.x).toBe(55);
      expect(sideHoles[0]!.description).toContain('Codo 18');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Nailed/screwed thin back panel dimensions and placement
  // -------------------------------------------------------------------------
  describe('Fix 4: Nailed/screwed thin back panel dimensions and placement', () => {
    it('calculates full outer carcase width and height for overlay thin backing on rear cantos', () => {
      const def: ModularModuleDefinition = {
        id: 'mod-overlay-back',
        carcass: {
          width: 600,
          height: 800,
          depth: 500,
          jointPriority: 'lateral-over-bottom',
          roofType: 'solid-panel',
          hasBacking: true,
          backingType: 'overlay', // Nailed/screwed on rear cantos
          backingThicknessMm: 3,
        },
        grid: {
          axis: 'horizontal',
          tracks: [{ type: 'fractional', valueFr: 1 }],
        },
        bays: [{ type: 'empty' }],
        materials: {
          carcassMaterialId: testCarcassMaterial.id,
          frontsMaterialId: testCarcassMaterial.id,
          drawerBoxesMaterialId: testCarcassMaterial.id,
          backingsMaterialId: testBackingMaterial.id,
        },
      };

      const resolved = buildModularModule(def, {
        carcassThicknessMm: 18,
      });

      const backPiece = resolved.module.pieces.find((p) => p.role === 'back')!;
      expect(backPiece).toBeDefined();

      // Back panel dimensions must span outer edges: 600mm width, 800mm height
      const backWidth = backPiece.contour.points[1]!.x;
      const backHeight = backPiece.contour.points[2]!.y;
      expect(backWidth).toBe(600); // NOT 564 (which was inner width)
      expect(backHeight).toBe(800); // Spans from bottom panel to top panel

      // Placement node must sit on rear face of cabinet at z = depth (500)
      const backPlacement = resolved.placementTree.getNode(backPiece.id)!;
      expect(backPlacement.relativeOffset.x).toBe(0);
      expect(backPlacement.relativeOffset.y).toBe(0);
      expect(backPlacement.relativeOffset.z).toBe(500);

      // Backing must be connected with screws to rear edges
      const backJoints = resolved.module.joints.filter(
        (j) => j.a.pieceId === backPiece.id || j.b.pieceId === backPiece.id,
      );
      expect(backJoints.length).toBeGreaterThanOrEqual(4);
      for (const j of backJoints) {
        expect(j.kind).toBe('screw');
      }
    });

    it('accounts for plinth height when overlay backing is nailed above plinth', () => {
      const def: ModularModuleDefinition = {
        id: 'mod-overlay-back-plinth',
        carcass: {
          width: 800,
          height: 850,
          depth: 560,
          jointPriority: 'lateral-over-bottom',
          roofType: 'solid-panel',
          hasPlinth: true,
          plinthHeightMm: 100,
          hasBacking: true,
          backingType: 'overlay',
          backingThicknessMm: 3,
        },
        grid: {
          axis: 'horizontal',
          tracks: [{ type: 'fractional', valueFr: 1 }],
        },
        bays: [{ type: 'empty' }],
        materials: {
          carcassMaterialId: testCarcassMaterial.id,
          frontsMaterialId: testCarcassMaterial.id,
          drawerBoxesMaterialId: testCarcassMaterial.id,
          backingsMaterialId: testBackingMaterial.id,
        },
      };

      const resolved = buildModularModule(def, {
        carcassThicknessMm: 18,
      });

      const backPiece = resolved.module.pieces.find((p) => p.role === 'back')!;
      const backWidth = backPiece.contour.points[1]!.x;
      const backHeight = backPiece.contour.points[2]!.y;

      expect(backWidth).toBe(800);
      expect(backHeight).toBe(750); // 850 - 100 plinth = 750mm carcase

      const backPlacement = resolved.placementTree.getNode(backPiece.id)!;
      expect(backPlacement.relativeOffset.y).toBe(100);
      expect(backPlacement.relativeOffset.z).toBe(560);
    });
  });
});
