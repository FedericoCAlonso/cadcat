import { type DrillOperation } from '../../../model/operation';
import { type IJointMachiningStrategy, type JointMachiningContext } from '../types';
import { deriveContactGeometry, calculateDrillSpacingsFromConfig, deriveFaceType } from '../geometry';
import { type Joint, type JointKind } from '../../../model';

export class DowelAndConfirmatJointStrategy implements IJointMachiningStrategy {
  public readonly kind = 'dowel-and-confirmat' as const;

  public canHandle(_joint: Joint, effectiveKind: JointKind | string): boolean {
    return effectiveKind === 'dowel-and-confirmat';
  }

  public generateOperations(context: JointMachiningContext): DrillOperation[] {
    const { pieceA, pieceB, joint, config, generateOpId } = context;
    const geom = deriveContactGeometry(pieceA, pieceB, joint);
    const { yContact, zStart, contactLen } = geom;
    const offsets = calculateDrillSpacingsFromConfig(contactLen, config);
    const operations: DrillOperation[] = [];

    // 1. Confirmat clamping screws
    for (const off of offsets) {
      const posA = geom.getPieceAPosition ? geom.getPieceAPosition(off) : { x: zStart + off, y: yContact };
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
        sourceJointKind: 'dowel-and-confirmat',
        description: `Confirmat through hole Ø${config.confirmatThroughDiameterMm}mm for ${pieceB.id}`,
      });

      operations.push({
        schemaVersion: 1,
        id: generateOpId(),
        pieceId: pieceB.id,
        faceId: joint.b.faceId,
        faceType: 'edge',
        diameterMm: config.confirmatCoreDiameterMm,
        depthMm: config.confirmatCoreDepthMm,
        isThrough: false,
        positionMm: { x: off, y: pieceB.thicknessMm / 2 },
        origin: 'derived',
        sourceJointKind: 'dowel-and-confirmat',
        description: `Confirmat pilot core Ø${config.confirmatCoreDiameterMm}x${config.confirmatCoreDepthMm}mm into edge`,
      });
    }

    // 2. Alignment wooden dowels
    const dowelMinLength = config.dowelMinContactLengthMm ?? 160;
    const dowelSpacing = config.dowelSpacingMm ?? 32;

    const dowelOffsets =
      contactLen >= dowelMinLength
        ? [offsets[0]! + dowelSpacing, offsets[offsets.length - 1]! - dowelSpacing]
        : offsets.length >= 2
        ? [offsets[1]!]
        : [];

    for (const dOff of dowelOffsets) {
      const dPosA = geom.getPieceAPosition ? geom.getPieceAPosition(dOff) : { x: zStart + dOff, y: yContact };
      operations.push({
        schemaVersion: 1,
        id: generateOpId(),
        pieceId: pieceA.id,
        faceId: joint.a.faceId,
        faceType: deriveFaceType(joint.a.faceId),
        diameterMm: config.dowelFaceDiameterMm,
        depthMm: config.dowelFaceDepthMm,
        isThrough: false,
        positionMm: dPosA,
        origin: 'derived',
        sourceJointKind: 'dowel-and-confirmat',
        description: `Dowel face hole Ø${config.dowelFaceDiameterMm}x${config.dowelFaceDepthMm}mm`,
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
        positionMm: { x: dOff, y: pieceB.thicknessMm / 2 },
        origin: 'derived',
        sourceJointKind: 'dowel-and-confirmat',
        description: `Dowel edge hole Ø${config.dowelEdgeDiameterMm}x${config.dowelEdgeDepthMm}mm`,
      });
    }

    return operations;
  }
}
