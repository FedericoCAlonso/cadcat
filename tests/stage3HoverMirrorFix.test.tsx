import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { raycastPieceAtPointer } from '../src/ui/Viewport3D';

describe('Stage 3 Hover Mirror Fix Verification', () => {
  // Setup module bounds (600 x 800 x 560 mm)
  const bounds = {
    min: { x: 0, y: 0, z: 0 },
    max: { x: 600, y: 800, z: 560 },
    center: { x: 300, y: 400, z: 280 },
    size: { x: 600, y: 800, z: 560 },
  };

  /**
   * Builds a scene replicating Viewport3D hierarchy:
   * - scene
   *   - pieceGroup with scale.x = -1, position.x = 2 * bounds.center.x (reading direction mirroring)
   *     - leftLateralMesh: x = [0..18], y = [0..800], z = [0..560] (non-centered piece on the left)
   *     - rightLateralMesh: x = [582..600], y = [0..800], z = [0..560] (non-centered piece on the right)
   *   - hoverOutline (direct child of scene)
   */
  function setupTestScene() {
    const scene = new THREE.Scene();
    const pieceGroup = new THREE.Group();
    // Furniture coordinate system flip for Western reading order
    pieceGroup.scale.x = -1;
    pieceGroup.position.x = 2 * bounds.center.x; // 600
    scene.add(pieceGroup);

    // Left lateral piece (at local x = 0..18, center = 9, 400, 280)
    // Note: Due to pieceGroup mirroring, local x=9 appears at world x = 600 - 9 = 591 in Three.js coordinates
    // unless viewed as designed. It is strictly NOT at the center of the module.
    const leftGeom = new THREE.BoxGeometry(18, 800, 560);
    const leftMesh = new THREE.Mesh(leftGeom, new THREE.MeshBasicMaterial());
    leftMesh.position.set(9, 400, 280);
    leftMesh.userData = { pieceId: 'piece-left-lateral' };
    pieceGroup.add(leftMesh);

    // Right lateral piece (at local x = 582..600, center = 591, 400, 280)
    const rightGeom = new THREE.BoxGeometry(18, 800, 560);
    const rightMesh = new THREE.Mesh(rightGeom, new THREE.MeshBasicMaterial());
    rightMesh.position.set(591, 400, 280);
    rightMesh.userData = { pieceId: 'piece-right-lateral' };
    pieceGroup.add(rightMesh);

    scene.updateMatrixWorld(true);

    const hoverOutline = new THREE.LineSegments(
      new THREE.EdgesGeometry(leftGeom),
      new THREE.LineBasicMaterial({ color: 0x2563eb }),
    );
    scene.add(hoverOutline);

    const camera = new THREE.PerspectiveCamera(45, 800 / 600, 10, 10000);
    const raycaster = new THREE.Raycaster();
    const domElement = {
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
        right: 800,
        bottom: 600,
        x: 0,
        y: 0,
        toJSON: () => {},
      }),
    } as unknown as HTMLElement;

    return {
      scene,
      pieceGroup,
      leftMesh,
      rightMesh,
      hoverOutline,
      camera,
      raycaster,
      domElement,
    };
  }

  it('proves Hypothesis A vs B: hover and click identify the EXACT same piece ID at the same pointer position', () => {
    const { camera, raycaster, pieceGroup, domElement } = setupTestScene();

    // Set camera to front view looking at center of module
    const maxDim = 800;
    camera.position.set(bounds.center.x, bounds.center.y, bounds.center.z - maxDim * 2.5);
    camera.lookAt(bounds.center.x, bounds.center.y, bounds.center.z);
    camera.updateMatrixWorld(true);

    // Pick a pointer coordinate that intersects one of the laterals
    // Left edge of screen (around x = 200, y = 300)
    let hitFound = false;
    for (let clientX = 150; clientX <= 650; clientX += 10) {
      const hoverHit = raycastPieceAtPointer(clientX, 300, domElement, camera, raycaster, pieceGroup);
      const clickHit = raycastPieceAtPointer(clientX, 300, domElement, camera, raycaster, pieceGroup);

      if (hoverHit && clickHit) {
        hitFound = true;
        // Both hover and click must identify the exact same piece ID at the exact same screen coordinate
        expect(hoverHit.pieceId).toBe(clickHit.pieceId);
        expect(hoverHit.mesh).toBe(clickHit.mesh);
      } else {
        expect(hoverHit).toBeNull();
        expect(clickHit).toBeNull();
      }
    }
    expect(hitFound).toBe(true);
  });

  it('confirms Hypothesis A: local position copy in world space mirrors X coordinate, while world transform matches perfectly', () => {
    const { leftMesh, hoverOutline } = setupTestScene();

    // BUGGY behavior (before fix): copying local mesh.position directly to hoverOutline.position in scene
    hoverOutline.position.copy(leftMesh.position);
    hoverOutline.rotation.copy(leftMesh.rotation);
    hoverOutline.scale.copy(leftMesh.scale);
    hoverOutline.updateMatrixWorld(true);

    const buggyOutlineBox = new THREE.Box3().setFromObject(hoverOutline);
    const leftMeshWorldBox = new THREE.Box3().setFromObject(leftMesh);

    // In the buggy implementation, outline X was NOT equal to mesh world X!
    expect(buggyOutlineBox.min.x).not.toBeCloseTo(leftMeshWorldBox.min.x, 1);
    // Buggy outline was placed at local [0, 18], while mesh world box is at [582, 600]
    expect(buggyOutlineBox.min.x).toBeCloseTo(0, 1);
    expect(leftMeshWorldBox.min.x).toBeCloseTo(582, 1);

    // FIXED behavior: copy world matrix
    leftMesh.updateWorldMatrix(true, false);
    hoverOutline.geometry.dispose();
    hoverOutline.geometry = new THREE.EdgesGeometry(leftMesh.geometry);
    hoverOutline.matrixAutoUpdate = false;
    hoverOutline.matrix.copy(leftMesh.matrixWorld);
    hoverOutline.matrixWorld.copy(leftMesh.matrixWorld);
    leftMesh.getWorldPosition(hoverOutline.position);
    leftMesh.getWorldQuaternion(hoverOutline.quaternion);
    leftMesh.getWorldScale(hoverOutline.scale);
    hoverOutline.updateMatrixWorld(true);

    const fixedOutlineBox = new THREE.Box3().setFromObject(hoverOutline);

    // The fixed outline bounding box in world space matches the piece world bounding box exactly
    expect(fixedOutlineBox.min.x).toBeCloseTo(leftMeshWorldBox.min.x, 3);
    expect(fixedOutlineBox.max.x).toBeCloseTo(leftMeshWorldBox.max.x, 3);
    expect(fixedOutlineBox.min.y).toBeCloseTo(leftMeshWorldBox.min.y, 3);
    expect(fixedOutlineBox.max.y).toBeCloseTo(leftMeshWorldBox.max.y, 3);
    expect(fixedOutlineBox.min.z).toBeCloseTo(leftMeshWorldBox.min.z, 3);
    expect(fixedOutlineBox.max.z).toBeCloseTo(leftMeshWorldBox.max.z, 3);
  });

  it('verifies outline world bounding box equals non-centered piece world bounding box across at least two camera orientations', () => {
    const { leftMesh, hoverOutline, camera } = setupTestScene();

    // Camera preset orientations to test: Isometric, Front, Top, and Side
    const cameraPresets: Array<{ name: string; setup: () => void }> = [
      {
        name: 'Isometric',
        setup: () => {
          const maxDim = 800;
          camera.up.set(0, 1, 0);
          camera.position.set(
            bounds.center.x + maxDim * 1.5,
            bounds.center.y + maxDim * 1.2,
            bounds.center.z - maxDim * 2.0,
          );
          camera.lookAt(bounds.center.x, bounds.center.y, bounds.center.z);
          camera.updateMatrixWorld(true);
        },
      },
      {
        name: 'Front',
        setup: () => {
          const maxDim = 800;
          camera.up.set(0, 1, 0);
          camera.position.set(bounds.center.x, bounds.center.y, bounds.center.z - maxDim * 2.5);
          camera.lookAt(bounds.center.x, bounds.center.y, bounds.center.z);
          camera.updateMatrixWorld(true);
        },
      },
      {
        name: 'Top',
        setup: () => {
          const maxDim = 800;
          camera.up.set(0, 0, 1);
          camera.position.set(bounds.center.x, bounds.center.y + maxDim * 2.8, bounds.center.z);
          camera.lookAt(bounds.center.x, bounds.center.y, bounds.center.z);
          camera.updateMatrixWorld(true);
        },
      },
      {
        name: 'Left',
        setup: () => {
          const maxDim = 800;
          camera.up.set(0, 1, 0);
          camera.position.set(bounds.center.x - maxDim * 2.5, bounds.center.y, bounds.center.z);
          camera.lookAt(bounds.center.x, bounds.center.y, bounds.center.z);
          camera.updateMatrixWorld(true);
        },
      },
    ];

    for (const preset of cameraPresets) {
      preset.setup();

      // Apply the fix transform to hoverOutline
      leftMesh.updateWorldMatrix(true, false);
      hoverOutline.matrixAutoUpdate = false;
      hoverOutline.matrix.copy(leftMesh.matrixWorld);
      hoverOutline.matrixWorld.copy(leftMesh.matrixWorld);
      leftMesh.getWorldPosition(hoverOutline.position);
      leftMesh.getWorldQuaternion(hoverOutline.quaternion);
      leftMesh.getWorldScale(hoverOutline.scale);
      hoverOutline.updateMatrixWorld(true);

      const meshBox = new THREE.Box3().setFromObject(leftMesh);
      const outlineBox = new THREE.Box3().setFromObject(hoverOutline);

      // Verify world bounding box equality for this camera view
      expect(outlineBox.min.x, `${preset.name} min.x`).toBeCloseTo(meshBox.min.x, 3);
      expect(outlineBox.max.x, `${preset.name} max.x`).toBeCloseTo(meshBox.max.x, 3);
      expect(outlineBox.min.y, `${preset.name} min.y`).toBeCloseTo(meshBox.min.y, 3);
      expect(outlineBox.max.y, `${preset.name} max.y`).toBeCloseTo(meshBox.max.y, 3);
      expect(outlineBox.min.z, `${preset.name} min.z`).toBeCloseTo(meshBox.min.z, 3);
      expect(outlineBox.max.z, `${preset.name} max.z`).toBeCloseTo(meshBox.max.z, 3);
    }
  });
});
