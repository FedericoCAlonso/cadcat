import { useState, type ReactElement } from 'react';
import type { Material, EdgeBand, Hardware, EdgeBandKind, JointKind } from '../model';
import { NumericInput } from './NumericInput';
import { t } from '../locales';

export interface CatalogManagerViewProps {
  materials: Material[];
  edgeBands: EdgeBand[];
  hardware: Hardware[];
  onSaveMaterial: (material: Material) => Promise<void>;
  onDeleteMaterial: (id: string) => Promise<void>;
  onSaveEdgeBand: (edgeBand: EdgeBand) => Promise<void>;
  onDeleteEdgeBand: (id: string) => Promise<void>;
  onSaveHardware: (hardware: Hardware) => Promise<void>;
  onDeleteHardware: (id: string) => Promise<void>;
  onResetCatalogs: () => Promise<void>;
}

export function CatalogManagerView({
  materials,
  edgeBands,
  hardware,
  onSaveMaterial,
  onDeleteMaterial,
  onSaveEdgeBand,
  onDeleteEdgeBand,
  onSaveHardware,
  onDeleteHardware,
  onResetCatalogs,
}: CatalogManagerViewProps): ReactElement {
  const [activeCatalogTab, setActiveCatalogTab] = useState<'materials' | 'edgeBands' | 'hardware'>('materials');
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [isAddingEdgeBand, setIsAddingEdgeBand] = useState(false);
  const [isAddingHardware, setIsAddingHardware] = useState(false);

  // Material Form state
  const [matId, setMatId] = useState('');
  const [matName, setMatName] = useState('');
  const [matThickness, setMatThickness] = useState(18);
  const [matLength, setMatLength] = useState(2750);
  const [matWidth, setMatWidth] = useState(1830);
  const [matHasGrain, setMatHasGrain] = useState(false);
  const [matPrice, setMatPrice] = useState<number | ''>('');

  // EdgeBand Form state
  const [ebId, setEbId] = useState('');
  const [ebKind, setEbKind] = useState<EdgeBandKind>('adhesive');
  const [ebThickness, setEbThickness] = useState(0.8);
  const [ebPrice, setEbPrice] = useState<number | ''>('');
  const [ebNeedsGroove, setEbNeedsGroove] = useState(false);

  // Hardware Form state
  const [hwId, setHwId] = useState('');
  const [hwName, setHwName] = useState('');
  const [hwJointKind, setHwJointKind] = useState<JointKind>('confirmat');
  const [hwPrice, setHwPrice] = useState<number | ''>('');

  // Material actions
  const handleSaveMat = async () => {
    if (!matName.trim()) return;
    const id = matId.trim() || `mat-${Date.now()}`;
    const newMat: Material = {
      schemaVersion: 1,
      id,
      name: matName.trim(),
      thicknessMm: matThickness,
      sheetSizeMm: {
        length: matLength,
        width: matWidth,
      },
      hasGrain: matHasGrain,
      milling: {
        hidden: 'yes',
        visible: 'yes',
        onStructuralPiece: 'yes',
      },
      pricePerSheet: typeof matPrice === 'number' ? matPrice : 'TO_CONFIRM',
    };
    await onSaveMaterial(newMat);
    setIsAddingMaterial(false);
    setMatId('');
    setMatName('');
    setMatPrice('');
  };

  const handleEditMat = (m: Material) => {
    setMatId(m.id);
    setMatName(m.name);
    setMatThickness(typeof m.thicknessMm === 'number' ? m.thicknessMm : 18);
    setMatLength(typeof m.sheetSizeMm.length === 'number' ? m.sheetSizeMm.length : 2750);
    setMatWidth(typeof m.sheetSizeMm.width === 'number' ? m.sheetSizeMm.width : 1830);
    setMatHasGrain(m.hasGrain);
    setMatPrice(typeof m.pricePerSheet === 'number' ? m.pricePerSheet : '');
    setIsAddingMaterial(true);
  };

  // EdgeBand actions
  const handleSaveEb = async () => {
    const id = ebId.trim() || `eb-${Date.now()}`;
    const newEb: EdgeBand = {
      schemaVersion: 1,
      id,
      kind: ebKind,
      thicknessMm: ebThickness,
      pricePerMeter: typeof ebPrice === 'number' ? ebPrice : 'TO_CONFIRM',
      needsGroove: ebNeedsGroove,
    };
    await onSaveEdgeBand(newEb);
    setIsAddingEdgeBand(false);
    setEbId('');
    setEbPrice('');
  };

  const handleEditEb = (b: EdgeBand) => {
    setEbId(b.id);
    setEbKind(b.kind);
    setEbThickness(typeof b.thicknessMm === 'number' ? b.thicknessMm : 0.8);
    setEbPrice(typeof b.pricePerMeter === 'number' ? b.pricePerMeter : '');
    setEbNeedsGroove(Boolean(b.needsGroove));
    setIsAddingEdgeBand(true);
  };

  // Hardware actions
  const handleSaveHw = async () => {
    if (!hwName.trim()) return;
    const id = hwId.trim() || `hw-${Date.now()}`;
    const newHw: Hardware = {
      schemaVersion: 1,
      id,
      name: hwName.trim(),
      jointKind: hwJointKind,
      pricePerUnit: typeof hwPrice === 'number' ? hwPrice : 'TO_CONFIRM',
    };
    await onSaveHardware(newHw);
    setIsAddingHardware(false);
    setHwId('');
    setHwName('');
    setHwPrice('');
  };

  const handleEditHw = (h: Hardware) => {
    setHwId(h.id);
    setHwName(h.name);
    setHwJointKind((h.jointKind as JointKind) || 'confirmat');
    setHwPrice(typeof h.pricePerUnit === 'number' ? h.pricePerUnit : '');
    setIsAddingHardware(true);
  };

  return (
    <div className="catalog-manager-container">
      <div className="catalog-subtabs-row" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeCatalogTab === 'materials'}
          className={`settings-tab-btn ${activeCatalogTab === 'materials' ? 'active' : ''}`}
          onClick={() => setActiveCatalogTab('materials')}
        >
          📐 {t('catalog.materialsTitle')} ({materials.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeCatalogTab === 'edgeBands'}
          className={`settings-tab-btn ${activeCatalogTab === 'edgeBands' ? 'active' : ''}`}
          onClick={() => setActiveCatalogTab('edgeBands')}
        >
          🎗️ {t('catalog.edgeBandsTitle')} ({edgeBands.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeCatalogTab === 'hardware'}
          className={`settings-tab-btn ${activeCatalogTab === 'hardware' ? 'active' : ''}`}
          onClick={() => setActiveCatalogTab('hardware')}
        >
          🔩 {t('catalog.hardwareTitle')} ({hardware.length})
        </button>
      </div>

      {/* Materials Tab */}
      {activeCatalogTab === 'materials' && (
        <div className="catalog-section">
          <div className="catalog-actions-bar">
            <button
              type="button"
              className="m3-button m3-button--tonal"
              onClick={() => {
                setMatId('');
                setMatName('');
                setMatThickness(18);
                setMatLength(2750);
                setMatWidth(1830);
                setMatHasGrain(false);
                setMatPrice('');
                setIsAddingMaterial(true);
              }}
            >
              ➕ {t('catalog.addNew')} placa / material
            </button>
          </div>

          {isAddingMaterial && (
            <div className="m3-card catalog-edit-form" style={{ margin: '1rem 0' }}>
              <h3>{matId ? 'Editar Material' : 'Agregar Nuevo Material'}</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="mat-name-input">{t('catalog.materialName')}:</label>
                  <input
                    id="mat-name-input"
                    type="text"
                    className="m3-input"
                    value={matName}
                    onChange={(e) => setMatName(e.target.value)}
                    placeholder="Ej. Melamina Roble 18mm"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="mat-thickness-input">{t('catalog.thickness')}:</label>
                  <NumericInput
                    id="mat-thickness-input"
                    value={matThickness}
                    min={3}
                    max={50}
                    step={1}
                    unit="mm"
                    onChange={setMatThickness}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="mat-length-input">{t('catalog.sheetLength')}:</label>
                  <NumericInput
                    id="mat-length-input"
                    value={matLength}
                    min={500}
                    max={4000}
                    step={10}
                    unit="mm"
                    onChange={setMatLength}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="mat-width-input">{t('catalog.sheetWidth')}:</label>
                  <NumericInput
                    id="mat-width-input"
                    value={matWidth}
                    min={500}
                    max={3000}
                    step={10}
                    unit="mm"
                    onChange={setMatWidth}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="mat-grain-select">{t('catalog.hasGrain')}:</label>
                  <select
                    id="mat-grain-select"
                    className="m3-select"
                    value={matHasGrain ? 'yes' : 'no'}
                    onChange={(e) => setMatHasGrain(e.target.value === 'yes')}
                  >
                    <option value="no">No (Lisa / Unicolor)</option>
                    <option value="yes">Sí (Veta longitudinal)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="mat-price-input">{t('catalog.price')}:</label>
                  <NumericInput
                    id="mat-price-input"
                    value={typeof matPrice === 'number' ? matPrice : 0}
                    min={0}
                    step={100}
                    unit="$"
                    onChange={(v) => setMatPrice(v)}
                  />
                </div>
              </div>
              <div className="catalog-form-buttons" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="m3-button m3-button--filled" onClick={handleSaveMat}>
                  💾 Guardar Placa
                </button>
                <button
                  type="button"
                  className="m3-button m3-button--outlined"
                  onClick={() => setIsAddingMaterial(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="m3-table-responsive">
            <table className="m3-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Espesor</th>
                  <th>Dimensiones Placa</th>
                  <th>Veta</th>
                  <th>Precio</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {materials.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <strong>{m.name}</strong>
                      <br />
                      <code className="piece-tag">{m.id}</code>
                    </td>
                    <td>{m.thicknessMm} mm</td>
                    <td>
                      {typeof m.sheetSizeMm.length === 'number' ? m.sheetSizeMm.length : '—'} ×{' '}
                      {typeof m.sheetSizeMm.width === 'number' ? m.sheetSizeMm.width : '—'} mm
                    </td>
                    <td>{m.hasGrain ? '✓ Sí' : 'No'}</td>
                    <td>{typeof m.pricePerSheet === 'number' ? `$ ${m.pricePerSheet}` : 'A confirmar'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button
                          type="button"
                          className="m3-button m3-button--tonal"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          onClick={() => handleEditMat(m)}
                        >
                          ✏️ {t('catalog.edit')}
                        </button>
                        <button
                          type="button"
                          className="m3-button m3-button--outlined"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', color: 'var(--md-sys-color-error)' }}
                          onClick={async () => {
                            if (window.confirm(t('catalog.deleteConfirm'))) {
                              await onDeleteMaterial(m.id);
                            }
                          }}
                        >
                          🗑️ {t('catalog.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EdgeBands Tab */}
      {activeCatalogTab === 'edgeBands' && (
        <div className="catalog-section">
          <div className="catalog-actions-bar">
            <button
              type="button"
              className="m3-button m3-button--tonal"
              onClick={() => {
                setEbId('');
                setEbKind('adhesive');
                setEbThickness(0.8);
                setEbPrice('');
                setEbNeedsGroove(false);
                setIsAddingEdgeBand(true);
              }}
            >
              ➕ {t('catalog.addNew')} tapacanto
            </button>
          </div>

          {isAddingEdgeBand && (
            <div className="m3-card catalog-edit-form" style={{ margin: '1rem 0' }}>
              <h3>{ebId ? 'Editar Tapacanto' : 'Agregar Nuevo Tapacanto'}</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="eb-id-input">ID / Código:</label>
                  <input
                    id="eb-id-input"
                    type="text"
                    className="m3-input"
                    value={ebId}
                    onChange={(e) => setEbId(e.target.value)}
                    placeholder="Ej. eb-pvc-blanco-2mm"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="eb-kind-select">{t('catalog.edgeBandKind')}:</label>
                  <select
                    id="eb-kind-select"
                    className="m3-select"
                    value={ebKind}
                    onChange={(e) => setEbKind(e.target.value as EdgeBandKind)}
                  >
                    <option value="adhesive">Adhesivo / PVC / Melamínico</option>
                    <option value="aluminium-profile">Perfil de aluminio</option>
                    <option value="veneer">Chapa de madera natural</option>
                    <option value="rod">Varilla de madera maciza</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="eb-thickness-input">{t('catalog.thickness')}:</label>
                  <NumericInput
                    id="eb-thickness-input"
                    value={ebThickness}
                    min={0.1}
                    max={10}
                    step={0.1}
                    unit="mm"
                    onChange={setEbThickness}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="eb-price-input">{t('catalog.price')} por metro:</label>
                  <NumericInput
                    id="eb-price-input"
                    value={typeof ebPrice === 'number' ? ebPrice : 0}
                    min={0}
                    step={10}
                    unit="$/m"
                    onChange={(v) => setEbPrice(v)}
                  />
                </div>
              </div>
              <div className="catalog-form-buttons" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="m3-button m3-button--filled" onClick={handleSaveEb}>
                  💾 Guardar Tapacanto
                </button>
                <button
                  type="button"
                  className="m3-button m3-button--outlined"
                  onClick={() => setIsAddingEdgeBand(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="m3-table-responsive">
            <table className="m3-table">
              <thead>
                <tr>
                  <th>Código / ID</th>
                  <th>Tipo</th>
                  <th>Espesor</th>
                  <th>Precio / Metro</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {edgeBands.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <code>{b.id}</code>
                    </td>
                    <td>{b.kind}</td>
                    <td>{b.thicknessMm} mm</td>
                    <td>{typeof b.pricePerMeter === 'number' ? `$ ${b.pricePerMeter}` : 'A confirmar'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button
                          type="button"
                          className="m3-button m3-button--tonal"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          onClick={() => handleEditEb(b)}
                        >
                          ✏️ {t('catalog.edit')}
                        </button>
                        <button
                          type="button"
                          className="m3-button m3-button--outlined"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', color: 'var(--md-sys-color-error)' }}
                          onClick={async () => {
                            if (window.confirm(t('catalog.deleteConfirm'))) {
                              await onDeleteEdgeBand(b.id);
                            }
                          }}
                        >
                          🗑️ {t('catalog.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hardware Tab */}
      {activeCatalogTab === 'hardware' && (
        <div className="catalog-section">
          <div className="catalog-actions-bar">
            <button
              type="button"
              className="m3-button m3-button--tonal"
              onClick={() => {
                setHwId('');
                setHwName('');
                setHwJointKind('confirmat');
                setHwPrice('');
                setIsAddingHardware(true);
              }}
            >
              ➕ {t('catalog.addNew')} herraje o fijación
            </button>
          </div>

          {isAddingHardware && (
            <div className="m3-card catalog-edit-form" style={{ margin: '1rem 0' }}>
              <h3>{hwId ? 'Editar Herraje' : 'Agregar Nuevo Herraje'}</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="hw-name-input">{t('catalog.hardwareName')}:</label>
                  <input
                    id="hw-name-input"
                    type="text"
                    className="m3-input"
                    value={hwName}
                    onChange={(e) => setHwName(e.target.value)}
                    placeholder="Ej. Tornillo Confirmat 7x50"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="hw-joint-select">{t('catalog.jointKind')}:</label>
                  <select
                    id="hw-joint-select"
                    className="m3-select"
                    value={hwJointKind}
                    onChange={(e) => setHwJointKind(e.target.value as JointKind)}
                  >
                    <option value="confirmat">Confirmat (Tornillo pasante de ensamble)</option>
                    <option value="cam-dowel">Minifix / Rastex (Caja excéntrica + perno)</option>
                    <option value="dowel">Tarugo de madera</option>
                    <option value="dowel-and-confirmat">Tarugo + Confirmat</option>
                    <option value="screw">Tornillo autorroscante / Spax</option>
                    <option value="hinge">Bisagra de cazoleta (Euro cup hinge)</option>
                    <option value="slide">Corredera telescópica o rueda</option>
                    <option value="shelf-pin">Soporte / Perno para estante</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="hw-price-input">{t('catalog.price')} unitario:</label>
                  <NumericInput
                    id="hw-price-input"
                    value={typeof hwPrice === 'number' ? hwPrice : 0}
                    min={0}
                    step={1}
                    unit="$"
                    onChange={(v) => setHwPrice(v)}
                  />
                </div>
              </div>
              <div className="catalog-form-buttons" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button type="button" className="m3-button m3-button--filled" onClick={handleSaveHw}>
                  💾 Guardar Herraje
                </button>
                <button
                  type="button"
                  className="m3-button m3-button--outlined"
                  onClick={() => setIsAddingHardware(false)}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          <div className="m3-table-responsive">
            <table className="m3-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo de Unión</th>
                  <th>Precio Unitario</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {hardware.map((h) => (
                  <tr key={h.id}>
                    <td>
                      <strong>{h.name}</strong>
                      <br />
                      <code className="piece-tag">{h.id}</code>
                    </td>
                    <td>
                      <span className="m3-badge m3-badge--neutral">{h.jointKind}</span>
                    </td>
                    <td>{typeof h.pricePerUnit === 'number' ? `$ ${h.pricePerUnit}` : 'A confirmar'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button
                          type="button"
                          className="m3-button m3-button--tonal"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          onClick={() => handleEditHw(h)}
                        >
                          ✏️ {t('catalog.edit')}
                        </button>
                        <button
                          type="button"
                          className="m3-button m3-button--outlined"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', color: 'var(--md-sys-color-error)' }}
                          onClick={async () => {
                            if (window.confirm(t('catalog.deleteConfirm'))) {
                              await onDeleteHardware(h.id);
                            }
                          }}
                        >
                          🗑️ {t('catalog.delete')}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reset to factory button */}
      <div style={{ marginTop: '2rem', borderTop: '1px solid var(--md-sys-color-outline-variant)', paddingTop: '1rem' }}>
        <button
          type="button"
          className="m3-button m3-button--outlined"
          style={{ color: 'var(--md-sys-color-error)' }}
          onClick={async () => {
            if (window.confirm(t('catalog.resetConfirm'))) {
              await onResetCatalogs();
            }
          }}
        >
          🔄 {t('catalog.resetDefaults')}
        </button>
      </div>
    </div>
  );
}
