import React, {
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type ReactElement,
  useEffect,
  useState,
} from 'react';

export interface NumericInputProps {
  value: number | null | undefined;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  id?: string;
  name?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  unit?: string;
  selectOnFocus?: boolean;
  allowDecimals?: boolean;
  ariaLabel?: string;
  showStepper?: boolean;
}

/**
 * High-ergonomics numeric input component.
 * Allows fully clearing the field while typing without bouncing or locking the cursor.
 * When left empty, safely falls back to 0 (or min).
 * Automatically selects all text on focus for effortless overwriting.
 */
export function NumericInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  id,
  name,
  className = '',
  style,
  disabled = false,
  unit,
  selectOnFocus = true,
  allowDecimals = false,
  ariaLabel,
  showStepper = false,
}: NumericInputProps): ReactElement {
  const numericValue = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [textBuffer, setTextBuffer] = useState<string>(String(numericValue));

  // Sync external value when not focused
  useEffect(() => {
    if (!isFocused) {
      setTextBuffer(String(numericValue));
    }
  }, [numericValue, isFocused]);

  const parseNumber = (text: string): number | null => {
    const trimmed = text.trim();
    if (trimmed === '' || trimmed === '-') return null;
    const num = allowDecimals ? Number.parseFloat(trimmed) : Number.parseInt(trimmed, 10);
    return Number.isNaN(num) ? null : num;
  };

  const clampValue = (val: number): number => {
    let result = val;
    if (typeof min === 'number' && result < min) {
      result = min;
    }
    if (typeof max === 'number' && result > max) {
      result = max;
    }
    return result;
  };

  const handleFocus = (e: FocusEvent<HTMLInputElement>): void => {
    setIsFocused(true);
    if (selectOnFocus) {
      // Small timeout ensures selection works reliably across browsers
      const target = e.currentTarget;
      setTimeout(() => {
        target.select();
      }, 0);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const raw = e.target.value;
    setTextBuffer(raw);

    const parsed = parseNumber(raw);
    if (parsed !== null) {
      // Notify parent of valid numerical changes while typing
      onChange(parsed);
    }
  };

  const handleBlur = (): void => {
    setIsFocused(false);
    const parsed = parseNumber(textBuffer);

    if (parsed === null) {
      // Empty or invalid string resets to 0 (or min if min > 0)
      const fallback = typeof min === 'number' && min > 0 ? min : 0;
      setTextBuffer(String(fallback));
      onChange(fallback);
    } else {
      const clamped = clampValue(parsed);
      setTextBuffer(String(clamped));
      if (clamped !== parsed) {
        onChange(clamped);
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleAdjust(step);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleAdjust(-step);
    }
  };

  const handleAdjust = (delta: number): void => {
    const current = parseNumber(textBuffer) ?? numericValue;
    const adjusted = clampValue(current + delta);
    setTextBuffer(String(adjusted));
    onChange(adjusted);
  };

  const inputElement = (
    <input
      id={id}
      name={name}
      type="number"
      min={min}
      max={max}
      step={step}
      value={textBuffer}
      disabled={disabled}
      aria-label={ariaLabel}
      className={`numeric-input-field ${className}`}
      style={style}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );

  if (showStepper) {
    return (
      <div className="m3-stepper-field">
        <button
          type="button"
          className="m3-stepper-btn"
          disabled={disabled || (typeof min === 'number' && numericValue <= min)}
          aria-label={`Disminuir ${step} ${unit ?? ''}`}
          onClick={() => handleAdjust(-step)}
        >
          −
        </button>
        {inputElement}
        {unit && <span className="numeric-input-unit">{unit}</span>}
        <button
          type="button"
          className="m3-stepper-btn"
          disabled={disabled || (typeof max === 'number' && numericValue >= max)}
          aria-label={`Aumentar ${step} ${unit ?? ''}`}
          onClick={() => handleAdjust(step)}
        >
          +
        </button>
      </div>
    );
  }

  if (unit) {
    return (
      <div className="numeric-input-with-unit" style={{ display: 'inline-flex', alignItems: 'center' }}>
        {inputElement}
        <span className="numeric-input-unit" style={{ paddingLeft: '0.4rem', fontSize: '0.82rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
          {unit}
        </span>
      </div>
    );
  }

  return inputElement;
}
