/**
 * Layout utilities for non-overlapping 2D CAD coordinate annotations.
 * Ensures that technical labels placed on panel pre-machining drawings
 * maintain readable clearance without intersecting each other.
 */

export interface RawOperationLabel {
  /** Unique operation identifier or index */
  id: string;
  /** X coordinate in SVG canvas units */
  x: number;
  /** Y coordinate in SVG canvas units */
  y: number;
  /** Label text to display */
  text: string;
  /** Estimated text width in canvas units */
  width?: number;
  /** Estimated text height in canvas units */
  height?: number;
  /** Whether this label belongs to a full-width slide line */
  isSlide?: boolean;
}

export interface PositionedOperationLabel extends RawOperationLabel {
  /** Computed X position for text rendering */
  renderedX: number;
  /** Computed Y position for text rendering */
  renderedY: number;
  /** Collision tier / stagger level (0 = baseline, 1 = staggered up, 2 = staggered down) */
  staggerLevel: number;
}

/**
 * Resolves non-overlapping coordinates for pre-machining operation labels.
 *
 * Staggers nearby labels that would otherwise visually collide along the Y or X axis,
 * using alternating vertical offsets and horizontal clustering.
 *
 * @param labels List of raw operation labels with target coordinates.
 * @param minSpacingY Minimum vertical spacing required between adjacent labels (default 14px).
 * @param minSpacingX Minimum horizontal spacing required before vertical staggering triggers (default 75px).
 * @returns Array of positioned labels with collision-free coordinates.
 */
export function resolveNonOverlappingLabels(
  labels: RawOperationLabel[],
  minSpacingY = 14,
  minSpacingX = 85,
): PositionedOperationLabel[] {
  if (labels.length === 0) return [];

  // Sort primarily by Y coordinate (bottom to top in SVG Y space)
  const sorted = [...labels].sort((a, b) => a.y - b.y || a.x - b.x);
  const result: PositionedOperationLabel[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]!;
    let targetY = current.y;
    let staggerLevel = 0;

    // Check collisions against previously placed labels in the same horizontal window
    for (const placed of result) {
      const dx = Math.abs(current.x - placed.renderedX);
      if (dx < minSpacingX) {
        if (targetY < placed.renderedY + minSpacingY && targetY >= placed.renderedY - minSpacingY) {
          targetY = placed.renderedY + minSpacingY;
          staggerLevel = placed.staggerLevel + 1;
        }
      }
    }

    result.push({
      ...current,
      renderedX: current.x,
      renderedY: targetY,
      staggerLevel,
    });
  }

  return result;
}

/**
 * Validates that no two positioned labels overlap within a collision box threshold.
 *
 * @param labels Positioned labels to verify.
 * @param minSpacingX Minimum required horizontal clearance.
 * @param minSpacingY Minimum required vertical clearance.
 * @returns True if all labels satisfy clearance constraints.
 */
export function hasNoLabelCollisions(
  labels: PositionedOperationLabel[],
  minSpacingX = 60,
  minSpacingY = 10,
): boolean {
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const a = labels[i]!;
      const b = labels[j]!;
      const dx = Math.abs(a.renderedX - b.renderedX);
      const dy = Math.abs(a.renderedY - b.renderedY);

      if (dx < minSpacingX && dy < minSpacingY) {
        return false;
      }
    }
  }
  return true;
}
