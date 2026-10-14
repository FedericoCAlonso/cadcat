import {
  type Piece,
  type Joint,
  type JointKind,
  type MachiningConfig,
  machiningConfigSchema,
} from '../model';
import { type DrillOperation, type PieceMachining } from '../model/operation';
import { determinePieceSpatialSize } from './spatial3d';
import type { ResolvedPiece } from './resolver';
import defaultProjectConfigJson from '../config/defaultProjectConfig.json';

export type MachiningShopDefaults = MachiningConfig;

export const DEFAULT_MACHINING_SHOP_VALUES: MachiningConfig = machiningConfigSchema.parse(
  defaultProjectConfigJson.machining,
);

/**
 * Derives spacing intervals along a joint of length L.
 * 2 points for <= maxSpanWithoutCenterMm (default 600mm), 3 points for > maxSpanWithoutCenterMm.
 * Short pieces (<= 110mm, e.g. rails/transoms of 80mm) use proportional margins to avoid overlap.
 */
export function calculateJointDrillSpacings(
  contactLengthMm: number,
  endSetbackMm = 50,
  maxSpanWithoutCenterMm = 600,
): number[] {
  if (contactLengthMm <= 50) {
    return [Math.round(contactLengthMm / 2)];
  }
  if (contactLengthMm <= 110) {
    const margin = Math.min(25, Math.floor(contactLengthMm / 3));
    return [margin, contactLengthMm - margin];
  }
  if (contactLengthMm <= maxSpanWithoutCenterMm) {
    return [endSetbackMm, contactLengthMm - endSetbackMm];
  }
  return [
    endSetbackMm,
    Math.round(contactLengthMm / 2),
    contactLengthMm - endSetbackMm,
  ];
}

/**
 * Derives the spatial contact line between two joined pieces:
 * - yContact: contact height on pieceA's local face coordinate
 * - zStart: starting offset on pieceA's local depth coordinate
 * - contactLen: length of contact interface along depth
 */
