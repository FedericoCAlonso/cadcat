import { describe, it, expect } from 'vitest';
import {
  exportPieceToDxf,
  exportMachiningSheetToDxf,
  exportModuleToDxf,
  buildDxfString,
  getDrillLayerName,
  DXF_STANDARD_LAYERS,
  AUTOCAD_R12_VERSION,
} from '../src/resolver/dxf';
import type { ResolvedPieceWithCutSize } from '../src/resolver/edgeBand';
import type { PieceMachiningSheet } from '../src/resolver/machiningSheet';
import type {
  CustomDrillOperation,
  CustomHoleSeriesOperation,
  CustomGrooveOperation,
  CustomRebateOperation,
  CustomPocketOperation,
  CustomEdgeProfileOperation,
} from '../src/model';

const mockPiece: ResolvedPieceWithCutSize = {
  id: 'base-side-l',
  role: 'side-left',
  materialId: 'mat-melamina',
  thicknessMm: 18,
  contour: { points: [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 500, y: 700 }, { x: 0, y: 700 }] },
  faces: [],
  structural: true,
  referenceFace: 'A',
  positionMm: { x: 0, y: 0, z: 0 },
  dimensionsMm: { width: 500, height: 700 },
  cutDimensionsMm: { width: 498, height: 698 },
  cutContour: { points: [{ x: 0, y: 0 }, { x: 498, y: 0 }, { x: 498, y: 698 }, { x: 0, y: 698 }] },
  bandedEdges: [],
};

