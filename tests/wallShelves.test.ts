import { describe, it, expect } from 'vitest';
import {
  solveBrackets,
  buildWallShelving,
  generateInstallationSheetSvg,
  getRecommendedAnchor,
  type WallShelvingDefinition,
} from '../src/resolver';

describe('Wall Shelving System with Brackets (Estanterías con Ménsulas)', () => {
  const defaultDef: WallShelvingDefinition = {
    id: 'shelving-test-1',
    widthMm: 1200,
    depthMm: 250,
    thicknessMm: 18,
    shelfCount: 3,
    verticalSpacingMm: 320,
    bracketType: 'l-bracket',
    wallType: 'solid-brick',
    loadCategory: 'medium',
    boundaryCondition: 'free-ends',
    overhangMode: 'balanced-cantilever',
    materialId: 'mat-egger-white-18',
    edgeBandId: 'band-pvc-0.45',
    baseElevationYMm: 800,
  };

  describe('1. Structural Bracket Solver & Sagulator Integration', () => {
    it('calculates loads and brackets for standard shelf', () => {
      const result = solveBrackets(defaultDef);

      expect(result.bracketCountPerShelf).toBeGreaterThanOrEqual(2);
      expect(result.totalBrackets).toBe(result.bracketCountPerShelf * defaultDef.shelfCount);
      expect(result.bracketPositionsMm.length).toBe(result.bracketCountPerShelf);
      expect(result.calculatedDeflectionMm).toBeLessThanOrEqual(result.allowableDeflectionMm);
      expect(result.pullOutForceN).toBeGreaterThan(0);
      expect(result.pullOutForceKg).toBeGreaterThan(0);
    });

    it('increases bracket count when span and load are heavy to prevent sag', () => {
      const lightDef: WallShelvingDefinition = {
        ...defaultDef,
        widthMm: 1800,
        loadCategory: 'light',
      };
      const heavyDef: WallShelvingDefinition = {
        ...defaultDef,
        widthMm: 1800,
        loadCategory: 'heavy',
      };

      const lightRes = solveBrackets(lightDef);
      const heavyRes = solveBrackets(heavyDef);

      expect(heavyRes.designLoadKgM2).toBe(60);
      expect(lightRes.designLoadKgM2).toBe(15);
      expect(heavyRes.bracketCountPerShelf).toBeGreaterThanOrEqual(lightRes.bracketCountPerShelf);
    });

    it('positions brackets according to overhangMode', () => {
      const flush = solveBrackets({ ...defaultDef, overhangMode: 'flush-ends' });
      expect(flush.cantileverMm).toBeLessThanOrEqual(50);
      expect(flush.bracketPositionsMm[0]).toBe(flush.cantileverMm);

      const cantilever = solveBrackets({ ...defaultDef, overhangMode: 'balanced-cantilever' });
      expect(cantilever.cantileverMm).toBeGreaterThan(flush.cantileverMm);

      const stud = solveBrackets({
        ...defaultDef,
        wallType: 'drywall',
        overhangMode: 'stud-aligned',
      });
      // Spacing between brackets should be 400mm
      const span = stud.bracketPositionsMm[1]! - stud.bracketPositionsMm[0]!;
      expect(span).toBe(400);
    });

    it('warns when floating-pin bracket is used on thin panel (< 22mm)', () => {
      const thinRes = solveBrackets({
        ...defaultDef,
        thicknessMm: 18,
        bracketType: 'floating-pin',
      });
      expect(thinRes.warning).toBeDefined();
      expect(thinRes.warning).toContain('insuficiente');

      const thickRes = solveBrackets({
        ...defaultDef,
        thicknessMm: 25,
        bracketType: 'floating-pin',
      });
      expect(thickRes.warning).toBeUndefined();
    });

    it('provides correct anchor recommendation per wall type', () => {
      const solid = getRecommendedAnchor('solid-brick');
      expect(solid.brandModel).toContain('DuoPower');
      expect(solid.diameterMm).toBe(8);

      const hollow = getRecommendedAnchor('hollow-brick');
      expect(hollow.lengthMm).toBe(65);
      expect(hollow.notes).toContain('hueco');

      const drywall = getRecommendedAnchor('drywall');
      expect(drywall.notes).toContain('yeso');
    });
  });

  describe('2. Piece Generation, Edge Banding & Clearance', () => {
    it('creates exact number of shelf pieces with correct dimensions', () => {
      const output = buildWallShelving(defaultDef);

      expect(output.module.pieces.length).toBe(3);
      output.module.pieces.forEach((p, idx) => {
        expect(p.role).toBe('wall-shelf');
        expect(p.id).toBe(`shelving-test-1-shelf-${idx}`);
        expect(p.contour.points[1]!.x).toBe(1200);
        expect(p.contour.points[2]!.y).toBe(250);
      });
    });

    it('applies edge banding to front, left, and right edges when free-ends', () => {
      const output = buildWallShelving({
        ...defaultDef,
        boundaryCondition: 'free-ends',
      });

      const shelf = output.module.pieces[0]!;
      const front = shelf.faces.find((f) => f.id === 'bottom-edge');
      const left = shelf.faces.find((f) => f.id === 'left-edge');
      const right = shelf.faces.find((f) => f.id === 'right-edge');
      const rear = shelf.faces.find((f) => f.id === 'top-edge');

      expect(front?.edgeBandId).toBe('band-pvc-0.45');
      expect(left?.edgeBandId).toBe('band-pvc-0.45');
      expect(right?.edgeBandId).toBe('band-pvc-0.45');
      expect(rear?.edgeBandId).toBeUndefined(); // Rear against wall is raw
    });

    it('applies 3mm clearance and bands only front edge when between-walls (niche)', () => {
      const output = buildWallShelving({
        ...defaultDef,
        widthMm: 1000,
        boundaryCondition: 'between-walls',
      });

      const shelf = output.module.pieces[0]!;
      // 1000 - 3 = 997mm
      expect(shelf.contour.points[1]!.x).toBe(997);

      const front = shelf.faces.find((f) => f.id === 'bottom-edge');
      const left = shelf.faces.find((f) => f.id === 'left-edge');
      const right = shelf.faces.find((f) => f.id === 'right-edge');

      expect(front?.edgeBandId).toBe('band-pvc-0.45');
      expect(left?.edgeBandId).toBeUndefined(); // Left against wall
      expect(right?.edgeBandId).toBeUndefined(); // Right against wall
    });
  });

  describe('3. Machinings and Operations', () => {
    it('generates rear edge boreholes for floating-pin brackets', () => {
      const output = buildWallShelving({
        ...defaultDef,
        thicknessMm: 25,
        bracketType: 'floating-pin',
      });

      const drills = output.operations.filter((op) => op.kind === 'drill');
      expect(drills.length).toBe(output.bracketCalculation.totalBrackets);

      drills.forEach((d) => {
        expect(d.kind).toBe('drill');
        if (d.kind === 'drill') {
          expect(d.faceType).toBe('edge');
          expect(d.diameterMm).toBe(12);
          expect(d.depthMm).toBe(120);
        }
      });
    });

    it('generates underside pilot holes for L-bracket fixing screws', () => {
      const output = buildWallShelving({
        ...defaultDef,
        bracketType: 'l-bracket',
      });

      const drills = output.operations.filter((op) => op.kind === 'drill');
      // 2 pilot holes per bracket
      expect(drills.length).toBe(output.bracketCalculation.totalBrackets * 2);

      drills.forEach((d) => {
        expect(d.kind).toBe('drill');
        if (d.kind === 'drill') {
          expect(d.faceType).toBe('face-B');
          expect(d.diameterMm).toBe(3);
        }
      });
    });
  });

  describe('4. Hardware BOM & Installation Points', () => {
    it('computes exact brackets, wall anchors, and fixing screws', () => {
      const output = buildWallShelving(defaultDef);

      const bom = output.hardwareBOM;
      const brackets = bom.find((i) => i.id === 'hw-l-bracket');
      const screws = bom.find((i) => i.id === 'hw-shelf-screws');
      const anchors = bom.find((i) => i.id === 'hw-wall-anchor');

      expect(brackets).toBeDefined();
      expect(brackets!.quantity).toBe(output.bracketCalculation.totalBrackets);
      expect(screws!.quantity).toBe(output.bracketCalculation.totalBrackets * 2);
      expect(anchors!.quantity).toBe(output.bracketCalculation.totalBrackets * 2);
    });

    it('computes wall drilling coordinates for installation', () => {
      const output = buildWallShelving({
        ...defaultDef,
        baseElevationYMm: 900,
        verticalSpacingMm: 350,
      });

      const pts = output.installationPoints;
      expect(pts.length).toBe(output.bracketCalculation.totalBrackets);

      // Shelf 0 elevation = 900
      const shelf0Pts = pts.filter((p) => p.shelfIndex === 0);
      shelf0Pts.forEach((p) => expect(p.yMm).toBe(900));

      // Shelf 1 elevation = 1250
      const shelf1Pts = pts.filter((p) => p.shelfIndex === 1);
      shelf1Pts.forEach((p) => expect(p.yMm).toBe(1250));
    });
  });

  describe('5. SVG Installation Sheet Generator', () => {
    it('generates valid SVG string with wall datum, laser line, and dimensions', () => {
      const output = buildWallShelving(defaultDef);
      const svg = generateInstallationSheetSvg(output, defaultDef);

      expect(svg).toContain('<svg');
      expect(svg).toContain('</svg>');
      expect(svg).toContain('PLANO DE REPLANTEO');
      expect(svg).toContain('NPT');
      expect(svg).toContain('Línea Láser');
      expect(svg).toContain('ESPECIFICACIONES DE INSTALACIÓN');
      expect(svg).toContain(output.bracketCalculation.recommendedAnchor.brandModel);
    });
  });
});
