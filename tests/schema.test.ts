import { describe, it, expect } from 'vitest';
import {
  validateMaterial,
  validateEdgeBand,
  validatePiece,
  validateFace,
  validateJoint,
  validateModule,
  type Material,
  type EdgeBand,
  type Piece,
  type Face,
  type Joint,
  type Module,
  drillOperationSchema,
  pieceMachiningSchema,
  validateEquipmentItem,
  validateEquipmentCatalog,
  DEFAULT_EQUIPMENT_ITEMS,
  validateCountertopMaterial,
  validateCountertopDefinition,
  DEFAULT_COUNTERTOP_MATERIALS,
} from '../src/model';

describe('Model Schemas - Valid Data', () => {
  it('validates a valid material', () => {
    const validMaterial: Material = {
      schemaVersion: 1,
      id: 'mat-test-1',
      name: 'Test Particleboard 18mm',
      thicknessMm: 18,
      sheetSizeMm: { length: 2800, width: 2070 },
      hasGrain: false,
      milling: {
        hidden: 'yes',
        visible: 'no',
        onStructuralPiece: 'limited',
        maxDepthMm: 'TO_CONFIRM',
      },
      heatResistant: false,
      elasticModulusMPa: 'TO_CONFIRM',
      pricePerSheet: 'TO_CONFIRM',
    };

    const parsed = validateMaterial(validMaterial);
    expect(parsed.id).toBe('mat-test-1');
    expect(parsed.thicknessMm).toBe(18);
  });

  it('validates a valid edge band', () => {
    const validEdgeBand: EdgeBand = {
      schemaVersion: 1,
      id: 'eb-test-1',
      kind: 'adhesive',
      thicknessMm: 1.0,
      pricePerMeter: 'TO_CONFIRM',
      needsGroove: false,
    };

    const parsed = validateEdgeBand(validEdgeBand);
    expect(parsed.id).toBe('eb-test-1');
    expect(parsed.kind).toBe('adhesive');
  });

  it('validates a valid face and piece', () => {
    const validFace: Face = {
      id: 'front-edge',
      visible: true,
      edgeBandId: 'eb-test-1',
    };
    expect(validateFace(validFace)).toEqual(validFace);

    const validPiece: Piece = {
      id: 'piece-side-left',
      role: 'side-left',
      materialId: 'mat-test-1',
      contour: {
        points: [
          { x: 0, y: 0 },
          { x: 600, y: 0 },
          { x: 600, y: 800 },
          { x: 0, y: 800 },
        ],
      },
      thicknessMm: 18,
      faces: [validFace],
      structural: true,
      referenceFace: 'A',
    };

    const parsedPiece = validatePiece(validPiece);
    expect(parsedPiece.id).toBe('piece-side-left');
    expect(parsedPiece.contour.points).toHaveLength(4);
  });

  it('validates a valid joint', () => {
    const validJoint: Joint = {
      a: { pieceId: 'side-left', faceId: 'inner' },
      b: { pieceId: 'bottom', faceId: 'left-edge' },
      kind: 'confirmat',
      offsetMm: 50,
      region: { start: 100, end: 500 },
    };

    const parsed = validateJoint(validJoint);
    expect(parsed.kind).toBe('confirmat');
    expect(parsed.a.pieceId).toBe('side-left');
  });

  it('validates a complete valid module', () => {
    const validModule: Module = {
      schemaVersion: 1,
      id: 'mod-base-600',
      parameters: { width: 600, height: 800, depth: 550 },
      rootPieceId: 'piece-bottom',
      pieces: [
        {
          id: 'piece-bottom',
          role: 'bottom',
          materialId: 'mat-test-1',
          contour: {
            points: [
              { x: 0, y: 0 },
              { x: 564, y: 0 },
              { x: 564, y: 550 },
              { x: 0, y: 550 },
            ],
          },
          thicknessMm: 18,
          faces: [{ id: 'front-edge', visible: true }],
          structural: true,
          referenceFace: 'A',
        },
      ],
      joints: [],
      subAssemblies: [
        {
          id: 'sub-drawer-1',
          templateId: 'tpl-drawer-standard',
          parameters: { height: 180 },
          pieceIds: ['piece-bottom'],
        },
      ],
      overrides: {
        'piece-bottom': {
          pieceId: 'piece-bottom',
          property: 'thicknessMm',
          value: 18,
        },
      },
    };

    const parsed = validateModule(validModule);
    expect(parsed.id).toBe('mod-base-600');
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.pieces).toHaveLength(1);
  });
});

