import { describe, it, expect } from 'vitest';
import { calculateCie76Distance } from '../src/ui/viewer/colorDistance';
import {
  ROLE_CATEGORY_PBR_STYLES,
  resolveSelectedPieceStyle,
} from '../src/ui/materialStyles';
import { resolveEdgeBandHighlightColor } from '../src/ui/viewer/edgeBandHighlight';
import { DEFAULT_UI_CONFIG } from '../src/config';

describe('CIE76 Color Distance Audit', () => {
  it('calculates zero distance for identical colors', () => {
    expect(calculateCie76Distance('#ffffff', '#ffffff')).toBe(0);
    expect(calculateCie76Distance('#000000', '#000000')).toBe(0);
    expect(calculateCie76Distance('#E91E63', '#E91E63')).toBe(0);
  });

  it('calculates expected known perceptual distance in Lab space', () => {
    // Pure black (0,0,0) to pure white (100,0,0) in Lab is delta L* = 100
    const blackWhiteDist = calculateCie76Distance('#000000', '#ffffff');
    expect(Math.round(blackWhiteDist)).toBe(100);
  });

  it('verifies that each role color has perceptual distance above config threshold against edge band, selection, outline, and machining', () => {
    const minThreshold = DEFAULT_UI_CONFIG.minPerceptualColorDistance ?? 25.0;
    const outlineHex = '#ffffff';
    const machiningHex = '#00e676';

    const themes: Array<'light' | 'dark'> = ['light', 'dark'];

    for (const theme of themes) {
      const roleStyles = ROLE_CATEGORY_PBR_STYLES[theme];
      const edgeBandHex = `#${resolveEdgeBandHighlightColor(theme).toString(16).padStart(6, '0')}`;
      const selStyle = resolveSelectedPieceStyle(theme);
      const selectionHex = `#${selStyle.color.toString(16).padStart(6, '0')}`;

      for (const [roleName, pbrStyle] of Object.entries(roleStyles)) {
        const roleHex = `#${pbrStyle.color.toString(16).padStart(6, '0')}`;

        // 1. Distance between role color and edge band highlight color
        const distEdgeBand = calculateCie76Distance(roleHex, edgeBandHex);
        expect(
          distEdgeBand,
          `Theme [${theme}] role [${roleName}] (${roleHex}) vs EdgeBand (${edgeBandHex}) must be >= ${minThreshold}, got ${distEdgeBand.toFixed(2)}`
        ).toBeGreaterThanOrEqual(minThreshold);

        // 2. Distance between role color and selection highlight color
        const distSelection = calculateCie76Distance(roleHex, selectionHex);
        expect(
          distSelection,
          `Theme [${theme}] role [${roleName}] (${roleHex}) vs Selection (${selectionHex}) must be >= ${minThreshold}, got ${distSelection.toFixed(2)}`
        ).toBeGreaterThanOrEqual(minThreshold);

        // 3. Distance between role color and outline color (#ffffff)
        const distOutline = calculateCie76Distance(roleHex, outlineHex);
        expect(
          distOutline,
          `Theme [${theme}] role [${roleName}] (${roleHex}) vs Outline (${outlineHex}) must be >= ${minThreshold}, got ${distOutline.toFixed(2)}`
        ).toBeGreaterThanOrEqual(minThreshold);

        // 4. Distance between role color and machining color (#00e676)
        const distMachining = calculateCie76Distance(roleHex, machiningHex);
        expect(
          distMachining,
          `Theme [${theme}] role [${roleName}] (${roleHex}) vs Machining (${machiningHex}) must be >= ${minThreshold}, got ${distMachining.toFixed(2)}`
        ).toBeGreaterThanOrEqual(minThreshold);
      }
    }
  });
});
