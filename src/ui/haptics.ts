export type HapticType = 'tick' | 'major' | 'none';

/**
 * Triggers physical vibration on devices supporting the Vibration API.
 */
export function triggerHaptic(type: HapticType): void {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;

  if (type === 'major') {
    navigator.vibrate(25);
  } else if (type === 'tick') {
    navigator.vibrate(10);
  }
}
