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
});