describe('Model Schemas - Rejection of Wrong Data', () => {
  it('rejects a material with invalid milling tolerance capability', () => {
    const invalidMaterial = {
      id: 'mat-bad',
      name: 'Bad Material',
      thicknessMm: 18,
      sheetSizeMm: { length: 2800, width: 2070 },
      hasGrain: false,
      milling: {
        hidden: 'maybe', // Invalid enum value
        visible: 'yes',
        onStructuralPiece: 'limited',
      },
    };

    expect(() => validateMaterial(invalidMaterial)).toThrow();
  });

  it('rejects an edge band with unknown kind', () => {
    const invalidEdgeBand = {
      id: 'eb-bad',
      kind: 'plastic-tape', // Invalid kind
      thicknessMm: 1.0,
      pricePerMeter: 5,
    };

    expect(() => validateEdgeBand(invalidEdgeBand)).toThrow();
  });

  it('rejects a piece with fewer than 3 contour points', () => {
    const invalidPiece = {
      id: 'piece-bad',
      role: 'shelf',
      materialId: 'mat-1',
      contour: {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ], // Only 2 points
      },
      thicknessMm: 18,
      faces: [],
      structural: false,
      referenceFace: 'A',
    };

    expect(() => validatePiece(invalidPiece)).toThrow();
  });

  it('rejects a joint with invalid kind', () => {
    const invalidJoint = {
      a: { pieceId: 'p1', faceId: 'f1' },
      b: { pieceId: 'p2', faceId: 'f2' },
      kind: 'nail', // Invalid kind
    };

    expect(() => validateJoint(invalidJoint)).toThrow();
  });

  it('rejects a module without schemaVersion or with missing rootPieceId', () => {
    const moduleWithoutVersion = {
      id: 'mod-no-ver',
      parameters: { width: 600 },
      rootPieceId: 'root-1',
      pieces: [],
      joints: [],
      subAssemblies: [],
      overrides: {},
    };

    expect(() => validateModule(moduleWithoutVersion)).toThrow();

    const moduleWithoutRoot = {
      schemaVersion: 1,
      id: 'mod-no-root',
      parameters: { width: 600 },
      rootPieceId: '',
      pieces: [],
      joints: [],
      subAssemblies: [],
      overrides: {},
    };

    expect(() => validateModule(moduleWithoutRoot)).toThrow();
  });

  it('validates drillOperationSchema and pieceMachiningSchema', () => {
    const validDrill = {
      schemaVersion: 1,
      id: 'op-1',
      pieceId: 'side-1',
      faceId: 'inner',
      faceType: 'face-A',
      diameterMm: 7,
      depthMm: 18,
      isThrough: true,
      positionMm: { x: 50, y: 9 },
      origin: 'derived',
      sourceJointKind: 'confirmat',
    };
    expect(drillOperationSchema.parse(validDrill)).toEqual(validDrill);

    const validMachining = {
      schemaVersion: 1,
      pieceId: 'side-1',
      role: 'side-left',
      operations: [validDrill],
      requiresTurn: false,
    };
    expect(pieceMachiningSchema.parse(validMachining)).toEqual(validMachining);
  });

  it('validates equipment item and seed catalog', () => {
    expect(DEFAULT_EQUIPMENT_ITEMS.length).toBeGreaterThan(0);
    const catalog = {
      schemaVersion: 1,
      items: DEFAULT_EQUIPMENT_ITEMS,
    };
    const parsedCatalog = validateEquipmentCatalog(catalog);
    expect(parsedCatalog.items.length).toBe(DEFAULT_EQUIPMENT_ITEMS.length);

    const first = DEFAULT_EQUIPMENT_ITEMS[0]!;
    const parsedItem = validateEquipmentItem(first);
    expect(parsedItem.id).toBe(first.id);
    expect(parsedItem.cutout.widthMm).toBeGreaterThan(0);
    expect(parsedItem.minClearancesMm.frontMm).toBeGreaterThanOrEqual(50);
  });

  it('validates countertop material and seed catalog', () => {
    expect(DEFAULT_COUNTERTOP_MATERIALS.length).toBeGreaterThan(0);
    for (const mat of DEFAULT_COUNTERTOP_MATERIALS) {
      const parsed = validateCountertopMaterial(mat);
      expect(parsed.thicknessMm).toBeGreaterThan(0);
      expect(parsed.densityKgM2).toBeGreaterThan(0);
      expect(parsed.maxOverhangWithoutBracketsMm).toBeGreaterThan(0);
    }
  });

  it('validates countertop definition with sink placement and backsplash', () => {
    const validCountertop = {
      id: 'ct-1',
      name: 'Mesada Cocina',
      materialId: 'ct-granite-gris-mara-20',
      widthMm: 1800,
      depthMm: 620,
      frontOverhangMm: 25,
      leftOverhangMm: 10,
      rightOverhangMm: 10,
      backOverhangMm: 0,
      edgeFinish: 'straight-polished' as const,
      cornerRadii: {
        frontLeftMm: 15,
        frontRightMm: 15,
        backLeftMm: 0,
        backRightMm: 0,
      },
      backsplash: {
        hasSplash: true,
        heightMm: 60,
        thicknessMm: 20,
      },
      placements: [
        {
          equipmentId: 'eq-sink-johnson-luxon-ln50',
          centerXMm: 900,
          sinkDrawerAdaptation: 'false-front' as const,
          frontRailOrientation: 'vertical' as const,
        },
      ],
    };

    const parsed = validateCountertopDefinition(validCountertop);
    expect(parsed.widthMm).toBe(1800);
    expect(parsed.placements.length).toBe(1);
    expect(parsed.placements[0]?.sinkDrawerAdaptation).toBe('false-front');
    expect(parsed.placements[0]?.frontRailOrientation).toBe('vertical');
  });
});

