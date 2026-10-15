import { useState, type ReactElement } from 'react';
import {
  type AssemblySheet,
  type AssemblyGauge,
  type ResolvedPiece,
  type ResolvedPieceWithCutSize,
  determinePieceSpatialSize,
  exportAssemblyGuidePdf,
  buildWallShelving,
  generateInstallationSheetSvg,
  type WallShelvingDefinition,
} from '../resolver';

export interface AssemblySheetViewProps {
  assemblySheet: AssemblySheet | null;
  pieces?: (ResolvedPieceWithCutSize | ResolvedPiece)[];
  onExportPdf?: () => void;
}

/**
 * Render an SVG elevation diagram showing the carcass panels and assembly gauge strips
 * using real panel millimeter coordinates and exact clear spans.
 */
function renderAssemblySvg(
  sheet: AssemblySheet,
  pieces?: (ResolvedPieceWithCutSize | ResolvedPiece)[],
): ReactElement {
  const width = 720;
  const height = 460;
  const marginL = 75;
  const marginR = 175;
  const marginT = 40;
  const marginB = 55;

  const drawW = width - marginL - marginR;
  const drawH = height - marginT - marginB;

  // Filter out auxiliary pieces and front doors / drawer fronts for structural elevation
  const nonAuxPieces = (pieces ?? []).filter((p) => !p.isAuxiliary);
  const structuralPieces = nonAuxPieces.filter(
    (p) =>
      !p.role.includes('door') &&
      !p.role.includes('bifold') &&
      !p.role.includes('drawer-front') &&
      !p.role.includes('drawer-box'),
  );

  const displayPieces = structuralPieces.length > 0 ? structuralPieces : nonAuxPieces;

  // Calculate actual bounding box in XY plane
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  if (displayPieces.length > 0) {
    for (const p of displayPieces) {
      const pos = p.positionMm ?? { x: 0, y: 0, z: 0 };
      const size = determinePieceSpatialSize(p);
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x + size.x);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y + size.y);
    }
  }

  const hasRealPieces = Number.isFinite(minX) && maxX > minX && maxY > minY;
  const modW = hasRealPieces ? maxX - minX : 600;
  const modH = hasRealPieces ? maxY - minY : 800;

  const scale = Math.min(drawW / modW, drawH / modH);
  const actualDrawW = modW * scale;
  const actualDrawH = modH * scale;

  const originX = marginL + (drawW - actualDrawW) / 2;
  const originY = marginT + (drawH - actualDrawH) / 2;

  // Map millimeter to SVG coords (SVG Y goes down)
  const toSvgX = (mmX: number) => originX + (mmX - (hasRealPieces ? minX : 0)) * scale;
  const toSvgY = (mmY: number, sizeH: number) => originY + (modH - (mmY - (hasRealPieces ? minY : 0) + sizeH)) * scale;

  const gauges = sheet.gauges;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="assembly-svg"
      style={{ width: '100%', height: 'auto', maxHeight: '460px', background: '#fafafa', borderRadius: '12px' }}
      aria-label="Esquema de elevación del casco y calibres de taller"
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#1b5e20" />
        </marker>
        <marker id="arrow-dim" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#546e7a" />
        </marker>
        <pattern id="gauge-hatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#81c784" strokeWidth="2" />
        </pattern>
      </defs>

      {/* Render Real Pieces */}
      {hasRealPieces ? (
        <g id="carcass-pieces">
          {displayPieces.map((p) => {
            const pos = p.positionMm ?? { x: 0, y: 0, z: 0 };
            const size = determinePieceSpatialSize(p);
            const px = toSvgX(pos.x);
            const py = toSvgY(pos.y, size.y);
            const pw = Math.max(1.5, size.x * scale);
            const ph = Math.max(1.5, size.y * scale);

            const isSide = p.role.includes('side');
            const isBottom = p.role.includes('bottom');
            const isTopOrRail = p.role.includes('top') || p.role.includes('rail');
            const isShelf = p.role.includes('shelf');
            const isPartition = p.role.includes('partition') || p.role.includes('divider');
            const isBack = p.role.includes('back');

            let fill = '#90a4ae';
            let stroke = '#37474f';
            let strokeDasharray: string | undefined;

            if (isSide || isPartition) {
              fill = '#b0bec5';
            } else if (isShelf) {
              fill = '#78909c';
            } else if (isBottom) {
              fill = '#90a4ae';
            } else if (isBack) {
              fill = '#eceff1';
              stroke = '#b0bec5';
              strokeDasharray = '3 3';
            }

            return (
              <g key={p.id}>
                <rect
                  x={px}
                  y={py}
                  width={pw}
                  height={ph}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth="1.2"
                  strokeDasharray={strokeDasharray}
                  rx="1"
                />
                {/* Piece label on larger elements */}
                {pw >= 40 && ph >= 14 && (
                  <text
                    x={px + pw / 2}
                    y={py + ph / 2 + 3.5}
                    textAnchor="middle"
                    fontSize="9"
                    fill={isShelf ? '#ffffff' : '#263238'}
                    fontWeight={isShelf ? 'bold' : 'normal'}
                  >
                    {isShelf ? 'Estante' : isBottom ? 'Piso' : isTopOrRail ? 'Techo/Faja' : p.id}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      ) : (
        /* Fallback wireframe when piece coordinates are unavailable */
        <g id="carcass-fallback">
          <rect
            x={originX}
            y={originY}
            width={12}
            height={actualDrawH}
            fill="#b0bec5"
            stroke="#37474f"
            strokeWidth="1.5"
          />
          <rect
            x={originX + actualDrawW - 12}
            y={originY}
            width={12}
            height={actualDrawH}
            fill="#b0bec5"
            stroke="#37474f"
            strokeWidth="1.5"
          />
          <rect
            x={originX + 12}
            y={originY + actualDrawH - 12}
            width={actualDrawW - 24}
            height={12}
            fill="#90a4ae"
            stroke="#37474f"
            strokeWidth="1.5"
          />
          <rect
            x={originX + 12}
            y={originY}
            width={actualDrawW - 24}
            height={12}
            fill="#90a4ae"
            stroke="#37474f"
            strokeWidth="1.5"
          />
        </g>
      )}

      {/* Assembly Gauges Placement */}
      {gauges.length > 0 && (
        <g id="assembly-gauges">
          {gauges.map((g, gIdx) => {
            // Find occurrences or fallback to shelves
            const occurrences = g.occurrences && g.occurrences.length > 0 ? g.occurrences : [];
            const pieceMap = new Map(displayPieces.map((p) => [p.id, p]));

            const renderedOccurrences = occurrences
              .map((occ) => {
                const lower = pieceMap.get(occ.lowerPieceId);
                const upper = pieceMap.get(occ.upperPieceId);
                if (!lower || !upper) return null;
                const lowerSize = determinePieceSpatialSize(lower);
                const upperSize = determinePieceSpatialSize(upper);
                const startY = lower.positionMm.y + lowerSize.y;
                const endY = upper.positionMm.y;
                const minXSpan = Math.max(lower.positionMm.x, upper.positionMm.x);
                const maxXSpan = Math.min(
                  lower.positionMm.x + lowerSize.x,
                  upper.positionMm.x + upperSize.x,
                );
                return { startY, endY, minXSpan, maxXSpan };
              })
              .filter((x): x is NonNullable<typeof x> => Boolean(x));

            // If occurrences couldn't resolve piece positions directly, deduce from shelves
            const spansToDraw =
              renderedOccurrences.length > 0
                ? renderedOccurrences
                : (() => {
                    const shelves = displayPieces
                      .filter((p) => p.role.includes('shelf'))
                      .sort((a, b) => a.positionMm.y - b.positionMm.y);
                    const bottom = displayPieces.find((p) => p.role.includes('bottom'));
                    const list: { startY: number; endY: number; minXSpan: number; maxXSpan: number }[] = [];

                    let prevY = bottom ? bottom.positionMm.y + determinePieceSpatialSize(bottom).y : 0;
                    for (const s of shelves) {
                      const shelfY = s.positionMm.y;
                      const span = shelfY - prevY;
                      if (Math.abs(span - g.clearSpanMm) <= 4.0) {
                        list.push({
                          startY: prevY,
                          endY: shelfY,
                          minXSpan: s.positionMm.x,
                          maxXSpan: s.positionMm.x + determinePieceSpatialSize(s).x,
                        });
                      }
                      prevY = shelfY + determinePieceSpatialSize(s).y;
                    }
                    return list;
                  })();

            return (
              <g key={g.id}>
                {spansToDraw.map((span, occIdx) => {
                  const gy = toSvgY(span.startY, span.endY - span.startY);
                  const gh = Math.max(4, (span.endY - span.startY) * scale);
                  const spanLeftSvg = toSvgX(span.minXSpan);
                  const spanRightSvg = toSvgX(span.maxXSpan);
                  const spanWidthSvg = spanRightSvg - spanLeftSvg;
                  const blockW = Math.max(16, Math.min(26, spanWidthSvg * 0.16));

                  const leftBlockX = spanLeftSvg + 6;
                  const rightBlockX = spanRightSvg - blockW - 6;

                  // Right dimension line
                  const dimLineX = originX + actualDrawW + 20 + gIdx * 35;

                  return (
                    <g key={`${g.id}-${occIdx}`}>
                      {/* Left gauge strip */}
                      <rect
                        x={leftBlockX}
                        y={gy}
                        width={blockW}
                        height={gh}
                        fill="url(#gauge-hatch)"
                        stroke="#2e7d32"
                        strokeWidth="1.5"
                        rx="2"
                      />
                      <rect
                        x={leftBlockX}
                        y={gy}
                        width={blockW}
                        height={gh}
                        fill="#c8e6c9"
                        opacity="0.65"
                      />
                      <text
                        x={leftBlockX + blockW / 2}
                        y={gy + gh / 2 + 3.5}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="bold"
                        fill="#1b5e20"
                      >
                        {g.label}
                      </text>

                      {/* Right gauge strip */}
                      <rect
                        x={rightBlockX}
                        y={gy}
                        width={blockW}
                        height={gh}
                        fill="url(#gauge-hatch)"
                        stroke="#2e7d32"
                        strokeWidth="1.5"
                        rx="2"
                      />
                      <rect
                        x={rightBlockX}
                        y={gy}
                        width={blockW}
                        height={gh}
                        fill="#c8e6c9"
                        opacity="0.65"
                      />
                      <text
                        x={rightBlockX + blockW / 2}
                        y={gy + gh / 2 + 3.5}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="bold"
                        fill="#1b5e20"
                      >
                        {g.label}
                      </text>

                      {/* Dimension line & cotas */}
                      <line
                        x1={spanRightSvg + 2}
                        y1={gy}
                        x2={dimLineX + 8}
                        y2={gy}
                        stroke="#81c784"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
                      <line
                        x1={spanRightSvg + 2}
                        y1={gy + gh}
                        x2={dimLineX + 8}
                        y2={gy + gh}
                        stroke="#81c784"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
                      <line
                        x1={dimLineX}
                        y1={gy}
                        x2={dimLineX}
                        y2={gy + gh}
                        stroke="#1b5e20"
                        strokeWidth="1.5"
                        markerStart="url(#arrow)"
                        markerEnd="url(#arrow)"
                      />
                      <text
                        x={dimLineX + 6}
                        y={gy + gh / 2 + 3.5}
                        fontSize="10"
                        fontWeight="bold"
                        fill="#1b5e20"
                      >
                        {g.label}: {g.clearSpanMm} mm
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </g>
      )}

      {/* Exterior Dimension Cotas (Overall Width & Height) */}
      <g id="module-cotas">
        {/* Height Cota on the Left */}
        <line
          x1={originX - 16}
          y1={originY}
          x2={originX - 16}
          y2={originY + actualDrawH}
          stroke="#546e7a"
          strokeWidth="1.2"
          markerStart="url(#arrow-dim)"
          markerEnd="url(#arrow-dim)"
        />
        <line
          x1={originX - 22}
          y1={originY}
          x2={originX}
          y2={originY}
          stroke="#90a4ae"
          strokeWidth="1"
        />
        <line
          x1={originX - 22}
          y1={originY + actualDrawH}
          x2={originX}
          y2={originY + actualDrawH}
          stroke="#90a4ae"
          strokeWidth="1"
        />
        <text
          x={originX - 22}
          y={originY + actualDrawH / 2}
          textAnchor="middle"
          fontSize="10"
          fontWeight="bold"
          fill="#37474f"
          transform={`rotate(-90, ${originX - 22}, ${originY + actualDrawH / 2})`}
        >
          {Math.round(modH)} mm
        </text>

        {/* Width Cota at the Bottom */}
        <line
          x1={originX}
          y1={originY + actualDrawH + 18}
          x2={originX + actualDrawW}
          y2={originY + actualDrawH + 18}
          stroke="#546e7a"
          strokeWidth="1.2"
          markerStart="url(#arrow-dim)"
          markerEnd="url(#arrow-dim)"
        />
        <line
          x1={originX}
          y1={originY + actualDrawH + 4}
          x2={originX}
          y2={originY + actualDrawH + 24}
          stroke="#90a4ae"
          strokeWidth="1"
        />
        <line
          x1={originX + actualDrawW}
          y1={originY + actualDrawH + 4}
          x2={originX + actualDrawW}
          y2={originY + actualDrawH + 24}
          stroke="#90a4ae"
          strokeWidth="1"
        />
        <text
          x={originX + actualDrawW / 2}
          y={originY + actualDrawH + 34}
          textAnchor="middle"
          fontSize="10"
          fontWeight="bold"
          fill="#37474f"
        >
          {Math.round(modW)} mm
        </text>
      </g>

      {/* Legend Box */}
      <g transform={`translate(${width - 150}, 16)`}>
        <rect x="0" y="0" width="138" height="74" fill="#ffffff" stroke="#e0e0e0" rx="6" />
        <rect x="10" y="10" width="16" height="12" fill="#c8e6c9" stroke="#2e7d32" strokeWidth="1.5" rx="1" />
        <text x="32" y="20" fontSize="9.5" fill="#212121" fontWeight="500">Tira Calibre</text>

        <rect x="10" y="28" width="16" height="8" fill="#78909c" stroke="#37474f" rx="1" />
        <text x="32" y="35" fontSize="9.5" fill="#212121" fontWeight="500">Paneles / Estante</text>

        <line x1="10" y1="52" x2="26" y2="52" stroke="#1b5e20" strokeWidth="1.5" markerEnd="url(#arrow)" />
        <text x="32" y="55" fontSize="9.5" fill="#212121" fontWeight="500">Luz Libre Vano</text>
      </g>
    </svg>
  );
}

/**
 * View component for the sequential workshop assembly sheet.
 * Implements Google Material Design 3 guidelines with elevation, cards, and step tracking.
 */
export function AssemblySheetView({
  assemblySheet,
  pieces,
  onExportPdf,
}: AssemblySheetViewProps): ReactElement {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const wallShelfPieces = pieces?.filter((p) => p.role === 'wall-shelf');
  if (wallShelfPieces && wallShelfPieces.length > 0) {
    const first = wallShelfPieces[0]!;
    const widthMm = first.contour.points[1]?.x ?? 1200;
    const depthMm = first.contour.points[2]?.y ?? 250;
    const thicknessMm = first.thicknessMm ?? 18;
    const shelfCount = wallShelfPieces.length;
    const verticalSpacingMm =
      wallShelfPieces.length > 1
        ? Math.round(
            Math.abs(
              (wallShelfPieces[1]!.positionMm?.y ?? 320) -
                (wallShelfPieces[0]!.positionMm?.y ?? 0),
            ),
          ) || 320
        : 320;

    const wallDef: WallShelvingDefinition = {
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
      materialId: first.materialId,
      baseElevationYMm: 800,
    };

    const wallOutput = buildWallShelving(wallDef);
    const svgHtml = generateInstallationSheetSvg(wallOutput, wallDef);

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
        </div>

        <div
          style={{
            marginTop: '16px',
            overflowX: 'auto',
            background: '#ffffff',
            borderRadius: '8px',
            padding: '8px',
            border: '1px solid #e2e8f0',
          }}
        >
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
            style={{ padding: '12px', background: '#f8fafc', border: '1px solid #cbd5e1' }}
          >
            <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', color: '#0f172a' }}>
              🔩 Taco y Anclaje Sugerido
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#334155' }}>
              <strong>{wallOutput.bracketCalculation.recommendedAnchor.brandModel}</strong>
              <br />
              Tornillo: {wallOutput.bracketCalculation.recommendedAnchor.screwDiameterMm}x
              {wallOutput.bracketCalculation.recommendedAnchor.screwLengthMm} mm
              <br />
              Tracción est.: ~{wallOutput.bracketCalculation.pullOutForceKg} kg/ménsula
            </p>
          </div>

          <div
            className="m3-card"
            style={{ padding: '12px', background: '#f8fafc', border: '1px solid #cbd5e1' }}
          >
            <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', color: '#0f172a' }}>
              ⚖️ Análisis de Flecha (Sagulator)
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#334155' }}>
              Ménsulas por estante: <strong>{wallOutput.bracketCalculation.bracketCountPerShelf}</strong> (Luz:{' '}
              {wallOutput.bracketCalculation.maxSpanMm} mm)
              <br />
              Flecha calculada: <strong>{wallOutput.bracketCalculation.calculatedDeflectionMm} mm</strong>{' '}
              (Límite: {wallOutput.bracketCalculation.allowableDeflectionMm} mm)
              <br />
              Carga máxima: {wallOutput.bracketCalculation.totalShelfLoadKg} kg / estante
            </p>
          </div>
        </div>
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

  return (
    <section aria-labelledby="assembly-heading" className="m3-card assembly-sheet-card">
      <div className="m3-card__header">
        <div>
          <h2 id="assembly-heading" className="m3-card__title">
            📖 Guía de Armado y Calibres de Taller
          </h2>
          <p className="m3-card__subtitle">
            Secuencia de montaje sin cinta métrica usando tiras calibre derivadas de vanos idénticos.
          </p>
        </div>

        <div className="assembly-actions">
          <button
            type="button"
            className="m3-button m3-button--filled"
            onClick={handleDefaultExport}
          >
            📄 Exportar Guía PDF
          </button>
        </div>
      </div>

      {/* Assembly Gauges Table / Cards */}
      <div className="assembly-gauges-section" style={{ marginTop: '16px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px', color: '#1f2937' }}>
          📏 Calibres de Montaje Derivados ({assemblySheet.gauges.length})
        </h3>

        {assemblySheet.gauges.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
            No se identificaron vanos paralelos repetidos que requieran calibres especiales.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            {assemblySheet.gauges.map((g: AssemblyGauge) => (
              <div
                key={g.id}
                style={{
                  border: '1px solid #a7f3d0',
                  background: '#f0fdf4',
                  borderRadius: '8px',
                  padding: '12px',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#065f46' }}>
                    Calibre {g.label}
                  </span>
                  <span
                    style={{
                      background: '#d1fae5',
                      color: '#065f46',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    {g.spansCount} vano(s)
                  </span>
                </div>
                <div style={{ marginTop: '8px', fontSize: '0.875rem', color: '#374151' }}>
                  <div><strong>Largo vano:</strong> {g.clearSpanMm} mm</div>
                  <div><strong>Ancho tira:</strong> {g.widthMm} mm</div>
                  <div><strong>Costo material:</strong> $0.00 (Retazo)</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Carcass Elevation & Gauge Placement SVG */}
      <div style={{ marginTop: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '8px', color: '#1f2937' }}>
          📐 Esquema de Posicionamiento de Calibres
        </h3>
        {renderAssemblySvg(assemblySheet, pieces)}
      </div>

      {/* Sequential Assembly Checklist */}
      <div style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1f2937' }}>
            📋 Pasos de Armado Secuenciales ({completedSteps.size}/{assemblySheet.steps.length})
          </h3>
          {allDone && (
            <span style={{ color: '#059669', fontWeight: 600, fontSize: '0.9rem' }}>
              ✓ ¡Módulo Completado!
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {assemblySheet.steps.map((step) => {
            const isDone = completedSteps.has(step.stepNumber);
            return (
              <div
                key={step.stepNumber}
                onClick={() => toggleStep(step.stepNumber)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: isDone ? '1px solid #10b981' : '1px solid #e5e7eb',
                  background: isDone ? '#f0fdf4' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-in-out',
                }}
              >
                <input
                  type="checkbox"
                  checked={isDone}
                  onChange={() => toggleStep(step.stepNumber)}
                  style={{ marginTop: '3px', cursor: 'pointer', accentColor: '#10b981', width: '16px', height: '16px' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        color: isDone ? '#065f46' : '#111827',
                        textDecoration: isDone ? 'line-through' : 'none',
                      }}
                    >
                      Paso {step.stepNumber}: {step.title}
                    </span>
                    {step.gaugesInvolved.map((g) => (
                      <span
                        key={g}
                        style={{
                          background: '#dcfce7',
                          color: '#166534',
                          border: '1px solid #86efac',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '1px 6px',
                        }}
                      >
                        Calibre {g}
                      </span>
                    ))}
                  </div>

                  <p
                    style={{
                      margin: '4px 0 0 0',
                      fontSize: '0.875rem',
                      color: isDone ? '#4b5563' : '#374151',
                    }}
                  >
                    {step.instruction}
                  </p>

                  {step.notes && (
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', fontStyle: 'italic', color: '#6b7280' }}>
                      Nota: {step.notes}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
