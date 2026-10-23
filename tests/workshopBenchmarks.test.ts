import { describe, it, expect } from 'vitest';
import { buildModularModule } from '../src/resolver/composition/compositionEngine';
import { deriveModuleDrillOperations } from '../src/resolver/machining';
import { type ModularModuleDefinition } from '../src/resolver/composition/types';
import { type Piece } from '../src/model';

function getPieceDimensions(p: { contour: { points: { x: number; y: number }[] } } | Piece) {
  const xs = p.contour.points.map((pt) => pt.x);
  const ys = p.contour.points.map((pt) => pt.y);
  return {
    width: Math.round(Math.max(...xs) - Math.min(...xs)),
    height: Math.round(Math.max(...ys) - Math.min(...ys)),
  };
}

describe('Workshop Benchmarks - Hand-Calculated Canonical Projects', () => {
  // Test Materials
  const materials = {
    carcassMaterialId: 'mat-melamine-white-18',
    frontsMaterialId: 'mat-melamine-white-18',
    drawerBoxesMaterialId: 'mat-melamine-white-15',
    backingsMaterialId: 'mat-mdf-white-3',
  };

  describe('Benchmark 1: Módulo Bajo Mesada Estándar 2 Puertas (800 x 720 x 580 mm)', () => {
    // Definición canónica de taller:
    // - Ancho: 800 mm, Alto: 720 mm (sin patas), Profundidad: 580 mm.
    // - Laterales al piso: piso entre laterales (jointPriority: 'lateral-over-bottom').
    // - Espesor casco: 18 mm.
    // - Techo: Fajas de amarre (front-back-rails).
    // - Fondo: MDF 3 mm ranurado a 10 mm del borde trasero (ranura 8 mm prof).
    // - Vano: 2 puertas batientes aplicadas + 1 estante interior regulable.
    const def: ModularModuleDefinition = {
      id: 'bm-800-2p',
      carcass: {
        width: 800,
        height: 720,
        depth: 580,
        jointPriority: 'lateral-over-bottom',
        roofType: 'front-back-rails',
        railWidthMm: 100,
        hasBacking: true,
        backingType: 'groove',
        backingThicknessMm: 3,
        backingGrooveDistanceMm: 10,
        backingGrooveDepthMm: 8,
      },
      materials,
      bays: [
        {
          type: 'doors',
          count: 2,
          mountType: 'full-overlay',
          interiorShelvesCount: 1,
          shelfType: 'adjustable',
          shelvesSetbackMm: 20,
        },
      ],
    };

    const result = buildModularModule(def, {
      carcassThicknessMm: 18,
      frontThicknessMm: 18,
      backingThicknessMm: 3,
    });

    it('calcula el despiece exacto a mano para el casco y las placas estructurales', () => {
      // 1. Laterales (Laterales al piso):
      // Alto total = 720 mm, Profundidad total = 580 mm, Espesor = 18 mm.
      const sideL = result.resolvedPieces.find((p) => p.role === 'side-left');
      const sideR = result.resolvedPieces.find((p) => p.role === 'side-right');
      expect(sideL).toBeDefined();
      expect(sideR).toBeDefined();

      const dimL = getPieceDimensions(sideL!);
      const dimR = getPieceDimensions(sideR!);
      expect(dimL.width).toBe(580);
      expect(dimL.height).toBe(720);
      expect(dimR.width).toBe(580);
      expect(dimR.height).toBe(720);

      // 2. Piso (entre laterales):
      // Ancho libre = 800 - 2 * 18 = 764 mm. Profundidad = 580 mm.
      const bottom = result.resolvedPieces.find((p) => p.role === 'bottom');
      expect(bottom).toBeDefined();
      const dimBottom = getPieceDimensions(bottom!);
      expect(dimBottom.width).toBe(764);
      expect(dimBottom.height).toBe(580);

      // 3. Fajas de techo (frontal y trasera):
      // Ancho libre = 764 mm. Ancho de faja = 100 mm.
      const rails = result.resolvedPieces.filter((p) => p.role === 'rail');
      expect(rails.length).toBeGreaterThanOrEqual(2);
      for (const r of rails) {
        const dimR = getPieceDimensions(r);
        expect(dimR.width).toBe(764);
        expect(dimR.height).toBe(100);
      }

      // 4. Estante regulable interior:
      // Ancho = 764 mm. Profundidad útil vano = 580 - (10mm ranura + 3mm fondo) = 567 mm. Estante = 567 - setback (20mm) = 547 mm.
      const shelf = result.resolvedPieces.find((p) => p.role === 'shelf');
      expect(shelf).toBeDefined();
      const dimShelf = getPieceDimensions(shelf!);
      expect(dimShelf.width).toBe(764);
      expect(dimShelf.height).toBe(580 - 13 - 20);

      // 5. Fondo MDF 3mm ranurado:
      // Ancho luz interior = 764 mm + 2 * 8 mm de ranura = 780 mm.
      const backing = result.resolvedPieces.find((p) => p.role === 'back');
      expect(backing).toBeDefined();
      const dimBack = getPieceDimensions(backing!);
      expect(dimBack.width).toBe(764 + 2 * 8);
    });

    it('calcula las puertas batientes con luz perimetral exacta', () => {
      // 2 puertas para vano exterior de 800 x 720 mm.
      // Ancho total cubierto con solape total = 800 mm. Con reveal perimetral de 1.5mm y gap central de 2mm:
      // singleDoorWidth = (800 - 2*1.5 - 2) / 2 = 397.5 mm -> redondeado a 398 mm.
      const doors = result.resolvedPieces.filter((p) => p.role === 'door-left' || p.role === 'door-right');
      expect(doors).toHaveLength(2);
      for (const door of doors) {
        const dim = getPieceDimensions(door);
        expect(dim.width).toBe(398);
        // Alto de puerta = 720 - 2 * 1.5 reveal = 717 mm
        expect(dim.height).toBe(717);
      }
    });

    it('posiciona los anclajes y mecanizados según norma de sistema 32 y carpintería', () => {
      const ops = deriveModuleDrillOperations(result.module.pieces, result.module.joints);

      // 1. Agujeros de confirmat en laterales para fijar el piso (eje a 9mm):
      const sideConfirmatOps = ops.filter(
        (o) => (o.pieceId.includes('side-left') || o.pieceId.includes('side-right')) && o.isThrough && o.diameterMm === 7
      );
      expect(sideConfirmatOps.length).toBeGreaterThan(0);

      // 2. Cazoletas de bisagra en las puertas:
      // Diámetro 35 mm, a 100 mm de extremos superior/inferior
      const doorHingeOps = ops.filter((o) => o.pieceId.includes('door') && o.diameterMm === 35);
      expect(doorHingeOps.length).toBeGreaterThanOrEqual(4); // 2 bisagras por puerta = 4
      for (const op of doorHingeOps) {
        expect(op.diameterMm).toBe(35);
        expect(op.depthMm).toBe(12);
        // Puerta izquierda bisagra en x=21.5mm, puerta derecha en borde derecho (398 - 21.5 = 376.5mm)
        expect([21.5, 376.5]).toContain(op.positionMm.x);
      }

      // 3. Bases de bisagra en los laterales del mueble: a 37 mm del borde frontal (sistema 32)
      const sideHingeBaseOps = ops.filter(
        (o) => (o.pieceId.includes('side-left') || o.pieceId.includes('side-right')) && o.positionMm.x === 37
      );
      expect(sideHingeBaseOps.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Benchmark 2: Módulo Cajonero de Cocina (450 x 720 x 580 mm) con Correderas Telescópicas de 500 mm', () => {
    // Definición de taller:
    // - Ancho: 450 mm, Alto: 720 mm, Profundidad: 580 mm.
    // - 3 cajones con correderas telescópicas comerciales de 500 mm (boxDepthMm: 500).
    // - Holgura telescópica = 25.4 mm (12.7 mm por lado).
    // - Espesor casco: 18 mm, Espesor cajas de cajón: 15 mm.
    // - Montaje frente: Aplicado (solapado).
    // - Fondo de cajones: Atornillado por debajo (bottom-screwed).
    const def: ModularModuleDefinition = {
      id: 'cajonero-450',
      carcass: {
        width: 450,
        height: 720,
        depth: 580,
        jointPriority: 'lateral-over-bottom',
        roofType: 'front-back-rails',
        railWidthMm: 100,
        hasBacking: true,
        backingType: 'groove',
        backingThicknessMm: 3,
      },
      materials,
      bays: [
        {
          type: 'drawer-stack',
          drawerTracks: [
            { type: 'fractional', valueFr: 1 },
            { type: 'fractional', valueFr: 1 },
            { type: 'fractional', valueFr: 1 },
          ],
          slideType: 'telescopic',
          boxDepthMm: 500, // Medida comercial de corredera seleccionada
          drawerType: 'standard',
          frontMount: 'applied',
          bottomMount: 'bottom-screwed',
          boxThicknessMm: 15,
        },
      ],
    };

    const result = buildModularModule(def, {
      carcassThicknessMm: 18,
      boxThicknessMm: 15,
      frontThicknessMm: 18,
      drawerBottomScrewedDeductionWidthMm: 2.0,
      drawerBottomScrewedDeductionDepthMm: 2.0,
    });

    it('verifica las dimensiones milimétricas exactas de la caja y laterales de cajón', () => {
      // Ancho libre interior del vano: 450 - 2 * 18 = 414 mm.
      // Holgura telescópica: 25.4 mm.
      // Ancho exterior de la caja del cajón: 414 - 25.4 = 388.6 mm (redondeado a 389 mm).
      const drawerSides = result.resolvedPieces.filter((p) => p.role === 'drawer-side');
      expect(drawerSides.length).toBe(6); // 3 cajones * 2 laterales = 6 piezas

      // Los laterales de cajón deben medir EXACTAMENTE 500 mm (la corredera comercial seleccionada)
      for (const side of drawerSides) {
        const dim = getPieceDimensions(side);
        expect(dim.width).toBe(500);
      }

      // Cabecera / trasera del cajón (frente interno de caja):
      // Ancho = ancho exterior caja (389 mm) - 2 * 15 mm (espesor laterales caja) = 359 mm.
      const drawerBoxFronts = result.resolvedPieces.filter((p) => p.role === 'drawer-box-front');
      expect(drawerBoxFronts.length).toBe(3);
      for (const bf of drawerBoxFronts) {
        const dim = getPieceDimensions(bf);
        expect(dim.width).toBe(359);
      }

      // Fondos de cajón atornillados por abajo:
      // Descuento perimetral de 2 mm para que no sobresalga del canto:
      // Ancho = 389 - 2 = 387 mm.
      // Profundidad = 500 - 2 = 498 mm.
      const drawerBottoms = result.resolvedPieces.filter((p) => p.role === 'drawer-bottom');
      expect(drawerBottoms.length).toBe(3);
      for (const b of drawerBottoms) {
        const dim = getPieceDimensions(b);
        expect(dim.width).toBe(387);
        expect(dim.height).toBe(498);
      }
    });

    it('posiciona los agujeros de corredera en el lateral del mueble a 37 mm del frente', () => {
      const ops = deriveModuleDrillOperations(result.module.pieces, result.module.joints);

      // Agujeros en los laterales del mueble para fijar las guías telescópicas
      const slideHoles = ops.filter(
        (o) => (o.pieceId.includes('side-left') || o.pieceId.includes('side-right')) && o.positionMm.x === 37
      );
      expect(slideHoles.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Benchmark 3: Módulo con Distribución Compleja y Cajonera Interior Especial', () => {
    // Definición de taller:
    // - Módulo de 900 x 800 x 450 mm.
    // - Vano subdividido horizontalmente en 2 columnas: Columna 1 (400 mm fija) y Columna 2 (restante).
    // - En Columna 1: Cajonera embutida (inset), tapa simple (simple-interior),
    //   corredera comercial de 350 mm (boxDepthMm: 350), fondo ranurado (grooved), placa de caja 15 mm.
    const def: ModularModuleDefinition = {
      id: 'mod-distrib-compleja',
      carcass: {
        width: 900,
        height: 800,
        depth: 450,
        jointPriority: 'lateral-over-bottom',
        roofType: 'solid-panel',
        hasBacking: true,
        backingType: 'groove',
        backingThicknessMm: 3,
      },
      materials,
      bays: [
        {
          type: 'subdivided',
          axis: 'horizontal', // División en columnas X
          tracks: [
            { type: 'fixed', valueMm: 400 },
            { type: 'fractional', valueFr: 1 },
          ],
          dividerThicknessMm: 18,
          jointType: 'confirmat',
          bays: [
            // Columna 1: 2 Cajones especiales
            {
              type: 'drawer-stack',
              drawerTracks: [
                { type: 'fractional', valueFr: 1 },
                { type: 'fractional', valueFr: 1 },
              ],
              slideType: 'telescopic',
              boxDepthMm: 350, // Corredera comercial 350 mm en mueble de 450 mm
              drawerType: 'simple-interior',
              frontMount: 'inset',
              bottomMount: 'grooved',
              boxThicknessMm: 15,
            },
            // Columna 2: Estantes
            {
              type: 'shelves',
              count: 2,
              shelfType: 'adjustable',
            },
          ],
        },
      ],
    };

    const result = buildModularModule(def, {
      carcassThicknessMm: 18,
      boxThicknessMm: 15,
      frontThicknessMm: 18,
    });

    it('calcula los cajones internos respetando la medida comercial de 350 mm y fondo ranurado', () => {
      // 1. Los laterales del cajón interior deben ser de 350 mm (no los 450 mm del módulo)
      const subDrawerSides = result.resolvedPieces.filter(
        (p) => p.role === 'drawer-side' && p.id.includes('drawer')
      );
      expect(subDrawerSides.length).toBe(4); // 2 cajones * 2 laterales
      for (const side of subDrawerSides) {
        const dim = getPieceDimensions(side);
        expect(dim.width).toBe(350);
      }

      // 2. Fondo ranurado:
      // Profundidad = 350 - 2 * 15 (frentes de caja) + 2 * 7 (ranura de 7mm) - 1mm juego = 333 mm
      const subDrawerBottoms = result.resolvedPieces.filter(
        (p) => p.role === 'drawer-bottom' && p.id.includes('drawer')
      );
      expect(subDrawerBottoms.length).toBe(2);
      for (const b of subDrawerBottoms) {
        const dim = getPieceDimensions(b);
        expect(dim.height).toBe(333);
      }

      // 3. Frentes embutidos (inset):
      // Ancho de la celda de columna 1 = 400 mm.
      // Frente embutido con luz perimetral (2mm por lado): 400 - 2 * 2 = 396 mm.
      const subDrawerFronts = result.resolvedPieces.filter(
        (p) => p.role === 'drawer-front' && p.id.includes('drawer')
      );
      expect(subDrawerFronts.length).toBe(2);
      for (const f of subDrawerFronts) {
        const dim = getPieceDimensions(f);
        expect(dim.width).toBe(396);
      }
    });
  });
});
