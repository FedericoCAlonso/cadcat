import { type DrillOperation } from '../../../model/operation';
import { type IJointMachiningStrategy, type JointMachiningContext } from '../types';
import {
  deriveContactGeometry,
  calculateDrillSpacingsFromConfig,
  deriveFaceType,
  derivePieceBJointPositions,
} from '../geometry';
import { type Joint, type JointKind } from '../../../model';
import { translateRoleKey } from '../../../locales';

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
    const targetName = translateRoleKey(pieceB.role);

    // 1. Confirmat clamping screws
    for (const off of offsets) {
      const posA = geom.getPieceAPosition ? geom.getPieceAPosition(off) : { x: zStart + off, y: yContact };
      const posBGeom = derivePieceBJointPositions(pieceB, joint.b.faceId, off);

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
        description: `Pasante Confirmat Ø${config.confirmatThroughDiameterMm} mm (unión con ${targetName})`,
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
        positionMm: posBGeom.edgePosition,
        origin: 'derived',
        sourceJointKind: 'dowel-and-confirmat',
        description: `Pre-perforación Confirmat en canto Ø${config.confirmatCoreDiameterMm}×${config.confirmatCoreDepthMm} mm`,
      });
    }

    // 2. Alignment wooden dowels
    const dowelMinLength = config.dowelMinContactLengthMm ?? 160;
    const dowelSpacing = config.dowelSpacingMm ?? 32;

    const dowelOffsets =
      contactLen >= dowelMinLength
        ? [offsets[0]! + dowelSpacing, offsets[offsets.length - 1]! - dowelSpacing]
        : offsets.length >= 2 && contactLen >= 70
        ? [Math.round(contactLen / 2)]
        : [];

    for (const dOff of dowelOffsets) {
      const dPosA = geom.getPieceAPosition ? geom.getPieceAPosition(dOff) : { x: zStart + dOff, y: yContact };
      const dPosBGeom = derivePieceBJointPositions(pieceB, joint.b.faceId, dOff);

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
        description: `Orificio cara para tarugo Ø${config.dowelFaceDiameterMm}×${config.dowelFaceDepthMm} mm`,
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
        positionMm: dPosBGeom.edgePosition,
        origin: 'derived',
        sourceJointKind: 'dowel-and-confirmat',
        description: `Orificio canto para tarugo Ø${config.dowelEdgeDiameterMm}×${config.dowelEdgeDepthMm} mm`,
      });
    }

    return operations;
  }
}
