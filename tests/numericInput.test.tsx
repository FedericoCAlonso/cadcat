import { act, useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { NumericInput } from '../src/ui/NumericInput';

function setInputValue(input: HTMLInputElement, value: string): void {
  const nativeSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;
  nativeSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function TestControlledWrapper({
  initialValue = 150,
  min,
  max,
  step = 1,
  showStepper = false,
  onChange,
}: {
  initialValue?: number;
  min?: number;
  max?: number;
  step?: number;
  showStepper?: boolean;
  onChange?: (val: number) => void;
}) {
  const [val, setVal] = useState<number>(initialValue);
  return (
    <NumericInput
      value={val}
      min={min}
      max={max}
      step={step}
      showStepper={showStepper}
      onChange={(newVal) => {
        setVal(newVal);
        onChange?.(newVal);
      }}
    />
  );
}

describe('NumericInput Component Ergonomics (Punto 3)', () => {
  it('renders with initial numeric value and allows clearing text to empty without bouncing', () => {
    const handleChange = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<TestControlledWrapper initialValue={150} onChange={handleChange} />);
    });

    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('150');

    // Simulate user typing: clearing input completely
    act(() => {
      input.focus();
      setInputValue(input, '');
    });

    expect(input.value).toBe('');
    expect(handleChange).not.toHaveBeenCalled();

    // Blur resets to 0 and notifies parent
    act(() => {
      input.blur();
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    });

    expect(input.value).toBe('0');
    expect(handleChange).toHaveBeenCalledWith(0);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('resets to min on blur when min > 0', () => {
    const handleChange = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<TestControlledWrapper initialValue={200} min={50} onChange={handleChange} />);
    });

    const input = container.querySelector('input') as HTMLInputElement;

    act(() => {
      input.focus();
      setInputValue(input, '');
    });

    act(() => {
      input.blur();
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    });

    expect(input.value).toBe('50');
    expect(handleChange).toHaveBeenCalledWith(50);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('clamps to max on blur if user typed larger value', () => {
    const handleChange = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<TestControlledWrapper initialValue={200} max={300} onChange={handleChange} />);
    });

    const input = container.querySelector('input') as HTMLInputElement;

    act(() => {
      input.focus();
      setInputValue(input, '550');
    });

    act(() => {
      input.blur();
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    });

    expect(input.value).toBe('300');
    expect(handleChange).toHaveBeenCalledWith(300);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('adjusts value with stepper buttons when showStepper is true', () => {
    const handleChange = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<TestControlledWrapper initialValue={100} step={10} showStepper={true} onChange={handleChange} />);
    });

    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    const decBtn = buttons[0]!;
    const incBtn = buttons[1]!;

    act(() => {
      incBtn.click();
    });
    expect(handleChange).toHaveBeenCalledWith(110);

    act(() => {
      decBtn.click();
    });
    expect(handleChange).toHaveBeenCalledWith(100);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
