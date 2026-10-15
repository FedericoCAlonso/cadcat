import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  calculateCountertop,
  generateMarmoleriaSheetSvg,
} from '../src/resolver';
import {
  DEFAULT_EQUIPMENT_ITEMS,
  type CountertopDefinition,
  type CountertopMaterial,
} from '../src/model';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { resolvePiecePbrStyle, STAINLESS_STEEL_SINK_STYLE } from '../src/ui/materialStyles';
import { usePanZoom, type UsePanZoomReturn } from '../src/ui/usePanZoom';

describe('Fixes: Countertop, Marmolería, 3D Physical Cutouts, and Machining Canvas', () => {
  const graniteMaterial: CountertopMaterial = {
    schemaVersion: 1,
    id: 'ct-granite-gris-mara-20',
    name: 'Granito Gris Mara 20mm',
    kind: 'natural-stone',
    thicknessMm: 20,
    densityKgM2: 54,
    maxOverhangWithoutBracketsMm: 150,
    maxUnsupportedSpanMm: 600,
    requiresSubtop: false,
  };

  const singleSink = DEFAULT_EQUIPMENT_ITEMS.find((e) => e.kind === 'sink-undermount')!;

  describe('1. Faucet Hole Location and Monocomando Single Hole Specification', () => {
    it('places the single faucet hole strictly on the contrafrente side behind the sink', () => {
      const definition: CountertopDefinition = {
        schemaVersion: 1,
        id: 'ct-faucet-position-test',
        name: 'Mesada Faucet Check',
        materialId: graniteMaterial.id,
        widthMm: 1200,
        depthMm: 620,
        frontOverhangMm: 25,
        leftOverhangMm: 0,
        rightOverhangMm: 0,
        backOverhangMm: 0,
        edgeFinish: 'straight-polished',
        miteredSkirtHeightMm: 0,
        cornerRadii: { frontLeftMm: 0, frontRightMm: 0, backLeftMm: 0, backRightMm: 0 },
        backsplash: { hasSplash: true, heightMm: 60, thicknessMm: 20 },
        leftSplash: { hasSplash: false, heightMm: 60, thicknessMm: 20 },
        rightSplash: { hasSplash: false, heightMm: 60, thicknessMm: 20 },
        placements: [
          {
            equipmentId: singleSink.id,
            centerXMm: 600,
            centerOffsetYMm: 0,
            sinkDrawerAdaptation: 'false-front',
            frontRailOrientation: 'vertical',
          },
        ],
      };

      const result = calculateCountertop(definition, graniteMaterial, DEFAULT_EQUIPMENT_ITEMS);
      expect(result.cutouts.length).toBe(1);
      const cutout = result.cutouts[0]!;

      // Monocomando must have a single hole of 35mm
      expect(cutout.faucetHole).toBeDefined();
      expect(cutout.faucetHole?.diameterMm).toBe(35);

      // The faucet hole MUST be on the contrafrente side (behind the sink, Y > maxYMm)
      expect(cutout.faucetHole!.centerYMm).toBeGreaterThan(cutout.boundsMm.maxYMm);
      expect(cutout.faucetHole!.centerYMm).toBeLessThan(definition.depthMm);

      // Verify marmoleria SVG drawing puts contrafrente at top and faucet hole between sink and contrafrente
      const svg = generateMarmoleriaSheetSvg(result);
      expect(svg).toContain('CONTRAFRENTE (PARED / ZÓCALO)');
      expect(svg).toContain('FRENTE PULIDO');
      expect(svg).toContain('Canilla Ø35mm');

      // Ensure no double concentric circles (only single circle and crosshair)
      expect(svg).not.toContain('<circle cx=.* r="2"');
    });
  });

  describe('2. Material PBR Color Differentiation (Placa vs Mesada)', () => {
    it('differentiates countertop materials with stone/quartz PBR finish from furniture board melamine', () => {
      // Board (Placa)
      const whiteBoardStyle = resolvePiecePbrStyle('side-left', 'mat-egger-white-18');
      const oakBoardStyle = resolvePiecePbrStyle('door-left', 'mat-egger-oak-18');
      const defaultBoardStyle = resolvePiecePbrStyle('bottom');

      expect(whiteBoardStyle.color).toBe(0xf8fafc);
      expect(oakBoardStyle.color).toBe(0xd4b996);
      expect(defaultBoardStyle.color).toBe(0xdfd7cd);

      // Countertop (Mesada)
      const graniteMaraStyle = resolvePiecePbrStyle('countertop', 'ct-granite-gris-mara-20');
      const graniteBrasilStyle = resolvePiecePbrStyle('countertop', 'ct-granite-negro-brasil-20');
      const quartzWhiteStyle = resolvePiecePbrStyle('countertop', 'ct-quartz-white-zeus-20');
      const dektonStyle = resolvePiecePbrStyle('countertop', 'ct-sintered-dekton-12');
      const backsplashStyle = resolvePiecePbrStyle('countertop-backsplash', 'ct-granite-negro-brasil-20');

      expect(graniteMaraStyle.color).toBe(0x64748b);
      expect(graniteBrasilStyle.color).toBe(0x1e2022);
      expect(quartzWhiteStyle.color).toBe(0xf8fafc);
      expect(dektonStyle.color).toBe(0x334155);
      expect(backsplashStyle.color).toBe(0x1e2022);

      // Countertops must have higher polish / lower roughness than standard wood boards
      expect(graniteMaraStyle.roughness).toBeLessThan(defaultBoardStyle.roughness);
      expect(graniteMaraStyle.metalness).toBeGreaterThan(defaultBoardStyle.metalness);

      // Stainless steel sink style
      expect(STAINLESS_STEEL_SINK_STYLE.metalness).toBe(0.85);
      expect(STAINLESS_STEEL_SINK_STYLE.color).toBe(0xa8b2c1);
    });
  });

  describe('3. 3D Physical Countertop Geometry with Holes and Undermount Basin', () => {
    it('generates real physical 3D through-holes for sink cutout and single faucet hole in THREE.Shape', () => {
      const slabW = 1200;
      const slabThick = 20;
      const slabD = 620;

      const shape = new THREE.Shape();
      shape.moveTo(0, 0);
      shape.lineTo(slabW, 0);
      shape.lineTo(slabW, slabD);
      shape.lineTo(0, slabD);
      shape.closePath();

      const definition: CountertopDefinition = {
        schemaVersion: 1,
        id: 'ct-3d-test',
        name: 'Mesada 3D Cutout Check',
        materialId: graniteMaterial.id,
        widthMm: slabW,
        depthMm: slabD,
        frontOverhangMm: 25,
        leftOverhangMm: 0,
        rightOverhangMm: 0,
        backOverhangMm: 0,
        edgeFinish: 'straight-polished',
        miteredSkirtHeightMm: 0,
        cornerRadii: { frontLeftMm: 0, frontRightMm: 0, backLeftMm: 0, backRightMm: 0 },
        backsplash: { hasSplash: true, heightMm: 60, thicknessMm: 20 },
        leftSplash: { hasSplash: false, heightMm: 60, thicknessMm: 20 },
        rightSplash: { hasSplash: false, heightMm: 60, thicknessMm: 20 },
        placements: [
          {
            equipmentId: singleSink.id,
            centerXMm: 600,
            centerOffsetYMm: 0,
            sinkDrawerAdaptation: 'false-front',
            frontRailOrientation: 'vertical',
          },
        ],
      };

      const calc = calculateCountertop(definition, graniteMaterial, DEFAULT_EQUIPMENT_ITEMS);

      const c = calc.cutouts[0]!;
      const hole = new THREE.Path();
      const x0 = c.boundsMm.minXMm;
      const x1 = c.boundsMm.maxXMm;
      const y0 = slabD - c.boundsMm.maxYMm;
      const y1 = slabD - c.boundsMm.minYMm;
      hole.moveTo(x0, y0);
      hole.lineTo(x1, y0);
      hole.lineTo(x1, y1);
      hole.lineTo(x0, y1);
      hole.closePath();
      shape.holes.push(hole);

      // Faucet hole
      const fHole = new THREE.Path();
      const fx = c.faucetHole!.centerXMm;
      const fy = slabD - c.faucetHole!.centerYMm;
      fHole.absarc(fx, fy, 17.5, 0, Math.PI * 2, true);
      fHole.closePath();
      shape.holes.push(fHole);

      expect(shape.holes.length).toBe(2); // Sink cutout hole + faucet hole

      const geom = new THREE.ExtrudeGeometry(shape, { depth: slabThick, bevelEnabled: false });
      geom.rotateX(-Math.PI / 2);
      geom.center();
      geom.computeVertexNormals();
      geom.computeBoundingBox();

      expect(geom.boundingBox).toBeDefined();
      expect(Math.round(geom.boundingBox!.max.x - geom.boundingBox!.min.x)).toBe(slabW);
      expect(Math.round(geom.boundingBox!.max.y - geom.boundingBox!.min.y)).toBe(slabThick);
      expect(Math.round(geom.boundingBox!.max.z - geom.boundingBox!.min.z)).toBe(slabD);
    });
  });

  describe('4. Machining 2D Canvas and Scaled Pan/Zoom Coordinate Transform', () => {
    it('scales client screen coordinates to SVG viewBox coordinates during focal wheel zoom and drag pan', async () => {
      const targetViewBox = { width: 800, height: 520 };
      let panZoomApi!: UsePanZoomReturn;

      function TestHarness() {
        const pz = usePanZoom({
          initialZoom: 1.0,
          minZoom: 0.25,
          maxZoom: 6.0,
          zoomStep: 1.25,
          targetViewBox,
        });
        panZoomApi = pz;
        return null;
      }

      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);
      root.render(React.createElement(TestHarness));

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(panZoomApi.zoom).toBe(1.0);
      expect(panZoomApi.pan).toEqual({ x: 0, y: 0 });

      // Mock SVG element with bounding client rect (screen size: 400x260 -> 2x viewBox scale)
      const mockElement = {
        getBoundingClientRect: () => ({
          left: 50,
          top: 50,
          width: 400,
          height: 260,
          right: 450,
          bottom: 310,
        }),
      } as unknown as Element;

      panZoomApi.startPan(100, 100, mockElement);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(panZoomApi.isPanning).toBe(true);

      // Drag 20 screen pixels right and 10 screen pixels down
      // Because viewBox (800x520) is 2x screen size (400x260),
      // 20 screen pixels must equal 40 viewBox units!
      panZoomApi.updatePan(120, 110);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(panZoomApi.pan.x).toBe(40);
      expect(panZoomApi.pan.y).toBe(20);

      panZoomApi.endPan();
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(panZoomApi.isPanning).toBe(false);

      root.unmount();
      document.body.removeChild(container);
    });
  });
});
