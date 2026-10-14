import * as THREE from 'three';
import type { PieceMachiningSheet, SheetOperationItem } from '../machiningSheet';

/**
 * Builds a Three.js Group containing 3D visual representations of all machinings
 * (drill holes, hinge cups, grooves, cutouts) for a given piece, positioned in the piece's local coordinates.
 */
export function buildPieceMachining3DGroup(
  sheet: PieceMachiningSheet,
  boxSizeMm: { x: number; y: number; z: number },
): THREE.Group {
  const group = new THREE.Group();
  group.name = `machinings-${sheet.pieceId}`;

  // Unique materials per piece group for clean disposal
  const drillHoleMaterial = new THREE.MeshStandardMaterial({
    color: 0x1c1b1f,
    roughness: 0.9,
    metalness: 0.1,
  });

  const hingeCupMaterial = new THREE.MeshStandardMaterial({
    color: 0x8a9296,
    roughness: 0.35,
    metalness: 0.85,
  });

  const grooveMaterial = new THREE.MeshStandardMaterial({
    color: 0x231f1d,
    roughness: 0.9,
    metalness: 0.05,
  });

  const cutoutMaterial = new THREE.MeshStandardMaterial({
    color: 0x141216,
    roughness: 0.95,
    metalness: 0.05,
  });

  const { x: sx, y: sy, z: sz } = boxSizeMm;

  // Determine thickness normal axis and 2D-to-3D mapping
  let normal: 'x' | 'y' | 'z' = 'x';
  let uSize = sz;
  let vSize = sy;

  if (sx <= sy && sx <= sz) {
    // Standing in YZ plane (side / partition)
    normal = 'x';
    uSize = sz; // Width 2D is along Z
    vSize = sy; // Height 2D is along Y
  } else if (sy <= sx && sy <= sz) {
    // Lying in XZ plane (shelf / bottom / roof)
    normal = 'y';
    uSize = sx; // Width 2D is along X
    vSize = sz; // Height 2D is along Z
  } else {
    // Standing in XY plane (doors, back panel, plinth)
    normal = 'z';
    uSize = sx; // Width 2D is along X
    vSize = sy; // Height 2D is along Y
  }

  const w2d = sheet.dimensionsMm.width || uSize;
  const h2d = sheet.dimensionsMm.height || vSize;

  // Helper to place a cylinder drill hole on a specific face
  const addDrillMesh = (op: SheetOperationItem) => {
    const isHingeCup = op.diameterMm >= 30;
    const radius = Math.max(1.5, op.diameterMm / 2);
    const depth = Math.min(Math.max(op.depthMm, 2), normal === 'x' ? sx : normal === 'y' ? sy : sz);
    const geom = new THREE.CylinderGeometry(radius, radius, depth, isHingeCup ? 24 : 12);
    const mat = isHingeCup ? hingeCupMaterial : drillHoleMaterial;
    const mesh = new THREE.Mesh(geom, mat);

    // Map 2D (xMm, yMm) to local piece coordinates centered at (0, 0, 0)
    const uLocal = op.xMm - w2d / 2;
    const vLocal = op.yMm - h2d / 2;

    const isFaceA = op.faceType === 'face-A';
    const normalSign = isFaceA ? 1 : -1;

    if (normal === 'x') {
      // Cylinder default axis is Y. Rotate to align with X normal.
      mesh.rotation.z = Math.PI / 2;
      const xPos = normalSign * (sx / 2 - depth / 2 + 0.1);
      mesh.position.set(xPos, vLocal, uLocal);
    } else if (normal === 'y') {
      // Cylinder default axis is Y, matches normal.
      const yPos = normalSign * (sy / 2 - depth / 2 + 0.1);
      mesh.position.set(uLocal, yPos, vLocal);
    } else {
      // Rotate cylinder to align with Z normal.
      mesh.rotation.x = Math.PI / 2;
      const zPos = normalSign * (sz / 2 - depth / 2 + 0.1);
      mesh.position.set(uLocal, vLocal, zPos);
    }

    group.add(mesh);
  };

  // 1. Add Face A drill operations
  for (const op of sheet.faceAOperations) {
    addDrillMesh(op);
  }

  // 2. Add Face B drill operations
  for (const op of sheet.faceBOperations) {
    addDrillMesh(op);
  }

  // 3. Add Custom operations (grooves, rebates, cutouts)
  if (sheet.customOperations) {
    for (const cop of sheet.customOperations) {
      if (cop.kind === 'groove') {
        const isAxisX = cop.axis === 'x';
        const gWidth = cop.widthMm;
        const gDepth = Math.max(2, cop.depthMm);
        const gOffset = cop.offsetMm;

        const isFaceA = cop.faceType === 'face-A';
        const normalSign = isFaceA ? 1 : -1;

        if (normal === 'x') {
          // 2D: X along Z, Y along Y
          // If axis is X: runs along Z across full length, offset along Y
          const gLen = isAxisX ? sz : sy;
          const geom = isAxisX
            ? new THREE.BoxGeometry(gDepth, gWidth, gLen)
            : new THREE.BoxGeometry(gDepth, gLen, gWidth);
          const mesh = new THREE.Mesh(geom, grooveMaterial);
          const xPos = normalSign * (sx / 2 - gDepth / 2 + 0.1);
          if (isAxisX) {
            mesh.position.set(xPos, gOffset - vSize / 2 + gWidth / 2, 0);
          } else {
            mesh.position.set(xPos, 0, gOffset - uSize / 2 + gWidth / 2);
          }
          group.add(mesh);
        } else if (normal === 'y') {
          // 2D: X along X, Y along Z
          const gLen = isAxisX ? sx : sz;
          const geom = isAxisX
            ? new THREE.BoxGeometry(gLen, gDepth, gWidth)
            : new THREE.BoxGeometry(gWidth, gDepth, gLen);
          const mesh = new THREE.Mesh(geom, grooveMaterial);
          const yPos = normalSign * (sy / 2 - gDepth / 2 + 0.1);
          if (isAxisX) {
            mesh.position.set(0, yPos, gOffset - vSize / 2 + gWidth / 2);
          } else {
            mesh.position.set(gOffset - uSize / 2 + gWidth / 2, yPos, 0);
          }
          group.add(mesh);
        } else {
          // 2D: X along X, Y along Y
          const gLen = isAxisX ? sx : sy;
          const geom = isAxisX
            ? new THREE.BoxGeometry(gLen, gWidth, gDepth)
            : new THREE.BoxGeometry(gWidth, gLen, gDepth);
          const mesh = new THREE.Mesh(geom, grooveMaterial);
          const zPos = normalSign * (sz / 2 - gDepth / 2 + 0.1);
          if (isAxisX) {
            mesh.position.set(0, gOffset - vSize / 2 + gWidth / 2, zPos);
          } else {
            mesh.position.set(gOffset - uSize / 2 + gWidth / 2, 0, zPos);
          }
          group.add(mesh);
        }
      } else if (cop.kind === 'cutout') {
        const cW = cop.widthMm;
        const cH = cop.heightMm;
        const cDepth = cop.isThrough ? (normal === 'x' ? sx : normal === 'y' ? sy : sz) + 0.2 : cop.depthMm;
        const uLocal = cop.xMm + cW / 2 - w2d / 2;
        const vLocal = cop.yMm + cH / 2 - h2d / 2;

        const isFaceA = cop.faceType === 'face-A';
        const normalSign = isFaceA ? 1 : -1;

        if (normal === 'x') {
          const geom = new THREE.BoxGeometry(cDepth, cH, cW);
          const mesh = new THREE.Mesh(geom, cutoutMaterial);
          const xPos = cop.isThrough ? 0 : normalSign * (sx / 2 - cDepth / 2 + 0.1);
          mesh.position.set(xPos, vLocal, uLocal);
          group.add(mesh);
        } else if (normal === 'y') {
          const geom = new THREE.BoxGeometry(cW, cDepth, cH);
          const mesh = new THREE.Mesh(geom, cutoutMaterial);
          const yPos = cop.isThrough ? 0 : normalSign * (sy / 2 - cDepth / 2 + 0.1);
          mesh.position.set(uLocal, yPos, vLocal);
          group.add(mesh);
        } else {
          const geom = new THREE.BoxGeometry(cW, cH, cDepth);
          const mesh = new THREE.Mesh(geom, cutoutMaterial);
          const zPos = cop.isThrough ? 0 : normalSign * (sz / 2 - cDepth / 2 + 0.1);
          mesh.position.set(uLocal, vLocal, zPos);
          group.add(mesh);
        }
      }
    }
  }

  return group;
}