export function deriveContactGeometry(
  pieceA: Piece | ResolvedPiece,
  pieceB: Piece | ResolvedPiece,
  joint: Joint,
): { yContact: number; zStart: number; contactLen: number } {
  const sizeB = determinePieceSpatialSize(pieceB);

  const posA = 'positionMm' in pieceA && pieceA.positionMm ? pieceA.positionMm : undefined;
  const posB = 'positionMm' in pieceB && pieceB.positionMm ? pieceB.positionMm : undefined;

  let yContact: number;
  let zStart: number;
  let contactLen: number;

  if (posA && posB) {
    // Exact 3D spatial positions from ResolvedPiece
    yContact = Math.round(posB.y - posA.y + sizeB.y / 2);
    zStart = Math.max(0, Math.round(posB.z - posA.z));
    contactLen = Math.round(sizeB.z);
    if (contactLen <= 0) {
      contactLen = Math.round(sizeB.x > 0 ? sizeB.x : 500);
    }
  } else {
    // Fallback derivation based on piece contour points and semantic roles
    const aPoints = pieceA.contour.points;
    const aHeight = Math.abs(aPoints[2]?.y ?? 800);
    const aWidth = Math.abs(aPoints[1]?.x ?? 560);

    const bPoints = pieceB.contour.points;
    const bWidth = Math.abs(bPoints[1]?.x ?? 500);
    const bHeight = Math.abs(bPoints[2]?.y ?? 500);
    contactLen = joint.b.faceId.includes('edge') ? bHeight : bWidth;

    const bRole = pieceB.role.toLowerCase();
    if (bRole.includes('roof') || bRole.includes('top')) {
      yContact = Math.round(aHeight - pieceB.thicknessMm / 2);
      zStart = bRole.includes('rail-back') ? Math.max(0, Math.round(aWidth - contactLen)) : 0;
    } else if (bRole.includes('shelf')) {
      yContact = joint.offsetMm ?? Math.round(aHeight / 2);
      zStart = 0;
    } else {
      yContact = Math.round(pieceB.thicknessMm / 2);
      zStart = 0;
    }
  }

  return { yContact, zStart, contactLen };
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
 * Uses exact 3D positioning when available and supports configurable joint strategies
 * (confirmat, dowel-and-confirmat, cam-dowel, screw).
 */
export function deriveModuleDrillOperations(
  pieces: (Piece | ResolvedPiece)[],
  joints: Joint[],
  shopDefaults: Partial<MachiningConfig> = DEFAULT_MACHINING_SHOP_VALUES,
): DrillOperation[] {
  const defaults = {
    ...DEFAULT_MACHINING_SHOP_VALUES,
    ...shopDefaults,
  };

  const pieceMap = new Map<string, Piece | ResolvedPiece>();
  for (const p of pieces) {
    pieceMap.set(p.id, p);
  }

  const operations: DrillOperation[] = [];
  let opIndex = 1;
  const marginMm = defaults.jointDrillMarginMm ?? 50;
  const maxSpanMm = defaults.maxSpanWithoutCenterDrillMm ?? 600;

  for (const joint of joints) {
    const pieceA = pieceMap.get(joint.a.pieceId);
    const pieceB = pieceMap.get(joint.b.pieceId);
    if (!pieceA || !pieceB) continue;

    const effectiveKind: JointKind =
      joint.kind === 'confirmat' && defaults.jointStrategy
        ? defaults.jointStrategy
        : joint.kind;

    if (effectiveKind === 'confirmat') {
      const { yContact, zStart, contactLen } = deriveContactGeometry(pieceA, pieceB, joint);
      const offsets = calculateJointDrillSpacings(contactLen, marginMm, maxSpanMm);

      for (const off of offsets) {
        // Operation on Piece A (Face through hole)
        operations.push({
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceA.id,
          faceId: joint.a.faceId,
          faceType: deriveFaceType(joint.a.faceId),
          diameterMm: defaults.confirmatThroughDiameterMm,
          depthMm: pieceA.thicknessMm,
          isThrough: true,
          positionMm: { x: zStart + off, y: yContact },
          origin: 'derived',
          sourceJointKind: 'confirmat',
          description: `Confirmat through hole Ø${defaults.confirmatThroughDiameterMm}mm for ${pieceB.id}`,
        });

        // Operation on Piece B (Edge blind pilot hole)
        operations.push({
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceB.id,
          faceId: joint.b.faceId,
          faceType: 'edge',
          diameterMm: defaults.confirmatCoreDiameterMm,
          depthMm: defaults.confirmatCoreDepthMm,
          isThrough: false,
          positionMm: { x: off, y: pieceB.thicknessMm / 2 },
          origin: 'derived',
          sourceJointKind: 'confirmat',
          description: `Confirmat pilot core Ø${defaults.confirmatCoreDiameterMm}x${defaults.confirmatCoreDepthMm}mm into edge`,
        });
      }
    } else if (effectiveKind === 'dowel-and-confirmat') {
      const { yContact, zStart, contactLen } = deriveContactGeometry(pieceA, pieceB, joint);
      const offsets = calculateJointDrillSpacings(contactLen, marginMm, maxSpanMm);

      // 1. Confirmat clamping screws
      for (const off of offsets) {
        operations.push({
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceA.id,
          faceId: joint.a.faceId,
          faceType: deriveFaceType(joint.a.faceId),
          diameterMm: defaults.confirmatThroughDiameterMm,
          depthMm: pieceA.thicknessMm,
          isThrough: true,
          positionMm: { x: zStart + off, y: yContact },
          origin: 'derived',
          sourceJointKind: 'dowel-and-confirmat',
          description: `Confirmat through hole Ø${defaults.confirmatThroughDiameterMm}mm for ${pieceB.id}`,
        });

        operations.push({
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceB.id,
          faceId: joint.b.faceId,
          faceType: 'edge',
          diameterMm: defaults.confirmatCoreDiameterMm,
          depthMm: defaults.confirmatCoreDepthMm,
          isThrough: false,
          positionMm: { x: off, y: pieceB.thicknessMm / 2 },
          origin: 'derived',
          sourceJointKind: 'dowel-and-confirmat',
          description: `Confirmat pilot core Ø${defaults.confirmatCoreDiameterMm}x${defaults.confirmatCoreDepthMm}mm into edge`,
        });
      }

      // 2. Alignment wooden dowels
      const dowelOffsets =
        contactLen >= 160
          ? [offsets[0]! + 32, offsets[offsets.length - 1]! - 32]
          : offsets.length >= 2
          ? [offsets[1]!]
          : [];

      for (const dOff of dowelOffsets) {
        operations.push({
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceA.id,
          faceId: joint.a.faceId,
          faceType: deriveFaceType(joint.a.faceId),
          diameterMm: defaults.dowelFaceDiameterMm,
          depthMm: defaults.dowelFaceDepthMm,
          isThrough: false,
          positionMm: { x: zStart + dOff, y: yContact },
          origin: 'derived',
          sourceJointKind: 'dowel-and-confirmat',
          description: `Dowel face hole Ø${defaults.dowelFaceDiameterMm}x${defaults.dowelFaceDepthMm}mm`,
        });

        operations.push({
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceB.id,
          faceId: joint.b.faceId,
          faceType: 'edge',
          diameterMm: defaults.dowelEdgeDiameterMm,
          depthMm: defaults.dowelEdgeDepthMm,
          isThrough: false,
          positionMm: { x: dOff, y: pieceB.thicknessMm / 2 },
          origin: 'derived',
          sourceJointKind: 'dowel-and-confirmat',
          description: `Dowel edge hole Ø${defaults.dowelEdgeDiameterMm}x${defaults.dowelEdgeDepthMm}mm`,
        });
      }
    } else if (effectiveKind === 'screw') {
      const { yContact, zStart, contactLen } = deriveContactGeometry(pieceA, pieceB, joint);
      const offsets = calculateJointDrillSpacings(contactLen, marginMm, maxSpanMm);

      for (const off of offsets) {
        operations.push({
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceA.id,
          faceId: joint.a.faceId,
          faceType: deriveFaceType(joint.a.faceId),
          diameterMm: 4.0,
          depthMm: pieceA.thicknessMm,
          isThrough: true,
          positionMm: { x: zStart + off, y: yContact },
          origin: 'derived',
          sourceJointKind: 'screw',
          description: `Spax screw through hole Ø4mm for ${pieceB.id}`,
        });

        operations.push({
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceB.id,
          faceId: joint.b.faceId,
          faceType: 'edge',
          diameterMm: 3.0,
          depthMm: 35.0,
          isThrough: false,
          positionMm: { x: off, y: pieceB.thicknessMm / 2 },
          origin: 'derived',
          sourceJointKind: 'screw',
          description: `Spax pilot core Ø3x35mm into edge`,
        });
      }
    } else if (effectiveKind === 'cam-dowel') {
      const { yContact, zStart, contactLen } = deriveContactGeometry(pieceA, pieceB, joint);
      const offsets = calculateJointDrillSpacings(contactLen, marginMm, maxSpanMm);

      for (const off of offsets) {
        // On Piece A: dowel anchor hole
        operations.push({
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceA.id,
          faceId: joint.a.faceId,
          faceType: deriveFaceType(joint.a.faceId),
          diameterMm: defaults.minifixDowelDiameterMm,
          depthMm: defaults.minifixDowelDepthMm,
          isThrough: false,
          positionMm: { x: zStart + off, y: yContact },
          origin: 'derived',
          sourceJointKind: 'cam-dowel',
          description: `Minifix connecting bolt anchor hole Ø${defaults.minifixDowelDiameterMm}x${defaults.minifixDowelDepthMm}mm`,
        });

        // On Piece B: cam housing pocket on Face A
        operations.push({
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceB.id,
          faceId: 'inner',
          faceType: deriveFaceType(joint.b.faceId === 'outer' ? 'face-B' : 'inner'),
          diameterMm: defaults.minifixPocketDiameterMm,
          depthMm: defaults.minifixPocketDepthMm,
          isThrough: false,
          positionMm: { x: off, y: defaults.minifixPocketSetbackMm },
          origin: 'derived',
          sourceJointKind: 'cam-dowel',
          description: `Minifix cam pocket Ø${defaults.minifixPocketDiameterMm}x${defaults.minifixPocketDepthMm}mm at ${defaults.minifixPocketSetbackMm}mm setback`,
        });

        // On Piece B: edge hole meeting the cam pocket
        operations.push({
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceB.id,
          faceId: joint.b.faceId,
          faceType: 'edge',
          diameterMm: defaults.minifixBoltDiameterMm,
          depthMm: defaults.minifixPocketSetbackMm,
          isThrough: false,
          positionMm: { x: off, y: pieceB.thicknessMm / 2 },
          origin: 'derived',
          sourceJointKind: 'cam-dowel',
          description: `Minifix bolt channel Ø${defaults.minifixBoltDiameterMm}x${defaults.minifixPocketSetbackMm}mm into edge`,
        });
      }
    } else if (effectiveKind === 'dowel') {
      const { yContact, zStart, contactLen } = deriveContactGeometry(pieceA, pieceB, joint);
      const offsets = calculateJointDrillSpacings(contactLen, marginMm, maxSpanMm);

      for (const off of offsets) {
        operations.push({
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceA.id,
          faceId: joint.a.faceId,
          faceType: deriveFaceType(joint.a.faceId),
          diameterMm: defaults.dowelFaceDiameterMm,
          depthMm: defaults.dowelFaceDepthMm,
          isThrough: false,
          positionMm: { x: zStart + off, y: yContact },
          origin: 'derived',
          sourceJointKind: 'dowel',
          description: `Wooden dowel face hole Ø${defaults.dowelFaceDiameterMm}x${defaults.dowelFaceDepthMm}mm`,
        });

        operations.push({
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceB.id,
          faceId: joint.b.faceId,
          faceType: 'edge',
          diameterMm: defaults.dowelEdgeDiameterMm,
          depthMm: defaults.dowelEdgeDepthMm,
          isThrough: false,
          positionMm: { x: off, y: pieceB.thicknessMm / 2 },
          origin: 'derived',
          sourceJointKind: 'dowel',
          description: `Wooden dowel edge hole Ø${defaults.dowelEdgeDiameterMm}x${defaults.dowelEdgeDepthMm}mm`,
        });
      }
    } else if (joint.kind === 'hinge') {
      // Piece A is Door, Piece B is Carcase Side
      const hingeY = joint.offsetMm ?? 100;

      // 1. On Door: 35mm cup hole
      operations.push({
        schemaVersion: 1,
        id: `op-drill-${opIndex++}`,
        pieceId: pieceA.id,
        faceId: joint.a.faceId,
        faceType: deriveFaceType(joint.a.faceId),
        diameterMm: defaults.hingeCupDiameterMm,
        depthMm: defaults.hingeCupDepthMm,
        isThrough: false,
        positionMm: { x: defaults.hingeCupEdgeSetbackMm, y: hingeY },
        origin: 'derived',
        sourceJointKind: 'hinge',
        description: `Concealed hinge cup Ø${defaults.hingeCupDiameterMm}x${defaults.hingeCupDepthMm}mm`,
      });

      // 2. On Carcase Side: 2 mounting plate holes in System 32 line
      operations.push(
        {
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceB.id,
          faceId: joint.b.faceId,
          faceType: deriveFaceType(joint.b.faceId),
          diameterMm: defaults.hingePlateDiameterMm,
          depthMm: defaults.hingePlateDepthMm,
          isThrough: false,
          positionMm: { x: defaults.hingePlateSetbackMm, y: hingeY - 16 },
          origin: 'derived',
          sourceJointKind: 'hinge',
          description: `Hinge mounting plate hole 1 Ø${defaults.hingePlateDiameterMm}x${defaults.hingePlateDepthMm}mm`,
        },
        {
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceB.id,
          faceId: joint.b.faceId,
          faceType: deriveFaceType(joint.b.faceId),
          diameterMm: defaults.hingePlateDiameterMm,
          depthMm: defaults.hingePlateDepthMm,
          isThrough: false,
          positionMm: { x: defaults.hingePlateSetbackMm, y: hingeY + 16 },
          origin: 'derived',
          sourceJointKind: 'hinge',
          description: `Hinge mounting plate hole 2 Ø${defaults.hingePlateDiameterMm}x${defaults.hingePlateDepthMm}mm`,
        },
      );
    } else if (joint.kind === 'shelf-pin') {
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
          diameterMm: defaults.shelfPinDiameterMm,
          depthMm: defaults.shelfPinDepthMm,
          isThrough: false,
          positionMm: { x: defaults.system32FrontSetbackMm, y: shelfY },
          origin: 'derived',
          sourceJointKind: 'shelf-pin',
          description: `Front shelf support pin Ø${defaults.shelfPinDiameterMm}x${defaults.shelfPinDepthMm}mm`,
        },
        {
          schemaVersion: 1,
          id: `op-drill-${opIndex++}`,
          pieceId: pieceA.id,
          faceId: joint.a.faceId,
          faceType: deriveFaceType(joint.a.faceId),
          diameterMm: defaults.shelfPinDiameterMm,
          depthMm: defaults.shelfPinDepthMm,
          isThrough: false,
          positionMm: { x: depthMm - defaults.system32FrontSetbackMm, y: shelfY },
          origin: 'derived',
          sourceJointKind: 'shelf-pin',
          description: `Rear shelf support pin Ø${defaults.shelfPinDiameterMm}x${defaults.shelfPinDepthMm}mm`,
        },
      );
    } else if (joint.kind === 'slide') {
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
          positionMm: { x: defaults.system32FrontSetbackMm, y: slideY },
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
          positionMm: { x: defaults.system32FrontSetbackMm + 192.0, y: slideY },
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
