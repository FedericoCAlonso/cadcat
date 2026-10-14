import { useState, type ReactElement } from 'react';
import type { CustomPieceOperation } from '../model';
import {
  type ResolvedPieceWithCutSize,
  buildPieceMachiningSheet,
  renderPieceMachiningSvg,
} from '../resolver';
import { NumericInput } from './NumericInput';

export interface MachiningEditorModalProps {
  piece: ResolvedPieceWithCutSize | null;
  customOperations: CustomPieceOperation[];
  onAddOperation: (pieceId: string, op: CustomPieceOperation) => void;
  onRemoveOperation: (pieceId: string, opId: string) => void;
  onClose: () => void;
}

export function MachiningEditorModal(props: MachiningEditorModalProps): ReactElement | null {
  const { piece, customOperations, onAddOperation, onRemoveOperation, onClose } = props;

  const [opType, setOpType] = useState<'drill' | 'groove' | 'rebate' | 'cutout'>('groove');
  const [faceType, setFaceType] = useState<'face-A' | 'face-B'>('face-A');

  // Drill inputs
  const [drillX, setDrillX] = useState<number>(50);
  const [drillY, setDrillY] = useState<number>(50);
  const [drillDia, setDrillDia] = useState<number>(8);
  const [drillDep, setDrillDep] = useState<number>(12);
  const [drillThrough, setDrillThrough] = useState<boolean>(false);

  // Groove inputs
  const [grooveAxis, setGrooveAxis] = useState<'x' | 'y'>('x');
  const [grooveOffset, setGrooveOffset] = useState<number>(20);
  const [grooveWidth, setGrooveWidth] = useState<number>(4);
  const [grooveDepth, setGrooveDepth] = useState<number>(8);

  // Rebate inputs
  const [rebateEdge, setRebateEdge] = useState<'top' | 'bottom' | 'left' | 'right'>('top');
  const [rebateWidth, setRebateWidth] = useState<number>(10);
  const [rebateDepth, setRebateDepth] = useState<number>(5);

  // Cutout inputs
  const [cutoutX, setCutoutX] = useState<number>(100);
  const [cutoutY, setCutoutY] = useState<number>(100);
  const [cutoutW, setCutoutW] = useState<number>(60);
  const [cutoutH, setCutoutH] = useState<number>(60);
  const [cutoutDep, setCutoutDep] = useState<number>(18);
  const [cutoutThrough, setCutoutThrough] = useState<boolean>(true);

  if (!piece) return null;

  const pieceCustomOps = customOperations.filter((op) => op.pieceId === piece.id);

  const previewSheet = buildPieceMachiningSheet(piece, [], pieceCustomOps);
  const svgPreview = renderPieceMachiningSvg(previewSheet, faceType, {
    svgWidth: 500,
    svgHeight: 320,
  });

  const handleAdd = () => {
    const id = `cust-${opType}-${Date.now()}`;
    let op: CustomPieceOperation;

    if (opType === 'drill') {
      op = {
        kind: 'drill',
        id,
        pieceId: piece.id,
        faceType,
        xMm: drillX,
        yMm: drillY,
        diameterMm: drillDia,
        depthMm: drillDep,
        isThrough: drillThrough,
      };
    } else if (opType === 'groove') {
      op = {
        kind: 'groove',
        id,
        pieceId: piece.id,
        faceType,
        axis: grooveAxis,
        offsetMm: grooveOffset,
        widthMm: grooveWidth,
        depthMm: grooveDepth,
      };
    } else if (opType === 'rebate') {
      op = {
        kind: 'rebate',
        id,
        pieceId: piece.id,
        faceType,
        edge: rebateEdge,
        widthMm: rebateWidth,
        depthMm: rebateDepth,
      };
    } else {
      op = {
        kind: 'cutout',
        id,
        pieceId: piece.id,
        faceType,
        xMm: cutoutX,
        yMm: cutoutY,
        widthMm: cutoutW,
        heightMm: cutoutH,
        depthMm: cutoutDep,
        isThrough: cutoutThrough,
      };
    }

    onAddOperation(piece.id, op);
  };

  return (
    <div
      className="m3-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="m3-modal-dialog">
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
            onClick={onClose}
            style={{ fontSize: '1.25rem', padding: '0.2rem 0.6rem' }}
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        <div className="m3-modal-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
          {/* Controls Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`m3-btn m3-btn--small ${opType === 'groove' ? 'm3-btn--primary' : 'm3-btn--outlined'}`}
                onClick={() => setOpType('groove')}
              >
                ➖ Ranura
              </button>
              <button
                type="button"
                className={`m3-btn m3-btn--small ${opType === 'rebate' ? 'm3-btn--primary' : 'm3-btn--outlined'}`}
                onClick={() => setOpType('rebate')}
              >
                🔲 Rebaje en Canto
              </button>
              <button
                type="button"
                className={`m3-btn m3-btn--small ${opType === 'cutout' ? 'm3-btn--primary' : 'm3-btn--outlined'}`}
                onClick={() => setOpType('cutout')}
              >
                ⏹️ Fresado / Pasacables
              </button>
              <button
                type="button"
                className={`m3-btn m3-btn--small ${opType === 'drill' ? 'm3-btn--primary' : 'm3-btn--outlined'}`}
                onClick={() => setOpType('drill')}
              >
                🔘 Perforación
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Cara:</span>
              <button
                type="button"
                className={`m3-btn m3-btn--small ${faceType === 'face-A' ? 'm3-btn--primary' : 'm3-btn--text'}`}
                onClick={() => setFaceType('face-A')}
              >
                Cara A (Frente)
              </button>
              <button
                type="button"
                className={`m3-btn m3-btn--small ${faceType === 'face-B' ? 'm3-btn--primary' : 'm3-btn--text'}`}
                onClick={() => setFaceType('face-B')}
              >
                Cara B (Reverso)
              </button>
            </div>

            {/* Dynamic Inputs according to opType */}
            <div className="m3-modal-panel">
              {opType === 'groove' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      Orientación:
                    </label>
                    <select
                      className="m3-select"
                      style={{ width: '100%', fontSize: '0.85rem' }}
                      value={grooveAxis}
                      onChange={(e) => setGrooveAxis(e.target.value as 'x' | 'y')}
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
                      value={grooveOffset}
                      min={0}
                      max={Math.max(piece.dimensionsMm.width, piece.dimensionsMm.height)}
                      onChange={setGrooveOffset}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      Ancho Sierra/Fresa (mm):
                    </label>
                    <NumericInput
                      id="groove-width"
                      value={grooveWidth}
                      min={1}
                      max={50}
                      step={0.5}
                      onChange={setGrooveWidth}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      Profundidad (mm):
                    </label>
                    <NumericInput
                      id="groove-depth"
                      value={grooveDepth}
                      min={1}
                      max={piece.thicknessMm}
                      step={0.5}
                      onChange={setGrooveDepth}
                    />
                  </div>
                </div>
              )}

              {opType === 'rebate' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      Canto de Referencia:
                    </label>
                    <select
                      className="m3-select"
                      style={{ width: '100%', fontSize: '0.85rem' }}
                      value={rebateEdge}
                      onChange={(e) => setRebateEdge(e.target.value as 'top' | 'bottom' | 'left' | 'right')}
                    >
                      <option value="top">Canto Superior</option>
                      <option value="bottom">Canto Inferior</option>
                      <option value="left">Canto Izquierdo</option>
                      <option value="right">Canto Derecho</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      Ancho Pestaña (mm):
                    </label>
                    <NumericInput
                      id="rebate-width"
                      value={rebateWidth}
                      min={1}
                      max={100}
                      step={1}
                      onChange={setRebateWidth}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      Profundidad (mm):
                    </label>
                    <NumericInput
                      id="rebate-depth"
                      value={rebateDepth}
                      min={1}
                      max={piece.thicknessMm}
                      step={0.5}
                      onChange={setRebateDepth}
                    />
                  </div>
                </div>
              )}

              {opType === 'cutout' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      Posición X (mm):
                    </label>
                    <NumericInput id="cutout-x" value={cutoutX} min={0} onChange={setCutoutX} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      Posición Y (mm):
                    </label>
                    <NumericInput id="cutout-y" value={cutoutY} min={0} onChange={setCutoutY} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      Ancho (mm):
                    </label>
                    <NumericInput id="cutout-w" value={cutoutW} min={5} onChange={setCutoutW} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      Alto (mm):
                    </label>
                    <NumericInput id="cutout-h" value={cutoutH} min={5} onChange={setCutoutH} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      Profundidad (mm):
                    </label>
                    <NumericInput
                      id="cutout-depth"
                      value={cutoutDep}
                      min={1}
                      max={piece.thicknessMm}
                      onChange={setCutoutDep}
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={cutoutThrough}
                        onChange={(e) => setCutoutThrough(e.target.checked)}
                      />
                      Pasante (Corte total)
                    </label>
                  </div>
                </div>
              )}

              {opType === 'drill' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      Cota X (desde Izq.) (mm):
                    </label>
                    <NumericInput id="drill-x" value={drillX} min={0} onChange={setDrillX} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      Cota Y (desde Inf.) (mm):
                    </label>
                    <NumericInput id="drill-y" value={drillY} min={0} onChange={setDrillY} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      Diámetro Ø (mm):
                    </label>
                    <NumericInput id="drill-dia" value={drillDia} min={1} max={50} step={0.5} onChange={setDrillDia} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      Profundidad (mm):
                    </label>
                    <NumericInput
                      id="drill-dep"
                      value={drillDep}
                      min={1}
                      max={piece.thicknessMm}
                      step={0.5}
                      onChange={setDrillDep}
                    />
                  </div>
                  <div style={{ gridColumn: 'span 2', marginTop: '0.3rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={drillThrough}
                        onChange={(e) => setDrillThrough(e.target.checked)}
                      />
                      Agujero Pasante
                    </label>
                  </div>
                </div>
              )}

              <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="m3-btn m3-btn--primary"
                  onClick={handleAdd}
                >
                  ➕ Aplicar Mecanizado a la Placa
                </button>
              </div>
            </div>

            {/* List of custom operations on this piece */}
            <div>
              <h5 style={{ margin: '0 0 0.4rem', fontSize: '0.85rem' }}>
                Mecanizados Personalizados en esta placa ({pieceCustomOps.length}):
              </h5>
              {pieceCustomOps.length === 0 ? (
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                  Sin mecanizados adicionales.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {pieceCustomOps.map((op) => (
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
                        onClick={() => onRemoveOperation(piece.id, op.id)}
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

          {/* Live Preview Column */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h5 style={{ margin: '0 0 0.4rem', fontSize: '0.85rem', alignSelf: 'flex-start', color: 'var(--md-sys-color-on-surface)' }}>
              Vista Técnica 2D ({faceType === 'face-A' ? 'Cara A' : 'Cara B'}):
            </h5>
            <div
              className="m3-modal-svg-canvas"
              style={{ width: '100%' }}
              dangerouslySetInnerHTML={{ __html: svgPreview }}
            />
          </div>
        </div>
      </div>

      <div className="m3-modal-footer">
        <button type="button" className="m3-btn m3-btn--tonal" onClick={onClose}>
          Listo / Cerrar
        </button>
      </div>
    </div>
  </div>
);
}
