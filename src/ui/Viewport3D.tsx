import { useEffect, useRef, useState, useCallback, type ReactElement } from 'react';
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
import { DEFAULT_UI_CONFIG } from '../config';
import { translatePieceRole } from './localization';
import { resolvePiecePbrStyle, STAINLESS_STEEL_SINK_STYLE } from './materialStyles';
import { ViewerToolbar, type CameraPresetView } from './ViewerToolbar';
import { PieceInspectorCard } from './PieceInspectorCard';
import { calculateCameraFit, calculatePreservedCameraTarget, calculateExplodedSpatialBounds } from './viewer/fitCamera';
import { createFadingGrid, disposeFadingGrid } from './viewer/fadingGrid';
import {
  shouldShowPieceMachining,
  countPieceMachiningOperations,
  formatHolesCountText,
  type MachiningDisplayMode,
} from './viewer/machiningVisibility';
import {
  createDimensionLinesGroup,
  disposeDimensionLinesGroup,
  buildDimensionAnchors,
  projectDimensionLabels,
  type ProjectedDimensionLabel,
} from './viewer/dimensionLabels';
import {
  resolvePieceBandedEdges,
  resolveEdgeBandHighlightColor,
  buildPieceEdgeBandHighlightGroup,
  calculateEffectiveEdgeBandThicknessMm,
} from './viewer/edgeBandHighlight';

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
  /** Active module identifier to trigger auto-fit when changing modules. */
  moduleId?: string;
  /** Whether 3D dimension lines and labels are shown by default. */
  initialShowDimensions?: boolean;
  /** Initial functional color by role state (defaults to config colorByRoleByDefault). */
  initialColorByRole?: boolean;
  /** Initial wireframe/lines state (defaults to config showLinesByDefault). */
  initialShowLines?: boolean;
  /** Initial machining display mode (defaults to config machiningDisplayModeDefault). */
  initialMachiningMode?: MachiningDisplayMode;
  /** Initial edge band highlights state (defaults to config showEdgeBandsByDefault). */
  initialShowEdgeBands?: boolean;
}

/**
 * Guard validator to check whether spatial bounds are valid, positive, and finite.
 */
function isValidSpatialBounds(b: ModuleSpatialBounds | undefined | null): boolean {
  if (!b || !b.size || !b.center || !b.min || !b.max) return false;
  const isPos = (v: number) => typeof v === 'number' && Number.isFinite(v) && v > 0;
  const isFiniteNum = (v: number) => typeof v === 'number' && Number.isFinite(v);
  return (
    isPos(b.size.x) && isPos(b.size.y) && isPos(b.size.z) &&
    isFiniteNum(b.center.x) && isFiniteNum(b.center.y) && isFiniteNum(b.center.z) &&
    isFiniteNum(b.min.x) && isFiniteNum(b.min.y) && isFiniteNum(b.min.z) &&
    isFiniteNum(b.max.x) && isFiniteNum(b.max.y) && isFiniteNum(b.max.z)
  );
}

const DEFAULT_FALLBACK_BOUNDS: ModuleSpatialBounds = {
  min: { x: 0, y: 0, z: 0 },
  max: { x: 600, y: 800, z: 560 },
  center: { x: 300, y: 400, z: 280 },
  size: { x: 600, y: 800, z: 560 },
};

/**
 * Result of raycasting a pointer position against pieces in the 3D scene.
 */
export interface RaycastPieceHit {
  /** Identifier of the intersected piece. */
  pieceId: string;
  /** Three.js Mesh instance corresponding to the piece geometry. */
  mesh: THREE.Mesh;
}

/**
 * Shared helper to convert pointer client coordinates to normalized device coordinates
 * and raycast against piece meshes inside pieceGroup.
 * Used identically for hover outline detection and click selection to guarantee consistency.
 *
 * @param clientX Pointer client X coordinate
 * @param clientY Pointer client Y coordinate
 * @param domElement The canvas DOM element
 * @param camera Three.js perspective camera
 * @param raycaster Three.js raycaster instance
 * @param pieceGroup Three.js group containing the piece meshes
 * @returns The hit piece ID and mesh, or null if no piece was hit
 */
export function raycastPieceAtPointer(
  clientX: number,
  clientY: number,
  domElement: HTMLElement,
  camera: THREE.Camera,
  raycaster: THREE.Raycaster,
  pieceGroup: THREE.Group,
): RaycastPieceHit | null {
  const rect = domElement.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  const mouse = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(pieceGroup.children, true);
  if (intersects.length > 0) {
    let hit: THREE.Object3D | null = intersects[0]?.object ?? null;
    while (hit && !hit.userData?.pieceId && hit.parent && hit.parent !== pieceGroup) {
      hit = hit.parent;
    }
    const pieceId = hit?.userData?.pieceId as string | undefined;
    if (pieceId && hit instanceof THREE.Mesh) {
      return { pieceId, mesh: hit };
    }
  }
  return null;
}

