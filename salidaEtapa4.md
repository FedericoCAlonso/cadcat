# CadCat — Informe de Entrega: Etapa 4

**Versión:** `v0.26.0`  
**Fecha:** 6 de noviembre de 2026  
**Objetivo de la etapa:** Implementación del pie fijo de resumen de producción y costos en el panel lateral izquierdo, selector de alcance proyecto/módulo, debounce en el cálculo de costos con estado transitorio, tratamiento estricto de precios parciales a confirmar y reubicación ergonómica de botones de guardado y exportación.

---

## 1. Resumen Ejecutivo de la Etapa 4

En esta etapa se abordó la pérdida de contexto del usuario al desplazarse verticalmente por el panel lateral de parámetros, concentrando los indicadores clave de producción y las acciones principales en un pie fijo compacto (`PanelSummaryFooter`), accesible en todo momento sin obstruir los controles del formulario ni la navegación inferior en dispositivos móviles.

### Aspectos clave implementados
1. **Pie Fijo de Resumen (`PanelSummaryFooter`):**
   - Anclado permanentemente en la parte inferior del panel con `position: sticky; bottom: var(--m3-bottom-nav-total-height, 0px);`.
   - Altura compacta medida en Chromium Headless: **118 px** tanto en 1366×768 como en 1920×1080.
   - Compensación de scroll en `.layout-aside` con padding inferior de `125 px` más el alto de la barra inferior móvil, garantizando visibilidad del 100% de los controles.
2. **Selector de Alcance ("Proyecto" / "Módulo"):**
   - Selector segmentado táctil M3.
   - Configurado por defecto en `"Proyecto"` vía `DEFAULT_UI_CONFIG.summaryScopeDefault`.
   - En alcance **Proyecto**, computa `consolidatedBom` y `consolidatedCost`.
   - En alcance **Módulo**, computa el módulo activo escalado por su cantidad configurada (`activeModuleQuantity`).
3. **Métricas de Producción:**
   - **Cantidad de piezas:** Conteo entero derivado de `bom.totalPieceCount` / `consolidatedBom.totalPieceCount`.
   - **Área de placas consumidas:** Calculada a partir de las placas enteras requeridas por el nesting multiplicadas por el tamaño de placa del catálogo (`calculateNestingBoardAreaM2`). El área neta de piezas se presenta en el tooltip (`bom.totalCutAreaM2`).
   - **Costo estimado:** Formateado con locale `es-AR` y símbolo monetario (`$`) configurable.
4. **Precios Pendientes ("A Confirmar"):**
   - Cuando el costo total posee ítems sin cotización (`grandTotal === 'TO_CONFIRM'`), el sistema exhibe `"Parcial $X · a confirmar"` utilizando el subtotal confirmado (`confirmedSubtotal`).
   - Prohibición estricta de mostrar valores parciales como si fuesen finales.
5. **Debounce en Entradas de Costo:**
   - Retardo no hardcodeado de `250 ms` (`costDebounceMs`) configurado en `src/config/uiDefaults.json`.
   - Aplica exclusivamente a los parámetros de entrada del `useMemo` en `useModuleViewModel.ts`, manteniendo intactos los algoritmos de nesting y costeo.
   - Mientras el cálculo está pendiente o debouncing, el costo muestra el estado `"calculando…"` con tipografía atenuada, evitando mostrar números obsoletos.
6. **Reubicación Ergonómica de Acciones:**
   - Botón principal: `"💾 Guardar Módulo"`.
   - Botones secundarios compactos: `"📄 CSV"` y `"📑 PDF"` con tooltips descriptivos (`"Lista de Corte (CSV)"` y `"Diagrama de Corte (PDF)"`) y accesibilidad por teclado.

---

## 2. Detalle de Archivos Modificados y Creados

