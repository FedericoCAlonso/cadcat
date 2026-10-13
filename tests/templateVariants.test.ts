import { describe, it, expect } from 'vitest';
import {
  buildDrawerSubAssembly,
  buildDrawerUnit,
  DRAWER_SLIDE_CLEARANCES_MM,
  buildDoorSubAssembly,
  buildDoorCabinet,
} from '../src/resolver';
import { getDefaultProjectConfig } from '../src/storage';
import type { Material, EdgeBand, ProjectConfig } from '../src/model';

const testMaterial: Material = {
  schemaVersion: 1,
  id: 'mat-test-18',
  name: 'Melamine White 18mm',
  thicknessMm: 18,
  sheetSizeMm: { length: 2750, width: 1830 },
  hasGrain: false,
  milling: { hidden: 'yes', visible: 'no', onStructuralPiece: 'limited' },
};

const testEdgeBand: EdgeBand = {
  schemaVersion: 1,
  id: 'eb-test-08',
  kind: 'adhesive',
  thicknessMm: 0.8,
  pricePerMeter: 'TO_CONFIRM',
};

describe('Work Package 3: Template Variants for Drawers and Doors', () => {
  describe('5.1 Drawer Variants: frontMount and slideType', () => {
    it('supports metal-box slide type with 31.0 mm clearance', () => {
      expect(DRAWER_SLIDE_CLEARANCES_MM['metal-box']).toBe(31.0);

      const sub = buildDrawerSubAssembly(
        {
          idPrefix: 'mb-test',
          index: 1,
          openingWidthMm: 500,
          depthMm: 550,
          frontHeightMm: 200,
          boxHeightMm: 140,
          baseYMm: 18,
          carcaseThicknessMm: 18,
          materialId: testMaterial.id,
          slideType: 'metal-box',
        },
        'side-left',
      );

      expect(sub.slideClearanceMm).toBe(31.0);
      // Box width: 500 - 31 = 469 mm
      expect(sub.subAssembly.parameters.width).toBe(469);
    });

    it('positions and sizes drawer fronts correctly for applied vs inset mounts', () => {
      const applied = buildDrawerSubAssembly(
        {
          idPrefix: 'applied-drawer',
          index: 1,
          openingWidthMm: 500,
          depthMm: 550,
          frontHeightMm: 200,
          boxHeightMm: 140,
          baseYMm: 20,
          carcaseThicknessMm: 18,
          materialId: testMaterial.id,
          slideType: 'telescopic',
          frontMount: 'applied',
          gapMm: 2.0,
          boxFrontOffsetMm: 10,
        },
        'side-left',
      );

      const inset = buildDrawerSubAssembly(
        {
          idPrefix: 'inset-drawer',
          index: 1,
          openingWidthMm: 500,
          depthMm: 550,
          frontHeightMm: 200,
          boxHeightMm: 140,
          baseYMm: 20,
          carcaseThicknessMm: 18,
          materialId: testMaterial.id,
          slideType: 'telescopic',
          frontMount: 'inset',
          gapMm: 2.0,
          boxFrontOffsetMm: 10,
        },
        'side-left',
      );

      const appliedFront = applied.pieces.find((p) => p.role === 'drawer-front')!;
      const insetFront = inset.pieces.find((p) => p.role === 'drawer-front')!;

      // Applied front covers carcase opening + 2*T - 2*gap = 500 + 36 - 4 = 532 mm
      expect(appliedFront.contour.points[1]!.x).toBe(532);
      const appliedFrontNode = applied.placementNodes.find((n) => n.pieceId === appliedFront.id)!;
      expect(appliedFrontNode.relativeOffset.z).toBe(-18);

      // Inset front fits inside opening: 500 - 2*2 = 496 mm
      expect(insetFront.contour.points[1]!.x).toBe(496);
      const insetFrontNode = inset.placementNodes.find((n) => n.pieceId === insetFront.id)!;
      expect(insetFrontNode.relativeOffset.z).toBe(0);
      expect(insetFrontNode.relativeOffset.x).toBe(18 + 2.0);

      // Inset box side must be recessed behind the inset front: z = T + boxFrontOffset = 18 + 10 = 28 mm
      const insetBoxSideLNode = inset.placementNodes.find(
        (n) => n.pieceId === `inset-drawer-box-side-l-1`,
      )!;
      expect(insetBoxSideLNode.relativeOffset.z).toBe(28);

      // Applied box side is at z = boxFrontOffset = 10 mm
      const appliedBoxSideLNode = applied.placementNodes.find(
        (n) => n.pieceId === `applied-drawer-box-side-l-1`,
      )!;
      expect(appliedBoxSideLNode.relativeOffset.z).toBe(10);
    });

    it('computes drawer unit clearances and offsets dynamically from ProjectConfig', () => {
      const config: ProjectConfig = getDefaultProjectConfig();
      config.hardware = {
        ...config.hardware,
        slideClearanceTelescopicMm: 26.0,
        drawerFrontGapMm: 4.0,
        drawerBoxFrontOffsetMm: 15.0,
        drawerBoxBottomClearanceMm: 20.0,
      };

      const unit = buildDrawerUnit(
        {
          width: 600,
          height: 800,
          depth: 560,
          drawerCount: 2,
          slideType: 'telescopic',
          frontMount: 'inset',
        },
        testMaterial,
        [testEdgeBand],
        testEdgeBand.id,
        config,
      );

      // innerWidth = 600 - 36 = 564 mm
      // Inset front width = 564 - 2*4 = 556 mm
      const front1 = unit.resolvedPieces.find((p) => p.id === 'drawer-front-1')!;
      expect(front1.contour.points[1]!.x).toBe(556);

      // Box node Z for inset with boxFrontOffsetMm: 15 = 18 + 15 = 33 mm
      const boxNode = unit.placementTree.getNode('drawer-box-side-l-1')!;
      expect(boxNode.relativeOffset.z).toBe(33);

      // Box node Y offset uses drawerBoxBottomClearanceMm: 20
      const expectedY = 18 + 4 + 20; // T + gap + bottomClearance
      expect(boxNode.relativeOffset.y).toBe(expectedY);
    });
  });

  describe('5.2 Door Variants: mountType and ProjectConfig Integration', () => {
    it('supports full-overlay, half-overlay, and inset door subassembly mount types', () => {
      const fullOverlay = buildDoorSubAssembly(
        {
          id: 'door-full',
          side: 'left',
          mountType: 'full-overlay',
          openingWidthMm: 564,
          openingHeightMm: 764,
          carcaseThicknessMm: 18,
          materialId: testMaterial.id,
          revealMm: 1.5,
        },
        'side-left',
      );

      const halfOverlay = buildDoorSubAssembly(
        {
          id: 'door-half',
          side: 'left',
          mountType: 'half-overlay',
          openingWidthMm: 564,
          openingHeightMm: 764,
          carcaseThicknessMm: 18,
          materialId: testMaterial.id,
          revealMm: 1.5,
        },
        'side-left',
      );

      const inset = buildDoorSubAssembly(
        {
          id: 'door-inset',
          side: 'left',
          mountType: 'inset',
          openingWidthMm: 564,
          openingHeightMm: 764,
          carcaseThicknessMm: 18,
          materialId: testMaterial.id,
          gapMm: 2.0,
        },
        'side-left',
      );

      // Full overlay: 564 + 2*18 - 2*1.5 = 597 mm
      expect(fullOverlay.doorPiece.contour.points[1]!.x).toBe(597);
      expect(fullOverlay.placementNode.relativeOffset.x).toBe(1.5);
      expect(fullOverlay.placementNode.relativeOffset.z).toBe(-18);

      // Half overlay: 564 + 18 - 2*1.5 = 579 mm
      expect(halfOverlay.doorPiece.contour.points[1]!.x).toBe(579);
      expect(halfOverlay.placementNode.relativeOffset.x).toBe(18 / 2 + 1.5);
      expect(halfOverlay.placementNode.relativeOffset.z).toBe(-18);

      // Inset: 564 - 2*2 = 560 mm
      expect(inset.doorPiece.contour.points[1]!.x).toBe(560);
      expect(inset.placementNode.relativeOffset.x).toBe(18 + 2.0);
      expect(inset.placementNode.relativeOffset.z).toBe(0);
    });

    it('computes door edge gaps and hinge setback from ProjectConfig in buildDoorCabinet', () => {
      const config: ProjectConfig = getDefaultProjectConfig();
      config.hardware = {
        ...config.hardware,
        doorOverlayRevealMm: 2.5,
        doorHalfOverlayRevealMm: 2.0,
        doorInsetGapMm: 3.0,
        doorHingeMarginMm: 120.0,
      };

      // 1. Single Door Cabinet with Inset Mount
      const insetCabinet = buildDoorCabinet(
        {
          width: 500,
          height: 800,
          depth: 560,
          doorMountType: 'inset',
        },
        testMaterial,
        [testEdgeBand],
        testEdgeBand.id,
        config,
      );

      const insetDoor = insetCabinet.resolvedPieces.find((p) => p.role.startsWith('door-'))!;
      // innerWidth = 500 - 36 = 464 mm; Inset door width = 464 - 2*3.0 = 458 mm
      expect(insetDoor.contour.points[1]!.x).toBe(458);

      // Hinge position respects doorHingeMarginMm: 120
      const hingeJoints = insetCabinet.module.joints.filter((j) => j.kind === 'hinge');
      expect(hingeJoints[0]!.offsetMm).toBe(120);

      // 2. Double Door Cabinet with Half-Overlay Mount
      const halfOverlayCabinet = buildDoorCabinet(
        {
          width: 900,
          height: 800,
          depth: 560,
          doorMountType: 'half-overlay',
        },
        testMaterial,
        [testEdgeBand],
        testEdgeBand.id,
        config,
      );

      const halfDoors = halfOverlayCabinet.resolvedPieces.filter((p) => p.role.startsWith('door-'));
      expect(halfDoors).toHaveLength(2);

      const rightDoorNode = halfOverlayCabinet.placementTree.getNode('door-right')!;
      // Right door is positioned using half overlay offset
      expect(rightDoorNode.relativeOffset.z).toBe(-18);
    });
  });
});
