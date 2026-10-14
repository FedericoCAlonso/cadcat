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
} from '../resolver';
import type { JointKind, JointStrategy, Material, EdgeBand } from '../model';
import { translatePieceRole } from './localization';

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
    shelfDeflections,
    pieceJointOverrides,
    onSetPieceJointOverride,
    defaultJointStrategy = 'confirmat',
    kinematicBoxes,
    kinematicMechanisms,
    kinematicsState,
    onMechanismOpenRatioChange,
    materials,
    edgeBands,
    pieceMaterialOverrides,
    pieceThicknessOverrides,
    pieceEdgeBandOverrides,
    onSetPieceMaterial,
    onSetPieceThickness,
    onSetPieceEdgeBands,
    onOpenMachiningModal,
    machiningSheets,
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
  const selectedBox = boxes.find((b) => b.pieceId === selectedPieceId) ?? null;
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
    scene.background = new THREE.Color(0xf0f4f9);

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
    const gridHelper = new THREE.GridHelper(maxDim * 2.5, 20, 0x0b57d0, 0xc4c7c5);
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
      const w = containerRef.current.clientWidth || 360;
      const h = containerRef.current.clientHeight || (window.innerWidth < 1024 ? 360 : 520);
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

  // Update piece meshes when boxes, explosion ratio, wireframe, selection, or kinematics change
  useEffect(() => {
    const group = pieceGroupRef.current;
    if (!group) return;

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
      const geom = new THREE.BoxGeometry(item.sizeMm.x, item.sizeMm.y, item.sizeMm.z);

      const isSelected = item.pieceId === selectedPieceId;
      const baseColor = isSelected ? 0x0b57d0 : 0xd8c8b8;
      const emissiveColor = isSelected ? 0x0842a0 : 0x000000;

      const mat = new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.55,
        metalness: 0.1,
        wireframe,
        emissive: emissiveColor,
        emissiveIntensity: isSelected ? 0.35 : 0.0,
      });

      const mesh = new THREE.Mesh(geom, mat);

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
        color: isSelected ? 0xffffff : 0x444746,
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
  }, [boxes, bounds, explodedRatio, selectedPieceId, wireframe, kinematicBoxes, showMachining3D, machiningSheets]);

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

      <div className="viewport-3d-toolbar">
        {kinematicMechanisms && kinematicMechanisms.length > 0 && (
          <div className="m3-kinematics-bar">
            <div className="m3-kinematics-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="m3-kinematics-title">
                  🎮 Cinemática / Apertura:
                </span>
                <select
                  aria-label="Seleccionar mecanismo móvil"
                  className="m3-select"
                  style={{ fontSize: '0.85rem', padding: '0.2rem 0.5rem' }}
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

              <div style={{ display: 'flex', gap: '0.35rem' }}>
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
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <label htmlFor="kinematics-slider" style={{ fontSize: '0.85rem', minWidth: '130px' }}>
                Deslizador:{' '}
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
                style={{ flex: 1 }}
              />
            </div>
          </div>
        )}

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
        💡 <em>Arrastrá para rotar • Dos dedos o rueda para zoom • Tocá una pieza para inspeccionar</em>
      </p>

      {selectedPiece && selectedBox && (
        <aside aria-label="Selected Piece Inspector" className="viewport-3d-inspector">
          <div className="inspector-header">
            <h4>
              Pieza seleccionada: <strong>{selectedPiece.id}</strong>
              <span className="visually-hidden">{`Selected Piece: ${selectedPiece.id}`}</span>
            </h4>
            <span className="m3-badge m3-badge--neutral">
              {translatePieceRole(selectedPiece.role)}
            </span>
          </div>

          <div className="inspector-grid">
            <p>
              <strong>Función:</strong> {`${translatePieceRole(selectedPiece.role)} (${selectedPiece.role})`}
            </p>
            <p>
              <strong>Espesor:</strong> {`${selectedPiece.thicknessMm} mm`}
            </p>
            <p>
              <strong>Medida terminada:</strong>{' '}
              {`${selectedPiece.dimensionsMm.width} × ${selectedPiece.dimensionsMm.height} mm`}
            </p>
            <p>
              <strong>Corte en sierra:</strong>{' '}
              {`${selectedPiece.cutDimensionsMm.width} × ${selectedPiece.cutDimensionsMm.height} mm`}
            </p>
            <p>
              <strong>Posición 3D (mm):</strong>{' '}
              {`X: ${selectedBox.positionMm.x}, Y: ${selectedBox.positionMm.y}, Z: ${selectedBox.positionMm.z}`}
            </p>
          </div>

          {/* Kinematic mechanism action for selected piece (Point 11) */}
          {pieceMech && (
            <div className="m3-structure-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--md-sys-color-primary)' }}>
                  🚪 Mecanismo: {pieceMech.name}
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
                  {Math.round((kinematicsState?.[pieceMech.id] ?? 0) * 100)}%
                </span>
              </div>
              <input
                aria-label={`Apertura de ${pieceMech.name}`}
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={kinematicsState?.[pieceMech.id] ?? 0}
                onChange={(e) => onMechanismOpenRatioChange?.(pieceMech.id, parseFloat(e.target.value))}
                className="viewport-3d-slider"
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                <button
                  type="button"
                  className="m3-btn m3-btn--small m3-btn--tonal"
                  onClick={() => onMechanismOpenRatioChange?.(pieceMech.id, 0)}
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  className="m3-btn m3-btn--small m3-btn--primary"
                  onClick={() => onMechanismOpenRatioChange?.(pieceMech.id, 1)}
                >
                  Abrir
                </button>
              </div>
            </div>
          )}

          {/* Piece-level Material Override (Point 10) */}
          {materials && materials.length > 0 && (
            <div className="m3-structure-card">
              <label
                htmlFor={`viewport-material-override-${selectedPiece.id}`}
                style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}
              >
                🪵 Material de la Placa:
              </label>
              <select
                id={`viewport-material-override-${selectedPiece.id}`}
                className="m3-select"
                style={{ width: '100%', fontSize: '0.85rem' }}
                value={pieceMaterialOverrides?.[selectedPiece.id] ?? selectedPiece.materialId}
                onChange={(e) => onSetPieceMaterial?.(selectedPiece.id, e.target.value || null)}
              >
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name ?? m.id} ({m.thicknessMm} mm)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Piece-level Thickness Override (Point 10) */}
          <div className="m3-structure-card">
            <label
              htmlFor={`viewport-thickness-override-${selectedPiece.id}`}
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}
            >
              📏 Espesor de Placa (mm):
            </label>
            <input
              id={`viewport-thickness-override-${selectedPiece.id}`}
              type="number"
              className="m3-input"
              style={{ width: '100%', fontSize: '0.85rem', padding: '0.35rem 0.5rem' }}
              min={3}
              max={50}
              value={pieceThicknessOverrides?.[selectedPiece.id] ?? selectedPiece.thicknessMm}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!isNaN(val) && val > 0) {
                  onSetPieceThickness?.(selectedPiece.id, val);
                }
              }}
            />
          </div>

          {/* Piece-level EdgeBand Overrides (Point 10) */}
          <div className="m3-structure-card">
            <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              🏷️ Tapacantos en Bordes:
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem', fontSize: '0.85rem' }}>
              {(['top', 'bottom', 'left', 'right'] as const).map((edgeKey) => {
                const label =
                  edgeKey === 'top'
                    ? 'Superior'
                    : edgeKey === 'bottom'
                    ? 'Inferior'
                    : edgeKey === 'left'
                    ? 'Izquierdo'
                    : 'Derecho';
                const isBanded =
                  pieceEdgeBandOverrides?.[selectedPiece.id]?.[edgeKey] ??
                  selectedPiece.bandedEdges.some((b) => b.faceId.toLowerCase().includes(edgeKey));

                return (
                  <label key={edgeKey} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(isBanded)}
                      onChange={(e) => {
                        const current = pieceEdgeBandOverrides?.[selectedPiece.id] ?? {
                          top: selectedPiece.bandedEdges.some((b) => b.faceId.toLowerCase().includes('top')),
                          bottom: selectedPiece.bandedEdges.some((b) => b.faceId.toLowerCase().includes('bottom')),
                          left: selectedPiece.bandedEdges.some((b) => b.faceId.toLowerCase().includes('left')),
                          right: selectedPiece.bandedEdges.some((b) => b.faceId.toLowerCase().includes('right')),
                        };
                        onSetPieceEdgeBands?.(selectedPiece.id, {
                          ...current,
                          [edgeKey]: e.target.checked,
                        });
                      }}
                    />
                    {label}
                  </label>
                );
              })}
            </div>
            {edgeBands && edgeBands.length > 0 && (
              <div style={{ marginTop: '0.45rem' }}>
                <label
                  htmlFor={`viewport-edgeband-override-${selectedPiece.id}`}
                  style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.2rem', color: 'var(--md-sys-color-on-surface-variant)' }}
                >
                  Tipo / Espesor de Tapacanto:
                </label>
                <select
                  id={`viewport-edgeband-override-${selectedPiece.id}`}
                  className="m3-select"
                  style={{ width: '100%', fontSize: '0.8rem' }}
                  value={pieceEdgeBandOverrides?.[selectedPiece.id]?.edgeBandId ?? ''}
                  onChange={(e) => {
                    const current = pieceEdgeBandOverrides?.[selectedPiece.id] ?? {
                      top: selectedPiece.bandedEdges.some((b) => b.faceId.toLowerCase().includes('top')),
                      bottom: selectedPiece.bandedEdges.some((b) => b.faceId.toLowerCase().includes('bottom')),
                      left: selectedPiece.bandedEdges.some((b) => b.faceId.toLowerCase().includes('left')),
                      right: selectedPiece.bandedEdges.some((b) => b.faceId.toLowerCase().includes('right')),
                    };
                    onSetPieceEdgeBands?.(selectedPiece.id, {
                      ...current,
                      edgeBandId: e.target.value || undefined,
                    });
                  }}
                >
                  <option value="">Por defecto del módulo</option>
                  {edgeBands.map((eb) => (
                    <option key={eb.id} value={eb.id}>
                      {eb.id} ({eb.thicknessMm} mm - {eb.kind})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Custom Machinings Button (Point 8) */}
          {onOpenMachiningModal && (
            <div style={{ marginTop: '0.75rem' }}>
              <button
                type="button"
                className="m3-btn m3-btn--tonal"
                style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem' }}
                onClick={() => onOpenMachiningModal(selectedPiece.id)}
              >
                🛠️ Mecanizar Placa (Ranuras / Fresados / Agujeros)
              </button>
            </div>
          )}

          {/* Piece-level Joint Override (Point 9) */}
          <div className="m3-structure-card">
            <label
              htmlFor={`viewport-joint-override-${selectedPiece.id}`}
              style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}
            >
              🔩 Fijación / Unión para esta placa:
            </label>
            <select
              id={`viewport-joint-override-${selectedPiece.id}`}
              className="m3-select"
              style={{ width: '100%', fontSize: '0.85rem' }}
              value={pieceJointOverrides?.[selectedPiece.id] ?? ''}
              onChange={(e) => {
                const val = e.target.value as JointKind | '';
                onSetPieceJointOverride?.(selectedPiece.id, val ? val : null);
              }}
            >
              <option value="">Por defecto del proyecto ({defaultJointStrategy})</option>
              <option value="cam-dowel">Minifix / Rastex (Oculto sin tornillos pasantes)</option>
              <option value="dowel">Tarugos de madera (Oculto)</option>
              <option value="confirmat">Tornillo pasante (Confirmat)</option>
              <option value="dowel-and-confirmat">Tarugos + Confirmat</option>
              <option value="screw">Tornillo común (Spax)</option>
            </select>
            {pieceJointOverrides?.[selectedPiece.id] && (
              <span className="m3-badge m3-badge--success" style={{ marginTop: '0.35rem', display: 'inline-block' }}>
                ✓ Fijación personalizada: {pieceJointOverrides[selectedPiece.id]}
              </span>
            )}
          </div>

          {shelfDeflections?.get(selectedPiece.id) && (() => {
            const defl = shelfDeflections.get(selectedPiece.id)!;
            return (
              <div
                className={`inspector-deflection-card ${defl.hasWarning ? 'warning' : 'ok'}`}
                style={{
                  marginTop: '0.75rem',
                  padding: '0.65rem 0.85rem',
                  borderRadius: '8px',
                  backgroundColor: defl.hasWarning ? '#ffebee' : '#e8f5e9',
                  border: `1px solid ${defl.hasWarning ? '#ef9a9a' : '#a5d6a7'}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                  <span>{defl.hasWarning ? '⚠️ Deflexión en Estante' : '✓ Deflexión en Estante'}</span>
                </div>
                <p style={{ margin: '0.25rem 0', fontSize: '0.85rem' }}>
                  <strong>Flecha estimada: </strong>
                  {`${defl.calculatedDeflectionMm.toFixed(2)} mm | `}
                  <strong>Máx admisible: </strong>
                  {`${defl.allowableDeflectionMm.toFixed(2)} mm`}
                </p>
                <p style={{ margin: '0.25rem 0', fontSize: '0.82rem', color: '#444746' }}>
                  <strong>Carga: </strong>
                  {`${defl.totalLoadKg.toFixed(1)} kg (${defl.totalLoadN.toFixed(0)} N) | `}
                  <strong>Módulo E: </strong>
                  {`${defl.elasticModulusMPa} MPa ${defl.isElasticModulusConfirmed ? '' : '(TO_CONFIRM)'}`}
                </p>
                {defl.hasWarning && (
                  <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', color: '#b71c1c', fontWeight: 500 }}>
                    {defl.warningMessage}
                  </p>
                )}
              </div>
            );
          })()}

          <button
            type="button"
            className="m3-btn m3-btn--outlined"
            style={{ marginTop: '0.75rem' }}
            onClick={() => onSelectPiece(null)}
          >
            Deseleccionar pieza
            <span className="visually-hidden">Clear Selection</span>
          </button>
        </aside>
      )}
    </section>
  );
}
