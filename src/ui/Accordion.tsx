import { type ReactElement, type ReactNode } from 'react';

/**
 * Props for the Accordion component.
 */
export interface AccordionProps {
  /** Unique identifier for DOM and accessibility IDs. */
  id: string;
  /** Section icon or emoji to display before the title. */
  icon?: string;
  /** Primary title of the section. */
  title: string;
  /** Dynamic contextual summary shown in the header (e.g. "Cajones · 4", "600×720×560 mm"). */
  summary?: string;
  /** Whether this accordion panel is currently open/expanded. */
  isOpen: boolean;
  /** Callback fired when the user clicks or activates the accordion header. */
  onToggle: () => void;
  /** Child content rendered inside the accordion body. */
  children: ReactNode;
}

/**
 * Material Design 3 Accordion component.
 * Provides an accessible collapsible section with touch-friendly header and dynamic summary.
 */
export function Accordion({
  id,
  icon,
  title,
  summary,
  isOpen,
  onToggle,
  children,
}: AccordionProps): ReactElement {
  const headerId = `accordion-header-${id}`;
  const panelId = `accordion-panel-${id}`;

  return (
    <div
      className={`m3-accordion ${isOpen ? 'm3-accordion--open' : 'm3-accordion--closed'}`}
      id={`accordion-section-${id}`}
    >
      <button
        type="button"
        id={headerId}
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
        className="m3-accordion-header"
      >
        <div className="m3-accordion-header-left">
          {icon && <span className="m3-accordion-icon" aria-hidden="true">{icon}</span>}
          <span className="m3-accordion-title">{title}</span>
          {summary && (
            <span className="m3-accordion-summary" title={summary}>
              {summary}
            </span>
          )}
        </div>
        <span
          className={`m3-accordion-chevron ${isOpen ? 'm3-accordion-chevron--rotated' : ''}`}
          aria-hidden="true"
        >
          ▾
        </span>
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        className="m3-accordion-body"
        hidden={!isOpen}
        style={{ display: isOpen ? 'block' : 'none' }}
      >
        {children}
      </div>
    </div>
  );
}
