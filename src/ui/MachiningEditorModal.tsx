import { useRef, useState, useEffect, type ReactElement } from 'react';
import type {
  CustomPieceOperation,
  ToolItem,
  Material,
  MachiningConfig,
  DrillOperation,
  CornerTreatment,
  EdgeProfileKind,
} from '../model';
import {
  type ResolvedPieceWithCutSize,
  type SpatialPieceBox,
  getFaceSemanticLabel,
  calculatePocketCornerRelief,
} from '../resolver';
import { NumericInput } from './NumericInput';
import { useMachiningEditorViewModel } from './useMachiningEditorViewModel';
import { usePanZoom } from './usePanZoom';

export interface MachiningEditorModalProps {
  piece: ResolvedPieceWithCutSize | null;
  customOperations: CustomPieceOperation[];
  spatialBoxes?: SpatialPieceBox[];
  tools?: ToolItem[];
  material?: Material | null;
  materials?: Material[];
  derivedOperations?: DrillOperation[];
  config?: Partial<MachiningConfig>;
  onAddOperation: (pieceId: string, op: CustomPieceOperation) => void;
  onRemoveOperation: (pieceId: string, opId: string) => void;
  onClose: () => void;
}

const DEFAULT_CANVAS_WIDTH = 800;
const DEFAULT_CANVAS_HEIGHT = 520;

