import { useEffect, useRef, useState, type ReactElement } from 'react';
import * as THREE from 'three';
import {
  type SpatialPieceBox,
  type ModuleSpatialBounds,
  calculateExplodedBoxes,
  type ResolvedPieceWithCutSize,
  type ShelfDeflectionResult,
  type KinematicMechanism,
  type KinematicPieceBox,
  type PieceEdgeBandOverride,
  type ExplodedPieceBox,
  type PieceMachiningSheet,
  buildPieceMachining3DGroup,
  type CountertopCalculationResult,
} from '../resolver';
import type { JointKind, JointStrategy, Material, EdgeBand, InterferenceConfig } from '../model';
import { translatePieceRole } from './localization';
import { resolvePiecePbrStyle, STAINLESS_STEEL_SINK_STYLE } from './materialStyles';

export interface Viewport3DProps {
  boxes: SpatialPieceBox[];
  bounds: ModuleSpatialBounds;
  pieces: ResolvedPieceWithCutSize[];
  explodedRatio: number;
  onExplodedRatioChange: (val: number) => void;
  selectedPieceId: string | null;
  onSelectPiece: (pieceId: string | null) => void;
  shelfDeflections?: Map<string, ShelfDeflectionResult>;
  pieceJointOverrides?: Record<string, JointKind>;
  onSetPieceJointOverride?: (pieceId: string, jointKind: JointKind | null) => void;
  defaultJointStrategy?: JointStrategy;
  // Kinematics (Point 11)
  kinematicBoxes?: KinematicPieceBox[];
  kinematicMechanisms?: KinematicMechanism[];
  kinematicsState?: Record<string, number>;
  onMechanismOpenRatioChange?: (mechanismId: string, ratio: number) => void;
  // Piece modifications (Point 10)
  materials?: Material[];
  edgeBands?: EdgeBand[];
  pieceMaterialOverrides?: Record<string, string>;
  pieceThicknessOverrides?: Record<string, number>;
  pieceEdgeBandOverrides?: Record<string, PieceEdgeBandOverride>;
  onSetPieceMaterial?: (pieceId: string, materialId: string | null) => void;
  onSetPieceThickness?: (pieceId: string, thicknessMm: number | null) => void;
  onSetPieceEdgeBands?: (pieceId: string, overrides: PieceEdgeBandOverride | null) => void;
  // Custom Machinings (Point 8)
  onOpenMachiningModal?: (pieceId: string) => void;
  machiningSheets?: PieceMachiningSheet[];
  // Countertop cutouts and visualization (Phase 3 & 4)
  countertopCalculation?: CountertopCalculationResult | null;
  // Architectural Interferences Lab
  interferences?: InterferenceConfig;
}

