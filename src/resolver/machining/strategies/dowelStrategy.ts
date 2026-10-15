import { type DrillOperation } from '../../../model/operation';
import { type IJointMachiningStrategy, type JointMachiningContext } from '../types';
import { deriveContactGeometry, calculateDrillSpacingsFromConfig, deriveFaceType } from '../geometry';
import { type Joint, type JointKind } from '../../../model';

export class DowelJointStrategy implements IJointMachiningStrategy {
  public readonly kind = 'dowel' as const;

  public canHandle(_joint: Joint, effectiveKind: JointKind | string): boolean {
    return effectiveKind === 'dowel';
  }

  public generateOperations(context: JointMachiningContext): DrillOperation[] {
    const { pieceA, pieceB, joint, config, generateOpId } = context;
    const geom = deriveContactGeometry(pieceA, pieceB, joint);
    const { yContact, zStart, contactLen } = geom;
    const offsets = calculateDrillSpacingsFromConfig(contactLen, config);
    const operations: DrillOperation[] = [];

    for (const off of offsets) {
      const posA = geom.getPieceAPosition ? geom.getPieceAPosition(off) : { x: zStart + off, y: yContact };
      operations.push({
        schemaVersion: 1,
        id: generateOpId(),
        pieceId: pieceA.id,
        faceId: joint.a.faceId,
        faceType: deriveFaceType(joint.a.faceId),
        diameterMm: config.dowelFaceDiameterMm,
        depthMm: config.dowelFaceDepthMm,
        isThrough: false,
        positionMm: posA,
        origin: 'derived',
        sourceJointKind: 'dowel',
        description: `Wooden dowel face hole Ø${config.dowelFaceDiameterMm}x${config.dowelFaceDepthMm}mm`,
      });

      operations.push({
        schemaVersion: 1,
        id: generateOpId(),
        pieceId: pieceB.id,
        faceId: joint.b.faceId,
        faceType: 'edge',
        diameterMm: config.dowelEdgeDiameterMm,
        depthMm: config.dowelEdgeDepthMm,
        isThrough: false,
        positionMm: { x: off, y: pieceB.thicknessMm / 2 },
        origin: 'derived',
        sourceJointKind: 'dowel',
        description: `Wooden dowel edge hole Ø${config.dowelEdgeDiameterMm}x${config.dowelEdgeDepthMm}mm`,
      });
    }

    return operations;
  }
}
