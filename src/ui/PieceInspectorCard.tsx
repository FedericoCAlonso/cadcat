import type { ReactElement } from 'react';
import type { Material, EdgeBand, JointStrategy, JointKind } from '../model';
import type {
  ResolvedPieceWithCutSize,
  KinematicMechanism,
  ShelfDeflectionResult,
  PieceEdgeBandOverride,
} from '../resolver';
import { translatePieceRole } from './localization';
import { ThicknessMaterialPicker } from './ThicknessMaterialPicker';

/**
 * Props for the Selected Piece Inspector card component.
 */
export interface PieceInspectorCardProps {
  /** The currently selected piece, or null if none selected. */
  selectedPiece: ResolvedPieceWithCutSize | null;
  /** Kinematic mechanism associated with the selected piece (e.g. drawer or door). */
  pieceMech?: KinematicMechanism | null;
  /** Map of mechanism IDs to their current open ratio [0..1]. */
  kinematicsState?: Record<string, number>;
  /** Callback fired when the open ratio of a mechanism is changed. */
  onMechanismOpenRatioChange?: (mechanismId: string, ratio: number) => void;
  /** Available sheet materials in project/catalog. */
  materials?: Material[];
  /** Standard sheet thicknesses in mm. */
  standardThicknessesMm?: readonly number[];
  /** Material overrides per piece ID. */
  pieceMaterialOverrides?: Record<string, string>;
  /** Callback to set or clear a piece-specific material override. */
  onSetPieceMaterial?: (pieceId: string, materialId: string | null) => void;
  /** Thickness overrides per piece ID in mm. */
  pieceThicknessOverrides?: Record<string, number>;
  /** Callback to set or clear a piece-specific thickness override. */
  onSetPieceThickness?: (pieceId: string, thicknessMm: number | null) => void;
  /** Edgeband overrides per piece ID. */
  pieceEdgeBandOverrides?: Record<string, PieceEdgeBandOverride>;
  /** Callback to set or clear piece-specific edgeband overrides. */
  onSetPieceEdgeBands?: (pieceId: string, overrides: PieceEdgeBandOverride | null) => void;
  /** Available edge bands in project/catalog. */
  edgeBands?: EdgeBand[];
  /** Joint overrides per piece ID. */
  pieceJointOverrides?: Record<string, JointKind>;
  /** Default joint strategy of the module/project. */
  jointStrategy?: JointStrategy;
  /** Callback to set or clear piece-specific joint overrides. */
  onSetPieceJointOverride?: (pieceId: string, jointKind: JointKind | null) => void;
  /** Callback to open custom machining modal for a piece. */
  onOpenMachiningModal?: (pieceId: string) => void;
  /** Shelf deflection calculation results mapped by piece ID. */
  shelfDeflections?: Map<string, ShelfDeflectionResult>;
  /** Callback to deselect or select a piece. */
  onSelectPiece?: (pieceId: string | null) => void;
}

/**
 * Inspector card for inspecting and configuring a selected piece in the sidebar.
 * Displays dimensions, cut size, edge banding, joint type, and machining options.
 */
