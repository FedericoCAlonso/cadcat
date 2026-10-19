import { type DrillOperation } from '../../../model/operation';
import { type IJointMachiningStrategy, type JointMachiningContext } from '../types';
import {
  deriveContactGeometry,
  calculateDrillSpacingsFromConfig,
  deriveFaceType,
  derivePieceBJointPositions,
} from '../geometry';
import { type Joint, type JointKind } from '../../../model';

export class ConfirmatJointStrategy implements IJointMachiningStrategy {
  public readonly kind = 'confirmat' as const;

  public canHandle(_joint: Joint, effectiveKind: JointKind | string): boolean {
    return effectiveKind === 'confirmat';
  }

  public generateOperations(context: JointMachiningContext): DrillOperation[] {
    const { pieceA, pieceB, joint, config, generateOpId } = context;
    const geom = deriveContactGeometry(pieceA, pieceB, joint);
    const { yContact, zStart, contactLen } = geom;
    const offsets = calculateDrillSpacingsFromConfig(contactLen, config);
    const operations: DrillOperation[] = [];

    for (const off of offsets) {
      const posA = geom.getPieceAPosition ? geom.getPieceAPosition(off) : { x: zStart + off, y: yContact };
      const posBGeom = derivePieceBJointPositions(pieceB, joint.b.faceId, off);

      // Operation on Piece A (Face through hole)
      operations.push({
        schemaVersion: 1,
        id: generateOpId(),
        pieceId: pieceA.id,
        faceId: joint.a.faceId,
        faceType: deriveFaceType(joint.a.faceId),
        diameterMm: config.confirmatThroughDiameterMm,
        depthMm: pieceA.thicknessMm,
        isThrough: true,
        positionMm: posA,
        origin: 'derived',
        sourceJointKind: 'confirmat',
        description: `Confirmat through hole Ø${config.confirmatThroughDiameterMm}mm for ${pieceB.id}`,
      });

      // Operation on Piece B (Edge blind pilot hole)
      operations.push({
        schemaVersion: 1,
        id: generateOpId(),
        pieceId: pieceB.id,
        faceId: joint.b.faceId,
        faceType: 'edge',
        diameterMm: config.confirmatCoreDiameterMm,
        depthMm: config.confirmatCoreDepthMm,
        isThrough: false,
        positionMm: posBGeom.edgePosition,
        origin: 'derived',
        sourceJointKind: 'confirmat',
        description: `Confirmat pilot core Ø${config.confirmatCoreDiameterMm}x${config.confirmatCoreDepthMm}mm into edge`,
      });
    }

    return operations;
  }
}
