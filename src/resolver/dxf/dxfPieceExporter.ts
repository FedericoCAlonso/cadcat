/**
 * AutoCAD R12 Layered DXF Exporter for Wood Panels & CNC Machining.
 * Implements SOLID principles: Pure geometry calculations with zero DOM/framework dependencies.
 */

import type {
  CustomDrillOperation,
  CustomGrooveOperation,
  CustomRebateOperation,
  CustomPocketOperation,
  CustomEdgeProfileOperation,
  DrillOperation,
} from '../../model';
import { customHoleSeriesToDrillOperations } from '../../model';
import type { ResolvedPieceWithCutSize } from '../edgeBand';
import type { PieceMachiningSheet, SheetOperationItem } from '../machiningSheet';
import { calculatePocketCornerRelief } from '../machining/rules/cornerRelief';
import {
  DXF_STANDARD_LAYERS,
  DXF_LAYER_COLORS,
  DXF_DEFAULT_CUSTOM_DRILL_COLOR,
  getDrillLayerName,
} from './dxfConstants';
import type {
  DxfEntity,
  DxfLayerDefinition,
  DxfExportOptions,
  DxfPieceExportResult,
  DxfVertex,
} from './dxfTypes';
import { buildDxfString } from './dxfWriter';

/** Bulge factor for 90-degree circular corner arc: tan(pi / 8) */
const QUARTER_CIRCLE_BULGE = Math.tan(Math.PI / 8);

/**
 * Exports a single cabinet piece to a standard AutoCAD R12 DXF string.
 */
export function exportPieceToDxf(
  piece: ResolvedPieceWithCutSize,
  options: DxfExportOptions = {},
): string {
  const targetFace = options.face ?? 'face-A';
  const widthMm = options.useCutDimensions
    ? piece.cutDimensionsMm.width
    : piece.dimensionsMm.width;
  const heightMm = options.useCutDimensions
    ? piece.cutDimensionsMm.height
    : piece.dimensionsMm.height;

  const entities: DxfEntity[] = [];

  // 1. Layer 0_CONTOUR: Piece Perimeter
  addContourEntities(entities, piece, widthMm, heightMm, options.useCutDimensions);

  // 2. Drill Operations (Derived + Custom)
  const allDrills: Array<CustomDrillOperation | DrillOperation> = [];

  if (options.derivedOperations) {
    allDrills.push(...options.derivedOperations);
  }

  if (options.customOperations) {
    for (const op of options.customOperations) {
      if (op.kind === 'drill') {
        allDrills.push(op);
      } else if (op.kind === 'hole-series') {
        allDrills.push(...customHoleSeriesToDrillOperations(op));
      }
    }
  }

  addDrillEntities(entities, allDrills, widthMm, targetFace);

  // 3. Grooves, Rebates, Cutouts, Profiles
  if (options.customOperations) {
    for (const op of options.customOperations) {
      if (op.kind === 'groove') {
        addGrooveEntities(entities, op, widthMm, heightMm, targetFace, options.includeGrooveCenterline);
      } else if (op.kind === 'rebate') {
        addRebateEntities(entities, op, widthMm, heightMm, targetFace);
      } else if (op.kind === 'cutout') {
        addCutoutEntities(entities, op, widthMm, targetFace);
      } else if (op.kind === 'edge-profile') {
        addEdgeProfileEntities(entities, op, widthMm, heightMm, targetFace);
      }
    }
  }

  // 4. Piece Text Label outside contour (Layer 0_LABEL)
  if (options.includeLabels !== false) {
    addLabelEntity(entities, piece, widthMm, heightMm, targetFace);
  }

  // Build layers list based on entities used
  const layers = buildActiveLayers(entities);

  return buildDxfString(layers, entities, options.coordinatePrecision);
}

/**
 * Exports a piece directly from a pre-calculated PieceMachiningSheet.
 */
