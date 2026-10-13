import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ModuleForm } from '../src/ui/ModuleForm';
import { PieceListView } from '../src/ui/PieceListView';
import { MachiningSheetView } from '../src/ui/MachiningSheetView';
import { ProjectSettingsView } from '../src/ui/ProjectSettingsView';
import { App } from '../src/ui/App';
import type { Material, EdgeBand } from '../src/model';
import type { ResolvedPieceWithCutSize, PieceMachiningSheet, ShelfDeflectionResult } from '../src/resolver';
import { getDefaultProjectConfig } from '../src/storage';

const mockMaterials: Material[] = [
  {
    schemaVersion: 1,
    id: 'mat-1',
    name: 'Egger White 18mm',
    thicknessMm: 18,
    sheetSizeMm: { length: 2800, width: 2070 },
    hasGrain: false,
    milling: { hidden: 'yes', visible: 'no', onStructuralPiece: 'limited' },
  },
];

const mockEdgeBands: EdgeBand[] = [
  {
    schemaVersion: 1,
    id: 'eb-1',
    kind: 'adhesive',
    thicknessMm: 0.8,
    pricePerMeter: 'TO_CONFIRM',
  },
];

describe('ModuleForm Component', () => {
  it('renders input fields for width, height, depth and dropdowns for materials and edge bands', () => {
    const html = renderToString(
      <ModuleForm
        width={600}
        height={800}
        depth={560}
        materials={mockMaterials}
        edgeBands={mockEdgeBands}
        selectedMaterialId="mat-1"
        selectedEdgeBandId="eb-1"
        isSaving={false}
        onWidthChange={vi.fn()}
        onHeightChange={vi.fn()}
        onDepthChange={vi.fn()}
        onMaterialChange={vi.fn()}
        onEdgeBandChange={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(html).toContain('Width (mm):');
    expect(html).toContain('value="600"');
    expect(html).toContain('Height (mm):');
    expect(html).toContain('value="800"');
    expect(html).toContain('Depth (mm):');
    expect(html).toContain('value="560"');
    expect(html).toContain('Egger White 18mm');
    expect(html).toContain('Save Module to Database');
  });
});

describe('PieceListView Component', () => {
  it('renders piece rows with finished dimensions, cut dimensions, and thickness', () => {
    const samplePieces: ResolvedPieceWithCutSize[] = [
      {
        id: 'piece-side-left',
        role: 'side-left',
        materialId: 'mat-1',
        contour: {
          points: [
            { x: 0, y: 0 },
            { x: 558, y: 0 },
            { x: 558, y: 800 },
            { x: 0, y: 800 },
          ],
        },
        thicknessMm: 18,
        faces: [],
        structural: true,
        referenceFace: 'A',
        positionMm: { x: 0, y: 0, z: 0 },
        dimensionsMm: { width: 560, height: 800 },
        cutDimensionsMm: { width: 558, height: 800 },
        cutContour: {
          points: [
            { x: 0, y: 0 },
            { x: 558, y: 0 },
            { x: 558, y: 800 },
            { x: 0, y: 800 },
          ],
        },
        bandedEdges: [
          { faceId: 'right-edge', edgeBandId: 'eb-1', thicknessMm: 2, lengthMm: 800 },
        ],
      },
    ];

    const html = renderToString(<PieceListView pieces={samplePieces} />);

    expect(html).toContain('side-left');
    expect(html).toContain('560 x 800 mm');
    expect(html).toContain('558 x 800 mm');
    expect(html).toContain('18 mm');
    expect(html).toContain('right-edge (2mm)');
  });

  it('renders empty placeholder when pieces array is empty', () => {
    const html = renderToString(<PieceListView pieces={[]} />);
    expect(html).toContain('No pieces resolved. Adjust module parameters.');
  });

  it('renders shelf deflection badge when shelfDeflections is provided', () => {
    const contour = { points: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 300 }, { x: 0, y: 300 }] };
    const shelfPiece: ResolvedPieceWithCutSize = {
      id: 'shelf-1',
      role: 'shelf',
      materialId: 'mat-1',
      thicknessMm: 18,
      positionMm: { x: 0, y: 0, z: 0 },
      dimensionsMm: { width: 600, height: 300 },
      cutDimensionsMm: { width: 600, height: 300 },
      structural: false,
      referenceFace: 'A',
      faces: [],
      contour,
      cutContour: contour,
      bandedEdges: [],
    };

    const deflMap = new Map<string, ShelfDeflectionResult>();
    deflMap.set('shelf-1', {
      spanMm: 600,
      depthMm: 300,
      thicknessMm: 18,
      elasticModulusMPa: 3000,
      isElasticModulusConfirmed: true,
      totalLoadKg: 5.4,
      totalLoadN: 52.95,
      inertiaMm4: 145800,
      calculatedDeflectionMm: 0.34,
      allowableDeflectionMm: 3.0,
      deflectionRatio: 1764,
      exceedsRatio: false,
      exceedsAbsolute: false,
      hasWarning: false,
    });

    const html = renderToString(
      <PieceListView pieces={[shelfPiece]} shelfDeflections={deflMap} />,
    );

    expect(html).toContain('0.34 mm (ok)');
    expect(html).not.toContain('Aviso de flexión en estante');
  });

  it('renders deflection warning banner when a shelf exceeds allowable limit', () => {
    const contour = { points: [{ x: 0, y: 0 }, { x: 1200, y: 0 }, { x: 1200, y: 400 }, { x: 0, y: 400 }] };
    const shelfPiece: ResolvedPieceWithCutSize = {
      id: 'shelf-oversized',
      role: 'shelf',
      materialId: 'mat-1',
      thicknessMm: 15,
      positionMm: { x: 0, y: 0, z: 0 },
      dimensionsMm: { width: 1200, height: 400 },
      cutDimensionsMm: { width: 1200, height: 400 },
      structural: false,
      referenceFace: 'A',
      faces: [],
      contour,
      cutContour: contour,
      bandedEdges: [],
    };

    const deflMap = new Map<string, ShelfDeflectionResult>();
    deflMap.set('shelf-oversized', {
      spanMm: 1200,
      depthMm: 400,
      thicknessMm: 15,
      elasticModulusMPa: 2500,
      isElasticModulusConfirmed: false,
      totalLoadKg: 24,
      totalLoadN: 235.4,
      inertiaMm4: 112500,
      calculatedDeflectionMm: 5.24,
      allowableDeflectionMm: 3.0,
      deflectionRatio: 229,
      exceedsRatio: false,
      exceedsAbsolute: true,
      hasWarning: true,
      warningMessage: 'Deflection exceeds limit',
    });

    const html = renderToString(
      <PieceListView pieces={[shelfPiece]} shelfDeflections={deflMap} />,
    );

    expect(html).toContain('Aviso de flexión en estante');
    expect(html).toContain('5.24 mm (máx 3.00 mm)');
  });
});

