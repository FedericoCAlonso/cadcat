# CadCat — Informe de Cierre: Etapa 4

**Versión:** `v0.26.1`  
**Fecha:** 6 de noviembre de 2026  
**Módulo:** Resumen de Producción y Costos en Pie Fijo, Selector de Alcance, Debounce y Coherencia Multi-Módulo  

---

## 1. Causa del Defecto de Hover (Resumen en una sola línea)

`pieceGroup` tenía `scale.x = -1` mientras `hoverOutline` en la escena raíz tenía `scale.x = 1`, por lo que copiar coordenadas locales sin desreflejar proyectaba el contorno en el lado opuesto del módulo.

---

## 2. Tabla Comparativa de Proyecto Ejemplo Multi-Módulo

Para verificar la consistencia matemática y de producción se analizó un proyecto ejemplo compuesto por dos módulos de distinta tipología y cantidad:
- **Módulo A ("Bajo Mesada 800"):** 800 × 720 × 580 mm, Melamina 18 mm, Cantidad = **1** (5 piezas, área neta de corte = 1,7928 m²).
- **Módulo B ("Alacena 400"):** 400 × 600 × 320 mm, Melamina 18 mm, Cantidad = **2** (5 piezas c/u = 10 piezas, área neta de corte = 0,6496 m² c/u = 1,2992 m²).
- **Placa de catálogo:** 2800 × 2070 mm (5,796 m² por placa, $45.000 / placa, tornillos confirmat $50 c/u, pasada de corte $50).

### 2.1 Tabla de Valores

| Métrica | Alcance "Proyecto" (Pie) | Alcance "Módulo" (Pie, Módulo B activo, Cant = 2) | Lista de Corte Exportada (CSV Proyecto) |
| :--- | :--- | :--- | :--- |
| **Piezas (unidades)** | **15** | **10** | **15** (1 encabezado + 15 filas) |
| **Área de Placas / Nesting (m²)** | **5,80 m²** (1 placa entera) | **11,59 m²** (2 placas = $1 \text{ placa} \times 2$) | N/A (el CSV exporta piezas de corte, no sobrantes) |
| **Área Neta de Piezas (m²)** | **3,09 m²** (en tooltip) | **1,30 m²** (en tooltip) | **3,09 m²** (suma exacta de $W_\text{cut} \times H_\text{cut}$) |
| **Costo Total Estimado ($)** | **$49.884** | **$93.404** ($46.702 \times 2$) | N/A |

### 2.2 Explicación de las Diferencias y Coherencia

1. **Conteo de Piezas:**
   - En **"Proyecto"**, el pie suma las 5 piezas del Módulo A ($5 \times 1$) y las 10 piezas del Módulo B ($5 \times 2$), totalizando **15 piezas**, lo que coincide de forma idéntica con las 15 filas de piezas del archivo CSV exportado del proyecto (`mod-A__...` y `mod-B__...__i1` / `mod-B__...__i2`).
   - En **"Módulo"**, al estar activo el Módulo B con cantidad 2, el pie computa las piezas correspondientes a todas las unidades de dicho módulo: $5 \times 2 = 10$ piezas.
2. **Área de Placas (Nesting) y Costo:**
   - En **"Módulo"**, el cálculo evalúa 1 unidad del módulo en forma aislada (la cual demanda 1 placa entera de 5,80 m² por $45.000) y multiplica escalarmente el resultado por la cantidad de unidades ($2 \times 5,796 = 11,59$ m², $2 \times $46.702 = $93.404).
   - En **"Proyecto"**, el motor ejecuta un **nesting guillotina global conjunto** (`runProjectNesting` en `src/resolver/projectConsolidator.ts`). Al consolidar todas las piezas de ambos módulos, las piezas del Módulo B aprovechan los retazos del Módulo A dentro de la misma placa, requiriendo en conjunto **una única placa** (5,80 m²). El costo consolidado resultante es **$49.884**, reflejando con exactitud el ahorro real de material por optimización conjunta.