export function exportMachiningSheetToDxf(
  sheet: PieceMachiningSheet,
  options: DxfExportOptions = {},
): string {
  const targetFace = options.face ?? 'face-A';
  const widthMm = options.useCutDimensions
    ? sheet.cutDimensionsMm.width
    : sheet.dimensionsMm.width;
  const heightMm = options.useCutDimensions
    ? sheet.cutDimensionsMm.height
    : sheet.dimensionsMm.height;

  const entities: DxfEntity[] = [];

  // 1. Layer 0_CONTOUR
  entities.push({
    type: 'POLYLINE',
    layer: DXF_STANDARD_LAYERS.CONTOUR,
    isClosed: true,
    vertices: [
      { x: 0, y: 0 },
      { x: widthMm, y: 0 },
      { x: widthMm, y: heightMm },
      { x: 0, y: heightMm },
    ],
  });

  // 2. Drills from sheet operation items
  const opItems: SheetOperationItem[] =
    targetFace === 'face-A' ? sheet.faceAOperations : sheet.faceBOperations;

  for (const item of opItems) {
    const layer = getDrillLayerName(item.diameterMm);
    entities.push({
      type: 'CIRCLE',
      layer,
      center: { x: item.xMm, y: item.yMm },
      radius: item.diameterMm / 2,
    });
  }

  // 3. Custom non-drill operations
  if (sheet.customOperations) {
    for (const op of sheet.customOperations) {
      if (op.kind === 'groove') {
        addGrooveEntities(entities, op, widthMm, heightMm, targetFace, options.includeGrooveCenterline);
      } else if (op.kind === 'rebate') {
        addRebateEntities(entities, op, widthMm, heightMm, targetFace);
      } else if (op.kind === 'cutout') {
        addCutoutEntities(entities, op, widthMm, targetFace);
      } else if (op.kind === 'edge-profile') {
        addEdgeProfileEntities(entities, op, widthMm, heightMm, targetFace);
      }
    }
  }

  // 4. Label
  if (options.includeLabels !== false) {
    entities.push({
      type: 'TEXT',
      layer: DXF_STANDARD_LAYERS.LABEL,
      position: { x: 10, y: -25 },
      height: 12,
      text: `${sheet.pieceId} | ${Math.round(widthMm)}x${Math.round(heightMm)}x${sheet.dimensionsMm.thickness}mm | ${targetFace.toUpperCase()} | ${sheet.role}`,
    });
  }

  const layers = buildActiveLayers(entities);
  return buildDxfString(layers, entities, options.coordinatePrecision);
}

/**
 * Exports all pieces in a module into individual DXF files.
 */
export function exportModuleToDxf(
  pieces: ResolvedPieceWithCutSize[],
  options: DxfExportOptions = {},
): DxfPieceExportResult[] {
  const results: DxfPieceExportResult[] = [];
  const targetFace = options.face ?? 'face-A';

  for (const piece of pieces) {
    const dxfContent = exportPieceToDxf(piece, options);
    const fileName = `${piece.id}-${targetFace}.dxf`;
    results.push({
      pieceId: piece.id,
      fileName,
      dxfContent,
      face: targetFace,
    });
  }

  return results;
}

// -------------------------------------------------------------
// Internal Geometry Generators
// -------------------------------------------------------------

function addContourEntities(
  entities: DxfEntity[],
  piece: ResolvedPieceWithCutSize,
  widthMm: number,
  heightMm: number,
  useCutDimensions?: boolean,
): void {
  const rawPoints = useCutDimensions
    ? piece.cutContour?.points
    : piece.contour?.points;

  const points = rawPoints && rawPoints.length >= 3
    ? rawPoints
    : [
        { x: 0, y: 0 },
        { x: widthMm, y: 0 },
        { x: widthMm, y: heightMm },
        { x: 0, y: heightMm },
      ];

  entities.push({
    type: 'POLYLINE',
    layer: DXF_STANDARD_LAYERS.CONTOUR,
    isClosed: true,
    vertices: points.map((p) => ({ x: p.x, y: p.y })),
  });
}

function addDrillEntities(
  entities: DxfEntity[],
  drills: Array<CustomDrillOperation | DrillOperation>,
  widthMm: number,
  targetFace: 'face-A' | 'face-B',
): void {
  for (const drill of drills) {
    const isTargetFace = drill.faceType === targetFace;
    const isVisibleThrough = drill.isThrough;

    if (!isTargetFace && !isVisibleThrough) {
      continue;
    }

    const rawX = 'positionMm' in drill ? drill.positionMm.x : drill.xMm;
    const rawY = 'positionMm' in drill ? drill.positionMm.y : drill.yMm;

    // Mirror X if viewing Face B
    const effX = targetFace === 'face-B'
      ? (drill.faceType === 'face-B' ? rawX : widthMm - rawX)
      : rawX;
    const effY = rawY;

    const layer = getDrillLayerName(drill.diameterMm);
    entities.push({
      type: 'CIRCLE',
      layer,
      center: { x: effX, y: effY },
      radius: drill.diameterMm / 2,
    });
  }
}

