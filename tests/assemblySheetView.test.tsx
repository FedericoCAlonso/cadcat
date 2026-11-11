import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { AssemblySheetView } from '../src/ui/AssemblySheetView';
import {
  createPiece,
  createRectangularContour,
  generateAssemblySheet,
  buildWallShelving,
  type ResolvedPiece,
  type AssemblySheet,
  type WallShelvingDefinition,
  type SpatialPieceBox,
  type ModuleSpatialBounds,
} from '../src/resolver';

describe('AssemblySheetView Component', () => {
  const samplePieces: ResolvedPiece[] = [
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
      positionMm: { x: 582, y: 0, z: 0 },
      dimensionsMm: { width: 560, height: 800 },
    },
    {
      ...createPiece({
        id: 'bottom',
        role: 'bottom',
        materialId: 'mat-1',
        contour: createRectangularContour(564, 560),
        thicknessMm: 18,
      }),
      positionMm: { x: 18, y: 0, z: 0 },
      dimensionsMm: { width: 564, height: 560 },
    },
    {
      ...createPiece({
        id: 'shelf-1',
        role: 'shelf',
        materialId: 'mat-1',
        contour: createRectangularContour(564, 540),
        thicknessMm: 18,
      }),
      positionMm: { x: 18, y: 382, z: 0 },
      dimensionsMm: { width: 564, height: 540 },
    },
    {
      ...createPiece({
        id: 'top',
        role: 'top',
        materialId: 'mat-1',
        contour: createRectangularContour(564, 560),
        thicknessMm: 18,
      }),
      positionMm: { x: 18, y: 782, z: 0 },
      dimensionsMm: { width: 564, height: 560 },
    },
  ];

  it('renders fallback notice when no assembly sheet or pieces are passed', () => {
    const html = renderToString(
      <AssemblySheetView
        assemblySheet={null}
        pieces={[]}
      />
    );
    expect(html).toContain('No hay datos de armado disponibles');
  });

  it('renders standard assembly guide with gauges, SVG elevation, and sequential checklist', () => {
    const sheet: AssemblySheet = generateAssemblySheet({
      module: {
        moduleId: 'test-mod',
        pieces: samplePieces,
        joints: [],
      },
    });

    const html = renderToString(
      <AssemblySheetView
        assemblySheet={sheet}
        pieces={samplePieces}
        onExportPdf={vi.fn()}
      />
    );

    expect(html).toContain('Guía de Armado y Calibres de Taller');
    expect(html).toContain('Calibres de Montaje Derivados');
    expect(html).toContain('Esquema de Posicionamiento de Calibres');
    expect(html).toContain('Pasos de Armado Secuenciales');
    expect(html).toContain('Paneles y Estructura');
    expect(html).toContain('Tiras Calibre');
    expect(html).toContain('svg');
    expect(html).toContain('viewBox=');
    // Enhanced assembly guide assertions
    expect(html).toContain('Vista Explotada y Mapa de Piezas');
    expect(html).toContain('Vistas de Pre-mecanizado en Banco');
    expect(html).toContain('Diagonal de Escuadra:');
    expect(html).toContain('#1');
    expect(html).toContain('Datum (0,0)');
  });

  it('generates rich engineering model with mathematical squaring diagonal, exploded map and panel details', () => {
    const sheet: AssemblySheet = generateAssemblySheet({
      module: {
        moduleId: 'cab-01',
        pieces: samplePieces,
        joints: [],
      },
    });

    // Mathematical diagonal sqrt(W^2 + H^2)
    expect(sheet.squaringDiagonalMm).toBeGreaterThan(0);
    expect(sheet.explodedMap.length).toBe(samplePieces.length);
    expect(sheet.explodedMap[0]?.referenceNumber).toBe(1);
    expect(sheet.panelDetails.length).toBeGreaterThanOrEqual(1);

    const firstPanel = sheet.panelDetails[0]!;
    expect(firstPanel.datumNotes).toContain('Datum (0,0)');
    expect(firstPanel.operations.length).toBeGreaterThan(0);

    // Squaring step verification
    const squaringStep = sheet.steps.find((s) => s.phase === 'squaring');
    expect(squaringStep).toBeDefined();
    expect(squaringStep?.criticalDimensionMm?.valueMm).toBe(sheet.squaringDiagonalMm);
  });

  it('renders wall shelving installation view reactively when wallShelvingDefinition and output are provided', () => {
    const wallDef: WallShelvingDefinition = {
      id: 'shelving-test-1',
      widthMm: 1200,
      depthMm: 250,
      thicknessMm: 18,
      shelfCount: 3,
      verticalSpacingMm: 320,
      bracketType: 'l-bracket',
      wallType: 'solid-brick',
      loadCategory: 'heavy',
      boundaryCondition: 'free-ends',
      overhangMode: 'balanced-cantilever',
      materialId: 'mat-1',
      baseElevationYMm: 1200,
    };

    const wallOutput = buildWallShelving(wallDef);

    const html = renderToString(
      <AssemblySheetView
        assemblySheet={null}
        pieces={wallOutput.module.pieces as unknown as ResolvedPiece[]}
        wallShelvingDefinition={wallDef}
        wallShelvingOutput={wallOutput}
        onExportPdf={vi.fn()}
      />
    );

    expect(html).toContain('Plano de Replanteo y Perforaciones en Pared');
    expect(html).toContain('Línea Láser:');
    expect(html).toContain('Taco y Anclaje Sugerido');
    expect(html).toContain('Análisis de Flecha (Sagulator)');
    expect(html).toContain('Exportar Guía PDF');
    // Ensure anchor recommendation is present
    expect(html).toContain(wallOutput.bracketCalculation.recommendedAnchor.brandModel);
  });

  it('renders interactive exploded view toolbar, trajectory lines, and inspection card on piece selection', () => {
    const sheet: AssemblySheet = generateAssemblySheet({
      module: {
        moduleId: 'cab-exploded',
        pieces: samplePieces,
        joints: [],
      },
    });

    const html = renderToString(
      <AssemblySheetView
        assemblySheet={sheet}
        pieces={samplePieces}
        selectedPieceId="side-left"
        onSelectPiece={vi.fn()}
      />
    );

    // Exploded View Toolbar controls
    expect(html).toContain('💥 Despiece:');
    expect(html).toContain('Animar Ensamble');
    expect(html).toContain('Iso Der.');
    expect(html).toContain('Iso Izq.');
    expect(html).toContain('Cenital');
    expect(html).toContain('Líneas Guía');
    expect(html).toContain('Globos (#1, #2)');
    expect(html).toContain('Cantos Vistos');

    // Trajectory lines SVG group
    expect(html).toContain('assembly-trajectories');

    // Selected piece inspection card
    expect(html).toContain('Lateral Izquierdo');
    expect(html).toContain('Ver Plano con Cotas Datum (0,0)');
  });

  it('renders 3D interactive mode by default when spatial boxes are provided, with CAD angle presets and guided assembly navigation', () => {
    const sheet: AssemblySheet = generateAssemblySheet({
      module: {
        moduleId: 'cab-3d-guided',
        pieces: samplePieces,
        joints: [],
      },
    });

    const mockSpatialBoxes: SpatialPieceBox[] = samplePieces.map((p) => ({
      pieceId: p.id,
      role: p.role,
      materialId: p.materialId,
      thicknessMm: p.thicknessMm ?? 18,
      positionMm: { x: p.positionMm?.x ?? 0, y: p.positionMm?.y ?? 0, z: p.positionMm?.z ?? 0 },
      sizeMm: { x: p.dimensionsMm?.width ?? 500, y: p.dimensionsMm?.height ?? 500, z: p.thicknessMm ?? 18 },
      centerMm: { x: (p.positionMm?.x ?? 0) + 250, y: (p.positionMm?.y ?? 0) + 250, z: (p.positionMm?.z ?? 0) + 9 },
    }));

    const mockSpatialBounds: ModuleSpatialBounds = {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 600, y: 800, z: 560 },
      size: { x: 600, y: 800, z: 560 },
      center: { x: 300, y: 400, z: 280 },
    };

    const html = renderToString(
      <AssemblySheetView
        assemblySheet={sheet}
        pieces={samplePieces}
        spatialBoxes={mockSpatialBoxes}
        spatialBounds={mockSpatialBounds}
        onSelectPiece={vi.fn()}
      />
    );

    // Mode segmented buttons
    expect(html).toContain('3D Interactivo');
    expect(html).toContain('Axonométrica 2.5D');

    // CAD Camera Presets in 3D Mode
    expect(html).toContain('Iso');
    expect(html).toContain('Frente');
    expect(html).toContain('Lateral');
    expect(html).toContain('Planta');

    // Step-by-Step Guided Navigation
    expect(html).toContain('Armado Guiado:');
    expect(html).toContain('◀ Anterior');
    expect(html).toContain('Iniciar Paso 1 ▶');
    expect(html).toContain('Todo');

    // 3D Viewport rendered
    expect(html).toContain('viewport-3d-card');
  });
});
