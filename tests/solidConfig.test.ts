import { describe, it, expect } from 'vitest';
import {
  deriveModuleDrillOperations,
  JointMachiningRegistry,
  type IJointMachiningStrategy,
  type JointMachiningContext,
  ConfirmatJointStrategy,
  ScrewJointStrategy,
  CamDowelJointStrategy,
  DowelJointStrategy,
  HingeJointStrategy,
  ShelfPinJointStrategy,
  SlideJointStrategy,
  BayContentRegistry,
  type IBayContentResolver,
  type BayResolutionContext,
  type ComponentSolverResult,
  EmptyBayResolver,
  ShelvesBayResolver,
  DrawerStackBayResolver,
  DoorsBayResolver,
  PullOutTrayBayResolver,
  BiFoldClosureBayResolver,
  resolveBayContent,
  ModularPresetRegistry,
  defaultModularPresetRegistry,
  createPiece,
  createJoint,
  createRectangularContour,
  DEFAULT_MACHINING_SHOP_VALUES,
} from '../src/resolver';
import {
  projectConfigService,
  ProjectConfigService,
  type IConfigService,
} from '../src/storage';
import {
  loadDefaultProjectConfigFile,
  loadModularPresetsConfigFile,
  loadUiDefaultsConfigFile,
  DEFAULT_UI_CONFIG,
} from '../src/config';
import { type Joint, type Material, type DrillOperation } from '../src/model';

const testMaterial: Material = {
  schemaVersion: 1,
  id: 'mat-test-18',
  name: 'Melamine White 18mm',
  thicknessMm: 18,
  sheetSizeMm: { length: 2750, width: 1830 },
  hasGrain: false,
  milling: { hidden: 'yes', visible: 'no', onStructuralPiece: 'limited' },
};

