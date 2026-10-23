import { type DrillOperation } from '../../../model/operation';
import { type IJointMachiningStrategy, type JointMachiningContext } from '../types';
import { type Joint, type JointKind } from '../../../model';

/**
 * Machining strategy for furniture handles and pulls (bar handles, knobs).
 * Generates Ø4.5mm through-holes on drawer fronts and doors for standard M4 handle screws.
 */
export class HandleJointStrategy implements IJointMachiningStrategy {
  public readonly kind = 'handle' as const;

  public canHandle(_joint: Joint, effectiveKind: JointKind | string): boolean {
    return effectiveKind === 'handle';
  }

  public generateOperations(context: JointMachiningContext): DrillOperation[] {
    const { pieceA, joint, generateOpId } = context;
    const operations: DrillOperation[] = [];

    // Calculate dimensions of front piece
    const xs = pieceA.contour.points.map((p) => p.x);
    const ys = pieceA.contour.points.map((p) => p.y);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);

    const diameter = 4.5; // Standard clearance hole for M4 handle screws
    const depth = pieceA.thicknessMm;
    const pitch = joint.offsetMm ?? 128; // Default 128mm center-to-center pitch, 0 for single-hole knob
    const isKnob = pitch <= 0;
    const isDoor = pieceA.role.includes('door');

    if (isKnob) {
      // Single center hole for knob
      const posX = isDoor
        ? (joint.hingeSide === 'left' ? width - 40 : 40)
        : Math.round(width / 2);
      const posY = Math.round(height / 2);

      operations.push({
        schemaVersion: 1,
        id: generateOpId(),
        pieceId: pieceA.id,
        faceId: 'face-a',
        faceType: 'face-A',
        diameterMm: diameter,
        depthMm: depth,
        isThrough: true,
        positionMm: { x: posX, y: posY },
        origin: 'derived',
        sourceJointKind: 'handle',
        description: `Agujero pasante para pomo Ø${diameter}mm`,
      });
    } else {
      // 2-hole handle with standard pitch (e.g. 96, 128, 160, 192, 256, 320 mm)
      if (isDoor) {
        // Vertical handle on door, placed near opposite edge of hinges
        const posX = joint.hingeSide === 'left' ? width - 40 : 40;
        const midY = Math.round(height / 2);
        const y1 = Math.round(midY - pitch / 2);
        const y2 = Math.round(midY + pitch / 2);

        operations.push(
          {
            schemaVersion: 1,
            id: generateOpId(),
            pieceId: pieceA.id,
            faceId: 'face-a',
            faceType: 'face-A',
            diameterMm: diameter,
            depthMm: depth,
            isThrough: true,
            positionMm: { x: posX, y: y1 },
            origin: 'derived',
            sourceJointKind: 'handle',
            description: `Tirador barral agujero 1 (centro ${pitch}mm) Ø${diameter}mm`,
          },
          {
            schemaVersion: 1,
            id: generateOpId(),
            pieceId: pieceA.id,
            faceId: 'face-a',
            faceType: 'face-A',
            diameterMm: diameter,
            depthMm: depth,
            isThrough: true,
            positionMm: { x: posX, y: y2 },
            origin: 'derived',
            sourceJointKind: 'handle',
            description: `Tirador barral agujero 2 (centro ${pitch}mm) Ø${diameter}mm`,
          },
        );
      } else {
        // Horizontal handle centered on drawer front
        const midX = Math.round(width / 2);
        const midY = Math.round(height / 2);
        const x1 = Math.round(midX - pitch / 2);
        const x2 = Math.round(midX + pitch / 2);

        operations.push(
          {
            schemaVersion: 1,
            id: generateOpId(),
            pieceId: pieceA.id,
            faceId: 'face-a',
            faceType: 'face-A',
            diameterMm: diameter,
            depthMm: depth,
            isThrough: true,
            positionMm: { x: x1, y: midY },
            origin: 'derived',
            sourceJointKind: 'handle',
            description: `Tirador cajón agujero 1 (centro ${pitch}mm) Ø${diameter}mm`,
          },
          {
            schemaVersion: 1,
            id: generateOpId(),
            pieceId: pieceA.id,
            faceId: 'face-a',
            faceType: 'face-A',
            diameterMm: diameter,
            depthMm: depth,
            isThrough: true,
            positionMm: { x: x2, y: midY },
            origin: 'derived',
            sourceJointKind: 'handle',
            description: `Tirador cajón agujero 2 (centro ${pitch}mm) Ø${diameter}mm`,
          },
        );
      }
    }

    return operations;
  }
}
