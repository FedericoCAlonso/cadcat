import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isOneHandMobileDevice,
  ONE_HAND_MOBILE_MAX_WIDTH_PX,
} from '../src/ui/useOneHandDevice';

describe('One-Hand Mobile Phone Detection (isOneHandMobileDevice)', () => {
  const originalInnerWidth = window.innerWidth;
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  afterEach(() => {
    window.innerWidth = originalInnerWidth;
    window.matchMedia = originalMatchMedia;
  });

  it('strictly excludes desktop screen widths (e.g. 1024px, 1440px, 1920px)', () => {
    window.innerWidth = 1440;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('pointer: fine'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    expect(isOneHandMobileDevice()).toBe(false);
  });

  it('strictly excludes tablets (e.g. iPad, Galaxy Tab starting at 768px)', () => {
    window.innerWidth = 768; // Standard tablet width in portrait
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('pointer: coarse'), // Touch screen tablet
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    expect(isOneHandMobileDevice()).toBe(false);
  });

  it('excludes desktop mouse users who shrink browser window below 600px', () => {
    window.innerWidth = 500;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('pointer: fine'), // Mouse pointer
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    expect(isOneHandMobileDevice()).toBe(false);
  });

  it('identifies handheld mobile phones with touch screens (width <= 600px and pointer: coarse)', () => {
    window.innerWidth = 390; // iPhone / Android phone standard width
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('pointer: coarse'), // Finger touch
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    expect(isOneHandMobileDevice()).toBe(true);
  });

  it('respects ONE_HAND_MOBILE_MAX_WIDTH_PX constant as 600px boundary', () => {
    expect(ONE_HAND_MOBILE_MAX_WIDTH_PX).toBe(600);

    // Right on boundary (600px with touch)
    window.innerWidth = 600;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('pointer: coarse'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    expect(isOneHandMobileDevice()).toBe(true);

    // 1px over boundary (601px)
    window.innerWidth = 601;
    expect(isOneHandMobileDevice()).toBe(false);
  });
});
