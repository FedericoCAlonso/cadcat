import { useState, useEffect } from 'react';

/**
 * Maximum viewport width (in CSS pixels) for a device to be classified as a single-hand mobile phone.
 * Handheld phones range from 320px to ~430px (up to 600px for large phablets in portrait).
 * Tablets (iPad Mini, Galaxy Tab, etc.) start at 768px+, strictly excluding them.
 */
export const ONE_HAND_MOBILE_MAX_WIDTH_PX = 600;

/**
 * Checks whether the current runtime environment is a single-hand mobile phone.
 * Requires:
 * 1. Viewport width <= 600px (excludes tablets and desktop monitors).
 * 2. Primary pointing device is coarse touch (excludes desktop mouse / trackpad).
 */
export function isOneHandMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;

  const isWidthEligible = window.innerWidth <= ONE_HAND_MOBILE_MAX_WIDTH_PX;
  const hasCoarseTouch =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(pointer: coarse)').matches
      : false;

  return isWidthEligible && hasCoarseTouch;
}

/**
 * React hook that reactively tracks if the device is a single-hand mobile phone.
 * Listens to window resize and pointer media query changes.
 */
export function useOneHandDevice(): boolean {
  const [isOneHand, setIsOneHand] = useState<boolean>(() => isOneHandMobileDevice());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkDevice = () => {
      setIsOneHand(isOneHandMobileDevice());
    };

    // Initial check
    checkDevice();

    window.addEventListener('resize', checkDevice);

    let mql: MediaQueryList | null = null;
    if (typeof window.matchMedia === 'function') {
      mql = window.matchMedia('(pointer: coarse)');
      mql.addEventListener?.('change', checkDevice);
    }

    return () => {
      window.removeEventListener('resize', checkDevice);
      if (mql) {
        mql.removeEventListener?.('change', checkDevice);
      }
    };
  }, []);

  return isOneHand;
}
