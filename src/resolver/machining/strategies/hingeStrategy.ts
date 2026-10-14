import { type DrillOperation } from '../../../model/operation';
import { type IJointMachiningStrategy, type JointMachiningContext } from '../types';
import { deriveFaceType } from '../geometry';
import { type Joint, type JointKind } from '../../../model';

export class HingeJointStrategy implements IJointMachiningStrategy {
  public readonly kind = 'hinge' as const;

  public canHandle(_joint: Joint, effectiveKind: JointKind | string): boolean {
    return effectiveKind === 'hinge';
  }

  public generateOperations(context: JointMachiningContext): DrillOperation[] {
    const { pieceA, pieceB, joint, config, generateOpId } = context;
    const operations: DrillOperation[] = [];

    // Piece A is Door, Piece B is Carcase Side
    const hingeY = joint.offsetMm ?? 100;
    const spacing = config.hingePlateHoleSpacingMm ?? 32.0;
    const halfSpacing = spacing / 2;

    // 1. On Door: cup hole
    operations.push({
      schemaVersion: 1,
      id: generateOpId(),
      pieceId: pieceA.id,
      faceId: joint.a.faceId,
      faceType: deriveFaceType(joint.a.faceId),
      diameterMm: config.hingeCupDiameterMm,
      depthMm: config.hingeCupDepthMm,
      isThrough: false,
      positionMm: { x: config.hingeCupEdgeSetbackMm, y: hingeY },
      origin: 'derived',
      sourceJointKind: 'hinge',
      description: `Concealed hinge cup Ø${config.hingeCupDiameterMm}x${config.hingeCupDepthMm}mm`,
    });

    // 2. On Carcase Side: 2 mounting plate holes in System 32 line
    operations.push(
      {
        schemaVersion: 1,
        id: generateOpId(),
        pieceId: pieceB.id,
        faceId: joint.b.faceId,
        faceType: deriveFaceType(joint.b.faceId),
        diameterMm: config.hingePlateDiameterMm,
        depthMm: config.hingePlateDepthMm,
        isThrough: false,
        positionMm: { x: config.hingePlateSetbackMm, y: hingeY - halfSpacing },
        origin: 'derived',
        sourceJointKind: 'hinge',
        description: `Hinge mounting plate hole 1 Ø${config.hingePlateDiameterMm}x${config.hingePlateDepthMm}mm`,
      },
      {
        schemaVersion: 1,
        id: generateOpId(),
        pieceId: pieceB.id,
        faceId: joint.b.faceId,
        faceType: deriveFaceType(joint.b.faceId),
        diameterMm: config.hingePlateDiameterMm,
        depthMm: config.hingePlateDepthMm,
        isThrough: false,
        positionMm: { x: config.hingePlateSetbackMm, y: hingeY + halfSpacing },
        origin: 'derived',
        sourceJointKind: 'hinge',
        description: `Hinge mounting plate hole 2 Ø${config.hingePlateDiameterMm}x${config.hingePlateDepthMm}mm`,
      },
    );

    return operations;
  }
}
