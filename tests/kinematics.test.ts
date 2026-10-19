import { describe, it, expect } from 'vitest';
import {
  identifyKinematicMechanisms,
  calculateKinematicBoxes,
  type SpatialPieceBox,
} from '../src/resolver/spatial3d';

describe('Interactive Kinematics (Point 11)', () => {
  const sampleBoxes: SpatialPieceBox[] = [
    {
      pieceId: 'bay-1-drawer-1-front',
      role: 'drawer-front',
      materialId: 'mat-1',
      thicknessMm: 18,
      positionMm: { x: 18, y: 500, z: 0 },
      sizeMm: { x: 564, y: 150, z: 18 },
      centerMm: { x: 300, y: 575, z: 9 },
    },
    {
      pieceId: 'bay-1-drawer-1-box-bottom',
      role: 'drawer-box-bottom',
      materialId: 'mat-1',
      thicknessMm: 15,
      positionMm: { x: 40, y: 510, z: 20 },
      sizeMm: { x: 520, y: 15, z: 450 },
      centerMm: { x: 300, y: 517.5, z: 245 },
    },
    {
      pieceId: 'bay-1-door-l',
      role: 'door',
      materialId: 'mat-1',
      thicknessMm: 18,
      positionMm: { x: 18, y: 100, z: 0 },
      sizeMm: { x: 280, y: 600, z: 18 },
      centerMm: { x: 158, y: 400, z: 9 },
    },
    {
      pieceId: 'carcass-side-left',
      role: 'side-left',
      materialId: 'mat-1',
      thicknessMm: 18,
      positionMm: { x: 0, y: 0, z: 0 },
      sizeMm: { x: 18, y: 800, z: 580 },
      centerMm: { x: 9, y: 400, z: 290 },
    },
  ];

  it('identifies drawer and door mechanisms from piece boxes', () => {
    const mechs = identifyKinematicMechanisms(sampleBoxes);
    expect(mechs).toHaveLength(2);

    const drawerMech = mechs.find((m) => m.kind === 'drawer');
    expect(drawerMech).toBeDefined();
    expect(drawerMech?.pieceIds).toContain('bay-1-drawer-1-front');
    expect(drawerMech?.pieceIds).toContain('bay-1-drawer-1-box-bottom');

    const doorMech = mechs.find((m) => m.kind === 'door-left');
    expect(doorMech).toBeDefined();
    expect(doorMech?.pieceIds).toContain('bay-1-door-l');
  });

  it('slides drawer pieces forward when openRatio > 0', () => {
    const mechs = identifyKinematicMechanisms(sampleBoxes);
    const drawerMech = mechs.find((m) => m.kind === 'drawer')!;

    const result = calculateKinematicBoxes(sampleBoxes, mechs, {
      [drawerMech.id]: 0.5, // 50% open
    });

    const frontBox = result.find((b) => b.pieceId === 'bay-1-drawer-1-front')!;
    const bottomBox = result.find((b) => b.pieceId === 'bay-1-drawer-1-box-bottom')!;
    const sideBox = result.find((b) => b.pieceId === 'carcass-side-left')!;

    // Static piece (side) is not moved
    expect(sideBox.kinematicPositionMm.z).toBe(0);

    // Drawer pieces moved forward along negative Z by 50% of travel (0.5 * 320 = 160mm)
    expect(frontBox.kinematicPositionMm.z).toBe(-160);
    expect(bottomBox.kinematicPositionMm.z).toBe(20 - 160);
  });

  it('rotates hinged door open toward user (-Z) when openRatio > 0', () => {
    const mechs = identifyKinematicMechanisms(sampleBoxes);
    const doorMech = mechs.find((m) => m.kind === 'door-left')!;

    const result = calculateKinematicBoxes(sampleBoxes, mechs, {
      [doorMech.id]: 1.0, // 100% open
    });

    const doorBox = result.find((b) => b.pieceId === 'bay-1-door-l')!;
    expect(doorBox.kinematicRotationRad.y).toBeGreaterThan(0); // Positive angle swings +X toward -Z
    expect(doorBox.kinematicPositionMm.z).toBeLessThan(0); // Swung forward
  });

  it('separates individual drawers into independent mechanisms', () => {
    const multiDrawerBoxes: SpatialPieceBox[] = [
      {
        pieceId: 'modular-bay-0-drawer-front-1',
        role: 'drawer-front',
        materialId: 'mat-1',
        thicknessMm: 18,
        positionMm: { x: 18, y: 500, z: -18 },
        sizeMm: { x: 564, y: 150, z: 18 },
        centerMm: { x: 300, y: 575, z: -9 },
      },
      {
        pieceId: 'modular-bay-0-drawer-box-side-l-1',
        role: 'drawer-side',
        materialId: 'mat-1',
        thicknessMm: 15,
        positionMm: { x: 30, y: 515, z: 10 },
        sizeMm: { x: 15, y: 120, z: 450 },
        centerMm: { x: 37.5, y: 575, z: 235 },
      },
      {
        pieceId: 'modular-bay-0-drawer-front-2',
        role: 'drawer-front',
        materialId: 'mat-1',
        thicknessMm: 18,
        positionMm: { x: 18, y: 300, z: -18 },
        sizeMm: { x: 564, y: 150, z: 18 },
        centerMm: { x: 300, y: 375, z: -9 },
      },
      {
        pieceId: 'modular-bay-0-drawer-box-side-l-2',
        role: 'drawer-side',
        materialId: 'mat-1',
        thicknessMm: 15,
        positionMm: { x: 30, y: 315, z: 10 },
        sizeMm: { x: 15, y: 120, z: 450 },
        centerMm: { x: 37.5, y: 375, z: 235 },
      },
    ];

    const mechs = identifyKinematicMechanisms(multiDrawerBoxes);
    expect(mechs).toHaveLength(2);
    expect(mechs[0]?.name).toBe('Cajón 1');
    expect(mechs[1]?.name).toBe('Cajón 2');
    expect(mechs[0]?.pieceIds).toEqual([
      'modular-bay-0-drawer-front-1',
      'modular-bay-0-drawer-box-side-l-1',
    ]);
    expect(mechs[1]?.pieceIds).toEqual([
      'modular-bay-0-drawer-front-2',
      'modular-bay-0-drawer-box-side-l-2',
    ]);

    // Opening only Drawer 1 moves Drawer 1 pieces, leaving Drawer 2 unmoved
    const result = calculateKinematicBoxes(multiDrawerBoxes, mechs, {
      [mechs[0]!.id]: 1.0, // Open drawer 1 only
    });

    const front1 = result.find((b) => b.pieceId === 'modular-bay-0-drawer-front-1')!;
    const front2 = result.find((b) => b.pieceId === 'modular-bay-0-drawer-front-2')!;

    expect(front1.kinematicPositionMm.z).toBe(-18 - 320); // Moved -320mm
    expect(front2.kinematicPositionMm.z).toBe(-18); // Unmoved
  });

  it('coordinates bi-fold closure leaves in single mechanism', () => {
    const bifoldBoxes: SpatialPieceBox[] = [
      {
        pieceId: 'bay-0-bifold-leaf-1',
        role: 'bifold-leaf',
        materialId: 'mat-1',
        thicknessMm: 18,
        positionMm: { x: 18, y: 400, z: -18 },
        sizeMm: { x: 564, y: 300, z: 18 },
        centerMm: { x: 300, y: 550, z: -9 },
      },
      {
        pieceId: 'bay-0-bifold-leaf-2',
        role: 'bifold-leaf',
        materialId: 'mat-1',
        thicknessMm: 18,
        positionMm: { x: 18, y: 100, z: -18 },
        sizeMm: { x: 564, y: 300, z: 18 },
        centerMm: { x: 300, y: 250, z: -9 },
      },
    ];

    const mechs = identifyKinematicMechanisms(bifoldBoxes);
    expect(mechs).toHaveLength(1);
    expect(mechs[0]?.kind).toBe('bifold');
    expect(mechs[0]?.pieceIds).toHaveLength(2);

    const result = calculateKinematicBoxes(bifoldBoxes, mechs, {
      [mechs[0]!.id]: 0.8,
    });

    const leaf1 = result.find((b) => b.pieceId === 'bay-0-bifold-leaf-1')!;
    const leaf2 = result.find((b) => b.pieceId === 'bay-0-bifold-leaf-2')!;

    // Upper leaf tilts up and outward (+X rotation)
    expect(leaf1.kinematicRotationRad.x).toBeGreaterThan(0);
    // Lower leaf folds backward relative to vertical (-X rotation) creating an articulated fold
    expect(leaf2.kinematicRotationRad.x).toBeLessThan(0);
    // Both leaves are projected outward toward user
    expect(leaf1.kinematicPositionMm.z).toBeLessThan(-18);
    expect(leaf2.kinematicPositionMm.z).toBeLessThan(-18);

    // Verify exact 3D world-space joint connection between the two articulated leaves
    const h1 = leaf1.sizeMm.y;
    const h2 = leaf2.sizeMm.y;
    const t = leaf1.sizeMm.z;

    const center1Y = leaf1.kinematicPositionMm.y + h1 / 2;
    const center1Z = leaf1.kinematicPositionMm.z + t / 2;
    const leaf1BottomEdgeY =
      center1Y - (h1 / 2) * Math.cos(leaf1.kinematicRotationRad.x) - (t / 2) * Math.sin(leaf1.kinematicRotationRad.x);
    const leaf1BottomEdgeZ =
      center1Z - (h1 / 2) * Math.sin(leaf1.kinematicRotationRad.x) + (t / 2) * Math.cos(leaf1.kinematicRotationRad.x);

    const center2Y = leaf2.kinematicPositionMm.y + h2 / 2;
    const center2Z = leaf2.kinematicPositionMm.z + t / 2;
    const leaf2TopEdgeY =
      center2Y + (h2 / 2) * Math.cos(leaf2.kinematicRotationRad.x) - (t / 2) * Math.sin(leaf2.kinematicRotationRad.x);
    const leaf2TopEdgeZ =
      center2Z + (h2 / 2) * Math.sin(leaf2.kinematicRotationRad.x) + (t / 2) * Math.cos(leaf2.kinematicRotationRad.x);

    // In 3D space, the bottom edge of leaf 1 and the top edge of leaf 2 stay connected at the hinge
    expect(Math.abs(leaf1BottomEdgeY - leaf2TopEdgeY)).toBeLessThan(1);
    expect(Math.abs(leaf1BottomEdgeZ - leaf2TopEdgeZ)).toBeLessThan(1);
  });

  it('coordinates horizontal book-fold bifold closure leaves', () => {
    const horizontalBifoldBoxes: SpatialPieceBox[] = [
      {
        pieceId: 'bay-0-bifold-leaf-1',
        role: 'bifold-leaf',
        materialId: 'mat-1',
        thicknessMm: 18,
        positionMm: { x: 18, y: 100, z: -18 },
        sizeMm: { x: 280, y: 600, z: 18 },
        centerMm: { x: 158, y: 400, z: -9 },
      },
      {
        pieceId: 'bay-0-bifold-leaf-2',
        role: 'bifold-leaf',
        materialId: 'mat-1',
        thicknessMm: 18,
        positionMm: { x: 300, y: 100, z: -18 },
        sizeMm: { x: 280, y: 600, z: 18 },
        centerMm: { x: 440, y: 400, z: -9 },
      },
    ];

    const mechs = identifyKinematicMechanisms(horizontalBifoldBoxes);
    expect(mechs).toHaveLength(1);
    expect(mechs[0]?.kind).toBe('bifold');

    const result = calculateKinematicBoxes(horizontalBifoldBoxes, mechs, {
      [mechs[0]!.id]: 0.8,
    });

    const leaf1 = result.find((b) => b.pieceId === 'bay-0-bifold-leaf-1')!;
    const leaf2 = result.find((b) => b.pieceId === 'bay-0-bifold-leaf-2')!;

    // Left leaf swings open (+Y rotation)
    expect(leaf1.kinematicRotationRad.y).toBeGreaterThan(0);
    // Right leaf folds back (-Y rotation)
    expect(leaf2.kinematicRotationRad.y).toBeLessThan(0);
    // Both leaves are projected outward toward user
    expect(leaf1.kinematicPositionMm.z).toBeLessThan(-18);
    expect(leaf2.kinematicPositionMm.z).toBeLessThan(-18);
  });
});
