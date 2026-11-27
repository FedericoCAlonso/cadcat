import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export interface UseFocusTrapModalOptions {
  isOpen: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onClose?: () => void;
  /** Optional selector inside the container to focus on open (e.g. 'input'). */
  initialFocusSelector?: string;
}

/**
 * WCAG 2.1 AA modal focus management hook:
 * - Captures trigger element before focus shifts and restores focus on close.
 * - Traps Tab / Shift+Tab cycling within the modal container.
 * - Closes on Escape key press.
 */
export function useFocusTrapModal({
  isOpen,
  containerRef,
  onClose,
  initialFocusSelector,
}: UseFocusTrapModalOptions): void {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const container = containerRef.current;
    if (container) {
      const preferred = initialFocusSelector
        ? container.querySelector<HTMLElement>(initialFocusSelector)
        : null;
      const firstFocusable =
        preferred ?? container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? container;
      if (firstFocusable === container && !container.hasAttribute('tabindex')) {
        container.setAttribute('tabindex', '-1');
      }
      firstFocusable.focus({ preventScroll: true });
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (onCloseRef.current) {
          event.stopPropagation();
          onCloseRef.current();
        }
        return;
      }

      if (event.key !== 'Tab') return;
      const el = containerRef.current;
      if (!el) return;

      const focusables = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (node) => node.offsetParent !== null || node === document.activeElement,
      );

      if (focusables.length === 0) {
        event.preventDefault();
        el.focus();
        return;
      }

      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (!active || active === first || !el.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (!active || active === last || !el.contains(active)) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      const prev = previousFocusRef.current;
      if (prev && prev.isConnected) {
        prev.focus({ preventScroll: true });
      }
    };
  }, [isOpen, containerRef, initialFocusSelector]);
}
