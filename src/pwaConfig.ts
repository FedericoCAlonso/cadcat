export interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

export interface WebAppManifest {
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
 * Web application manifest configuration for PWA.
 */
export const pwaManifest: WebAppManifest = {
  name: 'Mobilius - Furniture Design',
  short_name: 'Mobilius',
  description: 'Progressive Web App for panel furniture design',
  theme_color: '#2c3e50',
  background_color: '#ffffff',
  display: 'standalone',
  orientation: 'any',
  scope: '/',
  start_url: '/',
  icons: [
    {
      src: '/icon.svg',
      sizes: '512x512',
      type: 'image/svg+xml',
      purpose: 'any maskable',
    },
  ],
};
