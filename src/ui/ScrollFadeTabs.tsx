import { useRef, useEffect, useState, type ReactElement } from 'react';

/**
 * Tab item descriptor for the scroll fade tab bar.
 */
export interface TabItem<T extends string = string> {
  /** Unique section identifier. */
  id: T;
  /** Human-readable section label. */
  label: string;
  /** Section icon or emoji. */
  icon: string;
}

/**
 * Props for the ScrollFadeTabs component.
 */
export interface ScrollFadeTabsProps<T extends string = string> {
  /** Array of section tabs to display. */
  tabs: Array<TabItem<T>>;
  /** Currently active section ID. */
  activeTabId: T | null;
  /** Callback fired when a tab is selected (anchors to accordion). */
  onSelectTab: (tabId: T) => void;
  /** Whether all accordions are currently expanded. */
  isAllExpanded?: boolean;
  /** Callback to toggle between expanding all and collapsing all accordions. */
  onToggleAll?: () => void;
}

/**
 * Sticky horizontal tabs with edge fade gradients and smooth anchor scrolling.
 * Provides quick access to all module sections without losing vertical context.
 */
export function ScrollFadeTabs<T extends string = string>({
  tabs,
  activeTabId,
  onSelectTab,
  isAllExpanded = false,
  onToggleAll,
}: ScrollFadeTabsProps<T>): ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const hasScroll = el.scrollWidth > el.clientWidth;
    setCanScrollLeft(hasScroll && el.scrollLeft > 4);
    setCanScrollRight(hasScroll && el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [tabs]);

  const handleTabClick = (tabId: T) => {
    onSelectTab(tabId);
    // Anchor scroll to corresponding accordion section
    if (typeof document !== 'undefined') {
      const target = document.getElementById(`accordion-section-${tabId}`);
      if (target && typeof target.scrollIntoView === 'function') {
        try {
          target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch {
          // JSDOM or environments without full scrollIntoView support
        }
      }
    }
  };

  return (
    <nav
      aria-label="Navegación de secciones de configuración"
      className="scroll-fade-tabs-container"
    >
      <div
        className={`scroll-fade-tabs-wrapper ${canScrollLeft ? 'fade-left' : ''} ${canScrollRight ? 'fade-right' : ''}`}
      >
        <div ref={scrollRef} className="scroll-fade-tabs-list">
          {tabs.map((tab) => {
            const isActive = activeTabId === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`scroll-fade-tab ${isActive ? 'scroll-fade-tab--active' : ''}`}
                onClick={() => handleTabClick(tab.id)}
                aria-current={isActive ? 'true' : undefined}
              >
                <span className="scroll-fade-tab__icon" aria-hidden="true">{tab.icon}</span>
                <span className="scroll-fade-tab__label">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {onToggleAll && (
        <button
          type="button"
          onClick={onToggleAll}
          className="scroll-fade-toggle-all-btn"
          title={isAllExpanded ? 'Contraer todas las secciones' : 'Abrir todas las secciones'}
          aria-label={isAllExpanded ? 'Contraer todo' : 'Abrir todo'}
        >
          <span aria-hidden="true">{isAllExpanded ? '▲' : '▼'}</span>
          <span>{isAllExpanded ? 'Contraer' : 'Abrir todo'}</span>
        </button>
      )}
    </nav>
  );
}