describe('MachiningSheetView Component', () => {
  const sampleSheets: PieceMachiningSheet[] = [
    {
      pieceId: 'base-side-left',
      role: 'side-left',
      materialId: 'mat-1',
      dimensionsMm: { width: 560, height: 800, thickness: 18 },
      cutDimensionsMm: { width: 558, height: 800 },
      bandedEdges: { top: false, bottom: false, left: false, right: true },
      faceAOperations: [
        {
          id: 'op-1',
          faceType: 'face-A',
          faceId: 'inner',
          diameterMm: 7.0,
          depthMm: 18.0,
          isThrough: true,
          xMm: 50,
          yMm: 9,
          distFromLeftMm: 50,
          distFromBottomMm: 9,
          distFromRightMm: 510,
          distFromTopMm: 791,
          description: 'Confirmat hole',
          sourceJointKind: 'confirmat',
        },
      ],
      faceBOperations: [
        {
          id: 'op-b1',
          faceType: 'face-B',
          faceId: 'outer',
          diameterMm: 5.0,
          depthMm: 12.0,
          isThrough: false,
          xMm: 37,
          yMm: 400,
          distFromLeftMm: 37,
          distFromBottomMm: 400,
          distFromRightMm: 523,
          distFromTopMm: 400,
          description: 'Outer shelf pin',
          sourceJointKind: 'shelf-pin',
        },
      ],
      edgeOperations: [],
      totalOperations: 2,
      requiresTurn: true,
      turnInstructions: 'GIRAR LA PIEZA: Contiene operaciones en Cara B.',
    },
  ];

  it('renders piece chips, info bar, turn warning banner, and operations table', () => {
    const html = renderToString(
      <MachiningSheetView
        sheets={sampleSheets}
        selectedPieceId="base-side-left"
        onSelectPiece={vi.fn()}
        onExportPdf={vi.fn()}
      />,
    );

    expect(html).toContain('Planos de Mecanizado');
    expect(html).toContain('base-side-left');
    expect(html).toContain('560 x 800 x 18 mm');
    expect(html).toContain('ATENCIÓN: GIRAR LA PIEZA');
    expect(html).toContain('Cara A (Frente)');
    expect(html).toContain('Cara B (Reverso)');
    expect(html).toContain('Confirmat hole');
  });

  it('renders empty notice when sheets array is empty', () => {
    const html = renderToString(
      <MachiningSheetView
        sheets={[]}
        selectedPieceId={null}
        onSelectPiece={vi.fn()}
        onExportPdf={vi.fn()}
      />,
    );

    expect(html).toContain('No hay piezas disponibles en el módulo actual');
  });
});

describe('ProjectSettingsView Component', () => {
  it('renders project settings menu, sections, and input fields', () => {
    const config = getDefaultProjectConfig();
    const html = renderToString(
      <ProjectSettingsView
        config={config}
        isSaving={false}
        onUpdateConfig={vi.fn()}
        onSaveConfig={vi.fn()}
        onExportConfig={vi.fn()}
        onImportConfigFile={vi.fn()}
        onResetConfig={vi.fn()}
      />,
    );

    expect(html).toContain('Menú de Configuración del Proyecto');
    expect(html).toContain('Mecanizado &amp; Taller');
    expect(html).toContain('Tornillo Confirmat');
    expect(html).toContain('Guardar en DB');
    expect(html).toContain('Exportar JSON');
  });

  it('renders loading notice when config is null', () => {
    const html = renderToString(
      <ProjectSettingsView
        config={null}
        isSaving={false}
        onUpdateConfig={vi.fn()}
        onSaveConfig={vi.fn()}
        onExportConfig={vi.fn()}
        onImportConfigFile={vi.fn()}
        onResetConfig={vi.fn()}
      />,
    );

    expect(html).toContain('Cargando configuración de base de datos...');
  });
});

describe('App MVVM Integration', () => {
  it('renders application header, tabs (including Mecanizado and Configuración), and main container', () => {
    const html = renderToString(<App />);
    expect(html).toContain('Mobilius');
    expect(html).toContain('Furniture design progressive web application.');
    expect(html).toContain('Mecanizado');
    expect(html).toContain('Configuración');
  });
});
