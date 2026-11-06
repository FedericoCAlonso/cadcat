# CadCat — Informe de Entrega: Etapa 4 (Revisión Condicional)

**Versión:** `v0.26.1`  
**Fecha:** 6 de noviembre de 2026  
**Objetivo de la etapa:** Implementación del pie fijo de resumen de producción y costos en el panel lateral izquierdo, selector de alcance proyecto/módulo, debounce en el cálculo de costos con estado transitorio, tratamiento estricto de precios parciales a confirmar, reubicación ergonómica de botones de guardado y exportación, optimización de altura ($\le 80$ px), deshabilitación de acciones durante debounce y verificación de coherencia multi-módulo con nesting y exportación CSV.

---

## 1. Causa del Defecto de Hover (Resumen en una línea)
`pieceGroup` tenía `scale.x = -1` mientras `hoverOutline` en la escena raíz tenía `scale.x = 1`, por lo que copiar coordenadas locales sin desreflejar proyectaba el contorno en el lado opuesto del módulo.

---

## 2. Tabla Comparativa de Proyecto Ejemplo Multi-Módulo (Ítem 1)

Se consideró un proyecto ejemplo compuesto por 2 módulos de distinto tipo y cantidad:
- **Módulo A ("Bajo Mesada 800"):** 800 × 720 × 580 mm, Melamina 18 mm, Cantidad = **1**.
- **Módulo B ("Alacena 400"):** 400 × 600 × 320 mm, Melamina 18 mm, Cantidad = **2**.
- Dimensiones de placa de catálogo: 2800 × 2070 mm (5,796 m² por placa, $45.000 / placa).

### 2.1 Tabla de Valores

| Métrica | Alcance "Proyecto" (Pie) | Alcance "Módulo" (Pie, Módulo B activo, Cant = 2) | Lista de Corte Exportada (CSV Proyecto) |
| :--- | :--- | :--- | :--- |
| **Piezas (unidades)** | **15** | **10** | **15** (1 encabezado + 15 filas) |
| **Área de Placas / Nesting (m²)** | **5,80 m²** (1 placa) | **11,59 m²** (2 placas = $1 \text{ placa} \times 2$) | N/A (el CSV exporta piezas de corte, no sobrantes) |
| **Área Neta de Piezas (m²)** | **3,09 m²** (en tooltip) | **1,30 m²** (en tooltip) | **3,09 m²** (suma exacta de $W_\text{cut} \times H_\text{cut}$) |
| **Costo Total Estimado ($)** | **$49.884** | **$93.404** ($46.702 \times 2$) | N/A |

### 2.2 Explicación de Diferencias y Coherencia
1. **Cantidad de piezas:**
   - En **"Proyecto"**, el pie suma las 5 piezas del Módulo A ($5 \times 1$) y las 10 piezas del Módulo B ($5 \times 2$), totalizando **15 piezas**, lo que coincide exactamente con las 15 filas de piezas del archivo CSV exportado del proyecto (`mod-A__...` y `mod-B__...__i1` / `mod-B__...__i2`).
   - En **"Módulo"**, al estar seleccionado el Módulo B con cantidad 2, el pie computa las piezas correspondientes a todas las unidades de dicho módulo: $5 \times 2 = 10$ piezas.
2. **Área de placas (Nesting) y Costo:**
   - En **"Módulo"**, el cálculo evalúa 1 unidad del módulo en forma aislada (la cual demanda 1 placa entera de 5,80 m² por $45.000) y multiplica el resultado por la cantidad de unidades ($2 \times 5,796 = 11,59$ m², $2 \times $46.702 = $93.404).
   - En **"Proyecto"**, el motor ejecuta un **nesting guillotina global conjunto** (`runProjectNesting`). Al combinar todas las piezas de ambos módulos, las piezas pequeñas del Módulo B aprovechan los retazos del Módulo A dentro de la misma placa, requiriendo en conjunto **una única placa** (5,80 m²). El costo consolidado resultante es **$49.884**, reflejando con realismo el ahorro de material propio de la optimización global.
3. **Área neta de corte:**
   - El área neta de piezas en el tooltip del alcance "Proyecto" (3,09 m²) coincide exactamente con la suma del área de corte de las 15 filas del CSV exportado ($1,7928 + 2 \times 0,6496 = 3,092$ m²).

---

## 3. Respuestas Técnicas a Preguntas de la Sección 2

### Pregunta 1: Método de cálculo en el alcance "Módulo"
- **¿El cálculo real de costo realiza un nesting conjunto de todas las unidades o multiplica el resultado de una unidad?**
  - El motor de costos del módulo (`calculateModuleCost`, invocado en `vm.cost`) procesa las piezas de **1 unidad** del módulo activo. No realiza un nesting multi-unidad individual para un solo módulo.