3. **Área Neta de Corte:**
   - El área neta en el tooltip del alcance "Proyecto" (3,09 m²) coincide exactamente con la suma del área de corte de las 15 filas del CSV exportado ($1,7928 + 2 \times 0,6496 = 3,092$ m²).

---

## 3. Respuestas Técnicas a las Preguntas de la Revisión

### 3.1 Método en el alcance "Módulo"
- El cálculo real de costos del módulo individual (`calculateModuleCost`, invocado en `vm.cost`) procesa **1 unidad** del módulo activo; no ejecuta un nesting multi-unidad individual.
- El pie fijo (`PanelSummaryFooter`) utiliza **exactamente el mismo método**: toma el resultado unitario del motor de costos y lo multiplica por la cantidad configurada del módulo activo (`activeModuleQuantity`).

### 3.2 Método en el alcance "Proyecto"
- El alcance "Proyecto" utiliza `consolidatedCost`, el cual ejecuta un **nesting conjunto** (`runProjectNesting` en `src/resolver/projectConsolidator.ts`) combinando todas las piezas de todos los módulos y sus instancias en un único empaquetamiento global de guillotina. **No** suma nestings individuales.
- El área de placas se toma directamente de ese mismo cálculo global (`consolidatedCost.items` con `category === 'material'`), multiplicando las placas por su tamaño nominal (`calculateNestingBoardAreaM2`). No realiza ningún cálculo secundario.

### 3.3 Consumo de `vm.cost` / `vm.consolidatedCost` durante el Debounce y Bloqueo de Acciones
- Se auditó todo el repositorio: `vm.cost` y `vm.consolidatedCost` son leídos **únicamente** por `ModuleForm` para alimentar a `PanelSummaryFooter`. Ningún otro componente (vistas de despiece, mesadas, mecanizados o configuración) los consume ni falla ante un valor `null`.
- En `PanelSummaryFooter`, los botones **"💾 Guardar Módulo"**, **"📄 CSV"** y **"📑 PDF"** quedan deshabilitados con `disabled={isCostCalculating || isSaving}` mientras se calcula el costo, mostrando tooltips contextuales explicativos. Se incorporó una prueba unitaria que valida que los botones están deshabilitados y no disparan callbacks durante el cálculo.

### 3.4 Carga inicial del proyecto y estado "calculando…"
- En la carga inicial, el pie **no muestra "calculando…"**. En `useModuleViewModel.ts`, la carga inicial omite el debounce e inicializa directamente con `isCostCalculating = false`, mostrando el costo real calculado desde el primer render. El estado transitorio `"calculando…"` solo se activa cuando el usuario interactúa modificando parámetros en el formulario. Se añadió una prueba unitaria que verifica este comportamiento.

---

## 4. Altura Medida del Pie Fijo Optimizado ($\le 80$ px)

Se rediseñó el espaciado en `src/ui/theme.css` manteniendo el selector segmentado de alcance, el tooltip de área neta y la leyenda completa de precios parciales a confirmar.

Medición en Chromium Headless (`/snap/bin/chromium --headless=new`):
- **Resolución 1366×768 (aside 380 px):** **74 px** (ancho: 364 px).
- **Resolución 1920×1080 (aside 440 px):** **74 px** (ancho: 424 px).

Cumple estrictamente el objetivo de **$\le 80$ px** (reduciendo el peso vertical a menos del 10% del viewport).

---

## 5. Resultados de Verificación y Compilación

- **`npx tsc --noEmit`:** 0 errores.
- **`vitest`:** **88/88 archivos de prueba pasados, 595/595 tests en verde** (incluyendo 11/11 tests en `tests/stage4SummaryFooterAndDebounce.test.tsx`).
- **`npm run build`:** Compilación de producción exitosa en 6.80s con Service Worker PWA generado sin fallas.

---

## 6. Commits y Despliegue

- **Commit de revisión:** `e6c0f3e` — `fix(ui): optimize summary footer height to <=80px, disable export buttons during debounce, and verify multi-module coherence` (versión `v0.26.1`).
- **Repositorio GitHub:** Sincronizado en rama `main`.
- **GitHub Pages:** Desplegado en `https://federicocalonso.github.io/cadcat/`.
