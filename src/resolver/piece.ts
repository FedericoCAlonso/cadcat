import {
  type Contour,
  type Face,
  type Piece,
  type Point2D,
  type SecondaryCut,
  validatePiece,
} from '../model';

export interface ContourSegment {
  index: number;
  faceId: string;
  start: Point2D;
  end: Point2D;
  lengthMm: number;
}

export interface CreatePieceInput {
  id: string;
  role: string;
  materialId: string;
  contour: Contour;
  thicknessMm: number;
  structural?: boolean;
  referenceFace?: 'A' | 'B';
  edgeFaceIds?: string[];
  isAuxiliary?: boolean;
  rawBoundingBox?: { widthMm: number; heightMm: number };
  secondaryCuts?: SecondaryCut[];
  notes?: string[];
}

/**
 * Standard edge face role names for a 4-sided rectangular panel.
 */
export const RECTANGULAR_EDGE_NAMES = [
  'bottom-edge',
  'right-edge',
  'top-edge',
  'left-edge',
] as const;

/**
 * Default structural roles in standard cabinet furniture.
 */
const DEFAULT_STRUCTURAL_ROLES = new Set([
  'side-left',
  'side-right',
  'bottom',
  'top',
  'rail',
  'rail-front',
  'rail-back',
]);

/**
 * Check if a role is structural by default.
 */
export function isDefaultStructuralRole(role: string): boolean {
  return DEFAULT_STRUCTURAL_ROLES.has(role);
}

/**
 * Create a rectangular contour with 4 vertices.
 */
export function createRectangularContour(widthMm: number, heightMm: number): Contour {
  if (widthMm <= 0 || heightMm <= 0) {
    throw new Error('Contour width and height must be positive numbers');
  }

  return {
    points: [
      { x: 0, y: 0 },
      { x: widthMm, y: 0 },
      { x: widthMm, y: heightMm },
      { x: 0, y: heightMm },
    ],
  };
}

/**
 * Calculate the Euclidean distance between two 2D points.
 */
export function calculateSegmentLength(start: Point2D, end: Point2D): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return Math.hypot(dx, dy);
}

/**
 * Extract contour segments and their lengths from a polygon contour.
 */
export function getContourSegments(
  contour: Contour,
  edgeFaceIds?: string[],
): ContourSegment[] {
  const points = contour.points;
  const pointCount = points.length;

  if (pointCount < 3) {
    throw new Error('A polygon contour must have at least 3 points');
  }

  const segments: ContourSegment[] = [];

  for (let i = 0; i < pointCount; i++) {
    const start = points[i]!;
    const end = points[(i + 1) % pointCount]!;
    const defaultName = pointCount === 4 && RECTANGULAR_EDGE_NAMES[i]
      ? RECTANGULAR_EDGE_NAMES[i]!
      : `edge-${i}`;
    const faceId = edgeFaceIds?.[i] ?? defaultName;

    segments.push({
      index: i,
      faceId,
      start,
      end,
      lengthMm: calculateSegmentLength(start, end),
    });
  }

  return segments;
}

/**
 * Generate faces for a piece: two large faces and one edge face per contour segment.
 */
export function createPieceFaces(contour: Contour, edgeFaceIds?: string[]): Face[] {
  const segments = getContourSegments(contour, edgeFaceIds);

  const largeFaces: Face[] = [
    { id: 'face-a', visible: false },
    { id: 'face-b', visible: false },
  ];

  const edgeFaces: Face[] = segments.map((seg) => ({
    id: seg.faceId,
    visible: false,
  }));

  return [...largeFaces, ...edgeFaces];
}

/**
 * Make a Piece from a contour, thickness, and material.
 * Generates two large faces and one edge face for each segment of the contour.
 */
export function createPiece(input: CreatePieceInput): Piece {
  const faces = createPieceFaces(input.contour, input.edgeFaceIds);

  const piece: Piece = {
    id: input.id,
    role: input.role,
    materialId: input.materialId,
    contour: input.contour,
    thicknessMm: input.thicknessMm,
    faces,
    structural: input.structural ?? isDefaultStructuralRole(input.role),
    referenceFace: input.referenceFace ?? 'A',
    isAuxiliary: input.isAuxiliary,
    rawBoundingBox: input.rawBoundingBox,
    secondaryCuts: input.secondaryCuts,
    notes: input.notes,
  };

  return validatePiece(piece);
}

/**
 * Determines whether a piece is visually prominent in finished furniture or an internal / hidden cut.
 * Hidden pieces (amarres, travesaños, fondos, cajas de cajones, calibres, zócalos) do not require
 * strict visual grain alignment and can be rotated to maximize sheet utilization in automatic grain mode.
 */
export function isPieceVisible(piece: { role?: string; isAuxiliary?: boolean; visible?: boolean }): boolean {
  if (piece.isAuxiliary) return false;
  if (piece.visible !== undefined) return piece.visible;

  const role = (piece.role || '').toLowerCase();

  // Hidden internal roles: rails, braces, transoms, backings, drawer boxes, internal lips, plinths, gauges
  if (
    role.includes('rail') ||
    role.includes('brace') ||
    role.includes('transom') ||
    role.includes('back') ||
    role.includes('drawer-box') ||
    role.includes('drawer-side') ||
    role.includes('drawer-bottom') ||
    role.includes('plinth') ||
    role.includes('tray-bottom') ||
    role.includes('lip') ||
    role.includes('gauge')
  ) {
    return false;
  }

  return true;
}

/**
 * Resolves whether a piece is allowed to rotate on a sheet based on material grain and nesting grain mode.
 * - If the sheet/material has no grain: ALWAYS can rotate (maximum nesting yield).
 * - If grain mode is 'free': ALWAYS can rotate.
 * - If grain mode is 'strict': NEVER can rotate on grained materials.
 * - If grain mode is 'auto': Visible pieces preserve grain (cannot rotate); hidden cuts can rotate.
 */
export function canPieceRotate(
  piece: { role?: string; isAuxiliary?: boolean; visible?: boolean },
  hasMaterialGrain: boolean,
  grainMode: 'auto' | 'strict' | 'free' = 'auto'
): boolean {
  if (!hasMaterialGrain) return true;
  if (grainMode === 'free') return true;
  if (grainMode === 'strict') return false;
  // 'auto': hidden cuts can rotate freely, visible pieces cannot
  return !isPieceVisible(piece);
}
