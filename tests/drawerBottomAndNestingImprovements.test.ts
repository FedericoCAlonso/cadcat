import { describe, it, expect } from 'vitest';
import {
  buildDrawerSubAssembly,
  DRAWER_SLIDE_CLEARANCES_MM,
} from '../src/resolver/templates/drawer';
import {
  buildModularModule,
  type ModularModuleDefinition,
} from '../src/resolver';
import {
  runGuillotineNesting,
  runMultiMaterialGuillotineNesting,
  type NestingItem,
  type SheetDefinition,
} from '../src/workers';
import type { Material } from '../src/model';

const testCarcassMat: Material = {
  schemaVersion: 1,
  id: 'mat-carcass-18',
  name: 'Melamina Blanca 18mm',
  thicknessMm: 18,
  sheetSizeMm: { length: 2750, width: 1830 },
  hasGrain: false,
  milling: { hidden: 'yes', visible: 'no', onStructuralPiece: 'limited' },
};

const testFrontMat: Material = {
  schemaVersion: 1,
  id: 'mat-front-18',
  name: 'Melamina Roble 18mm',
  thicknessMm: 18,
  sheetSizeMm: { length: 2750, width: 1830 },
  hasGrain: true,
  milling: { hidden: 'yes', visible: 'no', onStructuralPiece: 'limited' },
};

const testBoxMat: Material = {
  schemaVersion: 1,
  id: 'mat-box-15',
  name: 'Melamina Cajón 15mm',
  thicknessMm: 15,
  sheetSizeMm: { length: 2750, width: 1830 },
  hasGrain: false,
  milling: { hidden: 'yes', visible: 'no', onStructuralPiece: 'limited' },
};

const testBackingMat: Material = {
  schemaVersion: 1,
  id: 'mat-backing-3',
  name: 'Fibrofácil Fondo Blanco 3mm',
  thicknessMm: 3,
  sheetSizeMm: { length: 2750, width: 1830 },
  hasGrain: false,
  milling: { hidden: 'no', visible: 'no', onStructuralPiece: 'no' },
};

const testBackingThickMat: Material = {
  schemaVersion: 1,
  id: 'mat-backing-55',
  name: 'Fibrofácil Fondo 5.5mm',
  thicknessMm: 5.5,
  sheetSizeMm: { length: 2750, width: 1830 },
  hasGrain: false,
  milling: { hidden: 'no', visible: 'no', onStructuralPiece: 'no' },
};