describe('DXF Generation Engine (AutoCAD R12 Layered DXF)', () => {
  it('resolves canonical and custom drill layer names correctly', () => {
    expect(getDrillLayerName(5)).toBe('1_DRILL_5MM');
    expect(getDrillLayerName(5.05)).toBe('1_DRILL_5MM');
    expect(getDrillLayerName(8)).toBe('1_DRILL_8MM');
    expect(getDrillLayerName(15)).toBe('1_DRILL_15MM');
    expect(getDrillLayerName(35)).toBe('1_DRILL_35MM');
    expect(getDrillLayerName(10)).toBe('1_DRILL_10MM');
    expect(getDrillLayerName(3.2)).toBe('1_DRILL_3.2MM');
  });

  it('generates a valid AutoCAD R12 DXF header and tables structure', () => {
    const dxf = buildDxfString(
      [{ name: '0_CONTOUR', color: 7 }],
      [],
    );

    expect(dxf).toContain('HEADER');
    expect(dxf).toContain('$ACADVER');
    expect(dxf).toContain(AUTOCAD_R12_VERSION);
    expect(dxf).toContain('$MEASUREMENT');
    expect(dxf).toContain('$INSUNITS');
    expect(dxf).toContain('TABLES');
    expect(dxf).toContain('LAYER');
    expect(dxf).toContain('0_CONTOUR');
    expect(dxf).toContain('ENTITIES');
    expect(dxf).toContain('EOF');
  });

  it('exports piece perimeter polyline on layer 0_CONTOUR', () => {
    const dxf = exportPieceToDxf(mockPiece);

    expect(dxf).toContain('POLYLINE');
    expect(dxf).toContain('0_CONTOUR');
    expect(dxf).toContain('500.0');
    expect(dxf).toContain('700.0');
    expect(dxf).toContain('0_LABEL');
    expect(dxf).toContain('base-side-l | 500x700x18mm | FACE-A | side-left');
  });

  it('supports cut dimensions when useCutDimensions is enabled', () => {
    const dxf = exportPieceToDxf(mockPiece, { useCutDimensions: true });

    expect(dxf).toContain('498.0');
    expect(dxf).toContain('698.0');
  });

  it('places drill operations on appropriate 1_DRILL layers with exact radii', () => {
    const drills: CustomDrillOperation[] = [
      {
        kind: 'drill',
        id: 'drill-confirmat',
        pieceId: 'base-side-l',
        faceType: 'face-A',
        xMm: 50,
        yMm: 100,
        diameterMm: 5,
        depthMm: 18,
        isThrough: true,
      },
      {
        kind: 'drill',
        id: 'drill-dowel',
        pieceId: 'base-side-l',
        faceType: 'face-A',
        xMm: 150,
        yMm: 200,
        diameterMm: 8,
        depthMm: 12,
        isThrough: false,
      },
      {
        kind: 'drill',
        id: 'drill-minifix',
        pieceId: 'base-side-l',
        faceType: 'face-A',
        xMm: 250,
        yMm: 300,
        diameterMm: 15,
        depthMm: 14,
        isThrough: false,
      },
      {
        kind: 'drill',
        id: 'drill-hinge',
        pieceId: 'base-side-l',
        faceType: 'face-A',
        xMm: 350,
        yMm: 400,
        diameterMm: 35,
        depthMm: 12,
        isThrough: false,
      },
    ];

    const dxf = exportPieceToDxf(mockPiece, { customOperations: drills });

    expect(dxf).toContain(DXF_STANDARD_LAYERS.DRILL_5MM);
    expect(dxf).toContain(DXF_STANDARD_LAYERS.DRILL_8MM);
    expect(dxf).toContain(DXF_STANDARD_LAYERS.DRILL_15MM);
    expect(dxf).toContain(DXF_STANDARD_LAYERS.DRILL_35MM);

    // Verify 5mm drill radius (2.5mm)
    expect(dxf).toContain('2.5');
    // Verify 8mm drill radius (4mm)
    expect(dxf).toContain('4.0');
    // Verify 15mm drill radius (7.5mm)
    expect(dxf).toContain('7.5');
    // Verify 35mm drill radius (17.5mm)
    expect(dxf).toContain('17.5');
  });

  it('expands System 32 hole series into individual circle entities on 1_DRILL_5MM', () => {
    const series: CustomHoleSeriesOperation = {
      kind: 'hole-series',
      id: 'series-sys32',
      pieceId: 'base-side-l',
      faceType: 'face-A',
      startXMm: 37,
      startYMm: 100,
      axis: 'y',
      pitchMm: 32,
      count: 5,
      diameterMm: 5,
      depthMm: 12,
      isThrough: false,
    };

    const dxf = exportPieceToDxf(mockPiece, { customOperations: [series] });

    expect(dxf).toContain(DXF_STANDARD_LAYERS.DRILL_5MM);
    // Y positions: 100, 132, 164, 196, 228
    expect(dxf).toContain('100.0');
    expect(dxf).toContain('132.0');
    expect(dxf).toContain('164.0');
    expect(dxf).toContain('196.0');
    expect(dxf).toContain('228.0');
  });

  it('exports grooves and rebates on layer 2_GROOVE with optional centerline', () => {
    const groove: CustomGrooveOperation = {
      kind: 'groove',
      id: 'groove-back',
      pieceId: 'base-side-l',
      faceType: 'face-A',
      axis: 'x',
      offsetMm: 20,
      widthMm: 4,
      depthMm: 8,
      startMm: 0,
      lengthMm: 500,
    };

    const rebate: CustomRebateOperation = {
      kind: 'rebate',
      id: 'rebate-top',
      pieceId: 'base-side-l',
      faceType: 'face-A',
      edge: 'top',
      widthMm: 18,
      depthMm: 10,
    };

    const dxf = exportPieceToDxf(mockPiece, {
      customOperations: [groove, rebate],
      includeGrooveCenterline: true,
    });

    expect(dxf).toContain(DXF_STANDARD_LAYERS.GROOVE);
    // Groove centerline Y = 20 + 4/2 = 22
    expect(dxf).toContain('22.0');
    // Rebate top Y1 = 700 - 18 = 682
    expect(dxf).toContain('682.0');
  });

  it('exports cutouts on 3_POCKET with dog-bone relief circles', () => {
    const cutout: CustomPocketOperation = {
      kind: 'cutout',
      id: 'cutout-box',
      pieceId: 'base-side-l',
      faceType: 'face-A',
      xMm: 100,
      yMm: 150,
      widthMm: 200,
      heightMm: 100,
      depthMm: 18,
      isThrough: true,
      cornerRadiusMm: 3,
      cornerTreatment: 'dog-bone',
    };

    const dxf = exportPieceToDxf(mockPiece, { customOperations: [cutout] });

    expect(dxf).toContain(DXF_STANDARD_LAYERS.POCKET);
    // Pocket perimeter
    expect(dxf).toContain('100.0');
    expect(dxf).toContain('150.0');
    expect(dxf).toContain('300.0');
    expect(dxf).toContain('250.0');
    // Relief drill circles with radius 3.0
    expect(dxf).toContain('CIRCLE');
    expect(dxf).toContain('3.0');
  });

  it('exports cutouts on 3_POCKET with natural-radius fillets using polyline bulges', () => {
    const cutout: CustomPocketOperation = {
      kind: 'cutout',
      id: 'cutout-fillet',
      pieceId: 'base-side-l',
      faceType: 'face-A',
      xMm: 100,
      yMm: 150,
      widthMm: 200,
      heightMm: 100,
      depthMm: 18,
      isThrough: true,
      cornerRadiusMm: 6,
      cornerTreatment: 'natural-radius',
    };

    const dxf = exportPieceToDxf(mockPiece, { customOperations: [cutout] });

    expect(dxf).toContain(DXF_STANDARD_LAYERS.POCKET);
    // Group code 42 for bulge: tan(pi / 8) ~ 0.414
    expect(dxf).toContain('42');
    expect(dxf).toContain('0.414');
  });

  it('exports edge profiles on layer 4_PROFILE', () => {
    const profile: CustomEdgeProfileOperation = {
      kind: 'edge-profile',
      id: 'profile-front',
      pieceId: 'base-side-l',
      faceType: 'face-A',
      edge: 'left',
      profileKind: 'roundover',
      depthMm: 3,
      widthMm: 3,
    };

    const dxf = exportPieceToDxf(mockPiece, { customOperations: [profile] });

    expect(dxf).toContain(DXF_STANDARD_LAYERS.PROFILE);
    expect(dxf).toContain('LINE');
  });

  it('mirrors X coordinates horizontally when exporting Face B', () => {
    const drill: CustomDrillOperation = {
      kind: 'drill',
      id: 'drill-through',
      pieceId: 'base-side-l',
      faceType: 'face-A',
      xMm: 50,
      yMm: 100,
      diameterMm: 5,
      depthMm: 18,
      isThrough: true,
    };

    // On Face A: X=50
    const dxfA = exportPieceToDxf(mockPiece, { face: 'face-A', customOperations: [drill] });
    expect(dxfA).toContain('50.0');

    // On Face B: X = 500 - 50 = 450
    const dxfB = exportPieceToDxf(mockPiece, { face: 'face-B', customOperations: [drill] });
    expect(dxfB).toContain('450.0');
    expect(dxfB).toContain('FACE-B');
  });

  it('exports directly from a PieceMachiningSheet', () => {
    const sheet: PieceMachiningSheet = {
      pieceId: 'shelf-1',
      role: 'shelf',
      materialId: 'mat-melamina',
      dimensionsMm: { width: 564, height: 480, thickness: 18 },
      cutDimensionsMm: { width: 564, height: 480 },
      bandedEdges: { top: false, bottom: true, left: false, right: false },
      faceAOperations: [
        {
          id: 'op-1',
          faceType: 'face-A',
          faceId: 'face-top',
          diameterMm: 5,
          depthMm: 12,
          isThrough: false,
          xMm: 37,
          yMm: 240,
          distFromLeftMm: 37,
          distFromBottomMm: 240,
          distFromRightMm: 527,
          distFromTopMm: 240,
          description: 'Perno estante',
        },
      ],
      faceBOperations: [],
      edgeOperations: [],
      totalOperations: 1,
      requiresTurn: false,
      turnInstructions: 'No requiere giro',
    };

    const dxf = exportMachiningSheetToDxf(sheet, { face: 'face-A' });

    expect(dxf).toContain(DXF_STANDARD_LAYERS.CONTOUR);
    expect(dxf).toContain(DXF_STANDARD_LAYERS.DRILL_5MM);
    expect(dxf).toContain('564.0');
    expect(dxf).toContain('480.0');
    expect(dxf).toContain('37.0');
    expect(dxf).toContain('shelf-1 | 564x480x18mm | FACE-A | shelf');
  });

  it('exports multiple pieces via exportModuleToDxf', () => {
    const piece2: ResolvedPieceWithCutSize = {
      ...mockPiece,
      id: 'base-side-r',
      role: 'side-right',
    };

    const results = exportModuleToDxf([mockPiece, piece2]);

    expect(results).toHaveLength(2);
    expect(results[0]?.fileName).toBe('base-side-l-face-A.dxf');
    expect(results[1]?.fileName).toBe('base-side-r-face-A.dxf');
    expect(results[0]?.dxfContent).toContain('base-side-l');
    expect(results[1]?.dxfContent).toContain('base-side-r');
  });
});
