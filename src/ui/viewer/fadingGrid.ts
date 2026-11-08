import * as THREE from 'three';
import type { ModuleSpatialBounds } from '../../resolver';
import { DEFAULT_UI_CONFIG } from '../../config';

/**
 * Configuration options for the fading floor grid.
 */
export interface FadingGridOptions {
  /** Maximum grid line intensity / opacity [0..1] (defaults to config gridIntensity). */
  intensity?: number;
  /** Power exponent controlling how fast lines fade toward the perimeter (defaults to config gridFadeFalloff). */
  fadeFalloff?: number;
  /** Number of grid cells along each axis (defaults to config gridDivisions). */
  divisions?: number;
  /** Multiplier applied to the module's maximum dimension to determine grid diameter (defaults to config gridSizeFactor). */
  sizeFactor?: number;
  /** Theme mode to select base grid line color ('dark' | 'light'). */
  theme?: 'dark' | 'light';
  /** Custom hex color override for grid lines. */
  customColor?: number;
}

/** Theme-based default line colors. */
export const GRID_THEME_COLORS = {
  dark: 0x56705f, // Muted sage/slate green
  light: 0x94a3b8, // Light slate gray
} as const;

/**
 * Creates a Three.js LineSegments grid whose lines fade smoothly toward the edges.
 *
 * The grid size is dynamically calculated from the module bounding box so that it
 * naturally accommodates small wall cabinets and large floor-to-ceiling wardrobes alike.
 *
 * @param bounds Current module spatial bounds.
 * @param options Grid customization options.
 * @returns A THREE.LineSegments object positioned at module base elevation.
 */
export function createFadingGrid(
  bounds: ModuleSpatialBounds,
  options?: FadingGridOptions,
): THREE.LineSegments {
  const intensity = options?.intensity ?? DEFAULT_UI_CONFIG.gridIntensity ?? 0.18;
  const fadeFalloff = options?.fadeFalloff ?? DEFAULT_UI_CONFIG.gridFadeFalloff ?? 0.85;
  const divisions = options?.divisions ?? DEFAULT_UI_CONFIG.gridDivisions ?? 20;
  const sizeFactor = options?.sizeFactor ?? DEFAULT_UI_CONFIG.gridSizeFactor ?? 2.5;
  const theme = options?.theme ?? 'dark';

  const baseHex = options?.customColor ?? (theme === 'light' ? GRID_THEME_COLORS.light : GRID_THEME_COLORS.dark);
  const baseColor = new THREE.Color(baseHex);

  // Grid size follows module size, with a minimum size of 1500 mm for small cabinets
  const maxDim = Math.max(bounds.size.x, bounds.size.z, 600);
  const gridSize = Math.max(1500, maxDim * sizeFactor);
  const halfSize = gridSize / 2;
  const step = gridSize / divisions;

  // Each line is subdivided into segments to allow smooth per-vertex radial color fading
  const segmentsPerLine = divisions;
  const segmentStep = gridSize / segmentsPerLine;

  const positions: number[] = [];
  const colors: number[] = [];

  const addPoint = (x: number, z: number) => {
    positions.push(x, 0, z);
    const r = Math.hypot(x, z);
    const u = Math.min(1.0, r / halfSize);
    const fade = Math.max(0, 1.0 - Math.pow(u, fadeFalloff));
    colors.push(baseColor.r * fade, baseColor.g * fade, baseColor.b * fade);
  };

  // 1. Grid lines parallel to Z axis (varying X)
  for (let i = 0; i <= divisions; i++) {
    const x = -halfSize + i * step;
    for (let j = 0; j < segmentsPerLine; j++) {
      const z1 = -halfSize + j * segmentStep;
      const z2 = z1 + segmentStep;
      addPoint(x, z1);
      addPoint(x, z2);
    }
  }

  // 2. Grid lines parallel to X axis (varying Z)
  for (let i = 0; i <= divisions; i++) {
    const z = -halfSize + i * step;
    for (let j = 0; j < segmentsPerLine; j++) {
      const x1 = -halfSize + j * segmentStep;
      const x2 = x1 + segmentStep;
      addPoint(x1, z);
      addPoint(x2, z);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const material = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: intensity,
    depthWrite: false,
  });

  const grid = new THREE.LineSegments(geometry, material);
  grid.name = 'FadingGridFloor';
  grid.position.set(bounds.center.x, bounds.min.y, bounds.center.z);

  return grid;
}

/**
 * Safely disposes geometry and material of a fading grid instance to prevent memory leaks.
 *
 * @param grid The THREE.LineSegments grid to dispose.
 */
export function disposeFadingGrid(grid: THREE.LineSegments | null | undefined): void {
  if (!grid) return;
  if (grid.geometry) {
    grid.geometry.dispose();
  }
  if (Array.isArray(grid.material)) {
    grid.material.forEach((m) => m.dispose());
  } else if (grid.material) {
    grid.material.dispose();
  }
}
