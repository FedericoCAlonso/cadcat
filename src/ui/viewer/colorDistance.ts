/**
 * Color distance calculation using CIE76 (Delta E in CIELAB color space).
 * Pure functions for accessibility, color contrast, and palette discrimination audits.
 */

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface LabColor {
  L: number;
  a: number;
  b: number;
}

/**
 * Converts a hex color string (e.g. '#FF8F00' or 'FF8F00') to RGB components [0..255].
 *
 * @param hex Hex string with or without leading '#'.
 * @returns RGB color object.
 */
export function hexToRgb(hex: string): RgbColor {
  const clean = hex.replace('#', '').trim();
  const num = parseInt(clean, 16);
  if (isNaN(num) || (clean.length !== 6 && clean.length !== 3)) {
    return { r: 0, g: 0, b: 0 };
  }
  if (clean.length === 3) {
    const c0 = clean[0] ?? '0';
    const c1 = clean[1] ?? '0';
    const c2 = clean[2] ?? '0';
    const r = parseInt(c0 + c0, 16);
    const g = parseInt(c1 + c1, 16);
    const b = parseInt(c2 + c2, 16);
    return { r, g, b };
  }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

/**
 * Converts a non-linear sRGB channel [0..255] to linear light.
 *
 * @param c Channel value 0..255.
 * @returns Linearized value 0..1.
 */
export function sRgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

// D65 standard illuminant reference white points
const D65_XN = 0.95047;
const D65_YN = 1.00000;
const D65_ZN = 1.08883;

/**
 * Converts RGB components [0..255] to CIE XYZ color space with D65 illuminant.
 *
 * @param r Red [0..255].
 * @param g Green [0..255].
 * @param b Blue [0..255].
 * @returns XYZ color object.
 */
export function rgbToXyz(r: number, g: number, b: number): { x: number; y: number; z: number } {
  const rL = sRgbToLinear(r);
  const gL = sRgbToLinear(g);
  const bL = sRgbToLinear(b);
  return {
    x: 0.4124564 * rL + 0.3575761 * gL + 0.1804375 * bL,
    y: 0.2126729 * rL + 0.7151522 * gL + 0.0721750 * bL,
    z: 0.0193339 * rL + 0.1191920 * gL + 0.9503041 * bL,
  };
}

function fLab(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

/**
 * Converts RGB components [0..255] to CIELAB (L*, a*, b*) color space.
 *
 * @param r Red [0..255].
 * @param g Green [0..255].
 * @param b Blue [0..255].
 * @returns CIELAB color object.
 */
export function rgbToLab(r: number, g: number, b: number): LabColor {
  const { x, y, z } = rgbToXyz(r, g, b);
  const fx = fLab(x / D65_XN);
  const fy = fLab(y / D65_YN);
  const fz = fLab(z / D65_ZN);
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/**
 * Calculates the perceptual color distance (Delta E 1976 / CIE76) between two hex colors.
 * Values > 2.3 indicate a Just Noticeable Difference (JND).
 * Values > 25 indicate distinct categorical colors easily differentiable at a glance.
 *
 * @param hex1 First color hex string (e.g. '#FF8F00').
 * @param hex2 Second color hex string (e.g. '#D99B26').
 * @returns Delta E Euclidean distance in CIELAB space.
 */
export function calculateCie76Distance(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  const lab1 = rgbToLab(rgb1.r, rgb1.g, rgb1.b);
  const lab2 = rgbToLab(rgb2.r, rgb2.g, rgb2.b);
  return Math.hypot(lab1.L - lab2.L, lab1.a - lab2.a, lab1.b - lab2.b);
}
