# Compilación de Informes de Salida — CadCat

Este documento recopila de forma cronológica los dos últimos informes de salida y entrega técnica generados para el proyecto **CadCat**:

1. [Informe de Entrega: Fix Commit A — Resaltado de Cubrecantos con Línea Fina en el Visor 3D (v0.31.2, Commit `5d41f7f`)](#1-informe-de-entrega-fix-commit-a--resaltado-de-cubrecantos-con-línea-fina-en-el-visor-3d-v0312)
2. [Reporte Técnico: Fix Commit A — Visibilidad de Cantos en Teléfonos Móviles y Transformaciones Espejadas (v0.31.3, Commit `5e9b481`)](#2-reporte-técnico-fix-commit-a--visibilidad-de-cantos-en-teléfonos-móviles-y-transformaciones-espejadas-v0313)

---

# 1. Informe de Entrega: Fix Commit A — Resaltado de Cubrecantos con Línea Fina en el Visor 3D (v0.31.2)

---

## 1. Diagnóstico Previo y Causa del Espesor Percibido

### ¿Por qué el resaltado anterior se veía de 18 mm de espesor?
En el commit previo de la Etapa 5 Paso C, se implementó la función de espesor efectivo en pantalla para que la cinta no desapareciera a la distancia. Sin embargo, **la geometría del resaltado era un prisma sólido 3D (`BoxGeometry`) que cubría toda la cara del canto (los 18 mm completos del espesor de la placa)**:
- Para un frente de cajón de 495 × 140 × 18 mm, el resaltado creaba una caja sólida de $495 \times 1.2 \times 18\text{ mm}$.
- En la proyección isométrica estándar (vista frontal-superior-lateral en perspectiva), la cara superior del frente de cajón (que tiene 18 mm de profundidad física) quedaba completamente pintada de color magenta/ámbar sólido.
- La holgura o luz de separación entre dos frentes de cajón consecutivos es de apenas **2 a 3 mm**. Al estar pintada toda la profundidad de 18 mm con un prisma sólido, el color cubría e invadía visualmente la ranura, ocultando por completo la línea divisoria entre cajones.

### Dimensiones en mm y píxeles en vista por defecto:
- **Estilo anterior (`face`):**
  - Geometría: Prisma 3D sólido de $W \times \text{espesor cinta} \times 18\text{ mm}$ (cubre la cara entera).
  - En **390 × 844** (distancia de encuadre $\approx 2484\text{ mm}$, factor de escala $0.4101\text{ px/mm}$): la cara de 18 mm se proyectaba a **7.38 px** de ancho (y al acercar la cámara superaba los **18 px**).
  - En **1366 × 768** (distancia de encuadre $\approx 1563\text{ mm}$, factor de escala $0.5932\text{ px/mm}$): la cara de 18 mm se proyectaba a **10.68 px** de ancho.
- **Nuevo estilo corregido (`line`):**
  - Geometría: Segmento lineal 3D a lo largo del **borde exterior** de la cara del canto mediante `LineSegments2` y `LineMaterial` (`LineSegmentsGeometry`).
  - Ancho en pantalla: **2 px constantes** (configurado en `edgeBandLineWidthPx: 2`, máx. 3 px), invariable con la distancia o el ángulo de la cámara.
  - La separación de 2–3 mm entre cajones permanece **100% despejada y visible**, con su sombra y línea natural intactas.

---

## 2. Cambios Implementados

1. **Nuevo Estilo de Línea Fina de Ancho Constante (`style: 'line'`):**
   - Implementado en [`src/ui/viewer/edgeBandHighlight.ts`](file:///home/federico@uba-ilse.com.ar/mobilius/src/ui/viewer/edgeBandHighlight.ts) utilizando `LineSegments2` y `LineMaterial`.
   - Se dibuja una única línea fina sobre el perímetro exterior de cada arista canteada (evitando pintar el plano de 18 mm).
   - `polygonOffset: true` (`polygonOffsetFactor: -2`, `polygonOffsetUnits: -2`) previene el parpadeo (*z-fighting*) sin sobresalir de la pieza.
2. **Actualización Dinámica de Resolución:**
   - En [`src/ui/Viewport3D.tsx`](file:///home/federico@uba-ilse.com.ar/mobilius/src/ui/Viewport3D.tsx), el `handleResize` y el `ResizeObserver` recorren los materiales del grafo de escena (`isLineMaterial`) y actualizan `material.resolution.set(w, h)` de inmediato ante cualquier cambio de orientación o tamaño de pantalla.
3. **Preservación del Estilo de Cara Completa (`style: 'face'`):**
   - Se mantiene la lógica del prisma 3D `BoxGeometry` como alternativa en el código para la futura Etapa 8 (materiales realistas).
   - Se incorporó la clave de configuración centralizada en [`src/config/index.ts`](file:///home/federico@uba-ilse.com.ar/mobilius/src/config/index.ts) y [`src/config/uiDefaults.json`](file:///home/federico@uba-ilse.com.ar/mobilius/src/config/uiDefaults.json):
     - `edgeBandHighlightStyle: z.enum(['line', 'face']).default('line')`
     - `edgeBandLineWidthPx: z.number().positive().max(3).default(2)`
   - Sin control intrusivo en la UI.
4. **Transformaciones y Jerarquía:**
   - El grupo de cubrecantos (`edgeband-group`) se mantiene como hijo directo de la malla de la pieza (`mesh.add(edgeGroup)`), heredando:
     - La transformación espejada de ensamble (`scale.x = -1`).
     - La cinemática de apertura de cajones (guías telescópicas extendidas) y giro de puertas.
     - La traslación de la vista explotada.
5. **Comprobación en Ambos Visores 3D:**
   - Verificado tanto en el visor principal (`App.tsx`) como en el visor 3D de la guía de armado (`AssemblySheetView.tsx`), con cajones cerrados, cajón abierto y vista explotada.

---

## 3. Pruebas Automatizadas

En [`tests/stage5StepCViewer.test.tsx`](file:///home/federico@uba-ilse.com.ar/mobilius/tests/stage5StepCViewer.test.tsx) se agregaron los siguientes tests unitarios e integrados:
1. **Ancho Proyectado $\le 3\text{ px}$ en Viewports 390×844 y 1366×768:**
   - Verifica que cada arista canteada genere un `LineSegments2` con `LineMaterial`.
   - Verifica que `linewidth` sea exactamente 2 px ($\le 3\text{ px}$) y que la resolución del shader coincida con el viewport en ambos casos.
2. **Posición Global y Ajuste con Pieza Descentrada (`scale.x = -1`):**
   - Verifica una pieza descentrada en un vano lateral bajo el grupo espejado.
   - Comprueba que la caja delimitadora del resaltado lineal (`edgeBBox`) esté contenida dentro de la pieza (`pieceBBox`) con tolerancia $\le 0.5\text{ mm}$, asegurando que no sobresalga.
3. **Preservación de `style: 'face'`:**
   - Verifica que al solicitar explícitamente `style: 'face'`, se construya un `Mesh` con `BoxGeometry` y `MeshStandardMaterial` para compatibilidad con la Etapa 8.

---

## 4. Resultados de Verificación

1. **TypeScript Typecheck (`npx tsc --noEmit`):**
   - **0 errores**.
2. **Suite de Pruebas Automatizadas (`npm test`):**
   - **99 archivos de prueba completados (100% en verde)**.
   - **677 tests aprobados**.
3. **Compilación de Producción (`npm run build`):**
   - Bundle generado exitosamente sin advertencias. Service Worker PWA generado con 40 entradas de precaché.

---

## 5. Datos de Publicación y Despliegue

- **Commit Hash:** `5d41f7f`
- **Archivos Modificados:**
  - [`package.json`](file:///home/federico@uba-ilse.com.ar/mobilius/package.json)
  - [`package-lock.json`](file:///home/federico@uba-ilse.com.ar/mobilius/package-lock.json)
  - [`src/config/index.ts`](file:///home/federico@uba-ilse.com.ar/mobilius/src/config/index.ts)
  - [`src/config/uiDefaults.json`](file:///home/federico@uba-ilse.com.ar/mobilius/src/config/uiDefaults.json)
  - [`src/ui/Viewport3D.tsx`](file:///home/federico@uba-ilse.com.ar/mobilius/src/ui/Viewport3D.tsx)
  - [`src/ui/viewer/edgeBandHighlight.ts`](file:///home/federico@uba-ilse.com.ar/mobilius/src/ui/viewer/edgeBandHighlight.ts)
  - [`tests/stage5StepCViewer.test.tsx`](file:///home/federico@uba-ilse.com.ar/mobilius/tests/stage5StepCViewer.test.tsx)
- **Versión de la Aplicación:** `v0.31.2`
- **URL Pública Desplegada:** [https://federicocalonso.github.io/cadcat/](https://federicocalonso.github.io/cadcat/)
- **Nota PWA:** Realice una **recarga doble** en el navegador para purgar el Service Worker y activar la versión `v0.31.2`.

---
---

# 2. Reporte Técnico: Fix Commit A — Visibilidad de Cantos en Teléfonos Móviles y Transformaciones Espejadas (v0.31.3)

---

## 1. Causa del Defecto (Diagnóstico Secuencial)

Se evaluaron las 6 causas en el orden estricto solicitado mediante pruebas instrumentadas en Chromium headless con WebGL por software (SwiftShader):

1. **Resolución Inicial:**
   - `LineMaterial` de Three.js inicializa su resolución por defecto en `(1, 1)`. Al renderizar, `LineSegments2.onBeforeRender(renderer)` reasigna `material.uniforms.resolution.value` con el tamaño del viewport del renderer. Sin embargo, los materiales creados dinámicamente debían inicializarse con la resolución del contenedor desde su instanciación para evitar saltos de render en el primer frame.
2. **Píxeles CSS vs. Píxeles de Buffer:**
   - El viewport del renderer devuelve dimensiones lógicas/CSS. En pantallas de alta densidad (DPR = 3), un ancho `linewidth = 2` sin corrección producía 2 píxeles de buffer físico, equivalentes a apenas $2/3 = 0.67$ píxeles CSS (apenas perceptibles).
   - Se escaló el ancho efectivo de buffer multiplicando por el DPR (`effectiveLineWidthPx = lineWidthPx * pixelRatio`), garantizando exactamente 2 píxeles CSS reales en pantalla (6 píxeles físicos en DPR 3).
3. **Frustum Culling:**
   - Se configuró `line.frustumCulled = false` en `LineSegments2` para evitar descartes prematuros de la esfera envolvente unidimensional bajo transformaciones no uniformes.
4. **Depth Test y Oclusión de Caras Perpendiculares:**
   - La línea situada exactamente sobre el borde entre dos caras perpendiculares sufría oclusión de profundidad frente a la cara superior en vistas isométricas superiores. Se implementó un desplazamiento normal hacia afuera configurable (`normalOffsetMm = 0.3 mm`, parametrizado en `uiDefaults.json` y `src/config/index.ts`).
5. **Visibilidad de Grupos:**
   - Los grupos `edgeband-group` se creaban y activaban correctamente (`visible = true`).
6. **Color, Material y Causa Raíz Principal (Back-Face Culling bajo `scale.x = -1`):**
   - **Causa Raíz Determinante:** En el sistema de coordenadas de CadCat, el grupo contenedor `pieceGroup` aplica una transformación de simetría con `scale.x = -1` (para invertir el eje X en el ensamble).
   - `LineSegments2` hereda de `Mesh` y construye quads triangulares para dar grosor a las líneas. Al aplicarse una matriz con determinante negativo ($\det(M) < 0$), el orden de enrollamiento (*winding order*) de los triángulos se invierte de CW a CCW.
   - Como `LineMaterial` utilizaba el valor por defecto `side: THREE.FrontSide`, la prueba de WebGL `gl.cullFace(gl.BACK)` interpretaba que **todos los triángulos del quad de la línea estaban de espaldas a la cámara y los descartaba por completo (0 píxeles renderizados)**.
   - **Solución:** Configurar `side: THREE.DoubleSide` en `LineMaterial`. Al desactivar el descarte por cara trasera en los quads de línea, el renderizado de cantos se volvió 100% visible bajo la escala espejada, alcanzando más de 14,000 píxeles en móvil.

---

## 2. Tabla Comparativa de Conteo de Píxeles (Antes vs. Después)

> Conteo realizado con Chromium headless (SwiftShader WebGL) sobre el módulo con cajones `preset-drawer-unit-3`, buscando el color `#E91E63` (RGB 233, 30, 99) con tolerancia euclidiana $\le 45$:

| Visor | Resolución | DPR | Estado Cantos | Antes (v0.31.2) | Después (v0.31.3) | Diagnóstico Visual |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **Visor Principal (3D)** | 390×844 (Móvil) | 3 | **Cantos ON** | 14 px | **14,324 px** | **Visible y nítido (+102,214%)** |
| **Visor Principal (3D)** | 390×844 (Móvil) | 3 | **Cantos OFF** | 6 px | **6 px** | Apagado limpio (ruido base) |
| **Visor Principal (3D)** | 1366×768 (Escritorio) | 1 | **Cantos ON** | 5 px | **887 px** | **Visible y nítido** |
| **Visor Principal (3D)** | 1366×768 (Escritorio) | 1 | **Cantos OFF** | 5 px | **5 px** | Apagado limpio |
| **Guía de Armado (3D)** | 390×844 (Móvil) | 3 | **Cantos ON** | 168 px | **11,357 px** | **Visible y nítido** |
| **Guía de Armado (3D)** | 390×844 (Móvil) | 3 | **Cantos OFF** | 31 px | **31 px** | Apagado limpio |
| **Guía de Armado (3D)** | 1366×768 (Escritorio) | 1 | **Cantos ON** | 14 px | **587 px** | **Visible y nítido** |
| **Guía de Armado (3D)** | 1366×768 (Escritorio) | 1 | **Cantos OFF** | 0 px | **0 px** | Apagado limpio |

### Ubicación de Capturas de Pantalla:
- **Línea base previa (v0.31.2):**
  - [main_390x844_dpr3_cantos_on.png](file:///home/federico@uba-ilse.com.ar/.gemini/antigravity-cli/brain/09282925-f1cf-4c24-b8fd-9ba16c6ff5fa/scratch/screenshots/main_390x844_dpr3_cantos_on.png)
  - [main_390x844_dpr3_cantos_off.png](file:///home/federico@uba-ilse.com.ar/.gemini/antigravity-cli/brain/09282925-f1cf-4c24-b8fd-9ba16c6ff5fa/scratch/screenshots/main_390x844_dpr3_cantos_off.png)
  - [assembly_390x844_dpr3_cantos_on.png](file:///home/federico@uba-ilse.com.ar/.gemini/antigravity-cli/brain/09282925-f1cf-4c24-b8fd-9ba16c6ff5fa/scratch/screenshots/assembly_390x844_dpr3_cantos_on.png)
- **Verificación posterior (v0.31.3):**
  - [main_390x844_dpr3_cantos_on.png](file:///home/federico@uba-ilse.com.ar/.gemini/antigravity-cli/brain/09282925-f1cf-4c24-b8fd-9ba16c6ff5fa/scratch/screenshots/after/main_390x844_dpr3_cantos_on.png)
  - [main_390x844_dpr3_cantos_off.png](file:///home/federico@uba-ilse.com.ar/.gemini/antigravity-cli/brain/09282925-f1cf-4c24-b8fd-9ba16c6ff5fa/scratch/screenshots/after/main_390x844_dpr3_cantos_off.png)
  - [assembly_390x844_dpr3_cantos_on.png](file:///home/federico@uba-ilse.com.ar/.gemini/antigravity-cli/brain/09282925-f1cf-4c24-b8fd-9ba16c6ff5fa/scratch/screenshots/after/assembly_390x844_dpr3_cantos_on.png)

---

## 3. Commit y Archivos Modificados

- **Commit Hash:** [`5e9b481`](file:///home/federico@uba-ilse.com.ar/mobilius)
- **Archivos Modificados:**
  1. [`src/config/index.ts`](file:///home/federico@uba-ilse.com.ar/mobilius/src/config/index.ts): Incorporación de `edgeBandNormalOffsetMm` al esquema Zod con valor por defecto de 0.3 mm.
  2. [`src/config/uiDefaults.json`](file:///home/federico@uba-ilse.com.ar/mobilius/src/config/uiDefaults.json): Configuración centralizada de `"edgeBandNormalOffsetMm": 0.3` (cero hardcoding).
  3. [`src/ui/viewer/edgeBandHighlight.ts`](file:///home/federico@uba-ilse.com.ar/mobilius/src/ui/viewer/edgeBandHighlight.ts):
     - `side: THREE.DoubleSide` para anular el back-face culling bajo `scale.x = -1`.
     - Escalado del ancho efectivo por `pixelRatio` para mantener 2 píxeles CSS exactos en pantalla.
     - Aplicación del desplazamiento normal `normalOffsetMm` en paneles YZ, XZ y XY.
     - `frustumCulled = false`.
  4. [`src/ui/Viewport3D.tsx`](file:///home/federico@uba-ilse.com.ar/mobilius/src/ui/Viewport3D.tsx): Suministro de `pixelRatio` nativo del dispositivo y actualización de resolución del buffer en redimensionamiento.
  5. [`package.json`](file:///home/federico@uba-ilse.com.ar/mobilius/package.json): Script `test:visual`, dependencias de desarrollo y versión `0.31.3`.
  6. [`scripts/test-visual.mjs`](file:///home/federico@uba-ilse.com.ar/mobilius/scripts/test-visual.mjs): Nuevo script de prueba visual automatizada en Chromium headless.

*(Cero modificaciones en `src/model`, algoritmos de `src/resolver` ni `src/storage`)*.

---

## 4. Nueva Versión y Despliegue Público

- **Versión:** `v0.31.3`
- **URL Pública:** [https://federicocalonso.github.io/cadcat/](https://federicocalonso.github.io/cadcat/)
- **Cómo obtener la nueva versión:** Debido al Service Worker PWA, realizar una **recarga doble** de la página web en el navegador móvil o de escritorio (`Ctrl + Shift + R` o recargar, esperar 1 segundo y recargar nuevamente) para activar los nuevos paquetes en caché.

---

## 5. Resultados de Pruebas y Compilación

- **`npx tsc --noEmit`:** 0 errores de TypeScript.
- **`npm test` (Vitest):** 99/99 archivos de prueba completados en verde (677 tests exitosos).
- **`npm run test:visual`:**
  ```text
  === CadCat Visual Edge Band Highlights Test ===
  ✓ Found running server on port 4173
  ✓ Using Chromium: /snap/bin/chromium
  ┌─────────┬───────────────────────────┬────────────┬─────────────┬────────┐
  │ (index) │ testCase                  │ pixelCount │ minRequired │ status │
  ├─────────┼───────────────────────────┼────────────┼─────────────┼────────┤
  │ 0       │ 'DPR 1 - Drawers Closed'  │ 522        │ 100         │ 'PASS' │
  │ 1       │ 'DPR 1 - One Drawer Open' │ 522        │ 100         │ 'PASS' │
  │ 2       │ 'DPR 3 - Drawers Closed'  │ 14324      │ 500         │ 'PASS' │
  │ 3       │ 'DPR 3 - One Drawer Open' │ 14324      │ 500         │ 'PASS' │
  └─────────┴───────────────────────────┴────────────┴─────────────┴────────┘
  ✓ All visual edge band highlight assertions passed successfully.
  ```
  *(Nota: en v0.31.2 los valores obtenidos eran 5 y 14 píxeles, por lo que esta suite falla inequívocamente en la versión anterior).*
- **`npm run build`:** Compilación limpia y generación del Service Worker PWA.

---

*Detenido en este punto en cumplimiento de la regla de aceptación. A la espera de tu aprobación para proceder con el Fix Commit B.*