function addGrooveEntities(
  entities: DxfEntity[],
  op: CustomGrooveOperation,
  widthMm: number,
  heightMm: number,
  targetFace: 'face-A' | 'face-B',
  includeCenterline?: boolean,
): void {
  if (op.faceType !== targetFace) return;

  const isHoriz = op.axis === 'x';

  if (isHoriz) {
    const x1 = op.startMm ?? 0;
    const x2 = op.lengthMm !== undefined ? x1 + op.lengthMm : widthMm;
    const y1 = op.offsetMm;
    const y2 = op.offsetMm + op.widthMm;

    entities.push({
      type: 'POLYLINE',
      layer: DXF_STANDARD_LAYERS.GROOVE,
      isClosed: true,
      vertices: [
        { x: x1, y: y1 },
        { x: x2, y: y1 },
        { x: x2, y: y2 },
        { x: x1, y: y2 },
      ],
    });

    if (includeCenterline) {
      const centerY = op.offsetMm + op.widthMm / 2;
      entities.push({
        type: 'LINE',
        layer: DXF_STANDARD_LAYERS.GROOVE,
        start: { x: x1, y: centerY },
        end: { x: x2, y: centerY },
      });
    }
  } else {
    const y1 = op.startMm ?? 0;
    const y2 = op.lengthMm !== undefined ? y1 + op.lengthMm : heightMm;
    const rawX = op.offsetMm;
    const effX = targetFace === 'face-B' ? widthMm - rawX - op.widthMm : rawX;
    const x1 = effX;
    const x2 = effX + op.widthMm;

    entities.push({
      type: 'POLYLINE',
      layer: DXF_STANDARD_LAYERS.GROOVE,
      isClosed: true,
      vertices: [
        { x: x1, y: y1 },
        { x: x2, y: y1 },
        { x: x2, y: y2 },
        { x: x1, y: y2 },
      ],
    });

    if (includeCenterline) {
      const centerX = effX + op.widthMm / 2;
      entities.push({
        type: 'LINE',
        layer: DXF_STANDARD_LAYERS.GROOVE,
        start: { x: centerX, y: y1 },
        end: { x: centerX, y: y2 },
      });
    }
  }
}

function addRebateEntities(
  entities: DxfEntity[],
  op: CustomRebateOperation,
  widthMm: number,
  heightMm: number,
  targetFace: 'face-A' | 'face-B',
): void {
  if (op.faceType !== targetFace) return;

  let x1 = 0;
  let y1 = 0;
  let x2 = widthMm;
  let y2 = heightMm;

  switch (op.edge) {
    case 'bottom':
      y2 = op.widthMm;
      break;
    case 'top':
      y1 = heightMm - op.widthMm;
      break;
    case 'left':
      if (targetFace === 'face-B') {
        x1 = widthMm - op.widthMm;
      } else {
        x2 = op.widthMm;
      }
      break;
    case 'right':
      if (targetFace === 'face-B') {
        x2 = op.widthMm;
      } else {
        x1 = widthMm - op.widthMm;
      }
      break;
  }

  entities.push({
    type: 'POLYLINE',
    layer: DXF_STANDARD_LAYERS.GROOVE,
    isClosed: true,
    vertices: [
      { x: x1, y: y1 },
      { x: x2, y: y1 },
      { x: x2, y: y2 },
      { x: x1, y: y2 },
    ],
  });
}

