export interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

export interface WebAppManifest {
  id?: string;
  name: string;
  short_name: string;
  description: string;
  theme_color: string;
  background_color: string;
  display: 'fullscreen' | 'standalone' | 'minimal-ui' | 'browser';
  orientation: 'any' | 'natural' | 'landscape' | 'portrait';
  scope: string;
  start_url: string;
  icons: ManifestIcon[];
}

/**
 * Creates a unique, scope-isolated PWA manifest.
 * Crucial for hosting multiple PWAs under the same origin (e.g. GitHub Pages https://<username>.github.io/<repo>/)
 * so that the browser treats each app as a distinct, installable PWA without conflicting identities or scopes.
 */
export function createPwaManifest(base: string = '/'): WebAppManifest {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const cleanPath = (file: string) => `${normalizedBase}${file}`.replace(/\/{2,}/g, '/');

  return {
    id: normalizedBase,
    name: 'CadCat',
    short_name: 'CadCat',
    description: 'Progressive Web App for panel furniture design',
    theme_color: '#101820',
    background_color: '#101820',
    display: 'standalone',
    orientation: 'any',
    scope: normalizedBase,
    start_url: normalizedBase,
    icons: [
      {
        src: cleanPath('icons/icon-192.png'),
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: cleanPath('icons/icon-512.png'),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: cleanPath('icons/icon-512-maskable.png'),
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}

/**
 * Web application manifest configuration for PWA (defaults to '/' for development and tests).
 */
export const pwaManifest: WebAppManifest = createPwaManifest('/');
