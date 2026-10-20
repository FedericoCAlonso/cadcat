import { act } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { ThumbArcInput } from '../src/ui/ThumbArcInput';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ThumbArcInput Component (Modo Obra UI)', () => {
  it('renders correctly with label, value, unit, and hand mode', () => {
    const html = renderToString(
      <ThumbArcInput
        id="test-width"
        label="Ancho del Mueble"
        value={800}
        unit="mm"
        min={200}
        max={2400}
        onChange={vi.fn()}
      />,
    );

    expect(html).toContain('Modo Obra');
    expect(html).toContain('Ancho del Mueble');
    expect(html).toContain('800');
    expect(html).toContain('mm');
    expect(html).toContain('Diestro');
    expect(html).toContain('Deslizar pulgar');
  });

  it('renders quick presets chips when provided', () => {
    const html = renderToString(
      <ThumbArcInput
        label="Profundidad"
        value={580}
        unit="mm"
        quickPresets={[400, 500, 580, 600]}
        onChange={vi.fn()}
      />,
    );

    expect(html).toContain('400 mm');
    expect(html).toContain('500 mm');
    expect(html).toContain('580 mm');
    expect(html).toContain('600 mm');
  });

  it('renders left-hand mode properly when specified', () => {
    const html = renderToString(
      <ThumbArcInput
        label="Alto del Mueble"
        value={750}
        handMode="left"
        onChange={vi.fn()}
      />,
    );

    expect(html).toContain('Zurdo');
  });

  it('provides stepper buttons with touch targets for accessibility', () => {
    const html = renderToString(
      <ThumbArcInput
        label="Espesor"
        value={18}
        step={1}
        coarseStep={10}
        onChange={vi.fn()}
      />,
    );

    expect(html).toContain('-10');
    expect(html).toContain('-1');
    expect(html).toContain('+1');
    expect(html).toContain('+10');
  });

  it('handles stepper clicks and preset clicks interactively', () => {
    const handleChange = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);

    const rootInstance = createRoot(container);
    act(() => {
      rootInstance.render(
        <ThumbArcInput
          label="Ancho"
          value={800}
          step={1}
          coarseStep={10}
          quickPresets={[600, 800, 900]}
          onChange={handleChange}
        />,
      );
    });

    // Click +10 button
    const plus10Btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '+10',
    );
    expect(plus10Btn).toBeDefined();
    act(() => {
      plus10Btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(handleChange).toHaveBeenCalledWith(810);

    // Click preset 600 button
    const presetBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '600 mm',
    );
    expect(presetBtn).toBeDefined();
    act(() => {
      presetBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(handleChange).toHaveBeenCalledWith(600);

    // Click hand toggle button
    const handBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Diestro'),
    );
    expect(handBtn).toBeDefined();
    act(() => {
      handBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('Zurdo');

    act(() => {
      rootInstance.unmount();
    });
    container.remove();
  });
});
