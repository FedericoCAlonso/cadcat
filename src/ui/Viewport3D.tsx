import { useEffect, useRef, useState, type ReactElement } from 'react';
import * as THREE from 'three';
import {
  type SpatialPieceBox,
  type ModuleSpatialBounds,
  calculateExplodedBoxes,
  type ResolvedPieceWithCutSize,
  type ShelfDeflectionResult,
} from '../resolver';

export interface Viewport3DProps {
  boxes: SpatialPieceBox[];
  bounds: ModuleSpatialBounds;
  pieces: ResolvedPieceWithCutSize[];
  explodedRatio: number;
  onExplodedRatioChange: (val: number) => void;
  selectedPieceId: string | null;
  onSelectPiece: (pieceId: string | null) => void;
  shelfDeflections?: Map<string, ShelfDeflectionResult>;
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
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const pieceGroupRef = useRef<THREE.Group | null>(null);

  const [webGlSupported, setWebGlSupported] = useState<boolean>(true);
  const [wireframe, setWireframe] = useState<boolean>(false);

  // Selected piece data lookup
  const selectedPiece = pieces.find((p) => p.id === selectedPieceId) ?? null;
  const selectedBox = boxes.find((b) => b.pieceId === selectedPieceId) ?? null;

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

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 540;

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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
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

    // Interactive mouse drag orbit controls
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = (e.clientX - prevMouseX) * 0.005;
      const deltaY = (e.clientY - prevMouseY) * 0.005;

      const offset = new THREE.Vector3().subVectors(camera.position, bounds.center);
      const radius = offset.length();
      let theta = Math.atan2(offset.x, offset.z) + deltaX;
      let phi = Math.acos(Math.max(-0.99, Math.min(0.99, offset.y / radius))) + deltaY;
      phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi));

      camera.position.x = bounds.center.x + radius * Math.sin(phi) * Math.sin(theta);
      camera.position.y = bounds.center.y + radius * Math.cos(phi);
      camera.position.z = bounds.center.z + radius * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(bounds.center.x, bounds.center.y, bounds.center.z);

      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseUp = () => {
      isDragging = false;
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

    // Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      domElement.removeEventListener('wheel', onWheel);
      domElement.removeEventListener('click', onClick);

      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [bounds]);

  // Update piece meshes when boxes, explosion ratio, wireframe, or selection changes
  useEffect(() => {
    const group = pieceGroupRef.current;
    if (!group) return;

    // Clear existing meshes
    while (group.children.length > 0) {
      const child = group.children[0];
      if (!child) break;
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
      group.remove(child);
    }

    const exploded = calculateExplodedBoxes(boxes, bounds, explodedRatio);

    for (const item of exploded) {
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
      // Box position is at its center
      const posX = item.explodedPositionMm.x + item.sizeMm.x / 2;
      const posY = item.explodedPositionMm.y + item.sizeMm.y / 2;
      const posZ = item.explodedPositionMm.z + item.sizeMm.z / 2;
      mesh.position.set(posX, posY, posZ);

      mesh.userData = { pieceId: item.pieceId, role: item.role };

      // Edges helper for clear outline
      const edges = new THREE.EdgesGeometry(geom);
      const lineMat = new THREE.LineBasicMaterial({
        color: isSelected ? 0xffffff : 0x444746,
        linewidth: 1,
      });
      const wire = new THREE.LineSegments(edges, lineMat);
      mesh.add(wire);

      group.add(mesh);
    }
  }, [boxes, bounds, explodedRatio, selectedPieceId, wireframe]);

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
        <h2 id="viewport-heading" className="m3-card__title">3D Module Viewport</h2>
        <p className="m3-card__subtitle">
          Interactive 3D view with exploded inspection and face selection.
        </p>
      </div>

      {!webGlSupported && (
        <div className="error-state" role="alert">
          WebGL is not supported or hardware acceleration is disabled in your environment.
        </div>
      )}

      <div
        ref={containerRef}
        className="viewport-3d-canvas-wrapper"
        data-testid="viewport-3d-canvas-wrapper"
      />

      <div className="viewport-3d-toolbar">
        <div className="viewport-3d-slider-group">
          <label htmlFor="exploded-slider">
            {`Exploded View: `}
            <strong>{`${Math.round(explodedRatio * 100)}%`}</strong>
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

        <div className="m3-button-row" style={{ marginTop: 0 }}>
          <button
            type="button"
            className="m3-btn m3-btn--tonal"
            onClick={() => setCameraView('iso')}
          >
            Isometric
          </button>
          <button
            type="button"
            className="m3-btn m3-btn--tonal"
            onClick={() => setCameraView('front')}
          >
            Front
          </button>
          <button
            type="button"
            className="m3-btn m3-btn--tonal"
            onClick={() => setCameraView('top')}
          >
            Top
          </button>
          <button
            type="button"
            className="m3-btn m3-btn--tonal"
            onClick={() => setCameraView('side')}
          >
            Side
          </button>
          <button
            type="button"
            className="m3-btn m3-btn--outlined"
            onClick={() => setWireframe(!wireframe)}
          >
            {wireframe ? 'Solid' : 'Wireframe'}
          </button>
        </div>
      </div>

      {selectedPiece && selectedBox && (
        <aside aria-label="Selected Piece Inspector" className="viewport-3d-inspector">
          <h4>{`Selected Piece: ${selectedPiece.id}`}</h4>
          <p>
            <strong>Role:</strong> {`${selectedPiece.role} | `}
            <strong>Thickness:</strong> {`${selectedPiece.thicknessMm} mm`}
          </p>
          <p>
            <strong>Finished Dimensions:</strong>{' '}
            {`${selectedPiece.dimensionsMm.width} × ${selectedPiece.dimensionsMm.height} mm`}
          </p>
          <p>
            <strong>Cut Dimensions:</strong>{' '}
            {`${selectedPiece.cutDimensionsMm.width} × ${selectedPiece.cutDimensionsMm.height} mm`}
          </p>
          <p>
            <strong>3D Position (mm):</strong>{' '}
            {`X: ${selectedBox.positionMm.x}, Y: ${selectedBox.positionMm.y}, Z: ${selectedBox.positionMm.z}`}
          </p>

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
            Clear Selection
          </button>
        </aside>
      )}
    </section>
  );
}
