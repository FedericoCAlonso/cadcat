import { useState, type ReactElement } from 'react';
import type { Material, EdgeBand, JointStrategy } from '../model';
import { ThicknessMaterialPicker } from './ThicknessMaterialPicker';
import { translateEdgeBandKind } from './localization';

/**
 * Props for the MaterialsSection component.
 */
export interface MaterialsSectionProps {
  /** Available sheet materials. */
  materials?: Material[];
  /** Standard sheet thicknesses in mm. */
  standardThicknessesMm?: readonly number[];
  /** Selected carcass sheet material ID. */
  selectedMaterialId: string;
  /** Callback fired when carcass material changes. */
  onMaterialChange: (id: string) => void;
  /** Whether the module contains doors or fronts. */
  hasDoorsOrFronts: boolean;
  /** Material ID for fronts and doors. */
  frontsMaterialId?: string;
  /** Callback fired when fronts material changes. */
  onFrontsMaterialChange?: (id: string) => void;
  /** Whether the module contains drawers. */
  hasDrawers: boolean;
  /** Material ID for drawer boxes. */
  drawerBoxesMaterialId?: string;
  /** Callback fired when drawer boxes material changes. */
  onDrawerBoxesMaterialChange?: (id: string) => void;
  /** Whether the module has a backing board. */
  hasBackingBoard: boolean;
  /** Material ID for rear backings. */
  backingsMaterialId?: string;
  /** Callback fired when backings material changes. */
  onBackingsMaterialChange?: (id: string) => void;
  /** Callback fired when backing thickness is updated directly without a plate. */
  onBackingThicknessChange?: (thicknessMm: number) => void;
  /** Available edge bands. */
  edgeBands?: EdgeBand[];
  /** Selected default edge band ID. */
  selectedEdgeBandId: string;
  /** Callback fired when default edge band changes. */
  onEdgeBandChange: (id: string) => void;
  /** Joint strategy for carcass and partitions. */
  jointStrategy?: JointStrategy;
  /** Callback fired when joint strategy changes. */
  onJointStrategyChange?: (strategy: JointStrategy) => void;
}

/**
 * Materials and edge-banding configuration section.
 * Allows configuring carcass, front, drawer-box, and backing materials and joint strategy.
 */
export function MaterialsSection({
  materials = [],
  standardThicknessesMm,
  selectedMaterialId,
  onMaterialChange,
  hasDoorsOrFronts,
  frontsMaterialId,
  onFrontsMaterialChange,
  hasDrawers,
  drawerBoxesMaterialId,
  onDrawerBoxesMaterialChange,
  hasBackingBoard,
  backingsMaterialId,
  onBackingsMaterialChange,
  onBackingThicknessChange,
  edgeBands = [],
  selectedEdgeBandId,
  onEdgeBandChange,
  jointStrategy = 'confirmat',
  onJointStrategyChange,
}: MaterialsSectionProps): ReactElement {
  const [showAllRoleMaterials, setShowAllRoleMaterials] = useState(false);

  return (
    <fieldset
      className="builder-section"
      style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', overflow: 'hidden' }}
    >
      <legend className="builder-section-title" style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <span>🎨 Materiales y Tapacantos</span>
      </legend>

      {/* Material Casco */}
      <div className="form-group" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
        <ThicknessMaterialPicker
          id="select-material"
          label="Placa para Casco (Laterales, piso, techo):"
          materials={materials}
          selectedMaterialId={selectedMaterialId}
          onMaterialChange={onMaterialChange}
          standardThicknessesMm={standardThicknessesMm}
        />
      </div>

      {/* Material Frentes / Puertas (Contextual) */}
      {onFrontsMaterialChange && (hasDoorsOrFronts || showAllRoleMaterials) && (
        <div className="form-group" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
          <ThicknessMaterialPicker
            id="select-fronts-material"
            label="Placa para Frentes / Puertas / Tapas:"
            materials={materials}
            selectedMaterialId={frontsMaterialId || selectedMaterialId}
            onMaterialChange={onFrontsMaterialChange}
            standardThicknessesMm={standardThicknessesMm}
          />
        </div>
      )}

      {/* Material Cajones (Contextual) */}
      {onDrawerBoxesMaterialChange && (hasDrawers || showAllRoleMaterials) && (
        <div className="form-group" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
          <ThicknessMaterialPicker
            id="select-drawer-material"
            label="Placa para Cajas de Cajones interiores:"
            materials={materials}
            selectedMaterialId={drawerBoxesMaterialId || selectedMaterialId}
            onMaterialChange={onDrawerBoxesMaterialChange}
            standardThicknessesMm={standardThicknessesMm}
          />
        </div>
      )}

      {/* Material Fondos y Traseras (Contextual) */}
      {onBackingsMaterialChange && (hasBackingBoard || showAllRoleMaterials) && (
        <div className="form-group" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
          <ThicknessMaterialPicker
            id="select-backings-material"
            label="Placa para Fondos y Traseras:"
            materials={materials}
            selectedMaterialId={backingsMaterialId || selectedMaterialId}
            onMaterialChange={onBackingsMaterialChange}
            standardThicknessesMm={standardThicknessesMm}
            onThicknessWithoutPlate={(t) => onBackingThicknessChange?.(t)}
          />
        </div>
      )}

      {/* Toggle para mostrar/ocultar todas las placas si alguna no aplica aún */}
      {(!showAllRoleMaterials && (!hasDoorsOrFronts || !hasDrawers || !hasBackingBoard)) && (
        <div style={{ marginBottom: '0.85rem' }}>
          <button
            type="button"
            className="m3-btn m3-btn--small m3-btn--text"
            style={{ fontSize: '0.78rem', padding: '0.2rem 0.4rem', textDecoration: 'underline', color: 'var(--md-sys-color-primary)' }}
            onClick={() => setShowAllRoleMaterials(true)}
          >
            ⚙️ Personalizar más materiales por rol...
          </button>
        </div>
      )}

      {/* Tapacantos */}
      <div className="form-group" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
        <label htmlFor="select-edgeband" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
          Tapacantos:
          <span className="visually-hidden">Edge Band:</span>
        </label>
        <select
          id="select-edgeband"
          value={selectedEdgeBandId}
          onChange={(e) => onEdgeBandChange(e.target.value)}
          className="m3-select"
          style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
        >
          <option value="">Sin tapacanto / Ninguno</option>
          {edgeBands.map((eb) => (
            <option key={eb.id} value={eb.id}>
              {eb.id} ({translateEdgeBandKind(eb.kind)}, {eb.thicknessMm} mm)
            </option>
          ))}
        </select>
      </div>

      {/* Fijaciones / Tipo de Uniones */}
      {onJointStrategyChange && (
        <div className="form-group" style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
          <label htmlFor="select-joint-strategy" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
            Fijaciones / Tipo de Uniones:
          </label>
          <select
            id="select-joint-strategy"
            value={jointStrategy}
            onChange={(e) => onJointStrategyChange(e.target.value as JointStrategy)}
            className="m3-select"
            style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}
          >
            <option value="confirmat">Confirmat (Tornillo soberbio Ø7 / Ø5 mm)</option>
            <option value="dowel-and-confirmat">Tarugo + Confirmat (Tarugo Ø8 mm + Confirmat Ø7 mm)</option>
            <option value="cam-dowel">Minifix + Tarugo (Caja excéntrica Ø15 mm + Tarugo Ø8 mm)</option>
            <option value="screw">Tornillo Autorroscante (Spax 4x50 mm)</option>
          </select>
        </div>
      )}
    </fieldset>
  );
}
