# Directivas de Calidad y Arquitectura de Agentes — CadCat

Este documento establece las directivas de calidad, diseño y arquitectura **estrictas y no negociables** para el desarrollo y mantenimiento del proyecto **CadCat**.

---

## 🏛️ Principios Fundamentales No Negociables

### 1. Cero Hardcoding (Strict No-Hardcoding Policy)
- **Prohibido el uso de valores fijos arbitrarios (Magic Numbers / Magic Strings)** en componentes de UI o algoritmos de resolución.
- Todas las dimensiones, holguras, tolerancias, especificaciones de herrajes, tipos de fijación y factores de cálculo deben provenir de:
  - Modelos de datos formales tipados con TypeScript y validados por Zod (`src/model/`).
  - Configuración del proyecto (`ProjectConfig`).
  - Catálogos de placas, cantos y herrajes persistidos en IndexedDB.
  - Parámetros y estado provisto explícitamente a través del ViewModel.
- Si un componente requiere un valor por defecto ante una carga inicial o datos vacíos, este debe ser declarado en constantes de configuración centralizadas (ej. `DEFAULT_UI_CONFIG`, `DEFAULT_PROJECT_CONFIG`).

### 2. Google Material Design 3 (M3) en UX/UI
- **Diseño Ergonómico y Mobile-First:**
  - Los objetivos táctiles (*touch targets*) deben tener un tamaño mínimo de **48x48 px** en vistas móviles.
  - El formulario debe ser **contextual**: ocultar todo control o sección que no aplique a la plantilla seleccionada para evitar desplazamiento vertical innecesario.
  - Uso de controles segmentados táctiles (*chips / segmented buttons*), steppers con botones `+` y `-`, y campos numéricos con validación milimétrica inmediata.
- **Tokens y Jerarquía Visual:**
  - Respetar los tokens de color M3 (`surface`, `primary`, `secondary`, `tonal`, `outline`, `error`).
  - Tarjetas elevadas con bordes suaves (`border-radius: 8px - 16px`) y sombras sutiles.
  - Accesibilidad completa: etiquetas semánticas (`<section>`, `<fieldset>`, `<legend>`), atributos `aria-label`, y textos con contraste cromático adecuado según WCAG 2.1 AA.

### 3. Recomendaciones SOLID
- **S — Single Responsibility Principle (SRP):**
  - Los resolutores de cálculo (`src/resolver/`) calculan geometría, física y flecha elástica sin dependencias de React ni del DOM.
  - Los componentes de vista (`src/ui/`) se limitan a renderizar la interfaz y emitir eventos.
  - Los almacenes (`src/storage/`) gestionan exclusivamente la persistencia y migraciones en IndexedDB.
- **O — Open/Closed Principle (OCP):**
  - Arquitectura basada en estrategias y registros (ej. estrategias de mecanizado para confirmat, tarugos, correderas; resolutores de vanos para estantes, cajones, puertas). Se agregan nuevos tipos implementando la interfaz correspondiente sin modificar el motor principal.
- **L — Liskov Substitution Principle (LSP):**
  - Cualquier componente o estrategia que implemente una interfaz común (ej. `IBayContentResolver`) es intercambiable sin alterar el comportamiento esperado del módulo.
- **I — Interface Segregation Principle (ISP):**
  - Interfaces específicas y concisas para props y DTOs, evitando objetos "monolíticos" que fuercen a un componente a depender de propiedades que no utiliza.
- **D — Dependency Inversion Principle (DIP):**
  - Los módulos de alto nivel dependen de abstracciones e interfaces, no de implementaciones concretas.

### 4. Patrón MVVM (Model - View - ViewModel)
- **Model:**
  - Entidades y lógica de dominio pura (`Piece`, `Module`, `Joint`, `BracketCalculationResult`, etc.).
  - Totalmente agnóstico de la vista y del framework de presentación.
- **View:**
  - Componentes de React declarativos (`App.tsx`, `ModuleForm.tsx`, `AssemblySheetView.tsx`, etc.).
  - **No contienen lógica de cálculo de ensambles ni decisiones estructurales**.
  - Consumen propiedades y despachan callbacks provistos por el ViewModel.
- **ViewModel:**
  - Hooks especializados (`useModuleViewModel.ts`, `useMachiningEditorViewModel.ts`).
  - Administran el estado reactivo, memoizan cálculos pesados (`useMemo`), y exponen acciones estables (`useCallback`).
  - **Integridad de dependencias:** Ningún valor reactivo puede omitirse del array de dependencias de `useMemo` o `useCallback`.

### 5. Versionado Continuo Pre-Producción (Semantic Versioning 0.y.z)
- **Incremento obligatorio de versión:** En cada ciclo de cambios o nuevas funcionalidades, es mandatorio actualizar los números de versión:
  - Mantener la versión mayor en `0` (ej: `0.y.z`), dado que el producto está en fase de desarrollo activo pre-producción.
  - Incrementar el índice menor `y` (`0.y.0`) ante nuevas características, resolutores o módulos funcionales.
  - Incrementar el índice de parche `z` (`0.y.z`) ante correcciones puntuales de errores, ajustes de tolerancias o refactorizaciones.
- **Sincronización estricta:**
  - `src/version.ts`: Fuente única de verdad exportada (`APP_VERSION`).
  - `package.json`: Campo `"version"`.
  - La interfaz de usuario (`App.tsx`) consume directamente `APP_VERSION`, sin cadenas cableadas.

---

## 🤖 Agentes Especializados de Calidad

Para asegurar la ejecución rigurosa de estas directivas, se definen los siguientes agentes auxiliares especializados:

| Agente | Especialidad | Responsabilidad Principal |
| :--- | :--- | :--- |
| **`quality-auditor`** | Auditor de Calidad y Principios SOLID | Audita que no existan números o cadenas cableadas en duro (*magic numbers*), verifica la aplicación de los principios SOLID, y audita la precisión matemática y física de los resolutores. |
| **`m3-ux-architect`** | Especialista en UX/UI y Material Design 3 | Revisa y optimiza la ergonomía en dispositivos móviles, tamaño de touch targets, tokens de diseño M3, claridad de diagramas SVG, legibilidad de cotas y accesibilidad. |
| **`mvvm-state-guardian`** | Guardián de Arquitectura MVVM y Reactividad | Garantiza la separación estricta entre Model, View y ViewModel, previene fuga de lógica de dominio hacia componentes React, y verifica que las dependencias de los hooks reactivos estén completas y sin cierres obsoletos. |

---

## 🛠️ Procedimiento de Verificación Continua
Antes de dar por completada cualquier modificación en el repositorio, es mandatorio:
1. **Verificación de tipos:** `npx tsc --noEmit` debe ejecutarse con 0 errores.
2. **Suite de pruebas unitarias y de integración:** `npm test` debe completar el 100% de los tests en verde.
3. **Compilación de producción:** `npm run build` debe generar el bundle de producción y el Service Worker PWA sin fallas.
4. **Sincronización de versión:** Verificar que `src/version.ts` y `package.json` tengan la versión actualizada e idéntica.
