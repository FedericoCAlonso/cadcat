/**
 * 2D Contact footprint of a piece touching the active/selected piece.
 */
export interface PieceContactProjection {
  id: string;
  sourcePieceId: string;
  sourceRole: string;
  label: string;
  face: 'face-A' | 'face-B';
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
  axis: 'horizontal' | 'vertical';
  centerLineMm: number; // Y coordinate if horizontal, X coordinate if vertical
}

/**
 * Individual snap point or guide line.
 */
export interface SnapGuide {
  type: 'x' | 'y';
  valueMm: number;
  label: string;
  kind: 'midpoint' | 'quarter' | 'third' | 'system32' | 'projection-center' | 'projection-edge' | 'edge';
}

export interface SnapResult {
  xMm: number;
  yMm: number;
  isSnappedX: boolean;
  isSnappedY: boolean;
  guides: SnapGuide[];
  label?: string;
}

export interface FastenerDistributionConfig {
  count: 2 | 3 | 4 | 5;
  setbackStartMm?: number; // e.g. 37mm from front or 50mm
  setbackEndMm?: number;   // e.g. 50mm from back
  diameterMm?: number;    // default 5mm for confirmat/shelf pins, 8mm for dowels
  depthMm?: number;       // default 12mm or through-hole
  kind?: 'drill' | 'confirmat' | 'dowel' | 'minifix';
}
