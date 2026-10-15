import type { ReactElement } from 'react';
import type {
  CountertopDefinition,
  CountertopEdgeFinish,
  CountertopMaterial,
  EquipmentItem,
} from '../model';
import type { CountertopCalculationResult } from '../resolver';
import { generateMarmoleriaSheetSvg } from '../resolver';

export interface CountertopEditorViewProps {
  countertopEnabled: boolean;
  onToggleCountertop: (enabled: boolean) => void;
  countertopCalculation: CountertopCalculationResult | null;
  countertopDefinition: CountertopDefinition;
  countertopMaterials: CountertopMaterial[];
  equipmentCatalog: EquipmentItem[];
  selectedMaterialId: string;
  onSelectMaterial: (id: string) => void;
  selectedEquipmentId: string;
  onSelectEquipment: (id: string) => void;
  sinkDrawerAdaptation: 'false-front' | 'u-shape-drawer' | 'none';
  onSelectSinkDrawerAdaptation: (mode: 'false-front' | 'u-shape-drawer' | 'none') => void;
  frontRailOrientation: 'vertical' | 'horizontal' | 'suppressed';
  onSelectFrontRailOrientation: (orientation: 'vertical' | 'horizontal' | 'suppressed') => void;
  frontOverhangMm: number;
  onFrontOverhangChange: (val: number) => void;
  edgeFinish: CountertopEdgeFinish;
  onEdgeFinishChange: (finish: CountertopEdgeFinish) => void;
  hasBacksplash: boolean;
  onToggleBacksplash: (hasSplash: boolean) => void;
  backsplashHeightMm: number;
  onBacksplashHeightChange: (h: number) => void;
  onExportPdf: () => void;
}