export function PieceInspectorCard({
  selectedPiece,
  pieceMech,
  kinematicsState,
  onMechanismOpenRatioChange,
  materials,
  standardThicknessesMm,
  pieceMaterialOverrides,
  onSetPieceMaterial,
  pieceThicknessOverrides,
  onSetPieceThickness,
  pieceEdgeBandOverrides,
  onSetPieceEdgeBands,
  edgeBands,
  pieceJointOverrides,
  jointStrategy = 'confirmat',
  onSetPieceJointOverride,
  onOpenMachiningModal,
  shelfDeflections,
  onSelectPiece,
}: PieceInspectorCardProps): ReactElement | null {
  if (!selectedPiece) return null;

  return (
    <aside
      aria-label="Inspector de Pieza Seleccionada"
      className="piece-inspector-card m3-card"
      style={{
        marginBottom: '1rem',
        padding: '1rem',
        backgroundColor: 'var(--md-sys-color-surface-container-high)',
        borderRadius: 'var(--md-sys-shape-corner-md)',
        border: '2px solid var(--md-sys-color-primary)',
        boxShadow: 'var(--md-sys-elevation-2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--md-sys-color-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>🔍</span>
            <span>{translatePieceRole(selectedPiece.role)}</span>
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-outline)' }} title={`ID técnico: ${selectedPiece.id}`}>
            ID: {selectedPiece.id}
          </span>
        </div>
        <button
          type="button"
          className="m3-button m3-button--tonal"
          style={{
            width: '36px',
            height: '36px',
            minWidth: '36px',
            minHeight: '36px',
            padding: 0,
            borderRadius: '18px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
          onClick={() => onSelectPiece?.(null)}
          title="Cerrar inspector y deseleccionar pieza"
          aria-label="Cerrar inspector y deseleccionar"
        >
          ✕
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.4rem', fontSize: '0.82rem', marginBottom: '0.75rem', padding: '0.5rem', backgroundColor: 'var(--md-sys-color-surface)', borderRadius: '6px' }}>
        <div><strong>Espesor:</strong> {`${selectedPiece.thicknessMm} mm`}</div>
        <div><strong>Terminada:</strong> {`${selectedPiece.dimensionsMm.width} × ${selectedPiece.dimensionsMm.height} mm`}</div>
        <div><strong>Corte sierra:</strong> {`${selectedPiece.cutDimensionsMm.width} × ${selectedPiece.cutDimensionsMm.height} mm`}</div>
      </div>

      {/* Kinematic mechanism action for selected piece */}
      {pieceMech && (
        <div className="m3-structure-card" style={{ marginBottom: '0.75rem', padding: '0.6rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--md-sys-color-primary)' }}>
              🚪 Mecanismo: {pieceMech.name}
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}>
              {Math.round((kinematicsState?.[pieceMech.id] ?? 0) * 100)}%
            </span>
          </div>
          <input
            aria-label={`Apertura de ${pieceMech.name}`}
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={kinematicsState?.[pieceMech.id] ?? 0}
            onChange={(e) => onMechanismOpenRatioChange?.(pieceMech.id, parseFloat(e.target.value))}
            className="viewport-3d-slider"
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
            <button
              type="button"
              className="m3-button m3-button--tonal"
              style={{ flex: 1, minHeight: '36px', fontSize: '0.8rem', justifyContent: 'center' }}
              onClick={() => onMechanismOpenRatioChange?.(pieceMech.id, 0)}
            >
              Cerrar
            </button>
            <button
              type="button"
              className="m3-button m3-button--primary"
              style={{ flex: 1, minHeight: '36px', fontSize: '0.8rem', justifyContent: 'center' }}
              onClick={() => onMechanismOpenRatioChange?.(pieceMech.id, 1)}
            >
              Abrir
            </button>
          </div>
        </div>
      )}

      {/* Piece-level Material + Thickness (thickness follows the plate; thickness-first filters plates) */}
      {materials && materials.length > 0 && (
        <div className="m3-structure-card" style={{ marginBottom: '0.5rem', padding: '0.6rem' }}>
          <ThicknessMaterialPicker
            id={`piece-material-override-${selectedPiece.id}`}
            label="🪵 Material de la Placa:"
            thicknessCaption="📏 Espesor de Placa (mm):"
            materials={materials}
            selectedMaterialId={pieceMaterialOverrides?.[selectedPiece.id] ?? selectedPiece.materialId}
            onMaterialChange={(materialId) => onSetPieceMaterial?.(selectedPiece.id, materialId || null)}
            standardThicknessesMm={standardThicknessesMm}
            onThicknessWithoutPlate={(t) => onSetPieceThickness?.(selectedPiece.id, t)}
          />
          {pieceThicknessOverrides?.[selectedPiece.id] !== undefined && (
            <div style={{ marginTop: '0.35rem', fontSize: '0.78rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              Espesor fijado en {pieceThicknessOverrides[selectedPiece.id]} mm sin placa definida: elegí una placa de ese espesor para
              volver al cálculo automático.
            </div>
          )}
        </div>
      )}

      {/* Piece-level EdgeBand Overrides */}
      <div className="m3-structure-card" style={{ marginBottom: '0.5rem', padding: '0.6rem' }}>
        <span style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
          🏷️ Tapacantos en Bordes:
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem', fontSize: '0.82rem' }}>
          {(['top', 'bottom', 'left', 'right'] as const).map((edgeKey) => {
            const label =
              edgeKey === 'top'
                ? 'Superior'
                : edgeKey === 'bottom'
                ? 'Inferior'
                : edgeKey === 'left'
                ? 'Izquierdo'
                : 'Derecho';
            const isBanded =
              pieceEdgeBandOverrides?.[selectedPiece.id]?.[edgeKey] ??
              selectedPiece.bandedEdges.some((b) => b.faceId.toLowerCase().includes(edgeKey));

            return (
              <label key={edgeKey} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={Boolean(isBanded)}
                  onChange={(e) => {
                    const current = pieceEdgeBandOverrides?.[selectedPiece.id] ?? {
                      top: selectedPiece.bandedEdges.some((b) => b.faceId.toLowerCase().includes('top')),
                      bottom: selectedPiece.bandedEdges.some((b) => b.faceId.toLowerCase().includes('bottom')),
                      left: selectedPiece.bandedEdges.some((b) => b.faceId.toLowerCase().includes('left')),
                      right: selectedPiece.bandedEdges.some((b) => b.faceId.toLowerCase().includes('right')),
                    };
                    onSetPieceEdgeBands?.(selectedPiece.id, {
                      ...current,
                      [edgeKey]: e.target.checked,
                    });
                  }}
                />
                {label}
              </label>
            );
          })}
        </div>
        {edgeBands && edgeBands.length > 0 && (
          <div style={{ marginTop: '0.45rem' }}>
            <label
              htmlFor={`piece-edgeband-override-${selectedPiece.id}`}
              style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.2rem', color: 'var(--md-sys-color-on-surface-variant)' }}
            >
              Tipo / Espesor de Tapacanto:
            </label>
            <select
              id={`piece-edgeband-override-${selectedPiece.id}`}
              className="m3-select"
              style={{ width: '100%', fontSize: '0.8rem' }}
              value={pieceEdgeBandOverrides?.[selectedPiece.id]?.edgeBandId ?? ''}
              onChange={(e) => {
                const current = pieceEdgeBandOverrides?.[selectedPiece.id] ?? {
                  top: selectedPiece.bandedEdges.some((b) => b.faceId.toLowerCase().includes('top')),
                  bottom: selectedPiece.bandedEdges.some((b) => b.faceId.toLowerCase().includes('bottom')),
                  left: selectedPiece.bandedEdges.some((b) => b.faceId.toLowerCase().includes('left')),
                  right: selectedPiece.bandedEdges.some((b) => b.faceId.toLowerCase().includes('right')),
                };
                onSetPieceEdgeBands?.(selectedPiece.id, {
                  ...current,
                  edgeBandId: e.target.value || undefined,
                });
              }}
            >
              <option value="">Por defecto del módulo</option>
              {edgeBands.map((eb) => (
                <option key={eb.id} value={eb.id}>
                  {eb.id} ({eb.thicknessMm} mm - {eb.kind})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Piece-level Joint Override */}
      <div className="m3-structure-card" style={{ marginBottom: '0.5rem', padding: '0.6rem' }}>
        <label
          htmlFor={`piece-joint-override-${selectedPiece.id}`}
          style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}
        >
          🔩 Fijación / Unión para esta placa:
        </label>
        <select
          id={`piece-joint-override-${selectedPiece.id}`}
          className="m3-select"
          style={{ width: '100%', fontSize: '0.85rem' }}
          value={pieceJointOverrides?.[selectedPiece.id] ?? ''}
          onChange={(e) => {
            const val = e.target.value as JointKind | '';
            onSetPieceJointOverride?.(selectedPiece.id, val ? val : null);
          }}
        >
          <option value="">Por defecto del proyecto ({jointStrategy})</option>
          <option value="cam-dowel">Minifix / Rastex (Oculto sin tornillos pasantes)</option>
          <option value="dowel">Tarugos de madera (Oculto)</option>
          <option value="confirmat">Tornillo pasante (Confirmat)</option>
          <option value="dowel-and-confirmat">Tarugos + Confirmat</option>
          <option value="screw">Tornillo común (Spax)</option>
        </select>
        {pieceJointOverrides?.[selectedPiece.id] && (
          <span className="m3-badge m3-badge--success" style={{ marginTop: '0.35rem', display: 'inline-block' }}>
            ✓ Fijación personalizada: {pieceJointOverrides[selectedPiece.id]}
          </span>
        )}
      </div>

      {/* Custom Machinings Button */}
      {onOpenMachiningModal && (
        <div style={{ marginTop: '0.6rem' }}>
          <button
            type="button"
            className="m3-button m3-button--tonal"
            style={{ width: '100%', minHeight: '44px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            onClick={() => onOpenMachiningModal(selectedPiece.id)}
          >
            🛠️ Mecanizar Placa (Ranuras / Fresados / Agujeros)
          </button>
        </div>
      )}

      {/* Deflection if shelf */}
      {shelfDeflections?.get(selectedPiece.id) && (() => {
        const defl = shelfDeflections.get(selectedPiece.id)!;
        return (
          <div
            className={`inspector-deflection-card ${defl.hasWarning ? 'warning' : 'ok'}`}
            style={{
              marginTop: '0.75rem',
              padding: '0.65rem 0.85rem',
              borderRadius: '8px',
              backgroundColor: defl.hasWarning ? 'var(--md-sys-color-error-container)' : 'var(--md-sys-color-success-container)',
              border: `1px solid ${defl.hasWarning ? 'var(--md-sys-color-error)' : 'var(--md-sys-color-success-border)'}`,
              color: defl.hasWarning ? 'var(--md-sys-color-on-error-container)' : 'var(--md-sys-color-on-success-container)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
              <span>{defl.hasWarning ? '⚠️ Deflexión en Estante' : '✓ Deflexión en Estante'}</span>
            </div>
            <p style={{ margin: '0.25rem 0', fontSize: '0.82rem' }}>
              <strong>Flecha estimada: </strong>
              {`${defl.calculatedDeflectionMm.toFixed(2)} mm | `}
              <strong>Máx admisible: </strong>
              {`${defl.allowableDeflectionMm.toFixed(2)} mm`}
            </p>
            <p style={{ margin: '0.25rem 0', fontSize: '0.8rem', opacity: 0.9 }}>
              <strong>Carga: </strong>
              {`${defl.totalLoadKg.toFixed(1)} kg (${defl.totalLoadN.toFixed(0)} N) | `}
              <strong>Módulo E: </strong>
              {`${defl.elasticModulusMPa} MPa ${defl.isElasticModulusConfirmed ? '' : '(TO_CONFIRM)'}`}
            </p>
            {defl.hasWarning && (
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.8rem', fontWeight: 600 }}>
                {defl.warningMessage}
              </p>
            )}
          </div>
        );
      })()}
    </aside>
  );
}
