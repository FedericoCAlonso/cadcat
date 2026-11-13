import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { M3ToggleRow } from '../src/ui/M3ToggleRow';
import { StructureSection } from '../src/ui/StructureSection';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('M3ToggleRow aligned text-first switch pattern', () => {
  it('renders label and description before the switch control and toggles on change', () => {
    const onChange = vi.fn();
    const html = renderToStaticMarkup(
      <M3ToggleRow
        id="test-toggle"
        label="Refuerzo central entre fajas"
        description="Aumenta la rigidez estructural superior."
        checked={false}
        onChange={onChange}
      />,
    );

    const textPos = html.indexOf('m3-toggle-row__text');
    const switchPos = html.indexOf('m3-switch');
    expect(textPos).toBeGreaterThan(-1);
    expect(switchPos).toBeGreaterThan(textPos);
    expect(html).toContain('role="switch"');

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    try {
      act(() => {
        root.render(
          <M3ToggleRow
            id="test-toggle"
            label="Refuerzo central entre fajas"
            checked={false}
            onChange={onChange}
          />,
        );
      });

      const input = container.querySelector<HTMLInputElement>('input[type="checkbox"]');
      expect(input).not.toBeNull();
      act(() => {
        input?.click();
      });
      expect(onChange).toHaveBeenCalledWith(true);
    } finally {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
  });

  it('uses text-first right-aligned toggle rows for all StructureSection options', () => {
    const html = renderToStaticMarkup(
      <StructureSection
        roofType="front-back-rails"
        jointPriority="lateral-over-bottom"
        backingType="groove"
        backingThicknessMm={3}
        gridType="2-bays-vertical"
        partitionPassThroughRoof={false}
        hasMiddleBrace={true}
        middleBraceWidthMm={100}
        hasWallHangingRail={false}
        wallHangingRailWidthMm={100}
        hasPlinth={false}
        plinthHeightMm={100}
        plinthSetbackMm={40}
      />,
    );

    const container = document.createElement('div');
    container.innerHTML = html;
    const rows = Array.from(container.querySelectorAll('.m3-toggle-row'));
    expect(rows).toHaveLength(4);

    for (const row of rows) {
      const children = Array.from(row.children);
      expect(children[0]?.classList.contains('m3-toggle-row__text')).toBe(true);
      expect(children[1]?.classList.contains('m3-switch')).toBe(true);
      expect(children[1]?.querySelector('input[type="checkbox"][role="switch"]')).not.toBeNull();
    }
  });
});
