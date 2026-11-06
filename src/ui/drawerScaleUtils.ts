/**
 * Minimum visible height in pixels for very small drawers to ensure accessibility,
 * touch targets, and legible text without vertical overflow.
 * Specified in Stage 2 requirements:
 * 'Set a minimum visible height for very small drawers, and mark it in the code with a comment.'
 */
export const MIN_DRAWER_BAND_HEIGHT_PX = 24;

/**
 * Calculates proportional heights in pixels for drawer elevation bands.
 * Ensures heights are strictly proportional to real mm heights, while guaranteeing
 * each drawer meets MIN_DRAWER_BAND_HEIGHT_PX so small drawers remain clickable and readable.
 *
 * @param heightsMm - Array of real resolved drawer heights in mm.
 * @param totalContainerHeightPx - Desired total height of the diagram in pixels (default: 125px).
 * @param minHeightPx - Minimum allowable height per band in pixels (default: MIN_DRAWER_BAND_HEIGHT_PX).
 * @returns Array of calculated pixel heights corresponding to each drawer band.
 */
export function calculateProportionalBandHeights(
  heightsMm: number[],
  totalContainerHeightPx: number = 125,
  minHeightPx: number = MIN_DRAWER_BAND_HEIGHT_PX,
): number[] {
  const count = heightsMm.length;
  if (count === 0) return [];
  if (count === 1) return [totalContainerHeightPx];

  const totalMm = heightsMm.reduce((acc, h) => acc + Math.max(0, h), 0);
  if (totalMm <= 0) {
    const equalH = Math.max(minHeightPx, Math.floor(totalContainerHeightPx / count));
    return heightsMm.map(() => equalH);
  }

  // Initial proportional calculation
  let heightsPx = heightsMm.map((h) => (Math.max(0, h) / totalMm) * totalContainerHeightPx);

  // If any drawer is below the minimum visible height, clamp it and redistribute remaining height
  const needsClamping = heightsPx.some((h) => h < minHeightPx);
  if (needsClamping) {
    let clampedTotal = 0;
    let unclampedMm = 0;

    heightsPx.forEach((h, idx) => {
      if (h < minHeightPx) {
        clampedTotal += minHeightPx;
      } else {
        unclampedMm += Math.max(0, heightsMm[idx] ?? 0);
      }
    });

    const remainingPx = Math.max(0, totalContainerHeightPx - clampedTotal);

    heightsPx = heightsMm.map((h, idx) => {
      if ((heightsPx[idx] ?? 0) < minHeightPx) {
        return minHeightPx;
      }
      return unclampedMm > 0 ? (Math.max(0, h) / unclampedMm) * remainingPx : minHeightPx;
    });
  }

  return heightsPx.map((h) => Math.round(h * 10) / 10);
}
