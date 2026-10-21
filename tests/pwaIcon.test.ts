import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { pwaManifest } from '../src/pwaConfig';

describe('PWA Icon and Adaptive Shape Compliance', () => {
  const publicDir = path.resolve(__dirname, '../public');

  it('provides public/icons/cadcat-icon-dark.svg conforming to the vector icon standard', () => {
    const iconSvgPath = path.join(publicDir, 'icons/cadcat-icon-dark.svg');
    expect(fs.existsSync(iconSvgPath)).toBe(true);
    const content = fs.readFileSync(iconSvgPath, 'utf-8');
    expect(content).toContain('viewBox="0 0 40 40"');
    expect(content).toContain('shape-rendering="crispEdges"');
    expect(content).toContain('fill="#101820"');
  });

  it('provides public/icons/cadcat-icon-light.svg for light mode', () => {
    const iconLightSvgPath = path.join(publicDir, 'icons/cadcat-icon-light.svg');
    expect(fs.existsSync(iconLightSvgPath)).toBe(true);
    const content = fs.readFileSync(iconLightSvgPath, 'utf-8');
    expect(content).toContain('viewBox="0 0 40 40"');
    expect(content).toContain('shape-rendering="crispEdges"');
    expect(content).toContain('fill="#F5F1E6"');
  });

  it('provides PNG assets for PWA launcher and splash screens', () => {
    const icon192 = path.join(publicDir, 'icons/icon-192.png');
    const icon512 = path.join(publicDir, 'icons/icon-512.png');
    const iconMaskable = path.join(publicDir, 'icons/icon-512-maskable.png');

    expect(fs.existsSync(icon192)).toBe(true);
    expect(fs.existsSync(icon512)).toBe(true);
    expect(fs.existsSync(iconMaskable)).toBe(true);

    const stat192 = fs.statSync(icon192);
    const stat512 = fs.statSync(icon512);
    const statMaskable = fs.statSync(iconMaskable);

    expect(stat192.size).toBeGreaterThan(1000);
    expect(stat512.size).toBeGreaterThan(1000);
    expect(statMaskable.size).toBeGreaterThan(1000);
  });

  it('declares any and maskable icon purposes in the web app manifest for OS compatibility', () => {
    expect(pwaManifest.theme_color).toBe('#101820');
    expect(pwaManifest.background_color).toBe('#101820');

    const png512Icon = pwaManifest.icons.find((i) => i.src.includes('icon-512.png'));
    expect(png512Icon?.purpose).toBe('any');

    const maskableIcon = pwaManifest.icons.find((i) => i.src.includes('icon-512-maskable.png'));
    expect(maskableIcon?.purpose).toBe('maskable');

    const png192Icon = pwaManifest.icons.find((i) => i.src.includes('icon-192.png'));
    expect(png192Icon?.purpose).toBe('any');
  });
});
