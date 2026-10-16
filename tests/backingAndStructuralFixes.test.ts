import 'fake-indexeddb/auto';
import React, { useEffect, act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect } from 'vitest';
import {
  buildModularModule,
  deriveModuleGrooveOperations,
  resolveModule,
  type ModularModuleDefinition,
} from '../src/resolver';
import type { Material } from '../src/model';
import { useModuleViewModel } from '../src/ui/useModuleViewModel';

const testCarcassMaterial: Material = {
  schemaVersion: 1,
  id: 'mat-carcass-18',
  name: 'Melamina Blanca 18mm',
  thicknessMm: 18,
  sheetSizeMm: { length: 2750, width: 1830 },
  hasGrain: false,
  milling: { hidden: 'yes', visible: 'no', onStructuralPiece: 'limited' },
};

const testBackingMaterial3mm: Material = {
  schemaVersion: 1,
  id: 'mat-mdf-white-3',
  name: 'Fibrofácil Fondo Blanco 3mm',
  thicknessMm: 3,
  sheetSizeMm: { length: 2750, width: 1830 },
  hasGrain: false,
  milling: { hidden: 'no', visible: 'no', onStructuralPiece: 'no' },
};

const testBackingMaterial6mm: Material = {
  schemaVersion: 1,
  id: 'mat-mdf-white-6',
  name: 'Fibrofácil Fondo Blanco 6mm',
  thicknessMm: 6,
  sheetSizeMm: { length: 2750, width: 1830 },
  hasGrain: false,
  milling: { hidden: 'no', visible: 'no', onStructuralPiece: 'no' },
};

const materials3mm = {
  carcassMaterialId: testCarcassMaterial.id,
  frontsMaterialId: testCarcassMaterial.id,
  drawerBoxesMaterialId: testCarcassMaterial.id,
  backingsMaterialId: testBackingMaterial3mm.id,
};

const materials6mm = {
  carcassMaterialId: testCarcassMaterial.id,
  frontsMaterialId: testCarcassMaterial.id,
  drawerBoxesMaterialId: testCarcassMaterial.id,
  backingsMaterialId: testBackingMaterial6mm.id,
};

