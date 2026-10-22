---
name: cadcat-quality-audit
description: >-
  Audits CadCat codebase against quality and architectural guidelines: Zero-hardcoding, SOLID principles, MVVM separation, React hook dependencies integrity, Material Design 3 ergonomics, typecheck, test suites, and version synchronization.
---

# CadCat Quality Audit Skill

Esta skill define el procedimiento estricto y repetible para auditar la calidad, arquitectura y estabilidad del proyecto **CadCat** según las directivas no negociables establecidas en [`AGENTS.md`](file:///home/federico@uba-ilse.com.ar/mobilius/AGENTS.md).

## 🚀 Verificación Automatizada Rápida

Para verificar de inmediato que los tipos compilen, los tests pasen, el build se genere y las versiones estén sincronizadas:

```bash
./.agents/skills/cadcat-quality-audit/scripts/check-quality.sh
```

---

## 📋 Checklist de Auditoría por Dimensiones

### 1. Cero Hardcoding (Strict No-Hardcoding Policy)
- [ ] **Sin valores mágicos:** Ningún número o string arbitrario en componentes UI ni en algoritmos de resolución (`src/resolver/`).
- [ ] **Fuentes de verdad:** Todas las dimensiones, tolerancias, holguras y especificaciones provienen de:
  - Modelos tipados y validados con Zod (`src/model/`).
  - Configuración del proyecto (`ProjectConfig`).
  - Catálogos persistidos en IndexedDB.
  - Parámetros provistos por el ViewModel.
- [ ] **Valores por defecto centralizados:** Cualquier valor inicial se define en constantes de configuración centralizadas (ej. `DEFAULT_UI_CONFIG`, `DEFAULT_PROJECT_CONFIG`).

### 2. Principios SOLID
- [ ] **SRP (Single Responsibility):**
  - Resolutores (`src/resolver/`): física, geometría y flecha elástica sin dependencias de React ni del DOM.
  - Componentes de vista (`src/ui/`): renderizado y emisión de eventos.
  - Almacenes (`src/storage/`): persistencia y migraciones IndexedDB.
- [ ] **OCP (Open/Closed):** Estrategias intercambiables (mecanizados, vanos) que admiten nuevos tipos implementando interfaces sin modificar el motor principal.
- [ ] **LSP (Liskov Substitution):** Cualquier implementación de interfaz (ej. `IBayContentResolver`) es intercambiable sin efectos colaterales.
- [ ] **ISP (Interface Segregation):** Props y DTOs específicos y concisos; sin objetos monolíticos innecesarios.
- [ ] **DIP (Dependency Inversion):** Los módulos de alto nivel dependen de abstracciones, no de detalles concretos.

### 3. Arquitectura MVVM y Reactividad
- [ ] **Model:** Entidades y lógica de dominio pura (`Piece`, `Module`, `Joint`, etc.), agnóstico de UI.
- [ ] **View:** Componentes React sin lógica de cálculo de ensambles ni decisiones estructurales.
- [ ] **ViewModel:** Custom hooks (`useModuleViewModel`, `useMachiningEditorViewModel`) que gestionan estado y memoizan cálculos (`useMemo`, `useCallback`).
- [ ] **Integridad de dependencias:** Ningún valor reactivo omitido en las dependencias de `useMemo` o `useCallback` (evitar *stale closures*).

### 4. Google Material Design 3 (M3) & Accesibilidad
- [ ] **Touch Targets Móviles:** Objetivos táctiles mínimos de **48x48 px** en vistas móviles.
- [ ] **Ergonomía Thumb Zone:** Controles frecuentes de cambio de cota y pasos anclados en la mitad inferior de pantalla táctil.
- [ ] **Esquemas Contextuales:** Diagramas CAD contextuales visibles y adaptados en pantalla sin bloquear interacción.
- [ ] **Cero Controles Duplicados:** Un solo acceso visible por acción/modo.
- [ ] **Sin Entrada de Texto Intrusiva en Móvil:** Preferencia de chips y steppers sobre campos de texto libre que desplieguen teclados innecesarios.
- [ ] **Tokens de Diseño M3:** Uso consistente de tokens (`surface`, `primary`, `secondary`, `tonal`, `outline`, `error`).
- [ ] **Formularios contextuales:** Secciones y controles irrelevantes se ocultan según la plantilla elegida.
- [ ] **Accesibilidad:** Marcado semántico (`<section>`, `<fieldset>`, `<legend>`), atributos `aria-label`, contraste WCAG 2.1 AA.

### 5. Estricta Política Anti-Regresión y Manejo de Contradicciones
- [ ] **Preservación de Implementaciones Previas:** Funcionalidades solicitadas previamente (ej. botón *Edición Especial*, esquemas técnicos) no deben ser eliminadas en auditorías ni refactors.
- [ ] **Consulta Previa ante Contradicciones:** Si una nueva solicitud parece contradecir una implementación anterior, dialogar y consultar antes de realizar cambios destructivos.

### 6. Versionado Continuo Pre-Producción (SemVer 0.y.z)
- [ ] Mantener versión mayor en `0` (`0.y.z`).
- [ ] Incrementar `y` ante nuevas características/módulos; incrementar `z` ante bugfixes/refactors.
- [ ] **Cero Hardcoding:** `src/version.ts` resuelve dinámicamente `version` desde `package.json` sin strings literales.

---

## 📝 Formato de Salida de Auditoría

Al completar una revisión con esta skill, presentar el resultado en una tabla estructurada:

```markdown
| Dimensión | Estado (✅ / ⚠️ / ❌) | Hallazgos / Observaciones |
| :--- | :--- | :--- |
| Cero Hardcoding | ✅ | Todas las holguras provienen de ProjectConfig y versión dinámica |
| Principios SOLID | ✅ | Resolutores puros y desacoplados |
| Arquitectura MVVM | ✅ | Hooks con dependencias completas |
| Google M3 & Ergonomía | ✅ | Thumb zone respetada, touch targets $\ge 48$px y contraste adecuado |
| Anti-Regresión | ✅ | Accesos a Edición Especial y esquemas CAD preservados |
| Sincronización SemVer | ✅ | Versión dinámica sincronizada con package.json |
| Tests & Build | ✅ | 100% pruebas en verde, build exitoso |
```
