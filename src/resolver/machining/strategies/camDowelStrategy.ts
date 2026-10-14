import { type DrillOperation } from '../../../model/operation';
import { type IJointMachiningStrategy, type JointMachiningContext } from '../types';
import { deriveContactGeometry, calculateDrillSpacingsFromConfig, deriveFaceType } from '../geometry';
import { type Joint, type JointKind } from '../../../model';

export class CamDowelJointStrategy implements IJointMachiningStrategy {
  public readonly kind = 'cam-dowel' as const;

  public canHandle(_joint: Joint, effectiveKind: JointKind | string): boolean {
    return effectiveKind === 'cam-dowel';
  }

  public generateOperations(context: JointMachiningContext): DrillOperation[] {
    const { pieceA, pieceB, joint, config, generateOpId } = context;
    const { yContact, zStart, contactLen } = deriveContactGeometry(pieceA, pieceB, joint);
    const offsets = calculateDrillSpacingsFromConfig(contactLen, config);
    const operations: DrillOperation[] = [];

    for (const off of offsets) {
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
        positionMm: { x: zStart + off, y: yContact },
        origin: 'derived',
        sourceJointKind: 'cam-dowel',
        description: `Minifix connecting bolt anchor hole Ø${config.minifixDowelDiameterMm}x${config.minifixDowelDepthMm}mm`,
      });

      // On Piece B: cam housing pocket on Face A
      operations.push({
        schemaVersion: 1,
        id: generateOpId(),
        pieceId: pieceB.id,
        faceId: 'inner',
        faceType: deriveFaceType(joint.b.faceId === 'outer' ? 'face-B' : 'inner'),
        diameterMm: config.minifixPocketDiameterMm,
        depthMm: config.minifixPocketDepthMm,
        isThrough: false,
        positionMm: { x: off, y: config.minifixPocketSetbackMm },
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
        positionMm: { x: off, y: pieceB.thicknessMm / 2 },
        origin: 'derived',
        sourceJointKind: 'cam-dowel',
        description: `Minifix bolt channel Ø${config.minifixBoltDiameterMm}x${config.minifixPocketSetbackMm}mm into edge`,
      });
    }

    return operations;
  }
}