describe('Drawer Bottom Calculations & Nesting Optimization Improvements', () => {
  // -------------------------------------------------------------------------
  // 1. Drawer Bottom Sizing & Deduction for bottom-screwed
  // -------------------------------------------------------------------------
  describe('Fix 1: Nailed/screwed drawer bottom sizing correction', () => {
    it('applies default safety deduction (-2mm width, -2mm depth) and centers bottom on box', () => {
      const openingWidth = 600;
      const depth = 500;
      const slideClearance = DRAWER_SLIDE_CLEARANCES_MM['telescopic']; // 25.4
      const expectedBoxWidth = Math.round(openingWidth - slideClearance); // 575
      const expectedBoxDepth = 450; // depth - 50

      const result = buildDrawerSubAssembly(
        {
          idPrefix: 'drawer-test',
          index: 1,
          openingWidthMm: openingWidth,
          depthMm: depth,
          frontHeightMm: 200,
          boxHeightMm: 140,
          baseYMm: 18,
          carcaseThicknessMm: 18,
          materialId: testCarcassMat.id,
          boxMaterialId: testBoxMat.id,
          backingMaterialId: testBackingMat.id,
          backingThicknessMm: 3,
          slideType: 'telescopic',
          bottomMount: 'bottom-screwed',
        },
        'root',
      );

      const bottom = result.pieces.find((p) => p.role === 'drawer-bottom')!;
      expect(bottom).toBeDefined();

      // Width deduction: 575 - 2 = 573mm
      expect(bottom.contour.points[1]!.x).toBe(expectedBoxWidth - 2);
      // Depth deduction: 450 - 2 = 448mm
      expect(bottom.contour.points[2]!.y).toBe(expectedBoxDepth - 2);

      // Centered placement node check
      const placement = result.placementNodes.find((n) => n.pieceId === bottom.id)!;
      // Offset X includes 1mm deduction shift from left edge
      const boxX = 18 + Math.round(slideClearance / 2);
      expect(placement.relativeOffset.x).toBe(boxX + 1);
      // Offset Z includes 1mm deduction shift from front edge
      expect(placement.relativeOffset.z).toBe(1);
    });

    it('respects custom user-configured deductions for bottom-screwed', () => {
      const result = buildDrawerSubAssembly(
        {
          idPrefix: 'drawer-custom-ded',
          index: 1,
          openingWidthMm: 500,
          depthMm: 500,
          frontHeightMm: 180,
          boxHeightMm: 120,
          baseYMm: 18,
          carcaseThicknessMm: 18,
          materialId: testCarcassMat.id,
          slideType: 'telescopic',
          bottomMount: 'bottom-screwed',
          bottomScrewedDeductionWidthMm: 5,
          bottomScrewedDeductionDepthMm: 3,
        },
        'root',
      );

      const bottom = result.pieces.find((p) => p.role === 'drawer-bottom')!;
      const expectedBoxWidth = Math.round(500 - 25.4); // 475
      const expectedBoxDepth = 450;

      expect(bottom.contour.points[1]!.x).toBe(expectedBoxWidth - 5); // 470
      expect(bottom.contour.points[2]!.y).toBe(expectedBoxDepth - 3); // 447
    });
  });

  // -------------------------------------------------------------------------
  // 2. Material and Thickness assignment for Drawer Bottoms
  // -------------------------------------------------------------------------
  describe('Fix 2: Drawer bottom material and thickness selection', () => {
    it('uses backingsMaterialId and its thickness when bottom is grooved or screwed (thin bottom)', () => {
      const def: ModularModuleDefinition = {
        id: 'mod-drawer-thin-bottom',
        carcass: {
          width: 600,
          height: 800,
          depth: 500,
          jointPriority: 'lateral-over-bottom',
          roofType: 'solid-panel',
          hasBacking: true,
          backingThicknessMm: 5.5,
        },
        bays: [
          {
            type: 'drawer-stack',
            drawerTracks: [{ type: 'fractional', valueFr: 1 }],
            frontMount: 'applied',
            slideType: 'telescopic',
            bottomMount: 'bottom-screwed',
          },
        ],
        materials: {
          carcassMaterialId: testCarcassMat.id,
          frontsMaterialId: testFrontMat.id,
          drawerBoxesMaterialId: testBoxMat.id,
          backingsMaterialId: testBackingThickMat.id,
        },
      };

      const resolved = buildModularModule(def, {
        carcassThicknessMm: 18,
        boxThicknessMm: 15,
        backingThicknessMm: 5.5,
      });

      const drawerBottom = resolved.module.pieces.find((p) => p.role === 'drawer-bottom')!;
      expect(drawerBottom).toBeDefined();
      // Must take backings material
      expect(drawerBottom.materialId).toBe(testBackingThickMat.id);
      // Must take backings thickness
      expect(drawerBottom.thicknessMm).toBe(5.5);

      // Drawer box sides must still use drawerBoxesMaterialId and 15mm
      const drawerSide = resolved.module.pieces.find((p) => p.role === 'drawer-side')!;
      expect(drawerSide.materialId).toBe(testBoxMat.id);
      expect(drawerSide.thicknessMm).toBe(15);
    });

    it('uses drawerBoxesMaterialId and boxThickness when bottom is flush-thick', () => {
      const def: ModularModuleDefinition = {
        id: 'mod-drawer-thick-bottom',
        carcass: {
          width: 600,
          height: 800,
          depth: 500,
          jointPriority: 'lateral-over-bottom',
          roofType: 'solid-panel',
          hasBacking: true,
          backingThicknessMm: 3,
        },
        bays: [
          {
            type: 'drawer-stack',
            drawerTracks: [{ type: 'fractional', valueFr: 1 }],
            frontMount: 'applied',
            slideType: 'telescopic',
            bottomMount: 'flush-thick',
          },
        ],
        materials: {
          carcassMaterialId: testCarcassMat.id,
          frontsMaterialId: testFrontMat.id,
          drawerBoxesMaterialId: testBoxMat.id,
          backingsMaterialId: testBackingMat.id,
        },
      };

      const resolved = buildModularModule(def, {
        carcassThicknessMm: 18,
        boxThicknessMm: 15,
        backingThicknessMm: 3,
      });

      const drawerBottom = resolved.module.pieces.find((p) => p.role === 'drawer-bottom')!;
      expect(drawerBottom).toBeDefined();
      // Must take drawer boxes material
      expect(drawerBottom.materialId).toBe(testBoxMat.id);
      // Must take drawer box thickness (15mm)
      expect(drawerBottom.thicknessMm).toBe(15);
    });

    it('defaults to bottom-screwed with backing material and 1mm per side deduction when bottomMount is omitted', () => {
      const def: ModularModuleDefinition = {
        id: 'mod-drawer-default-bottom',
        carcass: {
          width: 600,
          height: 800,
          depth: 500,
          jointPriority: 'lateral-over-bottom',
          roofType: 'solid-panel',
          hasBacking: true,
          backingThicknessMm: 3,
        },
        bays: [
          {
            type: 'drawer-stack',
            drawerTracks: [{ type: 'fractional', valueFr: 1 }],
            frontMount: 'applied',
            slideType: 'telescopic',
            // bottomMount omitted: MUST default to bottom-screwed
          },
        ],
        materials: {
          carcassMaterialId: testCarcassMat.id,
          frontsMaterialId: testFrontMat.id,
          drawerBoxesMaterialId: testBoxMat.id,
          backingsMaterialId: testBackingMat.id,
        },
      };

      const resolved = buildModularModule(def, {
        carcassThicknessMm: 18,
        boxThicknessMm: 15,
        backingThicknessMm: 3,
      });

      const drawerBottom = resolved.module.pieces.find((p) => p.role === 'drawer-bottom')!;
      expect(drawerBottom).toBeDefined();
      // Default material: backing plate
      expect(drawerBottom.materialId).toBe(testBackingMat.id);
      expect(drawerBottom.thicknessMm).toBe(3);

      // Default dimensions: reaches almost to the edge (-2mm total width, -2mm total depth = 1mm per side)
      // Opening width = 600 - 36 = 564. Drawer box width = 564 - 25.4 = 539.
      // Bottom width = 539 - 2 = 537mm (reaches within 1mm of lateral box edges).
      expect(drawerBottom.contour.points[1]!.x).toBe(537);
      // Bay depth = 500 - 18 (groove backing reserve) = 482. Box depth = 482 - 50 = 432. Bottom depth = 432 - 2 = 430mm (reaches within 1mm of front/back edges).
      expect(drawerBottom.contour.points[2]!.y).toBe(430);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Nesting Optimization and Cut Pass Minimization
  // -------------------------------------------------------------------------
  describe('Fix 3: Plate nesting optimization and cut pass reduction', () => {
    const sheet: SheetDefinition = {
      materialId: 'mat-carcass-18',
      lengthMm: 2750,
      widthMm: 1830,
      trimMarginMm: 10,
      sawKerfMm: 4.4,
    };

    it('accounts for saw kerf and maintains required separation between all placed pieces', () => {
      const items: NestingItem[] = [
        { id: '1', pieceId: 'side-l', materialId: 'mat-carcass-18', cutWidthMm: 560, cutHeightMm: 720, canRotate: false },
        { id: '2', pieceId: 'side-r', materialId: 'mat-carcass-18', cutWidthMm: 560, cutHeightMm: 720, canRotate: false },
        { id: '3', pieceId: 'bottom', materialId: 'mat-carcass-18', cutWidthMm: 560, cutHeightMm: 564, canRotate: false },
        { id: '4', pieceId: 'shelf-1', materialId: 'mat-carcass-18', cutWidthMm: 560, cutHeightMm: 500, canRotate: false },
        { id: '5', pieceId: 'shelf-2', materialId: 'mat-carcass-18', cutWidthMm: 560, cutHeightMm: 500, canRotate: false },
      ];

      const result = runGuillotineNesting({ items, sheet, optimizationGoal: 'min-passes' });

      expect(result.unplacedPieces).toHaveLength(0);
      expect(result.sheets.length).toBe(1);

      const placed = result.sheets[0]!.placedPieces;
      for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
          const a = placed[i]!;
          const b = placed[j]!;

          const noHOverlap = a.x + a.width <= b.x || b.x + b.width <= a.x;
          const noVOverlap = a.y + a.height <= b.y || b.y + b.height <= a.y;
          expect(noHOverlap || noVOverlap).toBe(true);

          // If adjacent horizontally, kerf gap must be respected
          if (!noVOverlap && a.x < b.x) {
            expect(b.x - (a.x + a.width)).toBeGreaterThanOrEqual(sheet.sawKerfMm! - 0.001);
          }
          // If adjacent vertically, kerf gap must be respected
          if (!noHOverlap && a.y < b.y) {
            expect(b.y - (a.y + a.height)).toBeGreaterThanOrEqual(sheet.sawKerfMm! - 0.001);
          }
        }
      }
    });

    it('groups common height pieces into strips to minimize cutting passes', () => {
      // 4 pieces with identical height (720mm) and varying widths
      const items: NestingItem[] = [
        { id: '1', pieceId: 'p1', materialId: 'mat-carcass-18', cutWidthMm: 560, cutHeightMm: 720, canRotate: false },
        { id: '2', pieceId: 'p2', materialId: 'mat-carcass-18', cutWidthMm: 560, cutHeightMm: 720, canRotate: false },
        { id: '3', pieceId: 'p3', materialId: 'mat-carcass-18', cutWidthMm: 500, cutHeightMm: 720, canRotate: false },
        { id: '4', pieceId: 'p4', materialId: 'mat-carcass-18', cutWidthMm: 400, cutHeightMm: 720, canRotate: false },
      ];

      const minPassesResult = runGuillotineNesting({
        items,
        sheet,
        optimizationGoal: 'min-passes',
      });

      expect(minPassesResult.unplacedPieces).toHaveLength(0);
      // The 4 pieces should be grouped in the same strip along Y
      const placed = minPassesResult.sheets[0]!.placedPieces;
      const yCoords = new Set(placed.map((p) => p.y));
      // All 4 pieces share the strip start Y
      expect(yCoords.size).toBe(1);
    });

    it('multi-material nesting segregates materials cleanly and applies per-material optimization', () => {
      const items: NestingItem[] = [
        { id: '1', pieceId: 'carcass-side-l', materialId: testCarcassMat.id, cutWidthMm: 560, cutHeightMm: 720, canRotate: false },
        { id: '2', pieceId: 'carcass-side-r', materialId: testCarcassMat.id, cutWidthMm: 560, cutHeightMm: 720, canRotate: false },
        { id: '3', pieceId: 'box-side-l', materialId: testBoxMat.id, cutWidthMm: 450, cutHeightMm: 140, canRotate: false },
        { id: '4', pieceId: 'box-side-r', materialId: testBoxMat.id, cutWidthMm: 450, cutHeightMm: 140, canRotate: false },
        { id: '5', pieceId: 'drawer-bottom', materialId: testBackingMat.id, cutWidthMm: 573, cutHeightMm: 448, canRotate: true },
        { id: '6', pieceId: 'carcass-back', materialId: testBackingMat.id, cutWidthMm: 600, cutHeightMm: 764, canRotate: true },
      ];

      const result = runMultiMaterialGuillotineNesting({
        items,
        defaultSheet: sheet,
      });

      expect(result.unplacedPieces).toHaveLength(0);
      expect(Object.keys(result.resultsByMaterial)).toHaveLength(3);
      expect(result.resultsByMaterial[testCarcassMat.id]).toBeDefined();
      expect(result.resultsByMaterial[testBoxMat.id]).toBeDefined();
      expect(result.resultsByMaterial[testBackingMat.id]).toBeDefined();

      // Drawer bottom is properly nested in the backing board
      const backingSheet = result.resultsByMaterial[testBackingMat.id]!;
      const placedBottom = backingSheet.sheets[0]!.placedPieces.find((p) => p.pieceId === 'drawer-bottom');
      expect(placedBottom).toBeDefined();
    });
  });
});