| Archivo | Tipo de Cambio | Descripción |
| :--- | :--- | :--- |
| [`src/config/uiDefaults.json`](file:///home/federico@uba-ilse.com.ar/mobilius/src/config/uiDefaults.json) | Modificación | Incorporación de variables de configuración: `costDebounceMs: 250`, `summaryScopeDefault: "project"` y `currencySymbol: "$"`. |
| [`src/config/index.ts`](file:///home/federico@uba-ilse.com.ar/mobilius/src/config/index.ts) | Modificación | Validación de esquema Zod (`uiDefaultsSchema`) y tipado estricto TypeScript para las nuevas variables de configuración. |
| [`src/ui/PanelSummaryFooter.tsx`](file:///home/federico@uba-ilse.com.ar/mobilius/src/ui/PanelSummaryFooter.tsx) | **Nuevo** | Componente de pie fijo de resumen y acciones. Implementa la función de cálculo [`calculateNestingBoardAreaM2`](file:///home/federico@uba-ilse.com.ar/mobilius/src/ui/PanelSummaryFooter.tsx#L55-L77), selector de alcance, formateadores `Intl.NumberFormat` para `es-AR` y accesibilidad WCAG. |
| [`src/ui/useModuleViewModel.ts`](file:///home/federico@uba-ilse.com.ar/mobilius/src/ui/useModuleViewModel.ts) | Modificación | Implementación de `rawModuleCostInput` y `rawConsolidatedCostInput`. Debounce en `useEffect` sobre el retardo configurado. Exposición de [`isCostCalculating`](file:///home/federico@uba-ilse.com.ar/mobilius/src/ui/useModuleViewModel.ts#L161) y retorno seguro de `null` en `cost` durante el cálculo. Sincronización de `projectScope` por defecto. |
| [`src/ui/ModuleForm.tsx`](file:///home/federico@uba-ilse.com.ar/mobilius/src/ui/ModuleForm.tsx) | Modificación | Recepción opcional de `bom`, `consolidatedBom`, `cost`, `consolidatedCost` e `isCostCalculating`. Inclusión de `PanelSummaryFooter` y remoción de los botones duplicados del final del formulario. |
| [`src/ui/App.tsx`](file:///home/federico@uba-ilse.com.ar/mobilius/src/ui/App.tsx) | Modificación | Conexión de las propiedades del ViewModel hacia `ModuleForm`. |
| [`src/ui/theme.css`](file:///home/federico@uba-ilse.com.ar/mobilius/src/ui/theme.css) | Modificación | Estilos M3 para `.panel-summary-footer`, `.panel-summary-row`, `.panel-summary-metrics`, `.panel-summary-metric--cost.is-calculating`, y compensación de padding inferior en `.layout-aside`. |
| [`tests/stage4SummaryFooterAndDebounce.test.tsx`](file:///home/federico@uba-ilse.com.ar/mobilius/tests/stage4SummaryFooterAndDebounce.test.tsx) | **Nuevo** | Suite completa de 8 pruebas unitarias cubriendo cálculo de área, selector Proyecto/Módulo, textos parciales a confirmar, debounce y resolución al último cambio con `vi.fakeTimers`. |
| [`package.json`](file:///home/federico@uba-ilse.com.ar/mobilius/package.json) | Modificación | Incremento menor canónico a `v0.26.0`. |

---

## 3. Respuesta Técnica sobre el Área de Placas Consumidas (Ítem 2.1)

El motor de costos (`ModuleCostSummary`) no devuelve directamente un campo `boardAreaM2` en la raíz de su interfaz. No obstante, en su arreglo `items` se registra cada placa requerida con:
- `category: 'material'`
- `unit: 'sheet'`
- `quantity: sheetCount` (número entero de placas consumidas en el nesting).

A su vez, el catálogo de placas `materials` contiene las dimensiones nominales de cada placa (`sheetSizeMm.length` y `sheetSizeMm.width`). Con estos datos, la función [`calculateNestingBoardAreaM2`](file:///home/federico@uba-ilse.com.ar/mobilius/src/ui/PanelSummaryFooter.tsx#L55-L77) calcula con precisión:
$$\text{Área de placa consumida} = \sum (\text{cantidad de placas} \times \frac{\text{largo (mm)} \times \text{ancho (mm)}}{1.000.000})$$
sin inventar valores ni alterar los algoritmos de resolución matemática ni los modelos del dominio. El área neta de corte de las piezas individuales se conserva intacta y se expone como información complementaria mediante el atributo `title` (tooltip) de la métrica.

---

## 4. Medición de Altura del Pie Fijo

Medición realizada mediante Chromium Headless (`/snap/bin/chromium --headless=new`):

```text
--- Measuring PanelSummaryFooter Height ---
Resolution 1366x768 (aside 380px): 118px (width: 364px)
Resolution 1920x1080 (aside 440px): 118px (width: 424px)
```

La altura del pie fijo es de **118 px**, y la compensación de scroll aplicada a `.layout-aside` es de `calc(2rem + 125px)` en escritorio y `calc(var(--m3-bottom-nav-total-height) + 125px)` en móvil, asegurando que ningún campo de entrada o control quede solapado al final del desplazamiento.

---

## 5. Procedimiento de Verificación y Pruebas

### 5.1 Pruebas automatizadas
Se ejecutan con:
```bash
npx vitest run tests/stage4SummaryFooterAndDebounce.test.tsx
npm test
```
Resultados:
- **`tests/stage4SummaryFooterAndDebounce.test.tsx`:** 8/8 tests pasados.
  - Conmutación de alcance Proyecto vs Módulo con multiplicación por cantidad.
  - Cálculo de área de placa consumida por nesting.
  - Presentación de `"Parcial $X · a confirmar"` ante precios no confirmados.
  - Estado visual `"calculando…"` cuando `isCostCalculating` es verdadero.
  - Verificación de debounce de 250 ms y resolución estricta al último cambio ante cambios rápidos consecutivos.
  - Despacho de eventos de guardado, CSV y PDF con etiquetas accesibles.
- **Suite completa:** 88 archivos de prueba, 592 tests pasados (100% verde).

### 5.2 Verificación estática y compilación
- **TypeScript:** `npx tsc --noEmit` completado con 0 errores.
- **Build de producción:** `npm run build` completado exitosamente, generando los bundles y el Service Worker PWA (`dist/sw.js`).
