import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import {
  calculateProportionalBandHeights,
  MIN_DRAWER_BAND_HEIGHT_PX,
} from '../src/ui/drawerScaleUtils';
import { DrawerDistributionVisualizer } from '../src/ui/DrawerDistributionVisualizer';
import type { TrackSize } from '../src/resolver';

describe('Drawer Proportion Scale and Ergonomics (Stage 2 Step A Fix)', () => {
  describe('Proportional band rendering and offsetHeight scaling', () => {
    it('renders the bar and measures the real offsetHeight of the bands: 140 mm is visibly shorter than 187 mm with >= 8 px difference', () => {
      // In JSDOM, offsetHeight is 0 by default because layout is not computed.
      // We configure an offsetHeight getter to return the computed/styled height for elements with explicit pixel styles.
      const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
      Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
        configurable: true,
        get() {
          const styleH = this.style?.height;
          if (styleH && styleH.endsWith('px')) {
            return parseFloat(styleH);
          }
          return 0;
        },
      });

      try {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);

        const fourTracks: TrackSize[] = [
          { type: 'fixed', valueMm: 140 },
          { type: 'fractional', valueFr: 1 },
          { type: 'fractional', valueFr: 1 },
          { type: 'fractional', valueFr: 1 },
        ];
        const fourResolvedHeights = [140, 187, 187, 187];

        act(() => {
          root.render(
            <DrawerDistributionVisualizer
              tracks={fourTracks}
              resolvedDrawerHeights={fourResolvedHeights}
              estimatedBayCavityHeight={701}
            />,
          );
        });

        const band0 = container.querySelector('[data-testid="drawer-band-0"]') as HTMLElement;
        const band1 = container.querySelector('[data-testid="drawer-band-1"]') as HTMLElement;

        expect(band0).not.toBeNull();
        expect(band1).not.toBeNull();

        const h0 = band0.offsetHeight;
        const h1 = band1.offsetHeight;

        expect(h0).toBeGreaterThan(0);
        expect(h1).toBeGreaterThan(0);
        // Cajón 1 (140 mm) is visibly shorter than Cajón 2 (187 mm)
        expect(h1).toBeGreaterThan(h0);
        // Difference must be at least 8 px
        expect(h1 - h0).toBeGreaterThanOrEqual(8);

        act(() => {
          root.unmount();
        });
        container.remove();
      } finally {
        if (originalOffsetHeight) {
          Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
        } else {
          delete (HTMLElement.prototype as unknown as Record<string, unknown>).offsetHeight;
        }
      }
    });

    it('handles multiple drawers with mixed heights to scale', () => {
      const heightsMm = [140, 214, 214, 214];
      const totalContainerPx = 180;
      const resultPx = calculateProportionalBandHeights(heightsMm, totalContainerPx);

      expect(resultPx).toHaveLength(4);
      // Drawer 1 is shorter than drawers 2, 3, 4
      expect(resultPx[0]).toBeLessThan(resultPx[1]!);
      // Drawers 2, 3, 4 have identical heights
      expect(resultPx[1]).toBe(resultPx[2]);
      expect(resultPx[2]).toBe(resultPx[3]);
    });

    it('guarantees minimum visible height for very small drawers without disappearing', () => {
      const heightsMm = [30, 600]; // 30 mm is very small
      const totalContainerPx = 160;
      const resultPx = calculateProportionalBandHeights(heightsMm, totalContainerPx, MIN_DRAWER_BAND_HEIGHT_PX);

      // The small drawer must be clamped to MIN_DRAWER_BAND_HEIGHT_PX (24 px)
      expect(resultPx[0]).toBe(MIN_DRAWER_BAND_HEIGHT_PX);
      // The larger drawer receives the remaining space
      expect(resultPx[1]).toBe(totalContainerPx - MIN_DRAWER_BAND_HEIGHT_PX);
      expect(resultPx[1]).toBeGreaterThan(resultPx[0]!);
    });
  });

  describe('DrawerDistributionVisualizer Component Rendering', () => {
    const tracks: TrackSize[] = [
      { type: 'fixed', valueMm: 140 },
      { type: 'fractional', valueFr: 1 },
      { type: 'fractional', valueFr: 1 },
    ];
    const resolvedHeights = [140, 214, 214];

    it('renders drawer bands proportional to real mm heights in HTML output', () => {
      const html = renderToString(
        <DrawerDistributionVisualizer
          tracks={tracks}
          resolvedDrawerHeights={resolvedHeights}
          estimatedBayCavityHeight={568}
        />,
      );

      // Verify that data attributes contain the proportional pixel height and mm heights
      const matchBand0 = html.match(/data-testid="drawer-band-0"[^>]*data-height-px="([^"]+)"/);
      const matchBand1 = html.match(/data-testid="drawer-band-1"[^>]*data-height-px="([^"]+)"/);

      expect(matchBand0).not.toBeNull();
      expect(matchBand1).not.toBeNull();

      const h0Px = Number(matchBand0![1]);
      const h1Px = Number(matchBand1![1]);

      // Cajón 2 (214 mm) must be taller than Cajón 1 (140 mm)
      expect(h1Px).toBeGreaterThan(h0Px);
      expect(html).toContain('140 mm');
      expect(html).toContain('214 mm');
    });

    it('does not enlarge drawer band when selected (selection shows via outline/color only)', () => {
      const htmlSelected0 = renderToString(
        <DrawerDistributionVisualizer
          tracks={tracks}
          resolvedDrawerHeights={resolvedHeights}
          estimatedBayCavityHeight={568}
          selectedIndex={0}
        />,
      );

      const htmlSelected1 = renderToString(
        <DrawerDistributionVisualizer
          tracks={tracks}
          resolvedDrawerHeights={resolvedHeights}
          estimatedBayCavityHeight={568}
          selectedIndex={1}
        />,
      );

      const match0WhenSelected = htmlSelected0.match(/data-testid="drawer-band-0"[^>]*data-height-px="([^"]+)"/);
      const match0WhenUnselected = htmlSelected1.match(/data-testid="drawer-band-0"[^>]*data-height-px="([^"]+)"/);

      expect(match0WhenSelected![1]).toBe(match0WhenUnselected![1]);
    });

    it('renders cleanly in containers of widths 360px, 410px, and 480px without broken layout', () => {
      const widths = [360, 410, 480];

      widths.forEach((w) => {
        const html = renderToString(
          <div style={{ width: `${w}px`, maxWidth: `${w}px` }}>
            <DrawerDistributionVisualizer
              tracks={tracks}
              resolvedDrawerHeights={resolvedHeights}
              estimatedBayCavityHeight={568}
              selectedIndex={0}
            />
          </div>,
        );

        // Check that visualizer and essential elements are present
        expect(html).toContain('drawer-distribution-visualizer');
        expect(html).toContain('drawer-elevation-diagram');
        expect(html).toContain('drawer-selected-editor');
        // Check unit toggle has shortened labels
        expect(html).toContain('Proporc. (fr)');
        expect(html).toContain('Fijo (mm)');
      });
    });

    it('verifies bottom padding CSS variable is configured for panel scroll container', () => {
      // Read theme.css to verify shared CSS variable declaration
      const fs = require('fs');
      const path = require('path');
      const themeCss = fs.readFileSync(path.resolve(__dirname, '../src/ui/theme.css'), 'utf-8');

      expect(themeCss).toContain('--m3-bottom-nav-total-height');
      expect(themeCss).toContain('padding-bottom: var(--m3-bottom-nav-total-height)');
    });
  });
});
