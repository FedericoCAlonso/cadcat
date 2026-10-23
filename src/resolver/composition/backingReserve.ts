import type { CarcassDefinition } from './types';

/**
 * Backing inputs that determine how much rear depth is consumed before interior equipment.
 */
export type BackingReserveInput = Pick<
  CarcassDefinition,
  'hasBacking' | 'backingType' | 'backingThicknessMm' | 'backingGrooveDistanceMm' | 'isIslandCabinet'
>;

/** Thickness from which a backing is treated as a thick structural (confirmat) panel. */
export const THICK_BACKING_MIN_THICKNESS_MM = 15;
export const DEFAULT_BACKING_THICKNESS_MM = 3;
export const DEFAULT_BACKING_GROOVE_DISTANCE_MM = 15;

/**
 * Depth (from the carcass rear edge toward the front) occupied by the backing panel, i.e. the
 * distance between the rear edge of the sides and the interior face of the backing.
 * Interior equipment must stop flush against that face.
 *
 * - none / island: 0
 * - overlay / rebate: panel thickness (flush with rear carcass depth)
 * - thick structural (>= 15 mm, confirmat between the sides): panel thickness
 * - groove: groove distance from the rear edge + panel thickness
 */
export function resolveBackingReserveMm(input: BackingReserveInput): number {
  const {
    hasBacking = true,
    backingType = 'groove',
    backingThicknessMm = DEFAULT_BACKING_THICKNESS_MM,
    backingGrooveDistanceMm = DEFAULT_BACKING_GROOVE_DISTANCE_MM,
    isIslandCabinet = false,
  } = input;

  if (!hasBacking || isIslandCabinet || backingType === 'none') {
    return 0;
  }
  if (
    backingType === 'overlay' ||
    backingType === 'rebate' ||
    backingThicknessMm >= THICK_BACKING_MIN_THICKNESS_MM
  ) {
    return backingThicknessMm;
  }
  return backingGrooveDistanceMm + backingThicknessMm;
}
