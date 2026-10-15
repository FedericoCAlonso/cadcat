import type { CustomPieceOperation, DrillOperation } from '../../model';

export interface DxfPoint2D {
  x: number;
  y: number;
}

export interface DxfVertex {
  x: number;
  y: number;
  /** Bulge factor for curved polyline segments: tan(included_angle / 4) */
  bulge?: number;
}

export interface DxfLineEntity {
  type: 'LINE';
  layer: string;
  start: DxfPoint2D;
  end: DxfPoint2D;
}

export interface DxfCircleEntity {
  type: 'CIRCLE';
  layer: string;
  center: DxfPoint2D;
  radius: number;
}

export interface DxfPolylineEntity {
  type: 'POLYLINE';
  layer: string;
  vertices: DxfVertex[];
  isClosed: boolean;
}

export interface DxfTextEntity {
  type: 'TEXT';
  layer: string;
  position: DxfPoint2D;
  height: number;
  text: string;
}

export type DxfEntity =
  | DxfLineEntity
  | DxfCircleEntity
  | DxfPolylineEntity
  | DxfTextEntity;

export interface DxfLayerDefinition {
  name: string;
  color: number;
  lineType?: string;
}

export interface DxfExportOptions {
  /** Target piece face to export: 'face-A' (default) or 'face-B' */
  face?: 'face-A' | 'face-B';
  /** Optional custom operations on the piece */
  customOperations?: CustomPieceOperation[];
  /** Optional derived operations from joints and hardware (hinges, confirmat, etc.) */
  derivedOperations?: DrillOperation[];
  /** Include text annotation with piece ID and dimensions outside contour */
  includeLabels?: boolean;
  /** Use cut dimensions (accounting for edge bands) instead of finished dimensions */
  useCutDimensions?: boolean;
  /** Include additional centerline path on layer 2_GROOVE */
  includeGrooveCenterline?: boolean;
  /** Decimal places for floating point coordinates (default 3) */
  coordinatePrecision?: number;
}

export interface DxfPieceExportResult {
  pieceId: string;
  fileName: string;
  dxfContent: string;
  face: 'face-A' | 'face-B';
}
