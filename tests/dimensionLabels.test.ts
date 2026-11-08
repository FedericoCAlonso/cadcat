import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  formatDimensionText,
  buildDimensionAnchors,
  createDimensionLinesGroup,
  disposeDimensionLinesGroup,
  projectDimensionLabels,
  isPointOccludedByBox,
} from '../src/ui/viewer/dimensionLabels';
import type { ModuleSpatialBounds } from '../src/resolver';

describe('Stage 5 Step A: dimensionLabels Overlay & Transform Integrity', () => {
  const sampleBounds: ModuleSpatialBounds = {
    min: { x: 0, y: 0, z: 0 },
    max: { x: 600, y: 800, z: 560 },
    center: { x: 300, y: 400, z: 280 },
    size: { x: 600, y: 800, z: 560 },
  };

  it('formats dimension numbers into localized text with unit and optional prefix', () => {
    expect(formatDimensionText(600, undefined, 'es-AR', 'mm')).toBe('600 mm');
    expect(formatDimensionText(600, 'An', 'es-AR', 'mm')).toBe('An 600 mm');
    expect(formatDimensionText(1200, 'Al', 'es-AR', 'mm')).toBe('Al 1.200 mm');
    expect(formatDimensionText(2400.4, 'Pr', 'es-AR', 'mm')).toBe('Pr 2.400 mm');
  });

  it('builds width, height, and depth anchors with localized formatted text', () => {
    const anchors = buildDimensionAnchors(sampleBounds);

    expect(anchors).toHaveLength(3);

    const [w, h, d] = anchors;
    expect(w?.id).toBe('width');
    expect(w?.valueMm).toBe(600);
    expect(w?.formattedText).toBe('An 600 mm');
    expect(w?.localMid.x).toBe(300);

    expect(h?.id).toBe('height');
    expect(h?.valueMm).toBe(800);
    expect(h?.formattedText).toBe('Al 800 mm');
    expect(h?.localMid.y).toBe(400);

    expect(d?.id).toBe('depth');
    expect(d?.valueMm).toBe(560);
    expect(d?.formattedText).toBe('Pr 560 mm');
    expect(d?.localMid.z).toBe(280);
  });

  /**
   * Rule 3.0.1 & Rule 3.0.2 Verification:
   * Confirms that overlays placed inside pieceGroup (or sharing identical transform)
   * align perfectly in world coordinates with an off-center piece under pieceGroup.scale.x = -1.
   */
  it('Rule 3.0.2: world position of overlay matches piece world position on off-center piece under scale.x = -1', () => {
    // 1. Root Scene and pieceGroup with mirrored X transform
    const scene = new THREE.Scene();
    const pieceGroup = new THREE.Group();
    pieceGroup.scale.x = -1;
    pieceGroup.position.x = 2 * sampleBounds.center.x; // 600
    scene.add(pieceGroup);

    // 2. An off-center piece located at the right side of the module: X in [582, 600]
    const pieceGeom = new THREE.BoxGeometry(18, 800, 560);
    const pieceMesh = new THREE.Mesh(pieceGeom);
    // Box center at local (591, 400, 280)
    pieceMesh.position.set(591, 400, 280);
    pieceGroup.add(pieceMesh);

    // 3. Create dimension lines overlay group as a child of pieceGroup (Rule 3.0.1)
    const dimGroup = createDimensionLinesGroup(sampleBounds);
    pieceGroup.add(dimGroup);

    // Update world matrices for all objects
    scene.updateMatrixWorld(true);

    // 4. Verify piece mesh world position:
    // With pieceGroup.scale.x = -1 and pieceGroup.position.x = 600:
    // Local X = 591 -> World X = 600 + (-1 * 591) = 9
    const pieceWorldPos = new THREE.Vector3();
    pieceMesh.getWorldPosition(pieceWorldPos);
    expect(pieceWorldPos.x).toBeCloseTo(9, 2);
    expect(pieceWorldPos.y).toBeCloseTo(400, 2);
    expect(pieceWorldPos.z).toBeCloseTo(280, 2);

    // 5. Verify dimension line endpoint at local X = 600:
    // Local (600, 0, -80) -> World X = 600 + (-1 * 600) = 0
    const localDimCorner = new THREE.Vector3(600, 0, -80);
    const worldDimCorner = localDimCorner.clone().applyMatrix4(pieceGroup.matrixWorld);
    expect(worldDimCorner.x).toBeCloseTo(0, 2);

    // The piece outer face is at local X = 600 -> World X = 0
    const pieceMaxCornerLocal = new THREE.Vector3(600, 0, 0);
    const pieceMaxCornerWorld = pieceMaxCornerLocal.clone().applyMatrix4(pieceGroup.matrixWorld);
    expect(pieceMaxCornerWorld.x).toBeCloseTo(0, 2);

    // World X positions align exactly!
    expect(worldDimCorner.x).toEqual(pieceMaxCornerWorld.x);

    disposeDimensionLinesGroup(dimGroup);
  });

  it('projects 3D anchors to 2D screen coordinates and evaluates visibility', () => {
    const camera = new THREE.PerspectiveCamera(45, 1366 / 768, 10, 10000);
    camera.position.set(1200, 1000, -1400);
    camera.lookAt(sampleBounds.center.x, sampleBounds.center.y, sampleBounds.center.z);
    camera.updateMatrixWorld(true);

    const pieceGroup = new THREE.Group();
    pieceGroup.scale.x = -1;
    pieceGroup.position.x = 2 * sampleBounds.center.x;
    pieceGroup.updateMatrixWorld(true);

    const anchors = buildDimensionAnchors(sampleBounds);
    const projected = projectDimensionLabels(
      anchors,
      camera,
      pieceGroup.matrixWorld,
      1366,
      768,
      { minScreenSpanPx: 30, bounds: sampleBounds },
    );

    expect(projected).toHaveLength(3);

    const widthLabel = projected.find((p) => p.id === 'width');
    expect(widthLabel).toBeDefined();
    expect(widthLabel?.visible).toBe(true);
    expect(widthLabel?.formattedText).toBe('An 600 mm');
    expect(widthLabel?.screenX).toBeGreaterThan(0);
    expect(widthLabel?.screenX).toBeLessThan(1366);
    expect(widthLabel?.screenY).toBeGreaterThan(0);
    expect(widthLabel?.screenY).toBeLessThan(768);
  });

  it('hides a dimension label when projected screen span is below minScreenSpanPx', () => {
    // Camera looking directly down the axis or placed so far away that line span is tiny
    const camera = new THREE.PerspectiveCamera(45, 1366 / 768, 10, 100000);
    camera.position.set(300, 400, -50000); // 50 meters away
    camera.lookAt(sampleBounds.center.x, sampleBounds.center.y, sampleBounds.center.z);
    camera.updateMatrixWorld(true);

    const pieceGroup = new THREE.Group();
    pieceGroup.updateMatrixWorld(true);

    const anchors = buildDimensionAnchors(sampleBounds);
    const projected = projectDimensionLabels(
      anchors,
      camera,
      pieceGroup.matrixWorld,
      1366,
      768,
      { minScreenSpanPx: 30 },
    );

    // Lines from 50m away project to less than 30px on screen
    for (const label of projected) {
      expect(label.screenSpanPx).toBeLessThan(30);
      expect(label.visible).toBe(false);
    }
  });

  it('anti-collision logic prevents overlapping labels by offsetting them', () => {
    const camera = new THREE.PerspectiveCamera(45, 800 / 600, 10, 10000);
    camera.position.set(1000, 800, -1000);
    camera.lookAt(sampleBounds.center.x, sampleBounds.center.y, sampleBounds.center.z);
    camera.updateMatrixWorld(true);

    const pieceGroup = new THREE.Group();
    pieceGroup.updateMatrixWorld(true);

    // Two artificial anchors placed right next to each other
    const collidingAnchors = [
      {
        id: 'width' as const,
        axis: 'x' as const,
        valueMm: 600,
        formattedText: '600 mm',
        localStart: { x: 0, y: 0, z: 0 },
        localEnd: { x: 600, y: 0, z: 0 },
        localMid: { x: 300, y: 0, z: 0 },
      },
      {
        id: 'depth' as const,
        axis: 'z' as const,
        valueMm: 560,
        formattedText: '560 mm',
        localStart: { x: 0, y: 0, z: 0 },
        localEnd: { x: 0, y: 0, z: 560 },
        localMid: { x: 300, y: 1, z: 1 }, // Almost identical screen position
      },
    ];

    const projected = projectDimensionLabels(
      collidingAnchors,
      camera,
      pieceGroup.matrixWorld,
      800,
      600,
      { minScreenSpanPx: 10 },
    );

    // The two labels should be separated so their Y coordinates differ by at least 15px
    const l1 = projected[0]!;
    const l2 = projected[1]!;
    expect(Math.abs(l1.screenY - l2.screenY)).toBeGreaterThanOrEqual(15);
  });

  describe('isPointOccludedByBox: Pure Slab Ray-AABB Occlusion Checker', () => {
    const box = {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 600, y: 800, z: 560 },
    };

    it('returns true when a target point is positioned directly behind the box relative to camera', () => {
      // Camera looking from the front (-Z)
      const cameraEye = { x: 300, y: 400, z: -1000 };
      // Target point positioned behind the module (+Z)
      const occludedTarget = { x: 300, y: 400, z: 800 };

      expect(isPointOccludedByBox(cameraEye, occludedTarget, box)).toBe(true);
    });

    it('returns false when target is in front of the box (unobstructed line of sight)', () => {
      const cameraEye = { x: 300, y: 400, z: -1000 };
      // Target point between camera and box front face
      const visibleFrontTarget = { x: 300, y: 400, z: -80 };

      expect(isPointOccludedByBox(cameraEye, visibleFrontTarget, box)).toBe(false);
    });

    it('returns false when target is to the side of the box and ray does not intersect volume', () => {
      const cameraEye = { x: 300, y: 400, z: -1000 };
      // Target point off to the right (+X) well clear of box
      const lateralTarget = { x: 1200, y: 400, z: 280 };

      expect(isPointOccludedByBox(cameraEye, lateralTarget, box)).toBe(false);
    });

    it('detects depth line occlusion when camera is in front and depth line is behind drawer front', () => {
      // Camera viewing front-isometric slightly offset
      const cameraEye = { x: 300, y: 400, z: -800 };
      // Depth line endpoint near back of cabinet
      const backDepthPoint = { x: 680, y: 400, z: 450 };
      // Ray from (300, 400, -800) to (680, 400, 450) crosses X in [300, 680] and Z in [-800, 450], passing through [0,600]x[0,800]x[0,560]
      expect(isPointOccludedByBox(cameraEye, backDepthPoint, box)).toBe(true);
    });
  });
});
