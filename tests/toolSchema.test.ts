import { describe, it, expect } from 'vitest';
import {
  toolItemSchema,
  toolCatalogSchema,
  validateToolItem,
  validateToolCatalog,
  DEFAULT_TOOLS,
  type ToolItem,
  customHoleSeriesOperationSchema,
  customEdgeProfileOperationSchema,
  customPocketOperationSchema,
  customPieceOperationSchema,
  customHoleSeriesToDrillOperations,
  type CustomHoleSeriesOperation,
  type CustomEdgeProfileOperation,
  type CustomPocketOperation,
} from '../src/model';

describe('Tool & Advanced Operations Schemas (Phase 4 Step 1)', () => {
  describe('Tool Item and Catalog Schemas', () => {
    it('validates all seed tools in DEFAULT_TOOLS catalog', () => {
      expect(toolCatalogSchema.safeParse({ schemaVersion: 1, tools: DEFAULT_TOOLS }).success).toBe(true);
      const catalog = validateToolCatalog({
        schemaVersion: 1,
        tools: DEFAULT_TOOLS,
      });

      expect(catalog.tools.length).toBeGreaterThanOrEqual(12);
      expect(catalog.tools.some((t) => t.id === 'tool-drill-5')).toBe(true);
      expect(catalog.tools.some((t) => t.id === 'tool-forstner-35')).toBe(true);
      expect(catalog.tools.some((t) => t.id === 'tool-router-straight-3')).toBe(true);
      expect(catalog.tools.some((t) => t.id === 'tool-router-chamfer-45')).toBe(true);
      expect(catalog.tools.some((t) => t.id === 'tool-router-jpull')).toBe(true);
    });

    it('validates drill bit with specific drillType', () => {
      const drill: ToolItem = {
        schemaVersion: 1,
        id: 'test-drill-5',
        name: 'Broca 5mm',
        kind: 'drill-bit',
        diameterMm: 5,
        shankDiameterMm: 10,
        maxCutDepthMm: 25,
        drillType: 'blind',
        rotationSpeedRpm: 4500,
      };

      expect(toolItemSchema.safeParse(drill).success).toBe(true);
      const parsed = validateToolItem(drill);
      expect(parsed.kind).toBe('drill-bit');
      expect(parsed.drillType).toBe('blind');
      expect(parsed.diameterMm).toBe(5);
    });

    it('validates profile router bit with profileKind and radius', () => {
      const profileBit: ToolItem = {
        schemaVersion: 1,
        id: 'test-router-r3',
        name: 'Fresa R3',
        kind: 'profile-router-bit',
        diameterMm: 19,
        maxCutDepthMm: 10,
        profileKind: 'roundover',
        profileRadiusMm: 3,
      };

      const parsed = validateToolItem(profileBit);
      expect(parsed.kind).toBe('profile-router-bit');
      expect(parsed.profileKind).toBe('roundover');
      expect(parsed.profileRadiusMm).toBe(3);
    });

    it('rejects invalid tool with non-positive diameter or missing required fields', () => {
      expect(() =>
        validateToolItem({
          id: 'bad-tool',
          name: 'Invalid Diameter Tool',
          kind: 'drill-bit',
          diameterMm: 0, // must be positive
          maxCutDepthMm: 10,
        }),
      ).toThrow();

      expect(() =>
        validateToolItem({
          id: '',
          name: 'Empty ID Tool',
          kind: 'drill-bit',
          diameterMm: 5,
          maxCutDepthMm: 10,
        }),
      ).toThrow();
    });
  });

  describe('Advanced Custom Piece Operations Schemas', () => {
    it('validates hole-series operation (System 32) and expands into drill operations', () => {
      const series: CustomHoleSeriesOperation = {
        kind: 'hole-series',
        id: 'series-sys32-left',
        pieceId: 'side-left',
        faceType: 'face-A',
        startXMm: 37, // 37mm front setback
        startYMm: 100,
        axis: 'y',
        pitchMm: 32,
        count: 5,
        diameterMm: 5,
        depthMm: 12,
        isThrough: false,
        toolId: 'tool-drill-5',
        description: 'Cremallera de estantes regulables',
      };

      const parsed = customHoleSeriesOperationSchema.parse(series);
      expect(parsed.count).toBe(5);
      expect(parsed.pitchMm).toBe(32);

      // Verify expansion into individual drill operations
      const drills = customHoleSeriesToDrillOperations(parsed);
      expect(drills.length).toBe(5);
      expect(drills[0]?.positionMm).toEqual({ x: 37, y: 100 });
      expect(drills[1]?.positionMm).toEqual({ x: 37, y: 132 });
      expect(drills[2]?.positionMm).toEqual({ x: 37, y: 164 });
      expect(drills[3]?.positionMm).toEqual({ x: 37, y: 196 });
      expect(drills[4]?.positionMm).toEqual({ x: 37, y: 228 });
      expect(drills.every((d) => d.diameterMm === 5 && d.depthMm === 12)).toBe(true);
    });

    it('validates cutout with tool radius and corner relief treatment', () => {
      const cutout: CustomPocketOperation = {
        kind: 'cutout',
        id: 'pocket-electrical',
        pieceId: 'back',
        faceType: 'face-A',
        xMm: 200,
        yMm: 300,
        widthMm: 150,
        heightMm: 100,
        depthMm: 18,
        isThrough: true,
        cornerRadiusMm: 5, // R5 from Ø10mm router bit
        cornerTreatment: 'dog-bone',
        toolId: 'tool-router-straight-10',
        description: 'Paso de caja eléctrica embutida',
      };

      const parsed = customPocketOperationSchema.parse(cutout);
      expect(parsed.cornerRadiusMm).toBe(5);
      expect(parsed.cornerTreatment).toBe('dog-bone');
      expect(parsed.toolId).toBe('tool-router-straight-10');
    });

    it('validates edge profile molding operation', () => {
      const profileOp: CustomEdgeProfileOperation = {
        kind: 'edge-profile',
        id: 'prof-door-miter',
        pieceId: 'door-front',
        faceType: 'face-A',
        edge: 'all-edges',
        profileKind: 'chamfer-45',
        depthMm: 3,
        widthMm: 3,
        toolId: 'tool-router-chamfer-45',
        description: 'Bisel perimetral a 45 grados',
      };

      const parsed = customEdgeProfileOperationSchema.parse(profileOp);
      expect(parsed.edge).toBe('all-edges');
      expect(parsed.profileKind).toBe('chamfer-45');
    });

    it('validates polymorphic discrimination in customPieceOperationSchema', () => {
      const ops = [
        {
          kind: 'drill',
          id: 'op-1',
          pieceId: 'p1',
          faceType: 'face-A',
          xMm: 50,
          yMm: 50,
          diameterMm: 8,
          depthMm: 30,
          isThrough: false,
        },
        {
          kind: 'hole-series',
          id: 'op-2',
          pieceId: 'p1',
          faceType: 'face-A',
          startXMm: 37,
          startYMm: 50,
          axis: 'y',
          pitchMm: 32,
          count: 4,
          diameterMm: 5,
          depthMm: 12,
          isThrough: false,
        },
        {
          kind: 'groove',
          id: 'op-3',
          pieceId: 'p1',
          faceType: 'face-A',
          axis: 'x',
          offsetMm: 20,
          widthMm: 3,
          depthMm: 8,
        },
        {
          kind: 'rebate',
          id: 'op-4',
          pieceId: 'p1',
          faceType: 'face-A',
          edge: 'top',
          widthMm: 10,
          depthMm: 5,
        },
        {
          kind: 'cutout',
          id: 'op-5',
          pieceId: 'p1',
          faceType: 'face-A',
          xMm: 100,
          yMm: 100,
          widthMm: 200,
          heightMm: 150,
          depthMm: 18,
          isThrough: true,
          cornerRadiusMm: 6,
        },
        {
          kind: 'edge-profile',
          id: 'op-6',
          pieceId: 'p1',
          faceType: 'face-A',
          edge: 'top',
          profileKind: 'j-pull',
          depthMm: 20,
          widthMm: 35,
        },
      ];

      for (const op of ops) {
        expect(() => customPieceOperationSchema.parse(op)).not.toThrow();
      }
    });
  });
});
