import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { renderToString } from 'react-dom/server';
import {
  resolvePieceBandedEdges,
  resolveEdgeBandHighlightColor,
  buildPieceEdgeBandHighlightGroup,
  calculateEffectiveEdgeBandThicknessMm,
} from '../src/ui/viewer/edgeBandHighlight';
import { ViewerToolbar } from '../src/ui/ViewerToolbar';
import type { SpatialPieceBox, ResolvedPieceWithCutSize } from '../src/resolver';
import { DEFAULT_UI_CONFIG } from '../src/config';

describe('Stage 5 Step C: 3D Edge Banding Highlighting & Toolbar Controls', () => {
  describe('resolvePieceBandedEdges', () => {
    it('detects banded edges from piece.bandedEdges list', () => {
      const mockPiece: ResolvedPieceWithCutSize = {
        id: 'piece-side-1',
        role: 'side-left',
        materialId: 'mat-1',
        thicknessMm: 18,
        contour: {
          points: [
            { x: 0, y: 0 },
            { x: 560, y: 0 },
            { x: 560, y: 720 },
            { x: 0, y: 720 },
          ],
        },
        faces: [],
        structural: true,
        referenceFace: 'A',
        positionMm: { x: 0, y: 0, z: 0 },
        dimensionsMm: { width: 560, height: 720 },
        cutDimensionsMm: { width: 559, height: 719 },
        cutContour: {
          points: [
            { x: 0, y: 0 },
            { x: 559, y: 0 },
            { x: 559, y: 719 },
            { x: 0, y: 719 },
          ],
        },
        bandedEdges: [
          { faceId: 'face-left', edgeBandId: 'eb-1', thicknessMm: 0.45, lengthMm: 720 },
          { faceId: 'face-bottom', edgeBandId: 'eb-1', thicknessMm: 0.45, lengthMm: 560 },
        ],
      };

      const result = resolvePieceBandedEdges(mockPiece);
      expect(result.left).toBe(true);
      expect(result.bottom).toBe(true);
      expect(result.top).toBe(false);
      expect(result.right).toBe(false);
    });

    it('prioritizes piece-level overrides over piece default banded edges', () => {
      const mockPiece: ResolvedPieceWithCutSize = {
        id: 'piece-shelf-1',
        role: 'shelf',
        materialId: 'mat-1',
        thicknessMm: 18,
        contour: {
          points: [
            { x: 0, y: 0 },
            { x: 560, y: 0 },
            { x: 560, y: 300 },
            { x: 0, y: 300 },
          ],
        },
        faces: [],
        structural: false,
        referenceFace: 'A',
        positionMm: { x: 18, y: 350, z: 0 },
        dimensionsMm: { width: 560, height: 300 },
        cutDimensionsMm: { width: 560, height: 300 },
        cutContour: {
          points: [
            { x: 0, y: 0 },
            { x: 560, y: 0 },
            { x: 560, y: 300 },
            { x: 0, y: 300 },
          ],
        },
        bandedEdges: [
          { faceId: 'face-bottom', edgeBandId: 'eb-1', thicknessMm: 0.45, lengthMm: 560 },
        ],
      };

      // User manually overrides top to true and bottom to false
      const result = resolvePieceBandedEdges(mockPiece, {
        top: true,
        bottom: false,
      });

      expect(result.top).toBe(true);
      expect(result.bottom).toBe(false);
    });
  });

  describe('resolveEdgeBandHighlightColor', () => {
    it('resolves distinct colors from config for light and dark themes', () => {
      const colorLight = resolveEdgeBandHighlightColor('light');
      const colorDark = resolveEdgeBandHighlightColor('dark');

      const expectedLight = parseInt(DEFAULT_UI_CONFIG.edgeBandHighlightColor.light.replace('#', ''), 16);
      const expectedDark = parseInt(DEFAULT_UI_CONFIG.edgeBandHighlightColor.dark.replace('#', ''), 16);

      expect(colorLight).toBe(expectedLight);
      expect(colorDark).toBe(expectedDark);

      // Must be completely different from white outline (0xffffff) and selection violet (0x7e57c2 / 0x9575cd)
      expect(colorLight).not.toBe(0xffffff);
      expect(colorLight).not.toBe(0x7e57c2);
      expect(colorDark).not.toBe(0xffffff);
      expect(colorDark).not.toBe(0x9575cd);
    });
  });

  describe('buildPieceEdgeBandHighlightGroup & Coordinate Transform (scale.x = -1)', () => {
    it('creates 3D highlight strips matching banded edges on a piece box', () => {
      const box: SpatialPieceBox = {
        pieceId: 'p-side-1',
        role: 'side-left',
        materialId: 'mat-1',
        thicknessMm: 18,
        positionMm: { x: 9, y: 360, z: 280 },
        centerMm: { x: 9, y: 360, z: 280 },
        sizeMm: { x: 18, y: 720, z: 560 },
      };

      const group = buildPieceEdgeBandHighlightGroup(
        box,
        { top: true, bottom: false, left: true, right: false },
        0xff8f00,
      );

      expect(group.name).toBe('edgeband-group');
      // Should have 2 highlight strips: top and left (front edge)
      expect(group.children.length).toBe(2);
      expect(group.children[0]?.name).toBe('edgeband-strip');
      expect(group.children[1]?.name).toBe('edgeband-strip');
    });

    it('correctly aligns edge band highlight on an off-center piece under pieceGroup transform (scale.x = -1)', () => {
      const boundsCenter = { x: 300, y: 400, z: 280 };

      // Off-center piece: right side at x = 591 (centered at x = 591, y = 360, z = 280)
      const offCenterBox: SpatialPieceBox = {
        pieceId: 'p-side-right',
        role: 'side-right',
        materialId: 'mat-1',
        thicknessMm: 18,
        positionMm: { x: 591, y: 360, z: 280 },
        centerMm: { x: 591, y: 360, z: 280 },
        sizeMm: { x: 18, y: 720, z: 560 },
      };

      // Create parent pieceGroup with mirrored scale.x = -1 and position.x = 2 * bounds.center.x
      const pieceGroup = new THREE.Group();
      pieceGroup.scale.x = -1;
      pieceGroup.position.x = 2 * boundsCenter.x; // 600

      // Create piece mesh at local position
      const pieceGeom = new THREE.BoxGeometry(offCenterBox.sizeMm.x, offCenterBox.sizeMm.y, offCenterBox.sizeMm.z);
      const pieceMat = new THREE.MeshBasicMaterial();
      const pieceMesh = new THREE.Mesh(pieceGeom, pieceMat);
      pieceMesh.position.set(offCenterBox.positionMm.x, offCenterBox.positionMm.y, offCenterBox.positionMm.z);

      // Add edge band highlight group as child of piece mesh
      const edgeGroup = buildPieceEdgeBandHighlightGroup(
        offCenterBox,
        { top: true, bottom: false, left: true, right: false },
        0xff8f00,
      );
      pieceMesh.add(edgeGroup);
      pieceGroup.add(pieceMesh);

      // Update matrices
      pieceGroup.updateMatrixWorld(true);

      // World bounding box of the piece mesh
      const pieceBBox = new THREE.Box3().setFromObject(pieceMesh);
      // World bounding box of the edge band highlight
      const edgeBBox = new THREE.Box3().setFromObject(edgeGroup);

      // In the world under pieceGroup mirroring:
      // x = 591 mirrored around 600 -> world x center is 600 - 591 = 9 mm!
      const pieceCenterWorld = new THREE.Vector3();
      pieceBBox.getCenter(pieceCenterWorld);
      expect(Math.round(pieceCenterWorld.x)).toBe(9);

      // The edge band highlight must be contained within or tightly hugging the piece world bounds
      expect(edgeBBox.min.x).toBeGreaterThanOrEqual(pieceBBox.min.x - 2);
      expect(edgeBBox.max.x).toBeLessThanOrEqual(pieceBBox.max.x + 2);
      expect(edgeBBox.min.y).toBeGreaterThanOrEqual(pieceBBox.min.y - 2);
      expect(edgeBBox.max.y).toBeLessThanOrEqual(pieceBBox.max.y + 2);
    });
  });

  describe('ViewerToolbar Cantos Toggle Button', () => {
    it('renders the "Cantos" button in the toolbar with accessible label and state', () => {
      const handleToggle = vi.fn();
      const html = renderToString(
        <ViewerToolbar
          onSetCameraView={vi.fn()}
          wireframe={false}
          showLines={true}
          explodedRatio={0}
          onExplodedRatioChange={vi.fn()}
          showEdgeBands={true}
          onToggleShowEdgeBands={handleToggle}
        />,
      );

      expect(html).toContain('Cantos ON');
      expect(html).toContain('m3-btn--primary is-active');
    });

    it('renders "Cantos OFF" when showEdgeBands is false', () => {
      const html = renderToString(
        <ViewerToolbar
          onSetCameraView={vi.fn()}
          wireframe={false}
          showLines={true}
          explodedRatio={0}
          onExplodedRatioChange={vi.fn()}
          showEdgeBands={false}
          onToggleShowEdgeBands={vi.fn()}
        />,
      );

      expect(html).toContain('Cantos OFF');
      expect(html).toContain('m3-btn--outlined');
    });

    it('renders the toolbar with all 5 render toggles without error at narrow widths 320, 360, and 390 px', () => {
      const widths = [320, 360, 390];
      for (const w of widths) {
        const html = renderToString(
          <div style={{ width: `${w}px` }}>
            <ViewerToolbar
              onSetCameraView={vi.fn()}
              wireframe={false}
              showLines={true}
              onToggleShowLines={vi.fn()}
              colorByRole={false}
              onToggleColorByRole={vi.fn()}
              machiningMode="auto"
              onChangeMachiningMode={vi.fn()}
              showDimensions={true}
              onToggleDimensions={vi.fn()}
              showEdgeBands={true}
              onToggleShowEdgeBands={vi.fn()}
              explodedRatio={0}
              onExplodedRatioChange={vi.fn()}
              onFitCamera={vi.fn()}
            />
          </div>,
        );

        // Verify all 5 toggle buttons exist in output
        expect(html).toContain('Líneas ON');
        expect(html).toContain('Rol OFF');
        expect(html).toContain('Mecanizados Auto');
        expect(html).toContain('Cotas ON');
        expect(html).toContain('Cantos ON');
      }
    });
  });

  describe('calculateEffectiveEdgeBandThicknessMm (minimum screen space width)', () => {
    it('uses physical thickness when camera is close', () => {
      // Close inspection at 400mm distance, viewport 844px height
      const thickness = calculateEffectiveEdgeBandThicknessMm({
        physicalThicknessMm: 1.2,
        cameraDistanceMm: 400,
        viewportHeightPx: 844,
        fovDegrees: 45,
        minScreenPx: 2.5,
      });

      // At 400mm: frustum height = 331.37mm -> 0.39mm/px -> 2.5px * 0.39 = 0.98mm < 1.2mm
      expect(thickness).toBe(1.2);
    });

    it('scales up ribbon thickness at auto-fit distance to guarantee minimum screen pixels', () => {
      // Auto-fit distance at 2720mm, viewport 844px height
      const thickness = calculateEffectiveEdgeBandThicknessMm({
        physicalThicknessMm: 1.2,
        cameraDistanceMm: 2720,
        viewportHeightPx: 844,
        fovDegrees: 45,
        minScreenPx: 2.5,
      });

      // At 2720mm: frustum height = 2253.3mm -> 2.67mm/px -> 2.5px * 2.67 = ~6.67mm > 1.2mm
      expect(thickness).toBeGreaterThan(6.0);
      expect(thickness).toBeLessThan(7.5);
    });
  });

  describe('Fix Commit A: Edge Band Highlight Line Style', () => {
    it('ensures projected width is 3 px or less at 390x844 and 1366x768 viewports', () => {
      const box: SpatialPieceBox = {
        pieceId: 'drawer-front-1',
        role: 'drawer-front',
        materialId: 'mat-front',
        thicknessMm: 18,
        positionMm: { x: 250, y: 100, z: 10 },
        centerMm: { x: 250, y: 100, z: 10 },
        sizeMm: { x: 495, y: 140, z: 18 },
      };

      for (const [w, h] of [[390, 844], [1366, 768]] as const) {
        const group = buildPieceEdgeBandHighlightGroup(
          box,
          { top: true, bottom: true, left: true, right: true },
          0xe91e63,
          {
            style: 'line',
            lineWidthPx: DEFAULT_UI_CONFIG.edgeBandLineWidthPx,
            viewportResolution: { width: w, height: h },
          },
        );

        expect(group.children.length).toBe(4);
        for (const child of group.children) {
          expect(child).toBeInstanceOf(LineSegments2);
          const mat = (child as LineSegments2).material as LineMaterial;
          expect(mat).toBeInstanceOf(LineMaterial);
          // Projected width must be 3 px or less
          expect(mat.linewidth).toBeLessThanOrEqual(3);
          expect(mat.linewidth).toBe(DEFAULT_UI_CONFIG.edgeBandLineWidthPx);
          // Resolution matches viewport
          expect(mat.resolution.x).toBe(w);
          expect(mat.resolution.y).toBe(h);
        }
      }
    });

    it('verifies world position with an off-center piece does not stick out of the piece', () => {
      const boundsCenter = { x: 300, y: 400, z: 280 };

      // Off-center drawer front in right bay
      const offCenterBox: SpatialPieceBox = {
        pieceId: 'bay-2-drawer-front-1',
        role: 'drawer-front',
        materialId: 'mat-front',
        thicknessMm: 18,
        positionMm: { x: 450, y: 150, z: 20 },
        centerMm: { x: 450, y: 150, z: 20 },
        sizeMm: { x: 280, y: 140, z: 18 },
      };

      const pieceGroup = new THREE.Group();
      pieceGroup.scale.x = -1;
      pieceGroup.position.x = 2 * boundsCenter.x;

      const pieceGeom = new THREE.BoxGeometry(offCenterBox.sizeMm.x, offCenterBox.sizeMm.y, offCenterBox.sizeMm.z);
      const pieceMesh = new THREE.Mesh(pieceGeom, new THREE.MeshBasicMaterial());
      pieceMesh.position.set(offCenterBox.positionMm.x, offCenterBox.positionMm.y, offCenterBox.positionMm.z);

      const edgeGroup = buildPieceEdgeBandHighlightGroup(
        offCenterBox,
        { top: true, bottom: true, left: true, right: true },
        0xe91e63,
        {
          style: 'line',
          lineWidthPx: 2,
          viewportResolution: { width: 390, height: 844 },
        },
      );
      pieceMesh.add(edgeGroup);
      pieceGroup.add(pieceMesh);

      pieceGroup.updateMatrixWorld(true);

      const pieceBBox = new THREE.Box3().setFromObject(pieceMesh);
      const edgeBBox = new THREE.Box3().setFromObject(edgeGroup);

      // The highlight lines must tightly hug the piece without sticking out
      expect(edgeBBox.min.x).toBeGreaterThanOrEqual(pieceBBox.min.x - 0.5);
      expect(edgeBBox.max.x).toBeLessThanOrEqual(pieceBBox.max.x + 0.5);
      expect(edgeBBox.min.y).toBeGreaterThanOrEqual(pieceBBox.min.y - 0.5);
      expect(edgeBBox.max.y).toBeLessThanOrEqual(pieceBBox.max.y + 0.5);
      expect(edgeBBox.min.z).toBeGreaterThanOrEqual(pieceBBox.min.z - 0.5);
      expect(edgeBBox.max.z).toBeLessThanOrEqual(pieceBBox.max.z + 0.5);
    });

    it('preserves full face style in code for Stage 8 realistic materials', () => {
      const box: SpatialPieceBox = {
        pieceId: 'drawer-front-1',
        role: 'drawer-front',
        materialId: 'mat-front',
        thicknessMm: 18,
        positionMm: { x: 250, y: 100, z: 10 },
        centerMm: { x: 250, y: 100, z: 10 },
        sizeMm: { x: 495, y: 140, z: 18 },
      };

      const group = buildPieceEdgeBandHighlightGroup(
        box,
        { top: true, bottom: false, left: false, right: false },
        0xe91e63,
        {
          style: 'face',
          ribbonThicknessMm: 1.2,
        },
      );

      expect(group.children.length).toBe(1);
      expect(group.children[0]).toBeInstanceOf(THREE.Mesh);
      const mesh = group.children[0] as THREE.Mesh;
      expect(mesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
      expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    });
  });
});
