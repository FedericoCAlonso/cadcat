import { act } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { DrawerTracksInput } from '../src/ui/DrawerTracksInput';
import type { TrackSize } from '../src/resolver';

// @ts-expect-error React act testing flag
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function setInputValue(input: HTMLInputElement, value: string): void {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;
  nativeSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('DrawerTracksInput Component', () => {
  it('renders initial formatted tracks correctly', () => {
    const tracks: TrackSize[] = [
      { type: 'fixed', valueMm: 140 },
      { type: 'fractional', valueFr: 1 },
      { type: 'fractional', valueFr: 1 },
    ];

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<DrawerTracksInput tracks={tracks} />);
    });

    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('140mm 1fr 1fr');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('allows free typing without reverting characters midway', () => {
    const tracks: TrackSize[] = [
      { type: 'fractional', valueFr: 1 },
      { type: 'fractional', valueFr: 1 },
    ];
    const onChange = vi.fn();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<DrawerTracksInput tracks={tracks} onChange={onChange} />);
    });

    const input = container.querySelector('input') as HTMLInputElement;

    act(() => {
      input.focus();
      input.dispatchEvent(new Event('focus', { bubbles: true }));
    });

    // User types "150m" (intermediate incomplete token)
    act(() => {
      setInputValue(input, '150m');
    });
    expect(input.value).toBe('150m');
    expect(container.textContent).toContain('Formato en edición');

    // User finishes typing "150mm 1fr 1fr"
    act(() => {
      setInputValue(input, '150mm 1fr 1fr');
    });
    expect(input.value).toBe('150mm 1fr 1fr');
    expect(container.textContent).not.toContain('Formato en edición');

    // onChange was triggered with the parsed tracks
    expect(onChange).toHaveBeenLastCalledWith([
      { type: 'fixed', valueMm: 150 },
      { type: 'fractional', valueFr: 1 },
      { type: 'fractional', valueFr: 1 },
    ]);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('reverts invalid input back to last valid state on blur', () => {
    const tracks: TrackSize[] = [
      { type: 'fractional', valueFr: 1 },
      { type: 'fractional', valueFr: 1 },
    ];
    const onChange = vi.fn();

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<DrawerTracksInput tracks={tracks} onChange={onChange} />);
    });

    const input = container.querySelector('input') as HTMLInputElement;

    act(() => {
      input.focus();
      input.dispatchEvent(new Event('focus', { bubbles: true }));
      setInputValue(input, 'texto_invalido');
    });
    expect(input.value).toBe('texto_invalido');

    act(() => {
      input.blur();
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    });

    // Should revert to original valid value
    expect(input.value).toBe('1fr 1fr');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('syncs with tracks prop changes when not focused', () => {
    const tracks1: TrackSize[] = [{ type: 'fractional', valueFr: 1 }];
    const tracks2: TrackSize[] = [
      { type: 'fixed', valueMm: 130 },
      { type: 'fractional', valueFr: 2 },
    ];

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<DrawerTracksInput tracks={tracks1} />);
    });

    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('1fr');

    act(() => {
      root.render(<DrawerTracksInput tracks={tracks2} />);
    });
    expect(input.value).toBe('130mm 2fr');

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
