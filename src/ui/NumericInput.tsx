import React, {
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type ReactElement,
  useEffect,
  useRef,
  useState,
} from 'react';

/**
 * Props for the NumericInput component.
 */
export interface NumericInputProps {
  /** Numeric value controlled by parent. */
  value: number | null | undefined;
  /** Callback fired when a valid numerical value is entered or adjusted. */
  onChange: (value: number) => void;
  /** Minimum allowable numeric value. */
  min?: number;
  /** Maximum allowable numeric value. */
  max?: number;
  /** Step increment for steppers and arrow keys. */
  step?: number;
  /** HTML input id. */
  id?: string;
  /** HTML input name. */
  name?: string;
  /** Optional additional CSS class. */
  className?: string;
  /** Optional inline styles. */
  style?: React.CSSProperties;
  /** Whether the input is disabled. */
  disabled?: boolean;
  /** Unit label string (e.g. 'mm'). */
  unit?: string;
  /** Whether to select all text when the input receives focus (default: true). */
  selectOnFocus?: boolean;
  /** Whether floating-point decimals are allowed (default: false). */
  allowDecimals?: boolean;
  /** Accessibility aria-label. */
  ariaLabel?: string;
  /** Whether to display M3 plus and minus stepper buttons. */
  showStepper?: boolean;
  /**
   * When true, keeps an editable draft buffer while editing, allows clearing,
   * updates the model only when the draft is within valid range, shows a red border
   * and range message while invalid, and restores the last valid value on blur, Enter, or Escape.
   */
  restoreOnInvalid?: boolean;
}

/**
 * High-ergonomics numeric input component with Argentine metric standards and M3 styling.
 * Supports draft editing buffer, auto-select on focus, range validation, and safe fallback.
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
  restoreOnInvalid = false,
}: NumericInputProps): ReactElement {
  const numericValue = typeof value === 'number' && !Number.isNaN(value) ? value : 0;
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [textBuffer, setTextBuffer] = useState<string>(String(numericValue));

  const isNumberValid = (num: number | null): boolean => {
    if (num === null || Number.isNaN(num) || !Number.isFinite(num)) return false;
    if (typeof min === 'number' && num < min) return false;
    if (typeof max === 'number' && num > max) return false;
    return true;
  };

  const lastValidValueRef = useRef<number>(
    isNumberValid(numericValue) ? numericValue : typeof min === 'number' ? min : 0,
  );

  // Sync external value when not focused
  useEffect(() => {
    if (!isFocused) {
      setTextBuffer(String(numericValue));
      if (isNumberValid(numericValue)) {
        lastValidValueRef.current = numericValue;
      }
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
        if (typeof target.select === 'function') {
          target.select();
        }
      }, 0);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const raw = e.target.value;
    setTextBuffer(raw);

    const parsed = parseNumber(raw);
    if (restoreOnInvalid) {
      // Only notify model if value is valid and within [min, max]
      if (isNumberValid(parsed) && parsed !== null) {
        lastValidValueRef.current = parsed;
        onChange(parsed);
      }
      // If not valid (empty, NaN, < min, > max), model is NOT updated
    } else {
      if (parsed !== null) {
        onChange(parsed);
      }
    }
  };

  const handleBlur = (): void => {
    setIsFocused(false);
    const parsed = parseNumber(textBuffer);

    if (restoreOnInvalid) {
      if (isNumberValid(parsed) && parsed !== null) {
        setTextBuffer(String(parsed));
      } else {
        // Restore last valid value
        setTextBuffer(String(lastValidValueRef.current));
      }
    } else {
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
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      if (restoreOnInvalid) {
        const parsed = parseNumber(textBuffer);
        if (!isNumberValid(parsed)) {
          setTextBuffer(String(lastValidValueRef.current));
        }
      }
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      if (restoreOnInvalid) {
        setTextBuffer(String(lastValidValueRef.current));
      }
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
    if (restoreOnInvalid) {
      if (isNumberValid(adjusted)) {
        lastValidValueRef.current = adjusted;
        onChange(adjusted);
      }
    } else {
      onChange(adjusted);
    }
  };

  const parsedCurrent = parseNumber(textBuffer);
  const isCurrentInvalid = restoreOnInvalid && isFocused && !isNumberValid(parsedCurrent);

  let rangeMessage = '';
  if (typeof min === 'number' && typeof max === 'number') {
    rangeMessage = `${min} a ${max} ${unit ?? 'mm'}`;
  } else if (typeof min === 'number') {
    rangeMessage = `Mín: ${min} ${unit ?? 'mm'}`;
  } else if (typeof max === 'number') {
    rangeMessage = `Máx: ${max} ${unit ?? 'mm'}`;
  }

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
      className={`numeric-input-field ${isCurrentInvalid ? 'numeric-input-field--invalid' : ''} ${className}`}
      style={style}
      onFocus={handleFocus}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );

  if (showStepper) {
    return (
      <div className="m3-stepper-field-wrapper" style={{ width: '100%' }}>
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
          <div className="numeric-input-field-container">
            {inputElement}
            {unit && <span className="numeric-input-unit-suffix">{unit}</span>}
          </div>
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
        {isCurrentInvalid && rangeMessage && (
          <span className="numeric-input-validation-msg" role="alert" title={`Rango permitido: ${rangeMessage}`}>
            {rangeMessage}
          </span>
        )}
      </div>
    );
  }

  if (unit) {
    return (
      <div className="numeric-input-with-unit-wrapper" style={{ width: '100%', position: 'relative' }}>
        <div className="numeric-input-field-container">
          {inputElement}
          <span className="numeric-input-unit-suffix">{unit}</span>
        </div>
        {isCurrentInvalid && rangeMessage && (
          <span className="numeric-input-validation-msg" role="alert" title={`Rango permitido: ${rangeMessage}`}>
            {rangeMessage}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="numeric-input-wrapper" style={{ width: '100%', position: 'relative' }}>
      {inputElement}
      {isCurrentInvalid && rangeMessage && (
        <span className="numeric-input-validation-msg" role="alert" title={`Rango permitido: ${rangeMessage}`}>
          {rangeMessage}
        </span>
      )}
    </div>
  );
}