function addCutoutEntities(
  entities: DxfEntity[],
  op: CustomPocketOperation,
  widthMm: number,
  targetFace: 'face-A' | 'face-B',
): void {
  const isTarget = op.faceType === targetFace || op.faceType === undefined;
  if (!isTarget) return;

  const effX = targetFace === 'face-B' ? widthMm - op.xMm - op.widthMm : op.xMm;
  const effY = op.yMm;
  const toolRad = op.cornerRadiusMm ?? 3;

  if (op.cornerTreatment === 'dog-bone' || op.cornerTreatment === 't-bone') {
    // 1. Outer pocket boundary
    entities.push({
      type: 'POLYLINE',
      layer: DXF_STANDARD_LAYERS.POCKET,
      isClosed: true,
      vertices: [
        { x: effX, y: effY },
        { x: effX + op.widthMm, y: effY },
        { x: effX + op.widthMm, y: effY + op.heightMm },
        { x: effX, y: effY + op.heightMm },
      ],
    });

    // 2. Corner relief drill holes
    const relief = calculatePocketCornerRelief({
      xMm: effX,
      yMm: effY,
      widthMm: op.widthMm,
      heightMm: op.heightMm,
      cornerRadiusMm: toolRad,
      cornerTreatment: op.cornerTreatment,
    });

    for (const corner of relief.corners) {
      entities.push({
        type: 'CIRCLE',
        layer: DXF_STANDARD_LAYERS.POCKET,
        center: { x: corner.reliefCenterMm.x, y: corner.reliefCenterMm.y },
        radius: corner.reliefRadiusMm,
      });
    }
  } else if (op.cornerTreatment === 'natural-radius') {
    // Polyline with quarter-circle bulges
    const r = Math.min(toolRad, op.widthMm / 2, op.heightMm / 2);
    const vertices: DxfVertex[] = [
      { x: effX + r, y: effY },
      { x: effX + op.widthMm - r, y: effY, bulge: QUARTER_CIRCLE_BULGE },
      { x: effX + op.widthMm, y: effY + r },
      { x: effX + op.widthMm, y: effY + op.heightMm - r, bulge: QUARTER_CIRCLE_BULGE },
      { x: effX + op.widthMm - r, y: effY + op.heightMm },
      { x: effX + r, y: effY + op.heightMm, bulge: QUARTER_CIRCLE_BULGE },
      { x: effX, y: effY + op.heightMm - r },
      { x: effX, y: effY + r, bulge: QUARTER_CIRCLE_BULGE },
    ];

    entities.push({
      type: 'POLYLINE',
      layer: DXF_STANDARD_LAYERS.POCKET,
      isClosed: true,
      vertices,
    });
  } else {
    // Sharp rectangle
    entities.push({
      type: 'POLYLINE',
      layer: DXF_STANDARD_LAYERS.POCKET,
      isClosed: true,
      vertices: [
        { x: effX, y: effY },
        { x: effX + op.widthMm, y: effY },
        { x: effX + op.widthMm, y: effY + op.heightMm },
        { x: effX, y: effY + op.heightMm },
      ],
    });
  }
}

function addEdgeProfileEntities(
  entities: DxfEntity[],
  op: CustomEdgeProfileOperation,
  widthMm: number,
  heightMm: number,
  targetFace: 'face-A' | 'face-B',
): void {
  let startX = 0;
  let startY = 0;
  let endX = widthMm;
  let endY = heightMm;

  switch (op.edge) {
    case 'top':
      startX = 0;
      startY = heightMm;
      endX = widthMm;
      endY = heightMm;
      break;
    case 'bottom':
      startX = 0;
      startY = 0;
      endX = widthMm;
      endY = 0;
      break;
    case 'left':
      startX = targetFace === 'face-B' ? widthMm : 0;
      startY = 0;
      endX = startX;
      endY = heightMm;
      break;
    case 'right':
      startX = targetFace === 'face-B' ? 0 : widthMm;
      startY = 0;
      endX = startX;
      endY = heightMm;
      break;
  }

  entities.push({
    type: 'LINE',
    layer: DXF_STANDARD_LAYERS.PROFILE,
    start: { x: startX, y: startY },
    end: { x: endX, y: endY },
  });
}

function addLabelEntity(
  entities: DxfEntity[],
  piece: ResolvedPieceWithCutSize,
  widthMm: number,
  heightMm: number,
  targetFace: 'face-A' | 'face-B',
): void {
  entities.push({
    type: 'TEXT',
    layer: DXF_STANDARD_LAYERS.LABEL,
    position: { x: 10, y: -25 },
    height: 12,
    text: `${piece.id} | ${Math.round(widthMm)}x${Math.round(heightMm)}x${piece.thicknessMm}mm | ${targetFace.toUpperCase()} | ${piece.role}`,
  });
}

function buildActiveLayers(entities: DxfEntity[]): DxfLayerDefinition[] {
  const layerMap = new Map<string, DxfLayerDefinition>();

  // Always ensure CONTOUR is present
  layerMap.set(DXF_STANDARD_LAYERS.CONTOUR, {
    name: DXF_STANDARD_LAYERS.CONTOUR,
    color: DXF_LAYER_COLORS[DXF_STANDARD_LAYERS.CONTOUR] ?? 7,
  });

  for (const entity of entities) {
    if (!layerMap.has(entity.layer)) {
      const color =
        DXF_LAYER_COLORS[entity.layer] ?? DXF_DEFAULT_CUSTOM_DRILL_COLOR;
      layerMap.set(entity.layer, {
        name: entity.layer,
        color,
      });
    }
  }

  return Array.from(layerMap.values());
}
