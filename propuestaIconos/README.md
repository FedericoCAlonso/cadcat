# Iconos de Mobilius

Pixel art sobre grilla de 24x24, escalado con enteros. NO suavizar ni reescalar con interpolación.

## Archivos
- `mobilius-icon-dark.svg`: ícono principal (fondo #101820). Vectorial, usar `shape-rendering="crispEdges"` (ya incluido).
- `mobilius-icon-light.svg`: variante clara (fondo #F5F1E6).
- `icon-192.png`, `icon-512.png`: íconos PWA (purpose `any`).
- `icon-512-maskable.png`: ícono PWA con zona segura (purpose `maskable`).
- `apple-touch-icon.png`: 180x180 para iOS.
- `favicon.ico` (32 y 48 px) y `favicon-32.png`, `favicon-48.png`.
- `icon-light-192.png`, `icon-light-512.png`: variante clara (uso opcional).

## Instalación
1. Copiar la carpeta a `public/icons/` (o la carpeta de estáticos del proyecto).
2. En `index.html`, dentro de `<head>`:
```html
<link rel="icon" href="/icons/mobilius-icon-dark.svg" type="image/svg+xml">
<link rel="icon" href="/icons/favicon.ico" sizes="48x48">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta name="theme-color" content="#101820">
```
3. En `manifest.webmanifest`:
```json
{
  "name": "Mobilius",
  "short_name": "Mobilius",
  "theme_color": "#101820",
  "background_color": "#101820",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```
4. Si el service worker precachea assets, agregar estas rutas a la lista.
5. Si se muestra el ícono dentro de la app, usar `image-rendering: pixelated` en `<img>`/`<canvas>`.

## Paleta (salvia + latón)
Fondo #101820 · frentes #6B9080 (luz #A7C4A0, sombra #3F5E52) · cuerpo #2E3B40 · encimera #E8DCC4 · latón #E9C46A / #B8892B
