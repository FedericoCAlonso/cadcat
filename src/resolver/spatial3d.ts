import type { Piece } from '../model';
import type { PlacementTree, Position3D } from './tree';

export interface SpatialPieceBox {
  pieceId: string;
  role: string;
  materialId: string;
  thicknessMm: number;
  positionMm: Position3D;
  sizeMm: Position3D;
  centerMm: Position3D;
}

export interface ModuleSpatialBounds {
  min: Position3D;
  max: Position3D;
  center: Position3D;
  size: Position3D;
}

export interface ExplodedPieceBox extends SpatialPieceBox {
  explodedPositionMm: Position3D;
  explodedOffsetMm: Position3D;
}

/**
 * Determine spatial dimensions (size along X, Y, Z in mm) from piece role, contour, and thickness.
 */
export function determinePieceSpatialSize(piece: Piece): Position3D {
  const t = piece.thicknessMm;
  const points = piece.contour.points;
  const w = Math.abs(points[1]?.x ?? 100);
  const h = Math.abs(points[2]?.y ?? 100);

  const role = piece.role.toLowerCase();

  // Vertical side & partition panels standing in YZ plane
  if ((role.includes('side') || role.includes('partition')) && !role.includes('rail')) {
    // Width along X is thickness. Height along Y is contour height. Depth along Z is contour width.
    return { x: t, y: h, z: w };
  }

  // Horizontal rails / stretchers in XZ plane
  if (role.includes('rail')) {
    return { x: w, y: t, z: h };
  }

  // Horizontal panels in XZ plane (bottom, shelf, top)
  if (role.includes('bottom') || role.includes('shelf') || role.includes('top')) {
    // Width along X is contour width. Thickness along Y is t. Depth along Z is contour height.
    return { x: w, y: t, z: h };
  }

  // Panels in XY plane (back, front, drawer-front, doors)
  return { x: w, y: h, z: t };
}

/**
 * Resolves 3D spatial bounding boxes for all pieces in a module.
 */
export function resolveModuleSpatialBoxes(
  pieces: Piece[],
  placementTree: PlacementTree,
): { boxes: SpatialPieceBox[]; bounds: ModuleSpatialBounds } {
  const positions = placementTree.resolvePositions();

  const boxes: SpatialPieceBox[] = [];

  for (const piece of pieces) {
    const rawPos = positions.get(piece.id) ?? { x: 0, y: 0, z: 0 };
    const size = determinePieceSpatialSize(piece);

    const center: Position3D = {
      x: rawPos.x + size.x / 2,
      y: rawPos.y + size.y / 2,
      z: rawPos.z + size.z / 2,
    };

    boxes.push({
      pieceId: piece.id,
      role: piece.role,
      materialId: piece.materialId,
      thicknessMm: piece.thicknessMm,
      positionMm: { ...rawPos },
      sizeMm: size,
      centerMm: center,
    });
  }

  // Calculate overall module bounding box
  if (boxes.length === 0) {
    const zero: Position3D = { x: 0, y: 0, z: 0 };
    return {
      boxes: [],
      bounds: { min: zero, max: zero, center: zero, size: zero },
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (const b of boxes) {
    minX = Math.min(minX, b.positionMm.x);
    minY = Math.min(minY, b.positionMm.y);
    minZ = Math.min(minZ, b.positionMm.z);
    maxX = Math.max(maxX, b.positionMm.x + b.sizeMm.x);
    maxY = Math.max(maxY, b.positionMm.y + b.sizeMm.y);
    maxZ = Math.max(maxZ, b.positionMm.z + b.sizeMm.z);
  }

  const bounds: ModuleSpatialBounds = {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
    center: {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      z: (minZ + maxZ) / 2,
    },
    size: {
      x: maxX - minX,
      y: maxY - minY,
      z: maxZ - minZ,
    },
  };

  return { boxes, bounds };
}

/**
 * Calculates exploded offsets and positions for all pieces.
 * Ratio is normalized between 0.0 (assembled) and 1.0 (fully exploded).
 */
export function calculateExplodedBoxes(
  boxes: SpatialPieceBox[],
  bounds: ModuleSpatialBounds,
  ratio: number,
  maxExplosionDistanceMm = 150,
): ExplodedPieceBox[] {
  const clampedRatio = Math.max(0, Math.min(1, ratio));

  return boxes.map((box) => {
    if (clampedRatio === 0) {
      return {
        ...box,
        explodedPositionMm: { ...box.positionMm },
        explodedOffsetMm: { x: 0, y: 0, z: 0 },
      };
    }

    const dist = clampedRatio * maxExplosionDistanceMm;
    const role = box.role.toLowerCase();

    let dx = 0;
    let dy = 0;
    let dz = 0;

    // Architectural explosion decomposition by furniture role
    if (role.includes('side-left') || role.includes('box-side-l')) {
      dx = -dist * 1.2;
    } else if (role.includes('side-right') || role.includes('box-side-r')) {
      dx = dist * 1.2;
    } else if (role.includes('bottom') && !role.includes('box-bottom')) {
      dy = -dist * 1.0;
    } else if (role.includes('shelf')) {
      // Displace slightly vertically or toward center
      dy = (box.centerMm.y > bounds.center.y ? 0.3 : -0.3) * dist;
    } else if (role.includes('rail-front')) {
      dz = dist * 0.8;
      dy = dist * 0.8;
    } else if (role.includes('rail-back')) {
      dz = -dist * 0.8;
      dy = dist * 0.8;
    } else if (role.includes('back') && !role.includes('box-back')) {
      dz = -dist * 1.4;
    } else if (role.includes('drawer-front')) {
      dz = dist * 2.0;
    } else if (role.includes('door')) {
      dz = dist * 1.8;
      if (role.includes('left')) dx = -dist * 0.4;
      if (role.includes('right')) dx = dist * 0.4;
    } else if (role.includes('partition')) {
      dx = 0;
    } else if (role.startsWith('drawer-') || role.includes('box-')) {
      // Internal drawer box elements slide forward together
      dz = dist * 1.5;
    } else {
      // Fallback: outward vector from bounding center
      const vx = box.centerMm.x - bounds.center.x;
      const vy = box.centerMm.y - bounds.center.y;
      const vz = box.centerMm.z - bounds.center.z;
      const length = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
      dx = (vx / length) * dist;
      dy = (vy / length) * dist;
      dz = (vz / length) * dist;
    }

    const offset: Position3D = {
      x: Math.round(dx * 10) / 10,
      y: Math.round(dy * 10) / 10,
      z: Math.round(dz * 10) / 10,
    };

    return {
      ...box,
      explodedPositionMm: {
        x: box.positionMm.x + offset.x,
        y: box.positionMm.y + offset.y,
        z: box.positionMm.z + offset.z,
      },
      explodedOffsetMm: offset,
    };
  });
}