export function MachiningEditorModal(props: MachiningEditorModalProps): ReactElement | null {
  const { piece } = props;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [mobileTab, setMobileTab] = useState<'canvas' | 'controls' | 'list' | 'table'>('canvas');

  const vm = useMachiningEditorViewModel(props);
  const panZoom = usePanZoom({
    minZoom: 0.35,
    maxZoom: 6.0,
    zoomStep: 1.25,
    targetViewBox: { width: DEFAULT_CANVAS_WIDTH, height: DEFAULT_CANVAS_HEIGHT },
  });

  // Desktop keyboard hotkeys: G=Groove, R=Rebate, F=Cutout, D=Drill, S=Series, P=Profile, T=Fasteners, Esc=Close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'g') {
        vm.setOpType('groove');
      } else if (key === 'r') {
        vm.setOpType('rebate');
      } else if (key === 'f' && !e.shiftKey) {
        vm.setOpType('cutout');
      } else if (key === 'd') {
        vm.setOpType('drill');
      } else if (key === 's') {
        vm.setOpType('hole-series');
      } else if (key === 'p') {
        vm.setOpType('edge-profile');
      } else if (key === 't') {
        vm.setOpType('fastener');
      } else if (e.key === 'Escape') {
        vm.onClose();
      } else if (key === 'f' && e.shiftKey) {
        panZoom.fitView();
      } else if (e.key === '+' || e.key === '=') {
        panZoom.zoomIn();
      } else if (e.key === '-') {
        panZoom.zoomOut();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [vm, panZoom]);

  if (!piece) return null;

  // SVG Drawing Coordinate Geometry
  const targetWidth = DEFAULT_CANVAS_WIDTH;
  const targetHeight = DEFAULT_CANVAS_HEIGHT;
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

  // Convert client pointer to local mm coordinates accounting for pan & zoom
  const handleSvgPointer = (e: React.PointerEvent<SVGSVGElement>, isClick = false) => {
    if (!svgRef.current) return;

    if (panZoom.isPanning) {
      panZoom.updatePan(e.clientX, e.clientY);
      return;
    }

    const rect = svgRef.current.getBoundingClientRect();
    const svgPxX = ((e.clientX - rect.left) / rect.width) * targetWidth;
    const svgPxY = ((e.clientY - rect.top) / rect.height) * targetHeight;

    const unpannedSvgX = (svgPxX - panZoom.pan.x) / panZoom.zoom;
    const unpannedSvgY = (svgPxY - panZoom.pan.y) / panZoom.zoom;

    let unrotatedSvgX = unpannedSvgX;
    let unrotatedSvgY = unpannedSvgY;
    if (vm.rotationDeg !== 0) {
      const rad = (-vm.rotationDeg * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const cx = originX + drawW / 2;
      const cy = originY + drawH / 2;
      const dx = unpannedSvgX - cx;
      const dy = unpannedSvgY - cy;
      unrotatedSvgX = cos * dx - sin * dy + cx;
      unrotatedSvgY = sin * dx + cos * dy + cy;
    }

    const rawMmX = (unrotatedSvgX - datumX) / scale;
    const rawMmY = (datumY - unrotatedSvgY) / scale;

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
      <div className={`m3-modal-dialog machining-editor-dialog ${isMaximized ? 'machining-editor-dialog--maximized' : ''}`}>
        {/* Header */}
        <div className="m3-modal-header machining-editor-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="machining-editor-header-text">
            <h3 className="m3-modal-title">
              <span className="desktop-only-text">🛠️ Editor de Mecanizados en Placa: </span>
              <span className="mobile-only-inline" aria-hidden="true" style={{ marginRight: '0.2rem' }}>🛠️</span>
              <strong>{piece.id}</strong>
            </h3>
            <p className="m3-modal-subtitle">
              <span className="machining-header-dim-badge">{`${piece.dimensionsMm.width} × ${piece.dimensionsMm.height} × ${piece.thicknessMm} mm`}</span>
              <span className="desktop-only-text">{` | Rol: ${piece.role}`}</span>
              {vm.validationIssues.length === 0 ? (
                <span
                  style={{
                    marginLeft: '0.5rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    backgroundColor: 'rgba(34, 197, 94, 0.15)',
                    color: '#15803d',
                  }}
                  title="Sin observaciones de taller"
                >
                  ✓ Reglas OK
                </span>
              ) : (
                <span
                  style={{
                    marginLeft: '0.5rem',
                    padding: '0.15rem 0.5rem',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    backgroundColor: vm.validationIssues.some((i) => i.level === 'error')
                      ? 'var(--md-sys-color-error-container)'
                      : '#fef08a',
                    color: vm.validationIssues.some((i) => i.level === 'error')
                      ? 'var(--md-sys-color-on-error-container)'
                      : '#854d0e',
                  }}
                  title={`${vm.validationIssues.length} observaciones`}
                >
                  {vm.validationIssues.some((i) => i.level === 'error') ? '⛔' : '⚠️'}{' '}
                  {vm.validationIssues.length} {vm.validationIssues.some((i) => i.level === 'error') ? 'Error(es)' : 'Aviso(s)'}
                </span>
              )}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <button
              type="button"
              className="m3-btn m3-btn--small m3-btn--tonal"
              onClick={vm.handleExportDxf}
              title="Descargar archivo AutoCAD R12 DXF para mecanizado CNC"
              aria-label="Descargar DXF de la pieza"
              style={{ minHeight: '44px', fontWeight: 600 }}
            >
              📐 DXF
            </button>
            <button
              type="button"
              className="m3-btn m3-btn--small m3-btn--outlined desktop-only-control"
              onClick={() => setIsMaximized(!isMaximized)}
              title="Alternar Pantalla Completa CAD"
              aria-label="Maximizar o restaurar modal"
            >
              {isMaximized ? '🗗 Restaurar' : '🗖 Maximizar CAD'}
            </button>
            <button
              type="button"
              className="m3-btn m3-btn--text machining-close-btn"
              onClick={vm.onClose}
              style={{ fontSize: '1.25rem', padding: '0.2rem 0.6rem' }}
              aria-label="Cerrar modal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Workshop Technical Configuration Bar */}
        <div
          className="machining-shop-config-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.4rem 0.75rem',
            backgroundColor: 'var(--md-sys-color-surface-container-high)',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          {/* Left: Datum Reference & Rotation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--md-sys-color-primary)' }}>
              📍 Origen Datum (0,0):
            </span>
            <div className="m3-segmented-button" style={{ height: '30px' }}>
              <button
                type="button"
                className={`m3-chip ${vm.datumCorner === 'bottom-left' ? 'm3-chip--selected' : ''}`}
                style={{ height: '28px', padding: '0 0.45rem', fontSize: '0.72rem' }}
                onClick={() => vm.setDatumCorner('bottom-left')}
                title="Origen en esquina Inferior Izquierda (estándar)"
              >
                ↙️ Inf-Izq
              </button>
              <button
                type="button"
                className={`m3-chip ${vm.datumCorner === 'top-left' ? 'm3-chip--selected' : ''}`}
                style={{ height: '28px', padding: '0 0.45rem', fontSize: '0.72rem' }}
                onClick={() => vm.setDatumCorner('top-left')}
                title="Origen en esquina Superior Izquierda"
              >
                ↖️ Sup-Izq
              </button>
              <button
                type="button"
                className={`m3-chip ${vm.datumCorner === 'bottom-right' ? 'm3-chip--selected' : ''}`}
                style={{ height: '28px', padding: '0 0.45rem', fontSize: '0.72rem' }}
                onClick={() => vm.setDatumCorner('bottom-right')}
                title="Origen en esquina Inferior Derecha"
              >
                ↘️ Inf-Der
              </button>
              <button
                type="button"
                className={`m3-chip ${vm.datumCorner === 'top-right' ? 'm3-chip--selected' : ''}`}
                style={{ height: '28px', padding: '0 0.45rem', fontSize: '0.72rem' }}
                onClick={() => vm.setDatumCorner('top-right')}
                title="Origen en esquina Superior Derecha"
              >
                ↗️ Sup-Der
              </button>
            </div>

            {/* Rotation */}
            <button
              type="button"
              className="m3-btn m3-btn--small m3-btn--tonal"
              style={{ height: '28px', padding: '0 0.55rem', fontSize: '0.75rem' }}
              onClick={vm.handleRotateClockwise}
              title="Girar la pieza 90 grados para acomodarla como en el banco de trabajo"
            >
              🔄 Girar {vm.rotationDeg !== 0 ? `(${vm.rotationDeg}°)` : '90°'}
            </button>
          </div>

          {/* Right: Technical Layer Toggles */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            {/* Grid Toggle */}
            <button
              type="button"
              className={`m3-chip ${vm.showGrid ? 'm3-chip--selected' : ''}`}
              style={{ height: '28px', padding: '0 0.5rem', fontSize: '0.72rem' }}
              onClick={() => vm.setShowGrid(!vm.showGrid)}
              title="Activar/desactivar cuadrícula de taller en milímetros"
            >
              🏁 Red {vm.showGrid ? `(${vm.gridPitch}mm)` : ''}
            </button>
            {vm.showGrid && (
              <select
                className="m3-select"
                style={{ height: '28px', padding: '0 0.3rem', fontSize: '0.72rem' }}
                value={vm.gridPitch}
                onChange={(e) => vm.setGridPitch(Number(e.target.value) as 32 | 50)}
              >
                <option value={32}>Paso 32 mm</option>
                <option value={50}>Paso 50 mm</option>
              </select>
            )}

            {/* Projections Toggle */}
            <button
              type="button"
              className={`m3-chip ${vm.showProjections ? 'm3-chip--selected' : ''}`}
              style={{ height: '28px', padding: '0 0.5rem', fontSize: '0.72rem' }}
              onClick={() => vm.setShowProjections(!vm.showProjections)}
              title="Mostrar u ocultar siluetas fantasma de piezas en contacto"
            >
              👻 Huellas Contacto
            </button>

            {/* Edge banding Toggle */}
            <button
              type="button"
              className={`m3-chip ${vm.showEdgeBanding ? 'm3-chip--selected' : ''}`}
              style={{ height: '28px', padding: '0 0.5rem', fontSize: '0.72rem' }}
              onClick={() => vm.setShowEdgeBanding(!vm.showEdgeBanding)}
              title="Resaltar bordes con tapacantos aplicados"
            >
              🏷️ Tapacantos
            </button>

            {/* Table view toggle */}
            <button
              type="button"
              className={`m3-btn m3-btn--small ${vm.showCoordsTable ? 'm3-btn--primary' : 'm3-btn--outlined'}`}
              style={{ height: '28px', padding: '0 0.6rem', fontSize: '0.75rem', fontWeight: 700 }}
              onClick={() => vm.setShowCoordsTable(!vm.showCoordsTable)}
              title="Ver u ocultar tabla de cotas ordenadas para punzonado en banco"
            >
              📋 {vm.showCoordsTable ? 'Ocultar Tabla' : 'Tabla de Banco'} ({vm.benchOperationsTable.length})
            </button>
          </div>
        </div>

        {/* One-Click Workshop Presets Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.3rem 0.75rem',
            backgroundColor: 'var(--md-sys-color-surface-container-low)',
            borderBottom: '1px solid var(--md-sys-color-outline-variant)',
            overflowX: 'auto',
          }}
        >
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface-variant)', whiteSpace: 'nowrap' }}>
            ⚡ Atajos de Banco:
          </span>
          <button
            type="button"
            className="m3-chip"
            style={{ height: '28px', padding: '0 0.55rem', fontSize: '0.74rem', whiteSpace: 'nowrap' }}
            onClick={() => vm.applyCupHingesPreset()}
            title="Generar 2 perforaciones de bisagra cazoleta Ø35mm a 100mm de extremos y 21.5mm del borde"
          >
            🗄️ Bisagras Ø35 mm (Par)
          </button>
          <button
            type="button"
            className="m3-chip"
            style={{ height: '28px', padding: '0 0.55rem', fontSize: '0.74rem', whiteSpace: 'nowrap' }}
            onClick={() => vm.applySystem32ShelfPinsPreset()}
            title="Generar dos filas de cremallera Sistema 32 mm a 37mm de frente y fondo"
          >
            📏 Cremalleras Sist. 32 (Frente + Fondo)
          </button>
          <button
            type="button"
            className="m3-chip"
            style={{ height: '28px', padding: '0 0.55rem', fontSize: '0.74rem', whiteSpace: 'nowrap' }}
            onClick={() => vm.applyBackingGroovePreset()}
            title="Generar ranura longitudinal para fondo de 4x8 mm a 15 mm del borde"
          >
            ➖ Ranura Fondo (15 mm)
          </button>
        </div>

        {/* Mobile View Switcher (Tabs) */}
        <div className="machining-editor-mobile-tabs" role="tablist" aria-label="Vistas del editor de mecanizados">
          <div className="m3-segmented-button" style={{ width: '100%' }}>
            <button
              type="button"
              className={`m3-segmented-button__item ${mobileTab === 'canvas' ? 'selected' : ''}`}
              onClick={() => setMobileTab('canvas')}
            >
              📐 Plano 2D
            </button>
            <button
              type="button"
              className={`m3-segmented-button__item ${mobileTab === 'controls' ? 'selected' : ''}`}
              onClick={() => setMobileTab('controls')}
            >
              ⚙️ Parámetros
            </button>
            <button
              type="button"
              className={`m3-segmented-button__item ${mobileTab === 'list' ? 'selected' : ''}`}
              onClick={() => setMobileTab('list')}
            >
              📋 Manuales ({vm.pieceCustomOps.length})
            </button>
            <button
              type="button"
              className={`m3-segmented-button__item ${mobileTab === 'table' ? 'selected' : ''}`}
              onClick={() => setMobileTab('table')}
            >
              📊 Tabla ({vm.benchOperationsTable.length})
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="m3-modal-body">
          <div className={`machining-editor-layout mobile-tab--${mobileTab}`}>
            {/* Controls & Operations Column */}
            <div className="machining-editor-sidebar">
              {/* Tool Selection Chips */}
              <div className="machining-tool-chips-scroll" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`m3-btn m3-btn--small ${vm.opType === 'drill' ? 'm3-btn--primary' : 'm3-btn--outlined'}`}
                  onClick={() => vm.setOpType('drill')}
                >
                  🔘 Perforación
                </button>
                <button
                  type="button"
                  className={`m3-btn m3-btn--small ${vm.opType === 'hole-series' ? 'm3-btn--primary' : 'm3-btn--outlined'}`}
                  onClick={() => vm.setOpType('hole-series')}
                >
                  📏 Cremallera Sist. 32
                </button>
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
                  ⏹️ Cajeado / Pasacables
                </button>
                <button
                  type="button"
                  className={`m3-btn m3-btn--small ${vm.opType === 'edge-profile' ? 'm3-btn--primary' : 'm3-btn--outlined'}`}
                  onClick={() => vm.setOpType('edge-profile')}
                >
                  📐 Moldura / Perfil
                </button>
                <button
                  type="button"
                  className={`m3-btn m3-btn--small ${vm.opType === 'fastener' ? 'm3-btn--primary' : 'm3-btn--outlined'}`}
                  onClick={() => vm.setOpType('fastener')}
                >
                  ⚡ Distribución Ensambles
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
                    Cara A ({getFaceSemanticLabel(piece.role, 'face-A')})
                  </button>
                  <button
                    type="button"
                    className={`m3-btn m3-btn--small ${vm.faceType === 'face-B' ? 'm3-btn--primary' : 'm3-btn--text'}`}
                    onClick={() => vm.setFaceType('face-B')}
                  >
                    Cara B ({getFaceSemanticLabel(piece.role, 'face-B')})
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
                {/* 1. DRILL FORM */}
                {vm.opType === 'drill' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Broca / Herramienta:
                      </label>
                      <select
                        className="m3-select"
                        style={{ width: '100%', fontSize: '0.85rem' }}
                        value={vm.drillToolId}
                        onChange={(e) => vm.handleSelectDrillTool(e.target.value)}
                      >
                        {vm.drillTools.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} (Ø{t.diameterMm}mm)
                          </option>
                        ))}
                      </select>
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

                {/* 2. HOLE-SERIES FORM (SYSTEM 32) */}
                {vm.opType === 'hole-series' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Herramienta de Taladrado:
                      </label>
                      <select
                        className="m3-select"
                        style={{ width: '100%', fontSize: '0.85rem' }}
                        value={vm.seriesToolId}
                        onChange={(e) => vm.handleSelectSeriesTool(e.target.value)}
                      >
                        {vm.drillTools.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} (Ø{t.diameterMm}mm)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Eje de la Serie:
                      </label>
                      <select
                        className="m3-select"
                        style={{ width: '100%', fontSize: '0.85rem' }}
                        value={vm.seriesAxis}
                        onChange={(e) => vm.setSeriesAxis(e.target.value as 'x' | 'y')}
                      >
                        <option value="y">Vertical (Eje Y - Cremallera)</option>
                        <option value="x">Horizontal (Eje X)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Cantidad de Agujeros:
                      </label>
                      <NumericInput
                        id="series-count"
                        value={vm.seriesCount}
                        onChange={vm.setSeriesCount}
                        min={2}
                        max={50}
                        step={1}
                        unit="u"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Setback X (mm):
                      </label>
                      <NumericInput
                        id="series-start-x"
                        value={vm.seriesStartX}
                        onChange={vm.setSeriesStartX}
                        min={5}
                        max={vm.pieceWidth}
                        step={1}
                        unit="mm"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Inicio Y (mm):
                      </label>
                      <NumericInput
                        id="series-start-y"
                        value={vm.seriesStartY}
                        onChange={vm.setSeriesStartY}
                        min={5}
                        max={vm.pieceHeight}
                        step={1}
                        unit="mm"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Paso entre agujeros (mm):
                      </label>
                      <NumericInput
                        id="series-pitch"
                        value={vm.seriesPitch}
                        onChange={vm.setSeriesPitch}
                        min={8}
                        max={128}
                        step={32}
                        unit="mm"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Profundidad (mm):
                      </label>
                      <NumericInput
                        id="series-dep"
                        value={vm.seriesDepth}
                        onChange={vm.setSeriesDepth}
                        min={1}
                        max={vm.pieceThickness}
                        step={1}
                        unit="mm"
                        disabled={vm.seriesThrough}
                      />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={vm.seriesThrough}
                          onChange={(e) => vm.setSeriesThrough(e.target.checked)}
                        />
                        <span>Pasante (Atraviesa {vm.pieceThickness}mm)</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* 3. GROOVE FORM */}
                {vm.opType === 'groove' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Fresa de Ranurado:
                      </label>
                      <select
                        className="m3-select"
                        style={{ width: '100%', fontSize: '0.85rem' }}
                        value={vm.grooveToolId}
                        onChange={(e) => vm.handleSelectGrooveTool(e.target.value)}
                      >
                        {vm.routerStraightTools.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} (Ancho: {t.diameterMm}mm)
                          </option>
                        ))}
                      </select>
                    </div>
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

                {/* 4. REBATE FORM */}
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
                    <div style={{ gridColumn: 'span 2' }}>
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

                {/* 5. CUTOUT FORM WITH CORNER RELIEF */}
                {vm.opType === 'cutout' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Fresa Recta CNC:
                      </label>
                      <select
                        className="m3-select"
                        style={{ width: '100%', fontSize: '0.85rem' }}
                        value={vm.cutoutToolId}
                        onChange={(e) => vm.handleSelectCutoutTool(e.target.value)}
                      >
                        {vm.routerStraightTools.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} (Radio R{t.diameterMm / 2}mm)
                          </option>
                        ))}
                      </select>
                    </div>
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
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Radio Esquinas R (mm):
                      </label>
                      <NumericInput
                        id="cutout-radius"
                        value={vm.cutoutCornerRadius}
                        onChange={vm.setCutoutCornerRadius}
                        min={0}
                        max={Math.min(vm.cutoutW, vm.cutoutH) / 2}
                        step={0.5}
                        unit="mm"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Alivio de Esquinas:
                      </label>
                      <select
                        className="m3-select"
                        style={{ width: '100%', fontSize: '0.85rem' }}
                        value={vm.cutoutCornerTreatment}
                        onChange={(e) => vm.setCutoutCornerTreatment(e.target.value as CornerTreatment)}
                      >
                        <option value="dog-bone">Hueso de Perro 45° (Dog-Bone)</option>
                        <option value="natural-radius">Radio Natural de Fresa</option>
                        <option value="t-bone">Alivio en T (T-Bone)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Profundidad (mm):
                      </label>
                      <NumericInput
                        id="cutout-dep"
                        value={vm.cutoutDep}
                        onChange={vm.setCutoutDep}
                        min={1}
                        max={vm.pieceThickness}
                        step={1}
                        unit="mm"
                        disabled={vm.cutoutThrough}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={vm.cutoutThrough}
                          onChange={(e) => vm.setCutoutThrough(e.target.checked)}
                        />
                        <span>Pasante ({vm.pieceThickness}mm)</span>
                      </label>
                    </div>
                  </div>
                )}

                {/* 6. EDGE-PROFILE FORM */}
                {vm.opType === 'edge-profile' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Fresa de Moldurado / Perfilado:
                      </label>
                      <select
                        className="m3-select"
                        style={{ width: '100%', fontSize: '0.85rem' }}
                        value={vm.profileToolId}
                        onChange={(e) => vm.handleSelectProfileTool(e.target.value)}
                      >
                        {vm.routerProfileTools.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Canto a Moldurar:
                      </label>
                      <select
                        className="m3-select"
                        style={{ width: '100%', fontSize: '0.85rem' }}
                        value={vm.profileEdge}
                        onChange={(e) =>
                          vm.setProfileEdge(e.target.value as 'top' | 'bottom' | 'left' | 'right' | 'all-edges')
                        }
                      >
                        <option value="top">Superior (Y máx)</option>
                        <option value="bottom">Inferior (Y=0)</option>
                        <option value="left">Izquierdo (X=0)</option>
                        <option value="right">Derecho (X máx)</option>
                        <option value="all-edges">Todos los cantos (Perimetral)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Tipo de Moldura:
                      </label>
                      <select
                        className="m3-select"
                        style={{ width: '100%', fontSize: '0.85rem' }}
                        value={vm.profileKind}
                        onChange={(e) => vm.setProfileKind(e.target.value as EdgeProfileKind)}
                      >
                        <option value="chamfer-45">Bisel a 45 grados</option>
                        <option value="roundover">Redondeo (Roundover)</option>
                        <option value="j-pull">Tirador J-Pull integrado</option>
                        <option value="cove">Media caña (Cove)</option>
                        <option value="ogee">Pecho de Paloma (Ogee)</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Ancho del Perfil (mm):
                      </label>
                      <NumericInput
                        id="profile-w"
                        value={vm.profileWidth}
                        onChange={vm.setProfileWidth}
                        min={1}
                        max={50}
                        step={0.5}
                        unit="mm"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                        Profundidad (mm):
                      </label>
                      <NumericInput
                        id="profile-dep"
                        value={vm.profileDepth}
                        onChange={vm.setProfileDepth}
                        min={1}
                        max={vm.pieceThickness}
                        step={0.5}
                        unit="mm"
                      />
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
                  <div style={{ marginTop: '0.8rem', display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="m3-btn m3-btn--tonal mobile-only-inline"
                      onClick={() => setMobileTab('canvas')}
                    >
                      👁️ Ver en Dibujo 2D
                    </button>
                    <button
                      type="button"
                      className="m3-btn m3-btn--primary"
                      onClick={() => {
                        vm.handleAddOperation();
                        setMobileTab('canvas');
                      }}
                    >
                      ➕ Aplicar Mecanizado a la Placa
                    </button>
                  </div>
                )}
              </div>

              {/* Real-time Workshop Rules & Validation Issues */}
              {vm.validationIssues.length > 0 && (
                <div
                  style={{
                    padding: '0.6rem 0.8rem',
                    borderRadius: '8px',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                    backgroundColor: 'var(--md-sys-color-surface-container)',
                    marginBottom: '0.8rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: vm.validationIssues.some((i) => i.level === 'error')
                        ? 'var(--md-sys-color-error)'
                        : '#854d0e',
                      marginBottom: '0.4rem',
                    }}
                  >
                    <span>
                      {vm.validationIssues.some((i) => i.level === 'error') ? '⛔' : '⚠️'} Observaciones de Taller y Reglas ({vm.validationIssues.length})
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', maxHeight: '130px', overflowY: 'auto' }}>
                    {vm.validationIssues.map((issue) => (
                      <div
                        key={issue.id}
                        style={{
                          fontSize: '0.75rem',
                          padding: '0.3rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor:
                            issue.level === 'error'
                              ? 'var(--md-sys-color-error-container)'
                              : '#fef9c3',
                          color:
                            issue.level === 'error'
                              ? 'var(--md-sys-color-on-error-container)'
                              : '#713f12',
                          borderLeft:
                            issue.level === 'error'
                              ? '3px solid var(--md-sys-color-error)'
                              : '3px solid #ca8a04',
                        }}
                      >
                        <strong>{issue.level === 'error' ? 'Error: ' : 'Aviso: '}</strong>
                        {issue.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* List of custom operations on this piece */}
              <div className="machining-custom-ops-section">
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
                            : op.kind === 'hole-series'
                            ? `${op.count}x Ø${op.diameterMm}mm (Paso ${op.pitchMm}mm) desde (${op.startXMm}, ${op.startYMm})`
                            : op.kind === 'edge-profile'
                            ? `Perfil ${op.profileKind} en ${op.edge} (${op.widthMm}x${op.depthMm}mm)`
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
              <div className="machining-canvas-sub-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <h5 style={{ margin: 0, fontSize: '0.82rem', color: 'var(--md-sys-color-on-surface)' }}>
                    Vista Técnica 2D ({vm.faceType === 'face-A' ? 'Cara A' : 'Cara B'}):
                  </h5>
                  <button
                    type="button"
                    className="m3-btn m3-btn--small m3-btn--tonal mobile-only-inline"
                    style={{ padding: '0.1rem 0.4rem', fontSize: '0.72rem' }}
                    onClick={() => vm.setFaceType(vm.faceType === 'face-A' ? 'face-B' : 'face-A')}
                    title="Alternar entre Cara A y Cara B"
                  >
                    🔄 {vm.faceType === 'face-A' ? 'Ir a Cara B' : 'Ir a Cara A'}
                  </button>
                </div>
                {vm.cursorPosMm && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontFamily: 'monospace',
                      padding: '0.12rem 0.4rem',
                      backgroundColor: 'var(--md-sys-color-secondary-container)',
                      color: 'var(--md-sys-color-on-secondary-container)',
                      borderRadius: '4px',
                    }}
                  >
                    X:{vm.toDatumCoords(vm.cursorPosMm.x, vm.cursorPosMm.y).x} Y:{vm.toDatumCoords(vm.cursorPosMm.x, vm.cursorPosMm.y).y} mm ({vm.datumCorner})
                    {vm.snapResult?.label ? ` • ${vm.snapResult.label}` : ''}
                  </span>
                )}
              </div>

              {/* Bench Coordinates Table (Checklist de Taller) */}
              {(vm.showCoordsTable || mobileTab === 'table') && (
                <div
                  className="bench-coordinates-table-card"
                  style={{
                    backgroundColor: 'var(--md-sys-color-surface-container)',
                    borderRadius: 'var(--md-sys-shape-corner-sm)',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                    padding: '0.65rem 0.85rem',
                    marginBottom: '0.5rem',
                    maxHeight: '260px',
                    overflowY: 'auto',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong style={{ fontSize: '0.85rem', color: 'var(--md-sys-color-primary)' }}>
                        📋 Checklist de Banco (Cotas relativas a: {vm.datumCorner.toUpperCase()})
                      </strong>
                      <span style={{ fontSize: '0.72rem', padding: '0.1rem 0.4rem', borderRadius: '10px', backgroundColor: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)' }}>
                        {vm.benchOperationsTable.filter((r) => vm.completedOps[r.id]).length} / {vm.benchOperationsTable.length} hechos
                      </span>
                    </div>
                  </div>

                  {vm.benchOperationsTable.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                      No hay mecanizados registrados en esta cara. Usá los atajos de banco o el menú lateral para agregar perforaciones o ranuras.
                    </p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="m3-table" style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--md-sys-color-outline-variant)', textAlign: 'left' }}>
                            <th style={{ width: '28px', padding: '0.3rem' }}>✓</th>
                            <th style={{ padding: '0.3rem' }}>#</th>
                            <th style={{ padding: '0.3rem' }}>Operación</th>
                            <th style={{ padding: '0.3rem' }}>X (Datum)</th>
                            <th style={{ padding: '0.3rem' }}>Y (Datum)</th>
                            <th style={{ padding: '0.3rem' }}>Medida / Ø</th>
                            <th style={{ padding: '0.3rem' }}>Prof.</th>
                            <th style={{ padding: '0.3rem' }}>Origen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vm.benchOperationsTable.map((row) => {
                            const isDone = Boolean(vm.completedOps[row.id]);
                            return (
                              <tr
                                key={row.id}
                                style={{
                                  borderBottom: '1px solid var(--md-sys-color-surface-container-highest)',
                                  backgroundColor: isDone ? 'rgba(34, 197, 94, 0.1)' : undefined,
                                  textDecoration: isDone ? 'line-through' : undefined,
                                  opacity: isDone ? 0.65 : 1,
                                }}
                              >
                                <td style={{ padding: '0.3rem' }}>
                                  <input
                                    type="checkbox"
                                    checked={isDone}
                                    onChange={() => vm.toggleOpCompleted(row.id)}
                                    aria-label={`Marcar operación ${row.opNumber} como realizada`}
                                  />
                                </td>
                                <td style={{ padding: '0.3rem' }}><strong>{row.opNumber}</strong></td>
                                <td style={{ padding: '0.3rem' }}>{row.label}</td>
                                <td style={{ padding: '0.3rem', fontFamily: 'monospace', fontWeight: 700 }}>
                                  {row.datumX} mm
                                </td>
                                <td style={{ padding: '0.3rem', fontFamily: 'monospace', fontWeight: 700 }}>
                                  {row.datumY} mm
                                </td>
                                <td style={{ padding: '0.3rem' }}>{row.sizeDescription}</td>
                                <td style={{ padding: '0.3rem' }}>{row.toolDescription}</td>
                                <td style={{ padding: '0.3rem', fontSize: '0.72rem', color: 'var(--md-sys-color-on-surface-variant)' }}>
                                  {row.isCustom ? '🛠️ Manual' : '⚙️ Auto'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              <div className="m3-modal-svg-canvas" style={{ width: '100%', position: 'relative', overflow: 'hidden' }}>
                {/* Floating CAD Zoom Toolbar */}
                <div
                  className="cad-floating-toolbar"
                  style={{
                    position: 'absolute',
                    top: '8px',
                    right: '8px',
                    zIndex: 10,
                    display: 'flex',
                    gap: '4px',
                    backgroundColor: 'rgba(255, 255, 255, 0.94)',
                    backdropFilter: 'blur(4px)',
                    padding: '3px 6px',
                    borderRadius: '6px',
                    boxShadow: 'var(--md-sys-elevation-2)',
                    border: '1px solid var(--md-sys-color-outline-variant)',
                  }}
                >
                  <button
                    type="button"
                    className={`m3-btn m3-btn--small ${panZoom.mode === 'pan' ? 'm3-btn--primary' : 'm3-btn--tonal'}`}
                    style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}
                    onClick={() => panZoom.setMode(panZoom.mode === 'pan' ? 'select' : 'pan')}
                    title={panZoom.mode === 'pan' ? 'Modo Paneo activo (arrastrar)' : 'Cambiar a modo Paneo'}
                  >
                    {panZoom.mode === 'pan' ? '🖐️ Mover' : '📍 Ubicar'}
                  </button>
                  <button
                    type="button"
                    className="m3-btn m3-btn--small m3-btn--tonal"
                    style={{ padding: '0.15rem 0.45rem', minWidth: '28px', fontSize: '0.8rem' }}
                    onClick={panZoom.zoomIn}
                    title="Acercar Zoom [Tecla +]"
                  >
                    ➕
                  </button>
                  <button
                    type="button"
                    className="m3-btn m3-btn--small m3-btn--tonal"
                    style={{ padding: '0.15rem 0.45rem', minWidth: '28px', fontSize: '0.8rem' }}
                    onClick={panZoom.zoomOut}
                    title="Alejar Zoom [Tecla -]"
                  >
                    ➖
                  </button>
                  <button
                    type="button"
                    className="m3-btn m3-btn--small m3-btn--tonal"
                    style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem' }}
                    onClick={panZoom.fitView}
                    title="Ajustar a pantalla [Shift + F]"
                  >
                    ⛶ Ajustar
                  </button>
                  <button
                    type="button"
                    className="m3-btn m3-btn--small m3-btn--outlined"
                    style={{ padding: '0.15rem 0.5rem', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}
                    onClick={panZoom.resetView}
                    title="Restablecer escala 1:1"
                  >
                    {Math.round(panZoom.zoom * 100)}%
                  </button>
                </div>

                <svg
                  ref={svgRef}
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox={`0 0 ${targetWidth} ${targetHeight}`}
                  width="100%"
                  height="100%"
                  style={{
                    backgroundColor: '#fafafa',
                    cursor: panZoom.isPanning || panZoom.mode === 'pan' ? 'grabbing' : 'crosshair',
                    userSelect: 'none',
                    touchAction: 'none',
                  }}
                  onWheel={panZoom.handleWheel}
                  onTouchStart={panZoom.handleTouchStart}
                  onTouchMove={panZoom.handleTouchMove}
                  onTouchEnd={panZoom.handleTouchEnd}
                  onPointerDown={(e) => {
                    if (e.button === 1 || e.button === 2 || panZoom.mode === 'pan') {
                      panZoom.startPan(e.clientX, e.clientY, svgRef.current);
                      return;
                    }
                    handleSvgPointer(e, true);
                  }}
                  onPointerMove={(e) => {
                    if (panZoom.isPanning) {
                      panZoom.updatePan(e.clientX, e.clientY);
                      return;
                    }
                    handleSvgPointer(e, false);
                  }}
                  onPointerUp={() => {
                    if (panZoom.isPanning) panZoom.endPan();
                  }}
                  onPointerLeave={() => {
                    if (panZoom.isPanning) panZoom.endPan();
                    vm.handlePointerLeave();
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <g transform={`translate(${panZoom.pan.x}, ${panZoom.pan.y}) scale(${panZoom.zoom})`}>
                    {/* Turn banner for Face B */}
                    {vm.faceType === 'face-B' && vm.previewSheet?.requiresTurn && (
                      <g>
                        <rect x="20" y="12" width={targetWidth - 40} height="32" rx="6" fill="#fff3cd" stroke="#ffc107" strokeWidth="1.5" />
                        <text x={targetWidth / 2} y="32" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#664d03">
                          ⚠️ ATENCIÓN: GIRAR LA PIEZA PARA MECANIZAR CARA B (TURN PIECE OVER)
                        </text>
                      </g>
                    )}

                    {/* Rotatable Piece Group for Workshop Bench Alignment */}
                    <g transform={`rotate(${vm.rotationDeg}, ${originX + drawW / 2}, ${originY + drawH / 2})`}>
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

                      {/* Millimetric Shop Bench Grid */}
                      {vm.showGrid && (
                        <g style={{ opacity: 0.35, pointerEvents: 'none' }}>
                          {Array.from({ length: Math.floor(vm.pieceWidth / vm.gridPitch) }, (_, i) => {
                            const gx = originX + (i + 1) * vm.gridPitch * scale;
                            return (
                              <line
                                key={`gx-${i}`}
                                x1={gx}
                                y1={originY}
                                x2={gx}
                                y2={originY + drawH}
                                stroke="#0b57d0"
                                strokeWidth="0.8"
                                strokeDasharray="2 2"
                              />
                            );
                          })}
                          {Array.from({ length: Math.floor(vm.pieceHeight / vm.gridPitch) }, (_, i) => {
                            const gy = datumY - (i + 1) * vm.gridPitch * scale;
                            return (
                              <line
                                key={`gy-${i}`}
                                x1={originX}
                                y1={gy}
                                x2={originX + drawW}
                                y2={gy}
                                stroke="#0b57d0"
                                strokeWidth="0.8"
                                strokeDasharray="2 2"
                              />
                            );
                          })}
                        </g>
                      )}

                      {/* Banded Edges */}
                      {vm.showEdgeBanding && (
                        <>
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
                        </>
                      )}

                      {/* Dynamic Datum (0, 0) Marker based on active datumCorner */}
                      {(() => {
                        const isLeft = vm.datumCorner === 'bottom-left' || vm.datumCorner === 'top-left';
                        const isBottom = vm.datumCorner === 'bottom-left' || vm.datumCorner === 'bottom-right';
                        const dX = isLeft ? datumX : datumX + drawW;
                        const dY = isBottom ? datumY : originY;
                        const dirX = isLeft ? 1 : -1;
                        const dirY = isBottom ? -1 : 1;
                        return (
                          <g transform={`translate(${dX}, ${dY})`}>
                            <circle cx="0" cy="0" r="5" fill="#ba1a1a" />
                            <line x1={-6 * dirX} y1="0" x2={26 * dirX} y2="0" stroke="#ba1a1a" strokeWidth="2" />
                            <line x1="0" y1={-6 * dirY} x2="0" y2={26 * dirY} stroke="#ba1a1a" strokeWidth="2" />
                            <text
                              x={8 * dirX}
                              y={16 * (dirY > 0 ? 1 : -1)}
                              fontSize="10"
                              fontWeight="bold"
                              fill="#ba1a1a"
                              textAnchor={dirX > 0 ? 'start' : 'end'}
                            >
                              Datum (0,0)
                            </text>
                          </g>
                        );
                      })()}

                      {/* Contact Footprints (Ghost projections of adjacent pieces) */}
                      {vm.showProjections && vm.currentFaceProjections.map((proj) => {
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

                  {/* Custom Machining Operations Preview */}
                  {vm.pieceCustomOps
                    .filter((op) => op.faceType === vm.faceType)
                    .map((op) => {
                      if (op.kind === 'drill') {
                        const cx = toSvgX(op.xMm);
                        const cy = toSvgY(op.yMm);
                        const r = Math.max(3, (op.diameterMm / 2) * scale);
                        return (
                          <g key={op.id}>
                            <circle
                              cx={cx}
                              cy={cy}
                              r={r}
                              fill="rgba(11, 87, 208, 0.25)"
                              stroke="#0b57d0"
                              strokeWidth="1.5"
                            />
                            <line x1={cx - r - 2} y1={cy} x2={cx + r + 2} y2={cy} stroke="#0b57d0" strokeWidth="1" />
                            <line x1={cx} y1={cy - r - 2} x2={cx} y2={cy + r + 2} stroke="#0b57d0" strokeWidth="1" />
                            <text x={cx + r + 4} y={cy + 3} fontSize="9" fontWeight="bold" fill="#0b57d0">
                              Ø{op.diameterMm}
                            </text>
                          </g>
                        );
                      }

                      if (op.kind === 'hole-series') {
                        const startSvgX = toSvgX(op.startXMm);
                        const startSvgY = toSvgY(op.startYMm);
                        const endSvgX = toSvgX(
                          op.axis === 'x' ? op.startXMm + (op.count - 1) * op.pitchMm : op.startXMm,
                        );
                        const endSvgY = toSvgY(
                          op.axis === 'y' ? op.startYMm + (op.count - 1) * op.pitchMm : op.startYMm,
                        );

                        return (
                          <g key={op.id}>
                            {/* Pitch centerline */}
                            <line
                              x1={startSvgX}
                              y1={startSvgY}
                              x2={endSvgX}
                              y2={endSvgY}
                              stroke="#0b57d0"
                              strokeWidth="1"
                              strokeDasharray="3 3"
                            />
                            {/* Individual series holes */}
                            {Array.from({ length: op.count }).map((_, i) => {
                              const hx = toSvgX(op.axis === 'x' ? op.startXMm + i * op.pitchMm : op.startXMm);
                              const hy = toSvgY(op.axis === 'y' ? op.startYMm + i * op.pitchMm : op.startYMm);
                              const hr = Math.max(2.5, (op.diameterMm / 2) * scale);
                              return (
                                <circle
                                  key={i}
                                  cx={hx}
                                  cy={hy}
                                  r={hr}
                                  fill="#0b57d0"
                                  stroke="#ffffff"
                                  strokeWidth="1"
                                />
                              );
                            })}
                            <text
                              x={startSvgX + 6}
                              y={startSvgY - 4}
                              fontSize="9"
                              fontWeight="bold"
                              fill="#0b57d0"
                            >
                              {op.count}x Ø{op.diameterMm} Sist. 32 ({op.pitchMm}mm)
                            </text>
                          </g>
                        );
                      }

                      if (op.kind === 'groove') {
                        const isX = op.axis === 'x';
                        const gx = isX ? originX : toSvgX(op.offsetMm);
                        const gy = isX ? toSvgY(op.offsetMm + op.widthMm) : originY;
                        const gw = isX ? drawW : op.widthMm * scale;
                        const gh = isX ? op.widthMm * scale : drawH;
                        return (
                          <g key={op.id}>
                            <rect
                              x={gx}
                              y={gy}
                              width={gw}
                              height={gh}
                              fill="rgba(68, 71, 70, 0.3)"
                              stroke="#444746"
                              strokeWidth="1"
                            />
                            <text x={gx + 4} y={gy + 10} fontSize="8" fill="#444746">
                              Ranura {op.axis.toUpperCase()} ({op.widthMm}x{op.depthMm}mm)
                            </text>
                          </g>
                        );
                      }

                      if (op.kind === 'rebate') {
                        const isTop = op.edge === 'top';
                        const isBottom = op.edge === 'bottom';
                        const isLeft = op.edge === 'left';
                        const rx = isLeft ? originX : isBottom || isTop ? originX : originX + drawW - op.widthMm * scale;
                        const ry = isTop ? originY : isLeft || op.edge === 'right' ? originY : originY + drawH - op.widthMm * scale;
                        const rw = isTop || isBottom ? drawW : op.widthMm * scale;
                        const rh = isTop || isBottom ? op.widthMm * scale : drawH;
                        return (
                          <g key={op.id}>
                            <rect
                              x={rx}
                              y={ry}
                              width={rw}
                              height={rh}
                              fill="rgba(217, 119, 6, 0.25)"
                              stroke="#d97706"
                              strokeWidth="1.5"
                              strokeDasharray="4 2"
                            />
                            <text x={rx + 4} y={ry + 11} fontSize="8" fontWeight="bold" fill="#b45309">
                              Rebaje {op.edge} ({op.widthMm}x{op.depthMm}mm)
                            </text>
                          </g>
                        );
                      }

                      if (op.kind === 'cutout') {
                        const px = toSvgX(op.xMm);
                        const py = toSvgY(op.yMm + op.heightMm);
                        const pw = op.widthMm * scale;
                        const ph = op.heightMm * scale;

                        const pocketRelief = calculatePocketCornerRelief({
                          xMm: op.xMm,
                          yMm: op.yMm,
                          widthMm: op.widthMm,
                          heightMm: op.heightMm,
                          cornerRadiusMm: op.cornerRadiusMm ?? 0,
                          cornerTreatment: op.cornerTreatment,
                        });

                        return (
                          <g key={op.id}>
                            <rect
                              x={px}
                              y={py}
                              width={pw}
                              height={ph}
                              fill="rgba(186, 26, 26, 0.25)"
                              stroke="#ba1a1a"
                              strokeWidth="1.5"
                            />
                            {/* Render Corner Relief circles (dog-bone or natural-radius) */}
                            {pocketRelief.corners.map((c, i) => {
                              const cx = toSvgX(c.reliefCenterMm.x);
                              const cy = toSvgY(c.reliefCenterMm.y);
                              const cr = Math.max(2, c.reliefRadiusMm * scale);
                              return (
                                <circle
                                  key={i}
                                  cx={cx}
                                  cy={cy}
                                  r={cr}
                                  fill="rgba(186, 26, 26, 0.35)"
                                  stroke="#ba1a1a"
                                  strokeWidth="1"
                                />
                              );
                            })}
                            <text
                              x={px + 4}
                              y={py + 12}
                              fontSize="9"
                              fontWeight="bold"
                              fill="#ba1a1a"
                            >
                              {op.widthMm}x{op.heightMm} ({op.cornerTreatment ?? 'R' + op.cornerRadiusMm})
                            </text>
                          </g>
                        );
                      }

                      if (op.kind === 'edge-profile') {
                        const isAll = op.edge === 'all-edges';
                        const isTop = op.edge === 'top' || isAll;
                        const isBottom = op.edge === 'bottom' || isAll;
                        const isLeft = op.edge === 'left' || isAll;
                        const isRight = op.edge === 'right' || isAll;
                        const pw = op.widthMm * scale;

                        return (
                          <g key={op.id}>
                            {isTop && (
                              <rect x={originX} y={originY} width={drawW} height={pw} fill="rgba(147, 51, 234, 0.25)" stroke="#9333ea" strokeWidth="1" strokeDasharray="2 2" />
                            )}
                            {isBottom && (
                              <rect x={originX} y={originY + drawH - pw} width={drawW} height={pw} fill="rgba(147, 51, 234, 0.25)" stroke="#9333ea" strokeWidth="1" strokeDasharray="2 2" />
                            )}
                            {isLeft && (
                              <rect x={originX} y={originY} width={pw} height={drawH} fill="rgba(147, 51, 234, 0.25)" stroke="#9333ea" strokeWidth="1" strokeDasharray="2 2" />
                            )}
                            {isRight && (
                              <rect x={originX + drawW - pw} y={originY} width={pw} height={drawH} fill="rgba(147, 51, 234, 0.25)" stroke="#9333ea" strokeWidth="1" strokeDasharray="2 2" />
                            )}
                            <text x={originX + 8} y={originY + 16} fontSize="9" fontWeight="bold" fill="#7e22ce">
                              Perfil {op.profileKind} ({op.edge})
                            </text>
                          </g>
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
                  </g>
                  </g>
                </svg>
              </div>

              {/* Mobile Quick Action Bar */}
              <div className="machining-mobile-canvas-actions">
                <button
                  type="button"
                  className="m3-btn m3-btn--primary"
                  style={{ flex: 1, padding: '0.55rem', fontSize: '0.85rem' }}
                  onClick={vm.handleAddOperation}
                >
                  ➕ Aplicar {vm.opType === 'drill' ? 'Perforación' : vm.opType === 'groove' ? 'Ranura' : vm.opType === 'rebate' ? 'Rebaje' : vm.opType === 'cutout' ? 'Calado' : 'Tornillos'}
                </button>
                <button
                  type="button"
                  className="m3-btn m3-btn--tonal"
                  style={{ padding: '0.55rem 0.85rem', fontSize: '0.85rem' }}
                  onClick={() => setMobileTab('controls')}
                >
                  ⚙️ Parámetros
                </button>
              </div>

              <div className="desktop-only-legend" style={{ marginTop: '0.6rem', fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <span>🔴 Datum (0,0)</span>
                <span>🔵 Contacto con placas</span>
                <span>🧲 Snaps magnéticos</span>
                <span style={{ marginLeft: 'auto', fontStyle: 'italic', color: 'var(--md-sys-color-primary)' }}>
                  ⌨️ Teclado: [G] Ranura | [R] Rebaje | [F] Fresado | [D] Perforación | [T] Tornillos | Rueda: Zoom | Botón central: Paneo
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="m3-modal-footer desktop-only-control">
          <button type="button" className="m3-btn m3-btn--tonal" onClick={vm.onClose}>
            Listo / Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
