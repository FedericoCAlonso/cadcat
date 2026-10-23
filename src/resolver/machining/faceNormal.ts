/**
 * Determines the sign of the normal axis for Face A vs Face B based on the piece's spatial role.
 * - For right side panels (side-right, drawer-side-r): Face A is INNER (-X into cabinet), Face B is OUTER (+X).
 * - For left side panels (side-left, drawer-side-l): Face A is INNER (+X into cabinet), Face B is OUTER (-X).
 * - For roof / top panels: Face A is INNER (-Y into cabinet), Face B is OUTER (+Y).
 * - For shelves and bottom panels: Face A is TOP (+Y), Face B is BOTTOM (-Y).
 * - For doors and drawer fronts: Face A is EXTERIOR (-Z), Face B is INTERIOR (+Z).
 */
export function getPieceFaceNormalSign(
  role: string,
  pieceId: string,
  isFaceA: boolean,
  normal: 'x' | 'y' | 'z',
): number {
  const r = role.toLowerCase();
  const id = pieceId.toLowerCase();

  if (normal === 'x') {
    if (r.includes('side-right') || r.includes('side-r') || id.includes('side-right') || id.includes('side-r')) {
      return isFaceA ? -1 : 1;
    }
    return isFaceA ? 1 : -1;
  }

  if (normal === 'y') {
    if (r.includes('roof') || r.includes('top') || id.includes('roof') || id.includes('top')) {
      return isFaceA ? -1 : 1;
    }
    return isFaceA ? 1 : -1;
  }

  // normal === 'z'
  // In CadCat coordinate frame:
  // - Camera and exterior face are towards -Z (Face A: -1).
  // - Cabinet interior and hinge cup mortises are towards +Z (Face B: +1).
  return isFaceA ? -1 : 1;
}
