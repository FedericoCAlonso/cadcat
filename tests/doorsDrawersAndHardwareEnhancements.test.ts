import { describe, it, expect } from 'vitest';
import {
  buildModularModule,
  generateBOMHardware,
  deriveModuleDrillOperations,
  type ModuleMaterialRoles,
} from '../src/resolver';

describe('Doors, Drawers, and Hardware Enhancements', () => {
  const materials: ModuleMaterialRoles = {
    carcassMaterialId: 'mat-egger-white-18',
    frontsMaterialId: 'mat-egger-oak-18',
    drawerBoxesMaterialId: 'mat-mdf-white-15',
    backingsMaterialId: 'mat-mdf-white-3',
  };

  const defaultOptions = {
    carcassThicknessMm: 18,
    frontThicknessMm: 18,
    boxThicknessMm: 15,
  };

  describe('1. Thin Doors (6mm/9mm) & Surface Hinges (Butt / Piano)', () => {
    it('creates 6mm door with butt hinges without Ø35mm cup mortises to avoid piercing plate', () => {
      const res = buildModularModule(
        {
          id: 'mod-thin-door-butt',
          carcass: {
            width: 500,
            height: 600,
            depth: 400,
            jointPriority: 'lateral-over-bottom',
            roofType: 'solid-panel',
            hasBacking: false,
          },
          bays: [
            {
              type: 'doors',
              count: 1,
              hingeSide: 'left',
              mountType: 'full-overlay',
              doorThicknessMm: 6,
              hingeType: 'butt-hinge',
              catchType: 'magnetic-catch',
              handle: {
                type: 'bar',
                centerToCenterMm: 128,
                protrusionMm: 25,
              },
            },
          ],
          materials,
        },
        defaultOptions,
      );

      // Verify door piece
      const door = res.module.pieces.find((p) => p.role.includes('door'));
      expect(door).toBeDefined();
      expect(door?.thicknessMm).toBe(6);

      // Verify joints: butt-hinge, magnetic-catch, and handle
      const buttHingeJoints = res.module.joints.filter((j) => j.kind === 'butt-hinge');
      expect(buttHingeJoints.length).toBeGreaterThanOrEqual(2);

      const cupHingeJoints = res.module.joints.filter((j) => j.kind === 'hinge');
      expect(cupHingeJoints).toHaveLength(0);

      const catchJoints = res.module.joints.filter((j) => j.kind === 'magnetic-catch');
      expect(catchJoints.length).toBe(1);

      const handleJoints = res.module.joints.filter((j) => j.kind === 'handle');
      expect(handleJoints.length).toBe(1);

      // Resolve machining
      const allOps = deriveModuleDrillOperations(res.module.pieces, res.module.joints);
      const doorOps = allOps.filter((op) => op.pieceId === door?.id);

      // Check operations on the thin door: MUST NOT have Ø35mm cup mortise
      const cupOperations = doorOps.filter((op) => op.diameterMm === 35);
      expect(cupOperations.length).toBe(0);

      // Must have Ø4.5mm through-holes for M4 barral screws (pitch 128mm)
      const handleOperations = doorOps.filter(
        (op) => Math.abs(op.diameterMm - 4.5) < 0.1,
      );
      expect(handleOperations.length).toBe(2);

      // Check BOM hardware
      const hardware = generateBOMHardware(res.module);
      const buttHingeBOM = hardware.find((h) => h.hardwareId === 'hw-hinge-butt');
      expect(buttHingeBOM).toBeDefined();
      expect(buttHingeBOM?.count).toBe(buttHingeJoints.length);

      const catchBOM = hardware.find((h) => h.hardwareId === 'hw-catch-magnetic');
      expect(catchBOM).toBeDefined();
      expect(catchBOM?.count).toBe(1);

      const handleBOM = hardware.find((h) => h.hardwareId === 'hw-handle');
      expect(handleBOM).toBeDefined();
      expect(handleBOM?.count).toBe(1);
    });

    it('creates door with piano hinge and roller catch', () => {
      const res = buildModularModule(
        {
          id: 'mod-thin-door-piano',
          carcass: {
            width: 450,
            height: 700,
            depth: 350,
            jointPriority: 'lateral-over-bottom',
            roofType: 'solid-panel',
            hasBacking: false,
          },
          bays: [
            {
              type: 'doors',
              count: 1,
              hingeSide: 'right',
              mountType: 'full-overlay',
              doorThicknessMm: 9,
              hingeType: 'piano-hinge',
              catchType: 'roller-catch',
              handle: {
                type: 'knob',
              },
            },
          ],
          materials,
        },
        defaultOptions,
      );

      const pianoHingeJoints = res.module.joints.filter((j) => j.kind === 'piano-hinge');
      expect(pianoHingeJoints.length).toBe(1);

      const rollerCatchJoints = res.module.joints.filter((j) => j.kind === 'roller-catch');
      expect(rollerCatchJoints.length).toBe(1);

      const handleJoints = res.module.joints.filter((j) => j.kind === 'handle');
      expect(handleJoints.length).toBe(1);

      // Check BOM
      const hardware = generateBOMHardware(res.module);
      const pianoBOM = hardware.find((h) => h.hardwareId === 'hw-hinge-piano');
      expect(pianoBOM).toBeDefined();

      const rollerBOM = hardware.find((h) => h.hardwareId === 'hw-catch-roller');
      expect(rollerBOM).toBeDefined();

      const knobBOM = hardware.find((h) => h.hardwareId === 'hw-handle');
      expect(knobBOM).toBeDefined();
    });
  });

  describe('2. Standard 18mm Door with Concealed Cup Hinges & Push Catch', () => {
    it('generates standard Ø35mm cup hinges and push-to-open latch', () => {
      const res = buildModularModule(
        {
          id: 'mod-standard-door',
          carcass: {
            width: 600,
            height: 800,
            depth: 500,
            jointPriority: 'lateral-over-bottom',
            roofType: 'solid-panel',
            hasBacking: false,
          },
          bays: [
            {
              type: 'doors',
              count: 1,
              hingeSide: 'left',
              mountType: 'full-overlay',
              doorThicknessMm: 18,
              hingeType: 'cup-35',
              catchType: 'push-catch',
            },
          ],
          materials,
        },
        defaultOptions,
      );

      const cupJoints = res.module.joints.filter((j) => j.kind === 'hinge');
      expect(cupJoints.length).toBeGreaterThanOrEqual(2);

      const pushJoints = res.module.joints.filter((j) => j.kind === 'push-catch');
      expect(pushJoints.length).toBe(1);

      // Resolve machining: door MUST have Ø35mm drillings
      const door = res.module.pieces.find((p) => p.role.includes('door'));
      const allOps = deriveModuleDrillOperations(res.module.pieces, res.module.joints);
      const doorOps = allOps.filter((op) => op.pieceId === door?.id);
      const cupOperations = doorOps.filter((op) => op.diameterMm === 35);
      expect(cupOperations.length).toBeGreaterThanOrEqual(2);

      // Hardware BOM
      const hardware = generateBOMHardware(res.module);
      const cupBOM = hardware.find((h) => h.hardwareId === 'hw-hinge-cup-35');
      expect(cupBOM).toBeDefined();

      const pushBOM = hardware.find((h) => h.hardwareId === 'hw-catch-push');
      expect(pushBOM).toBeDefined();
    });
  });

  describe('3. Interior Drawer Stack with Hinge Compensatory Spacer (Faja Compensatoria)', () => {
    it('creates physical hinge spacer piece, deducts width, and anchors slides to spacer', () => {
      const spacerWidthMm = 25;
      const res = buildModularModule(
        {
          id: 'mod-drawers-with-spacer',
          carcass: {
            width: 600,
            height: 800,
            depth: 500,
            jointPriority: 'lateral-over-bottom',
            roofType: 'solid-panel',
            hasBacking: false,
          },
          bays: [
            {
              type: 'drawer-stack',
              drawerTracks: [{ type: 'fractional', valueFr: 1 }, { type: 'fractional', valueFr: 1 }],
              slideType: 'telescopic',
              hasHingeSpacer: true,
              hingeSpacerSide: 'left',
              hingeSpacerWidthMm: spacerWidthMm,
              handle: {
                type: 'bar',
                centerToCenterMm: 96,
              },
            },
          ],
          materials,
        },
        defaultOptions,
      );

      // Verify physical hinge spacer piece exists
      const spacerPiece = res.module.pieces.find((p) => p.role === 'hinge-spacer');
      expect(spacerPiece).toBeDefined();
      expect(spacerPiece?.thicknessMm).toBe(spacerWidthMm);

      // Slide joints on left side must anchor to the spacerPiece.id, NOT to the carcass side-left!
      const slideJoints = res.module.joints.filter((j) => j.kind === 'slide');
      expect(slideJoints.length).toBe(4); // 2 drawers * 2 slides

      const leftSlideJoints = slideJoints.filter(
        (j) => j.a.pieceId === spacerPiece?.id || j.b.pieceId === spacerPiece?.id,
      );
      expect(leftSlideJoints.length).toBe(2);

      // Verify handle joints on drawer fronts
      const handleJoints = res.module.joints.filter((j) => j.kind === 'handle');
      expect(handleJoints.length).toBe(2); // 1 per drawer

      // Check BOM hardware
      const hardware = generateBOMHardware(res.module);
      const handleBOM = hardware.find((h) => h.hardwareId === 'hw-handle');
      expect(handleBOM).toBeDefined();
      expect(handleBOM?.count).toBe(2);
    });

    it('works correctly when hinge spacer is on the right side', () => {
      const res = buildModularModule(
        {
          id: 'mod-drawers-right-spacer',
          carcass: {
            width: 600,
            height: 800,
            depth: 500,
            jointPriority: 'lateral-over-bottom',
            roofType: 'solid-panel',
            hasBacking: false,
          },
          bays: [
            {
              type: 'drawer-stack',
              drawerTracks: [{ type: 'fractional', valueFr: 1 }],
              slideType: 'telescopic',
              hasHingeSpacer: true,
              hingeSpacerSide: 'right',
              hingeSpacerWidthMm: 36,
            },
          ],
          materials,
        },
        defaultOptions,
      );

      const spacerPiece = res.module.pieces.find((p) => p.role === 'hinge-spacer');
      expect(spacerPiece).toBeDefined();
      expect(spacerPiece?.thicknessMm).toBe(36);

      const slideJoints = res.module.joints.filter((j) => j.kind === 'slide');
      const rightSlideJoints = slideJoints.filter(
        (j) => j.a.pieceId === spacerPiece?.id || j.b.pieceId === spacerPiece?.id,
      );
      expect(rightSlideJoints.length).toBe(1);
    });
  });
});
