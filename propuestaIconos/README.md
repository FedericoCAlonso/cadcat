# Mobilius · gato gris

Pixel art sobre grilla de 32x32 (íconos) y 64x32 (animación). Escalar SOLO con enteros, sin suavizado.

## Íconos (usar en la app)
- `mobilius-icon-dark.svg`: ícono principal (fondo #101820). `mobilius-icon-light.svg`: variante clara (#F5F1E6).
- `icon-192.png`, `icon-512.png`: PWA, purpose `any`.
- `icon-512-maskable.png`: PWA, purpose `maskable` (con zona segura).
- `apple-touch-icon.png`: 180x180 para iOS.
- `favicon.ico` (32 y 64 px), `favicon-32.png`, `favicon-64.png`.
- `icon-light-192.png`, `icon-light-512.png`: variante clara (opcional).

### head de index.html
```html
<link rel="icon" href="/icons/mobilius-icon-dark.svg" type="image/svg+xml">
<link rel="icon" href="/icons/favicon.ico" sizes="32x32 64x64">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta name="theme-color" content="#101820">
```

### manifest.webmanifest
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
Si hay service worker con precache, agregar estas rutas. Si se muestra el ícono dentro de la app, usar `image-rendering: pixelated`.

## Animación (SOLO para la página de presentación, NO incluir en la app)
- `mobilius-animacion.html`: canvas autocontenido, ~6,6 s en bucle, respeta `prefers-reduced-motion` (muestra un cuadro final fijo). Para embeber: copiar el `<canvas>` y el `<script>`, o usar `<iframe>`.
- `mobilius-animacion.gif`: misma animación en GIF (512x256) para compartir por WhatsApp, redes o README.

## Paleta
Fondo #101820 · gato #9AA5B1 (sombra #66717E, claro #EEF1F5) · collar #D9694A · latón #E9C46A / #B8892B · frentes #6B9080 (luz #A7C4A0, sombra #3F5E52) · tablero #E8DCC4 · cuerpo #2E3B40
