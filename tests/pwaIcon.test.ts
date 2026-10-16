import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { pwaManifest } from '../src/pwaConfig';

describe('PWA Icon and Adaptive Shape Compliance', () => {
  const publicDir = path.resolve(__dirname, '../public');

  it('provides public/icon.svg conforming to the 512x512 maskable standard', () => {
    const iconSvgPath = path.join(publicDir, 'icon.svg');
    expect(fs.existsSync(iconSvgPath)).toBe(true);
    const content = fs.readFileSync(iconSvgPath, 'utf-8');
    expect(content).toContain('viewBox="0 0 512 512"');
    expect(content).toContain('rect width="512" height="512"'); // Full-bleed background
  });

  it('provides high-resolution PNG assets for PWA launcher and splash screens', () => {
    const pwa192 = path.join(publicDir, 'pwa-192x192.png');
    const pwa512 = path.join(publicDir, 'pwa-512x512.png');

    expect(fs.existsSync(pwa192)).toBe(true);
    expect(fs.existsSync(pwa512)).toBe(true);

    const stat192 = fs.statSync(pwa192);
    const stat512 = fs.statSync(pwa512);

    expect(stat192.size).toBeGreaterThan(10000);
    expect(stat512.size).toBeGreaterThan(50000);
  });

  it('declares maskable icon purpose in the web app manifest for OS compatibility', () => {
    expect(pwaManifest.theme_color).toBe('#0f172a');
    expect(pwaManifest.background_color).toBe('#0f172a');

    const svgIcon = pwaManifest.icons.find((i) => i.src.includes('icon.svg'));
    expect(svgIcon?.purpose).toContain('maskable');

    const png512Icon = pwaManifest.icons.find((i) => i.src.includes('pwa-512x512.png'));
    expect(png512Icon?.purpose).toContain('maskable');

    const png192Icon = pwaManifest.icons.find((i) => i.src.includes('pwa-192x192.png'));
    expect(png192Icon?.purpose).toContain('maskable');
  });
});
