import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Viewport3D } from '../src/ui/Viewport3D';
import type {
  SpatialPieceBox,
  ModuleSpatialBounds,
  ResolvedPieceWithCutSize,
  KinematicMechanism,
  KinematicPieceBox,
} from '../src/resolver';
import type { Material, EdgeBand } from '../src/model';

const mockBounds: ModuleSpatialBounds = {
  min: { x: 0, y: 0, z: 0 },
  max: { x: 600, y: 800, z: 560 },
  center: { x: 300, y: 400, z: 280 },
  size: { x: 600, y: 800, z: 560 },
};

const mockBoxes: SpatialPieceBox[] = [
  {
    pieceId: 'drawer-stack-1-drawer-1-front',
    role: 'drawer-front',
    materialId: 'mat-melamina',
    thicknessMm: 18,
    positionMm: { x: 20, y: 50, z: -18 },
    sizeMm: { x: 560, y: 200, z: 18 },
    centerMm: { x: 300, y: 150, z: -9 },
  },
];

const mockKinematicBoxes: KinematicPieceBox[] = [
  {
    ...mockBoxes[0]!,
    kinematicPositionMm: { x: 20, y: 50, z: -168 },
    kinematicRotationRad: { x: 0, y: 0, z: 0 },
    mechanismId: 'drawer-stack-1-drawer-1',
  },
];

const mockPieces: ResolvedPieceWithCutSize[] = [
  {
    id: 'drawer-stack-1-drawer-1-front',
    role: 'drawer-front',
    materialId: 'mat-melamina',
    thicknessMm: 18,
    contour: {
      points: [
        { x: 0, y: 0 },
        { x: 560, y: 0 },
        { x: 560, y: 200 },
        { x: 0, y: 200 },
      ],
    },
    faces: [
      { id: 'top-edge', visible: true, edgeBandId: 'eb-1' },
      { id: 'bottom-edge', visible: true, edgeBandId: 'eb-1' },
      { id: 'left-edge', visible: true, edgeBandId: 'eb-1' },
      { id: 'right-edge', visible: true, edgeBandId: 'eb-1' },
    ],
    structural: false,
    referenceFace: 'A',
    positionMm: { x: 20, y: 50, z: -18 },
    dimensionsMm: { width: 560, height: 200 },
    cutDimensionsMm: { width: 558, height: 198 },
    cutContour: {
      points: [
        { x: 0, y: 0 },
        { x: 558, y: 0 },
        { x: 558, y: 198 },
        { x: 0, y: 198 },
      ],
    },
    bandedEdges: [
      { faceId: 'top-edge', edgeBandId: 'eb-1', thicknessMm: 1, lengthMm: 560 },
      { faceId: 'bottom-edge', edgeBandId: 'eb-1', thicknessMm: 1, lengthMm: 560 },
      { faceId: 'left-edge', edgeBandId: 'eb-1', thicknessMm: 1, lengthMm: 200 },
      { faceId: 'right-edge', edgeBandId: 'eb-1', thicknessMm: 1, lengthMm: 200 },
    ],
  },
];

const mockMechanisms: KinematicMechanism[] = [
  {
    id: 'drawer-stack-1-drawer-1',
    name: 'Cajón 1',
    kind: 'drawer',
    pieceIds: ['drawer-stack-1-drawer-1-front'],
    travelMm: 300,
  },
];

const mockMaterials: Material[] = [
  {
    schemaVersion: 1,
    id: 'mat-melamina',
    name: 'Melamina 18mm',
    thicknessMm: 18,
    sheetSizeMm: { length: 2750, width: 1830 },
    hasGrain: false,
    milling: { hidden: 'yes', visible: 'yes', onStructuralPiece: 'yes' },
  },
  {
    schemaVersion: 1,
    id: 'mat-mdf',
    name: 'MDF 18mm',
    thicknessMm: 18,
    sheetSizeMm: { length: 2750, width: 1830 },
    hasGrain: false,
    milling: { hidden: 'yes', visible: 'yes', onStructuralPiece: 'yes' },
  },
];

const mockEdgeBands: EdgeBand[] = [
  { schemaVersion: 1, id: 'eb-1', kind: 'adhesive', thicknessMm: 1, pricePerMeter: 1 },
];

describe('Viewport3D Kinematics and Piece Inspector (Points 10 & 11)', () => {
  it('renders interactive kinematics bar with mechanisms dropdown and quick actions', () => {
    const html = renderToString(
      <Viewport3D
        boxes={mockBoxes}
        bounds={mockBounds}
        pieces={mockPieces}
        explodedRatio={0}
        onExplodedRatioChange={vi.fn()}
        selectedPieceId={null}
        onSelectPiece={vi.fn()}
        kinematicBoxes={mockKinematicBoxes}
        kinematicMechanisms={mockMechanisms}
        kinematicsState={{ 'drawer-stack-1-drawer-1': 0.5 }}
        onMechanismOpenRatioChange={vi.fn()}
      />,
    );

    expect(html).toContain('Cinemática / Apertura:');
    expect(html).toContain('Cajón 1');
    expect(html).toContain('Cerrar (0%)');
    expect(html).toContain('50%');
    expect(html).toContain('Abrir (100%)');
    expect(html).toContain('id="kinematics-slider"');
  });

  it('renders piece inspector with material, thickness, edgeband and machining controls when selected', () => {
    const html = renderToString(
      <Viewport3D
        boxes={mockBoxes}
        bounds={mockBounds}
        pieces={mockPieces}
        explodedRatio={0}
        onExplodedRatioChange={vi.fn()}
        selectedPieceId="drawer-stack-1-drawer-1-front"
        onSelectPiece={vi.fn()}
        kinematicBoxes={mockKinematicBoxes}
        kinematicMechanisms={mockMechanisms}
        kinematicsState={{ 'drawer-stack-1-drawer-1': 0.5 }}
        onMechanismOpenRatioChange={vi.fn()}
        materials={mockMaterials}
        edgeBands={mockEdgeBands}
        onSetPieceMaterial={vi.fn()}
        onSetPieceThickness={vi.fn()}
        onSetPieceEdgeBands={vi.fn()}
        onOpenMachiningModal={vi.fn()}
      />,
    );

    expect(html).toContain('Pieza seleccionada:');
    expect(html).toContain('drawer-stack-1-drawer-1-front');
    // Mechanism action in inspector (Point 11)
    expect(html).toContain('Mecanismo:');
    expect(html).toContain('Cajón 1');
    // Material override (Point 10)
    expect(html).toContain('Material de la Placa:');
    expect(html).toContain('Melamina 18mm');
    // Thickness override (Point 10)
    expect(html).toContain('Espesor de Placa (mm):');
    // Edgeband override (Point 10)
    expect(html).toContain('Tapacantos en Bordes:');
    expect(html).toContain('Superior');
    expect(html).toContain('Inferior');
    expect(html).toContain('Izquierdo');
    expect(html).toContain('Derecho');
    // Machining button (Point 8)
    expect(html).toContain('Mecanizar Placa (Ranuras / Fresados / Agujeros)');
  });
});
