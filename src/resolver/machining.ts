import { type Piece, type Joint, type MachiningConfig } from '../model';
import { type DrillOperation, type PieceMachining } from '../model/operation';
import defaultProjectConfigJson from '../config/defaultProjectConfig.json';

export type MachiningShopDefaults = MachiningConfig;

export const DEFAULT_MACHINING_SHOP_VALUES: MachiningConfig = defaultProjectConfigJson.machining;

/**
 * Derives spacing intervals along a joint of length L.
 * 2 points for <= maxSpanWithoutCenterMm (default 600mm), 3 points for > maxSpanWithoutCenterMm.
 */
export function calculateJointDrillSpacings(
  contactLengthMm: number,
  endSetbackMm = 50,
  maxSpanWithoutCenterMm = 600,
): number[] {
  const safeLength = Math.max(contactLengthMm, 120);
  if (safeLength <= maxSpanWithoutCenterMm) {
    return [endSetbackMm, safeLength - endSetbackMm];
  }
  return [
    endSetbackMm,
    Math.round(safeLength / 2),
    safeLength - endSetbackMm,
  ];
}

/**
 * Determines whether a given face identifier maps to Face A, Face B, or an Edge.
 */
export function deriveFaceType(faceId: string): 'face-A' | 'face-B' | 'edge' {
  const lower = faceId.toLowerCase();
  if (lower.includes('edge')) {
    return 'edge';
  }
  if (
    lower === 'face-b' ||
    lower === 'outer' ||
    lower === 'bottom' ||
    lower === 'bottom-face' ||
    lower === 'rear-face' ||
    lower === 'back'
  ) {
    return 'face-B';
  }
  return 'face-A';
}

/**
 * Derives drill operations for all pieces in a module from its joints.
 */
