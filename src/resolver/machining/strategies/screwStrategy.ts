import { type DrillOperation } from '../../../model/operation';
import { type IJointMachiningStrategy, type JointMachiningContext } from '../types';
import {
  deriveContactGeometry,
  calculateDrillSpacingsFromConfig,
  deriveFaceType,
  derivePieceBJointPositions,
} from '../geometry';
import { type Joint, type JointKind } from '../../../model';

export class ScrewJointStrategy implements IJointMachiningStrategy {
  public readonly kind = 'screw' as const;

  public canHandle(_joint: Joint, effectiveKind: JointKind | string): boolean {
    return effectiveKind === 'screw';
  }

  public generateOperations(context: JointMachiningContext): DrillOperation[] {
    const { pieceA, pieceB, joint, config, generateOpId } = context;
    const geom = deriveContactGeometry(pieceA, pieceB, joint);
    const { yContact, zStart, contactLen } = geom;
    const offsets = calculateDrillSpacingsFromConfig(contactLen, config);
    const operations: DrillOperation[] = [];

    const throughDiameter = config.screwThroughDiameterMm ?? 4.0;
    const coreDiameter = config.screwCoreDiameterMm ?? 3.0;
    const coreDepth = config.screwCoreDepthMm ?? 35.0;

    for (const off of offsets) {
      const posA = geom.getPieceAPosition ? geom.getPieceAPosition(off) : { x: zStart + off, y: yContact };
      const posBGeom = derivePieceBJointPositions(pieceB, joint.b.faceId, off);

      operations.push({
        schemaVersion: 1,
        id: generateOpId(),
        pieceId: pieceA.id,
        faceId: joint.a.faceId,
        faceType: deriveFaceType(joint.a.faceId),
        diameterMm: throughDiameter,
        depthMm: pieceA.thicknessMm,
        isThrough: true,
        positionMm: posA,
        origin: 'derived',
        sourceJointKind: 'screw',
        description: `Spax screw through hole Ø${throughDiameter}mm for ${pieceB.id}`,
      });

      operations.push({
        schemaVersion: 1,
        id: generateOpId(),
        pieceId: pieceB.id,
        faceId: joint.b.faceId,
        faceType: 'edge',
        diameterMm: coreDiameter,
        depthMm: coreDepth,
        isThrough: false,
        positionMm: posBGeom.edgePosition,
        origin: 'derived',
        sourceJointKind: 'screw',
        description: `Spax pilot core Ø${coreDiameter}x${coreDepth}mm into edge`,
      });
    }

    return operations;
  }
}