export function Viewport3D(props: Viewport3DProps): ReactElement {
  const {
    boxes,
    bounds: rawBounds,
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
    pieceEdgeBandOverrides,
  } = props;

  const lastValidBoundsRef = useRef<ModuleSpatialBounds>(
    isValidSpatialBounds(rawBounds) ? rawBounds : DEFAULT_FALLBACK_BOUNDS,
  );

  if (isValidSpatialBounds(rawBounds)) {
    lastValidBoundsRef.current = rawBounds;
  }

  // Guard: viewer keeps the last valid bounds if incoming bounds are invalid, empty, NaN, zero or negative
  const bounds = isValidSpatialBounds(rawBounds) ? rawBounds : lastValidBoundsRef.current;

  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const pieceGroupRef = useRef<THREE.Group | null>(null);

  const [webGlSupported, setWebGlSupported] = useState<boolean>(true);
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [showLines, setShowLines] = useState<boolean>(
    props.initialShowLines ?? DEFAULT_UI_CONFIG.showLinesByDefault ?? true,
  );
  const [colorByRole, setColorByRole] = useState<boolean>(
    props.initialColorByRole ?? DEFAULT_UI_CONFIG.colorByRoleByDefault ?? false,
  );
  const [machiningMode, setMachiningMode] = useState<MachiningDisplayMode>(
    props.initialMachiningMode ?? DEFAULT_UI_CONFIG.machiningDisplayModeDefault ?? 'auto',
  );
  const machiningModeRef = useRef(machiningMode);
  machiningModeRef.current = machiningMode;

  const [activeMechId, setActiveMechId] = useState<string>('all');
  const [isKinematicsCollapsed, setIsKinematicsCollapsed] = useState<boolean>(false);
  const [isInspectorCollapsed, setIsInspectorCollapsed] = useState<boolean>(false);
  const [showDimensions, setShowDimensions] = useState<boolean>(
    props.initialShowDimensions ?? DEFAULT_UI_CONFIG.showDimensionsByDefault ?? true,
  );
  const showDimensionsRef = useRef(showDimensions);
  showDimensionsRef.current = showDimensions;

  const [showEdgeBands, setShowEdgeBands] = useState<boolean>(
    props.initialShowEdgeBands ?? DEFAULT_UI_CONFIG.showEdgeBandsByDefault ?? true,
  );

  const hoveredPieceIdRef = useRef<string | null>(null);
  const explodedRatioRef = useRef(explodedRatio);
  explodedRatioRef.current = explodedRatio;

  // Track whether the user has moved or zoomed the camera manually
  const userHasMovedCameraRef = useRef<boolean>(false);
  const prevTargetRef = useRef<{ x: number; y: number; z: number }>({ ...bounds.center });
  const prevModuleIdRef = useRef<string | undefined>(props.moduleId);

  // References for dynamic overlays and grids
  const fadingGridRef = useRef<THREE.LineSegments | null>(null);
  const dimensionLinesGroupRef = useRef<THREE.Group | null>(null);
  const fitDistanceRef = useRef<number>(1500);
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);

  // Direct DOM label element refs for high-performance updates without React re-render churn
  const widthLabelRef = useRef<HTMLDivElement>(null);
  const heightLabelRef = useRef<HTMLDivElement>(null);
  const depthLabelRef = useRef<HTMLDivElement>(null);

  const boundsRef = useRef(bounds);
  boundsRef.current = bounds;

  // Mutable refs to access fresh state in Three.js event listeners without re-initializing WebGL scene
  const selectedPieceIdRef = useRef(selectedPieceId);
  selectedPieceIdRef.current = selectedPieceId;
  const onSelectPieceRef = useRef(onSelectPiece);
  onSelectPieceRef.current = onSelectPiece;
  const kinematicMechanismsRef = useRef(kinematicMechanisms);
  kinematicMechanismsRef.current = kinematicMechanisms;

  // Selected piece data lookup
  const selectedPiece = pieces.find((p) => p.id === selectedPieceId) ?? null;
  const pieceMech = kinematicMechanisms?.find((m) => m.pieceIds.includes(selectedPiece?.id ?? ''));

  // Sync active mechanism when selected piece changes
  useEffect(() => {
    if (pieceMech) {
      setActiveMechId(pieceMech.id);
    }
  }, [selectedPieceId, pieceMech]);

  // Escape key closes inspector and clears piece selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedPieceIdRef.current) {
        onSelectPieceRef.current(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Initialize Three.js scene (runs once on mount)
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

    // Set initial auto-fit camera position looking at center of module
    const initialAspect = width / height;
    const initialFit = calculateCameraFit({
      bounds: boundsRef.current,
      aspect: initialAspect,
      fov: 45,
      fillRatio: DEFAULT_UI_CONFIG.viewerFillRatio ?? 0.85,
    });
    fitDistanceRef.current = initialFit.distance;
    camera.position.set(initialFit.position.x, initialFit.position.y, initialFit.position.z);
    camera.lookAt(initialFit.target.x, initialFit.target.y, initialFit.target.z);
    prevTargetRef.current = { ...initialFit.target };
    userHasMovedCameraRef.current = false;

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

    const maxDim = Math.max(boundsRef.current.size.x, boundsRef.current.size.y, boundsRef.current.size.z, 600);

    // Lights
    const ambientLight = new THREE.AmbientLight(
      0xffffff,
      colorByRole
        ? (DEFAULT_UI_CONFIG.viewerLighting?.ambientColorByRole ?? 1.25)
        : (DEFAULT_UI_CONFIG.viewerLighting?.ambientStandard ?? 0.85),
    );
    scene.add(ambientLight);
    ambientLightRef.current = ambientLight;

    const hemiLight = new THREE.HemisphereLight(
      0xffffff,
      0x8899a6,
      colorByRole
        ? (DEFAULT_UI_CONFIG.viewerLighting?.hemiColorByRole ?? 0.65)
        : (DEFAULT_UI_CONFIG.viewerLighting?.hemiStandard ?? 0.35),
    );
    scene.add(hemiLight);
    hemiLightRef.current = hemiLight;

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.75);
    dirLight1.position.set(maxDim * 2, maxDim * 3, maxDim * 2);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.45);
    dirLight2.position.set(-maxDim * 2, maxDim, -maxDim);
    scene.add(dirLight2);

    const dirLight3 = new THREE.DirectionalLight(0xffffff, 0.35);
    dirLight3.position.set(maxDim * 2, -maxDim, -maxDim * 2);
    scene.add(dirLight3);

    // Subtle fading floor grid (Step A: fades radially toward edges, scales with module)
    const isLightInitial = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
    const grid = createFadingGrid(boundsRef.current, { theme: isLightInitial ? 'light' : 'dark' });
    scene.add(grid);
    fadingGridRef.current = grid;

    // Group for piece meshes
    const pieceGroup = new THREE.Group();
    scene.add(pieceGroup);
    pieceGroupRef.current = pieceGroup;

    // Hover outline helper (distinct visual outline on hover without altering piece material)
    const hoverOutlineGeom = new THREE.BufferGeometry();
    const hoverOutlineMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      linewidth: 2,
      depthTest: false,
    });
    const hoverOutline = new THREE.LineSegments(hoverOutlineGeom, hoverOutlineMat);
    hoverOutline.visible = false;
    hoverOutline.renderOrder = 999;
    scene.add(hoverOutline);

    // Interactive mouse & touch orbit controls
    let isDragging = false;
    let prevX = 0;
    let prevY = 0;
    let initialPinchDist = 0;

    const onRotate = (clientX: number, clientY: number) => {
      const deltaX = (clientX - prevX) * 0.005;
      const deltaY = (clientY - prevY) * 0.005;

      const currentBounds = boundsRef.current;
      const offset = new THREE.Vector3().subVectors(camera.position, currentBounds.center);
      const radius = offset.length();
      let theta = Math.atan2(offset.x, offset.z) + deltaX;
      let phi = Math.acos(Math.max(-0.99, Math.min(0.99, offset.y / radius))) + deltaY;
      phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi));

      camera.position.x = currentBounds.center.x + radius * Math.sin(phi) * Math.sin(theta);
      camera.position.y = currentBounds.center.y + radius * Math.cos(phi);
      camera.position.z = currentBounds.center.z + radius * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(currentBounds.center.x, currentBounds.center.y, currentBounds.center.z);

      prevTargetRef.current = { ...currentBounds.center };
      userHasMovedCameraRef.current = true;

      prevX = clientX;
      prevY = clientY;
    };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
    };

    // Raycaster for piece interaction
    const raycaster = new THREE.Raycaster();

    const onMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        hoverOutline.visible = false;
        onRotate(e.clientX, e.clientY);
        return;
      }

      // Hover raycasting (only when not orbiting)
      if (!rendererRef.current) return;
      const hitResult = raycastPieceAtPointer(
        e.clientX,
        e.clientY,
        rendererRef.current.domElement,
        camera,
        raycaster,
        pieceGroup,
      );

      if (hitResult && hitResult.pieceId !== selectedPieceIdRef.current) {
        hoveredPieceIdRef.current = hitResult.pieceId;
        const mesh = hitResult.mesh;
        mesh.updateWorldMatrix(true, false);
        hoverOutline.geometry.dispose();
        hoverOutline.geometry = new THREE.EdgesGeometry(mesh.geometry);
        hoverOutline.matrixAutoUpdate = false;
        hoverOutline.matrix.copy(mesh.matrixWorld);
        hoverOutline.matrixWorld.copy(mesh.matrixWorld);
        mesh.getWorldPosition(hoverOutline.position);
        mesh.getWorldQuaternion(hoverOutline.quaternion);
        mesh.getWorldScale(hoverOutline.scale);
        hoverOutline.visible = true;
        rendererRef.current.domElement.style.cursor = 'pointer';
        return;
      }
      hoveredPieceIdRef.current = null;
      hoverOutline.visible = false;
      if (rendererRef.current) {
        rendererRef.current.domElement.style.cursor = 'default';
      }
    };

    const onMouseLeave = () => {
      hoveredPieceIdRef.current = null;
      hoverOutline.visible = false;
      if (rendererRef.current) {
        rendererRef.current.domElement.style.cursor = 'default';
      }
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
          const currentBounds = boundsRef.current;
          const offset = new THREE.Vector3().subVectors(camera.position, currentBounds.center);
          offset.multiplyScalar(factor);
          camera.position.addVectors(currentBounds.center, offset);
          camera.lookAt(currentBounds.center.x, currentBounds.center.y, currentBounds.center.z);
          prevTargetRef.current = { ...currentBounds.center };
          userHasMovedCameraRef.current = true;
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
      const currentBounds = boundsRef.current;
      const offset = new THREE.Vector3().subVectors(camera.position, currentBounds.center);
      offset.multiplyScalar(zoomFactor);
      camera.position.addVectors(currentBounds.center, offset);
      camera.lookAt(currentBounds.center.x, currentBounds.center.y, currentBounds.center.z);
      prevTargetRef.current = { ...currentBounds.center };
      userHasMovedCameraRef.current = true;
    };

    const onClick = (e: MouseEvent) => {
      if (!rendererRef.current) return;
      const hitResult = raycastPieceAtPointer(
        e.clientX,
        e.clientY,
        rendererRef.current.domElement,
        camera,
        raycaster,
        pieceGroup,
      );

      if (hitResult) {
        onSelectPieceRef.current(hitResult.pieceId);
        setIsInspectorCollapsed(false);
        const matchingMech = kinematicMechanismsRef.current?.find((m) => m.pieceIds.includes(hitResult.pieceId));
        if (matchingMech) {
          setActiveMechId(matchingMech.id);
        }
      } else {
        onSelectPieceRef.current(null);
      }
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    domElement.addEventListener('mouseleave', onMouseLeave);
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

      // Real-time on-demand 3D machining marks evaluation (Stage 5 Step B)
      const currentMachiningMode = machiningModeRef.current;
      const hoveredId = hoveredPieceIdRef.current;
      const selectedId = selectedPieceIdRef.current;
      const expRatio = explodedRatioRef.current;

      pieceGroup.traverse((child) => {
        if (child.name === 'machining-group' && child.parent) {
          const parentMesh = child.parent as THREE.Mesh;
          const pieceId = parentMesh.userData?.pieceId as string | undefined;

          const pieceCenterWorld = new THREE.Vector3();
          parentMesh.getWorldPosition(pieceCenterWorld);
          const camDistMm = camera.position.distanceTo(pieceCenterWorld);

          const isVisible = shouldShowPieceMachining({
            mode: currentMachiningMode,
            pieceId,
            hoveredPieceId: hoveredId,
            selectedPieceId: selectedId,
            cameraDistanceMm: camDistMm,
            fitDistanceMm: fitDistanceRef.current,
            distanceRatioThreshold: DEFAULT_UI_CONFIG.machiningCameraDistanceRatio,
            explodedRatio: expRatio,
            explodedThreshold: DEFAULT_UI_CONFIG.machiningExplodedThreshold,
          });

          if (child.visible !== isVisible) {
            child.visible = isVisible;
          }
        }
      });

      // Real-time projection of 3D dimension lines to vector DOM labels
      if (showDimensionsRef.current && pieceGroupRef.current && cameraRef.current && containerRef.current) {
        const cw = containerRef.current.clientWidth || 360;
        const ch = containerRef.current.clientHeight || 520;
        const anchors = buildDimensionAnchors(boundsRef.current);
        const projected = projectDimensionLabels(
          anchors,
          cameraRef.current,
          pieceGroupRef.current.matrixWorld,
          cw,
          ch,
          { bounds: boundsRef.current },
        );

        const wItem = projected.find((p) => p.id === 'width');
        const hItem = projected.find((p) => p.id === 'height');
        const dItem = projected.find((p) => p.id === 'depth');

        const updateEl = (el: HTMLDivElement | null, item?: ProjectedDimensionLabel) => {
          if (!el) return;
          if (item && item.visible) {
            el.style.display = 'block';
            el.style.left = `${item.screenX}px`;
            el.style.top = `${item.screenY}px`;
            if (el.textContent !== item.formattedText) {
              el.textContent = item.formattedText;
            }
          } else {
            el.style.display = 'none';
          }
        };

        updateEl(widthLabelRef.current, wItem);
        updateEl(heightLabelRef.current, hItem);
        updateEl(depthLabelRef.current, dItem);
      } else {
        if (widthLabelRef.current) widthLabelRef.current.style.display = 'none';
        if (heightLabelRef.current) heightLabelRef.current.style.display = 'none';
        if (depthLabelRef.current) depthLabelRef.current.style.display = 'none';
      }
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      if (observer) observer.disconnect();
      window.removeEventListener('resize', handleResize);
      domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      domElement.removeEventListener('mouseleave', onMouseLeave);
      domElement.removeEventListener('wheel', onWheel);
      domElement.removeEventListener('click', onClick);
      domElement.removeEventListener('touchstart', onTouchStart);
      domElement.removeEventListener('touchmove', onTouchMove);
      domElement.removeEventListener('touchend', onTouchEnd);

      hoverOutlineGeom.dispose();
      hoverOutlineMat.dispose();

      disposeFadingGrid(fadingGridRef.current);
      disposeDimensionLinesGroup(dimensionLinesGroupRef.current);

      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Reactive updates to camera and fading grid when bounds or active module changes
  useEffect(() => {
    const camera = cameraRef.current;
    const container = containerRef.current;
    const scene = sceneRef.current;
    if (!camera || !container || !scene) return;

    const moduleChanged = prevModuleIdRef.current !== props.moduleId;
    prevModuleIdRef.current = props.moduleId;

    if (moduleChanged || !userHasMovedCameraRef.current) {
      // Apply auto-fit when active module changes or when user has not moved camera manually
      const cw = container.clientWidth || 360;
      const ch = container.clientHeight || 520;
      const fit = calculateCameraFit({
        bounds,
        aspect: cw / ch,
        fov: camera.fov,
        fillRatio: DEFAULT_UI_CONFIG.viewerFillRatio ?? 0.85,
      });
      fitDistanceRef.current = fit.distance;
      camera.up.set(0, 1, 0);
      camera.position.set(fit.position.x, fit.position.y, fit.position.z);
      camera.lookAt(fit.target.x, fit.target.y, fit.target.z);
      prevTargetRef.current = { ...fit.target };
      userHasMovedCameraRef.current = false;
    } else {
      // User moved camera manually: keep camera orientation, relative vector and distance; keep target on module center
      const newPos = calculatePreservedCameraTarget(bounds.center, prevTargetRef.current, camera.position);
      camera.position.set(newPos.x, newPos.y, newPos.z);
      camera.lookAt(bounds.center.x, bounds.center.y, bounds.center.z);
      prevTargetRef.current = { ...bounds.center };
    }

    // Update fading grid for new bounds
    if (fadingGridRef.current) {
      scene.remove(fadingGridRef.current);
      disposeFadingGrid(fadingGridRef.current);
      fadingGridRef.current = null;
    }
    const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
    const newGrid = createFadingGrid(bounds, { theme: isLight ? 'light' : 'dark' });
    scene.add(newGrid);
    fadingGridRef.current = newGrid;
  }, [bounds, props.moduleId]);

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
      const currentTheme: 'light' | 'dark' =
        typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark'
          ? 'dark'
          : 'light';
      const pbrStyle = resolvePiecePbrStyle(
        item.role,
        item.materialId,
        isSelected,
        colorByRole,
        currentTheme,
      );
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
      wire.visible = showLines;
      mesh.add(wire);

      // Visual 3D Machining features (holes, hinge cups, grooves, cutouts)
      if (machiningSheets) {
        const sheet = machiningSheets.find((s) => s.pieceId === item.pieceId);
        if (sheet && (sheet.totalOperations > 0 || (sheet.customOperations && sheet.customOperations.length > 0))) {
          const mGroup = buildPieceMachining3DGroup(sheet, item.sizeMm);
          mGroup.name = 'machining-group';

          const cam = cameraRef.current;
          const pieceCenterWorld = new THREE.Vector3(mesh.position.x, mesh.position.y, mesh.position.z);
          pieceCenterWorld.applyMatrix4(group.matrixWorld);
          const camDistMm = cam ? cam.position.distanceTo(pieceCenterWorld) : 1500;

          const isVisible = shouldShowPieceMachining({
            mode: machiningMode,
            pieceId: item.pieceId,
            hoveredPieceId: hoveredPieceIdRef.current,
            selectedPieceId,
            cameraDistanceMm: camDistMm,
            fitDistanceMm: fitDistanceRef.current,
            distanceRatioThreshold: DEFAULT_UI_CONFIG.machiningCameraDistanceRatio,
            explodedRatio,
            explodedThreshold: DEFAULT_UI_CONFIG.machiningExplodedThreshold,
          });

          mGroup.visible = isVisible;
          mesh.add(mGroup);
        }
      }

      // Edge band highlight ribbons (Stage 5 Step C)
      if (matchedPiece) {
        const pieceOverride = pieceEdgeBandOverrides?.[matchedPiece.id] ?? null;
        const bandedEdges = resolvePieceBandedEdges(matchedPiece, pieceOverride);
        if (bandedEdges.top || bandedEdges.bottom || bandedEdges.left || bandedEdges.right) {
          const edgeColor = resolveEdgeBandHighlightColor(currentTheme);
          const effectiveRibbonThickness = calculateEffectiveEdgeBandThicknessMm({
            physicalThicknessMm: DEFAULT_UI_CONFIG.edgeBandPhysicalThicknessMm,
            cameraDistanceMm: fitDistanceRef.current,
            viewportHeightPx: containerRef.current?.clientHeight ?? 600,
            fovDegrees: 45,
            minScreenPx: DEFAULT_UI_CONFIG.minEdgeBandScreenPx,
          });
          const edgeGroup = buildPieceEdgeBandHighlightGroup(item, bandedEdges, edgeColor, effectiveRibbonThickness);
          edgeGroup.visible = showEdgeBands;
          mesh.add(edgeGroup);
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

    // Exploded view threshold: hide dimensions when exploded above threshold
    const isExplodedAboveThreshold = explodedRatio > (DEFAULT_UI_CONFIG.explodedDimensionThreshold ?? 0.05);
    const effectiveShowDimensions = showDimensions && !isExplodedAboveThreshold;
    showDimensionsRef.current = effectiveShowDimensions;

    // Dimension lines overlay attached as child of pieceGroup (Rule 3.0.1 & Rule 3.0.2)
    if (dimensionLinesGroupRef.current) {
      group.remove(dimensionLinesGroupRef.current);
      disposeDimensionLinesGroup(dimensionLinesGroupRef.current);
      dimensionLinesGroupRef.current = null;
    }
    if (effectiveShowDimensions) {
      const isLight = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light';
      const dimGroup = createDimensionLinesGroup(bounds, { theme: isLight ? 'light' : 'dark' });
      group.add(dimGroup);
      dimensionLinesGroupRef.current = dimGroup;
    }

    // When exploded view changes, keep the whole exploded model inside the viewer:
    // Apply auto-fit to exploded bounds only if user did not move camera by hand
    if (!userHasMovedCameraRef.current && cameraRef.current && containerRef.current) {
      const cw = containerRef.current.clientWidth || 360;
      const ch = containerRef.current.clientHeight || 520;
      const explodedBounds = calculateExplodedSpatialBounds(activeBoxes, bounds);
      const fit = calculateCameraFit({
        bounds: explodedBounds,
        aspect: cw / ch,
        fov: cameraRef.current.fov,
        fillRatio: DEFAULT_UI_CONFIG.viewerFillRatio ?? 0.85,
      });
      fitDistanceRef.current = fit.distance;
      cameraRef.current.position.set(fit.position.x, fit.position.y, fit.position.z);
      cameraRef.current.lookAt(fit.target.x, fit.target.y, fit.target.z);
      prevTargetRef.current = { ...fit.target };
    }
  }, [boxes, bounds, explodedRatio, selectedPieceId, wireframe, showLines, colorByRole, machiningMode, kinematicBoxes, machiningSheets, countertopCalculation, interferences, pieces, showDimensions, showEdgeBands, pieceEdgeBandOverrides]);

  // Handle auto-fit / zoom to fit module
  const handleFitCamera = useCallback(() => {
    const camera = cameraRef.current;
    const container = containerRef.current;
    if (!camera || !container) return;
    const cw = container.clientWidth || 360;
    const ch = container.clientHeight || 520;
    const fit = calculateCameraFit({
      bounds,
      aspect: cw / ch,
      fov: camera.fov,
      fillRatio: DEFAULT_UI_CONFIG.viewerFillRatio ?? 0.85,
    });
    fitDistanceRef.current = fit.distance;
    camera.up.set(0, 1, 0);
    camera.position.set(fit.position.x, fit.position.y, fit.position.z);
    camera.lookAt(fit.target.x, fit.target.y, fit.target.z);
    prevTargetRef.current = { ...fit.target };
    userHasMovedCameraRef.current = false;
  }, [bounds]);

  // Dynamically calibrate ambient and hemisphere lighting when colorByRole is toggled
  useEffect(() => {
    const cfg = DEFAULT_UI_CONFIG.viewerLighting;
    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = colorByRole
        ? (cfg?.ambientColorByRole ?? 1.25)
        : (cfg?.ambientStandard ?? 0.85);
    }
    if (hemiLightRef.current) {
      hemiLightRef.current.intensity = colorByRole
        ? (cfg?.hemiColorByRole ?? 0.65)
        : (cfg?.hemiStandard ?? 0.35);
    }
  }, [colorByRole]);

  // Camera presets
  const setCameraView = (type: CameraPresetView) => {
    const camera = cameraRef.current;
    if (!camera) return;
    const maxDim = Math.max(bounds.size.x, bounds.size.y, bounds.size.z, 600);

    // Reset camera up vector to default (0, 1, 0)
    camera.up.set(0, 1, 0);

    if (type === 'iso') {
      camera.position.set(
        bounds.center.x + maxDim * 1.5,
        bounds.center.y + maxDim * 1.2,
        bounds.center.z - maxDim * 2.0,
      );
    } else if (type === 'front') {
      camera.position.set(bounds.center.x, bounds.center.y, bounds.center.z - maxDim * 2.5);
    } else if (type === 'back') {
      camera.position.set(bounds.center.x, bounds.center.y, bounds.center.z + maxDim * 2.5);
    } else if (type === 'top') {
      camera.up.set(0, 0, 1);
      camera.position.set(bounds.center.x, bounds.center.y + maxDim * 2.8, bounds.center.z);
    } else if (type === 'bottom') {
      camera.up.set(0, 0, -1);
      camera.position.set(bounds.center.x, bounds.center.y - maxDim * 2.8, bounds.center.z);
    } else if (type === 'side' || type === 'right') {
      camera.position.set(bounds.center.x + maxDim * 2.5, bounds.center.y, bounds.center.z);
    } else if (type === 'left') {
      camera.position.set(bounds.center.x - maxDim * 2.5, bounds.center.y, bounds.center.z);
    }

    camera.lookAt(bounds.center.x, bounds.center.y, bounds.center.z);
    prevTargetRef.current = { ...bounds.center };
    userHasMovedCameraRef.current = true;
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
      >
        {showDimensions && explodedRatio <= (DEFAULT_UI_CONFIG.explodedDimensionThreshold ?? 0.05) && (
          <div className="viewer-dimension-labels-layer" aria-hidden="true">
            <div
              ref={widthLabelRef}
              className="viewer-dimension-label viewer-dimension-label--width"
              data-testid="dimension-label-width"
              style={{ display: 'none' }}
            />
            <div
              ref={heightLabelRef}
              className="viewer-dimension-label viewer-dimension-label--height"
              data-testid="dimension-label-height"
              style={{ display: 'none' }}
            />
            <div
              ref={depthLabelRef}
              className="viewer-dimension-label viewer-dimension-label--depth"
              data-testid="dimension-label-depth"
              style={{ display: 'none' }}
            />
          </div>
        )}
      </div>

      {/* Floating Piece Inspector on right side of viewport */}
      {selectedPiece && (
        <div
          className={`viewer-floating-inspector ${isInspectorCollapsed ? 'viewer-floating-inspector--collapsed' : ''}`}
          style={{
            '--inspector-width': `${DEFAULT_UI_CONFIG.inspectorWidthPx ?? 320}px`,
          } as React.CSSProperties}
        >
          {isInspectorCollapsed ? (
            <button
              type="button"
              className="m3-btn m3-btn--tonal viewer-inspector-expand-btn"
              onClick={() => setIsInspectorCollapsed(false)}
              title="Abrir inspector de pieza"
              aria-label="Abrir inspector de pieza"
            >
              <span>🔍 {translatePieceRole(selectedPiece.role)}</span>
              <span aria-hidden="true">◀</span>
            </button>
          ) : (
            <div className="viewer-floating-inspector-inner">
              <div className="viewer-floating-inspector-actions-bar">
                <button
                  type="button"
                  className="viewer-inspector-minimize-btn"
                  onClick={() => setIsInspectorCollapsed(true)}
                  title="Minimizar inspector para no tapar el modelo"
                  aria-label="Minimizar inspector"
                >
                  ▶
                </button>
              </div>
              <PieceInspectorCard
                selectedPiece={selectedPiece}
                machiningSheets={machiningSheets}
                pieceMech={pieceMech}
                kinematicsState={kinematicsState}
                onMechanismOpenRatioChange={onMechanismOpenRatioChange}
                materials={props.materials}
                standardThicknessesMm={props.pieces[0]?.thicknessMm ? [props.pieces[0].thicknessMm] : undefined}
                pieceMaterialOverrides={props.pieceMaterialOverrides}
                onSetPieceMaterial={props.onSetPieceMaterial}
                pieceThicknessOverrides={props.pieceThicknessOverrides}
                onSetPieceThickness={props.onSetPieceThickness}
                pieceEdgeBandOverrides={props.pieceEdgeBandOverrides}
                onSetPieceEdgeBands={props.onSetPieceEdgeBands}
                edgeBands={props.edgeBands}
                pieceJointOverrides={props.pieceJointOverrides}
                jointStrategy={props.defaultJointStrategy}
                onSetPieceJointOverride={props.onSetPieceJointOverride}
                onOpenMachiningModal={props.onOpenMachiningModal}
                shelfDeflections={props.shelfDeflections}
                onSelectPiece={props.onSelectPiece}
              />
            </div>
          )}
        </div>
      )}

      {kinematicMechanisms && kinematicMechanisms.length > 0 && (() => {
        const currentRatio = activeMechId === 'all'
          ? kinematicMechanisms.reduce((acc, m) => acc + (kinematicsState?.[m.id] ?? 0), 0) / kinematicMechanisms.length
          : (kinematicsState?.[activeMechId] ?? 0);
        const isClosed = Math.abs(currentRatio - 0) < 0.05;
        const isFifty = Math.abs(currentRatio - 0.5) < 0.05;
        const isOpen = Math.abs(currentRatio - 1) < 0.05;

        return (
          <div
            className={`m3-kinematics-bar ${isKinematicsCollapsed ? 'is-collapsed' : ''}`}
            role="region"
            aria-label="Controles de cinemática y apertura"
          >
            <div className="m3-kinematics-header">
              <div className="m3-kinematics-title-wrap">
                <span className="m3-kinematics-title">
                  🎮 Cinemática / Apertura:
                </span>
                <button
                  type="button"
                  className="m3-btn m3-btn--text m3-kinematics-collapse-btn"
                  onClick={() => setIsKinematicsCollapsed((prev) => !prev)}
                  aria-expanded={!isKinematicsCollapsed}
                  aria-label={isKinematicsCollapsed ? 'Desplegar controles de cinemática' : 'Plegar controles de cinemática'}
                  title={isKinematicsCollapsed ? 'Desplegar controles' : 'Plegar controles'}
                >
                  {isKinematicsCollapsed ? '▼ Expandir' : '▲ Plegar'}
                </button>
              </div>

              <div className="m3-kinematics-selector-wrap">
                <select
                  aria-label="Seleccionar mecanismo móvil"
                  className="m3-select m3-kinematics-select"
                  value={activeMechId}
                  onChange={(e) => setActiveMechId(e.target.value)}
                >
                  <option value="all">Todos</option>
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
                  className={`m3-btn m3-btn--small ${isClosed ? 'm3-btn--primary is-active' : 'm3-btn--tonal'}`}
                  onClick={() => {
                    if (!onMechanismOpenRatioChange || !kinematicMechanisms) return;
                    if (activeMechId === 'all') {
                      kinematicMechanisms.forEach((m) => onMechanismOpenRatioChange(m.id, 0));
                    } else {
                      onMechanismOpenRatioChange(activeMechId, 0);
                    }
                  }}
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  className={`m3-btn m3-btn--small ${isFifty ? 'm3-btn--primary is-active' : 'm3-btn--tonal'}`}
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
                  className={`m3-btn m3-btn--small ${isOpen ? 'm3-btn--primary is-active' : 'm3-btn--tonal'}`}
                  onClick={() => {
                    if (!onMechanismOpenRatioChange || !kinematicMechanisms) return;
                    if (activeMechId === 'all') {
                      kinematicMechanisms.forEach((m) => onMechanismOpenRatioChange(m.id, 1));
                    } else {
                      onMechanismOpenRatioChange(activeMechId, 1);
                    }
                  }}
                >
                  Abrir
                </button>
              </div>

              <div className="m3-kinematics-slider-row">
                <label htmlFor="kinematics-slider" className="m3-kinematics-slider-label">
                  <span>Deslizador:</span>{' '}
                  <strong>
                    {Math.round(currentRatio * 100)}%
                  </strong>
                </label>
                <input
                  id="kinematics-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={currentRatio}
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
        );
      })()}

      <ViewerToolbar
        onSetCameraView={setCameraView}
        wireframe={wireframe}
        onToggleWireframe={() => setWireframe(!wireframe)}
        showLines={showLines}
        onToggleShowLines={() => setShowLines(!showLines)}
        colorByRole={colorByRole}
        onToggleColorByRole={() => setColorByRole(!colorByRole)}
        machiningMode={machiningMode}
        onChangeMachiningMode={setMachiningMode}
        showMachining3D={machiningMode !== 'no'}
        onToggleMachining3D={() => setMachiningMode(machiningMode === 'no' ? 'auto' : 'no')}
        explodedRatio={explodedRatio}
        onExplodedRatioChange={onExplodedRatioChange}
        onFitCamera={handleFitCamera}
        showDimensions={showDimensions}
        onToggleDimensions={() => setShowDimensions(!showDimensions)}
        showEdgeBands={showEdgeBands}
        onToggleShowEdgeBands={() => setShowEdgeBands(!showEdgeBands)}
      />

      <p className="viewport-touch-hint">
        {selectedPiece ? (
          <>
            🔍 <em>
              Pieza seleccionada: <strong>{translatePieceRole(selectedPiece.role)}</strong>{' '}
              <span className="viewport-piece-id-tag">({selectedPiece.id})</span>
              {(() => {
                const sheet = machiningSheets?.find((s) => s.pieceId === selectedPiece.id);
                const count = countPieceMachiningOperations(sheet);
                return count > 0 ? (
                  <span className="viewport-piece-machining-tag"> · {formatHolesCountText(count)}</span>
                ) : null;
              })()}
              {' '}— Podés editarla en el panel lateral
            </em>
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