export function deriveModuleDrillOperations(
  pieces: Piece[],
  joints: Joint[],
  shopDefaults: MachiningConfig = DEFAULT_MACHINING_SHOP_VALUES,
): DrillOperation[] {
  const pieceMap = new Map<string, Piece>();
  for (const p of pieces) {
    pieceMap.set(p.id, p);
  }

  const operations: DrillOperation[] = [];
  let opIndex = 1;
  const marginMm = shopDefaults.jointDrillMarginMm ?? 50;
  const maxSpanMm = shopDefaults.maxSpanWithoutCenterDrillMm ?? 600;

  for (const joint of joints) {
    const pieceA = pieceMap.get(joint.a.pieceId);
    const pieceB = pieceMap.get(joint.b.pieceId);
    if (!pieceA || !pieceB) continue;

    const kind = joint.kind;

    if (kind === 'confirmat') {
      // Piece A is side/carcase (through holes 7mm), Piece B is connecting panel (edge holes 5mm)
      const bPoints = pieceB.contour.points;
      const bWidth = Math.abs(bPoints[1]?.x ?? 500);
      const bHeight = Math.abs(bPoints[2]?.y ?? 500);
      const contactLen = joint.b.faceId.includes('edge') ? bHeight : bWidth;
      const offsets = calculateJointDrillSpacings(contactLen, marginMm, maxSpanMm);

      for (const off of offsets) {
        // Operation on Piece A (Face A through hole)
        operations.push({
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceA.id,
          faceId: joint.a.faceId,
          faceType: deriveFaceType(joint.a.faceId),
          diameterMm: shopDefaults.confirmatThroughDiameterMm,
          depthMm: pieceA.thicknessMm,
          isThrough: true,
          positionMm: { x: off, y: pieceB.thicknessMm / 2 },
          origin: 'derived',
          sourceJointKind: 'confirmat',
          description: `Confirmat through hole Ø${shopDefaults.confirmatThroughDiameterMm}mm for ${pieceB.id}`,
        });

        // Operation on Piece B (Edge blind pilot hole)
        operations.push({
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceB.id,
          faceId: joint.b.faceId,
          faceType: 'edge',
          diameterMm: shopDefaults.confirmatCoreDiameterMm,
          depthMm: shopDefaults.confirmatCoreDepthMm,
          isThrough: false,
          positionMm: { x: off, y: pieceB.thicknessMm / 2 },
          origin: 'derived',
          sourceJointKind: 'confirmat',
          description: `Confirmat pilot core Ø${shopDefaults.confirmatCoreDiameterMm}x${shopDefaults.confirmatCoreDepthMm}mm into edge`,
        });
      }
    } else if (kind === 'cam-dowel') {
      const bPoints = pieceB.contour.points;
      const bHeight = Math.abs(bPoints[2]?.y ?? 500);
      const offsets = calculateJointDrillSpacings(bHeight, marginMm, maxSpanMm);

      for (const off of offsets) {
        // On Piece A: dowel anchor hole
        operations.push({
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceA.id,
          faceId: joint.a.faceId,
          faceType: deriveFaceType(joint.a.faceId),
          diameterMm: shopDefaults.minifixDowelDiameterMm,
          depthMm: shopDefaults.minifixDowelDepthMm,
          isThrough: false,
          positionMm: { x: off, y: pieceB.thicknessMm / 2 },
          origin: 'derived',
          sourceJointKind: 'cam-dowel',
          description: `Minifix connecting bolt anchor hole Ø${shopDefaults.minifixDowelDiameterMm}x${shopDefaults.minifixDowelDepthMm}mm`,
        });

        // On Piece B: cam housing pocket on Face A
        operations.push({
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceB.id,
          faceId: 'inner',
          faceType: deriveFaceType(joint.b.faceId === 'outer' ? 'face-B' : 'inner'),
          diameterMm: shopDefaults.minifixPocketDiameterMm,
          depthMm: shopDefaults.minifixPocketDepthMm,
          isThrough: false,
          positionMm: { x: off, y: shopDefaults.minifixPocketSetbackMm },
          origin: 'derived',
          sourceJointKind: 'cam-dowel',
          description: `Minifix cam pocket Ø${shopDefaults.minifixPocketDiameterMm}x${shopDefaults.minifixPocketDepthMm}mm at ${shopDefaults.minifixPocketSetbackMm}mm setback`,
        });

        // On Piece B: edge hole meeting the cam pocket
        operations.push({
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceB.id,
          faceId: joint.b.faceId,
          faceType: 'edge',
          diameterMm: shopDefaults.minifixBoltDiameterMm,
          depthMm: shopDefaults.minifixPocketSetbackMm,
          isThrough: false,
          positionMm: { x: off, y: pieceB.thicknessMm / 2 },
          origin: 'derived',
          sourceJointKind: 'cam-dowel',
          description: `Minifix bolt channel Ø${shopDefaults.minifixBoltDiameterMm}x${shopDefaults.minifixPocketSetbackMm}mm into edge`,
        });
      }
    } else if (kind === 'dowel') {
      const bPoints = pieceB.contour.points;
      const bHeight = Math.abs(bPoints[2]?.y ?? 500);
      const offsets = calculateJointDrillSpacings(bHeight, marginMm, maxSpanMm);

      for (const off of offsets) {
        operations.push({
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceA.id,
          faceId: joint.a.faceId,
          faceType: deriveFaceType(joint.a.faceId),
          diameterMm: shopDefaults.dowelFaceDiameterMm,
          depthMm: shopDefaults.dowelFaceDepthMm,
          isThrough: false,
          positionMm: { x: off, y: pieceB.thicknessMm / 2 },
          origin: 'derived',
          sourceJointKind: 'dowel',
          description: `Wooden dowel face hole Ø${shopDefaults.dowelFaceDiameterMm}x${shopDefaults.dowelFaceDepthMm}mm`,
        });

        operations.push({
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceB.id,
          faceId: joint.b.faceId,
          faceType: 'edge',
          diameterMm: shopDefaults.dowelEdgeDiameterMm,
          depthMm: shopDefaults.dowelEdgeDepthMm,
          isThrough: false,
          positionMm: { x: off, y: pieceB.thicknessMm / 2 },
          origin: 'derived',
          sourceJointKind: 'dowel',
          description: `Wooden dowel edge hole Ø${shopDefaults.dowelEdgeDiameterMm}x${shopDefaults.dowelEdgeDepthMm}mm`,
        });
      }
    } else if (kind === 'hinge') {
      // Piece A is Door, Piece B is Carcase Side
      const hingeY = joint.offsetMm ?? 100;

      // 1. On Door: 35mm cup hole
      operations.push({
        schemaVersion: 1,
        id: `op-drill-${opIndex++}`,
        pieceId: pieceA.id,
        faceId: joint.a.faceId,
        faceType: deriveFaceType(joint.a.faceId),
        diameterMm: shopDefaults.hingeCupDiameterMm,
        depthMm: shopDefaults.hingeCupDepthMm,
        isThrough: false,
        positionMm: { x: shopDefaults.hingeCupEdgeSetbackMm, y: hingeY },
        origin: 'derived',
        sourceJointKind: 'hinge',
        description: `Concealed hinge cup Ø${shopDefaults.hingeCupDiameterMm}x${shopDefaults.hingeCupDepthMm}mm`,
      });

      // 2. On Carcase Side: 2 mounting plate holes in System 32 line
      operations.push(
        {
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceB.id,
          faceId: joint.b.faceId,
          faceType: deriveFaceType(joint.b.faceId),
          diameterMm: shopDefaults.hingePlateDiameterMm,
          depthMm: shopDefaults.hingePlateDepthMm,
          isThrough: false,
          positionMm: { x: shopDefaults.hingePlateSetbackMm, y: hingeY - 16 },
          origin: 'derived',
          sourceJointKind: 'hinge',
          description: `Hinge mounting plate hole 1 Ø${shopDefaults.hingePlateDiameterMm}x${shopDefaults.hingePlateDepthMm}mm`,
        },
        {
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceB.id,
          faceId: joint.b.faceId,
          faceType: deriveFaceType(joint.b.faceId),
          diameterMm: shopDefaults.hingePlateDiameterMm,
          depthMm: shopDefaults.hingePlateDepthMm,
          isThrough: false,
          positionMm: { x: shopDefaults.hingePlateSetbackMm, y: hingeY + 16 },
          origin: 'derived',
          sourceJointKind: 'hinge',
          description: `Hinge mounting plate hole 2 Ø${shopDefaults.hingePlateDiameterMm}x${shopDefaults.hingePlateDepthMm}mm`,
        },
      );
    } else if (kind === 'shelf-pin') {
      // Piece A is Side, Piece B is Shelf
      const shelfY = joint.offsetMm ?? 400;
      const aPoints = pieceA.contour.points;
      const depthMm = Math.abs(aPoints[1]?.x ?? 560);

      // 2 holes on the side for supporting this shelf side
      operations.push(
        {
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceA.id,
          faceId: joint.a.faceId,
          faceType: deriveFaceType(joint.a.faceId),
          diameterMm: shopDefaults.shelfPinDiameterMm,
          depthMm: shopDefaults.shelfPinDepthMm,
          isThrough: false,
          positionMm: { x: shopDefaults.system32FrontSetbackMm, y: shelfY },
          origin: 'derived',
          sourceJointKind: 'shelf-pin',
          description: `Front shelf support pin Ø${shopDefaults.shelfPinDiameterMm}x${shopDefaults.shelfPinDepthMm}mm`,
        },
        {
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceA.id,
          faceId: joint.a.faceId,
          faceType: deriveFaceType(joint.a.faceId),
          diameterMm: shopDefaults.shelfPinDiameterMm,
          depthMm: shopDefaults.shelfPinDepthMm,
          isThrough: false,
          positionMm: { x: depthMm - shopDefaults.system32FrontSetbackMm, y: shelfY },
          origin: 'derived',
          sourceJointKind: 'shelf-pin',
          description: `Rear shelf support pin Ø${shopDefaults.shelfPinDiameterMm}x${shopDefaults.shelfPinDepthMm}mm`,
        },
      );
    } else if (kind === 'slide') {
      // Piece A is Drawer Box Side, Piece B is Carcase Side
      const slideY = joint.offsetMm ?? 60;

      // On Carcase Side: slide rail mounting holes (at 37mm and 229mm from front)
      operations.push(
        {
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceB.id,
          faceId: joint.b.faceId,
          faceType: deriveFaceType(joint.b.faceId),
          diameterMm: 5.0,
          depthMm: 12.0,
          isThrough: false,
          positionMm: { x: shopDefaults.system32FrontSetbackMm, y: slideY },
          origin: 'derived',
          sourceJointKind: 'slide',
          description: `Drawer slide front mounting hole Ø5x12mm`,
        },
        {
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceB.id,
          faceId: joint.b.faceId,
          faceType: deriveFaceType(joint.b.faceId),
          diameterMm: 5.0,
          depthMm: 12.0,
          isThrough: false,
          positionMm: { x: shopDefaults.system32FrontSetbackMm + 192.0, y: slideY },
          origin: 'derived',
          sourceJointKind: 'slide',
          description: `Drawer slide rear mounting hole Ø5x12mm`,
        },
      );
    }
  }

  return operations;
}

/**
 * Groups derived operations by piece and determines whether flipping/turning the piece is needed.
 */
export function groupOperationsByPiece(
  pieces: Piece[],
  operations: DrillOperation[],
): PieceMachining[] {
  const opMap = new Map<string, DrillOperation[]>();
  for (const op of operations) {
    const list = opMap.get(op.pieceId) ?? [];
    list.push(op);
    opMap.set(op.pieceId, list);
  }

  return pieces.map((piece) => {
    const pieceOps = opMap.get(piece.id) ?? [];
    const hasFaceA = pieceOps.some((o) => o.faceType === 'face-A');
    const hasFaceB = pieceOps.some((o) => o.faceType === 'face-B');
    const requiresTurn = (hasFaceA && hasFaceB) || hasFaceB;

    return {
      schemaVersion: 1,
      pieceId: piece.id,
      role: piece.role,
      operations: pieceOps,
      requiresTurn,
    };
  });
}