describe('SOLID Principles & Configuration File Architecture', () => {
  describe('1. Single Responsibility Principle (SRP)', () => {
    it('isolates each joint machining strategy to its own class', () => {
      const confirmat = new ConfirmatJointStrategy();
      const screw = new ScrewJointStrategy();
      const camDowel = new CamDowelJointStrategy();
      const dowel = new DowelJointStrategy();
      const hinge = new HingeJointStrategy();
      const shelfPin = new ShelfPinJointStrategy();
      const slide = new SlideJointStrategy();

      expect(confirmat.kind).toBe('confirmat');
      expect(screw.kind).toBe('screw');
      expect(camDowel.kind).toBe('cam-dowel');
      expect(dowel.kind).toBe('dowel');
      expect(hinge.kind).toBe('hinge');
      expect(shelfPin.kind).toBe('shelf-pin');
      expect(slide.kind).toBe('slide');
    });

    it('isolates each bay content resolver to its own class', () => {
      const empty = new EmptyBayResolver();
      const shelves = new ShelvesBayResolver();
      const drawers = new DrawerStackBayResolver();
      const doors = new DoorsBayResolver();
      const tray = new PullOutTrayBayResolver();
      const bifold = new BiFoldClosureBayResolver();

      expect(empty.type).toBe('empty');
      expect(shelves.type).toBe('shelves');
      expect(drawers.type).toBe('drawer-stack');
      expect(doors.type).toBe('doors');
      expect(tray.type).toBe('pull-out-tray');
      expect(bifold.type).toBe('bi-fold-closure');
    });

    it('isolates configuration persistence in ProjectConfigService', () => {
      const service = new ProjectConfigService();
      const def = service.getDefaultConfig();

      expect(def.projectId).toBe('default-project');
      expect(def.machining.jointStrategy).toBe('confirmat');
      const exported = service.exportConfigJson(def);
      expect(exported).toContain('default-project');
      const imported = service.importConfigJson(exported);
      expect(imported.projectId).toBe(def.projectId);
      expect(projectConfigService.getDefaultConfig().projectId).toBe('default-project');
    });
  });

  describe('2. Open/Closed Principle (OCP)', () => {
    it('allows extending JointMachiningRegistry with new joint strategies without modifying existing resolvers', () => {
      // Define a new custom joint strategy: pocket-hole
      class PocketHoleJointStrategy implements IJointMachiningStrategy {
        public readonly kind = 'pocket-hole';

        public canHandle(joint: Joint, effectiveKind: string): boolean {
          return effectiveKind === 'pocket-hole' || joint.kind === ('pocket-hole' as any);
        }

        public generateOperations(context: JointMachiningContext): DrillOperation[] {
          return [
            {
              schemaVersion: 1,
              id: context.generateOpId(),
              pieceId: context.pieceA.id,
              faceId: context.joint.a.faceId,
              faceType: 'face-A',
              diameterMm: 9.5,
              depthMm: 30,
              isThrough: false,
              positionMm: { x: 50, y: 50 },
              origin: 'derived',
              sourceJointKind: 'pocket-hole' as any,
              description: 'Custom pocket hole Ø9.5mm',
            },
          ];
        }
      }

      const customRegistry = new JointMachiningRegistry();
      customRegistry.register(new PocketHoleJointStrategy());

      const pieceA = createPiece({
        id: 'p-side',
        role: 'side',
        materialId: testMaterial.id,
        contour: createRectangularContour(500, 700),
        thicknessMm: 18,
      });

      const pieceB = createPiece({
        id: 'p-bottom',
        role: 'bottom',
        materialId: testMaterial.id,
        contour: createRectangularContour(500, 500),
        thicknessMm: 18,
      });

      const customJoint: Joint = {
        a: { pieceId: 'p-side', faceId: 'inner' },
        b: { pieceId: 'p-bottom', faceId: 'left-edge' },
        kind: 'pocket-hole' as any,
      };

      const ops = deriveModuleDrillOperations(
        [pieceA, pieceB],
        [customJoint],
        DEFAULT_MACHINING_SHOP_VALUES,
        customRegistry,
      );

      expect(ops).toHaveLength(1);
      expect(ops[0]!.description).toBe('Custom pocket hole Ø9.5mm');
      expect(ops[0]!.diameterMm).toBe(9.5);
    });

    it('allows extending BayContentRegistry with new bay interior types without modifying resolveBayContent', () => {
      // Define a custom bay interior: wine-rack
      class WineRackBayResolver implements IBayContentResolver {
        public readonly type = 'wine-rack' as any;

        public resolve(context: BayResolutionContext): ComponentSolverResult {
          const rackPiece = createPiece({
            id: `${context.options.idPrefix ?? 'bay'}-wine-grid`,
            role: 'wine-grid' as any,
            materialId: context.materials.carcassMaterialId,
            contour: createRectangularContour(context.bay.width, context.bay.height),
            thicknessMm: 12,
            structural: false,
          });

          return {
            pieces: [rackPiece],
            joints: [],
            placementNodes: [
              {
                pieceId: rackPiece.id,
                parentPieceId: context.options.rootPieceId,
                relativeOffset: { x: context.bay.x, y: context.bay.y, z: 0 },
              },
            ],
            subAssemblies: [],
          };
        }
      }

      const customBayRegistry = new BayContentRegistry();
      customBayRegistry.register(new WineRackBayResolver());

      const bay = {
        bayIndex: 0,
        x: 18,
        y: 18,
        z: 0,
        width: 300,
        height: 684,
        depth: 560,
        leftPieceId: 'side-l',
        rightPieceId: 'side-r',
        bottomPieceId: 'bottom',
        topPieceId: 'top',
      };

      const result = resolveBayContent(
        bay,
        { type: 'wine-rack' } as any,
        {
          carcassMaterialId: 'mat-1',
          frontsMaterialId: 'mat-1',
          drawerBoxesMaterialId: 'mat-1',
          backingsMaterialId: 'mat-1',
        },
        { carcassThicknessMm: 18, rootPieceId: 'side-l' },
        customBayRegistry,
      );

      expect(result.pieces).toHaveLength(1);
      expect(result.pieces[0]!.role).toBe('wine-grid');
      expect(result.pieces[0]!.thicknessMm).toBe(12);
    });

    it('allows registering custom presets in ModularPresetRegistry', () => {
      const registry = new ModularPresetRegistry();
      const initialCount = registry.getAll().length;

      registry.register({
        id: 'preset-custom-desk',
        name: 'Módulo Escritorio Custom',
        description: 'Módulo de trabajo personalizado.',
        defaultDimensions: { width: 1200, height: 750, depth: 600 },
        createDefinition: (dims, mats, ebId) => ({
          id: 'module-custom-desk',
          carcass: {
            width: dims?.width ?? 1200,
            height: dims?.height ?? 750,
            depth: dims?.depth ?? 600,
            jointPriority: 'lateral-over-bottom',
            roofType: 'solid-panel',
            hasBacking: false,
          },
          bays: [{ type: 'empty' }],
          materials: {
            carcassMaterialId: mats?.carcassMaterialId ?? 'mat-test',
            frontsMaterialId: mats?.frontsMaterialId ?? 'mat-test',
            drawerBoxesMaterialId: mats?.drawerBoxesMaterialId ?? 'mat-test',
            backingsMaterialId: mats?.backingsMaterialId ?? 'mat-test',
          },
          edgeBandId: ebId,
        }),
      });

      expect(registry.getAll().length).toBe(initialCount + 1);
      const custom = registry.getById('preset-custom-desk');
      expect(custom.name).toBe('Módulo Escritorio Custom');
      expect(custom.defaultDimensions.width).toBe(1200);
    });
  });

  describe('3. Liskov Substitution Principle (LSP)', () => {
    it('ensures any IJointMachiningStrategy fulfills the contract and can be substituted safely', () => {
      const registry = new JointMachiningRegistry();
      const strategies = registry.getAllStrategies();

      const pieceA = createPiece({
        id: 'p-a',
        role: 'side',
        materialId: testMaterial.id,
        contour: createRectangularContour(500, 500),
        thicknessMm: 18,
      });
      const pieceB = createPiece({
        id: 'p-b',
        role: 'bottom',
        materialId: testMaterial.id,
        contour: createRectangularContour(500, 500),
        thicknessMm: 18,
      });

      for (const strat of strategies) {
        expect(typeof strat.kind).toBe('string');
        expect(typeof strat.canHandle).toBe('function');
        expect(typeof strat.generateOperations).toBe('function');

        const joint = createJoint({
          a: { pieceId: 'p-a', faceId: 'inner' },
          b: { pieceId: 'p-b', faceId: 'left-edge' },
          kind: 'confirmat',
        });

        const ops = strat.generateOperations({
          pieceA,
          pieceB,
          joint,
          effectiveKind: strat.kind,
          config: DEFAULT_MACHINING_SHOP_VALUES,
          generateOpId: () => 'op-test',
        });

        expect(Array.isArray(ops)).toBe(true);
      }
    });

    it('ensures any IBayContentResolver fulfills the contract and can be substituted safely', () => {
      const registry = new BayContentRegistry();
      const resolvers = registry.getAll();

      for (const res of resolvers) {
        expect(typeof res.type).toBe('string');
        expect(typeof res.resolve).toBe('function');
      }
    });
  });

  describe('4. Interface Segregation Principle (ISP)', () => {
    it('context interfaces provide only necessary properties without coupling', () => {
      const mockOpIdGen = () => 'test-id';
      const pieceA = createPiece({
        id: 'p-a',
        role: 'side',
        materialId: 'm1',
        contour: createRectangularContour(500, 500),
        thicknessMm: 18,
      });
      const pieceB = createPiece({
        id: 'p-b',
        role: 'shelf',
        materialId: 'm1',
        contour: createRectangularContour(500, 500),
        thicknessMm: 18,
      });
      const joint = createJoint({
        a: { pieceId: 'p-a', faceId: 'inner' },
        b: { pieceId: 'p-b', faceId: 'left-edge' },
        kind: 'shelf-pin',
      });

      const context: JointMachiningContext = {
        pieceA,
        pieceB,
        joint,
        effectiveKind: 'shelf-pin',
        config: DEFAULT_MACHINING_SHOP_VALUES,
        generateOpId: mockOpIdGen,
      };

      const strategy = new ShelfPinJointStrategy();
      const ops = strategy.generateOperations(context);

      expect(ops.length).toBe(2);
      expect(ops[0]!.sourceJointKind).toBe('shelf-pin');
    });
  });

  describe('5. Dependency Inversion Principle (DIP)', () => {
    it('allows injecting custom IConfigService implementation into high-level callers', () => {
      class MockConfigService implements IConfigService {
        public getDefaultConfig() {
          const cfg = loadDefaultProjectConfigFile();
          return { ...cfg, projectName: 'Mocked Project Config' };
        }
        public async loadConfig() {
          return this.getDefaultConfig();
        }
        public async saveConfig() {}
        public exportConfigJson() {
          return '{}';
        }
        public importConfigJson() {
          return this.getDefaultConfig();
        }
      }

      const mockService: IConfigService = new MockConfigService();
      const config = mockService.getDefaultConfig();
      expect(config.projectName).toBe('Mocked Project Config');
    });
  });

  describe('6. Configuration-Driven Behavior (Files & Schemas)', () => {
    it('loads and validates all definitions from defaultProjectConfig.json', () => {
      const config = loadDefaultProjectConfigFile();
      expect(config.machining.screwThroughDiameterMm).toBe(4.0);
      expect(config.machining.screwCoreDiameterMm).toBe(3.0);
      expect(config.machining.screwCoreDepthMm).toBe(35.0);
      expect(config.machining.slideHoleDiameterMm).toBe(5.0);
      expect(config.machining.slideHolePitchMm).toBe(192.0);
      expect(config.machining.hingePlateHoleSpacingMm).toBe(32.0);
      expect(config.machining.dowelSpacingMm).toBe(32.0);
      expect(config.hardware.slideClearanceRollerMm).toBe(25.0);
      expect(config.deflection.defaultElasticModulusMPa).toBe(3000.0);
      expect(config.deflection.gravityAccelerationMS2).toBe(9.80665);
    });

    it('loads and validates all modular presets from modularPresets.json', () => {
      const presets = loadModularPresetsConfigFile();
      expect(presets.length).toBeGreaterThanOrEqual(7);

      const empty = presets.find((p) => p.id === 'preset-empty');
      const drawerUnit = presets.find((p) => p.id === 'preset-drawer-unit-3');
      const partitionCombo = presets.find((p) => p.id === 'preset-partition-combo');

      expect(empty).toBeDefined();
      expect(empty!.defaultDimensions.width).toBe(600);
      expect(drawerUnit).toBeDefined();
      expect(drawerUnit!.bays[0]!.type).toBe('drawer-stack');
      expect(partitionCombo).toBeDefined();
      expect(partitionCombo!.grid!.axis).toBe('horizontal');
      expect(defaultModularPresetRegistry.getAll().length).toBeGreaterThanOrEqual(7);
    });

    it('loads and validates UI defaults and quick recipes from uiDefaults.json', () => {
      const uiDefaults = loadUiDefaultsConfigFile();
      expect(uiDefaults.dimensions.width.default).toBe(600);
      expect(uiDefaults.dimensions.width.min).toBe(100);
      expect(uiDefaults.dimensions.width.max).toBe(3000);
      expect(uiDefaults.quickTrackRecipes.length).toBeGreaterThanOrEqual(4);
      expect(uiDefaults.defaultCarcassSettings.roofType).toBe('front-back-rails');
      expect(DEFAULT_UI_CONFIG.dimensions.width.default).toBe(600);
    });

    it('dynamically adapts screw machining dimensions when configured in project config', () => {
      const customConfig = {
        ...DEFAULT_MACHINING_SHOP_VALUES,
        screwThroughDiameterMm: 5.5,
        screwCoreDiameterMm: 3.5,
        screwCoreDepthMm: 45.0,
      };

      const side = createPiece({
        id: 'p-side',
        role: 'side',
        materialId: testMaterial.id,
        contour: createRectangularContour(500, 700),
        thicknessMm: 18,
      });
      const bottom = createPiece({
        id: 'p-bottom',
        role: 'bottom',
        materialId: testMaterial.id,
        contour: createRectangularContour(500, 500),
        thicknessMm: 18,
      });
      const joint = createJoint({
        a: { pieceId: 'p-side', faceId: 'inner' },
        b: { pieceId: 'p-bottom', faceId: 'left-edge' },
        kind: 'screw',
      });

      const ops = deriveModuleDrillOperations(
        [side, bottom],
        [joint],
        customConfig,
      );

      const throughHole = ops.find((o) => o.pieceId === 'p-side');
      const coreHole = ops.find((o) => o.pieceId === 'p-bottom');

      expect(throughHole!.diameterMm).toBe(5.5);
      expect(coreHole!.diameterMm).toBe(3.5);
      expect(coreHole!.depthMm).toBe(45.0);
    });

    it('dynamically adapts slide mounting pitch from configuration', () => {
      const customConfig = {
        ...DEFAULT_MACHINING_SHOP_VALUES,
        system32FrontSetbackMm: 40.0,
        slideHolePitchMm: 224.0, // 7 * 32mm pitch
        slideHoleDiameterMm: 5.2,
      };

      const drawerSide = createPiece({
        id: 'box-side-l-1',
        role: 'drawer-side',
        materialId: testMaterial.id,
        contour: createRectangularContour(500, 150),
        thicknessMm: 15,
      });
      const side = createPiece({
        id: 'carcase-side',
        role: 'side-left',
        materialId: testMaterial.id,
        contour: createRectangularContour(560, 800),
        thicknessMm: 18,
      });
      const joint = createJoint({
        a: { pieceId: 'box-side-l-1', faceId: 'outer' },
        b: { pieceId: 'carcase-side', faceId: 'inner' },
        kind: 'slide',
        offsetMm: 60,
      });

      const ops = deriveModuleDrillOperations(
        [drawerSide, side],
        [joint],
        customConfig,
      );

      expect(ops).toHaveLength(2);
      expect(ops[0]!.positionMm.x).toBe(40.0);
      expect(ops[1]!.positionMm.x).toBe(40.0 + 224.0);
      expect(ops[0]!.diameterMm).toBe(5.2);
    });
  });
});
