import { useRef, type ReactElement } from 'react';
import type { CustomPieceOperation } from '../model';
import {
  type ResolvedPieceWithCutSize,
  type SpatialPieceBox,
} from '../resolver';
import { NumericInput } from './NumericInput';
import { useMachiningEditorViewModel } from './useMachiningEditorViewModel';

export interface MachiningEditorModalProps {
  piece: ResolvedPieceWithCutSize | null;
  customOperations: CustomPieceOperation[];
  spatialBoxes?: SpatialPieceBox[];
  onAddOperation: (pieceId: string, op: CustomPieceOperation) => void;
  onRemoveOperation: (pieceId: string, opId: string) => void;
  onClose: () => void;
}

export function MachiningEditorModal(props: MachiningEditorModalProps): ReactElement | null {
  const { piece } = props;
  const svgRef = useRef<SVGSVGElement | null>(null);

  const vm = useMachiningEditorViewModel(props);

  if (!piece) return null;

  // SVG Drawing Coordinate Geometry
  const targetWidth = 640;
  const targetHeight = 420;
  const margin = 50;
  const turnOffset = vm.faceType === 'face-B' && vm.previewSheet?.requiresTurn ? 40 : 0;
  const availableDrawW = targetWidth - 2 * margin;
  const availableDrawH = targetHeight - 2 * margin - turnOffset;

  const scale = Math.min(availableDrawW / vm.pieceWidth, availableDrawH / vm.pieceHeight, 1.2);
  const drawW = vm.pieceWidth * scale;
  const drawH = vm.pieceHeight * scale;

  const originX = margin + (availableDrawW - drawW) / 2;
  const originY = margin + (availableDrawH - drawH) / 2 + turnOffset;

  // Datum Reference Origin Marker at bottom-left
  const datumX = originX;
  const datumY = originY + drawH;

  const toSvgX = (mm: number) => datumX + mm * scale;
  const toSvgY = (mm: number) => datumY - mm * scale;

  // Convert client pointer to local mm coordinates
  const handleSvgPointer = (e: React.PointerEvent<SVGSVGElement>, isClick = false) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * targetWidth;
    const py = ((e.clientY - rect.top) / rect.height) * targetHeight;

    const rawMmX = (px - datumX) / scale;
    const rawMmY = (datumY - py) / scale;

    if (isClick) {
      vm.handleCanvasClick(rawMmX, rawMmY);
    } else {
      vm.handlePointerMove(rawMmX, rawMmY);
    }
  };

  const currentFaceOps = vm.previewSheet
    ? vm.faceType === 'face-A'
      ? vm.previewSheet.faceAOperations
      : vm.previewSheet.faceBOperations
    : [];

  return (
    <div
      className="m3-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) vm.onClose();
      }}
    >
      <div className="m3-modal-dialog machining-editor-dialog">
        {/* Header */}
        <div className="m3-modal-header">
          <div>
            <h3 className="m3-modal-title">
              🛠️ Editor de Mecanizados en Placa: <strong>{piece.id}</strong>
            </h3>
            <p className="m3-modal-subtitle">
              {`Medidas: ${piece.dimensionsMm.width} × ${piece.dimensionsMm.height} × ${piece.thicknessMm} mm | Rol: ${piece.role}`}
            </p>
          </div>
          <button
            type="button"
            className="m3-btn m3-btn--text"
            onClick={vm.onClose}
            style={{ fontSize: '1.25rem', padding: '0.2rem 0.6rem' }}
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="m3-modal-body">
          <div className="machining-editor-layout">
            {/* Controls & Operations Column */}
            <div className="machining-editor-sidebar">
              {/* Tool Selection Chips */}
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`m3-btn m3-btn--small ${vm.opType === 'groove' ? 'm3-btn--primary' : 'm3-btn--outlined'}`}
                  onClick={() => vm.setOpType('groove')}
                >
                  ➖ Ranura
                </button>
                <button
                  type="button"
                  className={`m3-btn m3-btn--small ${vm.opType === 'rebate' ? 'm3-btn--primary' : 'm3-btn--outlined'}`}
                  onClick={() => vm.setOpType('rebate')}
                >
                  🔲 Rebaje en Canto
                </button>
                <button
                  type="button"
                  className={`m3-btn m3-btn--small ${vm.opType === 'cutout' ? 'm3-btn--primary' : 'm3-btn--outlined'}`}
                  onClick={() => vm.setOpType('cutout')}
                >
                  ⏹️ Fresado / Pasacables
                </button>
                <button
                  type="button"
                  className={`m3-btn m3-btn--small ${vm.opType === 'drill' ? 'm3-btn--primary' : 'm3-btn--outlined'}`}
                  onClick={() => vm.setOpType('drill')}
                >
                  🔘 Perforación
                </button>
                <button
                  type="button"
                  className={`m3-btn m3-btn--small ${vm.opType === 'fastener' ? 'm3-btn--primary' : 'm3-btn--outlined'}`}
                  onClick={() => vm.setOpType('fastener')}
                >
                  ⚡ Distribución de Tornillos
                </button>
              </div>

              {/* Face and Snaps bar */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Cara:</span>
                  <button
                    type="button"
                    className={`m3-btn m3-btn--small ${vm.faceType === 'face-A' ? 'm3-btn--primary' : 'm3-btn--text'}`}
                    onClick={() => vm.setFaceType('face-A')}
                  >
                    Cara A (Frente)
                  </button>
                  <button
                    type="button"
                    className={`m3-btn m3-btn--small ${vm.faceType === 'face-B' ? 'm3-btn--primary' : 'm3-btn--text'}`}
                    onClick={() => vm.setFaceType('face-B')}
                  >
                    Cara B (Reverso)
                  </button>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={vm.enableSnaps}
                    onChange={(e) => vm.setEnableSnaps(e.target.checked)}
                  />
                  <span>🧲 Snaps Magnéticos</span>
                </label>
              </div>

              {/* Dynamic Inputs according to opType */}
              <div className="m3-modal-panel">
                {vm.opType === 'groove' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Orientación:
                      </label>
                      <select
                        className="m3-select"
                        style={{ width: '100%', fontSize: '0.85rem' }}
                        value={vm.grooveAxis}
                        onChange={(e) => vm.setGrooveAxis(e.target.value as 'x' | 'y')}
                      >
                        <option value="x">Horizontal (Eje X)</option>
                        <option value="y">Vertical (Eje Y)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Distancia al Canto (mm):
                      </label>
                      <NumericInput
                        id="groove-offset"
                        value={vm.grooveOffset}
                        onChange={vm.setGrooveOffset}
                        min={0}
                        max={vm.grooveAxis === 'x' ? vm.pieceHeight : vm.pieceWidth}
                        step={1}
                        unit="mm"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Ancho Ranura (mm):
                      </label>
                      <NumericInput
                        id="groove-width"
                        value={vm.grooveWidth}
                        onChange={vm.setGrooveWidth}
                        min={1}
                        max={20}
                        step={0.5}
                        unit="mm"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Profundidad (mm):
                      </label>
                      <NumericInput
                        id="groove-depth"
                        value={vm.grooveDepth}
                        onChange={vm.setGrooveDepth}
                        min={1}
                        max={vm.pieceThickness}
                        step={1}
                        unit="mm"
                      />
                    </div>
                  </div>
                )}

                {vm.opType === 'rebate' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Canto a Rebajar:
                      </label>
                      <select
                        className="m3-select"
                        style={{ width: '100%', fontSize: '0.85rem' }}
                        value={vm.rebateEdge}
                        onChange={(e) => vm.setRebateEdge(e.target.value as 'top' | 'bottom' | 'left' | 'right')}
                      >
                        <option value="top">Superior (Y máx)</option>
                        <option value="bottom">Inferior (Y=0)</option>
                        <option value="left">Izquierdo (X=0)</option>
                        <option value="right">Derecho (X máx)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Pestaña / Ancho (mm):
                      </label>
                      <NumericInput
                        id="rebate-width"
                        value={vm.rebateWidth}
                        onChange={vm.setRebateWidth}
                        min={1}
                        max={100}
                        step={1}
                        unit="mm"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Profundidad (mm):
                      </label>
                      <NumericInput
                        id="rebate-depth"
                        value={vm.rebateDepth}
                        onChange={vm.setRebateDepth}
                        min={1}
                        max={vm.pieceThickness}
                        step={1}
                        unit="mm"
                      />
                    </div>
                  </div>
                )}

                {vm.opType === 'cutout' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Posición X (mm):
                      </label>
                      <NumericInput
                        id="cutout-x"
                        value={vm.cutoutX}
                        onChange={vm.setCutoutX}
                        min={0}
                        max={vm.pieceWidth}
                        step={1}
                        unit="mm"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Posición Y (mm):
                      </label>
                      <NumericInput
                        id="cutout-y"
                        value={vm.cutoutY}
                        onChange={vm.setCutoutY}
                        min={0}
                        max={vm.pieceHeight}
                        step={1}
                        unit="mm"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Ancho Calado (mm):
                      </label>
                      <NumericInput
                        id="cutout-w"
                        value={vm.cutoutW}
                        onChange={vm.setCutoutW}
                        min={5}
                        max={vm.pieceWidth}
                        step={1}
                        unit="mm"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Alto Calado (mm):
                      </label>
                      <NumericInput
                        id="cutout-h"
                        value={vm.cutoutH}
                        onChange={vm.setCutoutH}
                        min={5}
                        max={vm.pieceHeight}
                        step={1}
                        unit="mm"
                      />
                    </div>
                    <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={vm.cutoutThrough}
                          onChange={(e) => vm.setCutoutThrough(e.target.checked)}
                        />
                        <span>Pasante (Atraviesa todo el grosor {vm.pieceThickness}mm)</span>
                      </label>
                    </div>
                  </div>
                )}

                {vm.opType === 'drill' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div style={{ gridColumn: 'span 2' }}>
                      <p style={{ margin: '0 0 0.4rem', fontSize: '0.75rem', color: 'var(--md-sys-color-primary)' }}>
                        💡 <em>Tip: Hacé clic directamente sobre el dibujo para fijar la perforación con snap magnético.</em>
                      </p>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Posición X (mm):
                      </label>
                      <NumericInput
                        id="drill-x"
                        value={vm.drillX}
                        onChange={vm.setDrillX}
                        min={0}
                        max={vm.pieceWidth}
                        step={1}
                        unit="mm"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Posición Y (mm):
                      </label>
                      <NumericInput
                        id="drill-y"
                        value={vm.drillY}
                        onChange={vm.setDrillY}
                        min={0}
                        max={vm.pieceHeight}
                        step={1}
                        unit="mm"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Diámetro Ø (mm):
                      </label>
                      <NumericInput
                        id="drill-dia"
                        value={vm.drillDia}
                        onChange={vm.setDrillDia}
                        min={1}
                        max={50}
                        step={1}
                        unit="mm"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Profundidad (mm):
                      </label>
                      <NumericInput
                        id="drill-dep"
                        value={vm.drillDep}
                        onChange={vm.setDrillDep}
                        min={1}
                        max={vm.pieceThickness}
                        step={1}
                        unit="mm"
                        disabled={vm.drillThrough}
                      />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={vm.drillThrough}
                          onChange={(e) => vm.setDrillThrough(e.target.checked)}
                        />
                        <span>Agujero Pasante (Atraviesa {vm.pieceThickness}mm)</span>
                      </label>
                    </div>
                  </div>
                )}

                {vm.opType === 'fastener' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                      Distribuye automáticamente tornillos pasantes, tarugos o minifix a lo largo del eje central de una placa en contacto.
                    </p>

                    {vm.currentFaceProjections.length === 0 ? (
                      <div style={{ padding: '0.5rem', backgroundColor: 'var(--md-sys-color-surface-container-high)', borderRadius: '4px', fontSize: '0.8rem' }}>
                        ℹ️ No se detectan piezas en contacto directo con esta cara. Podes cambiar a la otra cara o usar <strong>Perforación</strong> manual.
                      </div>
                    ) : (
                      <>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                            Pieza de destino (Proyección en contacto):
                          </label>
                          <select
                            className="m3-select"
                            style={{ width: '100%', fontSize: '0.85rem' }}
                            value={vm.selectedProjectionId || vm.currentFaceProjections[0]?.id || ''}
                            onChange={(e) => vm.setSelectedProjectionId(e.target.value)}
                          >
                            {vm.currentFaceProjections.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.label} (Eje {p.axis === 'horizontal' ? `Y=${p.centerLineMm}` : `X=${p.centerLineMm}`}mm)
                              </option>
                            ))}
                          </select>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                              Cantidad:
                            </label>
                            <select
                              className="m3-select"
                              style={{ width: '100%', fontSize: '0.85rem' }}
                              value={vm.fastenerCount}
                              onChange={(e) => vm.setFastenerCount(Number(e.target.value) as 2 | 3 | 4 | 5)}
                            >
                              <option value={2}>2 tornillos</option>
                              <option value={3}>3 tornillos</option>
                              <option value={4}>4 tornillos</option>
                              <option value={5}>5 tornillos</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                              Tipo de Unión:
                            </label>
                            <select
                              className="m3-select"
                              style={{ width: '100%', fontSize: '0.85rem' }}
                              value={vm.fastenerKind}
                              onChange={(e) => vm.setFastenerKind(e.target.value as 'confirmat' | 'dowel' | 'minifix')}
                            >
                              <option value="confirmat">Tornillo Confirmat / Pasante</option>
                              <option value="dowel">Tarugo de madera</option>
                              <option value="minifix">Perno Minifix</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                              Margen Inicial (mm):
                            </label>
                            <NumericInput
                              id="fastener-start"
                              value={vm.setbackStartMm}
                              onChange={vm.setSetbackStartMm}
                              min={10}
                              max={200}
                              step={1}
                              unit="mm"
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                              Margen Final (mm):
                            </label>
                            <NumericInput
                              id="fastener-end"
                              value={vm.setbackEndMm}
                              onChange={vm.setSetbackEndMm}
                              min={10}
                              max={200}
                              step={1}
                              unit="mm"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          className="m3-btn m3-btn--primary"
                          onClick={() => vm.handleApplyFasteners()}
                          style={{ marginTop: '0.4rem' }}
                        >
                          ⚡ Distribuir {vm.fastenerCount} tornillos en el eje
                        </button>
                      </>
                    )}
                  </div>
                )}

                {vm.opType !== 'fastener' && (
                  <div style={{ marginTop: '0.8rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="m3-btn m3-btn--primary"
                      onClick={vm.handleAddOperation}
                    >
                      ➕ Aplicar Mecanizado a la Placa
                    </button>
                  </div>
                )}
              </div>

              {/* List of custom operations on this piece */}
              <div>
                <h5 style={{ margin: '0 0 0.4rem', fontSize: '0.85rem' }}>
                  Mecanizados Personalizados en esta placa ({vm.pieceCustomOps.length}):
                </h5>
                {vm.pieceCustomOps.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                    Sin mecanizados adicionales.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '180px', overflowY: 'auto' }}>
                    {vm.pieceCustomOps.map((op) => (
                      <div
                        key={op.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.4rem 0.6rem',
                          backgroundColor: 'var(--md-sys-color-surface-container)',
                          color: 'var(--md-sys-color-on-surface)',
                          borderRadius: 'var(--md-sys-shape-corner-xs)',
                          fontSize: '0.8rem',
                        }}
                      >
                        <span>
                          <strong>{op.kind.toUpperCase()}</strong> ({op.faceType}):{' '}
                          {op.kind === 'groove'
                            ? `Eje ${op.axis.toUpperCase()}, Dist: ${op.offsetMm}mm, ${op.widthMm}x${op.depthMm}mm`
                            : op.kind === 'rebate'
                            ? `Canto ${op.edge}, Pestaña: ${op.widthMm}mm, Prof: ${op.depthMm}mm`
                            : op.kind === 'cutout'
                            ? `X:${op.xMm}, Y:${op.yMm}, ${op.widthMm}x${op.heightMm}x${op.depthMm}mm`
                            : `Ø${op.diameterMm}x${op.depthMm}mm en (${op.xMm}, ${op.yMm})`}
                        </span>
                        <button
                          type="button"
                          className="m3-btn m3-btn--text"
                          style={{ color: 'var(--md-sys-color-error)', padding: '0.1rem 0.4rem' }}
                          onClick={() => vm.handleRemoveOperation(op.id)}
                          aria-label="Eliminar mecanizado"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Interactive 2D Technical SVG Canvas */}
            <div className="machining-editor-canvas-column">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.4rem' }}>
                <h5 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--md-sys-color-on-surface)' }}>
                  Vista Técnica 2D ({vm.faceType === 'face-A' ? 'Cara A' : 'Cara B'}):
                </h5>
                {vm.cursorPosMm && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      padding: '0.15rem 0.5rem',
                      backgroundColor: 'var(--md-sys-color-secondary-container)',
                      color: 'var(--md-sys-color-on-secondary-container)',
                      borderRadius: '4px',
                    }}
                  >
                    X: {vm.cursorPosMm.x} mm | Y: {vm.cursorPosMm.y} mm
                    {vm.snapResult?.label ? ` • ${vm.snapResult.label}` : ''}
                  </span>
                )}
              </div>

              <div className="m3-modal-svg-canvas" style={{ width: '100%', position: 'relative' }}>
                <svg
                  ref={svgRef}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox={`0 0 ${targetWidth} ${targetHeight}`}
                  width="100%"
                  height="100%"
                  style={{ backgroundColor: '#fafafa', cursor: 'crosshair', userSelect: 'none', touchAction: 'none' }}
                  onPointerMove={(e) => handleSvgPointer(e, false)}
                  onPointerLeave={vm.handlePointerLeave}
                  onPointerDown={(e) => handleSvgPointer(e, true)}
                >
                  {/* Turn banner for Face B */}
                  {vm.faceType === 'face-B' && vm.previewSheet?.requiresTurn && (
                    <g>
                      <rect x="20" y="12" width={targetWidth - 40} height="32" rx="6" fill="#fff3cd" stroke="#ffc107" strokeWidth="1.5" />
                      <text x={targetWidth / 2} y="32" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#664d03">
                        ⚠️ ATENCIÓN: GIRAR LA PIEZA PARA MECANIZAR CARA B (TURN PIECE OVER)
                      </text>
                    </g>
                  )}

                  {/* Piece Board Outline */}
                  <rect
                    x={originX}
                    y={originY}
                    width={drawW}
                    height={drawH}
                    fill="#e8eaed"
                    stroke="#1f1f1f"
                    strokeWidth="2"
                  />

                  {/* Banded Edges */}
                  {vm.previewSheet?.bandedEdges.top && (
                    <line x1={originX} y1={originY} x2={originX + drawW} y2={originY} stroke="#0b57d0" strokeWidth="4" />
                  )}
                  {vm.previewSheet?.bandedEdges.bottom && (
                    <line x1={originX} y1={originY + drawH} x2={originX + drawW} y2={originY + drawH} stroke="#0b57d0" strokeWidth="4" />
                  )}
                  {vm.previewSheet?.bandedEdges.left && (
                    <line x1={originX} y1={originY} x2={originX} y2={originY + drawH} stroke="#0b57d0" strokeWidth="4" />
                  )}
                  {vm.previewSheet?.bandedEdges.right && (
                    <line x1={originX + drawW} y1={originY} x2={originX + drawW} y2={originY + drawH} stroke="#0b57d0" strokeWidth="4" />
                  )}

                  {/* Datum (0, 0) Marker at bottom-left */}
                  <g transform={`translate(${datumX}, ${datumY})`}>
                    <circle cx="0" cy="0" r="4" fill="#ba1a1a" />
                    <line x1="-12" y1="0" x2="25" y2="0" stroke="#ba1a1a" strokeWidth="1.5" />
                    <line x1="0" y1="12" x2="0" y2="-25" stroke="#ba1a1a" strokeWidth="1.5" />
                    <text x="-8" y="18" fontSize="10" fontWeight="bold" fill="#ba1a1a">Datum (0,0)</text>
                  </g>

                  {/* Contact Footprints (Ghost projections of adjacent pieces) */}
                  {vm.currentFaceProjections.map((proj) => {
                    const pxX = toSvgX(proj.xMm);
                    const pxY = toSvgY(proj.yMm + proj.heightMm);
                    const pW = proj.widthMm * scale;
                    const pH = proj.heightMm * scale;

                    const isH = proj.axis === 'horizontal';
                    const clY = toSvgY(proj.centerLineMm);
                    const clX = toSvgX(proj.centerLineMm);

                    const isSelected = vm.selectedProjectionId === proj.id;

                    return (
                      <g key={proj.id} style={{ pointerEvents: 'none' }}>
                        {/* Projection boundary box */}
                        <rect
                          x={pxX}
                          y={pxY}
                          width={pW}
                          height={pH}
                          fill={isSelected ? 'rgba(11, 87, 208, 0.15)' : 'rgba(2, 136, 209, 0.08)'}
                          stroke={isSelected ? '#0b57d0' : '#0288d1'}
                          strokeWidth={isSelected ? '2' : '1.5'}
                          strokeDasharray="4 3"
                        />
                        {/* Centerline */}
                        {isH ? (
                          <line
                            x1={pxX}
                            y1={clY}
                            x2={pxX + pW}
                            y2={clY}
                            stroke="#0288d1"
                            strokeWidth="1.5"
                            strokeDasharray="2 2"
                          />
                        ) : (
                          <line
                            x1={clX}
                            y1={pxY}
                            x2={clX}
                            y2={pxY + pH}
                            stroke="#0288d1"
                            strokeWidth="1.5"
                            strokeDasharray="2 2"
                          />
                        )}
                        {/* Label */}
                        <text
                          x={pxX + 6}
                          y={pxY + 14}
                          fontSize="9"
                          fontWeight="bold"
                          fill="#01579b"
                        >
                          {proj.label}
                        </text>
                      </g>
                    );
                  })}

                  {/* Existing operations rendered on piece */}
                  {currentFaceOps.map((op) => {
                    const cx = toSvgX(op.xMm);
                    const cy = toSvgY(op.yMm);
                    const r = Math.max(3, (op.diameterMm / 2) * scale);
                    const isHinge = op.diameterMm >= 30;

                    return (
                      <g key={op.id}>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={r}
                          fill={isHinge ? '#76777a' : op.isThrough ? '#1c1b1f' : '#444746'}
                          stroke="#ffffff"
                          strokeWidth="1"
                        />
                        <text
                          x={cx + r + 4}
                          y={cy + 3}
                          fontSize="9"
                          fill="#1f1f1f"
                        >
                          Ø{op.diameterMm}
                        </text>
                      </g>
                    );
                  })}

                  {/* Custom Grooves & Cutouts preview */}
                  {vm.pieceCustomOps
                    .filter((op) => op.faceType === vm.faceType)
                    .map((op) => {
                      if (op.kind === 'groove') {
                        const isX = op.axis === 'x';
                        const gx = isX ? originX : toSvgX(op.offsetMm);
                        const gy = isX ? toSvgY(op.offsetMm + op.widthMm) : originY;
                        const gw = isX ? drawW : op.widthMm * scale;
                        const gh = isX ? op.widthMm * scale : drawH;
                        return (
                          <rect
                            key={op.id}
                            x={gx}
                            y={gy}
                            width={gw}
                            height={gh}
                            fill="rgba(68, 71, 70, 0.3)"
                            stroke="#444746"
                            strokeWidth="1"
                          />
                        );
                      }
                      if (op.kind === 'cutout') {
                        return (
                          <rect
                            key={op.id}
                            x={toSvgX(op.xMm)}
                            y={toSvgY(op.yMm + op.heightMm)}
                            width={op.widthMm * scale}
                            height={op.heightMm * scale}
                            fill="rgba(186, 26, 26, 0.25)"
                            stroke="#ba1a1a"
                            strokeWidth="1.5"
                          />
                        );
                      }
                      return null;
                    })}

                  {/* Magnetic Snap Guides & Crosshair */}
                  {vm.cursorPosMm && vm.snapResult && (
                    <g style={{ pointerEvents: 'none' }}>
                      {/* Vertical snap guide */}
                      {vm.snapResult.isSnappedX && (
                        <line
                          x1={toSvgX(vm.snapResult.xMm)}
                          y1={originY}
                          x2={toSvgX(vm.snapResult.xMm)}
                          y2={originY + drawH}
                          stroke="#ba1a1a"
                          strokeWidth="1.5"
                          strokeDasharray="4 3"
                        />
                      )}
                      {/* Horizontal snap guide */}
                      {vm.snapResult.isSnappedY && (
                        <line
                          x1={originX}
                          y1={toSvgY(vm.snapResult.yMm)}
                          x2={originX + drawW}
                          y2={toSvgY(vm.snapResult.yMm)}
                          stroke="#ba1a1a"
                          strokeWidth="1.5"
                          strokeDasharray="4 3"
                        />
                      )}
                      {/* Target Reticle */}
                      <circle
                        cx={toSvgX(vm.snapResult.xMm)}
                        cy={toSvgY(vm.snapResult.yMm)}
                        r="6"
                        fill="none"
                        stroke="#ba1a1a"
                        strokeWidth="2"
                      />
                      <circle
                        cx={toSvgX(vm.snapResult.xMm)}
                        cy={toSvgY(vm.snapResult.yMm)}
                        r="2"
                        fill="#ba1a1a"
                      />
                    </g>
                  )}
                </svg>
              </div>

              <div style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <span>🔴 Datum (0,0) en esquina inferior izquierda</span>
                <span>🔵 Línea punteada: Contacto con placas adyacentes</span>
                <span>🧲 Snaps: Centros, Cuartos, Línea 37mm, Ejes</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="m3-modal-footer">
          <button type="button" className="m3-btn m3-btn--tonal" onClick={vm.onClose}>
            Listo / Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
