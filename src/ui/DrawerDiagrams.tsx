import type { ReactElement } from 'react';

export interface DiagramProps {
  /** Optional additional CSS class. */
  className?: string;
}

/**
 * 40x40 SVG diagram for Standard Double-Front Drawer (Estándar Doble Frente).
 * Outer decorative front highlighted in primary color.
 */
export function DrawerTypeStandardDiagram({ className = '' }: DiagramProps): ReactElement {
  return (
    <svg
      className={`drawer-option-svg ${className}`}
      viewBox="0 0 40 40"
      width="40"
      height="40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Carcass sides */}
      <line x1="4" y1="4" x2="4" y2="36" />
      <line x1="36" y1="4" x2="36" y2="36" />
      {/* Drawer box body */}
      <rect x="9" y="10" width="22" height="20" rx="1" stroke="currentColor" opacity="0.6" />
      {/* Outer decorative front (highlighted in primary) */}
      <rect
        x="6"
        y="8"
        width="28"
        height="24"
        rx="1"
        stroke="var(--md-sys-color-primary, #00668b)"
        strokeWidth="2.2"
        fill="var(--md-sys-color-primary-container, #c2e8ff)"
        fillOpacity="0.3"
      />
      {/* Handle dot */}
      <circle cx="20" cy="20" r="1.5" fill="var(--md-sys-color-primary, #00668b)" stroke="none" />
    </svg>
  );
}

/**
 * 40x40 SVG diagram for Simple Interior Drawer (Simple Interior Placard).
 * Single front with top pull slot highlighted in primary color.
 */
