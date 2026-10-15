import { describe, it, expect } from 'vitest';
import {
  resolveCarcass,
  resolveTracks,
  subdivideBay,
  formatTracksToGridString,
  parseGridStringToTracks,
  resolveBayContent,
  buildModularModule,
  getModularPresetById,
  type BayBoundingBox,
  type ModuleMaterialRoles,
} from '../src/resolver';

describe('Modular Parametric Composition Engine - Fase 1', () => {
  const materials: ModuleMaterialRoles = {
    carcassMaterialId: 'mat-egger-white-18',
    frontsMaterialId: 'mat-egger-oak-18',
    drawerBoxesMaterialId: 'mat-mdf-white-15',
    backingsMaterialId: 'mat-mdf-white-3',
  };

  describe('1.1 AnchorSolver', () => {
    it('resolves standard carcass with lateral-over-bottom and front-back rails', () => {
      const res = resolveCarcass({
        carcass: {
          width: 600,
          height: 720,
          depth: 560,
          jointPriority: 'lateral-over-bottom',
          roofType: 'front-back-rails',
          railWidthMm: 80,
          hasBacking: true,
          backingGrooveDistanceMm: 15,
          backingGrooveDepthMm: 8,
          backingThicknessMm: 3,
        },
        carcassMaterialId: materials.carcassMaterialId,
        carcassThicknessMm: 18,
        backingMaterialId: materials.backingsMaterialId,
      });

      // Sides: full height 720, depth 560
      const sideL = res.pieces.find((p) => p.role === 'side-left');
      const sideR = res.pieces.find((p) => p.role === 'side-right');
      const bottom = res.pieces.find((p) => p.role === 'bottom');
      const railFront = res.pieces.find((p) => p.id.includes('rail-front'));
      const railBack = res.pieces.find((p) => p.id.includes('rail-back'));
      const back = res.pieces.find((p) => p.role === 'back');

      expect(sideL).toBeDefined();
      expect(sideR).toBeDefined();
      expect(bottom).toBeDefined();
      expect(railFront).toBeDefined();
      expect(railBack).toBeDefined();
      expect(back).toBeDefined();

      // Bottom width = 600 - 2 * 18 = 564
      expect(bottom!.contour.points[1]!.x).toBe(564);
      expect(bottom!.contour.points[2]!.y).toBe(560);

      // Rails width = 564, depth = 80
      expect(railFront!.contour.points[1]!.x).toBe(564);
      expect(railFront!.contour.points[2]!.y).toBe(80);

      // Back width = 564 + 2 * 8 = 580
      expect(back!.contour.points[1]!.x).toBe(580);
      expect(back!.materialId).toBe('mat-mdf-white-3');

      // Interior cavity
      expect(res.interior.width).toBe(564);
      expect(res.interior.height).toBe(720 - 2 * 18); // 684
      expect(res.interior.x).toBe(18);
      expect(res.interior.y).toBe(18);

      // Confirmat joints connecting rails and bottom to sides
      const confirmatJoints = res.joints.filter((j) => j.kind === 'confirmat');
      expect(confirmatJoints.length).toBeGreaterThanOrEqual(6); // 2 bottom + 2 railFront + 2 railBack
    });

    it('resolves carcass with bottom-over-lateral and solid-panel roof', () => {
      const res = resolveCarcass({
        carcass: {
          width: 800,
          height: 900,
          depth: 350,
          jointPriority: 'bottom-over-lateral',
          roofType: 'solid-panel',
          hasBacking: false,
        },
        carcassMaterialId: materials.carcassMaterialId,
        carcassThicknessMm: 18,
      });

      const bottom = res.pieces.find((p) => p.role === 'bottom');
      const sideL = res.pieces.find((p) => p.role === 'side-left');
      const top = res.pieces.find((p) => p.role === 'top');

      // In bottom-over-lateral, bottom spans full width 800
      expect(bottom!.contour.points[1]!.x).toBe(800);
      // Sides are shorter: 900 - 2 * 18 = 864
      expect(sideL!.contour.points[2]!.y).toBe(864);
      // Top spans full width 800
      expect(top!.contour.points[1]!.x).toBe(800);

      // Cavity starts at y = 0 (flush with top of bottom panel)
      expect(res.interior.y).toBe(0);
      expect(res.interior.height).toBe(864);

      // Top placement node sits flush on top of the sides at y = 864
      const topNode = res.placementNodes.find((n) => n.pieceId === top!.id);
      expect(topNode!.relativeOffset.y).toBe(864);

      // Joints from roof into top edges of sides
      const roofJoint = res.joints.find((j) => j.a.pieceId === top!.id);
      expect(roofJoint).toBeDefined();
      expect(roofJoint!.a.faceId).toBe('bottom');
      expect(roofJoint!.b.faceId).toBe('top-edge');
    });
  });

  describe('1.2 GridSolver', () => {
    it('distributes purely fractional tracks with exact remainder preservation', () => {
      // 1000mm divided into 3 equal tracks (1fr, 1fr, 1fr) with two 18mm dividers
      // Space for tracks = 1000 - 36 = 964. 964 / 3 = 321.3333
      const { tracks, dividers } = resolveTracks(
        1000,
        [
          { type: 'fractional', valueFr: 1 },
          { type: 'fractional', valueFr: 1 },
          { type: 'fractional', valueFr: 1 },
        ],
        18,
      );

      expect(tracks.length).toBe(3);
      expect(dividers.length).toBe(2);

      const totalTracksSize = tracks.reduce((sum, t) => sum + t.sizeMm, 0);
      const totalDividersSize = dividers.reduce((sum, d) => sum + d.thicknessMm, 0);

      expect(totalTracksSize + totalDividersSize).toBe(1000);
      expect(tracks[0]!.sizeMm).toBe(321);
      expect(tracks[1]!.sizeMm).toBe(322);
      expect(tracks[2]!.sizeMm).toBe(321);
    });

    it('distributes mixed fixed mm and fractional fr tracks', () => {
      // 720mm height, 1 fixed drawer of 140mm, and 2 fractional drawers 1fr 1fr
      // 0 dividers in drawer stack
      const { tracks } = resolveTracks(
        720,
        [
          { type: 'fixed', valueMm: 140 },
          { type: 'fractional', valueFr: 1 },
          { type: 'fractional', valueFr: 1 },
        ],
        0,
      );

      expect(tracks[0]!.sizeMm).toBe(140);
      expect(tracks[1]!.sizeMm).toBe(290);
      expect(tracks[2]!.sizeMm).toBe(290);
      expect(tracks[0]!.sizeMm + tracks[1]!.sizeMm + tracks[2]!.sizeMm).toBe(720);
    });

    it('subdivides a bay horizontally into 2 equal bays with vertical partition', () => {
      const parentBay: BayBoundingBox = {
        bayIndex: 0,
        x: 18,
        y: 18,
        z: 0,
        width: 900,
        height: 684,
        depth: 560,
        leftPieceId: 'carcass-side-l',
        rightPieceId: 'carcass-side-r',
        bottomPieceId: 'carcass-bottom',
        topPieceId: 'carcass-rail-front',
      };

      const result = subdivideBay(
        parentBay,
        {
          axis: 'horizontal',
          tracks: [
            { type: 'fractional', valueFr: 1 },
            { type: 'fractional', valueFr: 1 },
          ],
        },
        materials.carcassMaterialId,
        18,
      );

      expect(result.dividerPieces.length).toBe(1);
      expect(result.dividerPieces[0]!.role).toBe('partition');
      expect(result.bayBoxes.length).toBe(2);

      // Width of each bay: (900 - 18) / 2 = 441
      expect(result.bayBoxes[0]!.width).toBe(441);
      expect(result.bayBoxes[1]!.width).toBe(441);
      expect(result.bayBoxes[0]!.rightPieceId).toBe(result.dividerPieces[0]!.id);
      expect(result.bayBoxes[1]!.leftPieceId).toBe(result.dividerPieces[0]!.id);
    });
  });

  describe('1.3 ComponentSolver', () => {
    const testBay: BayBoundingBox = {
      bayIndex: 0,
      x: 18,
      y: 18,
      z: 0,
      width: 564,
      height: 684,
      depth: 560,
      leftPieceId: 'carcass-side-l',
      rightPieceId: 'carcass-side-r',
      bottomPieceId: 'carcass-bottom',
      topPieceId: 'carcass-rail-front',
    };

    it('resolves shelves with shelf-pins and anti-sag brace', () => {
      const result = resolveBayContent(
        testBay,
        {
          type: 'shelves',
          count: 2,
          shelfType: 'adjustable',
          setbackMm: 20,
          hasAntiSagBrace: true,
        },
        materials,
        {
          carcassThicknessMm: 18,
          rootPieceId: 'carcass-side-l',
        },
      );

      const shelves = result.pieces.filter((p) => p.role === 'shelf');
      const braces = result.pieces.filter((p) => p.role === 'shelf-brace');
      expect(shelves.length).toBe(2);
      expect(braces.length).toBe(2);

      // Shelf pins joints
      const pinJoints = result.joints.filter((j) => j.kind === 'shelf-pin');
      expect(pinJoints.length).toBe(4); // 2 shelves * 2 sides
    });

    it('resolves drawer-stack with multi-material boxes and inset transoms', () => {
      const result = resolveBayContent(
        testBay,
        {
          type: 'drawer-stack',
          drawerTracks: [
            { type: 'fixed', valueMm: 140 },
            { type: 'fractional', valueFr: 1 },
          ],
          frontMount: 'inset',
          hasTransomDividers: true,
          slideType: 'telescopic',
        },
        materials,
        {
          carcassThicknessMm: 18,
          frontThicknessMm: 18,
          boxThicknessMm: 15,
          rootPieceId: 'carcass-side-l',
        },
      );

      // Transom divider
      const transoms = result.pieces.filter((p) => p.role === 'transom');
      expect(transoms.length).toBe(1);

      // Fronts use frontsMaterialId ('mat-egger-oak-18')
      const fronts = result.pieces.filter((p) => p.role === 'drawer-front');
      expect(fronts.length).toBe(2);
      expect(fronts[0]!.materialId).toBe('mat-egger-oak-18');

      // Boxes use drawerBoxesMaterialId ('mat-mdf-white-15')
      const boxSides = result.pieces.filter((p) => p.role === 'drawer-side');
      expect(boxSides.length).toBe(4);
      expect(boxSides[0]!.materialId).toBe('mat-mdf-white-15');
      expect(boxSides[0]!.thicknessMm).toBe(15);

      // Slide joints generated
      const slideJoints = result.joints.filter((j) => j.kind === 'slide');
      expect(slideJoints.length).toBe(4); // 2 drawers * 2 sides

      // Drawer 1 (Cajón 1) is at the top (y = 564 with gap), Drawer 2 is at the bottom (y = 20 with gap)
      const front1Node = result.placementNodes.find((n) => n.pieceId.includes('-drawer-front-1'));
      const front2Node = result.placementNodes.find((n) => n.pieceId.includes('-drawer-front-2'));
      expect(front1Node).toBeDefined();
      expect(front2Node).toBeDefined();
      expect(front1Node!.relativeOffset.y).toBe(564);
      expect(front2Node!.relativeOffset.y).toBe(20);
      expect(front1Node!.relativeOffset.y).toBeGreaterThan(front2Node!.relativeOffset.y);
    });

    it('resolves pull-out-tray with telescopic slide deduction and lips', () => {
      const result = resolveBayContent(
        testBay,
        {
          type: 'pull-out-tray',
          lipHeightMm: 40,
          slideType: 'telescopic',
        },
        materials,
        {
          carcassThicknessMm: 18,
          boxThicknessMm: 15,
          rootPieceId: 'carcass-side-l',
        },
      );

      const trayBottom = result.pieces.find((p) => p.role === 'tray-bottom');
      expect(trayBottom).toBeDefined();
      // Telescopic deduction is 25.4mm
      // Width = 564 - 25.4 = 538.6 -> 539mm
      expect(trayBottom!.contour.points[1]!.x).toBe(539);
      expect(trayBottom!.materialId).toBe('mat-mdf-white-15');

      const lips = result.pieces.filter((p) => p.role.includes('tray-lip'));
      expect(lips.length).toBe(4); // side-l, side-r, front, back

      const slideJoints = result.joints.filter((j) => j.kind === 'slide');
      expect(slideJoints.length).toBe(2);
    });

    it('resolves bi-fold vertical lift closure with intermediate hinges', () => {
      const result = resolveBayContent(
        testBay,
        {
          type: 'bi-fold-closure',
          leafTracks: [
            { type: 'fractional', valueFr: 1 },
            { type: 'fractional', valueFr: 1 },
          ],
          hingeType: 'aventos',
          openingDirection: 'vertical-lift',
        },
        materials,
        {
          carcassThicknessMm: 18,
          frontThicknessMm: 18,
          rootPieceId: 'carcass-side-l',
        },
      );

      const leaves = result.pieces.filter((p) => p.role === 'bifold-leaf');
      expect(leaves.length).toBe(2);
      expect(leaves[0]!.materialId).toBe('mat-egger-oak-18');

      // Top anchor hinges + intermediate hinges
      const hingeJoints = result.joints.filter((j) => j.kind === 'hinge');
      expect(hingeJoints.length).toBe(4); // 2 top anchor + 2 intermediate connecting the two leaves
    });
  });

  describe('1.4 End-to-End ModularModule Assembly & Presets', () => {
    it('builds a 3-drawer unit completely and resolves placement tree without errors', () => {
      const preset = getModularPresetById('preset-drawer-unit-3');
      const def = preset.createDefinition(
        { width: 500, height: 720, depth: 560 },
        materials,
      );

      const output = buildModularModule(def);

      expect(output.module.pieces.length).toBeGreaterThan(10);
      expect(output.resolvedPieces.length).toBe(output.module.pieces.length);
      expect(output.placementTree.resolvePositions().size).toBe(output.module.pieces.length);

      // Verify no NaN or undefined coordinates
      for (const piece of output.resolvedPieces) {
        expect(piece.contour.points.length).toBeGreaterThanOrEqual(4);
        expect(piece.cutDimensionsMm.width).toBeGreaterThan(0);
        expect(piece.cutDimensionsMm.height).toBeGreaterThan(0);
      }
    });

    it('builds a 2-bay partition combo module with shelves and drawers', () => {
      const preset = getModularPresetById('preset-partition-combo');
      const def = preset.createDefinition(
        { width: 900, height: 720, depth: 560 },
        materials,
      );

      const output = buildModularModule(def);

      expect(output.bayBoxes.length).toBe(2);

      const partition = output.module.pieces.find((p) => p.role === 'partition');
      expect(partition).toBeDefined();

      const shelves = output.module.pieces.filter((p) => p.role === 'shelf');
      expect(shelves.length).toBe(2);

      const drawerFronts = output.module.pieces.filter((p) => p.role === 'drawer-front');
      expect(drawerFronts.length).toBe(3);
    });
  });

  describe('1.5 CSS Grid Track String Parsing and Formatting', () => {
    it('formats TrackSize arrays into CSS Grid strings', () => {
      expect(formatTracksToGridString([
        { type: 'fixed', valueMm: 140 },
        { type: 'fractional', valueFr: 1 },
        { type: 'fractional', valueFr: 1 },
      ])).toBe('140mm 1fr 1fr');

      expect(formatTracksToGridString([
        { type: 'fractional', valueFr: 1 },
        { type: 'fractional', valueFr: 2 },
      ])).toBe('1fr 2fr');
    });

    it('parses CSS Grid strings into TrackSize arrays', () => {
      expect(parseGridStringToTracks('140mm 1fr 1fr')).toEqual([
        { type: 'fixed', valueMm: 140 },
        { type: 'fractional', valueFr: 1 },
        { type: 'fractional', valueFr: 1 },
      ]);

      expect(parseGridStringToTracks('120 1fr 2.5fr')).toEqual([
        { type: 'fixed', valueMm: 120 },
        { type: 'fractional', valueFr: 1 },
        { type: 'fractional', valueFr: 2.5 },
      ]);

      expect(parseGridStringToTracks('140mm, 1fr, 1fr')).toEqual([
        { type: 'fixed', valueMm: 140 },
        { type: 'fractional', valueFr: 1 },
        { type: 'fractional', valueFr: 1 },
      ]);

      expect(parseGridStringToTracks('invalid-string')).toBeNull();
      expect(parseGridStringToTracks('')).toBeNull();
    });
  });

  describe('1.6 Puertas con Estantes Interiores (Punto 3)', () => {
    it('genera estantes interiores detrás de las puertas batientes', () => {
      const res = buildModularModule(
        {
          id: 'test-doors-with-shelves',
          carcass: {
            width: 800,
            height: 900,
            depth: 600,
            jointPriority: 'lateral-over-bottom',
            roofType: 'solid-panel',
            hasBacking: true,
          },
          bays: [
            {
              type: 'doors',
              count: 2,
              mountType: 'full-overlay',
              interiorShelvesCount: 2,
              shelfType: 'adjustable',
              shelvesSetbackMm: 25,
            },
          ],
          materials,
          edgeBandId: 'band-pvc-0.45',
        },
        {
          carcassThicknessMm: 18,
          frontThicknessMm: 18,
          boxThicknessMm: 15,
          edgeBands: [{ id: 'band-pvc-0.45', kind: 'veneer', thicknessMm: 0.45, pricePerMeter: 1 }],
        },
      );

      const doors = res.module.pieces.filter((p) => p.role.includes('door'));
      const shelves = res.module.pieces.filter((p) => p.role.includes('shelf'));

      expect(doors.length).toBe(2);
      expect(shelves.length).toBe(2);

      // Verify setback: bay.depth = 600, setback = 25 -> shelf depth = 575
      expect(shelves[0]!.contour.points[2]!.y).toBe(575);

      // Verify shelf-pin joints for adjustable shelves
      const shelfJoints = res.module.joints.filter((j) => j.kind === 'shelf-pin');
      expect(shelfJoints.length).toBeGreaterThanOrEqual(4);
    });

    it('genera estantes interiores fijos con confirmat detrás de puertas', () => {
      const res = buildModularModule(
        {
          id: 'test-doors-fixed-shelves',
          carcass: {
            width: 600,
            height: 800,
            depth: 500,
            jointPriority: 'lateral-over-bottom',
            roofType: 'solid-panel',
            hasBacking: true,
          },
          bays: [
            {
              type: 'doors',
              count: 1,
              mountType: 'inset',
              interiorShelvesCount: 1,
              shelfType: 'fixed',
            },
          ],
          materials,
        },
        { carcassThicknessMm: 18, frontThicknessMm: 18, boxThicknessMm: 15 },
      );

      const shelves = res.module.pieces.filter((p) => p.role.includes('shelf'));
      expect(shelves.length).toBe(1);

      // Fixed shelf has confirmat joints
      const confirmatJoints = res.module.joints.filter(
        (j) => j.kind === 'confirmat' && (j.a.pieceId.includes('shelf') || j.b.pieceId.includes('shelf')),
      );
      expect(confirmatJoints.length).toBe(2);
    });
  });

  describe('1.7 Muebles Isla, Fondos Inteligentes y Tirantes Estructurales (Puntos 4, 5, 6)', () => {
    it('Punto 4: resuelve mueble tipo isla sin fondo y con cantos traseros aplacados', () => {
      const res = resolveCarcass({
        carcass: {
          width: 900,
          height: 850,
          depth: 600,
          jointPriority: 'lateral-over-bottom',
          roofType: 'solid-panel',
          hasBacking: true, // Should be overridden by isIslandCabinet
          isIslandCabinet: true,
        },
        carcassMaterialId: materials.carcassMaterialId,
        carcassThicknessMm: 18,
        edgeBandId: 'band-pvc-island',
      });

      // No back panel
      const back = res.pieces.find((p) => p.role === 'back');
      expect(back).toBeUndefined();

      // Rear edges of sides have edge banding applied
      const sideL = res.pieces.find((p) => p.role === 'side-left')!;
      const rearFaceL = sideL.faces.find((f) => f.id === 'left-edge');
      expect(rearFaceL?.edgeBandId).toBe('band-pvc-island');

      const sideR = res.pieces.find((p) => p.role === 'side-right')!;
      const rearFaceR = sideR.faces.find((f) => f.id === 'left-edge');
      expect(rearFaceR?.edgeBandId).toBe('band-pvc-island');
    });

    it('Punto 5: fondo fino (3mm) no se atornilla por cantos (ranurado con joint groove)', () => {
      const res = resolveCarcass({
        carcass: {
          width: 600,
          height: 720,
          depth: 560,
          jointPriority: 'lateral-over-bottom',
          roofType: 'solid-panel',
          hasBacking: true,
          backingThicknessMm: 3,
        },
        carcassMaterialId: materials.carcassMaterialId,
        carcassThicknessMm: 18,
      });

      const back = res.pieces.find((p) => p.role === 'back')!;
      expect(back).toBeDefined();
      expect(back.structural).toBe(false);

      // Verify no confirmat joints into the 3mm back piece
      const backConfirmat = res.joints.filter(
        (j) => j.kind === 'confirmat' && (j.a.pieceId === back.id || j.b.pieceId === back.id),
      );
      expect(backConfirmat.length).toBe(0);

      // Verify groove joints
      const backGroove = res.joints.filter(
        (j) => j.kind === 'groove' && (j.a.pieceId === back.id || j.b.pieceId === back.id),
      );
      expect(backGroove.length).toBeGreaterThanOrEqual(3);
    });

    it('Punto 5: fondo grueso estructural (18mm) se atornilla con confirmat a los laterales', () => {
      const res = resolveCarcass({
        carcass: {
          width: 600,
          height: 720,
          depth: 560,
          jointPriority: 'lateral-over-bottom',
          roofType: 'solid-panel',
          hasBacking: true,
          backingThicknessMm: 18,
        },
        carcassMaterialId: materials.carcassMaterialId,
        carcassThicknessMm: 18,
      });

      const back = res.pieces.find((p) => p.role === 'back')!;
      expect(back).toBeDefined();
      expect(back.structural).toBe(true);
      expect(back.thicknessMm).toBe(18);

      // Verify confirmat joints into the 18mm structural back piece
      const backConfirmat = res.joints.filter(
        (j) => j.kind === 'confirmat' && (j.a.pieceId === back.id || j.b.pieceId === back.id),
      );
      expect(backConfirmat.length).toBeGreaterThanOrEqual(3);
    });

    it('Punto 6: mueble sin fondo con tirantes estructurales superior e inferior para escuadra', () => {
      const res = resolveCarcass({
        carcass: {
          width: 700,
          height: 800,
          depth: 500,
          jointPriority: 'lateral-over-bottom',
          roofType: 'front-back-rails',
          hasBacking: false,
          rearStructuralRails: 'top-and-bottom',
          rearStructuralRailsWidthMm: 90,
        },
        carcassMaterialId: materials.carcassMaterialId,
        carcassThicknessMm: 18,
      });

      // No back piece
      expect(res.pieces.find((p) => p.role === 'back')).toBeUndefined();

      // Top and bottom rear structural rails exist
      const railTop = res.pieces.find((p) => p.id.includes('rear-rail-top'));
      const railBottom = res.pieces.find((p) => p.id.includes('rear-rail-bottom'));

      expect(railTop).toBeDefined();
      expect(railBottom).toBeDefined();
      expect(railTop!.contour.points[2]!.y).toBe(90);
      expect(railBottom!.contour.points[2]!.y).toBe(90);

      // Confirmat joints connecting rails to left and right sides
      const topRailJoints = res.joints.filter(
        (j) => j.kind === 'confirmat' && (j.a.pieceId === railTop!.id || j.b.pieceId === railTop!.id),
      );
      const bottomRailJoints = res.joints.filter(
        (j) => j.kind === 'confirmat' && (j.a.pieceId === railBottom!.id || j.b.pieceId === railBottom!.id),
      );

      expect(topRailJoints.length).toBe(2);
      expect(bottomRailJoints.length).toBe(2);
    });
  });
});
