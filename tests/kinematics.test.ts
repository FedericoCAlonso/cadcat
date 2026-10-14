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

  it('rotates hinged door open when openRatio > 0', () => {
    const mechs = identifyKinematicMechanisms(sampleBoxes);
    const doorMech = mechs.find((m) => m.kind === 'door-left')!;

    const result = calculateKinematicBoxes(sampleBoxes, mechs, {
      [doorMech.id]: 1.0, // 100% open
    });

    const doorBox = result.find((b) => b.pieceId === 'bay-1-door-l')!;
    expect(doorBox.kinematicRotationRad.y).toBeLessThan(0); // Rotated around Y
    expect(doorBox.kinematicPositionMm.z).toBeLessThan(0); // Swung forward
  });
});
