import { type DrillOperation } from '../../../model/operation';
import { type IJointMachiningStrategy, type JointMachiningContext } from '../types';
import {
  deriveContactGeometry,
  calculateDrillSpacingsFromConfig,
  deriveFaceType,
  derivePieceBJointPositions,
} from '../geometry';
import { type Joint, type JointKind } from '../../../model';

export class CamDowelJointStrategy implements IJointMachiningStrategy {
  public readonly kind = 'cam-dowel' as const;

  public canHandle(_joint: Joint, effectiveKind: JointKind | string): boolean {
    return effectiveKind === 'cam-dowel';
  }

  public generateOperations(context: JointMachiningContext): DrillOperation[] {
    const { pieceA, pieceB, joint, config, generateOpId } = context;
    const geom = deriveContactGeometry(pieceA, pieceB, joint);
    const { yContact, zStart, contactLen } = geom;
    const offsets = calculateDrillSpacingsFromConfig(contactLen, config);
    const operations: DrillOperation[] = [];

    for (const off of offsets) {
      const posA = geom.getPieceAPosition ? geom.getPieceAPosition(off) : { x: zStart + off, y: yContact };
      const preferredFace = joint.b.faceId === 'outer' ? 'face-B' : undefined;
      const posBGeom = derivePieceBJointPositions(pieceB, joint.b.faceId, off, preferredFace);

      // On Piece A: dowel anchor hole
      operations.push({
        schemaVersion: 1,
        id: generateOpId(),
        pieceId: pieceA.id,
        faceId: joint.a.faceId,
        faceType: deriveFaceType(joint.a.faceId),
        diameterMm: config.minifixDowelDiameterMm,
        depthMm: config.minifixDowelDepthMm,
        isThrough: false,
        positionMm: posA,
        origin: 'derived',
        sourceJointKind: 'cam-dowel',
        description: `Minifix connecting bolt anchor hole Ø${config.minifixDowelDiameterMm}x${config.minifixDowelDepthMm}mm`,
      });

      // On Piece B: cam housing pocket on Face A or Face B
      operations.push({
        schemaVersion: 1,
        id: generateOpId(),
        pieceId: pieceB.id,
        faceId: posBGeom.edgeFaceTypeForPocket === 'face-B' ? 'bottom' : 'inner',
        faceType: posBGeom.edgeFaceTypeForPocket,
        diameterMm: config.minifixPocketDiameterMm,
        depthMm: config.minifixPocketDepthMm,
        isThrough: false,
        positionMm: posBGeom.getPocketPosition(config.minifixPocketSetbackMm),
        origin: 'derived',
        sourceJointKind: 'cam-dowel',
        description: `Minifix cam pocket Ø${config.minifixPocketDiameterMm}x${config.minifixPocketDepthMm}mm at ${config.minifixPocketSetbackMm}mm setback`,
      });

      // On Piece B: edge hole meeting the cam pocket
      operations.push({
        schemaVersion: 1,
        id: generateOpId(),
        pieceId: pieceB.id,
        faceId: joint.b.faceId,
        faceType: 'edge',
        diameterMm: config.minifixBoltDiameterMm,
        depthMm: config.minifixPocketSetbackMm,
        isThrough: false,
        positionMm: posBGeom.edgePosition,
        origin: 'derived',
        sourceJointKind: 'cam-dowel',
        description: `Minifix bolt channel Ø${config.minifixBoltDiameterMm}x${config.minifixPocketSetbackMm}mm into edge`,
      });
    }

    return operations;
  }
}