export function CountertopEditorView({
  countertopEnabled,
  onToggleCountertop,
  countertopCalculation,
  countertopDefinition,
  countertopMaterials,
  equipmentCatalog,
  selectedMaterialId,
  onSelectMaterial,
  selectedEquipmentId,
  onSelectEquipment,
  sinkDrawerAdaptation,
  onSelectSinkDrawerAdaptation,
  frontRailOrientation,
  onSelectFrontRailOrientation,
  frontOverhangMm,
  onFrontOverhangChange,
  edgeFinish,
  onEdgeFinishChange,
  hasBacksplash,
  onToggleBacksplash,
  backsplashHeightMm,
  onBacksplashHeightChange,
  onExportPdf,
}: CountertopEditorViewProps): ReactElement {
  const isSink = selectedEquipmentId.startsWith('eq-sink');

  return (
    <div className="m3-page" style={{ padding: '16px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <section className="m3-card" style={{ marginBottom: '16px' }}>
        <div className="m3-card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 className="m3-card__title" style={{ fontSize: '1.4rem', margin: 0 }}>
              🪨 Mesada y Plano de Marmolería
            </h2>
            <p className="m3-card__subtitle" style={{ margin: '4px 0 0 0', color: 'var(--md-sys-color-outline)' }}>
              Cálculo de cargas, calados de bacha/anafe, adaptación del mueble bajo mesada y plano técnico acotado ({countertopDefinition.widthMm} × {countertopDefinition.depthMm} mm).
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={countertopEnabled}
                onChange={(e) => onToggleCountertop(e.target.checked)}
                style={{ width: '20px', height: '20px', accentColor: 'var(--md-sys-color-primary)' }}
              />
              Habilitar Mesada
            </label>

            {countertopEnabled && countertopCalculation && (
              <button
                type="button"
                className="m3-button m3-button--filled"
                onClick={onExportPdf}
                style={{ minHeight: '44px', padding: '0 16px' }}
              >
                📄 Exportar Plano PDF
              </button>
            )}
          </div>
        </div>
      </section>

      {!countertopEnabled ? (
        <section className="m3-card" style={{ textAlign: 'center', padding: '32px' }}>
          <p style={{ color: 'var(--md-sys-color-outline)', fontSize: '1.05rem', margin: 0 }}>
            La mesada se encuentra desactivada para este mueble. Marca la casilla <strong>"Habilitar Mesada"</strong> para calcular materiales, calados de bacha y generar el plano para el marmolero.
          </p>
        </section>
      ) : (
        <>
          {/* Controls Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            {/* Card 1: Material & Finish */}
            <section className="m3-card" style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 12px 0', color: 'var(--md-sys-color-on-surface)' }}>
                1. Material y Espesor de la Piedra
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  Tipo de Material:
                  <select
                    className="m3-select"
                    value={selectedMaterialId}
                    onChange={(e) => onSelectMaterial(e.target.value)}
                    style={{ width: '100%', marginTop: '4px', minHeight: '44px', borderRadius: '8px', padding: '0 10px' }}
                  >
                    {countertopMaterials.map((mat) => (
                      <option key={mat.id} value={mat.id}>
                        {mat.name} ({mat.densityKgM2} kg/m²)
                      </option>
                    ))}
                  </select>
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    Terminación de Canto:
                    <select
                      className="m3-select"
                      value={edgeFinish}
                      onChange={(e) => onEdgeFinishChange(e.target.value as CountertopEdgeFinish)}
                      style={{ width: '100%', marginTop: '4px', minHeight: '44px', borderRadius: '8px', padding: '0 8px' }}
                    >
                      <option value="straight-polished">Canto Recto Pulido</option>
                      <option value="bevel-2mm">Bisel 2 mm</option>
                      <option value="bullnose">Media Caña</option>
                      <option value="mitered-skirt">Inglete con Faldón</option>
                    </select>
                  </label>

                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                    Vuelo Frontal (mm):
                    <input
                      type="number"
                      className="m3-input"
                      value={frontOverhangMm}
                      onChange={(e) => onFrontOverhangChange(Number(e.target.value))}
                      min={0}
                      max={400}
                      style={{ width: '100%', marginTop: '4px', minHeight: '44px', borderRadius: '8px', padding: '0 10px' }}
                    />
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={hasBacksplash}
                      onChange={(e) => onToggleBacksplash(e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--md-sys-color-primary)' }}
                    />
                    Zócalo Sanitario (Trasero)
                  </label>

                  {hasBacksplash && (
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                      Alto:
                      <input
                        type="number"
                        className="m3-input"
                        value={backsplashHeightMm}
                        onChange={(e) => onBacksplashHeightChange(Number(e.target.value))}
                        min={30}
                        max={200}
                        style={{ width: '70px', minHeight: '36px', borderRadius: '6px', padding: '0 6px' }}
                      />
                      mm
                    </label>
                  )}
                </div>
              </div>
            </section>

            {/* Card 2: Equipment & Cabinet Adaptation */}
            <section className="m3-card" style={{ padding: '16px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 12px 0', color: 'var(--md-sys-color-on-surface)' }}>
                2. Bacha / Anafe y Mueble
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  Equipamiento Incrustado:
                  <select
                    className="m3-select"
                    value={selectedEquipmentId}
                    onChange={(e) => onSelectEquipment(e.target.value)}
                    style={{ width: '100%', marginTop: '4px', minHeight: '44px', borderRadius: '8px', padding: '0 10px' }}
                  >
                    <option value="none">Sin bacha ni anafe (Ciego)</option>
                    {equipmentCatalog.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.brandModel}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Contextual Sink Drawer Adaptation */}
                {isSink && (
                  <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '6px' }}>
                      Adaptación de Cajón Superior (Sifón):
                    </span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className={`m3-button ${sinkDrawerAdaptation === 'false-front' ? 'm3-button--filled' : 'm3-button--tonal'}`}
                        onClick={() => onSelectSinkDrawerAdaptation('false-front')}
                        style={{ fontSize: '0.8rem', minHeight: '40px', padding: '0 10px' }}
                      >
                        ✓ Falso Frente Fijo
                      </button>
                      <button
                        type="button"
                        className={`m3-button ${sinkDrawerAdaptation === 'u-shape-drawer' ? 'm3-button--filled' : 'm3-button--tonal'}`}
                        onClick={() => onSelectSinkDrawerAdaptation('u-shape-drawer')}
                        style={{ fontSize: '0.8rem', minHeight: '40px', padding: '0 10px' }}
                      >
                        ⊔ Cajón Escotado en "U"
                      </button>
                    </div>
                  </div>
                )}

                {/* Stretcher Rail Orientation */}
                <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: '6px' }}>
                    Travesaño Superior Delantero:
                  </span>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className={`m3-button ${frontRailOrientation === 'vertical' ? 'm3-button--filled' : 'm3-button--tonal'}`}
                      onClick={() => onSelectFrontRailOrientation('vertical')}
                      style={{ fontSize: '0.8rem', minHeight: '40px', padding: '0 10px' }}
                      title="Coloca el travesaño de canto: 15x más resistente y no interfiere con la cuba"
                    >
                      🪵 De Canto / Vertical (Recomendado)
                    </button>
                    <button
                      type="button"
                      className={`m3-button ${frontRailOrientation === 'suppressed' ? 'm3-button--filled' : 'm3-button--tonal'}`}
                      onClick={() => onSelectFrontRailOrientation('suppressed')}
                      style={{ fontSize: '0.8rem', minHeight: '40px', padding: '0 10px' }}
                    >
                      ✕ Suprimir Travesaño
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Card 3: Real-Time Diagnostic */}
            {countertopCalculation && (
              <section className="m3-card" style={{ padding: '16px', background: '#f8fafc', border: '1px solid #cbd5e1' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 12px 0', color: '#0f172a' }}>
                  3. Diagnóstico Físico & Estructural
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem', color: '#334155' }}>
                  <div>
                    <strong>Superficie de Piedra:</strong> {countertopCalculation.areaM2} m² (
                    {countertopCalculation.widthMm} x {countertopCalculation.depthMm} x {countertopCalculation.thicknessMm} mm)
                  </div>
                  <div>
                    <strong>Peso Total Estimado:</strong> ~{countertopCalculation.totalWeightKg} kg
                  </div>
                  <div>
                    <strong>Estado del Voladizo ({countertopCalculation.overhangAnalysis.frontOverhangMm} mm):</strong>{' '}
                    {countertopCalculation.overhangAnalysis.needsBrackets ? (
                      <span style={{ color: '#dc2626', fontWeight: 700 }}>
                        ⚠️ Excesivo (Requiere ménsula de soporte)
                      </span>
                    ) : (
                      <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ Seguro sin refuerzo</span>
                    )}
                  </div>

                  {countertopCalculation.cutouts.map((c, i) => (
                    <div key={i} style={{ marginTop: '4px', paddingTop: '6px', borderTop: '1px dashed #cbd5e1' }}>
                      <strong>{c.brandModel}:</strong>
                      <br />
                      Puente Frontal: {c.remainingBridgesMm.frontMm} mm | Posterior: {c.remainingBridgesMm.backMm} mm
                      <br />
                      {c.isSafeStoneBridge ? (
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Puentes de piedra seguros contra rotura</span>
                      ) : (
                        <span style={{ color: '#dc2626', fontWeight: 600 }}>⚠️ {c.warnings[0]}</span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Technical Workshop Drawing */}
          {countertopCalculation && (
            <section className="m3-card" style={{ marginTop: '16px' }}>
              <div style={{ padding: '16px 16px 8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--md-sys-color-on-surface)' }}>
                  📐 Plano Técnico de Marmolería y Replanteo
                </h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-outline)' }}>
                  Vista superior milimétrica acotada
                </span>
              </div>

              <div
                style={{
                  padding: '12px',
                  background: '#ffffff',
                  borderRadius: '8px',
                  overflowX: 'auto',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div
                  dangerouslySetInnerHTML={{
                    __html: generateMarmoleriaSheetSvg(countertopCalculation),
                  }}
                />
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
