import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  calculateCameraFit,
  calculatePreservedCameraTarget,
} from '../src/ui/viewer/fitCamera';
import type { ModuleSpatialBounds } from '../src/resolver';
import { DEFAULT_UI_CONFIG } from '../src/config';

describe('Stage 5 Step A: fitCamera Pure Math Resolver', () => {
  const sampleBounds: ModuleSpatialBounds = {
    min: { x: 0, y: 0, z: 0 },
    max: { x: 600, y: 800, z: 560 },
    center: { x: 300, y: 400, z: 280 },
    size: { x: 600, y: 800, z: 560 },
  };

  it('calculates optimal camera distance and target centered on the module', () => {
    const result = calculateCameraFit({
      bounds: sampleBounds,
      aspect: 16 / 9,
      fov: 45,
      fillRatio: 0.85,
    });

    expect(result.target).toEqual({ x: 300, y: 400, z: 280 });
    expect(result.distance).toBeGreaterThan(600);
    expect(result.position.x).toBeGreaterThan(300); // Isometric +X
    expect(result.position.y).toBeGreaterThan(400); // Isometric +Y
    expect(result.position.z).toBeLessThan(280); // Isometric -Z
  });

  it('ensures all 8 corners of the module bounding box fit inside the camera frustum at 1366x768', () => {
    const aspect = 1366 / 768;
    const fov = 45;
    const fillRatio = 0.85;

    const fit = calculateCameraFit({
      bounds: sampleBounds,
      aspect,
      fov,
      fillRatio,
    });

    // Create a real Three.js PerspectiveCamera with the exact same parameters
    const camera = new THREE.PerspectiveCamera(fov, aspect, 10, 10000);
    camera.position.set(fit.position.x, fit.position.y, fit.position.z);
    camera.lookAt(fit.target.x, fit.target.y, fit.target.z);
    camera.updateMatrixWorld(true);

    const corners = [
      new THREE.Vector3(sampleBounds.min.x, sampleBounds.min.y, sampleBounds.min.z),
      new THREE.Vector3(sampleBounds.max.x, sampleBounds.min.y, sampleBounds.min.z),
      new THREE.Vector3(sampleBounds.min.x, sampleBounds.max.y, sampleBounds.min.z),
      new THREE.Vector3(sampleBounds.max.x, sampleBounds.max.y, sampleBounds.min.z),
      new THREE.Vector3(sampleBounds.min.x, sampleBounds.min.y, sampleBounds.max.z),
      new THREE.Vector3(sampleBounds.max.x, sampleBounds.min.y, sampleBounds.max.z),
      new THREE.Vector3(sampleBounds.min.x, sampleBounds.max.y, sampleBounds.max.z),
      new THREE.Vector3(sampleBounds.max.x, sampleBounds.max.y, sampleBounds.max.z),
    ];

    let maxNdcX = 0;
    let maxNdcY = 0;

    for (const c of corners) {
      const projected = c.clone().project(camera);
      // Normalized Device Coordinates must be within [-1, 1]
      expect(Math.abs(projected.x)).toBeLessThanOrEqual(1.0);
      expect(Math.abs(projected.y)).toBeLessThanOrEqual(1.0);
      maxNdcX = Math.max(maxNdcX, Math.abs(projected.x));
      maxNdcY = Math.max(maxNdcY, Math.abs(projected.y));
    }

    // At least one dimension should fill close to fillRatio (e.g. >= 0.70 of screen)
    const maxFill = Math.max(maxNdcX, maxNdcY);
    expect(maxFill).toBeGreaterThanOrEqual(0.70);
    expect(maxFill).toBeLessThanOrEqual(fillRatio + 0.05);
  });

  it('uses default fillRatio from config when not specified explicitly', () => {
    const configRatio = DEFAULT_UI_CONFIG.viewerFillRatio ?? 0.85;
    const fitDefault = calculateCameraFit({
      bounds: sampleBounds,
      aspect: 1.0,
    });
    const fitExplicit = calculateCameraFit({
      bounds: sampleBounds,
      aspect: 1.0,
      fillRatio: configRatio,
    });

    expect(fitDefault.distance).toBeCloseTo(fitExplicit.distance, 4);
    expect(fitDefault.position.x).toBeCloseTo(fitExplicit.position.x, 4);
  });

  it('strictly preserves camera orientation, relative vector, and distance when user moved camera', () => {
    const initialCenter = { x: 300, y: 400, z: 280 };
    // User rotated or zoomed to a custom position
    const customUserCamPos = { x: 1250, y: 920, z: -850 };

    // User modifies width parameter: center shifts along X to 450
    const newCenter = { x: 450, y: 400, z: 280 };

    const preservedPos = calculatePreservedCameraTarget(newCenter, initialCenter, customUserCamPos);

    // Delta is (450 - 300) = +150 in X, 0 in Y, 0 in Z
    expect(preservedPos.x).toBe(customUserCamPos.x + 150);
    expect(preservedPos.y).toBe(customUserCamPos.y);
    expect(preservedPos.z).toBe(customUserCamPos.z);

    // Relative vector from target to camera remains 100% IDENTICAL
    const originalVector = {
      x: customUserCamPos.x - initialCenter.x,
      y: customUserCamPos.y - initialCenter.y,
      z: customUserCamPos.z - initialCenter.z,
    };
    const newVector = {
      x: preservedPos.x - newCenter.x,
      y: preservedPos.y - newCenter.y,
      z: preservedPos.z - newCenter.z,
    };

    expect(newVector).toEqual(originalVector);
  });
});
