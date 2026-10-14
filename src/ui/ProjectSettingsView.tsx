import { useState, useRef, type ReactElement, type ChangeEvent } from 'react';
import type { ProjectConfig, Material, EdgeBand, Hardware } from '../model';
import { CatalogManagerView } from './CatalogManagerView';

export interface ProjectSettingsViewProps {
  config: ProjectConfig | null;
  isSaving: boolean;
  onUpdateConfig: (config: ProjectConfig) => void;
  onSaveConfig: () => void;
  onExportConfig: () => void;
  onImportConfigFile: (file: File) => void;
  onResetConfig: () => void;
  materials?: Material[];
  edgeBands?: EdgeBand[];
  hardware?: Hardware[];
  onSaveMaterial?: (material: Material) => Promise<void>;
  onDeleteMaterial?: (id: string) => Promise<void>;
  onSaveEdgeBand?: (edgeBand: EdgeBand) => Promise<void>;
  onDeleteEdgeBand?: (id: string) => Promise<void>;
  onSaveHardware?: (hardware: Hardware) => Promise<void>;
  onDeleteHardware?: (id: string) => Promise<void>;
  onResetCatalogs?: () => Promise<void>;
}

/**
 * Project Configuration View adhering to Google Material Design 3 guidelines.
 * Allows editing machining tolerances, saw kerf, project metadata, and costs.
 */
