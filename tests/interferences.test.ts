import { describe, it, expect } from 'vitest';
import {
  columnObstacleSchema,
  falseSquareSchema,
  interferenceConfigSchema,
  secondaryCutSchema,
  type Material,
} from '../src/model';
import {
  resolveCarcass,
  buildModularModule,
  extractPieceLabelData,
  type ModuleMaterialRoles,
} from '../src/resolver';
import { ShelvesBayResolver } from '../src/resolver/composition/resolvers/shelvesBayResolver';

describe('Laboratorio de Interferencias Arquitectónicas (Hito 2)', () => {
  const materials: ModuleMaterialRoles = {
    carcassMaterialId: 'mat-egger-white-18',
    frontsMaterialId: 'mat-egger-oak-18',
    drawerBoxesMaterialId: 'mat-mdf-white-15',
    backingsMaterialId: 'mat-mdf-white-3',
  };

  describe('2.1 Model & Schemas', () => {
    it('validates columnObstacleSchema with valid dimensions', () => {
      const valid = {
        enabled: true,
        corner: 'back-left',
        widthMm: 150,
        depthMm: 120,
      };
      const parsed = columnObstacleSchema.parse(valid);
      expect(parsed.enabled).toBe(true);
      expect(parsed.corner).toBe('back-left');
      expect(parsed.widthMm).toBe(150);
      expect(parsed.depthMm).toBe(120);
    });

    it('rejects columnObstacleSchema with non-positive dimensions', () => {
      expect(() =>
        columnObstacleSchema.parse({
          enabled: true,
          corner: 'back-left',
          widthMm: -10,
          depthMm: 100,
        }),
      ).toThrow();
    });

    it('validates falseSquareSchema with distinct depths', () => {
      const valid = {
        enabled: true,
        leftDepthMm: 560,
        rightDepthMm: 500,
      };
      const parsed = falseSquareSchema.parse(valid);
      expect(parsed.leftDepthMm).toBe(560);
      expect(parsed.rightDepthMm).toBe(500);
    });

    it('validates secondaryCutSchema with notch and bevel operations', () => {
      const notch = secondaryCutSchema.parse({
        type: 'notch',
        description: 'Destaje columna 150x120mm',
        corner: 'back-left',
        widthMm: 150,
        depthMm: 120,
      });
      expect(notch.type).toBe('notch');
      expect(notch.corner).toBe('back-left');

      const bevel = secondaryCutSchema.parse({
        type: 'bevel-diagonal',
        description: 'Chaflán falsa escuadra 560mm a 500mm',
        angleDeg: 6.8,
      });
      expect(bevel.type).toBe('bevel-diagonal');
      expect(bevel.angleDeg).toBe(6.8);
    });

    it('validates complete interferenceConfigSchema', () => {
      const config = interferenceConfigSchema.parse({
        columnObstacle: {
          enabled: true,
          corner: 'back-right',
          widthMm: 200,
          depthMm: 150,
        },
        falseSquare: {
          enabled: false,
          leftDepthMm: 560,
          rightDepthMm: 560,
        },
      });
      expect(config.columnObstacle?.enabled).toBe(true);
      expect(config.falseSquare?.enabled).toBe(false);
    });
  });

  describe('2.2 AnchorSolver - Columna en Rincón Trasero (back-left)', () => {
    it('shortens side-left depth and creates notched bottom and cover piece', () => {
      const res = resolveCarcass({
        carcass: {
          width: 800,
          height: 720,
          depth: 560,
          jointPriority: 'lateral-over-bottom',
          roofType: 'solid-panel',
          hasBacking: false,
        },
        carcassMaterialId: materials.carcassMaterialId,
        carcassThicknessMm: 18,
        interferences: {
          columnObstacle: {
            enabled: true,
            corner: 'back-left',
            widthMm: 150,
            depthMm: 120,
          },
        },
      });

      const sideLeft = res.pieces.find((p) => p.role === 'side-left');
      const sideRight = res.pieces.find((p) => p.role === 'side-right');
      const bottom = res.pieces.find((p) => p.role === 'bottom');
      const top = res.pieces.find((p) => p.role === 'top');
      const columnCover = res.pieces.find((p) => p.role === 'column-cover-side');

      expect(sideLeft).toBeDefined();
      expect(sideRight).toBeDefined();
      expect(bottom).toBeDefined();
      expect(top).toBeDefined();
      expect(columnCover).toBeDefined();

      // side-left depth reduced to 560 - 120 = 440
      expect(sideLeft!.contour.points[1]!.x).toBe(440);
      expect(sideLeft!.secondaryCuts).toBeDefined();
      expect(sideLeft!.secondaryCuts![0]?.type).toBe('notch');

      // side-right depth remains nominal 560
      expect(sideRight!.contour.points[1]!.x).toBe(560);

      // bottom has 6 points notch in back-left
      expect(bottom!.contour.points.length).toBe(6);
      expect(bottom!.rawBoundingBox).toEqual({ widthMm: 800 - 2 * 18, heightMm: 560 });
      expect(bottom!.secondaryCuts).toBeDefined();
      expect(bottom!.secondaryCuts![0]?.type).toBe('notch');
      expect(bottom!.secondaryCuts![0]?.corner).toBe('back-left');
      // notch width is widthMm - T = 150 - 18 = 132
      expect(bottom!.secondaryCuts![0]?.widthMm).toBe(132);
      expect(bottom!.secondaryCuts![0]?.depthMm).toBe(120);

      // top also has 6 points notch
      expect(top!.contour.points.length).toBe(6);
      expect(top!.rawBoundingBox).toEqual({ widthMm: 800 - 2 * 18, heightMm: 560 });

      // columnCover vertical piece has depth 120
      expect(columnCover!.contour.points[1]!.x).toBe(120);
    });

    it('adapts rear rail when roofType is front-back-rails with column', () => {
      const res = resolveCarcass({
        carcass: {
          width: 800,
          height: 720,
          depth: 560,
          jointPriority: 'lateral-over-bottom',
          roofType: 'front-back-rails',
          railWidthMm: 80,
          hasBacking: false,
        },
        carcassMaterialId: materials.carcassMaterialId,
        carcassThicknessMm: 18,
        interferences: {
          columnObstacle: {
            enabled: true,
            corner: 'back-left',
            widthMm: 150,
            depthMm: 120,
          },
        },
      });

      const railFront = res.pieces.find((p) => p.id.includes('rail-front'));
      const railBack = res.pieces.find((p) => p.id.includes('rail-back'));

      expect(railFront).toBeDefined();
      expect(railBack).toBeDefined();

      // rail-front is full interior width = 800 - 36 = 764
      expect(railFront!.contour.points[1]!.x).toBe(764);

      // rail-back is shortened by notch width: 764 - (150 - 18) = 764 - 132 = 632
      expect(railBack!.contour.points[1]!.x).toBe(632);
    });
  });

  describe('2.3 AnchorSolver - Columna en Rincón Trasero (back-right)', () => {
    it('shortens side-right depth and creates notched bottom on back-right', () => {
      const res = resolveCarcass({
        carcass: {
          width: 800,
          height: 720,
          depth: 560,
          jointPriority: 'lateral-over-bottom',
          roofType: 'solid-panel',
          hasBacking: false,
        },
        carcassMaterialId: materials.carcassMaterialId,
        carcassThicknessMm: 18,
        interferences: {
          columnObstacle: {
            enabled: true,
            corner: 'back-right',
            widthMm: 160,
            depthMm: 110,
          },
        },
      });

      const sideLeft = res.pieces.find((p) => p.role === 'side-left');
      const sideRight = res.pieces.find((p) => p.role === 'side-right');
      const bottom = res.pieces.find((p) => p.role === 'bottom');

      expect(sideLeft!.contour.points[1]!.x).toBe(560);
      expect(sideRight!.contour.points[1]!.x).toBe(450); // 560 - 110 = 450

      expect(bottom!.contour.points.length).toBe(6);
      expect(bottom!.secondaryCuts![0]?.type).toBe('notch');
      expect(bottom!.secondaryCuts![0]?.corner).toBe('back-right');
      expect(bottom!.secondaryCuts![0]?.widthMm).toBe(160 - 18);
      expect(bottom!.secondaryCuts![0]?.depthMm).toBe(110);
    });
  });

  describe('2.4 AnchorSolver - Pared en Falsa Escuadra', () => {
    it('creates trapezoidal bottom and roof with distinct left and right depths', () => {
      const res = resolveCarcass({
        carcass: {
          width: 900,
          height: 720,
          depth: 560,
          jointPriority: 'lateral-over-bottom',
          roofType: 'solid-panel',
          hasBacking: false,
        },
        carcassMaterialId: materials.carcassMaterialId,
        carcassThicknessMm: 18,
        interferences: {
          falseSquare: {
            enabled: true,
            leftDepthMm: 560,
            rightDepthMm: 500,
          },
        },
      });

      const sideLeft = res.pieces.find((p) => p.role === 'side-left');
      const sideRight = res.pieces.find((p) => p.role === 'side-right');
      const bottom = res.pieces.find((p) => p.role === 'bottom');
      const top = res.pieces.find((p) => p.role === 'top');

      expect(sideLeft!.contour.points[1]!.x).toBe(560);
      expect(sideRight!.contour.points[1]!.x).toBe(500);

      // bottom is a 4-point trapezoid
      const pts = bottom!.contour.points;
      expect(pts.length).toBe(4);
      expect(pts[0]).toEqual({ x: 0, y: 0 });
      expect(pts[1]).toEqual({ x: 900 - 36, y: 0 });
      expect(pts[2]).toEqual({ x: 900 - 36, y: 500 }); // right side depth
      expect(pts[3]).toEqual({ x: 0, y: 560 }); // left side depth

      expect(bottom!.rawBoundingBox).toEqual({ widthMm: 864, heightMm: 560 });
      expect(bottom!.secondaryCuts![0]?.type).toBe('bevel-diagonal');
      expect(bottom!.secondaryCuts![0]?.description).toContain('Corte en falsa escuadra');

      // top matches bottom
      expect(top!.contour.points[2]).toEqual({ x: 864, y: 500 });
      expect(top!.contour.points[3]).toEqual({ x: 0, y: 560 });
    });
  });

  describe('2.5 ShelvesBayResolver - Adaptación de Estantes', () => {
    it('creates shelf with notch polygon when column is present in bay', () => {
      const resolver = new ShelvesBayResolver();
      const res = resolver.resolve({
        bay: {
          bayIndex: 0,
          x: 18,
          y: 0,
          z: 0,
          width: 764,
          height: 684,
          depth: 560,
          leftPieceId: 'side-left',
          rightPieceId: 'side-right',
          bottomPieceId: 'bottom',
          topPieceId: 'roof',
          overallWidth: 800,
          overallDepth: 560,
          interferences: {
            columnObstacle: {
              enabled: true,
              corner: 'back-left',
              widthMm: 150,
              depthMm: 120,
            },
          },
        },
        content: {
          type: 'shelves',
          count: 1,
          shelfType: 'adjustable',
          setbackMm: 20,
        },
        materials,
        options: {
          carcassThicknessMm: 18,
          rootPieceId: 'side-left',
        },
      });

      expect(res.pieces.length).toBe(1);
      const shelf = res.pieces[0]!;
      expect(shelf.role).toBe('shelf');

      // Shelf has 6 vertices because of the notch in back-left
      expect(shelf.contour.points.length).toBe(6);
      expect(shelf.secondaryCuts).toBeDefined();
      expect(shelf.secondaryCuts![0]?.type).toBe('notch');
      expect(shelf.secondaryCuts![0]?.corner).toBe('back-left');
      expect(shelf.secondaryCuts![0]?.depthMm).toBe(120);
    });

    it('creates trapezoidal shelf when false square is present', () => {
      const resolver = new ShelvesBayResolver();
      const res = resolver.resolve({
        bay: {
          bayIndex: 0,
          x: 18,
          y: 0,
          z: 0,
          width: 764,
          height: 684,
          depth: 560,
          leftPieceId: 'side-left',
          rightPieceId: 'side-right',
          bottomPieceId: 'bottom',
          topPieceId: 'roof',
          overallWidth: 800,
          overallDepth: 560,
          interferences: {
            falseSquare: {
              enabled: true,
              leftDepthMm: 560,
              rightDepthMm: 500,
            },
          },
        },
        content: {
          type: 'shelves',
          count: 1,
          shelfType: 'fixed',
          setbackMm: 20,
        },
        materials,
        options: {
          carcassThicknessMm: 18,
          rootPieceId: 'side-left',
        },
      });

      const shelf = res.pieces[0]!;
      expect(shelf.contour.points.length).toBe(4);
      expect(shelf.secondaryCuts![0]?.type).toBe('bevel-diagonal');
      expect(shelf.secondaryCuts![0]?.description).toContain('Chaflán trasera falsa escuadra');
    });
  });

  describe('2.6 Integration & Labels Extractor', () => {
    it('integrates with buildModularModule and propagates secondary operations to labels', () => {
      const built = buildModularModule({
        id: 'mod-interf',
        carcass: {
          width: 800,
          height: 720,
          depth: 560,
          jointPriority: 'lateral-over-bottom',
          roofType: 'solid-panel',
          hasBacking: false,
        },
        bays: [
          {
            type: 'shelves',
            count: 1,
            shelfType: 'adjustable',
            setbackMm: 20,
          },
        ],
        materials,
        interferences: {
          columnObstacle: {
            enabled: true,
            corner: 'back-left',
            widthMm: 150,
            depthMm: 120,
          },
        },
      });

      expect(built.module.interferences?.columnObstacle?.enabled).toBe(true);

      const bottom = built.resolvedPieces.find((p) => p.role === 'bottom');
      expect(bottom).toBeDefined();
      // Cut size for guillotine/saw is the rectangular bounding box
      expect(bottom!.cutDimensionsMm.width).toBe(800 - 36);
      expect(bottom!.cutDimensionsMm.height).toBe(560);

      // Extract labels
      const labels = extractPieceLabelData(built.resolvedPieces, {
        materials: [
          {
            id: 'mat-egger-white-18',
            name: 'Blanco Egger 18mm',
            thicknessMm: 18,
            hasGrain: false,
          } as unknown as Material,
        ],
        edgeBands: [],
      });

      const bottomLabel = labels.find((l) => l.pieceName.toLowerCase().includes('piso') || l.pieceName.toLowerCase().includes('base'));
      expect(bottomLabel).toBeDefined();
      expect(bottomLabel!.secondaryOperationsSummary).toBeDefined();
      expect(bottomLabel!.secondaryOperationsSummary!.length).toBeGreaterThan(0);
      expect(bottomLabel!.secondaryOperationsSummary![0]).toContain('Destaje para columna trasera izquierda');
    });
  });
});
