import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  createFadingGrid,
  disposeFadingGrid,
} from '../src/ui/viewer/fadingGrid';
import type { ModuleSpatialBounds } from '../src/resolver';
import { DEFAULT_UI_CONFIG } from '../src/config';

describe('Stage 5 Step A: fadingGrid Component & Memory Lifecycle', () => {
  const sampleBounds: ModuleSpatialBounds = {
    min: { x: 0, y: 0, z: 0 },
    max: { x: 600, y: 800, z: 560 },
    center: { x: 300, y: 400, z: 280 },
    size: { x: 600, y: 800, z: 560 },
  };

  it('creates a LineSegments grid positioned at the bottom of the module', () => {
    const grid = createFadingGrid(sampleBounds);

    expect(grid).toBeInstanceOf(THREE.LineSegments);
    expect(grid.position.x).toBe(sampleBounds.center.x);
    expect(grid.position.y).toBe(sampleBounds.min.y);
    expect(grid.position.z).toBe(sampleBounds.center.z);

    const mat = grid.material as THREE.LineBasicMaterial;
    expect(mat.vertexColors).toBe(true);
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBeCloseTo(DEFAULT_UI_CONFIG.gridIntensity ?? 0.18, 2);

    disposeFadingGrid(grid);
  });

  it('grid size scales with module size according to configured gridSizeFactor', () => {
    const smallBounds: ModuleSpatialBounds = {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 400, y: 400, z: 300 },
      center: { x: 200, y: 200, z: 150 },
      size: { x: 400, y: 400, z: 300 },
    };

    const largeBounds: ModuleSpatialBounds = {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 2000, y: 2400, z: 600 },
      center: { x: 1000, y: 1200, z: 300 },
      size: { x: 2000, y: 2400, z: 600 },
    };

    const smallGrid = createFadingGrid(smallBounds);
    const largeGrid = createFadingGrid(largeBounds);

    const smallGeom = smallGrid.geometry;
    const largeGeom = largeGrid.geometry;

    smallGeom.computeBoundingBox();
    largeGeom.computeBoundingBox();

    const smallBox = smallGeom.boundingBox!;
    const largeBox = largeGeom.boundingBox!;

    const smallSpan = smallBox.max.x - smallBox.min.x;
    const largeSpan = largeBox.max.x - largeBox.min.x;

    // Large grid span should be significantly wider than small grid span
    expect(largeSpan).toBeGreaterThan(smallSpan);
    // Large grid span should match maxDim * sizeFactor (2000 * 2.5 = 5000)
    expect(largeSpan).toBeCloseTo(2000 * (DEFAULT_UI_CONFIG.gridSizeFactor ?? 2.5), 0);

    disposeFadingGrid(smallGrid);
    disposeFadingGrid(largeGrid);
  });

  it('fades vertex colors radially from center toward the outer perimeter', () => {
    const grid = createFadingGrid(sampleBounds, { divisions: 20, fadeFalloff: 1.0 });
    const posAttr = grid.geometry.getAttribute('position') as THREE.BufferAttribute;
    const colAttr = grid.geometry.getAttribute('color') as THREE.BufferAttribute;

    expect(posAttr).toBeDefined();
    expect(colAttr).toBeDefined();

    let centerColorIntensity = 0;
    let edgeColorIntensity = 1;

    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      const dist = Math.hypot(x, z);

      const r = colAttr.getX(i);
      const g = colAttr.getY(i);
      const b = colAttr.getZ(i);
      const intensity = Math.max(r, g, b);

      if (dist < 10) {
        centerColorIntensity = Math.max(centerColorIntensity, intensity);
      }
      if (dist > 900) {
        edgeColorIntensity = Math.min(edgeColorIntensity, intensity);
      }
    }

    // Near center, intensity should be positive and non-zero
    expect(centerColorIntensity).toBeGreaterThan(0.05);
    // At outer perimeter, intensity should have faded down toward zero
    expect(edgeColorIntensity).toBeLessThan(centerColorIntensity * 0.4);

    disposeFadingGrid(grid);
  });

  it('supports light and dark theme color palettes', () => {
    const darkGrid = createFadingGrid(sampleBounds, { theme: 'dark' });
    const lightGrid = createFadingGrid(sampleBounds, { theme: 'light' });

    const darkPosAttr = darkGrid.geometry.getAttribute('position') as THREE.BufferAttribute;
    const darkColAttr = darkGrid.geometry.getAttribute('color') as THREE.BufferAttribute;
    const lightColAttr = lightGrid.geometry.getAttribute('color') as THREE.BufferAttribute;

    // Find a vertex near the center where colors are not faded to 0
    let centerIndex = -1;
    for (let i = 0; i < darkPosAttr.count; i++) {
      const x = darkPosAttr.getX(i);
      const z = darkPosAttr.getZ(i);
      if (Math.hypot(x, z) < 100) {
        centerIndex = i;
        break;
      }
    }

    expect(centerIndex).toBeGreaterThanOrEqual(0);

    const darkG = darkColAttr.getY(centerIndex);
    const lightG = lightColAttr.getY(centerIndex);

    // Dark (sage green) and light (slate gray) base colors differ according to GRID_THEME_COLORS
    expect(darkG).not.toEqual(lightG);

    disposeFadingGrid(darkGrid);
    disposeFadingGrid(lightGrid);
  });

  it('safely disposes geometry and materials without error', () => {
    const grid = createFadingGrid(sampleBounds);
    expect(() => disposeFadingGrid(grid)).not.toThrow();
    // Subsequent disposal call is idempotent
    expect(() => disposeFadingGrid(grid)).not.toThrow();
  });
});
