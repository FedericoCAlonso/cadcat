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

  it('does not capture movement when pointer down occurs outside the arc track', () => {
    const handleChange = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);

    const rootInstance = createRoot(container);
    act(() => {
      rootInstance.render(
        <ThumbArcInput
          label="Ancho"
          value={800}
          onChange={handleChange}
        />,
      );
    });

    const arcDiv = container.querySelector('div[style*="height: 260px"]') as HTMLDivElement;
    expect(arcDiv).toBeDefined();

    vi.spyOn(arcDiv, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 360,
      height: 270,
      right: 360,
      bottom: 270,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    const setPointerCaptureSpy = vi.fn();
    arcDiv.setPointerCapture = setPointerCaptureSpy;

    // Pointer down at center (180, 200) - far away from arc
    act(() => {
      const downEvent = new MouseEvent('pointerdown', { bubbles: true, clientX: 180, clientY: 200 }) as unknown as PointerEvent;
      Object.defineProperty(downEvent, 'pointerId', { value: 1 });
      arcDiv.dispatchEvent(downEvent);
    });

    // setPointerCapture must NOT be called for touches outside the arc
    expect(setPointerCaptureSpy).not.toHaveBeenCalled();

    // Pointer down directly on arc track: (185.5, 95.5)
    act(() => {
      const downEvent = new MouseEvent('pointerdown', { bubbles: true, clientX: 185.5, clientY: 95.5 }) as unknown as PointerEvent;
      Object.defineProperty(downEvent, 'pointerId', { value: 2 });
      arcDiv.dispatchEvent(downEvent);
    });

    // setPointerCapture MUST be called for touch on the arc
    expect(setPointerCaptureSpy).toHaveBeenCalledWith(2);

    act(() => {
      rootInstance.unmount();
    });
    container.remove();
  });

  it('renders in compact mode with reduced vertical footprint and hidden redundant header', () => {
    const html = renderToString(
      <ThumbArcInput
        label="Ancho Compacto"
        value={600}
        compact={true}
        onChange={vi.fn()}
      />,
    );

    // Redundant header and hand mode switch should be hidden in compact mode
    expect(html).not.toContain('🏗️ Modo Obra');
    expect(html).not.toContain('🖐️ Diestro');

    // Value and arc should still render cleanly
    expect(html).toContain('600');
    expect(html).toContain('height:230px');
    expect(html).toContain('viewBox="0 0 360 240"');
  });

  it('configures touch-action: none and isolates touch events from parent with stopPropagation', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const rootInstance = createRoot(container);
    act(() => {
      rootInstance.render(
        <ThumbArcInput
          label="Ancho"
          value={800}
          onChange={vi.fn()}
        />,
      );
    });

    const arcDiv = container.querySelector('.thumb-arc-track') as HTMLDivElement;
    expect(arcDiv).toBeDefined();
    expect(arcDiv.style.touchAction).toBe('none');

    // Verify touch events call stopPropagation to isolate from dimension carousel swipe
    let startPropagationStopped = false;
    let movePropagationStopped = false;

    const touchStartEvent = new Event('touchstart', { bubbles: true });
    touchStartEvent.stopPropagation = () => {
      startPropagationStopped = true;
    };
    arcDiv.dispatchEvent(touchStartEvent);
    expect(startPropagationStopped).toBe(true);

    const touchMoveEvent = new Event('touchmove', { bubbles: true });
    touchMoveEvent.stopPropagation = () => {
      movePropagationStopped = true;
    };
    arcDiv.dispatchEvent(touchMoveEvent);
    expect(movePropagationStopped).toBe(true);

    act(() => {
      rootInstance.unmount();
    });
    container.remove();
  });

  it('omits the SVG radial arc track when showArc is false and renders tactile steppers with extraCoarseStep', () => {
    const handleChange = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);

    const rootInstance = createRoot(container);
    act(() => {
      rootInstance.render(
        <ThumbArcInput
          label="Ancho Taller"
          value={800}
          compact={true}
          showArc={false}
          step={1}
          coarseStep={10}
          extraCoarseStep={50}
          quickPresets={[400, 600, 800, 1000]}
          onChange={handleChange}
        />,
      );
    });

    // Arc track must NOT exist in DOM
    const arcDiv = container.querySelector('.thumb-arc-track');
    expect(arcDiv).toBeNull();

    // Value display and presets must exist
    expect(container.textContent).toContain('800');
    expect(container.textContent).toContain('600 mm');

    // Steppers must contain 6 discrete buttons: -50, -10, -1, +1, +10, +50
    expect(container.textContent).toContain('-50');
    expect(container.textContent).toContain('-10');
    expect(container.textContent).toContain('-1');
    expect(container.textContent).toContain('+1');
    expect(container.textContent).toContain('+10');
    expect(container.textContent).toContain('+50');

    // Click +50 button
    const plus50Btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '+50',
    );
    expect(plus50Btn).toBeDefined();
    act(() => {
      plus50Btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(handleChange).toHaveBeenCalledWith(850);

    // Click -50 button
    const minus50Btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '-50',
    );
    expect(minus50Btn).toBeDefined();
    act(() => {
      minus50Btn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(handleChange).toHaveBeenCalledWith(750);

    act(() => {
      rootInstance.unmount();
    });
    container.remove();
  });

  it('supports arcOnly numeric mode with upper-half (+1) and lower-half (-1) arc taps and no external stepper buttons', () => {
    const handleChange = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);

    const rootInstance = createRoot(container);
    act(() => {
      rootInstance.render(
        <ThumbArcInput
          label="Ancho Total"
          value={800}
          arcOnly={true}
          step={1}
          coarseStep={10}
          extraCoarseStep={50}
          onChange={handleChange}
        />,
      );
    });

    // Radial arc track MUST exist in arcOnly mode
    const arcDiv = container.querySelector('.thumb-arc-track');
    expect(arcDiv).not.toBeNull();

    // External coarse stepper buttons (-50, +50, -10, +10) must NOT exist
    expect(container.textContent).not.toContain('-50');
    expect(container.textContent).not.toContain('+50');
    expect(container.textContent).not.toContain('-10');
    expect(container.textContent).not.toContain('+10');

    // Tap upper half (+1)
    const upperTapBtn = container.querySelector('button[data-arc-tap="upper"]');
    expect(upperTapBtn).not.toBeNull();
    act(() => {
      upperTapBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(handleChange).toHaveBeenCalledWith(801);

    // Tap lower half (-1)
    const lowerTapBtn = container.querySelector('button[data-arc-tap="lower"]');
    expect(lowerTapBtn).not.toBeNull();
    act(() => {
      lowerTapBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(handleChange).toHaveBeenCalledWith(799);

    act(() => {
      rootInstance.unmount();
    });
    container.remove();
  });

  it('supports arcOnly discrete options mode, advancing/stepping back via upper/lower arc taps', () => {
    const handleSelectOption = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);

    const options = [
      { id: 'inset', label: 'Interior (Entre Laterales)', sublabel: 'Laterales de piso a techo' },
      { id: 'overlay', label: 'Pasante (Piso / Sombrero)', sublabel: 'Laterales apoyan sobre base' },
    ];

    const rootInstance = createRoot(container);
    act(() => {
      rootInstance.render(
        <ThumbArcInput
          label="Unión de Base"
          value={0}
          arcOnly={true}
          options={options}
          selectedOptionId="inset"
          onSelectOption={handleSelectOption}
          onChange={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Interior (Entre Laterales)');
    expect(container.textContent).toContain('Opción 1 de 2');

    // Tap upper half -> advances to 'overlay'
    const upperTapBtn = container.querySelector('button[data-arc-tap="upper"]');
    expect(upperTapBtn).not.toBeNull();
    act(() => {
      upperTapBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(handleSelectOption).toHaveBeenCalledWith('overlay');

    // Verify full-width readout banner is rendered OUTSIDE .thumb-arc-track and spans 100% width
    const readoutBanner = container.querySelector('[data-arc-readout="full-width-banner"]') as HTMLElement;
    const arcTrack = container.querySelector('.thumb-arc-track') as HTMLElement;
    expect(readoutBanner).not.toBeNull();
    expect(arcTrack).not.toBeNull();
    expect(readoutBanner.style.width).toBe('100%');
    // The readout banner must NOT be inside the slider track zone
    expect(arcTrack.contains(readoutBanner)).toBe(false);

    act(() => {
      rootInstance.unmount();
    });
    container.remove();
  });
});
