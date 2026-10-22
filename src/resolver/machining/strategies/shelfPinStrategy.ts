import { type DrillOperation } from '../../../model/operation';
import { type IJointMachiningStrategy, type JointMachiningContext } from '../types';
import { deriveFaceType } from '../geometry';
import { type Joint, type JointKind } from '../../../model';
import { type Position3D } from '../../tree';

export class ShelfPinJointStrategy implements IJointMachiningStrategy {
  public readonly kind = 'shelf-pin' as const;

  public canHandle(_joint: Joint, effectiveKind: JointKind | string): boolean {
    return effectiveKind === 'shelf-pin';
  }

  public generateOperations(context: JointMachiningContext): DrillOperation[] {
    const { pieceA, joint, config, generateOpId } = context;
    const operations: DrillOperation[] = [];

    // Piece A is Side/Partition, Piece B is Shelf
    const rawShelfY = joint.offsetMm ?? 400;
    const posA = 'positionMm' in pieceA && pieceA.positionMm ? (pieceA.positionMm as Position3D) : undefined;
    const shelfY = posA && typeof posA.y === 'number' && posA.y > 0 ? rawShelfY - posA.y : rawShelfY;
    const aPoints = pieceA.contour.points;
    const depthMm = Math.abs(aPoints[1]?.x ?? 560);

    // 2 holes on the side for supporting this shelf side
    operations.push(
      {
        schemaVersion: 1,
        id: generateOpId(),
        pieceId: pieceA.id,
        faceId: joint.a.faceId,
        faceType: deriveFaceType(joint.a.faceId),
        diameterMm: config.shelfPinDiameterMm,
        depthMm: config.shelfPinDepthMm,
        isThrough: false,
        positionMm: { x: config.system32FrontSetbackMm, y: shelfY },
        origin: 'derived',
        sourceJointKind: 'shelf-pin',
        description: `Front shelf support pin Ø${config.shelfPinDiameterMm}x${config.shelfPinDepthMm}mm`,
      },
      {
        schemaVersion: 1,
        id: generateOpId(),
        pieceId: pieceA.id,
        faceId: joint.a.faceId,
        faceType: deriveFaceType(joint.a.faceId),
        diameterMm: config.shelfPinDiameterMm,
        depthMm: config.shelfPinDepthMm,
        isThrough: false,
        positionMm: { x: depthMm - config.system32FrontSetbackMm, y: shelfY },
        origin: 'derived',
        sourceJointKind: 'shelf-pin',
        description: `Rear shelf support pin Ø${config.shelfPinDiameterMm}x${config.shelfPinDepthMm}mm`,
      },
    );

    return operations;
  }
}
