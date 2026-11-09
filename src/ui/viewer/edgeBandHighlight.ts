import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
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

export interface BuildPieceEdgeBandHighlightOptions {
  /**
   * Rendering style for edge bands:
   * - 'line': Renders a thin line of constant screen pixel width along the outer rim.
   * - 'face': Renders a full 3D solid ribbon face covering the entire edge thickness.
   * Defaults to DEFAULT_UI_CONFIG.edgeBandHighlightStyle ('line').
   */
  style?: 'line' | 'face';
  /** Visual thickness in mm when style is 'face' (defaults to physical 1.2 mm or calculated effective thickness). */
  ribbonThicknessMm?: number;
  /** Width in screen pixels when style is 'line' (defaults to 2 px, max 3 px). */
  lineWidthPx?: number;
  /** Viewport resolution { width, height } in pixels for line shaders. */
  viewportResolution?: { width: number; height: number };
}

/**
 * Builds a Three.js Group containing 3D highlight ribbons/strips for all banded edges
 * of a spatial piece box.
 *
 * Supports two rendering styles:
 * - 'line': Renders a constant-width line in screen pixels along the outer rim of the face
 *   using LineSegments2 and LineMaterial, ensuring gaps between drawer fronts remain visible.
 * - 'face': Paints the full edge thickness face with a 3D ribbon box (Stage 8 realistic mode).
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
 * @param ribbonThicknessOrOptions Visual thickness in mm or options object.
 * @param options Additional highlight rendering options.
 * @returns Three.js Group named 'edgeband-group'.
 */
export function buildPieceEdgeBandHighlightGroup(
  item: SpatialPieceBox,
  bandedEdges: ResolvedBandedEdges,
  color: number,
  ribbonThicknessOrOptions?: number | BuildPieceEdgeBandHighlightOptions,
  options?: BuildPieceEdgeBandHighlightOptions,
): THREE.Group {
  let ribbonThicknessMm = DEFAULT_UI_CONFIG.edgeBandPhysicalThicknessMm ?? 1.2;
  let opts: BuildPieceEdgeBandHighlightOptions | undefined;

  if (typeof ribbonThicknessOrOptions === 'number') {
    ribbonThicknessMm = ribbonThicknessOrOptions;
    opts = options;
  } else if (typeof ribbonThicknessOrOptions === 'object' && ribbonThicknessOrOptions !== null) {
    opts = ribbonThicknessOrOptions;
    if (opts.ribbonThicknessMm !== undefined) {
      ribbonThicknessMm = opts.ribbonThicknessMm;
    }
  } else {
    opts = options;
  }

  const style = opts?.style ?? DEFAULT_UI_CONFIG.edgeBandHighlightStyle ?? 'line';
  const lineWidthPx = Math.min(3, Math.max(1, opts?.lineWidthPx ?? DEFAULT_UI_CONFIG.edgeBandLineWidthPx ?? 2));
  const resW = opts?.viewportResolution?.width ?? 800;
  const resH = opts?.viewportResolution?.height ?? 600;

  const group = new THREE.Group();
  group.name = 'edgeband-group';

  if (!bandedEdges.top && !bandedEdges.bottom && !bandedEdges.left && !bandedEdges.right) {
    return group;
  }

  const { x: sx, y: sy, z: sz } = item.sizeMm;
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const orientation = resolvePieceOrientation(item.role);

  if (style === 'line') {
    const lineMat = new LineMaterial({
      color,
      linewidth: lineWidthPx,
      resolution: new THREE.Vector2(resW, resH),
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      depthTest: true,
    });

    const addEdgeLine = (
      x1: number,
      y1: number,
      z1: number,
      x2: number,
      y2: number,
      z2: number,
    ) => {
      const geom = new LineSegmentsGeometry();
      geom.setPositions([x1, y1, z1, x2, y2, z2]);
      const line = new LineSegments2(geom, lineMat);
      line.name = 'edgeband-strip';
      group.add(line);
    };

    // 1. Panels standing in YZ plane (vertical sides, partitions)
    if (orientation.x === 'thickness' && orientation.y === 'height' && orientation.z === 'width') {
      const extX = (item.role.includes('right') || item.pieceId.includes('side-r')) ? hx : -hx;
      if (bandedEdges.left) {
        // Front edge (z = -hz)
        addEdgeLine(extX, -hy, -hz, extX, +hy, -hz);
      }
      if (bandedEdges.right) {
        // Rear edge (z = +hz)
        addEdgeLine(extX, -hy, +hz, extX, +hy, +hz);
      }
      if (bandedEdges.bottom) {
        // Bottom edge (y = -hy)
        addEdgeLine(extX, -hy, -hz, extX, -hy, +hz);
      }
      if (bandedEdges.top) {
        // Top edge (y = +hy)
        addEdgeLine(extX, +hy, -hz, extX, +hy, +hz);
      }
      return group;
    }

    // 2. Horizontal panels in XZ plane (bottom, shelves, top, rails)
    if (orientation.x === 'width' && orientation.y === 'thickness' && orientation.z === 'height') {
      const extY = item.role.includes('bottom') ? -hy : hy;
      if (bandedEdges.bottom) {
        // Front edge (z = -hz)
        addEdgeLine(-hx, extY, -hz, hx, extY, -hz);
      }
      if (bandedEdges.top) {
        // Rear edge (z = +hz)
        addEdgeLine(-hx, extY, +hz, hx, extY, +hz);
      }
      if (bandedEdges.left) {
        // Left edge (x = -hx)
        addEdgeLine(-hx, extY, -hz, -hx, extY, +hz);
      }
      if (bandedEdges.right) {
        // Right edge (x = +hx)
        addEdgeLine(hx, extY, -hz, hx, extY, +hz);
      }
      return group;
    }

    // 3. Vertical panels in XY plane (doors, drawer fronts, backs, plinths)
    const extZ = -hz; // Front visible exterior surface
    if (bandedEdges.top) {
      // Top edge (y = +hy)
      addEdgeLine(-hx, hy, extZ, hx, hy, extZ);
    }
    if (bandedEdges.bottom) {
      // Bottom edge (y = -hy)
      addEdgeLine(-hx, -hy, extZ, hx, -hy, extZ);
    }
    if (bandedEdges.left) {
      // Left edge (x = -hx)
      addEdgeLine(-hx, -hy, extZ, -hx, hy, extZ);
    }
    if (bandedEdges.right) {
      // Right edge (x = +hx)
      addEdgeLine(hx, -hy, extZ, hx, hy, extZ);
    }

    return group;
  }

  // Fallback / alternative style: 'face' (full 3D box ribbon covering entire edge face)
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
