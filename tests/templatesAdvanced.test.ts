import { describe, it, expect } from 'vitest';
import {
  calculateHingeCount,
  calculateHingePositions,
  buildDoorSubAssembly,
  buildDrawerSubAssembly,
  DRAWER_SLIDE_CLEARANCES_MM,
  buildShelf,
  buildPartition,
  buildDoorCabinet,
  buildPartitionCabinet,
  generateBillOfMaterials,
} from '../src/resolver';
import type { Material, EdgeBand } from '../src/model';

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

describe('Advanced Templates - Door & Hinges', () => {
  it('calculates correct hinge count according to door height', () => {
    expect(calculateHingeCount(700)).toBe(2);
    expect(calculateHingeCount(899)).toBe(2);
    expect(calculateHingeCount(900)).toBe(3);
    expect(calculateHingeCount(1400)).toBe(3);
    expect(calculateHingeCount(1600)).toBe(4);
    expect(calculateHingeCount(2200)).toBe(5);
  });

  it('calculates hinge positions with 100mm end setbacks', () => {
    const pos2 = calculateHingePositions(800, 2, 100);
    expect(pos2).toEqual([100, 700]);

    const pos3 = calculateHingePositions(1200, 3, 100);
    expect(pos3).toEqual([100, 600, 1100]);
  });

  it('builds overlay and inset door subassemblies with hinge joints', () => {
    // Overlay door
    const overlayRes = buildDoorSubAssembly(
      {
        id: 'door-test-overlay',
        side: 'left',
        mountType: 'overlay',
        openingWidthMm: 564,
        openingHeightMm: 764,
        carcaseThicknessMm: 18,
        materialId: testMaterial.id,
        edgeBandId: testEdgeBand.id,
      },
      'side-left',
    );

    // Overlay width = 564 + 2*18 - 2*1.5 = 597 mm
    expect(overlayRes.doorPiece.contour.points[1]!.x).toBe(597);
    expect(overlayRes.hingeCount).toBe(2);
    expect(overlayRes.joints).toHaveLength(2);
    expect(overlayRes.joints[0]!.kind).toBe('hinge');

    // Inset door
    const insetRes = buildDoorSubAssembly(
      {
        id: 'door-test-inset',
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

    // Inset width = 564 - 4 = 560 mm
    expect(insetRes.doorPiece.contour.points[1]!.x).toBe(560);
    expect(insetRes.doorPiece.contour.points[2]!.y).toBe(760);
  });
});

describe('Advanced Templates - Drawer & Slide Types', () => {
  it('respects clearances for telescopic, undermount, and roller slides', () => {
    expect(DRAWER_SLIDE_CLEARANCES_MM.telescopic).toBe(25.4);
    expect(DRAWER_SLIDE_CLEARANCES_MM.undermount).toBe(10.0);
    expect(DRAWER_SLIDE_CLEARANCES_MM.roller).toBe(25.0);

    const telescopic = buildDrawerSubAssembly(
      {
        idPrefix: 'test-drawer',
        index: 1,
        openingWidthMm: 500,
        depthMm: 550,
        frontHeightMm: 200,
        boxHeightMm: 140,
        baseYMm: 18,
        carcaseThicknessMm: 18,
        materialId: testMaterial.id,
        slideType: 'telescopic',
      },
      'side-left',
    );

    const undermount = buildDrawerSubAssembly(
      {
        idPrefix: 'test-drawer',
        index: 2,
        openingWidthMm: 500,
        depthMm: 550,
        frontHeightMm: 200,
        boxHeightMm: 140,
        baseYMm: 18,
        carcaseThicknessMm: 18,
        materialId: testMaterial.id,
        slideType: 'undermount',
      },
      'side-left',
    );

    // Box width: 500 - 25.4 = 475 mm for telescopic vs 500 - 10 = 490 mm for undermount
    const boxSideLTelescopic = telescopic.pieces.find((p) => p.role === 'drawer-box-front')!;
    const boxSideLUndermount = undermount.pieces.find((p) => p.role === 'drawer-box-front')!;

    expect(boxSideLUndermount.contour.points[1]!.x).toBeGreaterThan(
      boxSideLTelescopic.contour.points[1]!.x,
    );

    // Verify slide hardware joint exists
    const slideJoint = telescopic.joints.find((j) => j.kind === 'slide');
    expect(slideJoint).toBeDefined();
  });
});

describe('Advanced Templates - Shelf & Partition', () => {
  it('builds fixed and adjustable shelves with corresponding joints', () => {
    const fixed = buildShelf(
      {
        id: 'shelf-fixed',
        openingWidthMm: 564,
        depthMm: 540,
        elevationYMm: 400,
        carcaseThicknessMm: 18,
        materialId: testMaterial.id,
        mountType: 'fixed',
      },
      'side-left',
    );

    expect(fixed.piece.structural).toBe(true);
    expect(fixed.joints[0]!.kind).toBe('confirmat');
    expect(fixed.spanMm).toBe(564);

    const adjustable = buildShelf(
      {
        id: 'shelf-adj',
        openingWidthMm: 564,
        depthMm: 540,
        elevationYMm: 400,
        carcaseThicknessMm: 18,
        materialId: testMaterial.id,
        mountType: 'adjustable',
        lateralGapMm: 2.0,
      },
      'side-left',
    );

    expect(adjustable.piece.structural).toBe(false);
    expect(adjustable.joints[0]!.kind).toBe('shelf-pin');
    expect(adjustable.spanMm).toBe(562);
  });

  it('builds vertical partition dividing cabinet into bays', () => {
    const partition = buildPartition(
      {
        id: 'part-center',
        openingWidthMm: 864,
        openingHeightMm: 764,
        depthMm: 540,
        carcaseThicknessMm: 18,
        materialId: testMaterial.id,
        ratio: 0.5,
        bottomPieceId: 'bottom',
      },
      'side-left',
    );

    expect(partition.piece.role).toBe('partition');
    expect(partition.piece.contour.points[1]!.x).toBe(540); // depth
    expect(partition.piece.contour.points[2]!.y).toBe(764); // height
    expect(partition.leftBayWidthMm).toBe(423); // (864 - 18) / 2
    expect(partition.rightBayWidthMm).toBe(423);
  });
});

describe('Integrated Templates - Door Cabinet & Partition Cabinet', () => {
  it('builds single-door cabinet (width <= 600) and double-door cabinet (width > 600)', () => {
    const single = buildDoorCabinet(
      { width: 500, height: 800, depth: 560 },
      testMaterial,
      [testEdgeBand],
    );

    const singleDoors = single.resolvedPieces.filter((p) => p.role.startsWith('door-'));
    expect(singleDoors).toHaveLength(1);

    const double = buildDoorCabinet(
      { width: 900, height: 800, depth: 560 },
      testMaterial,
      [testEdgeBand],
    );

    const doubleDoors = double.resolvedPieces.filter((p) => p.role.startsWith('door-'));
    expect(doubleDoors).toHaveLength(2);

    // Bill of Materials calculates hinges in hardware
    const bom = generateBillOfMaterials(
      {
        moduleId: double.module.id,
        parameters: double.module.parameters,
        pieces: double.resolvedPieces,
        joints: double.module.joints,
        placementTree: double.placementTree,
        jointGraph: undefined as any,
      },
      [testEdgeBand],
    );

    const hingeHw = bom.hardware.find((h) => h.jointKind === 'hinge');
    expect(hingeHw).toBeDefined();
    expect(hingeHw!.count).toBeGreaterThanOrEqual(4); // 2 hinges per door
  });

  it('builds 2-bay partition cabinet with shelves on left and drawers on right', () => {
    const built = buildPartitionCabinet(
      { width: 1000, height: 850, depth: 560 },
      testMaterial,
      [testEdgeBand],
    );

    const partition = built.resolvedPieces.find((p) => p.role === 'partition');
    expect(partition).toBeDefined();

    const shelves = built.resolvedPieces.filter((p) => p.role === 'shelf');
    expect(shelves).toHaveLength(2);

    const drawerFronts = built.resolvedPieces.filter((p) => p.role === 'drawer-front');
    expect(drawerFronts).toHaveLength(3);
  });
});

describe('Drawer Customizations: Simple Interior, Bottom Mounts, and Flush Alignment', () => {
  it('constructs standard drawer with flush box front (boxFrontOffsetMm = 0)', () => {
    const res = buildDrawerSubAssembly(
      {
        idPrefix: 'test-std',
        index: 1,
        openingWidthMm: 500,
        depthMm: 550,
        frontHeightMm: 200,
        boxHeightMm: 150,
        baseYMm: 18,
        carcaseThicknessMm: 18,
        materialId: testMaterial.id,
        slideType: 'telescopic',
        frontMount: 'applied',
        boxFrontOffsetMm: 0,
      },
      'side-left',
    );

    // Standard drawer has 6 pieces (front + 2 sides + box front + box back + bottom)
    expect(res.pieces).toHaveLength(6);
    expect(res.pieces.some((p) => p.role === 'drawer-front')).toBe(true);
    expect(res.pieces.some((p) => p.role === 'drawer-box-front')).toBe(true);

    const frontNode = res.placementNodes.find((n) => n.pieceId === 'test-std-front-1')!;
    const boxFrontNode = res.placementNodes.find((n) => n.pieceId === 'test-std-box-front-1')!;
    // Front is at Z = -18 (applied), Box front is at Z = 0 -> in flush direct contact
    expect(frontNode.relativeOffset.z).toBe(-18);
    expect(boxFrontNode.relativeOffset.z).toBe(0);
  });

  it('constructs simple-interior drawer (single front, no decorative outer front)', () => {
    const res = buildDrawerSubAssembly(
      {
        idPrefix: 'test-simple',
        index: 1,
        openingWidthMm: 500,
        depthMm: 550,
        frontHeightMm: 200,
        boxHeightMm: 150,
        baseYMm: 18,
        carcaseThicknessMm: 18,
        materialId: testMaterial.id,
        slideType: 'telescopic',
        drawerType: 'simple-interior',
        topPullGapMm: 30,
        boxSideHeightOffsetMm: 25,
      },
      'side-left',
    );

    // Exactly 5 pieces: single front, 2 sides, back, bottom (no separate box front)
    expect(res.pieces).toHaveLength(5);
    expect(res.pieces.some((p) => p.role === 'drawer-front')).toBe(true);
    expect(res.pieces.some((p) => p.role === 'drawer-box-front')).toBe(false);

    // Front height reduced by top pull gap (200 - 2*2 - 30 = 166)
    const frontPiece = res.pieces.find((p) => p.role === 'drawer-front')!;
    expect(frontPiece.contour.points[2]!.y).toBe(166);

    // Sides and back height lower than box height (150 - 25 = 125)
    const sidePiece = res.pieces.find((p) => p.role === 'drawer-side')!;
    expect(sidePiece.contour.points[2]!.y).toBe(125);
  });

  it('calculates bottom dimensions for grooved, bottom-screwed, and flush-thick bottom mounts', () => {
    // 1. Grooved (for 3-6mm bottoms)
    const grooved = buildDrawerSubAssembly(
      {
        idPrefix: 'test-groove',
        index: 1,
        openingWidthMm: 500,
        depthMm: 550,
        frontHeightMm: 200,
        boxHeightMm: 150,
        baseYMm: 18,
        carcaseThicknessMm: 18,
        materialId: testMaterial.id,
        slideType: 'telescopic',
        bottomMount: 'grooved',
        grooveDepthMm: 7,
      },
      'side-left',
    );
    const groovedBottom = grooved.pieces.find((p) => p.role === 'drawer-bottom')!;
    // Box width: 500 - 25.4 = 475. Inner span: 475 - 36 = 439. Grooved width (with 1mm insertion tolerance): 439 + 2*7 - 1 = 452.
    expect(groovedBottom.contour.points[1]!.x).toBe(452);

    // 2. Bottom-screwed (applies safety deduction: default 2mm width, 2mm depth)
    const screwed = buildDrawerSubAssembly(
      {
        idPrefix: 'test-screw',
        index: 1,
        openingWidthMm: 500,
        depthMm: 550,
        frontHeightMm: 200,
        boxHeightMm: 150,
        baseYMm: 18,
        carcaseThicknessMm: 18,
        materialId: testMaterial.id,
        backingMaterialId: 'mat-mdf-white-3',
        backingThicknessMm: 3,
        slideType: 'telescopic',
        bottomMount: 'bottom-screwed',
      },
      'side-left',
    );
    const screwedBottom = screwed.pieces.find((p) => p.role === 'drawer-bottom')!;
    expect(screwedBottom.contour.points[1]!.x).toBe(473); // 475 - 2mm
    expect(screwedBottom.contour.points[2]!.y).toBe(498); // 500 - 2mm
    expect(screwedBottom.materialId).toBe('mat-mdf-white-3');
    expect(screwedBottom.thicknessMm).toBe(3);

    // 2b. Bottom-screwed with custom deductions
    const customScrewed = buildDrawerSubAssembly(
      {
        idPrefix: 'test-screw-custom',
        index: 1,
        openingWidthMm: 500,
        depthMm: 550,
        frontHeightMm: 200,
        boxHeightMm: 150,
        baseYMm: 18,
        carcaseThicknessMm: 18,
        materialId: testMaterial.id,
        slideType: 'telescopic',
        bottomMount: 'bottom-screwed',
        bottomScrewedDeductionWidthMm: 4,
        bottomScrewedDeductionDepthMm: 4,
      },
      'side-left',
    );
    const customScrewedBottom = customScrewed.pieces.find((p) => p.role === 'drawer-bottom')!;
    expect(customScrewedBottom.contour.points[1]!.x).toBe(471); // 475 - 4mm
    expect(customScrewedBottom.contour.points[2]!.y).toBe(496); // 500 - 4mm

    // 3. Flush-thick (uses drawer box material and fits inside box sides)
    const thick = buildDrawerSubAssembly(
      {
        idPrefix: 'test-thick',
        index: 1,
        openingWidthMm: 500,
        depthMm: 550,
        frontHeightMm: 200,
        boxHeightMm: 150,
        baseYMm: 18,
        carcaseThicknessMm: 18,
        materialId: testMaterial.id,
        boxMaterialId: 'mat-box-15',
        boxThicknessMm: 15,
        slideType: 'telescopic',
        bottomMount: 'flush-thick',
      },
      'side-left',
    );
    const thickBottom = thick.pieces.find((p) => p.role === 'drawer-bottom')!;
    expect(thickBottom.contour.points[1]!.x).toBe(445); // 475 - 2*15
    expect(thickBottom.materialId).toBe('mat-box-15');
    expect(thickBottom.thicknessMm).toBe(15);
  });
});

