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
  restoreOnInvalid = false,
  onChange,
}: {
  initialValue?: number;
  min?: number;
  max?: number;
  step?: number;
  showStepper?: boolean;
  restoreOnInvalid?: boolean;
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
      restoreOnInvalid={restoreOnInvalid}
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

describe('NumericInput with restoreOnInvalid (Defect 1 Tests)', () => {
  it('case 1: clears the field and types 700 without corrupting model or emitting partial numbers below min', () => {
    const handleChange = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <TestControlledWrapper
          initialValue={600}
          min={200}
          max={3000}
          restoreOnInvalid={true}
          onChange={handleChange}
        />,
      );
    });

    const input = container.querySelector('input') as HTMLInputElement;
    expect(input.value).toBe('600');

    // 1. Clear the field -> allows empty draft without notifying model
    act(() => {
      input.focus();
      setInputValue(input, '');
    });
    expect(input.value).toBe('');
    expect(handleChange).not.toHaveBeenCalled();

    // 2. Type "7" -> below min (200), model is NOT called, field marks invalid
    act(() => {
      setInputValue(input, '7');
    });
    expect(input.value).toBe('7');
    expect(handleChange).not.toHaveBeenCalled();
    expect(input.classList.contains('numeric-input-field--invalid')).toBe(true);

    // 3. Type "70" -> still below min (200), model is NOT called
    act(() => {
      setInputValue(input, '70');
    });
    expect(input.value).toBe('70');
    expect(handleChange).not.toHaveBeenCalled();

    // 4. Type "700" -> valid in [200, 3000], updates model immediately
    act(() => {
      setInputValue(input, '700');
    });
    expect(input.value).toBe('700');
    expect(handleChange).toHaveBeenCalledWith(700);
    expect(input.classList.contains('numeric-input-field--invalid')).toBe(false);

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('case 2: empty value preserves model and restores last valid value on blur', () => {
    const handleChange = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <TestControlledWrapper
          initialValue={600}
          min={200}
          max={3000}
          restoreOnInvalid={true}
          onChange={handleChange}
        />,
      );
    });

    const input = container.querySelector('input') as HTMLInputElement;

    // Clear input
    act(() => {
      input.focus();
      setInputValue(input, '');
    });
    expect(input.value).toBe('');
    expect(handleChange).not.toHaveBeenCalled();

    // On blur, restores 600 without modifying model
    act(() => {
      input.blur();
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    });
    expect(input.value).toBe('600');
    expect(handleChange).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('case 3: "0", "-5" and "abc" keep model intact and restore on blur', () => {
    const handleChange = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <TestControlledWrapper
          initialValue={600}
          min={200}
          max={3000}
          restoreOnInvalid={true}
          onChange={handleChange}
        />,
      );
    });

    const input = container.querySelector('input') as HTMLInputElement;

    // Test "0"
    act(() => {
      input.focus();
      setInputValue(input, '0');
    });
    expect(handleChange).not.toHaveBeenCalled();
    act(() => {
      input.blur();
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    });
    expect(input.value).toBe('600');

    // Test "-5"
    act(() => {
      input.focus();
      setInputValue(input, '-5');
    });
    expect(handleChange).not.toHaveBeenCalled();
    act(() => {
      input.blur();
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    });
    expect(input.value).toBe('600');

    // Test "abc"
    act(() => {
      input.focus();
      setInputValue(input, 'abc');
    });
    expect(handleChange).not.toHaveBeenCalled();
    act(() => {
      input.blur();
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    });
    expect(input.value).toBe('600');
    expect(handleChange).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('case 4: value above maximum keeps model intact and restores on blur', () => {
    const handleChange = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <TestControlledWrapper
          initialValue={600}
          min={200}
          max={3000}
          restoreOnInvalid={true}
          onChange={handleChange}
        />,
      );
    });

    const input = container.querySelector('input') as HTMLInputElement;

    // Type 3500 (> 3000)
    act(() => {
      input.focus();
      setInputValue(input, '3500');
    });
    expect(input.value).toBe('3500');
    expect(handleChange).not.toHaveBeenCalled();
    expect(input.classList.contains('numeric-input-field--invalid')).toBe(true);

    // On blur, restores 600
    act(() => {
      input.blur();
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    });
    expect(input.value).toBe('600');
    expect(handleChange).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('case 5: value below minimum keeps model intact and restores on Enter key', () => {
    const handleChange = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <TestControlledWrapper
          initialValue={600}
          min={200}
          max={3000}
          restoreOnInvalid={true}
          onChange={handleChange}
        />,
      );
    });

    const input = container.querySelector('input') as HTMLInputElement;

    // Type 50 (< 200)
    act(() => {
      input.focus();
      setInputValue(input, '50');
    });
    expect(input.value).toBe('50');
    expect(handleChange).not.toHaveBeenCalled();
    expect(input.classList.contains('numeric-input-field--invalid')).toBe(true);

    // Press Enter -> restores 600
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      input.blur();
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    });
    expect(input.value).toBe('600');
    expect(handleChange).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('case 6: Escape key cancels invalid edit and restores last valid value', () => {
    const handleChange = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <TestControlledWrapper
          initialValue={600}
          min={200}
          max={3000}
          restoreOnInvalid={true}
          onChange={handleChange}
        />,
      );
    });

    const input = container.querySelector('input') as HTMLInputElement;

    act(() => {
      input.focus();
      setInputValue(input, '9999');
    });
    expect(input.value).toBe('9999');
    expect(handleChange).not.toHaveBeenCalled();

    // Press Escape
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(input.value).toBe('600');
    expect(handleChange).not.toHaveBeenCalled();

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