export function ProjectSettingsView({
  config,
  isSaving,
  onUpdateConfig,
  onSaveConfig,
  onExportConfig,
  onImportConfigFile,
  onResetConfig,
  materials = [],
  edgeBands = [],
  hardware = [],
  onSaveMaterial,
  onDeleteMaterial,
  onSaveEdgeBand,
  onDeleteEdgeBand,
  onSaveHardware,
  onDeleteHardware,
  onResetCatalogs,
}: ProjectSettingsViewProps): ReactElement {
  const [activeSection, setActiveSection] = useState<'general' | 'machining' | 'catalog' | 'nesting' | 'costs'>('machining');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!config) {
    return (
      <section aria-labelledby="settings-heading" className="m3-card">
        <h2 id="settings-heading" className="m3-card__title">Configuración del Proyecto</h2>
        <p className="m3-card__subtitle">Cargando configuración de base de datos...</p>
      </section>
    );
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportConfigFile(file);
      e.target.value = '';
    }
  };

  const updateField = <K extends keyof ProjectConfig>(key: K, value: ProjectConfig[K]) => {
    onUpdateConfig({
      ...config,
      [key]: value,
    });
  };

  const updateMachining = (field: keyof ProjectConfig['machining'], value: number) => {
    onUpdateConfig({
      ...config,
      machining: {
        ...config.machining,
        [field]: value,
      },
    });
  };

  const updateNesting = (field: keyof ProjectConfig['nesting'], value: number | boolean) => {
    onUpdateConfig({
      ...config,
      nesting: {
        ...config.nesting,
        [field]: value,
      },
    });
  };

  const updateCost = (field: keyof ProjectConfig['cost'], value: number) => {
    onUpdateConfig({
      ...config,
      cost: {
        ...config.cost,
        [field]: value,
      },
    });
  };

  const updateDeflection = (field: keyof ProjectConfig['deflection'], value: number) => {
    onUpdateConfig({
      ...config,
      deflection: {
        ...config.deflection,
        [field]: value,
      },
    });
  };

  const updateHardware = (field: keyof NonNullable<ProjectConfig['hardware']>, value: number) => {
    onUpdateConfig({
      ...config,
      hardware: {
        ...(config.hardware ?? {}),
        [field]: value,
      },
    });
  };

  return (
    <section aria-labelledby="settings-heading" className="m3-card settings-card">
      {/* Top Header & Actions */}
      <div className="m3-card__header">
        <div>
          <h2 id="settings-heading" className="m3-card__title">
            ⚙️ Menú de Configuración del Proyecto
          </h2>
          <p className="m3-card__subtitle">
            Parámetros de taller, mecanizado y corte gestionados en base de datos y archivos de configuración.
          </p>
        </div>

        <div className="settings-actions">
          <button
            type="button"
            className="m3-button m3-button--filled"
            disabled={isSaving}
            onClick={onSaveConfig}
          >
            {isSaving ? 'Guardando...' : '💾 Guardar en DB'}
          </button>
          <button
            type="button"
            className="m3-button m3-button--tonal"
            onClick={onExportConfig}
          >
            📤 Exportar JSON
          </button>
          <button
            type="button"
            className="m3-button m3-button--outlined"
            onClick={() => fileInputRef.current?.click()}
          >
            📥 Importar JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="m3-button m3-button--outlined"
            onClick={onResetConfig}
          >
            🔄 Restaurar Base
          </button>
        </div>
      </div>

      {/* Mobile Section Switcher */}
      <div className="settings-section-selector-mobile">
        <label htmlFor="settings-section-select" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
          Sección de Configuración:
        </label>
        <select
          id="settings-section-select"
          className="m3-select"
          style={{ width: '100%', fontSize: '0.9rem', marginBottom: '0.75rem' }}
          value={activeSection}
          onChange={(e) => setActiveSection(e.target.value as 'general' | 'machining' | 'catalog' | 'nesting' | 'costs')}
        >
          <option value="machining">🛠️ Mecanizado del Proyecto</option>
          <option value="catalog">🗄️ Insumos & Base de Datos</option>
          <option value="nesting">🪚 Sierra & Nesting</option>
          <option value="general">📋 Proyecto & Cliente</option>
          <option value="costs">📐 Deflexión & Costos</option>
        </select>
      </div>

      {/* Navigation Sub-Tabs */}
      <nav aria-label="Secciones de Configuración" className="settings-subtabs">
        <button
          type="button"
          className={`settings-tab-btn ${activeSection === 'machining' ? 'active' : ''}`}
          onClick={() => setActiveSection('machining')}
        >
          🛠️ Mecanizado del Proyecto
        </button>
        <button
          type="button"
          className={`settings-tab-btn ${activeSection === 'catalog' ? 'active' : ''}`}
          onClick={() => setActiveSection('catalog')}
        >
          🗄️ Insumos & Base de Datos
        </button>
        <button
          type="button"
          className={`settings-tab-btn ${activeSection === 'nesting' ? 'active' : ''}`}
          onClick={() => setActiveSection('nesting')}
        >
          🪚 Sierra & Nesting
        </button>
        <button
          type="button"
          className={`settings-tab-btn ${activeSection === 'general' ? 'active' : ''}`}
          onClick={() => setActiveSection('general')}
        >
          📋 Proyecto & Cliente
        </button>
        <button
          type="button"
          className={`settings-tab-btn ${activeSection === 'costs' ? 'active' : ''}`}
          onClick={() => setActiveSection('costs')}
        >
          📐 Deflexión & Costos
        </button>
      </nav>

      {/* SECTION: Machining & Workshop Defaults */}
      {activeSection === 'machining' && (
        <div className="settings-section">
          <h3 className="section-title">Parámetros de Mecanizado del Proyecto (Valores por Defecto)</h3>
          <p className="section-desc">
            Configuración general de uniones para este proyecto. Podés sobreescribir la fijación de una placa en particular (por ejemplo, usar Minifix o tarugos ocultos para evitar tornillos pasantes en un lateral visto) seleccionándola directamente en la vista 3D o en el despiece.
          </p>

          <div className="settings-grid">
            {/* Confirmat */}
            <div className="settings-group-card">
              <h4 className="group-title">Tornillo Confirmat</h4>
              <div className="input-field">
                <label htmlFor="confirmatThrough">Diámetro Pasante (mm):</label>
                <input
                  id="confirmatThrough"
                  type="number"
                  step="0.1"
                  value={config.machining.confirmatThroughDiameterMm}
                  onChange={(e) => updateMachining('confirmatThroughDiameterMm', parseFloat(e.target.value) || 7.0)}
                />
              </div>
              <div className="input-field">
                <label htmlFor="confirmatCore">Diámetro Núcleo en Canto (mm):</label>
                <input
                  id="confirmatCore"
                  type="number"
                  step="0.1"
                  value={config.machining.confirmatCoreDiameterMm}
                  onChange={(e) => updateMachining('confirmatCoreDiameterMm', parseFloat(e.target.value) || 5.0)}
                />
              </div>
              <div className="input-field">
                <label htmlFor="confirmatDepth">Profundidad en Canto (mm):</label>
                <input
                  id="confirmatDepth"
                  type="number"
                  step="1"
                  value={config.machining.confirmatCoreDepthMm}
                  onChange={(e) => updateMachining('confirmatCoreDepthMm', parseFloat(e.target.value) || 50.0)}
                />
              </div>
            </div>

            {/* Minifix */}
            <div className="settings-group-card">
              <h4 className="group-title">Unión Minifix / Rastex</h4>
              <div className="input-field">
                <label htmlFor="minifixPocket">Diámetro de Caja (mm):</label>
                <input
                  id="minifixPocket"
                  type="number"
                  step="0.5"
                  value={config.machining.minifixPocketDiameterMm}
                  onChange={(e) => updateMachining('minifixPocketDiameterMm', parseFloat(e.target.value) || 15.0)}
                />
              </div>
              <div className="input-field">
                <label htmlFor="minifixDepth">Profundidad de Caja (mm):</label>
                <input
                  id="minifixDepth"
                  type="number"
                  step="0.1"
                  value={config.machining.minifixPocketDepthMm}
                  onChange={(e) => updateMachining('minifixPocketDepthMm', parseFloat(e.target.value) || 13.5)}
                />
              </div>
              <div className="input-field">
                <label htmlFor="minifixSetback">Distancia al Canto / Setback (mm):</label>
                <input
                  id="minifixSetback"
                  type="number"
                  step="1"
                  value={config.machining.minifixPocketSetbackMm}
                  onChange={(e) => updateMachining('minifixPocketSetbackMm', parseFloat(e.target.value) || 34.0)}
                />
              </div>
              <div className="input-field">
                <label htmlFor="minifixBolt">Diámetro Perno (mm):</label>
                <input
                  id="minifixBolt"
                  type="number"
                  step="0.5"
                  value={config.machining.minifixBoltDiameterMm}
                  onChange={(e) => updateMachining('minifixBoltDiameterMm', parseFloat(e.target.value) || 8.0)}
                />
              </div>
            </div>

            {/* Dowels */}
            <div className="settings-group-card">
              <h4 className="group-title">Tarugos de Madera</h4>
              <div className="input-field">
                <label htmlFor="dowelFaceDia">Diámetro en Cara (mm):</label>
                <input
                  id="dowelFaceDia"
                  type="number"
                  step="0.5"
                  value={config.machining.dowelFaceDiameterMm}
                  onChange={(e) => updateMachining('dowelFaceDiameterMm', parseFloat(e.target.value) || 8.0)}
                />
              </div>
              <div className="input-field">
                <label htmlFor="dowelFaceDep">Profundidad en Cara (mm):</label>
                <input
                  id="dowelFaceDep"
                  type="number"
                  step="1"
                  value={config.machining.dowelFaceDepthMm}
                  onChange={(e) => updateMachining('dowelFaceDepthMm', parseFloat(e.target.value) || 12.0)}
                />
              </div>
              <div className="input-field">
                <label htmlFor="dowelEdgeDia">Diámetro en Canto (mm):</label>
                <input
                  id="dowelEdgeDia"
                  type="number"
                  step="0.5"
                  value={config.machining.dowelEdgeDiameterMm}
                  onChange={(e) => updateMachining('dowelEdgeDiameterMm', parseFloat(e.target.value) || 8.0)}
                />
              </div>
              <div className="input-field">
                <label htmlFor="dowelEdgeDep">Profundidad en Canto (mm):</label>
                <input
                  id="dowelEdgeDep"
                  type="number"
                  step="1"
                  value={config.machining.dowelEdgeDepthMm}
                  onChange={(e) => updateMachining('dowelEdgeDepthMm', parseFloat(e.target.value) || 25.0)}
                />
              </div>
            </div>

            {/* Hinges & System 32 */}
            <div className="settings-group-card">
              <h4 className="group-title">Bisagras & Sistema 32</h4>
              <div className="input-field">
                <label htmlFor="hingeCupDia">Cazoleta Bisagra Ø (mm):</label>
                <input
                  id="hingeCupDia"
                  type="number"
                  step="1"
                  value={config.machining.hingeCupDiameterMm}
                  onChange={(e) => updateMachining('hingeCupDiameterMm', parseFloat(e.target.value) || 35.0)}
                />
              </div>
              <div className="input-field">
                <label htmlFor="hingeCupDep">Profundidad Cazoleta (mm):</label>
                <input
                  id="hingeCupDep"
                  type="number"
                  step="0.5"
                  value={config.machining.hingeCupDepthMm}
                  onChange={(e) => updateMachining('hingeCupDepthMm', parseFloat(e.target.value) || 12.0)}
                />
              </div>
              <div className="input-field">
                <label htmlFor="hingeCupSetback">Distancia al Canto Cazoleta (mm):</label>
                <input
                  id="hingeCupSetback"
                  type="number"
                  step="0.5"
                  value={config.machining.hingeCupEdgeSetbackMm}
                  onChange={(e) => updateMachining('hingeCupEdgeSetbackMm', parseFloat(e.target.value) || 21.5)}
                />
              </div>
              <div className="input-field">
                <label htmlFor="sys32Setback">Línea Frontal Sistema 32 (mm):</label>
                <input
                  id="sys32Setback"
                  type="number"
                  step="1"
                  value={config.machining.system32FrontSetbackMm}
                  onChange={(e) => updateMachining('system32FrontSetbackMm', parseFloat(e.target.value) || 37.0)}
                />
              </div>
              <div className="input-field">
                <label htmlFor="jointMargin">Margen de Extremos de Junta (mm):</label>
                <input
                  id="jointMargin"
                  type="number"
                  step="1"
                  value={config.machining.jointDrillMarginMm}
                  onChange={(e) => updateMachining('jointDrillMarginMm', parseFloat(e.target.value) || 50.0)}
                />
              </div>
              <div className="input-field">
                <label htmlFor="maxSpan">Vano Máx. Sin Agujero Central (mm):</label>
                <input
                  id="maxSpan"
                  type="number"
                  step="50"
                  value={config.machining.maxSpanWithoutCenterDrillMm}
                  onChange={(e) => updateMachining('maxSpanWithoutCenterDrillMm', parseFloat(e.target.value) || 600.0)}
                />
              </div>
            </div>

            {/* Hardware Clearances & Mounting Gaps */}
            <div className="settings-group-card">
              <h4 className="group-title">Herrajes & Holguras de Montaje</h4>
              <div className="input-field">
                <label htmlFor="slideTelescopic">Corredera Telescópica (mm):</label>
                <input
                  id="slideTelescopic"
                  type="number"
                  step="0.1"
                  value={config.hardware?.slideClearanceTelescopicMm ?? 25.4}
                  onChange={(e) => updateHardware('slideClearanceTelescopicMm', parseFloat(e.target.value) || 25.4)}
                />
              </div>
              <div className="input-field">
                <label htmlFor="slideUndermount">Corredera Oculta / Undermount (mm):</label>
                <input
                  id="slideUndermount"
                  type="number"
                  step="0.5"
                  value={config.hardware?.slideClearanceUndermountMm ?? 10.0}
                  onChange={(e) => updateHardware('slideClearanceUndermountMm', parseFloat(e.target.value) || 10.0)}
                />
              </div>
              <div className="input-field">
                <label htmlFor="slideMetalBox">Cajón Metálico / Metal-box (mm):</label>
                <input
                  id="slideMetalBox"
                  type="number"
                  step="0.5"
                  value={config.hardware?.slideClearanceMetalBoxMm ?? 31.0}
                  onChange={(e) => updateHardware('slideClearanceMetalBoxMm', parseFloat(e.target.value) || 31.0)}
                />
              </div>
              <div className="input-field">
                <label htmlFor="drawerGap">Luz entre Frentes de Cajón (mm):</label>
                <input
                  id="drawerGap"
                  type="number"
                  step="0.5"
                  value={config.hardware?.drawerFrontGapMm ?? 3.0}
                  onChange={(e) => updateHardware('drawerFrontGapMm', parseFloat(e.target.value) || 3.0)}
                />
              </div>
              <div className="input-field">
                <label htmlFor="doorOverlayReveal">Luz Puerta Solapada (mm):</label>
                <input
                  id="doorOverlayReveal"
                  type="number"
                  step="0.5"
                  value={config.hardware?.doorOverlayRevealMm ?? 1.5}
                  onChange={(e) => updateHardware('doorOverlayRevealMm', parseFloat(e.target.value) || 1.5)}
                />
              </div>
              <div className="input-field">
                <label htmlFor="doorInsetGap">Luz Puerta Embutida / Inset (mm):</label>
                <input
                  id="doorInsetGap"
                  type="number"
                  step="0.5"
                  value={config.hardware?.doorInsetGapMm ?? 2.0}
                  onChange={(e) => updateHardware('doorInsetGapMm', parseFloat(e.target.value) || 2.0)}
                />
              </div>
              <div className="input-field">
                <label htmlFor="doorHingeMargin">Margen Extremo Bisagra (mm):</label>
                <input
                  id="doorHingeMargin"
                  type="number"
                  step="5"
                  value={config.hardware?.doorHingeMarginMm ?? 100.0}
                  onChange={(e) => updateHardware('doorHingeMarginMm', parseFloat(e.target.value) || 100.0)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: Catalog & Workshop Database */}
      {activeSection === 'catalog' && (
        <div className="settings-section">
          <h3 className="section-title">Base de Datos de Insumos del Taller</h3>
          <p className="section-desc">
            Configuración persistente en base de datos local (IndexedDB) para placas, tapacantos, herrajes y fijaciones. Podés dar de alta, editar o eliminar materiales sin tocar el código.
          </p>
          <CatalogManagerView
            materials={materials}
            edgeBands={edgeBands}
            hardware={hardware}
            onSaveMaterial={onSaveMaterial ?? (async () => {})}
            onDeleteMaterial={onDeleteMaterial ?? (async () => {})}
            onSaveEdgeBand={onSaveEdgeBand ?? (async () => {})}
            onDeleteEdgeBand={onDeleteEdgeBand ?? (async () => {})}
            onSaveHardware={onSaveHardware ?? (async () => {})}
            onDeleteHardware={onDeleteHardware ?? (async () => {})}
            onResetCatalogs={onResetCatalogs ?? (async () => {})}
          />
        </div>
      )}

      {/* SECTION: Sawing & Nesting */}
      {activeSection === 'nesting' && (
        <div className="settings-section">
          <h3 className="section-title">Parámetros de Sierra y Optimización de Corte</h3>
          <p className="section-desc">
            Configuración de la seccionadora o escuadradora y refilado de placas.
          </p>

          <div className="settings-grid">
            <div className="settings-group-card">
              <h4 className="group-title">Sierra y Desperdicio</h4>
              <div className="input-field">
                <label htmlFor="sawKerf">Espesor de Corte de Hoja / Kerf (mm):</label>
                <input
                  id="sawKerf"
                  type="number"
                  step="0.1"
                  value={config.nesting.sawKerfMm}
                  onChange={(e) => updateNesting('sawKerfMm', parseFloat(e.target.value) || 4.4)}
                />
                <span className="field-hint">Espesor del disco de corte (típicamente 3.2 a 4.4 mm).</span>
              </div>

              <div className="input-field">
                <label htmlFor="trimMargin">Margen de Refilado de Placa (mm):</label>
                <input
                  id="trimMargin"
                  type="number"
                  step="1"
                  value={config.nesting.sheetTrimMarginMm}
                  onChange={(e) => updateNesting('sheetTrimMarginMm', parseFloat(e.target.value) || 10.0)}
                />
                <span className="field-hint">Corte perimetral para sanear bordes de la placa virgen.</span>
              </div>

              <div className="input-field-checkbox">
                <label htmlFor="respectGrain">
                  <input
                    id="respectGrain"
                    type="checkbox"
                    checked={config.nesting.respectGrain}
                    onChange={(e) => updateNesting('respectGrain', e.target.checked)}
                  />
                  <span>Respetar dirección de veta del material</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: Project & Client */}
      {activeSection === 'general' && (
        <div className="settings-section">
          <h3 className="section-title">Datos del Proyecto y Cliente</h3>
          <div className="settings-grid">
            <div className="settings-group-card">
              <h4 className="group-title">Información General</h4>
              <div className="input-field">
                <label htmlFor="projectId">Identificador del Proyecto:</label>
                <input
                  id="projectId"
                  type="text"
                  value={config.projectId}
                  onChange={(e) => updateField('projectId', e.target.value)}
                />
              </div>
              <div className="input-field">
                <label htmlFor="projectName">Nombre del Proyecto:</label>
                <input
                  id="projectName"
                  type="text"
                  value={config.projectName}
                  onChange={(e) => updateField('projectName', e.target.value)}
                />
              </div>
              <div className="input-field">
                <label htmlFor="clientName">Cliente:</label>
                <input
                  id="clientName"
                  type="text"
                  value={config.clientName}
                  onChange={(e) => updateField('clientName', e.target.value)}
                />
              </div>
              <div className="input-field">
                <label htmlFor="projectDesc">Descripción y Notas:</label>
                <textarea
                  id="projectDesc"
                  rows={3}
                  value={config.description}
                  onChange={(e) => updateField('description', e.target.value)}
                />
              </div>
            </div>

            <div className="settings-group-card">
              <h4 className="group-title">Unidades</h4>
              <div className="input-field">
                <label htmlFor="currency">Moneda:</label>
                <input
                  id="currency"
                  type="text"
                  value={config.units.currency}
                  onChange={(e) =>
                    onUpdateConfig({
                      ...config,
                      units: { ...config.units, currency: e.target.value },
                    })
                  }
                />
              </div>
              <div className="input-field">
                <label htmlFor="lengthUnit">Unidad de Longitud:</label>
                <input
                  id="lengthUnit"
                  type="text"
                  disabled
                  value={config.units.length}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION: Deflection & Cost */}
      {activeSection === 'costs' && (
        <div className="settings-section">
          <h3 className="section-title">Parámetros de Deflexión de Estantes y Costos</h3>
          <div className="settings-grid">
            <div className="settings-group-card">
              <h4 className="group-title">Deflexión y Resistencia</h4>
              <div className="input-field">
                <label htmlFor="maxDeflectionRatio">Límite de Flecha Relativa (L / x):</label>
                <input
                  id="maxDeflectionRatio"
                  type="number"
                  step="10"
                  value={config.deflection.maxDeflectionRatio}
                  onChange={(e) => updateDeflection('maxDeflectionRatio', parseFloat(e.target.value) || 200)}
                />
                <span className="field-hint">Típicamente L/200 para muebles estándar.</span>
              </div>
              <div className="input-field">
                <label htmlFor="maxAbsDeflection">Flecha Máxima Absoluta (mm):</label>
                <input
                  id="maxAbsDeflection"
                  type="number"
                  step="0.5"
                  value={config.deflection.maxAbsoluteDeflectionMm}
                  onChange={(e) => updateDeflection('maxAbsoluteDeflectionMm', parseFloat(e.target.value) || 3.0)}
                />
              </div>
              <div className="input-field">
                <label htmlFor="uniformLoad">Carga de Diseño Uniforme (kg/m²):</label>
                <input
                  id="uniformLoad"
                  type="number"
                  step="5"
                  value={config.deflection.designUniformLoadKgM2}
                  onChange={(e) => updateDeflection('designUniformLoadKgM2', parseFloat(e.target.value) || 30.0)}
                />
              </div>
            </div>

            <div className="settings-group-card">
              <h4 className="group-title">Costos</h4>
              <div className="input-field">
                <label htmlFor="wasteFactor">Factor de Desperdicio Adicional (%):</label>
                <input
                  id="wasteFactor"
                  type="number"
                  step="1"
                  value={config.cost.wasteFactorPercent}
                  onChange={(e) => updateCost('wasteFactorPercent', parseFloat(e.target.value) || 10.0)}
                />
              </div>
              <div className="input-field">
                <label htmlFor="laborRate">Tarifa Horaria de Taller:</label>
                <input
                  id="laborRate"
                  type="number"
                  step="10"
                  value={config.cost.hourlyLaborRate}
                  onChange={(e) => updateCost('hourlyLaborRate', parseFloat(e.target.value) || 0.0)}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
