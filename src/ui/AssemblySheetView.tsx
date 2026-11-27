import { useState, useEffect, useCallback, type ReactElement } from 'react';
import {
  type AssemblySheet,
  type AssemblyGauge,
  type ResolvedPiece,
  type ResolvedPieceWithCutSize,
  type SpatialPieceBox,
  type ModuleSpatialBounds,
  exportAssemblyGuidePdf,
  buildWallShelving,
  generateInstallationSheetSvg,
  type WallShelvingDefinition,
  type WallShelvingOutput,
} from '../resolver';
import { Viewport3D } from './Viewport3D';
import type { CameraPresetView } from './ViewerToolbar';
import { AssemblyDiagramModal } from './AssemblyDiagramModal';
import { M3ToggleRow } from './M3ToggleRow';
import { renderExplodedSvg, renderPanelDetailSvg, renderAssemblySvg } from './assembly/assemblySvgDiagrams';
import { translateAssemblyPhase } from '../i18n';

export interface AssemblySheetViewProps {
  assemblySheet: AssemblySheet | null;
  pieces?: (ResolvedPieceWithCutSize | ResolvedPiece)[];
  spatialBoxes?: SpatialPieceBox[];
  spatialBounds?: ModuleSpatialBounds;
  explodedRatio?: number;
  onExplodedRatioChange?: (ratio: number) => void;
  wallShelvingOutput?: WallShelvingOutput | null;
  wallShelvingDefinition?: WallShelvingDefinition | null;
  onExportPdf?: () => void;
  selectedPieceId?: string | null;
  onSelectPiece?: (pieceId: string | null) => void;
}


/**
 * View component for the sequential workshop assembly sheet.
 * Implements Google Material Design 3 guidelines with elevation, cards, and step tracking.
 */