export function DrawerTypeSimpleInteriorDiagram({ className = '' }: DiagramProps): ReactElement {
  return (
    <svg
      className={`drawer-option-svg ${className}`}
      viewBox="0 0 40 40"
      width="40"
      height="40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Carcass sides */}
      <line x1="4" y1="4" x2="4" y2="36" />
      <line x1="36" y1="4" x2="36" y2="36" />
      {/* Single integrated box with lower side / top pull notch */}
      <path
        d="M 9 16 L 9 32 L 31 32 L 31 16 L 25 16 C 25 19 15 19 15 16 Z"
        stroke="var(--md-sys-color-primary, #00668b)"
        strokeWidth="2"
        fill="var(--md-sys-color-primary-container, #c2e8ff)"
        fillOpacity="0.3"
      />
      {/* Top arrow indicating pull gap */}
      <path
        d="M 20 8 L 20 13 M 18 11 L 20 13 L 22 11"
        stroke="var(--md-sys-color-primary, #00668b)"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/**
 * 40x40 SVG diagram for Grooved Bottom Mount (Fondo Ranurado).
 * Lateral groove and bottom panel highlighted in primary.
 */
export function DrawerBottomGroovedDiagram({ className = '' }: DiagramProps): ReactElement {
  return (
    <svg
      className={`drawer-option-svg ${className}`}
      viewBox="0 0 40 40"
      width="40"
      height="40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Drawer box sides with groove slot */}
      <path d="M 6 6 L 6 34 L 11 34 L 11 28 L 9 28 L 9 24 L 11 24 L 11 6 Z" stroke="currentColor" />
      <path d="M 34 6 L 34 34 L 29 34 L 29 28 L 31 28 L 31 24 L 29 24 L 29 6 Z" stroke="currentColor" />
      {/* Bottom plate sliding into groove (highlighted) */}
      <rect
        x="9"
        y="24"
        width="22"
        height="4"
        stroke="var(--md-sys-color-primary, #00668b)"
        strokeWidth="2"
        fill="var(--md-sys-color-primary-container, #c2e8ff)"
        fillOpacity="0.5"
      />
    </svg>
  );
}

/**
 * 40x40 SVG diagram for Bottom-Screwed Mount (Fondo Atornillado por debajo).
 * Bottom plate fixed underneath highlighted in primary.
 */
export function DrawerBottomScrewedDiagram({ className = '' }: DiagramProps): ReactElement {
  return (
    <svg
      className={`drawer-option-svg ${className}`}
      viewBox="0 0 40 40"
      width="40"
      height="40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Drawer box sides sitting on bottom */}
      <rect x="7" y="6" width="5" height="22" stroke="currentColor" />
      <rect x="28" y="6" width="5" height="22" stroke="currentColor" />
      {/* Bottom plate underneath (highlighted in primary) */}
      <rect
        x="6"
        y="28"
        width="28"
        height="4"
        stroke="var(--md-sys-color-primary, #00668b)"
        strokeWidth="2"
        fill="var(--md-sys-color-primary-container, #c2e8ff)"
        fillOpacity="0.5"
      />
      {/* Screw marks */}
      <line x1="9.5" y1="34" x2="9.5" y2="28" stroke="var(--md-sys-color-primary, #00668b)" strokeWidth="1.5" />
      <line x1="30.5" y1="34" x2="30.5" y2="28" stroke="var(--md-sys-color-primary, #00668b)" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * 40x40 SVG diagram for Thick Flush Bottom (Fondo Grueso Embutido 15/18mm).
 * Thick bottom panel flush between sides highlighted in primary.
 */
export function DrawerBottomFlushThickDiagram({ className = '' }: DiagramProps): ReactElement {
  return (
    <svg
      className={`drawer-option-svg ${className}`}
      viewBox="0 0 40 40"
      width="40"
      height="40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Drawer box sides */}
      <rect x="6" y="6" width="5" height="28" stroke="currentColor" />
      <rect x="29" y="6" width="5" height="28" stroke="currentColor" />
      {/* Thick bottom panel flush inside (highlighted in primary) */}
      <rect
        x="11"
        y="24"
        width="18"
        height="10"
        stroke="var(--md-sys-color-primary, #00668b)"
        strokeWidth="2"
        fill="var(--md-sys-color-primary-container, #c2e8ff)"
        fillOpacity="0.5"
      />
    </svg>
  );
}

/**
 * 40x40 SVG diagram for Applied (Overlaid) Front (Frente Aplicado / Solapado).
 * Front overlapping carcass edge highlighted in primary.
 */
export function DrawerFrontAppliedDiagram({ className = '' }: DiagramProps): ReactElement {
  return (
    <svg
      className={`drawer-option-svg ${className}`}
      viewBox="0 0 40 40"
      width="40"
      height="40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Carcass edge profile */}
      <line x1="4" y1="6" x2="14" y2="6" stroke="currentColor" />
      <line x1="14" y1="6" x2="14" y2="34" stroke="currentColor" />
      <line x1="4" y1="34" x2="14" y2="34" stroke="currentColor" />
      {/* Drawer front overlapping the edge (highlighted) */}
      <rect
        x="14"
        y="4"
        width="6"
        height="32"
        rx="1"
        stroke="var(--md-sys-color-primary, #00668b)"
        strokeWidth="2"
        fill="var(--md-sys-color-primary-container, #c2e8ff)"
        fillOpacity="0.5"
      />
      {/* Arrow indicating overlay */}
      <path d="M 23 20 L 29 20 M 26 17 L 23 20 L 26 23" stroke="currentColor" opacity="0.6" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * 40x40 SVG diagram for Inset Front (Frente Embutido).
 * Front flush between carcass edges highlighted in primary.
 */
export function DrawerFrontInsetDiagram({ className = '' }: DiagramProps): ReactElement {
  return (
    <svg
      className={`drawer-option-svg ${className}`}
      viewBox="0 0 40 40"
      width="40"
      height="40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Carcass edge projecting forward */}
      <line x1="4" y1="4" x2="22" y2="4" stroke="currentColor" />
      <line x1="22" y1="4" x2="22" y2="36" stroke="currentColor" />
      <line x1="4" y1="36" x2="22" y2="36" stroke="currentColor" />
      {/* Inset front flush with carcass face */}
      <rect
        x="10"
        y="10"
        width="6"
        height="20"
        rx="1"
        stroke="var(--md-sys-color-primary, #00668b)"
        strokeWidth="2"
        fill="var(--md-sys-color-primary-container, #c2e8ff)"
        fillOpacity="0.5"
      />
      <line x1="22" y1="10" x2="22" y2="30" stroke="currentColor" strokeDasharray="2 2" opacity="0.6" />
    </svg>
  );
}

/**
 * 40x40 SVG diagram for Horizontal Transoms (Fajas Separadoras entre cajones).
 * Transom divider between fronts highlighted in primary.
 */
export function DrawerTransomsWithDividerDiagram({ className = '' }: DiagramProps): ReactElement {
  return (
    <svg
      className={`drawer-option-svg ${className}`}
      viewBox="0 0 40 40"
      width="40"
      height="40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Upper and lower fronts */}
      <rect x="6" y="5" width="28" height="11" rx="1" stroke="currentColor" opacity="0.7" />
      <rect x="6" y="24" width="28" height="11" rx="1" stroke="currentColor" opacity="0.7" />
      {/* Structural transom divider in between (highlighted in primary) */}
      <rect
        x="4"
        y="18"
        width="32"
        height="4"
        rx="0.5"
        stroke="var(--md-sys-color-primary, #00668b)"
        strokeWidth="2"
        fill="var(--md-sys-color-primary-container, #c2e8ff)"
        fillOpacity="0.5"
      />
    </svg>
  );
}

/**
 * 40x40 SVG diagram for Continuous Fronts without Transom (Sin Fajas / Frente Corrido).
 * Thin air gap between fronts highlighted in primary.
 */
export function DrawerTransomsContinuousDiagram({ className = '' }: DiagramProps): ReactElement {
  return (
    <svg
      className={`drawer-option-svg ${className}`}
      viewBox="0 0 40 40"
      width="40"
      height="40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Upper and lower fronts separated only by air gap */}
      <rect x="6" y="6" width="28" height="13" rx="1" stroke="currentColor" opacity="0.8" />
      <rect x="6" y="21" width="28" height="13" rx="1" stroke="currentColor" opacity="0.8" />
      {/* Continuous gap line highlighted */}
      <line
        x1="4"
        y1="20"
        x2="36"
        y2="20"
        stroke="var(--md-sys-color-primary, #00668b)"
        strokeWidth="2"
        strokeDasharray="4 2"
      />
    </svg>
  );
}

/**
 * 40x40 SVG diagram for Telescopic Lateral Slides (Correderas Telescópicas).
 * Lateral side runners highlighted in primary.
 */
export function DrawerSlideTelescopicDiagram({ className = '' }: DiagramProps): ReactElement {
  return (
    <svg
      className={`drawer-option-svg ${className}`}
      viewBox="0 0 40 40"
      width="40"
      height="40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Carcass lateral sides */}
      <line x1="4" y1="4" x2="4" y2="36" stroke="currentColor" />
      <line x1="36" y1="4" x2="36" y2="36" stroke="currentColor" />
      {/* Drawer box body */}
      <rect x="11" y="8" width="18" height="24" rx="1" stroke="currentColor" opacity="0.6" />
      {/* Lateral telescopic slides (highlighted in primary) */}
      <rect
        x="5"
        y="17"
        width="5"
        height="6"
        stroke="var(--md-sys-color-primary, #00668b)"
        strokeWidth="1.8"
        fill="var(--md-sys-color-primary-container, #c2e8ff)"
      />
      <rect
        x="30"
        y="17"
        width="5"
        height="6"
        stroke="var(--md-sys-color-primary, #00668b)"
        strokeWidth="1.8"
        fill="var(--md-sys-color-primary-container, #c2e8ff)"
      />
    </svg>
  );
}

/**
 * 40x40 SVG diagram for Undermount Concealed Slides (Correderas Ocultas Bajo Fondo).
 * Undermount runners beneath drawer bottom highlighted in primary.
 */
export function DrawerSlideUndermountDiagram({ className = '' }: DiagramProps): ReactElement {
  return (
    <svg
      className={`drawer-option-svg ${className}`}
      viewBox="0 0 40 40"
      width="40"
      height="40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* Carcass lateral sides */}
      <line x1="4" y1="4" x2="4" y2="36" stroke="currentColor" />
      <line x1="36" y1="4" x2="36" y2="36" stroke="currentColor" />
      {/* Drawer box body */}
      <rect x="8" y="6" width="24" height="22" rx="1" stroke="currentColor" opacity="0.6" />
      {/* Undermount concealed slides under the bottom (highlighted in primary) */}
      <rect
        x="8"
        y="29"
        width="8"
        height="5"
        rx="0.5"
        stroke="var(--md-sys-color-primary, #00668b)"
        strokeWidth="1.8"
        fill="var(--md-sys-color-primary-container, #c2e8ff)"
      />
      <rect
        x="24"
        y="29"
        width="8"
        height="5"
        rx="0.5"
        stroke="var(--md-sys-color-primary, #00668b)"
        strokeWidth="1.8"
        fill="var(--md-sys-color-primary-container, #c2e8ff)"
      />
    </svg>
  );
}
