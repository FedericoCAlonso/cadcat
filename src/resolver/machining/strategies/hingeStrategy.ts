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

    // Identify Door (pieceA or pieceB) vs Carcase Side
    const isADoor =
      pieceA.role.includes('door') ||
      pieceA.role.includes('leaf') ||
      pieceA.id.includes('door') ||
      pieceA.id.includes('leaf');
    const isBDoor =
      pieceB.role.includes('door') ||
      pieceB.role.includes('leaf') ||
      pieceB.id.includes('door') ||
      pieceB.id.includes('leaf');

    const doorPiece = isBDoor && !isADoor ? pieceB : pieceA;
    const carcasePiece = isBDoor && !isADoor ? pieceA : pieceB;
    const doorFaceRef = isBDoor && !isADoor ? joint.b : joint.a;
    const carcaseFaceRef = isBDoor && !isADoor ? joint.a : joint.b;

    const doorHeight = Math.max(...doorPiece.contour.points.map((p) => p.y));
    const doorWidth = Math.max(...doorPiece.contour.points.map((p) => p.x));

    const isRightDoor =
      joint.hingeSide === 'right'
        ? true
        : joint.hingeSide === 'left'
          ? false
          : doorPiece.role.includes('right') ||
            doorPiece.id.includes('right') ||
            doorPiece.id.endsWith('-r') ||
            carcaseFaceRef.pieceId.includes('right');

    const cupX = isRightDoor
      ? doorWidth - config.hingeCupEdgeSetbackMm
      : config.hingeCupEdgeSetbackMm;

    // Door local hinge elevation: measured from bottom edge of the door
    const doorHingeY =
      joint.doorOffsetMm !== undefined
        ? joint.doorOffsetMm
        : joint.offsetMm !== undefined && joint.offsetMm <= doorHeight
          ? joint.offsetMm
          : Math.min(
              doorHeight - (config.jointDrillMarginMm ?? 100),
              Math.max(config.jointDrillMarginMm ?? 100, (joint.offsetMm ?? 100) % doorHeight),
            );

    const safeDoorHingeY = Math.max(10, Math.min(doorHeight - 10, doorHingeY));

    // 1. On Door: cup hole (Ø35mm) on the interior face (face-B)
    operations.push({
      schemaVersion: 1,
      id: generateOpId(),
      pieceId: doorPiece.id,
      faceId: doorFaceRef.faceId,
      faceType: 'face-B',
      diameterMm: config.hingeCupDiameterMm,
      depthMm: config.hingeCupDepthMm,
      isThrough: false,
      positionMm: { x: cupX, y: safeDoorHingeY },
      origin: 'derived',
      sourceJointKind: 'hinge',
      description: `Concealed hinge cup Ø${config.hingeCupDiameterMm}x${config.hingeCupDepthMm}mm (${isRightDoor ? 'right' : 'left'})`,
    });

    // 2. On Carcase Side: 2 mounting plate holes in System 32 line
    // Codo 0 & Codo 9: 37mm setback. Codo 18 (Inset): 37mm + door thickness.
    const carcaseHingeY = joint.offsetMm ?? doorHingeY;
    const spacing = config.hingePlateHoleSpacingMm ?? 32.0;
    const halfSpacing = spacing / 2;

    const isInset = joint.hingeCrank === 'codo-18';
    const plateSetback = isInset
      ? config.hingePlateSetbackMm + doorPiece.thicknessMm
      : config.hingePlateSetbackMm;

    operations.push(
      {
        schemaVersion: 1,
        id: generateOpId(),
        pieceId: carcasePiece.id,
        faceId: carcaseFaceRef.faceId,
        faceType: deriveFaceType(carcaseFaceRef.faceId, carcasePiece.role),
        diameterMm: config.hingePlateDiameterMm,
        depthMm: config.hingePlateDepthMm,
        isThrough: false,
        positionMm: { x: plateSetback, y: carcaseHingeY - halfSpacing },
        origin: 'derived',
        sourceJointKind: 'hinge',
        description: `Hinge mounting plate hole 1 Ø${config.hingePlateDiameterMm}x${config.hingePlateDepthMm}mm${isInset ? ' (Codo 18 / Inset)' : ''}`,
      },
      {
        schemaVersion: 1,
        id: generateOpId(),
        pieceId: carcasePiece.id,
        faceId: carcaseFaceRef.faceId,
        faceType: deriveFaceType(carcaseFaceRef.faceId, carcasePiece.role),
        diameterMm: config.hingePlateDiameterMm,
        depthMm: config.hingePlateDepthMm,
        isThrough: false,
        positionMm: { x: plateSetback, y: carcaseHingeY + halfSpacing },
        origin: 'derived',
        sourceJointKind: 'hinge',
        description: `Hinge mounting plate hole 2 Ø${config.hingePlateDiameterMm}x${config.hingePlateDepthMm}mm${isInset ? ' (Codo 18 / Inset)' : ''}`,
      },
    );

    return operations;
  }
}
