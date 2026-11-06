import type { ReactElement } from 'react';
import type { ColumnObstacle, FalseSquare } from '../model';
import { NumericInput } from './NumericInput';

/**
 * Props for the InterferencesSection component.
 */
export interface InterferencesSectionProps {
  /** Overall width of the module in mm (for input limits). */
  width: number;
  /** Overall height of the module in mm (for input limits). */
  height: number;
  /** Overall depth of the module in mm (for input limits). */
  depth: number;
  /** Column obstacle configuration object. */
  columnObstacle?: ColumnObstacle;
  /** False square wall configuration object. */
  falseSquare?: FalseSquare;
  /** Callback fired when column obstacle configuration changes. */
  onColumnObstacleChange?: (col: ColumnObstacle) => void;
  /** Callback fired when false square configuration changes. */
  onFalseSquareChange?: (fs: FalseSquare) => void;
}

/**
 * Architectural interferences section for columns, beams, steps, and false-square walls.
 */
export function InterferencesSection({
  width,
  height,
  depth,
  columnObstacle,
  falseSquare,
  onColumnObstacleChange,
  onFalseSquareChange,
}: InterferencesSectionProps): ReactElement {
  return (
    <fieldset className="builder-section" style={{ border: '1px dashed var(--md-sys-color-outline)' }}>
      <legend className="builder-section-title">
        <span>📐 Laboratorio de Interferencias Arquitectónicas</span>
      </legend>

      {/* Columna, Viga o Escalón Arquitectónico */}
      <div className="builder-subcard" style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
          <div>
            <strong style={{ fontSize: '0.92rem', color: 'var(--md-sys-color-on-surface)' }}>🏛️ Columna / Viga / Obstáculo Arquitectónico</strong>
            <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              Ajusta la profundidad de laterales y deduce destajes o cajeados en piso, techo y estantes.
            </span>
          </div>
          <label className="m3-switch" style={{ minWidth: '48px', minHeight: '48px', display: 'flex', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={columnObstacle?.enabled ?? false}
              onChange={(e) => {
                onColumnObstacleChange?.({
                  enabled: e.target.checked,
                  type: columnObstacle?.type ?? 'vertical-column',
                  referenceEdge: columnObstacle?.referenceEdge ?? (columnObstacle?.corner === 'back-right' ? 'right' : 'left'),
                  distanceFromReferenceMm: columnObstacle?.distanceFromReferenceMm ?? 0,
                  widthMm: columnObstacle?.widthMm ?? 150,
                  depthMm: columnObstacle?.depthMm ?? 120,
                  heightMm: columnObstacle?.heightMm ?? 150,
                  corner: columnObstacle?.corner ?? 'back-left',
                });
              }}
              aria-label="Habilitar obstáculo arquitectónico"
            />
            <span className="m3-switch__slider"></span>
          </label>
        </div>

        {columnObstacle?.enabled && (
          <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Tipo de Obstáculo: Columna vs Viga/Escalón */}
            <div className="form-group">
              <label>Tipo de interferencia:</label>
              <div className="builder-segmented-group" role="group" aria-label="Tipo de obstáculo">
                <button
                  type="button"
                  className={`builder-segmented-btn ${columnObstacle.type !== 'horizontal-beam' ? 'selected' : ''}`}
                  onClick={() => onColumnObstacleChange?.({
                    ...columnObstacle,
                    type: 'vertical-column',
                    referenceEdge: columnObstacle.referenceEdge === 'right' ? 'right' : 'left',
                  })}
                >
                  🏛️ Columna Vertical
                </button>
                <button
                  type="button"
                  className={`builder-segmented-btn ${columnObstacle.type === 'horizontal-beam' ? 'selected' : ''}`}
                  onClick={() => onColumnObstacleChange?.({
                    ...columnObstacle,
                    type: 'horizontal-beam',
                    referenceEdge: columnObstacle.referenceEdge === 'bottom' ? 'bottom' : 'top',
                    heightMm: columnObstacle.heightMm ?? 150,
                  })}
                >
                  🏗️ Viga / Escalón Horizontal
                </button>
              </div>
            </div>

            {/* Si es Columna Vertical */}
            {columnObstacle.type !== 'horizontal-beam' ? (
              <>
                <div className="form-group">
                  <label>Lateral de referencia:</label>
                  <div className="builder-segmented-group" role="group" aria-label="Referencia de columna">
                    <button
                      type="button"
                      className={`builder-segmented-btn ${(columnObstacle.referenceEdge ?? 'left') === 'left' ? 'selected' : ''}`}
                      onClick={() => onColumnObstacleChange?.({ ...columnObstacle, referenceEdge: 'left', corner: 'back-left' })}
                    >
                      ⬅️ Lateral Izquierdo
                    </button>
                    <button
                      type="button"
                      className={`builder-segmented-btn ${(columnObstacle.referenceEdge ?? 'left') === 'right' ? 'selected' : ''}`}
                      onClick={() => onColumnObstacleChange?.({ ...columnObstacle, referenceEdge: 'right', corner: 'back-right' })}
                    >
                      Lateral Derecho ➡️
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label htmlFor="col-dist-input">Dist. desde lateral (mm):</label>
                    <NumericInput
                      id="col-dist-input"
                      min={0}
                      max={Math.max(0, width - (columnObstacle.widthMm ?? 150))}
                      step={10}
                      value={columnObstacle.distanceFromReferenceMm ?? 0}
                      unit="mm"
                      showStepper={true}
                      onChange={(val) => onColumnObstacleChange?.({ ...columnObstacle, distanceFromReferenceMm: val })}
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                      {(columnObstacle.distanceFromReferenceMm ?? 0) === 0 ? '📍 En el rincón' : '📏 Desfasada del rincón'}
                    </span>
                  </div>

                  <div className="form-group">
                    <label htmlFor="col-width-input">Ancho en X (mm):</label>
                    <NumericInput
                      id="col-width-input"
                      min={50}
                      max={Math.max(100, width - 60)}
                      step={10}
                      value={columnObstacle.widthMm ?? 150}
                      unit="mm"
                      showStepper={true}
                      onChange={(val) => onColumnObstacleChange?.({ ...columnObstacle, widthMm: val })}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="col-depth-input">Profundidad en Z (mm):</label>
                    <NumericInput
                      id="col-depth-input"
                      min={30}
                      max={Math.max(60, depth - 60)}
                      step={10}
                      value={columnObstacle.depthMm}
                      unit="mm"
                      showStepper={true}
                      onChange={(val) => onColumnObstacleChange?.({ ...columnObstacle, depthMm: val })}
                    />
                  </div>
                </div>
              </>
            ) : (
              /* Si es Viga o Escalón Horizontal */
              <>
                <div className="form-group">
                  <label>Ubicación de referencia:</label>
                  <div className="builder-segmented-group" role="group" aria-label="Referencia de viga o escalón">
                    <button
                      type="button"
                      className={`builder-segmented-btn ${(columnObstacle.referenceEdge ?? 'top') === 'top' ? 'selected' : ''}`}
                      onClick={() => onColumnObstacleChange?.({ ...columnObstacle, referenceEdge: 'top' })}
                    >
                      ⬆️ Techo (Viga superior)
                    </button>
                    <button
                      type="button"
                      className={`builder-segmented-btn ${(columnObstacle.referenceEdge ?? 'top') === 'bottom' ? 'selected' : ''}`}
                      onClick={() => onColumnObstacleChange?.({ ...columnObstacle, referenceEdge: 'bottom' })}
                    >
                      ⬇️ Piso (Escalón de obra)
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label htmlFor="beam-dist-input">Distancia a cara (mm):</label>
                    <NumericInput
                      id="beam-dist-input"
                      min={0}
                      max={Math.max(0, height - (columnObstacle.heightMm ?? 150))}
                      step={10}
                      value={columnObstacle.distanceFromReferenceMm ?? 0}
                      unit="mm"
                      showStepper={true}
                      onChange={(val) => onColumnObstacleChange?.({ ...columnObstacle, distanceFromReferenceMm: val })}
                    />
                    <span style={{ fontSize: '0.72rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                      {(columnObstacle.distanceFromReferenceMm ?? 0) === 0 ? '📍 Apoya en extremo' : '📏 Separada del extremo'}
                    </span>
                  </div>

                  <div className="form-group">
                    <label htmlFor="beam-height-input">Altura en Y (mm):</label>
                    <NumericInput
                      id="beam-height-input"
                      min={50}
                      max={Math.max(100, height - 100)}
                      step={10}
                      value={columnObstacle.heightMm ?? 150}
                      unit="mm"
                      showStepper={true}
                      onChange={(val) => onColumnObstacleChange?.({ ...columnObstacle, heightMm: val })}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="beam-depth-input">Profundidad en Z (mm):</label>
                    <NumericInput
                      id="beam-depth-input"
                      min={30}
                      max={Math.max(60, depth - 60)}
                      step={10}
                      value={columnObstacle.depthMm}
                      unit="mm"
                      showStepper={true}
                      onChange={(val) => onColumnObstacleChange?.({ ...columnObstacle, depthMm: val })}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Pared en Falsa Escuadra */}
      <div className="builder-subcard" style={{ padding: '1rem', borderRadius: '12px', backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
          <div>
            <strong style={{ fontSize: '0.92rem', color: 'var(--md-sys-color-on-surface)' }}>📐 Pared en Falsa Escuadra</strong>
            <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
              Piso y techo trapezoidales, laterales según profundidad y frente recto coplanar a 90°.
            </span>
          </div>
          <label className="m3-switch" style={{ minWidth: '48px', minHeight: '48px', display: 'flex', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={falseSquare?.enabled ?? false}
              onChange={(e) => {
                onFalseSquareChange?.({
                  enabled: e.target.checked,
                  leftDepthMm: falseSquare?.leftDepthMm ?? depth,
                  rightDepthMm: falseSquare?.rightDepthMm ?? Math.max(100, depth - 40),
                });
              }}
              aria-label="Habilitar pared en falsa escuadra"
            />
            <span className="m3-switch__slider"></span>
          </label>
        </div>

        {falseSquare?.enabled && (
          <div style={{ marginTop: '0.85rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
            <div className="form-group">
              <label htmlFor="fs-left-depth-input">Profundidad Izquierda (mm):</label>
              <NumericInput
                id="fs-left-depth-input"
                min={100}
                max={1200}
                step={10}
                value={falseSquare.leftDepthMm}
                unit="mm"
                showStepper={true}
                onChange={(val) => onFalseSquareChange?.({ ...falseSquare, leftDepthMm: val })}
              />
            </div>

            <div className="form-group">
              <label htmlFor="fs-right-depth-input">Profundidad Derecha (mm):</label>
              <NumericInput
                id="fs-right-depth-input"
                min={100}
                max={1200}
                step={10}
                value={falseSquare.rightDepthMm}
                unit="mm"
                showStepper={true}
                onChange={(val) => onFalseSquareChange?.({ ...falseSquare, rightDepthMm: val })}
              />
            </div>
          </div>
        )}
      </div>
    </fieldset>
  );
}
