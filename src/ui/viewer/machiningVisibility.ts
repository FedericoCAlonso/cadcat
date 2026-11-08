import { DEFAULT_UI_CONFIG } from '../../config';
import type { PieceMachiningSheet } from '../../resolver';

/**
 * Three-state display mode for 3D machining features (Stage 5 Step B).
 * - 'no': Machining marks are completely hidden.
 * - 'auto': Machining marks display on-demand based on proximity, exploded view, hover, or selection.
 * - 'always': Machining marks are unconditionally visible on all pieces.
 */
export type MachiningDisplayMode = 'no' | 'auto' | 'always';

/**
 * Contextual parameters for evaluating machining visibility on a piece.
 */
export interface MachiningVisibilityParams {
  /** Selected display mode from toolbar: 'no', 'auto', or 'always'. */
  mode: MachiningDisplayMode;
  /** Unique piece identifier being evaluated. */
  pieceId?: string;
  /** Currently hovered piece identifier under pointer raycast, if any. */
  hoveredPieceId?: string | null;
  /** Currently selected piece identifier in inspector, if any. */
  selectedPieceId?: string | null;
  /** Distance from the camera eye to the piece or module center in millimeters. */
  cameraDistanceMm?: number;
  /** Distance threshold below which marks appear in auto mode (defaults to config). */
  distanceThresholdMm?: number;
  /** Current exploded view expansion ratio [0..1]. */
  explodedRatio?: number;
  /** Exploded view threshold above which marks appear in auto mode (defaults to config). */
  explodedThreshold?: number;
}

/**
 * Pure decision function that determines whether 3D machining marks (holes, slots, grooves)
 * should be rendered for a given piece in the viewport.
 *
 * Adheres strictly to the Stage 5 Step B specification:
 * - 'no': Always false.
 * - 'always': Always true.
 * - 'auto': True only if camera is close, exploded view is active, piece is hovered, or piece is selected.
 *
 * @param params Contextual parameters for the piece and viewer state.
 * @returns True if machining marks should be rendered, false otherwise.
 */
export function shouldShowPieceMachining(params: MachiningVisibilityParams): boolean {
  if (params.mode === 'no') return false;
  if (params.mode === 'always') return true;

  // Auto mode evaluations:
  // 1. Camera is close to the module (distance < threshold)
  const distThresh = params.distanceThresholdMm ?? DEFAULT_UI_CONFIG.machiningCameraDistanceThresholdMm ?? 1200;
  if (params.cameraDistanceMm !== undefined && params.cameraDistanceMm < distThresh) {
    return true;
  }

  // 2. Exploded view is active (ratio > threshold)
  const expThresh = params.explodedThreshold ?? DEFAULT_UI_CONFIG.machiningExplodedThreshold ?? 0.08;
  if (params.explodedRatio !== undefined && params.explodedRatio > expThresh) {
    return true;
  }

  // 3. Piece is hovered by the mouse/touch pointer
  if (params.pieceId && params.hoveredPieceId && params.hoveredPieceId === params.pieceId) {
    return true;
  }

  // 4. Piece is actively selected in the inspector
  if (params.pieceId && params.selectedPieceId && params.selectedPieceId === params.pieceId) {
    return true;
  }

  return false;
}

/**
 * Pure function that calculates the total number of machining operations (holes, slots, custom cuts)
 * on a piece machining sheet.
 *
 * @param sheet Piece machining sheet or null.
 * @returns Total count of machining operations.
 */
export function countPieceMachiningOperations(sheet?: PieceMachiningSheet | null): number {
  if (!sheet) return 0;
  const standardOps = typeof sheet.totalOperations === 'number' ? sheet.totalOperations : 0;
  const customOps = Array.isArray(sheet.customOperations) ? sheet.customOperations.length : 0;
  return standardOps + customOps;
}

/**
 * Formats a localized hole/operation counter badge for display in the piece inspector.
 * Example: "42 agujeros" or "1 agujero".
 *
 * @param count Number of holes or operations.
 * @returns Localized string.
 */
export function formatHolesCountText(count: number): string {
  if (count === 1) return '1 agujero';
  return `${new Intl.NumberFormat('es-AR').format(count)} agujeros`;
}
