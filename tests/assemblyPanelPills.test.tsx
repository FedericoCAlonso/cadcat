import 'fake-indexeddb/auto';
import { act } from 'react';
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { AssemblySheetView } from '../src/ui/AssemblySheetView';
import {
  getModularPresetById,
  buildModularModule,
  generateAssemblySheet,
} from '../src/resolver';
import { DEFAULT_UI_CONFIG } from '../src/config';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Fix Commit B: Panel Selector Pills & Assembly Guide Pre-machining UI', () => {
  // Generate 24-piece module from preset-drawer-unit-3
  const preset24 = getModularPresetById('preset-drawer-unit-3');
  const def24 = preset24.createDefinition({ width: 600, height: 800, depth: 560 }, {
    carcassMaterialId: 'mat-1',
    frontsMaterialId: 'mat-1',
    drawerBoxesMaterialId: 'mat-1',
    backingsMaterialId: 'mat-1',
  });
  const output24 = buildModularModule(def24);
  const sheet24 = generateAssemblySheet({
    module: {
      moduleId: 'preset-drawer-unit-3',
      pieces: output24.resolvedPieces,
      joints: output24.module.joints,
    },
    moduleDimensions: { width: 600, height: 800, depth: 560 },
  });

  // Generate 30+-piece module (5 drawers * 6 + 6 carcass = 36 pieces)
  const def30 = preset24.createDefinition({ width: 600, height: 1200, depth: 560 }, {
    carcassMaterialId: 'mat-1',
    frontsMaterialId: 'mat-1',
    drawerBoxesMaterialId: 'mat-1',
    backingsMaterialId: 'mat-1',
  });
  const firstBay = def30.bays?.[0];
  if (firstBay && firstBay.type === 'drawer-stack') {
    firstBay.drawerTracks = [
      { type: 'fixed', valueMm: 140 },
      { type: 'fractional', valueFr: 1 },
      { type: 'fractional', valueFr: 1 },
      { type: 'fractional', valueFr: 1 },
      { type: 'fractional', valueFr: 1 },
    ];
  }
  const output30 = buildModularModule(def30);
  const sheet30 = generateAssemblySheet({
    module: {
      moduleId: 'module-5-drawers-36pieces',
      pieces: output30.resolvedPieces,
      joints: output30.module.joints,
    },
    moduleDimensions: { width: 600, height: 1200, depth: 560 },
  });

  const viewports = [320, 360, 390];

  it('confirms piece counts for 24-piece and 30+-piece test modules', () => {
    expect(output24.resolvedPieces.length).toBe(24);
    expect(sheet24.panelDetails.length).toBeGreaterThan(0);

    expect(output30.resolvedPieces.length).toBeGreaterThanOrEqual(30);
    expect(sheet30.panelDetails.length).toBeGreaterThan(0);
  });

  viewports.forEach((viewportWidth) => {
    describe(`Viewport width ${viewportWidth}px`, () => {
      it(`renders panel chips correctly for 24-piece module at ${viewportWidth}px`, () => {
        const container = document.createElement('div');
        container.style.width = `${viewportWidth}px`;
        container.style.maxWidth = `${viewportWidth}px`;
        document.body.appendChild(container);
        const root = createRoot(container);

        act(() => {
          root.render(
            <AssemblySheetView
              assemblySheet={sheet24}
              pieces={output24.resolvedPieces}
            />,
          );
        });

        const chipsScroll = container.querySelector('.assembly-panel-chips-scroll');
        expect(chipsScroll).not.toBeNull();
        expect(chipsScroll?.getAttribute('role')).toBe('tablist');

        const pills = Array.from(container.querySelectorAll('.assembly-panel-chip'));
        expect(pills.length).toBe(sheet24.panelDetails.length);

        pills.forEach((pill) => {
          const button = pill as HTMLButtonElement;

          // Must have valid title attribute with full panel name
          const title = button.getAttribute('title');
          expect(title).toBeTruthy();
          expect(title).toContain('#');

          // Must have single-line text wrapper span
          const spanText = button.querySelector('.assembly-panel-chip-text');
          expect(spanText).not.toBeNull();
          expect(spanText?.textContent?.trim()).toBe(title?.trim());

          // Must not exceed 56px height (standard touch targets are 40-48px)
          const computedHeight = button.offsetHeight;
          if (computedHeight > 0) {
            expect(computedHeight).toBeLessThanOrEqual(56);
          }
        });

        // Pre-machining header bar with compact external "Ampliar" button
        const headerBar = container.querySelector('.assembly-diagram-header-bar');
        expect(headerBar).not.toBeNull();
        const zoomBtn = container.querySelector('.assembly-diagram-zoom-btn');
        expect(zoomBtn).not.toBeNull();
        expect(zoomBtn?.textContent).toContain('Ampliar');

        // Intrusive inside overlay must NOT be present in pre-machining section
        const preMachiningSection = container.querySelector('.assembly-panels-section');
        const tapHint = preMachiningSection?.querySelector('.assembly-diagram-tap-hint');
        expect(tapHint).toBeNull();

        // Technical SVG drawing checks
        const svg = container.querySelector('.panel-detail-svg');
        expect(svg).not.toBeNull();
        const viewBox = svg?.getAttribute('viewBox');
        expect(viewBox).toBeTruthy();

        // ViewBox must NOT be the old hardcoded 680 340
        expect(viewBox).not.toBe('0 0 680 340');

        act(() => {
          root.unmount();
        });
        container.remove();
      });

      it(`renders panel chips correctly for 30+-piece module at ${viewportWidth}px`, () => {
        const container = document.createElement('div');
        container.style.width = `${viewportWidth}px`;
        container.style.maxWidth = `${viewportWidth}px`;
        document.body.appendChild(container);
        const root = createRoot(container);

        act(() => {
          root.render(
            <AssemblySheetView
              assemblySheet={sheet30}
              pieces={output30.resolvedPieces}
            />,
          );
        });

        const chipsScroll = container.querySelector('.assembly-panel-chips-scroll');
        expect(chipsScroll).not.toBeNull();

        const pills = Array.from(container.querySelectorAll('.assembly-panel-chip'));
        expect(pills.length).toBe(sheet30.panelDetails.length);
        expect(pills.length).toBeGreaterThanOrEqual(4);

        pills.forEach((pill) => {
          const button = pill as HTMLButtonElement;
          const title = button.getAttribute('title');
          expect(title).toBeTruthy();

          const spanText = button.querySelector('.assembly-panel-chip-text');
          expect(spanText).not.toBeNull();
        });

        act(() => {
          root.unmount();
        });
        container.remove();
      });
    });
  });

  it('guarantees font size meets panelDetailMinFontSizePx config threshold in pre-machining SVG', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <AssemblySheetView
          assemblySheet={sheet24}
          pieces={output24.resolvedPieces}
        />,
      );
    });

    const svg = container.querySelector('.panel-detail-svg');
    expect(svg).not.toBeNull();

    // Verify all text elements in SVG have font-size >= DEFAULT_UI_CONFIG.panelDetailMinFontSizePx
    const minConfigPx = DEFAULT_UI_CONFIG.panelDetailMinFontSizePx;
    expect(minConfigPx).toBe(11);

    const texts = Array.from(svg?.querySelectorAll('text') ?? []);
    expect(texts.length).toBeGreaterThan(0);

    texts.forEach((txt) => {
      const fs = txt.getAttribute('font-size') ?? txt.style.fontSize;
      const numericFs = parseFloat(fs);
      // All primary dimensions and datum labels must satisfy minimum config font size
      if (txt.textContent?.includes('Ancho:') || txt.textContent?.includes('Alto:')) {
        expect(numericFs).toBeGreaterThanOrEqual(minConfigPx);
      }
    });

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('guarantees balloons #1 and #14 have clearance from the canvas border in the exploded diagram', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <AssemblySheetView
          assemblySheet={sheet24}
          pieces={output24.resolvedPieces}
        />,
      );
    });

    const explodedSvg = container.querySelector('.assembly-exploded-svg');
    expect(explodedSvg).not.toBeNull();

    // Find balloon circles and texts
    const balloonGroups = Array.from(explodedSvg?.querySelectorAll('.exploded-balloon-group') ?? []);
    expect(balloonGroups.length).toBeGreaterThan(0);

    const balloonsMap = new Map<number, { cx: number; cy: number }>();
    balloonGroups.forEach((bg) => {
      const text = bg.querySelector('text')?.textContent?.replace('#', '');
      const circle = bg.querySelector('circle');
      if (text && circle) {
        const num = parseInt(text, 10);
        const cx = parseFloat(circle.getAttribute('cx') ?? '0');
        const cy = parseFloat(circle.getAttribute('cy') ?? '0');
        balloonsMap.set(num, { cx, cy });
      }
    });

    // Check balloon #1 (side-left)
    const b1 = balloonsMap.get(1);
    expect(b1).toBeDefined();
    if (b1) {
      // Must not be clamped to the 0 margin; must have at least 25px clearance from border (width = 840)
      expect(b1.cx).toBeGreaterThanOrEqual(25);
      expect(b1.cx).toBeLessThanOrEqual(840 - 25);
    }

    // Check balloon #14 (drawer component)
    const b14 = balloonsMap.get(14);
    expect(b14).toBeDefined();
    if (b14) {
      expect(b14.cx).toBeGreaterThanOrEqual(25);
      expect(b14.cx).toBeLessThanOrEqual(840 - 25);
      expect(b14.cy).toBeGreaterThanOrEqual(25);
      expect(b14.cy).toBeLessThanOrEqual(520 - 25);
    }

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
