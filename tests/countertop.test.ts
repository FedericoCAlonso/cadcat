import { describe, it, expect } from 'vitest';
import {
  calculateCountertop,
  adaptCabinetForEquipment,
  generateMarmoleriaSheetSvg,
  exportMarmoleriaPdf,
  createPiece,
  createRectangularContour,
  type ResolvedPiece,
} from '../src/resolver';
import {
  type CountertopDefinition,
  DEFAULT_COUNTERTOP_MATERIALS,
  DEFAULT_EQUIPMENT_ITEMS,
} from '../src/model';

describe('Phase 3: Countertop & Built-In Equipment Solver', () => {
  const graniteMaterial = DEFAULT_COUNTERTOP_MATERIALS.find(
    (m) => m.id === 'ct-granite-gris-mara-20',
  )!;
  const singleSink = DEFAULT_EQUIPMENT_ITEMS.find(
    (e) => e.id === 'eq-sink-johnson-luxon-ln50',
  )!;
  const gasCooktop = DEFAULT_EQUIPMENT_ITEMS.find(
    (e) => e.id === 'eq-cooktop-domec-gas-4',
  )!;

  describe('1. Physical and Structural Countertop Calculations', () => {
    it('calculates physical area, weight, and perimeter accurately', () => {
      const definition: CountertopDefinition = {
        id: 'ct-main',
        name: 'Mesada Principal',
        materialId: graniteMaterial.id,
        widthMm: 2000,
        depthMm: 600,
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
        placements: [],
      };

      const result = calculateCountertop(definition, graniteMaterial, DEFAULT_EQUIPMENT_ITEMS);

      // Area = 2.0 * 0.6 = 1.2 m²
      expect(result.areaM2).toBe(1.2);
      // Weight = 1.2 m² * 54 kg/m² = 64.8 kg
      expect(result.totalWeightKg).toBe(64.8);
      // Perimeter = 2 * (2.0 + 0.6) = 5.2 m
      expect(result.perimeterMeters).toBe(5.2);
      expect(result.backsplashPieces.length).toBe(1);
      expect(result.backsplashPieces[0]?.dimensionsMm.width).toBe(2000);
      expect(result.backsplashPieces[0]?.dimensionsMm.height).toBe(60);
    });

    it('warns when cantilever overhang exceeds material structural limit', () => {
      const definition: CountertopDefinition = {
        id: 'ct-breakfast-bar',
        name: 'Barra Desayunadora en Voladizo',
        materialId: graniteMaterial.id,
        widthMm: 1600,
        depthMm: 900,
        frontOverhangMm: 350, // 350mm exceeds granite limit of 150mm
        leftOverhangMm: 0,
        rightOverhangMm: 0,
        backOverhangMm: 0,
        edgeFinish: 'straight-polished',
        miteredSkirtHeightMm: 0,
        cornerRadii: { frontLeftMm: 0, frontRightMm: 0, backLeftMm: 0, backRightMm: 0 },
        backsplash: { hasSplash: false, heightMm: 60, thicknessMm: 20 },
        leftSplash: { hasSplash: false, heightMm: 60, thicknessMm: 20 },
        rightSplash: { hasSplash: false, heightMm: 60, thicknessMm: 20 },
        placements: [],
      };

      const result = calculateCountertop(definition, graniteMaterial, DEFAULT_EQUIPMENT_ITEMS);

      expect(result.overhangAnalysis.needsBrackets).toBe(true);
      expect(result.overhangAnalysis.warnings.length).toBeGreaterThan(0);
      expect(result.overhangAnalysis.warnings[0]).toContain('supera el límite sin refuerzo');
    });
  });

  describe('2. Cutouts, Safety Bridges and Seam Crossing', () => {
    it('computes cutout dimensions, faucet hole, and verifies stone bridge safety', () => {
      const definition: CountertopDefinition = {
        id: 'ct-sink-test',
        name: 'Mesada con Bacha Simple',
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
            sinkDrawerAdaptation: 'false-front',
            frontRailOrientation: 'vertical',
          },
        ],
      };

      const result = calculateCountertop(definition, graniteMaterial, DEFAULT_EQUIPMENT_ITEMS);

      expect(result.cutouts.length).toBe(1);
      const cutout = result.cutouts[0]!;
      expect(cutout.boundsMm.widthMm).toBe(singleSink.cutout.widthMm);
      expect(cutout.boundsMm.depthMm).toBe(singleSink.cutout.depthMm);
      expect(cutout.isSafeStoneBridge).toBe(true);
      expect(cutout.faucetHole).toBeDefined();
      expect(cutout.faucetHole?.diameterMm).toBe(35);
      expect(cutout.faucetHole?.centerXMm).toBe(600);
    });

    it('detects when equipment crosses a cabinet joint seam', () => {
      const definition: CountertopDefinition = {
        id: 'ct-crossing-test',
        name: 'Mesada con Bacha Desplazada',
        materialId: graniteMaterial.id,
        widthMm: 1600,
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
            // Placed at X=800, right across the seam of two 800mm cabinets!
            centerXMm: 800,
            sinkDrawerAdaptation: 'false-front',
            frontRailOrientation: 'vertical',
          },
        ],
      };

      // Two supporting cabinets of 800mm each (seam at X=800mm)
      const cabinetWidths = [800, 800];
      const result = calculateCountertop(
        definition,
        graniteMaterial,
        DEFAULT_EQUIPMENT_ITEMS,
        cabinetWidths,
      );

      expect(result.jointCrossings.length).toBe(1);
      expect(result.jointCrossings[0]?.crossesJoint).toBe(true);
      expect(result.jointCrossings[0]?.crossedJointXMm).toBe(800);
      expect(result.jointCrossings[0]?.warning).toContain('cruza la unión entre módulos');
    });
  });

  describe('3. Base Cabinet Structural Adaptation', () => {
    function createMockSinkCabinet(): ResolvedPiece[] {
      return [
        {
          ...createPiece({
            id: 'side-left',
            role: 'side-left',
            materialId: 'mat-1',
            contour: createRectangularContour(560, 800),
            thicknessMm: 18,
          }),
          positionMm: { x: 0, y: 0, z: 0 },
          dimensionsMm: { width: 560, height: 800 },
        },
        {
          ...createPiece({
            id: 'side-right',
            role: 'side-right',
            materialId: 'mat-1',
            contour: createRectangularContour(560, 800),
            thicknessMm: 18,
          }),
          positionMm: { x: 782, y: 0, z: 0 },
          dimensionsMm: { width: 560, height: 800 },
        },
        {
          ...createPiece({
            id: 'rail-front',
            role: 'rail-front',
            materialId: 'mat-1',
            contour: createRectangularContour(764, 70),
            thicknessMm: 18,
          }),
          positionMm: { x: 18, y: 20, z: 782 },
          dimensionsMm: { width: 764, height: 70 },
        },
        // Top drawer
        {
          ...createPiece({
            id: 'front-top',
            role: 'drawer-front',
            materialId: 'mat-1',
            contour: createRectangularContour(796, 180),
            thicknessMm: 18,
          }),
          positionMm: { x: 2, y: 600, z: 0 },
          dimensionsMm: { width: 796, height: 180 },
        },
        {
          ...createPiece({
            id: 'drawer-box-side-l1',
            role: 'drawer-side-left',
            materialId: 'mat-1',
            contour: createRectangularContour(500, 120),
            thicknessMm: 15,
          }),
          positionMm: { x: 30, y: 610, z: 20 },
          dimensionsMm: { width: 500, height: 120 },
        },
        {
          ...createPiece({
            id: 'drawer-box-bottom-1',
            role: 'drawer-bottom',
            materialId: 'mat-1',
            contour: createRectangularContour(700, 490),
            thicknessMm: 3,
          }),
          positionMm: { x: 35, y: 605, z: 20 },
          dimensionsMm: { width: 700, height: 490 },
        },
        // Bottom drawer
        {
          ...createPiece({
            id: 'front-bottom',
            role: 'drawer-front',
            materialId: 'mat-1',
            contour: createRectangularContour(796, 380),
            thicknessMm: 18,
          }),
          positionMm: { x: 2, y: 100, z: 0 },
          dimensionsMm: { width: 796, height: 380 },
        },
        {
          ...createPiece({
            id: 'drawer-box-bottom-2',
            role: 'drawer-bottom',
            materialId: 'mat-1',
            contour: createRectangularContour(700, 490),
            thicknessMm: 3,
          }),
          positionMm: { x: 35, y: 105, z: 20 },
          dimensionsMm: { width: 700, height: 490 },
        },
      ];
    }

    it('rotates front rail on edge (vertical) and converts top drawer to false-front', () => {
      const mockCabinet = createMockSinkCabinet();
      const adaptation = adaptCabinetForEquipment(
        mockCabinet,
        singleSink,
        {
          equipmentId: singleSink.id,
          centerXMm: 400,
          sinkDrawerAdaptation: 'false-front',
          frontRailOrientation: 'vertical',
        },
        0,
      );

      // Verify front rail orientation
      const adaptedRail = adaptation.cabinetPieces.find((p) => p.role === 'rail-front');
      expect(adaptedRail).toBeDefined();
      expect(adaptedRail?.dimensionsMm.height).toBe(70);

      // Verify top drawer front became false-front
      const falseFront = adaptation.cabinetPieces.find((p) => p.role === 'false-front');
      expect(falseFront).toBeDefined();
      expect(falseFront?.id).toBe('front-top');

      // Verify top drawer box pieces were removed
      expect(adaptation.removedPieceIds).toContain('drawer-box-side-l1');
      expect(adaptation.removedPieceIds).toContain('drawer-box-bottom-1');

      // Verify bottom drawer box was NOT removed
      const bottomDrawerBottom = adaptation.cabinetPieces.find((p) => p.id === 'drawer-box-bottom-2');
      expect(bottomDrawerBottom).toBeDefined();

      expect(adaptation.appliedAdaptations.summary.length).toBeGreaterThanOrEqual(2);
    });

    it('supports U-shape drawer adaptation keeping drawer functional', () => {
      const mockCabinet = createMockSinkCabinet();
      const adaptation = adaptCabinetForEquipment(
        mockCabinet,
        singleSink,
        {
          equipmentId: singleSink.id,
          centerXMm: 400,
          sinkDrawerAdaptation: 'u-shape-drawer',
          frontRailOrientation: 'vertical',
        },
        0,
      );

      // No box pieces should be deleted in U-shape mode
      expect(adaptation.removedPieceIds.length).toBe(0);
      expect(adaptation.appliedAdaptations.sinkDrawerAdaptation).toBe('u-shape-drawer');
      expect(adaptation.appliedAdaptations.summary.some((s) => s.includes('escote en U'))).toBe(true);
    });
  });

  describe('4. Marmolería Workshop Drawing and PDF Export', () => {
    it('generates technical SVG drawing with dimensions, cutouts and polished edge markings', () => {
      const definition: CountertopDefinition = {
        id: 'ct-marmoleria',
        name: 'Mesada Isla Central',
        materialId: graniteMaterial.id,
        widthMm: 1800,
        depthMm: 620,
        frontOverhangMm: 25,
        leftOverhangMm: 0,
        rightOverhangMm: 0,
        backOverhangMm: 0,
        edgeFinish: 'straight-polished',
        miteredSkirtHeightMm: 0,
        cornerRadii: { frontLeftMm: 20, frontRightMm: 20, backLeftMm: 0, backRightMm: 0 },
        backsplash: { hasSplash: true, heightMm: 60, thicknessMm: 20 },
        leftSplash: { hasSplash: false, heightMm: 60, thicknessMm: 20 },
        rightSplash: { hasSplash: false, heightMm: 60, thicknessMm: 20 },
        placements: [
          {
            equipmentId: singleSink.id,
            centerXMm: 900,
            sinkDrawerAdaptation: 'false-front',
            frontRailOrientation: 'vertical',
          },
        ],
      };

      const result = calculateCountertop(definition, graniteMaterial, DEFAULT_EQUIPMENT_ITEMS);
      const svg = generateMarmoleriaSheetSvg(result);

      expect(svg).toContain('<svg');
      expect(svg).toContain('viewBox="0 0 1000 650"');
      expect(svg).toContain('PLANO DE MARMOLERÍA');
      expect(svg).toContain(graniteMaterial.name);
      expect(svg).toContain('Largo Total: 1800 mm');
      expect(svg).toContain('Profundidad: 620 mm');
      expect(svg).toContain('FRENTE PULIDO');
      expect(svg).toContain('Zócalo Trasero: 1800 x 60 x 20 mm');
      expect(svg).toContain(`Calado: ${singleSink.cutout.widthMm} x ${singleSink.cutout.depthMm}`);
      expect(svg).toContain('Canilla Ø35mm');
    });

    it('exports technical PDF ready for stone fabricator', () => {
      const definition: CountertopDefinition = {
        id: 'ct-pdf-test',
        name: 'Mesada Cocina PDF',
        materialId: graniteMaterial.id,
        widthMm: 1800,
        depthMm: 600,
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
            centerXMm: 900,
            sinkDrawerAdaptation: 'false-front',
            frontRailOrientation: 'vertical',
          },
        ],
      };

      const result = calculateCountertop(definition, graniteMaterial, DEFAULT_EQUIPMENT_ITEMS);
      const doc = exportMarmoleriaPdf(result, 'Plano Técnico Mesada');

      expect(doc).toBeDefined();
      const output = doc.output();
      expect(output.length).toBeGreaterThan(1000);
      expect(output).toContain('%PDF');
    });
  });
});

