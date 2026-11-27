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

    const safePocketDepth = Math.min(
      config.minifixPocketDepthMm,
      Math.max(8, pieceB.thicknessMm - 3),
    );

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
        description: `Anclaje perno Minifix Ø${config.minifixDowelDiameterMm}×${config.minifixDowelDepthMm} mm`,
      });

      // On Piece B: cam housing pocket on Face A or Face B (clamped safely to board thickness - 3 mm)
      operations.push({
        schemaVersion: 1,
        id: generateOpId(),
        pieceId: pieceB.id,
        faceId: posBGeom.edgeFaceTypeForPocket === 'face-B' ? 'bottom' : 'inner',
        faceType: posBGeom.edgeFaceTypeForPocket,
        diameterMm: config.minifixPocketDiameterMm,
        depthMm: safePocketDepth,
        isThrough: false,
        positionMm: posBGeom.getPocketPosition(config.minifixPocketSetbackMm),
        origin: 'derived',
        sourceJointKind: 'cam-dowel',
        description: `Caja excéntrica Minifix Ø${config.minifixPocketDiameterMm}×${safePocketDepth} mm (retiro ${config.minifixPocketSetbackMm} mm)`,
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
        description: `Canal perno Minifix en canto Ø${config.minifixBoltDiameterMm}×${config.minifixPocketSetbackMm} mm`,
      });
    }

    return operations;
  }
}
