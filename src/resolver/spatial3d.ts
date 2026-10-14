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
  if (
    (role.includes('side') || role.includes('partition') || role === 'tray-lip-side') &&
    !role.includes('rail') &&
    !role.includes('drawer-box-front') &&
    !role.includes('drawer-box-back')
  ) {
    // Width along X is thickness. Height along Y is contour height. Depth along Z is contour width.
    return { x: t, y: h, z: w };
  }

  // Vertical panels standing in XY plane (vertical rails, hanging rail, plinth/zócalo)
  if (
    role.includes('rail-vertical') ||
    role.includes('hanging-rail') ||
    role.includes('plinth')
  ) {
    return { x: w, y: h, z: t };
  }

  // Cross brace running front-to-back in XZ plane
  if (role.includes('brace-middle')) {
    return { x: h, y: t, z: w };
  }

  // Horizontal rails / stretchers / transoms in XZ plane
  if (role.includes('rail') || role.includes('transom')) {
    return { x: w, y: t, z: h };
  }

  // Horizontal panels in XZ plane (bottom, shelf, top, tray-bottom)
  if (
    role.includes('bottom') ||
    role.includes('shelf') ||
    role.includes('top') ||
    role === 'tray-bottom'
  ) {
    // Width along X is contour width. Thickness along Y is t. Depth along Z is contour height.
    return { x: w, y: t, z: h };
  }

  // Panels in XY plane (back, front, drawer-front, doors, bifold-leaf, shelf-brace, tray-lip-front, tray-lip-back)
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
      dz = -dist * 0.8;
      dy = dist * 0.8;
    } else if (role.includes('rail-back')) {
      dz = dist * 0.8;
      dy = dist * 0.8;
    } else if (role.includes('back') && !role.includes('box-back')) {
      dz = dist * 1.4;
    } else if (role.includes('drawer-front')) {
      dz = -dist * 2.0;
    } else if (role.includes('door')) {
      dz = -dist * 1.8;
      if (role.includes('left')) dx = -dist * 0.4;
      if (role.includes('right')) dx = dist * 0.4;
    } else if (role.includes('partition')) {
      dx = 0;
    } else if (role.startsWith('drawer-') || role.includes('box-')) {
      // Internal drawer box elements slide forward together
      dz = -dist * 1.5;
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

export interface KinematicMechanism {
  id: string;
  name: string;
  kind: 'drawer' | 'door-left' | 'door-right' | 'tray' | 'lift-flap' | 'bifold';
  pieceIds: string[];
  travelMm?: number;
}

export interface KinematicPieceBox extends SpatialPieceBox {
  kinematicPositionMm: Position3D;
  kinematicRotationRad: Position3D;
  mechanismId?: string;
}

/**
 * Identifies mobile kinematic mechanisms (drawers, doors, pull-out trays, flaps, bi-fold)
 * from pieces and their spatial positions.
 */
export function identifyKinematicMechanisms(boxes: SpatialPieceBox[]): KinematicMechanism[] {
  const mechanisms: KinematicMechanism[] = [];
  const drawerGroups = new Map<string, string[]>();
  const trayGroups = new Map<string, string[]>();
  const bifoldGroups = new Map<string, string[]>();

  for (const box of boxes) {
    const role = box.role.toLowerCase();
    const id = box.pieceId;

    // 1. Drawers (cajones) - group per individual drawer using index
    if (role.includes('drawer') || role.includes('box-')) {
      const match =
        id.match(/^(.*?drawer(?:-stack)?)(?:-[a-z-]+)?-(\d+)$/i) ||
        id.match(/^(.*?drawer.*?)-(\d+)(?:-[a-z-]+)?$/i) ||
        id.match(/^(.*?)-(\d+)$/);

      const groupKey = match ? `${match[1]}-${match[2]}` : (id.match(/(.*drawer[^-]*)/i)?.[1] ?? id);
      const list = drawerGroups.get(groupKey) ?? [];
      list.push(id);
      drawerGroups.set(groupKey, list);
      continue;
    }

    // 2. Trays (bandejas extraíbles)
    if (role.includes('tray')) {
      const match = id.match(/^(.*?tray)(?:-[a-z-]+)?-(\d+)$/i) || id.match(/^(.*?)-(\d+)$/);
      const groupKey = match ? `${match[1]}-${match[2]}` : id;
      const list = trayGroups.get(groupKey) ?? [];
      list.push(id);
      trayGroups.set(groupKey, list);
      continue;
    }

    // 3. Doors (puertas)
    if (role.includes('door')) {
      const isRight = id.endsWith('-r') || id.includes('right');
      const isLeft = id.endsWith('-l') || id.includes('left') || !isRight;
      mechanisms.push({
        id,
        name: isRight
          ? 'Puerta Derecha'
          : isLeft && boxes.some((b) => b.pieceId.endsWith('-r'))
          ? 'Puerta Izquierda'
          : 'Puerta',
        kind: isRight ? 'door-right' : 'door-left',
        pieceIds: [id],
      });
      continue;
    }

    // 4. Bi-fold closures (tapas plegables elevables)
    if (role.includes('bifold') || role.includes('leaf')) {
      const groupKey = id.replace(/-leaf-\d+$/i, '') || 'bifold-closure';
      const list = bifoldGroups.get(groupKey) ?? [];
      list.push(id);
      bifoldGroups.set(groupKey, list);
      continue;
    }

    // 5. Generic single lift flaps
    if (role.includes('flap')) {
      mechanisms.push({
        id,
        name: 'Tapa Elevable',
        kind: 'lift-flap',
        pieceIds: [id],
      });
    }
  }

  // Add individual drawer mechanisms
  let drawerNum = 1;
  for (const [key, pieceIds] of drawerGroups.entries()) {
    mechanisms.push({
      id: key,
      name: `Cajón ${drawerNum++}`,
      kind: 'drawer',
      pieceIds,
      travelMm: 320,
    });
  }

  // Add gathered tray mechanisms
  let trayNum = 1;
  for (const [key, pieceIds] of trayGroups.entries()) {
    mechanisms.push({
      id: key,
      name: `Bandeja Extraíble ${trayNum++}`,
      kind: 'tray',
      pieceIds,
      travelMm: 280,
    });
  }

  // Add bi-fold mechanisms
  let bifoldNum = 1;
  for (const [key, pieceIds] of bifoldGroups.entries()) {
    mechanisms.push({
      id: key,
      name: bifoldGroups.size > 1 ? `Apertura Bi-Fold ${bifoldNum++}` : 'Apertura Bi-Fold',
      kind: 'bifold',
      pieceIds,
    });
  }

  return mechanisms;
}

/**
 * Calculates positions and rotations for pieces based on kinematics state.
 * kinematicsState is a map from mechanismId to openRatio (0.0 = closed, 1.0 = fully open).
 */
export function calculateKinematicBoxes(
  boxes: SpatialPieceBox[],
  mechanisms: KinematicMechanism[],
  kinematicsState: Record<string, number>,
): KinematicPieceBox[] {
  const pieceMechMap = new Map<string, { mech: KinematicMechanism; ratio: number }>();
  for (const m of mechanisms) {
    const ratio = Math.max(0, Math.min(1, kinematicsState[m.id] ?? 0));
    for (const pId of m.pieceIds) {
      pieceMechMap.set(pId, { mech: m, ratio });
    }
  }

  return boxes.map((box) => {
    const entry = pieceMechMap.get(box.pieceId);
    if (!entry || entry.ratio === 0) {
      return {
        ...box,
        kinematicPositionMm: { ...box.positionMm },
        kinematicRotationRad: { x: 0, y: 0, z: 0 },
        mechanismId: entry?.mech.id,
      };
    }

    const { mech, ratio } = entry;
    let dx = 0;
    let dy = 0;
    let dz = 0;
    let rx = 0;
    let ry = 0;
    let rz = 0;

    if (mech.kind === 'drawer' || mech.kind === 'tray') {
      const travel = mech.travelMm ?? 300;
      dz = -ratio * travel;
    } else if (mech.kind === 'door-left') {
      // Swings outward toward user (-Z) around left edge hinge (x = -w/2, z = +t/2)
      const angle = ratio * (Math.PI / 2 + 0.15); // ~100 degrees open
      ry = angle;
      const w = box.sizeMm.x;
      const t = box.sizeMm.z;
      dx = (-w / 2) * (1 - Math.cos(angle)) - (t / 2) * Math.sin(angle);
      dz = (t / 2) * (1 - Math.cos(angle)) - (w / 2) * Math.sin(angle);
    } else if (mech.kind === 'door-right') {
      // Swings outward toward user (-Z) around right edge hinge (x = +w/2, z = +t/2)
      const angle = ratio * (Math.PI / 2 + 0.15);
      ry = -angle;
      const w = box.sizeMm.x;
      const t = box.sizeMm.z;
      dx = (w / 2) * (1 - Math.cos(angle)) + (t / 2) * Math.sin(angle);
      dz = (t / 2) * (1 - Math.cos(angle)) - (w / 2) * Math.sin(angle);
    } else if (mech.kind === 'lift-flap') {
      // Swings outward & upward around top edge hinge (y = +h/2, z = +t/2)
      const angle = ratio * (Math.PI / 2);
      rx = angle;
      const h = box.sizeMm.y;
      const t = box.sizeMm.z;
      dy = (h / 2) * (1 - Math.cos(angle)) + (t / 2) * Math.sin(angle);
      dz = (t / 2) * (1 - Math.cos(angle)) - (h / 2) * Math.sin(angle);
    } else if (mech.kind === 'bifold') {
      // Coordinated two-leaf lift (e.g. Aventos HF)
      const isLeaf1 = box.pieceId.endsWith('leaf-1') || box.pieceId.includes('-1');
      const angle1 = ratio * 1.15; // Upper leaf rises ~65 degrees
      const h = box.sizeMm.y;
      const t = box.sizeMm.z;

      if (isLeaf1) {
        rx = angle1;
        dy = (h / 2) * (1 - Math.cos(angle1)) + (t / 2) * Math.sin(angle1);
        dz = (t / 2) * (1 - Math.cos(angle1)) - (h / 2) * Math.sin(angle1);
      } else {
        // Lower leaf follows intermediate hinge of leaf 1, folding forward
        rx = ratio * 0.25;
        const leaf1DispY = h * (1 - Math.cos(angle1));
        const leaf1DispZ = -h * Math.sin(angle1);
        dy = leaf1DispY + (h / 2) * (1 - Math.cos(rx));
        dz = leaf1DispZ - (h / 2) * Math.sin(rx);
      }
    }

    return {
      ...box,
      kinematicPositionMm: {
        x: Math.round((box.positionMm.x + dx) * 10) / 10,
        y: Math.round((box.positionMm.y + dy) * 10) / 10,
        z: Math.round((box.positionMm.z + dz) * 10) / 10,
      },
      kinematicRotationRad: {
        x: Math.round(rx * 1000) / 1000,
        y: Math.round(ry * 1000) / 1000,
        z: Math.round(rz * 1000) / 1000,
      },
      mechanismId: mech.id,
    };
  });
}