export function AssemblySheetView({
  assemblySheet,
  pieces,
  spatialBoxes,
  spatialBounds,
  explodedRatio,
  onExplodedRatioChange,
  wallShelvingOutput,
  wallShelvingDefinition,
  onExportPdf,
  selectedPieceId,
  onSelectPiece,
}: AssemblySheetViewProps): ReactElement {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<'all' | 'exploded' | 'panels' | 'gauges' | 'steps'>('all');
  const [selectedPanelIndex, setSelectedPanelIndex] = useState<number>(0);
  const [activeStepNumber, setActiveStepNumber] = useState<number | null>(null);

  // Exploded View Interactive State
  const [explosionRatio, setExplosionRatio] = useState<number>(explodedRatio ?? 0.65);
  const [viewAngle, setViewAngle] = useState<'iso-right' | 'iso-left' | 'top' | 'front'>('iso-right');
  const [showTrajectories, setShowTrajectories] = useState<boolean>(true);
  const [showBalloons, setShowBalloons] = useState<boolean>(true);
  const [showEdgeBanding, setShowEdgeBanding] = useState<boolean>(true);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [explodedViewMode, setExplodedViewMode] = useState<'2.5d' | '3d'>('3d');
  const [cameraPresetTrigger, setCameraPresetTrigger] = useState<{ view: CameraPresetView; id: number } | null>(null);
  const [modalDiagram, setModalDiagram] = useState<{ title: string; content: ReactElement } | null>(null);

  const is3dCapable = Boolean(spatialBoxes && spatialBounds);
  const effectiveViewMode = is3dCapable ? explodedViewMode : '2.5d';

  // Step-aware piece isolation and guided assembly logic
  const currentStep =
    activeStepNumber !== null
      ? assemblySheet?.steps?.find((s) => s.stepNumber === activeStepNumber) ?? null
      : null;

  const currentStepPieceIds = currentStep ? currentStep.piecesInvolved : null;

  const priorAssembledPieceIds =
    currentStep && assemblySheet?.steps
      ? Array.from(
          new Set(
            assemblySheet.steps
              .filter((s) => s.stepNumber < currentStep.stepNumber)
              .flatMap((s) => s.piecesInvolved),
          ),
        )
      : null;

  const handleSelectStep = useCallback((stepNumber: number | null) => {
    setActiveStepNumber((prev) => (prev === stepNumber ? null : stepNumber));
  }, []);

  const handlePrevStep = useCallback(() => {
    if (!assemblySheet?.steps || assemblySheet.steps.length === 0) return;
    if (activeStepNumber === null) {
      setActiveStepNumber(assemblySheet.steps[assemblySheet.steps.length - 1]!.stepNumber);
    } else {
      const idx = assemblySheet.steps.findIndex((s) => s.stepNumber === activeStepNumber);
      if (idx > 0) {
        setActiveStepNumber(assemblySheet.steps[idx - 1]!.stepNumber);
      } else {
        setActiveStepNumber(null);
      }
    }
  }, [activeStepNumber, assemblySheet?.steps]);

  const handleNextStep = useCallback(() => {
    if (!assemblySheet?.steps || assemblySheet.steps.length === 0) return;
    if (activeStepNumber === null) {
      setActiveStepNumber(assemblySheet.steps[0]!.stepNumber);
    } else {
      const idx = assemblySheet.steps.findIndex((s) => s.stepNumber === activeStepNumber);
      if (idx >= 0 && idx < assemblySheet.steps.length - 1) {
        setActiveStepNumber(assemblySheet.steps[idx + 1]!.stepNumber);
      } else {
        setActiveStepNumber(null);
      }
    }
  }, [activeStepNumber, assemblySheet?.steps]);

  useEffect(() => {
    if (typeof explodedRatio === 'number') {
      setExplosionRatio(explodedRatio);
    }
  }, [explodedRatio]);

  useEffect(() => {
    if (!isAnimating) return;
    let forward = true;
    const interval = setInterval(() => {
      setExplosionRatio((prev) => {
        let next = prev + (forward ? 0.025 : -0.025);
        if (next >= 1.0) {
          next = 1.0;
          forward = false;
        } else if (next <= 0.05) {
          next = 0.05;
          forward = true;
        }
        const rounded = Math.round(next * 100) / 100;
        onExplodedRatioChange?.(rounded);
        return rounded;
      });
    }, 40);
    return () => clearInterval(interval);
  }, [isAnimating, onExplodedRatioChange]);

  // 1. Reactive Wall Shelving Mode (Zero Hardcoding)
  const isWallShelving = Boolean(
    (wallShelvingOutput && wallShelvingDefinition) ||
    (pieces && pieces.some((p) => p.role === 'wall-shelf'))
  );

  if (isWallShelving) {
    const wallDef: WallShelvingDefinition = wallShelvingDefinition ?? (() => {
      const wallShelfPieces = pieces?.filter((p) => p.role === 'wall-shelf') ?? [];
      const first = wallShelfPieces[0];
      const widthMm = first?.contour.points[1]?.x ?? 1200;
      const depthMm = first?.contour.points[2]?.y ?? 250;
      const thicknessMm = first?.thicknessMm ?? 18;
      const shelfCount = wallShelfPieces.length || 3;
      const verticalSpacingMm =
        wallShelfPieces.length > 1
          ? Math.round(
              Math.abs(
                (wallShelfPieces[1]!.positionMm?.y ?? 320) -
                  (wallShelfPieces[0]!.positionMm?.y ?? 0),
              ),
            ) || 320
          : 320;
      return {
        id: 'wall-shelves-active',
        widthMm,
        depthMm,
        thicknessMm,
        shelfCount,
        verticalSpacingMm,
        bracketType: 'l-bracket',
        wallType: 'solid-brick',
        loadCategory: 'medium',
        boundaryCondition: 'free-ends',
        overhangMode: 'balanced-cantilever',
        materialId: first?.materialId ?? 'mat-default',
        baseElevationYMm: 800,
      };
    })();

    const activeOutput = wallShelvingOutput ?? buildWallShelving(wallDef);
    const svgHtml = generateInstallationSheetSvg(activeOutput, wallDef);

    return (
      <section aria-labelledby="wall-assembly-heading" className="m3-card assembly-sheet-card">
        <div className="m3-card__header">
          <div>
            <h2 id="wall-assembly-heading" className="m3-card__title">
              📐 Plano de Replanteo y Perforaciones en Pared
            </h2>
            <p className="m3-card__subtitle">
              Cálculo estructural de ménsulas, cotas de taladrado milimétricas y recomendaciones de anclaje según pared.
            </p>
          </div>

          {onExportPdf && (
            <div className="assembly-actions">
              <button
                type="button"
                className="m3-btn m3-btn--filled"
                onClick={onExportPdf}
              >
                📄 Exportar Guía PDF
              </button>
            </div>
          )}
        </div>

        <div
          className="assembly-diagram-wrapper"
          onClick={() =>
            setModalDiagram({
              title: '📐 Plano de Replanteo y Perforaciones en Pared',
              content: <div dangerouslySetInnerHTML={{ __html: svgHtml }} />,
            })
          }
          title="Toca para ampliar en pantalla completa"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setModalDiagram({
                title: '📐 Plano de Replanteo y Perforaciones en Pared',
                content: <div dangerouslySetInnerHTML={{ __html: svgHtml }} />,
              });
            }
          }}
          style={{
            marginTop: '16px',
            overflowX: 'auto',
            background: 'var(--surface, #ffffff)',
            borderRadius: '8px',
            padding: '8px',
            border: '1px solid var(--border, #e2e8f0)',
          }}
        >
          <div className="assembly-diagram-tap-hint">
            <span>🔍 Tocar para ampliar</span>
          </div>
          <div dangerouslySetInnerHTML={{ __html: svgHtml }} />
        </div>

        <div
          style={{
            marginTop: '20px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '12px',
          }}
        >
          <div
            className="m3-card"
            style={{ padding: '12px', background: 'var(--surface-2, #f8fafc)', border: '1px solid var(--border, #cbd5e1)' }}
          >
            <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', color: 'var(--text, #0f172a)' }}>
              🔩 Taco y Anclaje Sugerido
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted, #334155)' }}>
              <strong>{activeOutput.bracketCalculation.recommendedAnchor.brandModel}</strong>
              <br />
              Tornillo: {activeOutput.bracketCalculation.recommendedAnchor.screwDiameterMm}x
              {activeOutput.bracketCalculation.recommendedAnchor.screwLengthMm} mm
              <br />
              Tracción est.: ~{activeOutput.bracketCalculation.pullOutForceKg} kg/ménsula
              <br />
              Pared: <strong>{wallDef.wallType}</strong> | Soporte: <strong>{wallDef.bracketType}</strong>
            </p>
          </div>

          <div
            className="m3-card"
            style={{ padding: '12px', background: 'var(--surface-2, #f8fafc)', border: '1px solid var(--border, #cbd5e1)' }}
          >
            <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', color: 'var(--text, #0f172a)' }}>
              ⚖️ Análisis de Flecha (Sagulator)
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted, #334155)' }}>
              Ménsulas por estante: <strong>{activeOutput.bracketCalculation.bracketCountPerShelf}</strong> (Luz:{' '}
              {activeOutput.bracketCalculation.maxSpanMm} mm)
              <br />
              Flecha calculada: <strong>{activeOutput.bracketCalculation.calculatedDeflectionMm} mm</strong>{' '}
              (Límite: {activeOutput.bracketCalculation.allowableDeflectionMm} mm)
              <br />
              Carga máxima: {activeOutput.bracketCalculation.totalShelfLoadKg} kg / estante ({activeOutput.bracketCalculation.designLoadKgM2} kg/m²)
            </p>
          </div>
        </div>

        {modalDiagram && (
          <AssemblyDiagramModal
            title={modalDiagram.title}
            onClose={() => setModalDiagram(null)}
          >
            {modalDiagram.content}
          </AssemblyDiagramModal>
        )}
      </section>
    );
  }

  if (!assemblySheet) {
    return (
      <section aria-labelledby="assembly-heading" className="m3-card">
        <h2 id="assembly-heading" className="m3-card__title">📖 Guía de Armado de Taller</h2>
        <p className="m3-card__subtitle">
          No hay datos de armado disponibles. Seleccione o cree un módulo para generar la guía.
        </p>
      </section>
    );
  }

  function toggleStep(stepNum: number): void {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepNum)) next.delete(stepNum);
      else next.add(stepNum);
      return next;
    });
  }

  function handleDefaultExport(): void {
    if (!assemblySheet) return;
    if (onExportPdf) {
      onExportPdf();
      return;
    }
    const doc = exportAssemblyGuidePdf(assemblySheet);
    doc.save(`assembly_guide_${assemblySheet.moduleId}.pdf`);
  }

  const allDone = completedSteps.size === assemblySheet.steps.length;
  const selectedPanel = assemblySheet.panelDetails[selectedPanelIndex] ?? assemblySheet.panelDetails[0];

  return (
    <section aria-labelledby="assembly-heading" className="m3-card assembly-sheet-card">
      <div className="m3-card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 id="assembly-heading" className="m3-card__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            📖 Guía de Armado y Calibres de Taller
          </h2>
          <p className="m3-card__subtitle">
            Manual técnico de montaje: mapa explotado (#1, #2...), pre-mecanizado en banco, calibres y escuadrado milimétrico.
          </p>
        </div>

        <div className="assembly-actions">
          <button
            type="button"
            className="m3-btn m3-btn--filled"
            onClick={handleDefaultExport}
            style={{ minHeight: '48px', padding: '0 20px' }}
          >
            📄 Exportar Guía PDF
          </button>
        </div>
      </div>

      {/* Module Overview Technical Badges */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginTop: '12px',
          padding: '12px 16px',
          background: 'var(--surface-2, #ede8dc)',
          borderRadius: '12px',
          border: '1px solid var(--border, #d9d2c3)',
        }}
      >
        <span style={{ fontSize: '0.85rem', color: 'var(--text, #1f2622)' }}>
          <strong>Módulo:</strong> {assemblySheet.moduleId}
        </span>
        <span style={{ color: 'var(--border, #d9d2c3)' }}>|</span>
        <span style={{ fontSize: '0.85rem', color: 'var(--text, #1f2622)' }}>
          <strong>Dimensiones:</strong> {assemblySheet.moduleDimensionsMm.width} × {assemblySheet.moduleDimensionsMm.height} × {assemblySheet.moduleDimensionsMm.depth} mm
        </span>
        <span style={{ color: 'var(--border, #d9d2c3)' }}>|</span>
        <span style={{ fontSize: '0.85rem', color: 'var(--text, #1f2622)' }}>
          <strong>📐 Diagonal de Escuadra:</strong> {assemblySheet.squaringDiagonalMm} mm (±1 mm)
        </span>
        <span style={{ color: 'var(--border, #d9d2c3)' }}>|</span>
        <span style={{ fontSize: '0.85rem', color: 'var(--primary, #56705f)', fontWeight: 'bold' }}>
          🧩 Piezas: {assemblySheet.explodedMap.length}
        </span>
      </div>

      {/* Navigation Sub-view Filter Chips */}
      <div className="assembly-view-switcher">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`m3-btn m3-btn--small ${activeTab === 'all' ? 'm3-btn--filled' : 'm3-btn--outlined'}`}
          style={{ minHeight: '44px', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          👁️ Vista Completa
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('exploded')}
          className={`m3-btn m3-btn--small ${activeTab === 'exploded' ? 'm3-btn--filled' : 'm3-btn--outlined'}`}
          style={{ minHeight: '44px', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          🗺️ Vista Explotada (#1, #2...)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('panels')}
          className={`m3-btn m3-btn--small ${activeTab === 'panels' ? 'm3-btn--filled' : 'm3-btn--outlined'}`}
          style={{ minHeight: '44px', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          🔍 Detalle de Paneles (Datum X, Y)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('gauges')}
          className={`m3-btn m3-btn--small ${activeTab === 'gauges' ? 'm3-btn--filled' : 'm3-btn--outlined'}`}
          style={{ minHeight: '44px', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          📏 Calibres y Vanos ({assemblySheet.gauges.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('steps')}
          className={`m3-btn m3-btn--small ${activeTab === 'steps' ? 'm3-btn--filled' : 'm3-btn--outlined'}`}
          style={{ minHeight: '44px', whiteSpace: 'nowrap', flexShrink: 0 }}
        >
          📋 Pasos de Armado ({completedSteps.size}/{assemblySheet.steps.length})
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SECCIÓN 1: VISTA EXPLOTADA GENERAL (#1, #2...)               */}
      {/* ------------------------------------------------------------- */}
      {(activeTab === 'all' || activeTab === 'exploded') && (
        <div className="assembly-exploded-section" style={{ marginTop: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text, #1f2622)', margin: 0 }}>
              🗺️ 1. Vista Explotada y Mapa de Piezas
            </h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #5c655f)' }}>
              Líneas latón: cantos vistos con tapacantos
            </span>
          </div>

          {/* Exploded View Interactive Toolbar */}
          <div className="exploded-viewer-toolbar" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            {/* Row 1: Mode Switcher (2.5D vs 3D) & Angle Presets & Animation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                {is3dCapable && (
                  <div className="m3-segmented-button" role="radiogroup" aria-label="Modo de vista explotada">
                    <button
                      type="button"
                      className={`m3-segmented-button__item ${explodedViewMode === '2.5d' ? 'selected' : ''}`}
                      onClick={() => setExplodedViewMode('2.5d')}
                      style={{ minHeight: '44px', padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
                    >
                      📐 Axonométrica 2.5D
                    </button>
                    <button
                      type="button"
                      className={`m3-segmented-button__item ${explodedViewMode === '3d' ? 'selected' : ''}`}
                      onClick={() => setExplodedViewMode('3d')}
                      style={{ minHeight: '44px', padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
                    >
                      🧊 3D Interactivo
                    </button>
                  </div>
                )}

                {effectiveViewMode === '3d' && (
                  <div className="m3-segmented-button" role="radiogroup" aria-label="Ángulo de cámara 3D">
                    <button
                      type="button"
                      className="m3-segmented-button__item"
                      onClick={() => setCameraPresetTrigger({ view: 'iso', id: Date.now() })}
                      title="Vista Isométrica Tridimensional (CAD)"
                      style={{ minHeight: '44px', minWidth: '44px', padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
                    >
                      📐 Iso
                    </button>
                    <button
                      type="button"
                      className="m3-segmented-button__item"
                      onClick={() => setCameraPresetTrigger({ view: 'front', id: Date.now() })}
                      title="Elevación Frontal Recta"
                      style={{ minHeight: '44px', minWidth: '44px', padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
                    >
                      🔲 Frente
                    </button>
                    <button
                      type="button"
                      className="m3-segmented-button__item"
                      onClick={() => setCameraPresetTrigger({ view: 'side', id: Date.now() })}
                      title="Vista Lateral / Perfil"
                      style={{ minHeight: '44px', minWidth: '44px', padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
                    >
                      📐 Lateral
                    </button>
                    <button
                      type="button"
                      className="m3-segmented-button__item"
                      onClick={() => setCameraPresetTrigger({ view: 'top', id: Date.now() })}
                      title="Vista en Planta / Cenital"
                      style={{ minHeight: '44px', minWidth: '44px', padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
                    >
                      ⬇️ Planta
                    </button>
                  </div>
                )}

                {effectiveViewMode === '2.5d' && (
                  <div className="m3-segmented-button" role="radiogroup" aria-label="Ángulo de visualización">
                    <button
                      type="button"
                      className={`m3-segmented-button__item ${viewAngle === 'iso-right' ? 'selected' : ''}`}
                      onClick={() => setViewAngle('iso-right')}
                      title="Isométrica Frente-Derecha (30°/30°)"
                      style={{ minHeight: '44px', minWidth: '44px', padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
                    >
                      ↗️ Iso Der.
                    </button>
                    <button
                      type="button"
                      className={`m3-segmented-button__item ${viewAngle === 'iso-left' ? 'selected' : ''}`}
                      onClick={() => setViewAngle('iso-left')}
                      title="Isométrica Frente-Izquierda"
                      style={{ minHeight: '44px', minWidth: '44px', padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
                    >
                      ↖️ Iso Izq.
                    </button>
                    <button
                      type="button"
                      className={`m3-segmented-button__item ${viewAngle === 'top' ? 'selected' : ''}`}
                      onClick={() => setViewAngle('top')}
                      title="Vista Cenital Superior"
                      style={{ minHeight: '44px', minWidth: '44px', padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
                    >
                      ⬇️ Cenital
                    </button>
                    <button
                      type="button"
                      className={`m3-segmented-button__item ${viewAngle === 'front' ? 'selected' : ''}`}
                      onClick={() => setViewAngle('front')}
                      title="Elevación Frontal"
                      style={{ minHeight: '44px', minWidth: '44px', padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
                    >
                      ➡️ Frontal
                    </button>
                  </div>
                )}
              </div>

              {/* Animation Button */}
              <button
                type="button"
                className={`m3-btn m3-btn--small ${isAnimating ? 'm3-btn--filled' : 'm3-btn--tonal'}`}
                onClick={() => setIsAnimating(!isAnimating)}
                style={{ minHeight: '44px', padding: '0.35rem 0.85rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Animar o simular el ensamble y despiece continuo del mueble"
              >
                <span>{isAnimating ? '⏸ Pausar' : '▶ Animar Ensamble'}</span>
              </button>
            </div>

            {/* Row 2: Explosion Slider & Quick Presets & Feature Toggles */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '8px 12px', backgroundColor: 'var(--surface-2, #ede8dc)', borderRadius: '10px', border: '1px solid var(--border, #d9d2c3)' }}>
              <div className="assembly-slider-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="exploded-ratio-slider" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text, #1f2622)', whiteSpace: 'nowrap' }}>
                    💥 Despiece:
                  </label>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, minWidth: '40px', textAlign: 'right', color: 'var(--primary, #56705f)' }}>
                    {Math.round(explosionRatio * 100)}%
                  </span>
                </div>
                <input
                  id="exploded-ratio-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.02"
                  value={explosionRatio}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setExplosionRatio(val);
                    onExplodedRatioChange?.(val);
                  }}
                  style={{ width: '100%', accentColor: 'var(--primary, #56705f)', cursor: 'pointer', height: '6px', margin: '4px 0' }}
                />
                <div className="assembly-slider-ticks">
                  <button
                    type="button"
                    className="assembly-slider-tick-btn"
                    onClick={() => {
                      setExplosionRatio(0);
                      onExplodedRatioChange?.(0);
                    }}
                    title="0% Armado"
                  >
                    Armado (0%)
                  </button>
                  <button
                    type="button"
                    className="assembly-slider-tick-btn"
                    onClick={() => {
                      setExplosionRatio(0.5);
                      onExplodedRatioChange?.(0.5);
                    }}
                    title="50% Despiece"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    className="assembly-slider-tick-btn"
                    onClick={() => {
                      setExplosionRatio(1.0);
                      onExplodedRatioChange?.(1.0);
                    }}
                    title="100% Máximo Despiece"
                  >
                    Máx. (100%)
                  </button>
                </div>
              </div>

              {effectiveViewMode === '2.5d' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', flex: '1 1 320px' }}>
                  <M3ToggleRow
                    id="assembly-show-trajectories"
                    label="Líneas Guía"
                    checked={showTrajectories}
                    onChange={setShowTrajectories}
                    compact
                  />
                  <M3ToggleRow
                    id="assembly-show-balloons"
                    label="Globos (#1, #2)"
                    checked={showBalloons}
                    onChange={setShowBalloons}
                    compact
                  />
                  <M3ToggleRow
                    id="assembly-show-edge-banding"
                    label="Cantos Vistos"
                    checked={showEdgeBanding}
                    onChange={setShowEdgeBanding}
                    compact
                  />
                </div>
              )}
            </div>

            {/* Row 3: Step-by-Step Guided Navigation */}
            {assemblySheet.steps && assemblySheet.steps.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                  padding: '8px 12px',
                  backgroundColor: 'var(--surface-variant, #f1ede4)',
                  borderRadius: '10px',
                  border: '1px solid var(--border, #d9d2c3)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text, #1f2622)', whiteSpace: 'nowrap' }}>
                    🛠️ Armado Guiado:
                  </span>
                  <button
                    type="button"
                    className="m3-btn m3-btn--tonal"
                    onClick={handlePrevStep}
                    disabled={activeStepNumber === null || activeStepNumber === assemblySheet.steps[0]?.stepNumber}
                    style={{ minHeight: '44px', minWidth: '44px', padding: '0.35rem 0.75rem', fontSize: '0.82rem' }}
                    title="Paso anterior de armado"
                  >
                    ◀ Anterior
                  </button>
                  <button
                    type="button"
                    className={`m3-chip ${activeStepNumber === null ? 'm3-chip--selected' : ''}`}
                    onClick={() => handleSelectStep(null)}
                    style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem', minHeight: '44px', whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    👁️ Todo ({assemblySheet.explodedMap.length} pzas)
                  </button>
                  <button
                    type="button"
                    className="m3-btn m3-btn--filled"
                    onClick={handleNextStep}
                    style={{ minHeight: '44px', padding: '0.35rem 0.85rem', fontSize: '0.82rem' }}
                    title="Avanzar al siguiente paso de montaje"
                  >
                    {activeStepNumber === null
                      ? 'Iniciar Paso 1 ▶'
                      : activeStepNumber === assemblySheet.steps[assemblySheet.steps.length - 1]?.stepNumber
                      ? 'Finalizar / Ver Todo 👁️'
                      : 'Paso Siguiente ▶'}
                  </button>
                </div>

                <div
                  className="assembly-phase-filter-scroll"
                  style={{ display: 'flex', gap: '6px', overflowX: 'auto', maxWidth: '100%', padding: '2px 0' }}
                >
                  {assemblySheet.steps.map((st) => {
                    const isDone = completedSteps.has(st.stepNumber);
                    const isCurrent = activeStepNumber === st.stepNumber;
                    return (
                      <button
                        key={st.stepNumber}
                        type="button"
                        className={`m3-chip ${isCurrent ? 'm3-chip--selected' : ''}`}
                        onClick={() => handleSelectStep(st.stepNumber)}
                        style={{
                          fontSize: '0.78rem',
                          padding: '0.35rem 0.75rem',
                          minHeight: '44px',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          border: isDone ? '1px solid var(--success, #10b981)' : undefined,
                          fontWeight: isCurrent ? 700 : 500,
                        }}
                        title={st.instruction}
                      >
                        {isDone ? '✓ ' : ''}Paso {st.stepNumber}: {st.title.replace(/^[0-9.]+\s*/, '')}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Active Step Context Card */}
          {currentStep && (
            <div
              className="m3-card"
              style={{
                marginBottom: '12px',
                padding: '12px 16px',
                backgroundColor: 'var(--md-sys-color-primary-container)',
                color: 'var(--md-sys-color-on-primary-container)',
                border: '1px solid var(--md-sys-color-primary)',
                borderRadius: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                boxShadow: 'var(--md-sys-elevation-1)',
              }}
            >
              <div style={{ flex: 1, minWidth: '240px' }}>
                <span
                  style={{
                    fontSize: '0.74rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontWeight: 800,
                    color: 'var(--md-sys-color-on-primary-container)',
                    opacity: 0.85,
                    display: 'block',
                    marginBottom: '2px',
                  }}
                >
                  Fase: {translateAssemblyPhase(currentStep.phase)}
                </span>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--md-sys-color-on-primary-container)' }}>
                  Paso {currentStep.stepNumber}: {currentStep.title}
                </div>
                <div style={{ fontSize: '0.84rem', marginTop: '4px', opacity: 0.95, lineHeight: 1.4 }}>
                  {currentStep.instruction}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {currentStep.criticalDimensionMm && (
                  <span
                    style={{
                      fontSize: '0.78rem',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--surface, #ffffff)',
                      color: 'var(--text, #1f2622)',
                      fontWeight: 600,
                      border: '1px solid var(--border, #d9d2c3)',
                    }}
                  >
                    📐 {currentStep.criticalDimensionMm.label}: {currentStep.criticalDimensionMm.valueMm} mm (±{currentStep.criticalDimensionMm.toleranceMm} mm)
                  </span>
                )}
                {currentStep.hardwareSummary && (
                  <span
                    style={{
                      fontSize: '0.78rem',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--surface, #ffffff)',
                      color: 'var(--text, #1f2622)',
                      fontWeight: 600,
                      border: '1px solid var(--border, #d9d2c3)',
                    }}
                  >
                    🔩 {currentStep.hardwareSummary}
                  </span>
                )}
                <button
                  type="button"
                  className="m3-btn m3-btn--small"
                  onClick={() => toggleStep(currentStep.stepNumber)}
                  style={{
                    minHeight: '44px',
                    padding: '0.35rem 0.85rem',
                    fontSize: '0.82rem',
                    backgroundColor: completedSteps.has(currentStep.stepNumber) ? 'var(--primary, #56705f)' : 'var(--surface, #ffffff)',
                    color: completedSteps.has(currentStep.stepNumber) ? 'var(--on-primary, #ffffff)' : 'var(--text, #1f2622)',
                    border: '1px solid var(--border, #d9d2c3)',
                    fontWeight: 700,
                  }}
                >
                  {completedSteps.has(currentStep.stepNumber) ? '✓ Completado' : 'Marcar Completado'}
                </button>
              </div>
            </div>
          )}

          {/* Viewer: 3D Viewport or 2.5D SVG */}
          {effectiveViewMode === '3d' && spatialBoxes && spatialBounds ? (
            <div
              style={{
                width: '100%',
                height: '480px',
                position: 'relative',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid var(--border, #d9d2c3)',
              }}
            >
              <Viewport3D
                boxes={spatialBoxes}
                bounds={spatialBounds}
                pieces={(pieces as ResolvedPieceWithCutSize[]) ?? []}
                explodedRatio={explosionRatio}
                onExplodedRatioChange={(val) => {
                  setExplosionRatio(val);
                  onExplodedRatioChange?.(val);
                }}
                selectedPieceId={selectedPieceId ?? null}
                onSelectPiece={onSelectPiece ?? (() => {})}
                activeStepPieceIds={currentStepPieceIds}
                assembledPieceIds={priorAssembledPieceIds}
                cameraPresetTrigger={cameraPresetTrigger}
                hideToolbar={true}
              />
            </div>
          ) : (
            <div
              className="assembly-diagram-wrapper"
              onClick={() =>
                setModalDiagram({
                  title: '🗺️ Vista Explotada y Mapa de Piezas (#1, #2...)',
                  content: renderExplodedSvg(
                    assemblySheet,
                    pieces,
                    selectedPieceId,
                    onSelectPiece,
                    explosionRatio,
                    viewAngle,
                    showTrajectories,
                    showBalloons,
                    showEdgeBanding,
                    activeStepNumber,
                  ),
                })
              }
              title="Toca para ampliar en pantalla completa"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setModalDiagram({
                    title: '🗺️ Vista Explotada y Mapa de Piezas (#1, #2...)',
                    content: renderExplodedSvg(
                      assemblySheet,
                      pieces,
                      selectedPieceId,
                      onSelectPiece,
                      explosionRatio,
                      viewAngle,
                      showTrajectories,
                      showBalloons,
                      showEdgeBanding,
                      activeStepNumber,
                    ),
                  });
                }
              }}
            >
              <div className="assembly-diagram-tap-hint">
                <span>🔍 Tocar para ampliar</span>
              </div>
              {renderExplodedSvg(
                assemblySheet,
                pieces,
                selectedPieceId,
                onSelectPiece,
                explosionRatio,
                viewAngle,
                showTrajectories,
                showBalloons,
                showEdgeBanding,
                activeStepNumber,
              )}
            </div>
          )}

          {/* Selected Piece Inspection Card */}
          {selectedPieceId && (() => {
            const selectedItem = assemblySheet.explodedMap.find((p) => p.pieceId === selectedPieceId);
            if (!selectedItem) return null;
            return (
              <div
                className="m3-card"
                style={{
                  marginTop: '12px',
                  padding: '12px 16px',
                  backgroundColor: 'var(--md-sys-color-primary-container)',
                  color: 'var(--md-sys-color-on-primary-container)',
                  border: '1px solid var(--md-sys-color-primary)',
                  borderRadius: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                  boxShadow: 'var(--md-sys-elevation-1)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '38px',
                      height: '38px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary, #56705f)',
                      color: 'var(--on-primary, #ffffff)',
                      fontWeight: 800,
                      fontSize: '1rem',
                      flexShrink: 0,
                    }}
                  >
                    #{selectedItem.referenceNumber}
                  </span>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700 }}>
                      {selectedItem.name} <span style={{ opacity: 0.8, fontSize: '0.85rem' }}>({selectedItem.pieceId})</span>
                    </h4>
                    <div style={{ fontSize: '0.82rem', marginTop: '2px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      <span><strong>Corte (An × Al × Esp):</strong> {selectedItem.dimensionsMm.width} × {selectedItem.dimensionsMm.height} × {selectedItem.dimensionsMm.thickness} mm</span>
                      <span>•</span>
                      <span><strong>Cantos:</strong> {selectedItem.bandedEdgesSummary}</span>
                      <span>•</span>
                      <span><strong>Pre-armado:</strong> {selectedItem.hardwarePreparedCount > 0 ? `✓ ${selectedItem.hardwarePreparedCount} mecanizados` : 'Ensamble directo'}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {assemblySheet.panelDetails.some((p) => p.pieceId === selectedItem.pieceId) && (
                    <button
                      type="button"
                      className="m3-btn m3-btn--small m3-btn--filled"
                      style={{ fontSize: '0.82rem', minHeight: '36px', padding: '0 12px' }}
                      onClick={() => {
                        const idx = assemblySheet.panelDetails.findIndex((p) => p.pieceId === selectedItem.pieceId);
                        if (idx >= 0) {
                          setSelectedPanelIndex(idx);
                          setActiveTab('panels');
                        }
                      }}
                    >
                      🔍 Ver Plano con Cotas Datum (0,0) ➔
                    </button>
                  )}
                  <button
                    type="button"
                    className="m3-btn m3-btn--small m3-btn--tonal"
                    style={{ fontSize: '0.82rem', minHeight: '36px', padding: '0 10px' }}
                    onClick={() => onSelectPiece?.(null)}
                  >
                    ✕ Cerrar
                  </button>
                </div>
              </div>
            );
          })()}

          {/* Parts reference cards for mobile / narrow viewports (<= 560px) */}
          <div className="assembly-parts-cards-wrapper">
            {assemblySheet.explodedMap.map((p) => {
              const isSel = selectedPieceId === p.pieceId;
              return (
                <div
                  key={p.pieceId}
                  className={`assembly-piece-card ${isSel ? 'assembly-piece-card--selected' : ''}`}
                  onClick={() => onSelectPiece && onSelectPiece(isSel ? null : p.pieceId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectPiece && onSelectPiece(isSel ? null : p.pieceId);
                    }
                  }}
                >
                  <div className="assembly-piece-card__header">
                    <span className="assembly-piece-card__badge">
                      #{p.referenceNumber}
                    </span>
                    <span className="assembly-piece-card__title">
                      {p.name}
                      <span className="assembly-piece-card__tech-id">{`(${p.pieceId})`}</span>
                    </span>
                  </div>
                  <div className="assembly-piece-card__details">
                    <div>
                      <strong>Corte (An × Al × Esp):</strong> {p.dimensionsMm.width} × {p.dimensionsMm.height} × {p.dimensionsMm.thickness} mm
                    </div>
                    <div>
                      <strong>Cantos:</strong> {p.bandedEdgesSummary}
                    </div>
                    <div
                      style={{
                        color: p.hardwarePreparedCount > 0 ? 'var(--primary, #56705f)' : 'var(--text-muted, #5c655f)',
                        fontWeight: p.hardwarePreparedCount > 0 ? 600 : 400,
                      }}
                    >
                      <strong>Pre-armado:</strong>{' '}
                      {p.hardwarePreparedCount > 0 ? `✓ ${p.hardwarePreparedCount} mecanizados` : 'Ensamble directo'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Parts reference summary table for wider viewports (> 560px) */}
          <div className="assembly-parts-table-wrapper">
            <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2, #ede8dc)', borderBottom: '1px solid var(--border, #d9d2c3)' }}>
                  <th style={{ padding: '8px 10px' }}>#Ref</th>
                  <th style={{ padding: '8px 10px' }}>Pieza / Rol</th>
                  <th style={{ padding: '8px 10px' }}>Corte (Ancho × Alto × Esp)</th>
                  <th style={{ padding: '8px 10px' }}>Cantos Requeridos</th>
                  <th style={{ padding: '8px 10px' }}>Pre-armado</th>
                </tr>
              </thead>
              <tbody>
                {assemblySheet.explodedMap.map((p) => {
                  const isSel = selectedPieceId === p.pieceId;
                  return (
                    <tr
                      key={p.pieceId}
                      onClick={() => onSelectPiece && onSelectPiece(isSel ? null : p.pieceId)}
                      style={{
                        cursor: 'pointer',
                        borderBottom: '1px solid var(--border, #d9d2c3)',
                        background: isSel ? 'var(--md-sys-color-primary-container)' : 'transparent',
                        color: isSel ? 'var(--md-sys-color-on-primary-container)' : 'inherit',
                      }}
                    >
                      <td style={{ padding: '8px 10px', fontWeight: 'bold' }}>
                        <span style={{ display: 'inline-block', width: '24px', height: '24px', lineHeight: '24px', textAlign: 'center', borderRadius: '50%', background: isSel ? 'var(--primary, #56705f)' : 'var(--border, #d9d2c3)', color: isSel ? '#ffffff' : 'var(--text, #1f2622)' }}>
                          {p.referenceNumber}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <strong>{p.name}</strong> <span style={{ opacity: 0.7, fontSize: '0.8rem' }}>({p.pieceId})</span>
                      </td>
                      <td style={{ padding: '8px 10px' }}>{p.dimensionsMm.width} × {p.dimensionsMm.height} × {p.dimensionsMm.thickness} mm</td>
                      <td style={{ padding: '8px 10px' }}>{p.bandedEdgesSummary}</td>
                      <td style={{ padding: '8px 10px', color: p.hardwarePreparedCount > 0 ? 'var(--primary, #56705f)' : 'var(--text-muted, #5c655f)', fontWeight: p.hardwarePreparedCount > 0 ? 'bold' : 'normal' }}>
                        {p.hardwarePreparedCount > 0 ? `✓ ${p.hardwarePreparedCount} mecanizados` : 'Ensamble directo'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SECCIÓN 2: VISTAS DE DETALLE POR PANEL (DATUM X, Y)          */}
      {/* ------------------------------------------------------------- */}
      {(activeTab === 'all' || activeTab === 'panels') && assemblySheet.panelDetails.length > 0 && (
        <div className="assembly-panels-section" style={{ marginTop: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text, #1f2622)', margin: 0 }}>
              🔍 2. Vistas de Pre-mecanizado en Banco (Datum 0,0)
            </h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted, #5c655f)' }}>
              Montar herrajes sobre banco antes de unir casco
            </span>
          </div>

          {/* Panel selection chips */}
          <div className="assembly-panel-chips-scroll" role="tablist" aria-label="Lista de paneles pre-mecanizados">
            {assemblySheet.panelDetails.map((p, idx) => {
              const isSelected = selectedPanelIndex === idx;
              const label = `#${p.referenceNumber} ${p.name}`;
              return (
                <button
                  key={p.pieceId}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedPanelIndex(idx)}
                  className={`m3-btn m3-btn--small assembly-panel-chip ${isSelected ? 'm3-btn--filled' : 'm3-btn--outlined'}`}
                  title={label}
                >
                  <span className="assembly-panel-chip-text">{label}</span>
                </button>
              );
            })}
          </div>

          {selectedPanel && (
            <div className="assembly-panel-detail-grid">
              <div>
                <div className="assembly-diagram-header-bar">
                  <span className="assembly-diagram-header-title">
                    #{selectedPanel.referenceNumber} {selectedPanel.name}
                  </span>
                  <button
                    type="button"
                    className="m3-btn m3-btn--tonal m3-btn--small assembly-diagram-zoom-btn"
                    onClick={() =>
                      setModalDiagram({
                        title: `🔍 #${selectedPanel.referenceNumber} ${selectedPanel.name} — Datum (0,0)`,
                        content: renderPanelDetailSvg(selectedPanel),
                      })
                    }
                    aria-label={`Ampliar plano técnico de #${selectedPanel.referenceNumber} ${selectedPanel.name} a pantalla completa`}
                    title="Toca para ampliar a pantalla completa"
                  >
                    <span>🔍</span> Ampliar
                  </button>
                </div>

                <div
                  className="assembly-diagram-wrapper"
                  onClick={() =>
                    setModalDiagram({
                      title: `🔍 #${selectedPanel.referenceNumber} ${selectedPanel.name} — Datum (0,0)`,
                      content: renderPanelDetailSvg(selectedPanel),
                    })
                  }
                  title="Toca para ampliar en pantalla completa"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setModalDiagram({
                        title: `🔍 #${selectedPanel.referenceNumber} ${selectedPanel.name} — Datum (0,0)`,
                        content: renderPanelDetailSvg(selectedPanel),
                      });
                    }
                  }}
                >
                  {renderPanelDetailSvg(selectedPanel)}
                </div>
              </div>

              <div
                style={{
                  background: 'var(--surface-2, #ede8dc)',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid var(--border, #d9d2c3)',
                }}
              >
                <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: 'var(--text, #1f2622)' }}>
                  #{selectedPanel.referenceNumber} {selectedPanel.name}
                </h4>
                <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: 'var(--text-muted, #5c655f)' }}>
                  <strong>Corte (An × Al × Esp):</strong> {selectedPanel.dimensionsMm.width} × {selectedPanel.dimensionsMm.height} × {selectedPanel.dimensionsMm.thickness} mm
                </p>

                <div style={{ fontSize: '0.8rem', color: 'var(--danger, #b3412f)', fontWeight: 'bold', marginBottom: '10px' }}>
                  📍 {selectedPanel.datumNotes}
                </div>

                <h5 style={{ margin: '8px 0 6px 0', fontSize: '0.85rem', color: 'var(--text, #1f2622)' }}>
                  Operaciones a Realizar en Banco:
                </h5>
                {selectedPanel.operations.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted, #5c655f)' }}>No requiere perforaciones previas.</p>
                ) : (
                  <ul style={{ paddingLeft: '18px', margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--text, #1f2622)' }}>
                    {selectedPanel.operations.map((op, i) => (
                      <li key={i} style={{ marginBottom: '4px' }}>
                        <strong>Y = {op.yFromBottomMm} mm</strong> (X = {op.xFromFrontMm} mm): {op.description} — <em>{op.drillSpecs ?? op.hardwareType}</em>
                      </li>
                    ))}
                  </ul>
                )}

                {selectedPanel.hardwareInstalled.length > 0 && (
                  <div>
                    <h5 style={{ margin: '8px 0 6px 0', fontSize: '0.85rem', color: 'var(--text, #1f2622)' }}>
                      Herrajes a Insertar:
                    </h5>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {selectedPanel.hardwareInstalled.map((h, i) => (
                        <span
                          key={i}
                          style={{
                            display: 'inline-block',
                            background: 'var(--surface, #ffffff)',
                            border: '1px solid var(--border, #d9d2c3)',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            fontSize: '0.78rem',
                            color: 'var(--text, #1f2622)',
                          }}
                        >
                          <strong>{h.quantity}x</strong> {h.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SECCIÓN 3: ESQUEMA DE POSICIONAMIENTO DE CALIBRES Y VANOS    */}
      {/* ------------------------------------------------------------- */}
      {(activeTab === 'all' || activeTab === 'gauges') && (
        <div className="assembly-gauges-section" style={{ marginTop: '28px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text, #1f2622)' }}>
            📏 3. Calibres de Montaje Derivados ({assemblySheet.gauges.length})
          </h3>

          {assemblySheet.gauges.length === 0 ? (
            <p style={{ color: 'var(--text-muted, #5c655f)', fontSize: '0.9rem' }}>
              No se identificaron vanos paralelos repetidos que requieran calibres especiales.
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              {assemblySheet.gauges.map((g: AssemblyGauge) => (
                <div
                  key={g.id}
                  style={{
                    border: '1px solid var(--border, #a7f3d0)',
                    background: 'var(--surface-2, #f0fdf4)',
                    borderRadius: '8px',
                    padding: '12px',
                    boxShadow: 'var(--md-sys-elevation-1)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--success, #065f46)' }}>
                      Calibre {g.label}
                    </span>
                    <span
                      style={{
                        background: 'var(--surface, #d1fae5)',
                        color: 'var(--success, #065f46)',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      {g.spansCount} vano(s)
                    </span>
                  </div>
                  <div style={{ marginTop: '8px', fontSize: '0.875rem', color: 'var(--text, #374151)' }}>
                    <div><strong>Largo vano:</strong> {g.clearSpanMm} mm</div>
                    <div><strong>Ancho tira:</strong> {g.widthMm} mm</div>
                    <div><strong>Costo material:</strong> $0.00 (Retazo)</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Carcass Elevation & Gauge Placement SVG */}
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text, #1f2622)' }}>
              Esquema de Posicionamiento de Calibres
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '4px 10px', borderRadius: '16px', background: 'var(--surface-2, #e0f2fe)', color: 'var(--primary, #0369a1)', border: '1px solid var(--border, #bae6fd)' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--primary, #56705f)', display: 'inline-block' }}></span>
                Paneles y Estructura
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '4px 10px', borderRadius: '16px', background: 'var(--surface-2, #f0fdf4)', color: 'var(--success, #15803d)', border: '1px solid var(--border, #bbf7d0)' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--success, #3f7d4e)', display: 'inline-block' }}></span>
                Tiras Calibre ({assemblySheet.gauges.map((g) => g.label).join(', ') || 'N/A'})
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '4px 10px', borderRadius: '16px', background: 'var(--surface, #f8fafc)', color: 'var(--text-muted, #475569)', border: '1px solid var(--border, #cbd5e1)' }}>
                <span style={{ width: '12px', height: '0px', borderTop: '2px dashed var(--text-muted, #94a3b8)', display: 'inline-block' }}></span>
                Fondo Ranurado
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '4px 10px', borderRadius: '16px', background: 'var(--surface, #f8fafc)', color: 'var(--text-muted, #475569)', border: '1px solid var(--border, #cbd5e1)' }}>
                <span style={{ width: '12px', height: '0px', borderTop: '2px solid var(--primary, #546e7a)', display: 'inline-block' }}></span>
                Cotas Generales (mm)
              </span>
            </div>
            <div
              className="assembly-diagram-wrapper"
              onClick={() =>
                setModalDiagram({
                  title: '📏 Esquema de Posicionamiento de Calibres y Vanos',
                  content: renderAssemblySvg(assemblySheet, pieces),
                })
              }
              title="Toca para ampliar en pantalla completa"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setModalDiagram({
                    title: '📏 Esquema de Posicionamiento de Calibres y Vanos',
                    content: renderAssemblySvg(assemblySheet, pieces),
                  });
                }
              }}
            >
              <div className="assembly-diagram-tap-hint">
                <span>🔍 Tocar para ampliar</span>
              </div>
              {renderAssemblySvg(assemblySheet, pieces)}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SECCIÓN 4: PASOS DE ARMADO SECUENCIALES (CHECKLIST Y ESCUADRA) */}
      {/* ------------------------------------------------------------- */}
      {(activeTab === 'all' || activeTab === 'steps') && (
        <div className="assembly-steps-section" style={{ marginTop: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text, #1f2622)' }}>
              📋 4. Pasos de Armado Secuenciales ({completedSteps.size}/{assemblySheet.steps.length})
            </h3>
            {allDone && (
              <span style={{ color: 'var(--success, #059669)', fontWeight: 600, fontSize: '0.9rem' }}>
                ✓ ¡Módulo Completado!
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {assemblySheet.steps.map((step) => {
              const isDone = completedSteps.has(step.stepNumber);
              const isActive = activeStepNumber === step.stepNumber;

              return (
                <div
                  key={step.stepNumber}
                  onClick={() => {
                    setActiveStepNumber(isActive ? null : step.stepNumber);
                    if (step.piecesInvolved.length > 0 && onSelectPiece) {
                      onSelectPiece(step.piecesInvolved[0] ?? null);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '14px',
                    padding: '14px 18px',
                    borderRadius: '12px',
                    border: isDone
                      ? '1px solid var(--success, #10b981)'
                      : isActive
                      ? '2px solid var(--primary, #56705f)'
                      : '1px solid var(--border, #e5e7eb)',
                    background: isDone
                      ? 'var(--surface-2, #f0fdf4)'
                      : isActive
                      ? 'var(--surface-2, #ede8dc)'
                      : 'var(--surface, #ffffff)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease-in-out',
                    boxShadow: isActive ? 'var(--md-sys-elevation-2)' : 'var(--md-sys-elevation-1)',
                  }}
                >
                  <label
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      minWidth: '44px',
                      minHeight: '44px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0,
                      margin: '-6px 0 -6px -6px',
                    }}
                  >
                    <input
                      type="checkbox"
                      className="m3-checkbox"
                      checked={isDone}
                      onChange={() => toggleStep(step.stepNumber)}
                      style={{
                        cursor: 'pointer',
                        accentColor: 'var(--primary, #56705f)',
                      }}
                      aria-label={`Marcar paso ${step.stepNumber} como completado`}
                    />
                  </label>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '1rem',
                          color: isDone ? 'var(--success, #065f46)' : 'var(--text, #111827)',
                          textDecoration: isDone ? 'line-through' : 'none',
                        }}
                      >
                        Paso {step.stepNumber}: {step.title}
                      </span>

                      <span
                        style={{
                          background: 'var(--surface-2, #ede8dc)',
                          color: 'var(--primary, #56705f)',
                          border: '1px solid var(--border, #d9d2c3)',
                          borderRadius: '12px',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                        }}
                      >
                        {translateAssemblyPhase(step.phase)}
                      </span>
                    </div>

                    <p style={{ margin: '6px 0 8px 0', fontSize: '0.9rem', color: isDone ? 'var(--text-muted, #4b5563)' : 'var(--text, #374151)', lineHeight: 1.45 }}>
                      {step.instruction}
                    </p>

                    {/* Hardware Requirements Badge */}
                    {step.hardwareRequirements && step.hardwareRequirements.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                        {step.hardwareRequirements.map((h, i) => (
                          <span
                            key={i}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'var(--surface-2, #ede8dc)',
                              border: '1px solid var(--border, #d9d2c3)',
                              borderRadius: '6px',
                              fontSize: '0.78rem',
                              padding: '2px 8px',
                              color: 'var(--text, #1f2622)',
                            }}
                          >
                            🔩 <strong>{h.quantity}x</strong> {h.label} {h.toolRequired && `(${h.toolRequired})`}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Critical Dimension Card */}
                    {step.criticalDimensionMm && (
                      <div
                        style={{
                          background: 'var(--surface, #ffffff)',
                          border: '1px solid var(--danger, #b3412f)',
                          borderLeft: '4px solid var(--danger, #b3412f)',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '0.82rem',
                          color: 'var(--danger, #b3412f)',
                          fontWeight: 'bold',
                          marginBottom: '8px',
                        }}
                      >
                        ★ COTA CRÍTICA: {step.criticalDimensionMm.label} = {step.criticalDimensionMm.valueMm} mm (Tolerancia: ±{step.criticalDimensionMm.toleranceMm} mm)
                      </div>
                    )}

                    {/* Gauges Required */}
                    {step.gaugesInvolved.map((g) => (
                      <span
                        key={g}
                        style={{
                          display: 'inline-block',
                          background: 'var(--surface-2, #dcfce7)',
                          color: 'var(--success, #166534)',
                          border: '1px solid var(--border, #86efac)',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          marginRight: '6px',
                          marginBottom: '6px',
                        }}
                      >
                        Calibre {g}
                      </span>
                    ))}

                    {/* Tools Required */}
                    {step.toolsRequired && step.toolsRequired.length > 0 && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #5c655f)', marginTop: '4px' }}>
                        🛠️ <em>Herramientas: {step.toolsRequired.join(', ')}</em>
                      </div>
                    )}

                    {/* Workshop Tips */}
                    {step.workshopTips && step.workshopTips.length > 0 && (
                      <div style={{ marginTop: '6px' }}>
                        {step.workshopTips.map((tip, idx) => (
                          <p key={idx} style={{ margin: '2px 0 0 0', fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--accent-text, #8a6a24)' }}>
                            💡 Tip: {tip}
                          </p>
                        ))}
                      </div>
                    )}

                    {step.notes && !step.workshopTips && (
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-muted, #6b7280)' }}>
                        Nota: {step.notes}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {modalDiagram && (
        <AssemblyDiagramModal
          title={modalDiagram.title}
          onClose={() => setModalDiagram(null)}
        >
          {modalDiagram.content}
        </AssemblyDiagramModal>
      )}
    </section>
  );
}
