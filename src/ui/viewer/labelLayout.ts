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

export interface LabelExclusionBox {
  /** Identifier for debugging or inspection */
  id: string;
  /** X coordinate in SVG canvas units */
  x: number;
  /** Y coordinate in SVG canvas units */
  y: number;
  /** Width in SVG canvas units */
  width: number;
  /** Height in SVG canvas units */
  height: number;
}

export interface PositionedOperationLabel extends RawOperationLabel {
  /** Computed X position for text rendering */
  renderedX: number;
  /** Computed Y position for text rendering */
  renderedY: number;
  /** Collision tier / stagger level (0 = baseline, 1 = staggered up, 2 = staggered down) */
  staggerLevel: number;
  /** Original zero-based index in the input array */
  originalIndex?: number;
}

/**
 * Resolves non-overlapping coordinates for pre-machining operation labels.
 *
 * Staggers nearby labels that would otherwise visually collide along the Y or X axis,
 * using alternating vertical offsets and horizontal clustering. Also avoids collisions
 * with any designated exclusion boxes (e.g. Datum marks).
 *
 * Guarantees that the returned array maintains the exact same item order and indexing
 * as the input labels array.
 *
 * @param labels List of raw operation labels with target coordinates.
 * @param minSpacingY Minimum vertical spacing required between adjacent labels (default 14px).
 * @param minSpacingX Minimum horizontal spacing required before vertical staggering triggers (default 85px).
 * @param exclusionBoxes Optional bounding boxes reserved for other CAD annotations (e.g. Datum origin).
 * @returns Array of positioned labels with collision-free coordinates in original input order.
 */
export function resolveNonOverlappingLabels(
  labels: RawOperationLabel[],
  minSpacingY = 14,
  minSpacingX = 85,
  exclusionBoxes: LabelExclusionBox[] = [],
  maxY?: number,
): PositionedOperationLabel[] {
  if (labels.length === 0) return [];

  // Index original positions to preserve input order upon return
  const indexed = labels.map((l, idx) => ({ ...l, originalIndex: idx }));

  // Sort primarily by Y coordinate (bottom to top in SVG Y space)
  const sorted = [...indexed].sort((a, b) => a.y - b.y || a.x - b.x);
  const placedList: (PositionedOperationLabel & { originalIndex: number })[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]!;
    let targetY = current.y;
    let staggerLevel = 0;

    // Check collisions against previously placed labels in the same horizontal window
    for (const placed of placedList) {
      const dx = Math.abs(current.x - placed.renderedX);
      if (dx < minSpacingX) {
        if (targetY < placed.renderedY + minSpacingY && targetY >= placed.renderedY - minSpacingY) {
          // If pushing down exceeds maxY or bounds, stagger upwards instead
          if (maxY !== undefined && placed.renderedY + minSpacingY > maxY) {
            targetY = placed.renderedY - minSpacingY;
          } else {
            targetY = placed.renderedY + minSpacingY;
          }
          staggerLevel = placed.staggerLevel + 1;
        }
      }
    }

    // Check collisions against exclusion boxes (e.g. Datum mark note)
    for (const box of exclusionBoxes) {
      const boxMidX = box.x + box.width / 2;
      const dx = Math.abs(current.x - boxMidX);
      const halfW = (current.width ?? 65) / 2 + box.width / 2;
      if (dx < halfW) {
        if (targetY < box.y + box.height + minSpacingY && targetY >= box.y - minSpacingY) {
          // Push upwards away from bottom margin / datum note so it stays within panel area
          targetY = box.y - minSpacingY;
          staggerLevel++;
        }
      }
    }

    if (maxY !== undefined && targetY > maxY) {
      targetY = maxY;
    }

    placedList.push({
      ...current,
      renderedX: current.x,
      renderedY: targetY,
      staggerLevel,
      originalIndex: current.originalIndex,
    });
  }

  // Restore exact original order
  placedList.sort((a, b) => a.originalIndex - b.originalIndex);
  return placedList;
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
