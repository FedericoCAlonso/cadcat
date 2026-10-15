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

    const doorWidth = Math.max(...pieceA.contour.points.map((p) => p.x));
    const isRightDoor =
      pieceA.role.includes('right') ||
      pieceA.id.includes('right') ||
      pieceA.id.endsWith('-r') ||
      joint.b.pieceId.includes('right');

    const cupX = isRightDoor
      ? doorWidth - config.hingeCupEdgeSetbackMm
      : config.hingeCupEdgeSetbackMm;

    // 1. On Door: cup hole (Ø35mm)
    operations.push({
      schemaVersion: 1,
      id: generateOpId(),
      pieceId: pieceA.id,
      faceId: joint.a.faceId,
      faceType: deriveFaceType(joint.a.faceId),
      diameterMm: config.hingeCupDiameterMm,
      depthMm: config.hingeCupDepthMm,
      isThrough: false,
      positionMm: { x: cupX, y: hingeY },
      origin: 'derived',
      sourceJointKind: 'hinge',
      description: `Concealed hinge cup Ø${config.hingeCupDiameterMm}x${config.hingeCupDepthMm}mm (${isRightDoor ? 'right' : 'left'})`,
    });

    // 2. On Carcase Side: 2 mounting plate holes in System 32 line
    // Codo 0 & Codo 9: 37mm setback. Codo 18 (Inset): 37mm + door thickness.
    const isInset = joint.hingeCrank === 'codo-18';
    const plateSetback = isInset
      ? config.hingePlateSetbackMm + pieceA.thicknessMm
      : config.hingePlateSetbackMm;

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
        positionMm: { x: plateSetback, y: hingeY - halfSpacing },
        origin: 'derived',
        sourceJointKind: 'hinge',
        description: `Hinge mounting plate hole 1 Ø${config.hingePlateDiameterMm}x${config.hingePlateDepthMm}mm${isInset ? ' (Codo 18 / Inset)' : ''}`,
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
        positionMm: { x: plateSetback, y: hingeY + halfSpacing },
        origin: 'derived',
        sourceJointKind: 'hinge',
        description: `Hinge mounting plate hole 2 Ø${config.hingePlateDiameterMm}x${config.hingePlateDepthMm}mm${isInset ? ' (Codo 18 / Inset)' : ''}`,
      },
    );

    return operations;
  }
}
