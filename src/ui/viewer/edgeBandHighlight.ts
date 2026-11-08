import * as THREE from 'three';
import type { SpatialPieceBox, ResolvedPieceWithCutSize, PieceEdgeBandOverride } from '../../resolver';
import { resolvePieceOrientation } from '../../resolver/spatial3d';
import { DEFAULT_UI_CONFIG } from '../../config';

/**
 * Summary flags indicating which edges of a panel have edge banding.
 */
export interface ResolvedBandedEdges {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

/**
 * Pure function that determines which edges of a piece have edge banding applied,
 * combining the resolved piece banded edges and any piece-level edge band overrides.
 *
 * @param piece Resolved piece with cut size and banded edges list, if available.
 * @param override Optional user overrides for this specific piece.
 * @returns Object with boolean flags for top, bottom, left, and right edges.
 */
export function resolvePieceBandedEdges(
  piece?: ResolvedPieceWithCutSize | null,
  override?: PieceEdgeBandOverride | null,
): ResolvedBandedEdges {
  const result: ResolvedBandedEdges = {
    top: false,
    bottom: false,
    left: false,
    right: false,
  };

  if (!piece && !override) return result;

  // 1. Inspect piece's bandedEdges list (standard resolution from cut size)
  if (piece?.bandedEdges && Array.isArray(piece.bandedEdges)) {
    for (const b of piece.bandedEdges) {
      const fId = b.faceId.toLowerCase();
      if (fId.includes('top')) result.top = true;
      if (fId.includes('bottom')) result.bottom = true;
      if (fId.includes('left')) result.left = true;
      if (fId.includes('right')) result.right = true;
    }
  }

  // 2. Inspect piece's faces array if bandedEdges was empty
  if (!result.top && !result.bottom && !result.left && !result.right && piece?.faces) {
    for (const f of piece.faces) {
      if (f.edgeBandId) {
        const fId = f.id.toLowerCase();
        if (fId.includes('top')) result.top = true;
        if (fId.includes('bottom')) result.bottom = true;
        if (fId.includes('left')) result.left = true;
        if (fId.includes('right')) result.right = true;
      }
    }
  }

  // 3. Apply user-defined piece overrides with priority if present
  if (override) {
    if (typeof override.top === 'boolean') result.top = override.top;
    if (typeof override.bottom === 'boolean') result.bottom = override.bottom;
    if (typeof override.left === 'boolean') result.left = override.left;
    if (typeof override.right === 'boolean') result.right = override.right;
  }

  return result;
}

/**
 * Resolves the numeric color for edge band highlights from config based on active theme.
 *
 * @param theme Active UI theme ('light' or 'dark').
 * @returns Hex numeric color.
 */
export function resolveEdgeBandHighlightColor(theme: 'light' | 'dark' = 'light'): number {
  const hex = theme === 'dark'
    ? (DEFAULT_UI_CONFIG.edgeBandHighlightColor?.dark ?? '#FF4081')
    : (DEFAULT_UI_CONFIG.edgeBandHighlightColor?.light ?? '#E91E63');
  return parseInt(hex.replace('#', ''), 16);
}

export interface EffectiveEdgeBandThicknessParams {
  physicalThicknessMm?: number;
  cameraDistanceMm?: number;
  viewportHeightPx?: number;
  fovDegrees?: number;
  minScreenPx?: number;
}

/**
 * Calculates the visual world thickness for edge band ribbons, ensuring a minimum width
 * in screen space (pixels) when viewed at a distance, while preserving the real physical
 * tape thickness when the camera is close.
 *
 * @param params Calculation parameters.
 * @returns Thickness in millimeters for ribbon box geometry.
 */
export function calculateEffectiveEdgeBandThicknessMm(
  params: EffectiveEdgeBandThicknessParams = {},
): number {
  const physical = params.physicalThicknessMm ?? DEFAULT_UI_CONFIG.edgeBandPhysicalThicknessMm ?? 1.2;
  const minPx = params.minScreenPx ?? DEFAULT_UI_CONFIG.minEdgeBandScreenPx ?? 2.5;
  const dist = params.cameraDistanceMm;
  const vh = params.viewportHeightPx;
  const fov = params.fovDegrees ?? 45;

  if (!dist || !vh || vh <= 0 || dist <= 0) {
    return physical;
  }

  const fovRad = (fov * Math.PI) / 180;
  const frustumHeightMm = 2 * dist * Math.tan(fovRad / 2);
  const mmPerPx = frustumHeightMm / vh;
  const minRequiredMm = minPx * mmPerPx;

  return Math.max(physical, minRequiredMm);
}

/**
 * Builds a Three.js Group containing 3D highlight ribbons/strips for all banded edges
 * of a spatial piece box.
 *
 * The geometry is created in the local box coordinates of the piece (centered at (0, 0, 0))
 * so that when attached as a child of the piece mesh, it automatically inherits:
 * - The mirrored pieceGroup transform (`scale.x = -1`)
 * - The piece's 3D rotation, world position, and exploded view displacement
 * - Kinematic mechanism opening (drawers sliding, doors swinging)
 *
 * @param item Spatial piece box defining dimensions (x, y, z) and semantic role.
 * @param bandedEdges Flags indicating which of the 4 edges are banded.
 * @param color Highlight color for the edge band ribbons.
 * @param ribbonThicknessMm Visual thickness in mm (enforces minimum screen pixels when distant).
 * @returns Three.js Group named 'edgeband-group'.
 */
export function buildPieceEdgeBandHighlightGroup(
  item: SpatialPieceBox,
  bandedEdges: ResolvedBandedEdges,
  color: number,
  ribbonThicknessMm: number = DEFAULT_UI_CONFIG.edgeBandPhysicalThicknessMm ?? 1.2,
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'edgeband-group';

  if (!bandedEdges.top && !bandedEdges.bottom && !bandedEdges.left && !bandedEdges.right) {
    return group;
  }

  const { x: sx, y: sy, z: sz } = item.sizeMm;
  const orientation = resolvePieceOrientation(item.role);

  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.35,
    metalness: 0.1,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const marginMm = 0.2; // Slight offset to prevent coplanar z-fighting

  const addEdgeBox = (
    centerX: number,
    centerY: number,
    centerZ: number,
    sizeX: number,
    sizeY: number,
    sizeZ: number,
  ) => {
    const geom = new THREE.BoxGeometry(sizeX, sizeY, sizeZ);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(centerX, centerY, centerZ);
    mesh.name = 'edgeband-strip';
    group.add(mesh);
  };

  // 1. Panels standing in YZ plane (vertical sides, partitions)
  // Orientation: { x: 'thickness', y: 'height', z: 'width' }
  if (orientation.x === 'thickness' && orientation.y === 'height' && orientation.z === 'width') {
    if (bandedEdges.bottom) {
      // Bottom edge: along Y = -sy / 2
      addEdgeBox(0, -sy / 2 - ribbonThicknessMm / 2 + marginMm, 0, sx + marginMm, ribbonThicknessMm, sz + marginMm);
    }
    if (bandedEdges.top) {
      // Top edge: along Y = +sy / 2
      addEdgeBox(0, sy / 2 + ribbonThicknessMm / 2 - marginMm, 0, sx + marginMm, ribbonThicknessMm, sz + marginMm);
    }
    if (bandedEdges.left) {
      // Front edge (z = -sz / 2 in model coordinates)
      addEdgeBox(0, 0, -sz / 2 - ribbonThicknessMm / 2 + marginMm, sx + marginMm, sy + marginMm, ribbonThicknessMm);
    }
    if (bandedEdges.right) {
      // Rear edge (z = +sz / 2 in model coordinates)
      addEdgeBox(0, 0, sz / 2 + ribbonThicknessMm / 2 - marginMm, sx + marginMm, sy + marginMm, ribbonThicknessMm);
    }
    return group;
  }

  // 2. Horizontal panels in XZ plane (bottom, shelves, top, rails)
  // Orientation: { x: 'width', y: 'thickness', z: 'height' }
  if (orientation.x === 'width' && orientation.y === 'thickness' && orientation.z === 'height') {
    if (bandedEdges.bottom) {
      // Front edge (z = -sz / 2)
      addEdgeBox(0, 0, -sz / 2 - ribbonThicknessMm / 2 + marginMm, sx + marginMm, sy + marginMm, ribbonThicknessMm);
    }
    if (bandedEdges.top) {
      // Rear edge (z = +sz / 2)
      addEdgeBox(0, 0, sz / 2 + ribbonThicknessMm / 2 - marginMm, sx + marginMm, sy + marginMm, ribbonThicknessMm);
    }
    if (bandedEdges.left) {
      // Left edge (x = -sx / 2)
      addEdgeBox(-sx / 2 - ribbonThicknessMm / 2 + marginMm, 0, 0, ribbonThicknessMm, sy + marginMm, sz + marginMm);
    }
    if (bandedEdges.right) {
      // Right edge (x = +sx / 2)
      addEdgeBox(sx / 2 + ribbonThicknessMm / 2 - marginMm, 0, 0, ribbonThicknessMm, sy + marginMm, sz + marginMm);
    }
    return group;
  }

  // 3. Vertical panels in XY plane (doors, drawer fronts, backs, plinths)
  // Orientation: { x: 'width', y: 'height', z: 'thickness' }
  if (bandedEdges.bottom) {
    addEdgeBox(0, -sy / 2 - ribbonThicknessMm / 2 + marginMm, 0, sx + marginMm, ribbonThicknessMm, sz + marginMm);
  }
  if (bandedEdges.top) {
    addEdgeBox(0, sy / 2 + ribbonThicknessMm / 2 - marginMm, 0, sx + marginMm, ribbonThicknessMm, sz + marginMm);
  }
  if (bandedEdges.left) {
    addEdgeBox(-sx / 2 - ribbonThicknessMm / 2 + marginMm, 0, 0, ribbonThicknessMm, sy + marginMm, sz + marginMm);
  }
  if (bandedEdges.right) {
    addEdgeBox(sx / 2 + ribbonThicknessMm / 2 - marginMm, 0, 0, ribbonThicknessMm, sy + marginMm, sz + marginMm);
  }

  return group;
}