function createHookRunner<T>(useHook: () => T) {
  let latestResult: T | undefined;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  function TestComponent() {
    const hookVal = useHook();
    useEffect(() => {
      latestResult = hookVal;
    });
    latestResult = hookVal;
    return null;
  }

  act(() => {
    root.render(React.createElement(TestComponent));
  });

  return {
    get current() {
      return latestResult!;
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('Backing and Structural Enhancements', () => {
  describe('1. Grooved Backing Width and Gap Elimination (No "Luz")', () => {
    it('preserves grooved backing width (interiorWidth + 2 * depth) through resolveModule', () => {
      // Carcass width: 600, height: 800, depth: 500, thickness: 18
      // Interior width = 600 - 36 = 564
      // Backing groove depth = 8 mm
      // Expected backing width = 564 + 2 * 8 = 580 mm
      // Expected backing position.x = 18 - 8 = 10 mm
      const def: ModularModuleDefinition = {
        id: 'mod-groove-test',
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
        bays: [{ type: 'empty' }],
        materials: materials3mm,
      };

      const built = buildModularModule(def);
      const backPieceBefore = built.resolvedPieces.find((p) => p.role === 'back');
      expect(backPieceBefore).toBeDefined();
      expect(backPieceBefore!.dimensionsMm.width).toBe(580);
      expect(backPieceBefore!.positionMm.x).toBe(10);

      // Now pass through resolveModule: verify it does NOT truncate width to 564 or reset pos.x to 18
      const resolved = resolveModule({ module: built.module, placementTree: built.placementTree });
      const backPieceAfter = resolved.pieces.find((p) => p.role === 'back');
      expect(backPieceAfter).toBeDefined();
      expect(backPieceAfter!.dimensionsMm.width).toBe(580);
      expect(backPieceAfter!.positionMm.x).toBe(10);
    });
  });

  describe('2. Automatic Groove Operations Generation (deriveModuleGrooveOperations)', () => {
    it('generates groove operations on carcass sides, bottom and roof with tolerance', () => {
      const def: ModularModuleDefinition = {
        id: 'mod-auto-groove',
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
          backingGrooveToleranceMm: 0.5,
        },
        grid: {
          axis: 'horizontal',
          tracks: [{ type: 'fractional', valueFr: 1 }],
        },
        bays: [{ type: 'empty' }],
        materials: materials3mm,
      };

      const built = buildModularModule(def);
      const ops = deriveModuleGrooveOperations(built.resolvedPieces, built.module.joints, {
        backingThicknessMm: 3,
        backingGrooveToleranceMm: 0.5,
        backingGrooveDepthMm: 8,
        backingGrooveDistanceMm: 15,
      });

      expect(ops.length).toBeGreaterThanOrEqual(4);

      // Left lateral inner face groove
      const sideLeftOp = ops.find((o) => o.pieceId.includes('side-left'));
      expect(sideLeftOp).toBeDefined();
      expect(sideLeftOp!.faceType).toBe('face-A');
      expect(sideLeftOp!.kind).toBe('groove');
      expect(sideLeftOp!.depthMm).toBe(8);
      expect(sideLeftOp!.widthMm).toBe(3.5); // 3 + 0.5

      // Right lateral inner face groove
      const sideRightOp = ops.find((o) => o.pieceId.includes('side-right'));
      expect(sideRightOp).toBeDefined();
      expect(sideRightOp!.faceType).toBe('face-A');

      // Bottom panel groove
      const bottomOp = ops.find((o) => o.pieceId.includes('bottom'));
      expect(bottomOp).toBeDefined();
      expect(bottomOp!.faceType).toBe('face-A');

      // Top panel groove
      const topOp = ops.find((o) => o.pieceId.includes('roof'));
      expect(topOp).toBeDefined();
      expect(topOp!.faceType).toBe('face-A');
    });

    it('adapts groove width when 6mm backing is selected', () => {
      const def: ModularModuleDefinition = {
        id: 'mod-auto-groove-6mm',
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
          backingThicknessMm: 6,
          backingGrooveToleranceMm: 0.5,
        },
        grid: {
          axis: 'horizontal',
          tracks: [{ type: 'fractional', valueFr: 1 }],
        },
        bays: [{ type: 'empty' }],
        materials: materials6mm,
      };

      const built = buildModularModule(def);
      const ops = deriveModuleGrooveOperations(built.resolvedPieces, built.module.joints, {
        backingThicknessMm: 6,
        backingGrooveToleranceMm: 0.5,
        backingGrooveDepthMm: 8,
        backingGrooveDistanceMm: 15,
      });

      const sideLeftOp = ops.find((o) => o.pieceId.includes('side-left'));
      expect(sideLeftOp).toBeDefined();
      expect(sideLeftOp!.widthMm).toBe(6.5); // 6 + 0.5
    });
  });

  describe('3. Multi-Bay Backing (Option A: Separate Backings per Bay)', () => {
    it('creates separate back panels per bay and grooves divider on both face-A and face-B', () => {
      const def: ModularModuleDefinition = {
        id: 'mod-multi-bay',
        carcass: {
          width: 1200,
          height: 800,
          depth: 500,
          jointPriority: 'lateral-over-bottom',
          roofType: 'solid-panel',
          hasBacking: true,
          backingType: 'groove',
          backingGrooveDistanceMm: 15,
          backingGrooveDepthMm: 8,
          backingThicknessMm: 3,
          backingMultiBayMode: 'split-per-bay',
        },
        grid: {
          axis: 'horizontal',
          tracks: [
            { type: 'fractional', valueFr: 1 },
            { type: 'fractional', valueFr: 1 },
          ],
        },
        bays: [{ type: 'empty' }, { type: 'empty' }],
        materials: materials3mm,
      };

      const built = buildModularModule(def);

      // 2 back pieces
      const backPieces = built.resolvedPieces.filter((p) => p.role === 'back');
      expect(backPieces.length).toBe(2);
      expect(backPieces[0]!.id).toBe('mod-multi-bay-bay-1-back');
      expect(backPieces[1]!.id).toBe('mod-multi-bay-bay-2-back');

      // Partition divider piece exists
      const dividerPiece = built.resolvedPieces.find((p) => p.role === 'partition');
      expect(dividerPiece).toBeDefined();

      // Derive groove operations
      const ops = deriveModuleGrooveOperations(built.resolvedPieces, built.module.joints, {
        backingThicknessMm: 3,
        backingGrooveToleranceMm: 0.5,
        backingGrooveDepthMm: 8,
      });

      // Divider should receive grooves on BOTH face-A and face-B
      const dividerOps = ops.filter((o) => o.pieceId === dividerPiece!.id);
      expect(dividerOps.length).toBe(2);

      const faces = dividerOps.map((o) => o.faceType).sort();
      expect(faces).toEqual(['face-A', 'face-B']);
      expect(dividerOps[0]!.kind).toBe('groove');
      expect(dividerOps[1]!.kind).toBe('groove');
    });
  });

  describe('4. Vertical Rail Usable Height & Drawer Stack Safety', () => {
    it('subtracts vertical rail width (80mm) from interior height so top drawers do not hit the rail', () => {
      const defVertical: ModularModuleDefinition = {
        id: 'mod-vertical-rails',
        carcass: {
          width: 600,
          height: 800,
          depth: 500,
          jointPriority: 'lateral-over-bottom',
          roofType: 'front-back-rails',
          railOrientation: 'vertical',
          railWidthMm: 80,
          hasBacking: false,
        },
        grid: {
          axis: 'horizontal',
          tracks: [{ type: 'fractional', valueFr: 1 }],
        },
        bays: [
          {
            type: 'drawer-stack',
            drawerTracks: [
              { type: 'fractional', valueFr: 1 },
              { type: 'fractional', valueFr: 1 },
              { type: 'fractional', valueFr: 1 },
            ],
            frontMount: 'applied',
            slideType: 'telescopic',
          },
        ],
        materials: materials3mm,
      };

      const defHorizontal: ModularModuleDefinition = {
        ...defVertical,
        id: 'mod-horizontal-rails',
        carcass: {
          ...defVertical.carcass,
          railOrientation: 'horizontal',
        },
      };

      const builtVert = buildModularModule(defVertical);
      const builtHoriz = buildModularModule(defHorizontal);

      const vertSides = builtVert.resolvedPieces.filter((p) => p.role === 'drawer-side');
      const horizSides = builtHoriz.resolvedPieces.filter((p) => p.role === 'drawer-side');

      expect(vertSides.length).toBe(6);
      expect(horizSides.length).toBe(6);
      expect(vertSides[0]!.dimensionsMm.height).toBeLessThan(horizSides[0]!.dimensionsMm.height);
    });
  });

  describe('5. Drawer Slide Clearance Override', () => {
    it('respects custom slideClearanceMm on drawer stack', () => {
      const defStandard: ModularModuleDefinition = {
        id: 'mod-standard-slides',
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
            type: 'drawer-stack',
            drawerTracks: [
              { type: 'fractional', valueFr: 1 },
              { type: 'fractional', valueFr: 1 },
            ],
            frontMount: 'applied',
            slideType: 'telescopic',
          },
        ],
        materials: materials3mm,
      };

      const defCustomClearance: ModularModuleDefinition = {
        ...defStandard,
        id: 'mod-custom-slides',
        bays: [
          {
            type: 'drawer-stack',
            drawerTracks: [
              { type: 'fractional', valueFr: 1 },
              { type: 'fractional', valueFr: 1 },
            ],
            frontMount: 'applied',
            slideType: 'telescopic',
            slideClearanceMm: 30.0, // 30mm instead of standard 25.4mm
          },
        ],
      };

      const builtStandard = buildModularModule(defStandard);
      const builtCustom = buildModularModule(defCustomClearance);

      const standardBoxFront = builtStandard.resolvedPieces.find((p) => p.role === 'drawer-box-front');
      const customBoxFront = builtCustom.resolvedPieces.find((p) => p.role === 'drawer-box-front');

      expect(standardBoxFront).toBeDefined();
      expect(customBoxFront).toBeDefined();

      // With 30mm clearance (vs 25.4mm), drawer box front is narrower by 5mm (Math.round(564 - 25.4) = 539, 564 - 30 = 534)
      expect(customBoxFront!.dimensionsMm.width).toBeLessThan(standardBoxFront!.dimensionsMm.width);
      expect(standardBoxFront!.dimensionsMm.width - customBoxFront!.dimensionsMm.width).toBe(5);
    });
  });

  describe('6. ViewModel Structural Span Warnings & Interactive Controls', () => {
    it('emits drawer span warning when drawer bay exceeds maxDrawerSpanMm (900mm)', () => {
      const runner = createHookRunner(() => useModuleViewModel());

      // Set width to 1200mm with single drawer bay
      act(() => {
        runner.current.setBayContentType(0, 'drawer-stack');
        runner.current.setWidth(1200);
      });

      expect(runner.current.structuralSpanWarnings.length).toBeGreaterThan(0);
      const drawerWarning = runner.current.structuralSpanWarnings.find((w) => w.includes('cajonera'));
      expect(drawerWarning).toBeDefined();
      expect(drawerWarning).toContain('900 mm');

      runner.unmount();
    });

    it('emits unreinforced top panel warning when solid roof bay exceeds 900mm', () => {
      const runner = createHookRunner(() => useModuleViewModel());

      act(() => {
        runner.current.setRoofType('solid-panel');
        runner.current.setWidth(1000);
      });

      expect(runner.current.structuralSpanWarnings.length).toBeGreaterThan(0);
      const topWarning = runner.current.structuralSpanWarnings.find((w) => w.includes('luz libre'));
      expect(topWarning).toBeDefined();
      expect(topWarning).toContain('900 mm');

      runner.unmount();
    });

    it('allows configuring drawer slide clearance and backing thickness in ViewModel', () => {
      const runner = createHookRunner(() => useModuleViewModel());

      act(() => {
        runner.current.setBayContentType(0, 'drawer-stack');
      });

      // Default backing thickness is 3mm
      expect(runner.current.backingThicknessMm).toBe(3);

      // Toggle to 6mm
      act(() => {
        runner.current.setBackingThicknessMm(6);
      });
      expect(runner.current.backingThicknessMm).toBe(6);

      // Custom drawer slide clearance
      act(() => {
        runner.current.setDrawerSlideClearance(0, 28);
      });
      const activeBay = runner.current.bays[0];
      if (activeBay?.type === 'drawer-stack') {
        expect(activeBay.slideClearanceMm).toBe(28);
      }

      runner.unmount();
    });
  });
});
