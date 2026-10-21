import * as THREE from 'three';
import type { PieceMachiningSheet, SheetOperationItem } from '../machiningSheet';

/**
 * Determines the sign of the normal axis for Face A vs Face B based on the piece's spatial role.
 * - For right side panels (side-right, drawer-side-r): Face A is INNER (-X into cabinet), Face B is OUTER (+X).
 * - For left side panels (side-left, drawer-side-l): Face A is INNER (+X into cabinet), Face B is OUTER (-X).
 * - For roof / top panels: Face A is INNER (-Y into cabinet), Face B is OUTER (+Y).
 * - For shelves and bottom panels: Face A is TOP (+Y), Face B is BOTTOM (-Y).
 * - For doors and drawer fronts: Face A is EXTERIOR (-Z), Face B is INTERIOR (+Z).
 */
export function getPieceFaceNormalSign(
  role: string,
  pieceId: string,
  isFaceA: boolean,
  normal: 'x' | 'y' | 'z',
): number {
  const r = role.toLowerCase();
  const id = pieceId.toLowerCase();

  if (normal === 'x') {
    if (r.includes('side-right') || r.includes('side-r') || id.includes('side-right') || id.includes('side-r')) {
      return isFaceA ? -1 : 1;
    }
    return isFaceA ? 1 : -1;
  }

  if (normal === 'y') {
    if (r.includes('roof') || r.includes('top') || id.includes('roof') || id.includes('top')) {
      return isFaceA ? -1 : 1;
    }
    return isFaceA ? 1 : -1;
  }

  // normal === 'z'
  // In CadCat coordinate frame:
  // - Camera and exterior face are towards -Z (Face A: -1).
  // - Cabinet interior and hinge cup mortises are towards +Z (Face B: +1).
  return isFaceA ? -1 : 1;
}

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
  const pieceThickness = normal === 'x' ? sx : normal === 'y' ? sy : sz;

  // Set to avoid duplicate meshes for through-holes mirrored across Face A and Face B
  const renderedThroughOpKeys = new Set<string>();

  // Helper to place a cylinder drill hole on a specific face
  const addDrillMesh = (op: SheetOperationItem) => {
    // Deduplicate mirrored through-holes
    if (op.isThrough) {
      const baseKey = op.id.replace(/-through-[AB]$/, '');
      if (renderedThroughOpKeys.has(baseKey)) {
        return;
      }
      renderedThroughOpKeys.add(baseKey);
    }

    const isHingeCup = op.diameterMm >= 30;
    const radius = Math.max(1.5, op.diameterMm / 2);
    const depth = op.isThrough
      ? pieceThickness + 0.2
      : Math.min(Math.max(op.depthMm, 2), pieceThickness);

    const geom = new THREE.CylinderGeometry(radius, radius, depth, isHingeCup ? 24 : 12);
    const mat = isHingeCup ? hingeCupMaterial : drillHoleMaterial;
    const mesh = new THREE.Mesh(geom, mat);

    // Map 2D (xMm, yMm) to local piece coordinates centered at (0, 0, 0)
    const uLocal = op.xMm - w2d / 2;
    const vLocal = op.yMm - h2d / 2;

    const isFaceA = op.faceType === 'face-A';
    const normalSign = getPieceFaceNormalSign(sheet.role, sheet.pieceId, isFaceA, normal);

    if (normal === 'x') {
      mesh.rotation.z = Math.PI / 2;
      const xPos = op.isThrough ? 0 : normalSign * (sx / 2 - depth / 2 + 0.1);
      mesh.position.set(xPos, vLocal, uLocal);
    } else if (normal === 'y') {
      const yPos = op.isThrough ? 0 : normalSign * (sy / 2 - depth / 2 + 0.1);
      mesh.position.set(uLocal, yPos, vLocal);
    } else {
      mesh.rotation.x = Math.PI / 2;
      const zPos = op.isThrough ? 0 : normalSign * (sz / 2 - depth / 2 + 0.1);
      mesh.position.set(uLocal, vLocal, zPos);
    }

    group.add(mesh);
  };

  // Helper to place an edge drill hole cylinder
  const addEdgeDrillMesh = (op: SheetOperationItem) => {
    const radius = Math.max(1.2, op.diameterMm / 2);
    const depth = Math.min(Math.max(op.depthMm, 2), Math.max(sx, sy, sz));
    const geom = new THREE.CylinderGeometry(radius, radius, depth, 12);
    const mesh = new THREE.Mesh(geom, drillHoleMaterial);

    const fId = op.faceId.toLowerCase();

    if (normal === 'x') {
      // Piece standing in YZ plane (e.g. side, partition)
      if (fId.includes('bottom')) {
        mesh.position.set(0, -sy / 2 + depth / 2 - 0.1, op.xMm - w2d / 2);
      } else if (fId.includes('top')) {
        mesh.position.set(0, sy / 2 - depth / 2 + 0.1, op.xMm - w2d / 2);
      } else if (fId.includes('left')) {
        mesh.rotation.x = Math.PI / 2;
        mesh.position.set(0, op.yMm - h2d / 2, -sz / 2 + depth / 2 - 0.1);
      } else {
        mesh.rotation.x = Math.PI / 2;
        mesh.position.set(0, op.yMm - h2d / 2, sz / 2 - depth / 2 + 0.1);
      }
    } else if (normal === 'y') {
      // Piece lying in XZ plane (e.g. bottom, shelf, roof, rail)
      if (fId.includes('left')) {
        mesh.rotation.z = Math.PI / 2;
        mesh.position.set(-sx / 2 + depth / 2 - 0.1, 0, op.yMm - h2d / 2);
      } else if (fId.includes('right')) {
        mesh.rotation.z = Math.PI / 2;
        mesh.position.set(sx / 2 - depth / 2 + 0.1, 0, op.yMm - h2d / 2);
      } else if (fId.includes('bottom') || fId.includes('front')) {
        mesh.rotation.x = Math.PI / 2;
        mesh.position.set(op.xMm - w2d / 2, 0, -sz / 2 + depth / 2 - 0.1);
      } else {
        mesh.rotation.x = Math.PI / 2;
        mesh.position.set(op.xMm - w2d / 2, 0, sz / 2 - depth / 2 + 0.1);
      }
    } else {
      // Piece standing in XY plane (e.g. door, drawer front/back, plinth)
      if (fId.includes('left')) {
        mesh.rotation.z = Math.PI / 2;
        mesh.position.set(-sx / 2 + depth / 2 - 0.1, op.yMm - h2d / 2, 0);
      } else if (fId.includes('right')) {
        mesh.rotation.z = Math.PI / 2;
        mesh.position.set(sx / 2 - depth / 2 + 0.1, op.yMm - h2d / 2, 0);
      } else if (fId.includes('bottom')) {
        mesh.position.set(op.xMm - w2d / 2, -sy / 2 + depth / 2 - 0.1, 0);
      } else {
        mesh.position.set(op.xMm - w2d / 2, sy / 2 - depth / 2 + 0.1, 0);
      }
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

  // 3. Add Edge drill operations
  for (const op of sheet.edgeOperations) {
    addEdgeDrillMesh(op);
  }

  // 4. Add Custom operations (grooves, rebates, cutouts)
  if (sheet.customOperations) {
    for (const cop of sheet.customOperations) {
      if (cop.kind === 'groove') {
        const isAxisX = cop.axis === 'x';
        const gWidth = cop.widthMm;
        const gDepth = Math.max(2, cop.depthMm);
        const gOffset = cop.offsetMm;

        const isFaceA = cop.faceType === 'face-A';
        const normalSign = getPieceFaceNormalSign(sheet.role, sheet.pieceId, isFaceA, normal);

        if (normal === 'x') {
          // 2D: X along Z, Y along Y
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
        const cDepth = cop.isThrough ? pieceThickness + 0.2 : cop.depthMm;
        const uLocal = cop.xMm + cW / 2 - w2d / 2;
        const vLocal = cop.yMm + cH / 2 - h2d / 2;

        const isFaceA = cop.faceType === 'face-A';
        const normalSign = getPieceFaceNormalSign(sheet.role, sheet.pieceId, isFaceA, normal);

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