- **¿Qué método utiliza el pie fijo?**
  - El pie fijo utiliza **exactamente el mismo método**: toma el cálculo unitario provisto por el motor de costos (`cost.items`, `cost.grandTotal`) y lo multiplica escalarmente por la cantidad del módulo activo (`activeModuleQuantity`).

### Pregunta 2: Método de cálculo en el alcance "Proyecto"
- **¿El alcance "Proyecto" realiza un nesting conjunto de todos los módulos o suma los nestings individuales?**
  - `consolidatedCost` realiza un **nesting guillotina conjunto** (`runProjectNesting` en [`src/resolver/projectConsolidator.ts`](file:///home/federico@uba-ilse.com.ar/mobilius/src/resolver/projectConsolidator.ts#L229)). Combina todas las piezas de todos los módulos y sus instancias en un único problema de optimización de corte multi-material, maximizando el aprovechamiento de retazos. **No** suma nestings individuales.
- **Área de placas:**
  - El área de placas se deriva directamente de ese mismo cálculo de nesting global (`consolidatedCost.items` donde `category === 'material'`), multiplicando la cantidad entera de placas por las dimensiones nominales de cada placa del catálogo (`calculateNestingBoardAreaM2`). No realiza un segundo cálculo redundante.

### Pregunta 3: Consumo de `vm.cost` / `vm.consolidatedCost` durante el Debounce y Bloqueo de Acciones
- **¿Qué otros componentes leen `vm.cost` o `vm.consolidatedCost`?**
  - Se auditó todo el repositorio: `vm.cost` y `vm.consolidatedCost` son consumidos **únicamente** por `ModuleForm` para alimentar a `PanelSummaryFooter`. Ningún otro componente (vistas de despiece, mecanizados, mesada o configuración del proyecto) accede a estas variables.
- **Comportamiento de botones CSV y PDF:**
  - Los botones de exportación CSV y PDF en `PanelSummaryFooter` y el botón "💾 Guardar Módulo" quedan **inhabilitados (`disabled={isCostCalculating || isSaving}`)** mientras el cálculo está en proceso.
  - Al estar deshabilitados, muestran tooltips explicativos contextuales (`"Calculando costos y despiece..."`, `"Calculando lista de corte..."`) y los clics quedan bloqueados, evitando exportaciones con piezas desincronizadas. Se incorporó una prueba unitaria específica que valida esta protección.

### Pregunta 4: Carga inicial del proyecto y estado "calculando…"
- **¿En la carga inicial el pie muestra "calculando…"?**
  - **No.** En [`src/ui/useModuleViewModel.ts`](file:///home/federico@uba-ilse.com.ar/mobilius/src/ui/useModuleViewModel.ts), la carga inicial (`isInitialLoadRef` y estado `isLoading`) procesa el cálculo inmediatamente sin aplicar retardo de debounce (`isCostCalculating = false`).
  - El pie muestra el costo real calculado desde el primer instante. El estado transitorio `"calculando…"` solo se activa cuando el usuario modifica interactivamente un parámetro dimensional o estructural del formulario. Se añadió una prueba unitaria específica que verifica que la carga inicial no muestra `"calculando…"`.

---

## 4. Medición de Altura del Pie Fijo Optimizado ($\le 80$ px)

Se compactó el espaciado interno, paddings y alturas de botones en [`src/ui/theme.css`](file:///home/federico@uba-ilse.com.ar/mobilius/src/ui/theme.css), manteniendo el selector de alcance M3, tooltips de área neta y el texto completo de precios a confirmar.

Medición realizada en Chromium Headless (`/snap/bin/chromium --headless=new`):

```text
--- Measuring PanelSummaryFooter Height ---
Resolution 1366x768 (aside 380px): 74px (width: 364px)
Resolution 1920x1080 (aside 440px): 74px (width: 424px)
```

**Resultado:** **74 px** en 1366×768 y en 1920×1080 (cumple estrictamente el objetivo de $\le 80$ px, reduciendo la ocupación vertical de un 19% a menos del 10% de la pantalla).

---

## 5. Procedimiento de Verificación y Pruebas

1. **Verificación de tipos (TypeScript):**
   ```bash
   npx tsc --noEmit
   ```
   *Resultado:* 0 errores.

2. **Suite de pruebas unitarias y de integración:**
   ```bash
   npx vitest run tests/stage4SummaryFooterAndDebounce.test.tsx
   npm test
   ```
   *Resultado:*
   - `tests/stage4SummaryFooterAndDebounce.test.tsx`: 11/11 tests en verde.
   - Suite completa del proyecto: 88 archivos de prueba, **595 tests pasados (100% verde)**.

3. **Compilación de producción y PWA:**
   ```bash
   npm run build
   ```
   *Resultado:* Build exitoso en 6.80s, Service Worker PWA generado con 40 entradas de precache.

4. **Sincronización de versión:**
   - `package.json`: `"version": "0.26.1"`
   - `src/version.ts`: exporta `APP_VERSION` sincronizado dinámicamente con `package.json`.