export function Viewport3D(props: Viewport3DProps): ReactElement {
  const {
    boxes,
    bounds,
    pieces,
    explodedRatio,
    onExplodedRatioChange,
    selectedPieceId,
    onSelectPiece,
    kinematicBoxes,
    kinematicMechanisms,
    kinematicsState,
    onMechanismOpenRatioChange,
    machiningSheets,
    countertopCalculation,
    interferences,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const pieceGroupRef = useRef<THREE.Group | null>(null);

  const [webGlSupported, setWebGlSupported] = useState<boolean>(true);
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [showMachining3D, setShowMachining3D] = useState<boolean>(true);
  const [activeMechId, setActiveMechId] = useState<string>('all');

  // Selected piece data lookup
  const selectedPiece = pieces.find((p) => p.id === selectedPieceId) ?? null;
  const pieceMech = kinematicMechanisms?.find((m) => m.pieceIds.includes(selectedPiece?.id ?? ''));

  // Sync active mechanism when selected piece changes
  useEffect(() => {
    if (pieceMech) {
      setActiveMechId(pieceMech.id);
    }
  }, [selectedPieceId, pieceMech]);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    // Check if WebGL is available
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      setWebGlSupported(false);
      return;
    }

    const getWidth = () => containerRef.current?.clientWidth || 360;
    const getHeight = () => containerRef.current?.clientHeight || (window.innerWidth < 1024 ? 360 : 520);

    const width = getWidth();
    const height = getHeight();

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(45, width / height, 10, 10000);
    cameraRef.current = camera;

    // Set initial camera position looking at center
    const maxDim = Math.max(bounds.size.x, bounds.size.y, bounds.size.z, 600);
    camera.position.set(
      bounds.center.x + maxDim * 1.5,
      bounds.center.y + maxDim * 1.2,
      bounds.center.z - maxDim * 2.0,
    );
    camera.lookAt(bounds.center.x, bounds.center.y, bounds.center.z);

    // Renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(typeof window !== 'undefined' ? window.devicePixelRatio : 1, 2));
      renderer.setSize(width, height, false); // false avoids overriding CSS responsive dimensions
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;
    } catch {
      setWebGlSupported(false);
      return;
    }

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.75);
    dirLight1.position.set(maxDim * 2, maxDim * 3, maxDim * 2);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.35);
    dirLight2.position.set(-maxDim * 2, maxDim, -maxDim);
    scene.add(dirLight2);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(maxDim * 2.5, 20, 0x56705f, 0xd9d2c3);
    gridHelper.position.set(bounds.center.x, bounds.min.y, bounds.center.z);
    scene.add(gridHelper);

    // Group for piece meshes
    const pieceGroup = new THREE.Group();
    scene.add(pieceGroup);
    pieceGroupRef.current = pieceGroup;

    // Interactive mouse & touch orbit controls
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;
    let initialPinchDist = 0;

    const onRotate = (clientX: number, clientY: number) => {
      const deltaX = (clientX - prevX) * 0.005;
      const deltaY = (clientY - prevY) * 0.005;

      const offset = new THREE.Vector3().subVectors(camera.position, bounds.center);
      const radius = offset.length();
      let theta = Math.atan2(offset.x, offset.z) + deltaX;
      let phi = Math.acos(Math.max(-0.99, Math.min(0.99, offset.y / radius))) + deltaY;
      phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi));

      camera.position.x = bounds.center.x + radius * Math.sin(phi) * Math.sin(theta);
      camera.position.y = bounds.center.y + radius * Math.cos(phi);
      camera.position.z = bounds.center.z + radius * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(bounds.center.x, bounds.center.y, bounds.center.z);

      prevX = clientX;
      prevY = clientY;
    };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      onRotate(e.clientX, e.clientY);
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1 && e.touches[0]) {
        isDragging = true;
        prevX = e.touches[0].clientX;
        prevY = e.touches[0].clientY;
      } else if (e.touches.length === 2 && e.touches[0] && e.touches[1]) {
        isDragging = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        initialPinchDist = Math.hypot(dx, dy);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && isDragging && e.touches[0]) {
        if (e.cancelable) e.preventDefault();
        onRotate(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2 && e.touches[0] && e.touches[1]) {
        if (e.cancelable) e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        if (initialPinchDist > 0) {
          const ratio = initialPinchDist / dist;
          const factor = ratio > 1 ? 1.03 : 0.97;
          const offset = new THREE.Vector3().subVectors(camera.position, bounds.center);
          offset.multiplyScalar(factor);
          camera.position.addVectors(bounds.center, offset);
          camera.lookAt(bounds.center.x, bounds.center.y, bounds.center.z);
        }
        initialPinchDist = dist;
      }
    };

    const onTouchEnd = () => {
      isDragging = false;
      initialPinchDist = 0;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
      const offset = new THREE.Vector3().subVectors(camera.position, bounds.center);
      offset.multiplyScalar(zoomFactor);
      camera.position.addVectors(bounds.center, offset);
      camera.lookAt(bounds.center.x, bounds.center.y, bounds.center.z);
    };

    // Raycast click for piece selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onClick = (e: MouseEvent) => {
      if (!containerRef.current || !rendererRef.current) return;
      const rect = rendererRef.current.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(pieceGroup.children, true);

      if (intersects.length > 0) {
        const hit = intersects[0]?.object;
        const pId = hit?.userData?.pieceId as string | undefined;
        if (pId) {
          onSelectPiece(pId);
        }
      } else {
        onSelectPiece(null);
      }
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    domElement.addEventListener('wheel', onWheel, { passive: false });
    domElement.addEventListener('click', onClick);
    domElement.addEventListener('touchstart', onTouchStart, { passive: true });
    domElement.addEventListener('touchmove', onTouchMove, { passive: false });
    domElement.addEventListener('touchend', onTouchEnd, { passive: true });

    // Dynamic resize observer
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = Math.max(50, containerRef.current.clientWidth || (window.innerWidth < 1024 ? window.innerWidth : 360));
      const h = Math.max(50, containerRef.current.clientHeight || (window.innerWidth < 1024 ? 360 : 520));
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h, false);
    };

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      observer = new ResizeObserver(() => handleResize());
      observer.observe(containerRef.current);
    }
    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      if (observer) observer.disconnect();
      window.removeEventListener('resize', handleResize);
      domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      domElement.removeEventListener('wheel', onWheel);
      domElement.removeEventListener('click', onClick);
      domElement.removeEventListener('touchstart', onTouchStart);
      domElement.removeEventListener('touchmove', onTouchMove);
      domElement.removeEventListener('touchend', onTouchEnd);

      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [bounds]);

  // Helper: Extrude countertop slab geometry with cutouts and faucet holes
  function buildCountertopSlabGeometry(
    item: SpatialPieceBox,
    calc?: CountertopCalculationResult | null,
  ): THREE.BufferGeometry {
    const slabW = item.sizeMm.x;
    const slabThick = item.sizeMm.y;
    const slabD = item.sizeMm.z;

    if (!calc || !calc.cutouts || calc.cutouts.length === 0) {
      return new THREE.BoxGeometry(slabW, slabThick, slabD);
    }

    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(slabW, 0);
    shape.lineTo(slabW, slabD);
    shape.lineTo(0, slabD);
    shape.closePath();

    for (const c of calc.cutouts) {
      const w = c.boundsMm.widthMm;
      const d = c.boundsMm.depthMm;
      const x0 = c.boundsMm.minXMm;
      const x1 = c.boundsMm.maxXMm;
      // Coordinate mapping: 0=front (frente), slabD=back (contrafrente).
      // Since rotateX(-PI/2) maps (x, y, z) -> (x, z, -y), y_shape = slabD - y_model ensures
      // 3D Z increases towards the back.
      const y0 = Math.max(0, slabD - c.boundsMm.maxYMm);
      const y1 = Math.min(slabD, slabD - c.boundsMm.minYMm);

      const hole = new THREE.Path();
      const r = Math.max(0, Math.min(c.cornerRadiusMm, w / 2, d / 2));
      if (r > 0) {
        hole.moveTo(x0 + r, y0);
        hole.lineTo(x1 - r, y0);
        hole.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
        hole.lineTo(x1, y1 - r);
        hole.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
        hole.lineTo(x0 + r, y1);
        hole.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
        hole.lineTo(x0, y0 + r);
        hole.absarc(x0 + r, y0 + r, r, Math.PI, (3 * Math.PI) / 2, false);
      } else {
        hole.moveTo(x0, y0);
        hole.lineTo(x1, y0);
        hole.lineTo(x1, y1);
        hole.lineTo(x0, y1);
      }
      hole.closePath();
      shape.holes.push(hole);

      // Single faucet hole for monocomando mixer tap
      if (c.faucetHole) {
        const fHole = new THREE.Path();
        const fx = c.faucetHole.centerXMm;
        const fy = slabD - c.faucetHole.centerYMm;
        const fr = Math.max(5, c.faucetHole.diameterMm / 2);
        fHole.absarc(fx, fy, fr, 0, Math.PI * 2, true);
        fHole.closePath();
        shape.holes.push(fHole);
      }
    }

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: slabThick,
      bevelEnabled: false,
      curveSegments: 24,
    });
    geom.rotateX(-Math.PI / 2);
    geom.center();
    geom.computeVertexNormals();
    return geom;
  }

  // Helper: Build extruded geometry for pieces with custom polygon contours (column notches, false square trapezoids)
  function buildCustomPieceGeometry(
    item: SpatialPieceBox,
    matchedPiece?: ResolvedPieceWithCutSize | null,
  ): THREE.BufferGeometry {
    if (!matchedPiece || !matchedPiece.contour || matchedPiece.contour.points.length < 3) {
      return new THREE.BoxGeometry(item.sizeMm.x, item.sizeMm.y, item.sizeMm.z);
    }

    const points = matchedPiece.contour.points;
    const isSpecialContour = points.length > 4 || Boolean(matchedPiece.secondaryCuts && matchedPiece.secondaryCuts.length > 0);
    if (!isSpecialContour) {
      return new THREE.BoxGeometry(item.sizeMm.x, item.sizeMm.y, item.sizeMm.z);
    }

    const p0 = points[0];
    if (!p0) {
      return new THREE.BoxGeometry(item.sizeMm.x, item.sizeMm.y, item.sizeMm.z);
    }

    const shape = new THREE.Shape();
    shape.moveTo(p0.x, p0.y);
    for (let i = 1; i < points.length; i++) {
      const pt = points[i];
      if (pt) {
        shape.lineTo(pt.x, pt.y);
      }
    }
    shape.closePath();

    const geom = new THREE.ExtrudeGeometry(shape, {
      depth: matchedPiece.thicknessMm,
      bevelEnabled: false,
    });

    // Check if horizontal panel (bottom, shelf, top): rotate around X so local Y maps to 3D Z
    const isHorizontal = Math.abs(item.sizeMm.y - matchedPiece.thicknessMm) < 0.1;
    const isSide = Math.abs(item.sizeMm.x - matchedPiece.thicknessMm) < 0.1;
    if (isHorizontal) {
      geom.rotateX(-Math.PI / 2);
    } else if (isSide) {
      geom.rotateY(Math.PI / 2);
    }
    geom.center();
    geom.computeVertexNormals();
    return geom;
  }

  // Helper: Build stainless steel undermount sink basin underneath cutout opening
  function buildUndermountSinkGroup(
    item: SpatialPieceBox,
    calc: CountertopCalculationResult,
  ): THREE.Group | null {
    const sinks = calc.cutouts.filter((c) => c.kind === 'sink-undermount');
    if (sinks.length === 0) return null;

    const sGroup = new THREE.Group();
    const slabW = item.sizeMm.x;
    const slabThick = item.sizeMm.y;
    const slabD = item.sizeMm.z;

    const sinkMat = new THREE.MeshStandardMaterial({
      color: STAINLESS_STEEL_SINK_STYLE.color,
      roughness: STAINLESS_STEEL_SINK_STYLE.roughness,
      metalness: STAINLESS_STEEL_SINK_STYLE.metalness,
    });

    const drainMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.15,
      metalness: 0.95,
    });

    for (const c of sinks) {
      const w = c.boundsMm.widthMm;
      const d = c.boundsMm.depthMm;
      const bowlDepth = 190;

      // Outer undermount bowl box
      const bowlGeom = new THREE.BoxGeometry(w, bowlDepth, d);
      const bowlMesh = new THREE.Mesh(bowlGeom, sinkMat);

      const localX = c.boundsMm.minXMm + w / 2 - slabW / 2;
      const localY = -slabThick / 2 - bowlDepth / 2;
      const localZ = c.boundsMm.minYMm + d / 2 - slabD / 2;

      bowlMesh.position.set(localX, localY, localZ);

      // Subtle drain strainer disc at bottom of sink
      const drainGeom = new THREE.CylinderGeometry(40, 40, 4, 24);
      const drainMesh = new THREE.Mesh(drainGeom, drainMat);
      drainMesh.position.set(localX, localY - bowlDepth / 2 + 2, localZ);

      // Edge lines for crisp visual definition
      const bowlEdges = new THREE.EdgesGeometry(bowlGeom);
      const bowlLineMat = new THREE.LineBasicMaterial({ color: 0x64748b, linewidth: 1 });
      const bowlWire = new THREE.LineSegments(bowlEdges, bowlLineMat);
      bowlMesh.add(bowlWire);

      sGroup.add(bowlMesh);
      sGroup.add(drainMesh);
    }

    return sGroup;
  }

  // Update piece meshes when boxes, explosion ratio, wireframe, selection, or kinematics change
  useEffect(() => {
    const group = pieceGroupRef.current;
    if (!group) return;

    // Model frame: front face at z = 0, x grows from the left side (Vano 1) to the right side.
    // The default camera looks toward +Z from the front (z < 0), where three.js shows +X on the
    // screen's left. Mirror the piece group around the module's vertical center plane so the
    // furniture is shown in Western reading order (left-to-right), without altering model data.
    group.scale.x = -1;
    group.position.x = 2 * bounds.center.x;

    // Clear existing meshes and their child geometries/materials
    while (group.children.length > 0) {
      const child = group.children[0];
      if (!child) break;
      child.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else if (obj.material) {
            obj.material.dispose();
          }
        }
      });
      group.remove(child);
    }

    const useKinematics = explodedRatio === 0 && Boolean(kinematicBoxes && kinematicBoxes.length > 0);
    const activeBoxes = useKinematics
      ? kinematicBoxes!
      : calculateExplodedBoxes(boxes, bounds, explodedRatio);

    for (const item of activeBoxes) {
      const isCountertopSlab = item.role === 'countertop';
      const matchedPiece = pieces.find((p) => p.id === item.pieceId) ?? null;
      const geom = isCountertopSlab
        ? buildCountertopSlabGeometry(item, countertopCalculation)
        : buildCustomPieceGeometry(item, matchedPiece);

      const isSelected = item.pieceId === selectedPieceId;
      const pbrStyle = resolvePiecePbrStyle(item.role, item.materialId, isSelected);
      const emissiveColor = isSelected ? 0x56705f : 0x000000;

      const mat = new THREE.MeshStandardMaterial({
        color: pbrStyle.color,
        roughness: pbrStyle.roughness,
        metalness: pbrStyle.metalness,
        wireframe,
        emissive: emissiveColor,
        emissiveIntensity: isSelected ? 0.35 : 0.0,
      });

      const mesh = new THREE.Mesh(geom, mat);

      if (isCountertopSlab && countertopCalculation) {
        const sinkGroup = buildUndermountSinkGroup(item, countertopCalculation);
        if (sinkGroup) {
          mesh.add(sinkGroup);
        }
      }

      if (useKinematics) {
        const kBox = item as KinematicPieceBox;
        const posX = kBox.kinematicPositionMm.x + kBox.sizeMm.x / 2;
        const posY = kBox.kinematicPositionMm.y + kBox.sizeMm.y / 2;
        const posZ = kBox.kinematicPositionMm.z + kBox.sizeMm.z / 2;
        mesh.position.set(posX, posY, posZ);
        mesh.rotation.set(
          kBox.kinematicRotationRad.x,
          kBox.kinematicRotationRad.y,
          kBox.kinematicRotationRad.z,
        );
      } else {
        const expBox = item as ExplodedPieceBox;
        const posX = expBox.explodedPositionMm.x + expBox.sizeMm.x / 2;
        const posY = expBox.explodedPositionMm.y + expBox.sizeMm.y / 2;
        const posZ = expBox.explodedPositionMm.z + expBox.sizeMm.z / 2;
        mesh.position.set(posX, posY, posZ);
        mesh.rotation.set(0, 0, 0);
      }

      mesh.userData = { pieceId: item.pieceId, role: item.role };

      // Edges helper for clear outline
      const edges = new THREE.EdgesGeometry(geom);
      const lineMat = new THREE.LineBasicMaterial({
        color: isSelected ? 0xffffff : pbrStyle.wireframeColor,
        linewidth: 1,
      });
      const wire = new THREE.LineSegments(edges, lineMat);
      mesh.add(wire);

      // Visual 3D Machining features (holes, hinge cups, grooves, cutouts)
      if (showMachining3D && machiningSheets) {
        const sheet = machiningSheets.find((s) => s.pieceId === item.pieceId);
        if (sheet && (sheet.totalOperations > 0 || (sheet.customOperations && sheet.customOperations.length > 0))) {
          const mGroup = buildPieceMachining3DGroup(sheet, item.sizeMm);
          mesh.add(mGroup);
        }
      }

      group.add(mesh);
    }

    // Architectural Interferences ghost visualization
    if (interferences?.columnObstacle?.enabled) {
      const col = interferences.columnObstacle;
      const isBeam = col.type === 'horizontal-beam';
      const dist = col.distanceFromReferenceMm ?? 0;
      const colD = col.depthMm;
      const colW = col.widthMm ?? (isBeam ? bounds.size.x : 150);
      const colH = col.heightMm ?? (isBeam ? 150 : bounds.size.y + 40);

      const colGeom = new THREE.BoxGeometry(colW, colH, colD);
      const colMat = new THREE.MeshStandardMaterial({
        color: 0x64748b, // Slate gray architectural volume
        roughness: 0.85,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      });
      const colMesh = new THREE.Mesh(colGeom, colMat);
      const colEdges = new THREE.EdgesGeometry(colGeom);
      const colLineMat = new THREE.LineBasicMaterial({ color: 0x334155, linewidth: 2 });
      colMesh.add(new THREE.LineSegments(colEdges, colLineMat));

      let colX = bounds.min.x + colW / 2;
      let colY = bounds.min.y + colH / 2;
      const colZ = bounds.max.z - colD / 2;

      if (isBeam) {
        colX = col.widthMm && col.widthMm < bounds.size.x
          ? (col.referenceEdge === 'right' ? bounds.max.x - dist - colW / 2 : bounds.min.x + dist + colW / 2)
          : bounds.min.x + bounds.size.x / 2;
        colY = col.referenceEdge === 'top'
          ? bounds.max.y - dist - colH / 2
          : bounds.min.y + dist + colH / 2;
      } else {
        const isRight = col.referenceEdge === 'right' || col.corner === 'back-right';
        colX = isRight
          ? bounds.max.x - dist - colW / 2
          : bounds.min.x + dist + colW / 2;
        colY = bounds.min.y + colH / 2;
      }

      colMesh.position.set(colX, colY, colZ);
      group.add(colMesh);
    }
  }, [boxes, bounds, explodedRatio, selectedPieceId, wireframe, kinematicBoxes, showMachining3D, machiningSheets, countertopCalculation, interferences, pieces]);

  // Camera presets
  const setCameraView = (type: 'iso' | 'front' | 'top' | 'side') => {
    const camera = cameraRef.current;
    if (!camera) return;
    const maxDim = Math.max(bounds.size.x, bounds.size.y, bounds.size.z, 600);

    if (type === 'iso') {
      camera.position.set(
        bounds.center.x + maxDim * 1.5,
        bounds.center.y + maxDim * 1.2,
        bounds.center.z - maxDim * 2.0,
      );
    } else if (type === 'front') {
      camera.position.set(bounds.center.x, bounds.center.y, bounds.center.z - maxDim * 2.5);
    } else if (type === 'top') {
      camera.position.set(bounds.center.x, bounds.center.y + maxDim * 2.8, bounds.center.z);
    } else if (type === 'side') {
      camera.position.set(bounds.center.x + maxDim * 2.5, bounds.center.y, bounds.center.z);
    }

    camera.lookAt(bounds.center.x, bounds.center.y, bounds.center.z);
  };

  return (
    <section aria-labelledby="viewport-heading" className="m3-card viewport-3d-card">
      <div className="m3-card__header">
        <h2 id="viewport-heading" className="m3-card__title">
          🧊 Vista 3D del Módulo
          <span className="visually-hidden">3D Module Viewport</span>
        </h2>
        <p className="m3-card__subtitle">
          Vista tridimensional interactiva con despiece explotado e inspección de piezas.
        </p>
      </div>

      {!webGlSupported && (
        <div className="error-state" role="alert">
          WebGL no está disponible o la aceleración por hardware está desactivada en su navegador.
        </div>
      )}

      <div
        ref={containerRef}
        className="viewport-3d-canvas-wrapper"
        data-testid="viewport-3d-canvas-wrapper"
      />

      {kinematicMechanisms && kinematicMechanisms.length > 0 && (
        <div className="m3-kinematics-bar" role="region" aria-label="Controles de cinemática y apertura">
          <div className="m3-kinematics-header">
            <div className="m3-kinematics-title-wrap">
              <span className="m3-kinematics-title">
                🎮 Cinemática / Apertura:
              </span>
            </div>

            <div className="m3-kinematics-selector-wrap">
              <select
                aria-label="Seleccionar mecanismo móvil"
                className="m3-select m3-kinematics-select"
                value={activeMechId}
                onChange={(e) => setActiveMechId(e.target.value)}
              >
                <option value="all">Todos los mecanismos ({kinematicMechanisms.length})</option>
                {kinematicMechanisms.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="m3-kinematics-controls-body">
            <div className="m3-kinematics-actions">
              <button
                type="button"
                className="m3-btn m3-btn--small m3-btn--tonal"
                onClick={() => {
                  if (!onMechanismOpenRatioChange || !kinematicMechanisms) return;
                  if (activeMechId === 'all') {
                    kinematicMechanisms.forEach((m) => onMechanismOpenRatioChange(m.id, 0));
                  } else {
                    onMechanismOpenRatioChange(activeMechId, 0);
                  }
                }}
              >
                Cerrar (0%)
              </button>
              <button
                type="button"
                className="m3-btn m3-btn--small m3-btn--tonal"
                onClick={() => {
                  if (!onMechanismOpenRatioChange || !kinematicMechanisms) return;
                  if (activeMechId === 'all') {
                    kinematicMechanisms.forEach((m) => onMechanismOpenRatioChange(m.id, 0.5));
                  } else {
                    onMechanismOpenRatioChange(activeMechId, 0.5);
                  }
                }}
              >
                50%
              </button>
              <button
                type="button"
                className="m3-btn m3-btn--small m3-btn--primary"
                onClick={() => {
                  if (!onMechanismOpenRatioChange || !kinematicMechanisms) return;
                  if (activeMechId === 'all') {
                    kinematicMechanisms.forEach((m) => onMechanismOpenRatioChange(m.id, 1));
                  } else {
                    onMechanismOpenRatioChange(activeMechId, 1);
                  }
                }}
              >
                Abrir (100%)
              </button>
            </div>

            <div className="m3-kinematics-slider-row">
              <label htmlFor="kinematics-slider" className="m3-kinematics-slider-label">
                <span>Deslizador:</span>{' '}
                <strong>
                  {Math.round(
                    (activeMechId === 'all'
                      ? kinematicMechanisms.reduce((acc, m) => acc + (kinematicsState?.[m.id] ?? 0), 0) /
                        kinematicMechanisms.length
                      : (kinematicsState?.[activeMechId] ?? 0)) * 100,
                  )}
                  %
                </strong>
              </label>
              <input
                id="kinematics-slider"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={
                  activeMechId === 'all'
                    ? kinematicMechanisms.reduce((acc, m) => acc + (kinematicsState?.[m.id] ?? 0), 0) /
                      kinematicMechanisms.length
                    : (kinematicsState?.[activeMechId] ?? 0)
                }
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!onMechanismOpenRatioChange || !kinematicMechanisms) return;
                  if (activeMechId === 'all') {
                    kinematicMechanisms.forEach((m) => onMechanismOpenRatioChange(m.id, val));
                  } else {
                    onMechanismOpenRatioChange(activeMechId, val);
                  }
                }}
                className="viewport-3d-slider"
                aria-label="Control deslizante de apertura cinemática"
              />
            </div>
          </div>
        </div>
      )}

      <div className="viewport-3d-toolbar">

        <div className="viewport-3d-slider-group">
          <label htmlFor="exploded-slider">
            Despiece / Vista Explotada:{' '}
            <strong>{`${Math.round(explodedRatio * 100)}%`}</strong>
            <span className="visually-hidden">Exploded View:</span>
          </label>
          <input
            id="exploded-slider"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={explodedRatio}
            onChange={(e) => onExplodedRatioChange(parseFloat(e.target.value))}
            className="viewport-3d-slider"
          />
        </div>

        <div className="m3-button-row viewport-camera-row" style={{ marginTop: 0 }}>
          <button
            type="button"
            className="m3-btn m3-btn--tonal"
            onClick={() => setCameraView('iso')}
          >
            Isométrica
            <span className="visually-hidden">Isometric</span>
          </button>
          <button
            type="button"
            className="m3-btn m3-btn--tonal"
            onClick={() => setCameraView('front')}
          >
            Frente
            <span className="visually-hidden">Front</span>
          </button>
          <button
            type="button"
            className="m3-btn m3-btn--tonal"
            onClick={() => setCameraView('top')}
          >
            Planta
            <span className="visually-hidden">Top</span>
          </button>
          <button
            type="button"
            className="m3-btn m3-btn--tonal"
            onClick={() => setCameraView('side')}
          >
            Lateral
            <span className="visually-hidden">Side</span>
          </button>
          <button
            type="button"
            className="m3-btn m3-btn--outlined"
            onClick={() => setWireframe(!wireframe)}
          >
            {wireframe ? 'Sólido' : 'Líneas'}
          </button>
          <button
            type="button"
            className={`m3-btn ${showMachining3D ? 'm3-btn--primary' : 'm3-btn--outlined'}`}
            onClick={() => setShowMachining3D(!showMachining3D)}
            title="Visualizar mecanizados (agujeros, bisagras, ranuras) en las placas 3D"
          >
            ⚙️ Mecanizados {showMachining3D ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <p className="viewport-touch-hint">
        {selectedPiece ? (
          <>
            🔍 <em>Pieza seleccionada: <strong>{selectedPiece.id}</strong> ({translatePieceRole(selectedPiece.role)}) — Podés editarla en el panel lateral</em>
          </>
        ) : (
          <>
            💡 <em>Arrastrá para rotar • Dos dedos o rueda para zoom • Tocá una pieza para inspeccionar</em>
          </>
        )}
      </p>
    </section>
  );
}
