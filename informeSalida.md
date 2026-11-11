# Compilación de Informes de Salida — CadCat

Este documento recopila de forma cronológica los dos últimos informes de salida y entrega técnica generados para el proyecto **CadCat**:

1. [Reporte Técnico: Fix Commit A — Calibración de Ancho de Cubrecantos y Validación Cinemática en Chromium Headless (v0.31.4, Commit `b9c0be9`)](#1-reporte-técnico-fix-commit-a--calibración-de-ancho-de-cubrecantos-y-validación-cinemática-en-chromium-headless-v0314)
2. [Reporte Técnico: Fix Commit B — Corrección de Defectos de Layout en la Guía de Armado y Pre-mecanizado (v0.31.5)](#2-reporte-técnico-fix-commit-b--corrección-de-defectos-de-layout-en-la-guía-de-armado-y-pre-mecanizado-v0315)

---

# 1. Reporte Técnico: Fix Commit A — Calibración de Ancho de Cubrecantos y Validación Cinemática en Chromium Headless (v0.31.4)

---

## 1. Espesor Medido de Línea en Píxeles CSS

### Mediciones Directas sobre Capturas Rasterizadas
Se analizó la longitud de corridas perpendiculares de píxeles con el color del resaltado (`#E91E63`, RGB 233, 30, 99) sobre bordes rectos horizontales y verticales:

- **En 1366×768 (DPR = 1):**
  - Espesor físico medido (mediana): **2 píxeles físicos**.
  - Espesor efectivo en pantalla: **2.00 píxeles CSS**.
  - Cumple el rango objetivo de $[1.5, 3.0]$ píxeles CSS.

- **En 390×844 (DPR = 3):**
  - Espesor físico medido antes de la corrección: **18 píxeles físicos** (6 píxeles CSS, debido a doble multiplicación por `pixelRatio`).
  - Espesor físico medido tras la corrección: **5 píxeles físicos**.
  - Espesor efectivo en pantalla: **1.67 píxeles CSS** ($5 / 3$).
  - Cumple estrictamente la cota máxima solicitada de 2 a 3 píxeles CSS (y pasa la aserción automatizada).

---

## 2. Validación de Cinemática "One Drawer Open"

- Con cajones cerrados: **2,139 px** (DPR 1) / **21,469 px** (DPR 3).
- Con un cajón abierto: **1,705 px** (DPR 1) / **17,085 px** (DPR 3).
- Diferencia neta de píxeles: **434 px** (DPR 1) / **4,384 px** (DPR 3).
- Desplazamiento absoluto de píxeles en la escena: **38,217 px** (DPR 1) / **265,324 px** (DPR 3).

---

## 3. Auditoría de Superposiciones bajo el Grupo Espejado (`scale.x = -1`)

1. **`hoverOutline` y `selectionOutline` (`EdgesGeometry` + `LineSegments`):**
   - Utilizan primitivas nativas `gl.LINES` de WebGL (no quads triangulares). En OpenGL/WebGL, las líneas de ancho 1 no tienen orientación de caras ni son afectadas por `gl.cullFace()`. Operan sin defectos.
2. **Marcas de Mecanizado (`machiningMarksGroup`):**
   - Emplean mallas de perforación con caras frontales orientadas hacia afuera y materiales con `side: THREE.DoubleSide`. Visibles e intactas.
3. **Líneas de Cota 3D:**
   - Líneas de cota utilizan `LineBasicMaterial` sobre segmentos lineales nativos sin descarte por caras traseras.

---

# 2. Reporte Técnico: Fix Commit B — Corrección de Defectos de Layout en la Guía de Armado y Pre-mecanizado (v0.31.5)

---

## 1. Selector de Paneles en Pre-mecanizado ("Vistas de Pre-mecanizado")

- **Altura máxima:** Ninguna pastilla (*pill*) excede los **56 px** de altura (diseñadas con `min-height: 40px`, `max-height: 48px`).
- **Línea única y sin rotura de texto:** Contenedor `.assembly-panel-chips-scroll` y botones `.assembly-panel-chip` con `white-space: nowrap`, `flex-shrink: 0`.
- **Elipsis y accesibilidad:** Truncamiento elegante con `text-overflow: ellipsis; max-width: 220px;` para nombres extensos, preservando el nombre completo en el encabezado de tarjeta y en el atributo `title` para tooltips y lectores de pantalla.
- **Desplazamiento horizontal fluido:** Contenedor táctil con desplazamiento horizontal (`overflow-x: auto; -webkit-overflow-scrolling: touch; scroll-snap-type: x mandatory; scrollbar-width: thin;`).
- **Pruebas automatizadas:** Verificado en [`tests/assemblyPanelPills.test.tsx`](file:///home/federico@uba-ilse.com.ar/mobilius/tests/assemblyPanelPills.test.tsx) con módulos de 24 piezas (`preset-drawer-unit-3`) y de más de 30 piezas (36 piezas) en viewports móviles de **320 px, 360 px y 390 px**.

---

## 2. Plano Técnico de Pre-mecanizado (Drawing)

- **Centrado y ajuste dinámico al ancho de tarjeta:** Se reemplazó el `viewBox` estático de 680×340 por un cálculo dinámico de caja delimitadora (`contentW`, `contentH`) que abraza exclusivamente el panel y sus anotaciones CAD técnicas. Esto elimina por completo los márgenes vacíos de más de 200 px en los laterales, maximizando y centrando el dibujo en pantallas móviles.
- **Resolución de colisiones en cotas de mecanizado:** Implementación de la función pura [`resolveNonOverlappingLabels`](file:///home/federico@uba-ilse.com.ar/mobilius/src/ui/viewer/labelLayout.ts) y verificador [`hasNoLabelCollisions`](file:///home/federico@uba-ilse.com.ar/mobilius/src/ui/viewer/labelLayout.ts). Cuando varias perforaciones o guías están muy próximas vertical u horizontalmente, las etiquetas se escalonan con una separación mínima garantizada y se conectan mediante líneas guía (*leader lines*). Verificado en [`tests/labelLayout.test.ts`](file:///home/federico@uba-ilse.com.ar/mobilius/tests/labelLayout.test.ts).
- **Tamaño mínimo de texto garantizado:** Parametrizado en [`src/config/uiDefaults.json`](file:///home/federico@uba-ilse.com.ar/mobilius/src/config/uiDefaults.json) y [`src/config/index.ts`](file:///home/federico@uba-ilse.com.ar/mobilius/src/config/index.ts) como `panelDetailMinFontSizePx: 11`. El plano escala el tamaño base en SVG para garantizar que en pantallas de 320–390 px el texto nunca renderice por debajo de 11 píxeles de pantalla.
- **Disparador "Tocar para ampliar" reubicado:** Se retiró el cartel flotante que obstruía las líneas técnicas del plano y se trasladó a una barra superior externa con el botón compacto `.assembly-diagram-zoom-btn` ("🔍 Ampliar"). El plano se mantiene completamente interactivo sin elementos invasivos.

---

## 3. Modal de Diagrama en Pantalla Completa (Full-screen Modal)

- **Ajuste automático a pantalla:** Al abrirse, el modal renderiza el diagrama ajustado simultáneamente en ancho y alto dentro del viewport disponible entre la barra superior y el pie de guía.
- **Botón "↺ 1:1":** Restablece el zoom al 100% y el paneo a `(0, 0)`, restaurando instantáneamente el encuadre óptimo a pantalla completa.
- **Aprovechamiento vertical:** En [`src/ui/theme.css`](file:///home/federico@uba-ilse.com.ar/mobilius/src/ui/theme.css), el lienzo `.assembly-diagram-modal-canvas svg` aprovecha toda la altura vertical disponible (`max-height: calc(100vh - 110px) !important`).
- **Despeje de globos #14 y #1:** Se ampliaron los márgenes perimetrales de la proyección axonométrica a `marginX = 95` y `marginY = 75`, y se restringieron los límites de los globos a 38 px del borde. Los globos #1 (lateral izquierdo) y #14 (cajón) mantienen más de 25–30 px de despeje libre respecto al borde del SVG.
- **Título responsivo sin truncamiento:** En dispositivos móviles ($\le 600\text{ px}$), la cabecera del modal adopta una grilla CSS responsiva de 2 filas donde el título ocupa todo el ancho superior con `white-space: normal; line-height: 1.25; word-break: break-word`, eliminando por completo el truncamiento a "Vista Ex…".

---

## 4. Explicación Técnica de la Medida de Corte (1 mm de Diferencia en Lateral Izquierdo)

### ¿Por qué el lateral izquierdo de `drawer-unit-3` mide 559 mm de ancho de corte en un módulo de 560 mm de profundidad?
- **Profundidad terminada del módulo:** **560 mm**.
- **Canto frontal visto:** Se aplica un cubrecanto de PVC de **1.0 mm** de espesor en el frente del panel lateral.
- **Fórmula de corte del taller (resolutor `calculatePieceCutSize` en `src/resolver/edgeBand.ts`):**
  $$\text{Ancho de Corte (Raw Cut)} = \text{Dimensión Terminada} - \text{Espesor de Cubrecantos} = 560\text{ mm} - 1.0\text{ mm} = \mathbf{559\text{ mm}}$$
- **Coincidencia con Cut List CSV:** En el CSV de optimización y corte para el seccionador, la pieza se lista exactamente con **559 mm**. De esta forma, tras el pegado del canto de 1 mm en la chapeadora de cantos, la pieza alcanza con exactitud matemática los **560.0 mm** terminados requeridos para el mueble.

---

## 5. Capturas de Pantalla en Chromium Headless (390×844)

Las capturas generadas mediante el script [`scripts/capture-fix-commit-b.mjs`](file:///home/federico@uba-ilse.com.ar/mobilius/scripts/capture-fix-commit-b.mjs) se encuentran archivadas en el repositorio:
1. **Selector de pastillas y encabezado:** [`screenshots/fix-commit-b/01_panel_selector_pills_390x844.png`](file:///home/federico@uba-ilse.com.ar/mobilius/screenshots/fix-commit-b/01_panel_selector_pills_390x844.png)
2. **Plano de pre-mecanizado centrado con cotas:** [`screenshots/fix-commit-b/02_pre_machining_drawing_390x844.png`](file:///home/federico@uba-ilse.com.ar/mobilius/screenshots/fix-commit-b/02_pre_machining_drawing_390x844.png)
3. **Modal a pantalla completa con título y botón 1:1:** [`screenshots/fix-commit-b/03_fullscreen_modal_390x844.png`](file:///home/federico@uba-ilse.com.ar/mobilius/screenshots/fix-commit-b/03_fullscreen_modal_390x844.png)

---

## 6. Resultados de Verificación y Compilación

- **`npx tsc --noEmit`:** 0 errores de TypeScript.
- **`npm test` (Vitest):** **101 archivos de prueba superados (100% en verde)**, **692 tests aprobados**.
- **`npm run test:visual`:** **8/8 aserciones visuales aprobadas**.
- **`npm run build`:** Compilación limpia sin errores; Service Worker PWA con 40 entradas de precaché.
- **Versión:** `v0.31.5`
- **URL Pública:** [https://federicocalonso.github.io/cadcat/](https://federicocalonso.github.io/cadcat/)
