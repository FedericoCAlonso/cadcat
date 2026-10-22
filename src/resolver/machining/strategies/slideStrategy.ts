import { type DrillOperation } from '../../../model/operation';
import { type IJointMachiningStrategy, type JointMachiningContext } from '../types';
import { deriveFaceType } from '../geometry';
import { type Joint, type JointKind } from '../../../model';
import { type Position3D } from '../../tree';

export class SlideJointStrategy implements IJointMachiningStrategy {
  public readonly kind = 'slide' as const;

  public canHandle(_joint: Joint, effectiveKind: JointKind | string): boolean {
    return effectiveKind === 'slide';
  }

  public generateOperations(context: JointMachiningContext): DrillOperation[] {
    const { pieceB, joint, config, generateOpId } = context;
    const operations: DrillOperation[] = [];

    // Piece A is Drawer Box Side, Piece B is Carcase Side / Partition
    const rawSlideY = joint.offsetMm ?? 60;
    const posB = 'positionMm' in pieceB && pieceB.positionMm ? (pieceB.positionMm as Position3D) : undefined;
    const slideY = posB && typeof posB.y === 'number' && posB.y > 0 ? rawSlideY - posB.y : rawSlideY;
    const diameter = config.slideHoleDiameterMm ?? 5.0;
    const depth = config.slideHoleDepthMm ?? 12.0;
    const pitch = config.slideHolePitchMm ?? 192.0;
    const setback = config.system32FrontSetbackMm ?? 37.0;

    // On Carcase Side: slide rail mounting holes (at 37mm and 37 + pitch from front)
    operations.push(
      {
        schemaVersion: 1,
        id: generateOpId(),
        pieceId: pieceB.id,
        faceId: joint.b.faceId,
        faceType: deriveFaceType(joint.b.faceId),
        diameterMm: diameter,
        depthMm: depth,
        isThrough: false,
        positionMm: { x: setback, y: slideY },
        origin: 'derived',
        sourceJointKind: 'slide',
        description: `Drawer slide front mounting hole Ø${diameter}x${depth}mm`,
      },
      {
        schemaVersion: 1,
        id: generateOpId(),
        pieceId: pieceB.id,
        faceId: joint.b.faceId,
        faceType: deriveFaceType(joint.b.faceId),
        diameterMm: diameter,
        depthMm: depth,
        isThrough: false,
        positionMm: { x: setback + pitch, y: slideY },
        origin: 'derived',
        sourceJointKind: 'slide',
        description: `Drawer slide rear mounting hole Ø${diameter}x${depth}mm`,
      },
    );

    return operations;
  }
}
