import type { ReactElement, ReactNode } from 'react';

export interface M3ToggleRowProps {
  /** Optional input id linking label and switch control. */
  id?: string;
  /** Primary option label displayed on the left. */
  label: ReactNode;
  /** Optional helper description shown under the label. */
  description?: ReactNode;
  /** Controlled checked state. */
  checked: boolean;
  /** Invoked when the user toggles the switch. */
  onChange: (checked: boolean) => void;
  /** Disables interaction when true. */
  disabled?: boolean;
  /** Uses tighter padding/sizing for inline toolbars or 2x2 grids while keeping text-left/control-right order. */
  compact?: boolean;
  /** Optional extra CSS class on the outer label row. */
  className?: string;
  /** Optional accessible label override for screen readers. */
  ariaLabel?: string;
}

/**
 * Material Design 3 aligned settings toggle row: label/description on the left,
 * switch control flush-aligned on the right.
 */
export function M3ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
  disabled = false,
  compact = false,
  className,
  ariaLabel,
}: M3ToggleRowProps): ReactElement {
  const rowClasses = [
    'm3-toggle-row',
    compact ? 'm3-toggle-row--compact' : '',
    disabled ? 'is-disabled' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <label htmlFor={id} className={rowClasses}>
      <span className="m3-toggle-row__text">
        <span className="m3-toggle-row__label">{label}</span>
        {description && <span className="m3-toggle-row__hint">{description}</span>}
      </span>
      <span className="m3-switch">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          aria-label={ariaLabel}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="m3-switch__track" aria-hidden="true">
          <span className="m3-switch__thumb" />
        </span>
      </span>
    </label>
  );
}
