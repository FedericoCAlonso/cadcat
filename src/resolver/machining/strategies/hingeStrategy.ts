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

    // Identify Door (pieceA or pieceB) vs Carcase Side by role (avoiding prefix collisions with moduleId)
    const isADoor =
      pieceA.role.includes('door') ||
      pieceA.role.includes('leaf') ||
      pieceA.role.includes('flap') ||
      pieceA.role.includes('tapa');
    const isBDoor =
      pieceB.role.includes('door') ||
      pieceB.role.includes('leaf') ||
      pieceB.role.includes('flap') ||
      pieceB.role.includes('tapa');

    const isBothDoors = isADoor && isBDoor;

    if (isBothDoors) {
      // Intermediate hinge between two folding leaves (e.g. bifold)
      const leaf1 = pieceA;
      const leaf2 = pieceB;
      const leaf2Height = Math.max(...leaf2.contour.points.map((p) => p.y));

      const isHorizontalFold = joint.hingeSide === 'left' || joint.hingeSide === 'right';

      if (isHorizontalFold) {
        // Vertical hinge line between left leaf and right leaf
        const cup1X = leaf1.contour.points[1]!.x - config.hingeCupEdgeSetbackMm;
        const cup2X = config.hingeCupEdgeSetbackMm;
        const cupY = joint.doorOffsetMm ?? joint.offsetMm ?? 100;

        operations.push(
          {
            schemaVersion: 1,
            id: generateOpId(),
            pieceId: leaf1.id,
            faceId: joint.a.faceId,
            faceType: 'face-B',
            diameterMm: config.hingeCupDiameterMm,
            depthMm: config.hingeCupDepthMm,
            isThrough: false,
            positionMm: { x: cup1X, y: cupY },
            origin: 'derived',
            sourceJointKind: 'hinge',
            description: `Bifold intermediate hinge cup Ø${config.hingeCupDiameterMm}x${config.hingeCupDepthMm}mm (Leaf 1)`,
          },
          {
            schemaVersion: 1,
            id: generateOpId(),
            pieceId: leaf2.id,
            faceId: joint.b.faceId,
            faceType: 'face-B',
            diameterMm: config.hingeCupDiameterMm,
            depthMm: config.hingeCupDepthMm,
            isThrough: false,
            positionMm: { x: cup2X, y: cupY },
            origin: 'derived',
            sourceJointKind: 'hinge',
            description: `Bifold intermediate hinge cup Ø${config.hingeCupDiameterMm}x${config.hingeCupDepthMm}mm (Leaf 2)`,
          },
        );
      } else {
        // Horizontal hinge line between upper leaf and lower leaf
        const cupX = joint.doorOffsetMm ?? joint.offsetMm ?? 100;
        const cup1Y = config.hingeCupEdgeSetbackMm; // bottom edge of leaf 1
        const cup2Y = leaf2Height - config.hingeCupEdgeSetbackMm; // top edge of leaf 2

        operations.push(
          {
            schemaVersion: 1,
            id: generateOpId(),
            pieceId: leaf1.id,
            faceId: joint.a.faceId,
            faceType: 'face-B',
            diameterMm: config.hingeCupDiameterMm,
            depthMm: config.hingeCupDepthMm,
            isThrough: false,
            positionMm: { x: cupX, y: cup1Y },
            origin: 'derived',
            sourceJointKind: 'hinge',
            description: `Bifold intermediate hinge cup Ø${config.hingeCupDiameterMm}x${config.hingeCupDepthMm}mm (Upper Leaf)`,
          },
          {
            schemaVersion: 1,
            id: generateOpId(),
            pieceId: leaf2.id,
            faceId: joint.b.faceId,
            faceType: 'face-B',
            diameterMm: config.hingeCupDiameterMm,
            depthMm: config.hingeCupDepthMm,
            isThrough: false,
            positionMm: { x: cupX, y: cup2Y },
            origin: 'derived',
            sourceJointKind: 'hinge',
            description: `Bifold intermediate hinge cup Ø${config.hingeCupDiameterMm}x${config.hingeCupDepthMm}mm (Lower Leaf)`,
          },
        );
      }
      return operations;
    }

    const doorPiece = isBDoor && !isADoor ? pieceB : pieceA;
    const carcasePiece = isBDoor && !isADoor ? pieceA : pieceB;
    const doorFaceRef = isBDoor && !isADoor ? joint.b : joint.a;
    const carcaseFaceRef = isBDoor && !isADoor ? joint.a : joint.b;

    const doorHeight = Math.max(...doorPiece.contour.points.map((p) => p.y));
    const doorWidth = Math.max(...doorPiece.contour.points.map((p) => p.x));

    if (joint.hingeSide === 'top' || carcasePiece.role.includes('top') || carcasePiece.role.includes('roof')) {
      // Top-hinged door / flap / upper bifold leaf
      const cupX = joint.doorOffsetMm ?? joint.offsetMm ?? 100;
      const cupY = doorHeight - config.hingeCupEdgeSetbackMm;

      operations.push({
        schemaVersion: 1,
        id: generateOpId(),
        pieceId: doorPiece.id,
        faceId: doorFaceRef.faceId,
        faceType: 'face-B',
        diameterMm: config.hingeCupDiameterMm,
        depthMm: config.hingeCupDepthMm,
        isThrough: false,
        positionMm: { x: cupX, y: cupY },
        origin: 'derived',
        sourceJointKind: 'hinge',
        description: `Concealed hinge cup Ø${config.hingeCupDiameterMm}x${config.hingeCupDepthMm}mm (Top edge)`,
      });

      // Mounting plate on carcase top/roof (inner face)
      const spacing = config.hingePlateHoleSpacingMm ?? 32.0;
      const halfSpacing = spacing / 2;
      const plateSetback = config.hingePlateSetbackMm;

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
          positionMm: { x: cupX - halfSpacing, y: plateSetback },
          origin: 'derived',
          sourceJointKind: 'hinge',
          description: `Hinge mounting plate hole 1 Ø${config.hingePlateDiameterMm}x${config.hingePlateDepthMm}mm`,
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
          positionMm: { x: cupX + halfSpacing, y: plateSetback },
          origin: 'derived',
          sourceJointKind: 'hinge',
          description: `Hinge mounting plate hole 2 Ø${config.hingePlateDiameterMm}x${config.hingePlateDepthMm}mm`,
        },
      );
      return operations;
    }

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

    // 2. On Carcase Side / Partition: 2 mounting plate holes in System 32 line
    // Codo 0 & Codo 9: 37mm setback. Codo 18 (Inset): 37mm + door thickness.
    const rawCarcaseHingeY = joint.offsetMm ?? doorHingeY;
    const carcasePos = 'positionMm' in carcasePiece && carcasePiece.positionMm ? (carcasePiece.positionMm as Record<string, number>) : undefined;
    const carcaseHingeY = carcasePos && typeof carcasePos.y === 'number' && carcasePos.y > 0 ? rawCarcaseHingeY - carcasePos.y : rawCarcaseHingeY;
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
