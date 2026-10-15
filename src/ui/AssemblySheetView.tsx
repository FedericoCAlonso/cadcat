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
  type WallShelvingOutput,
} from '../resolver';

export interface AssemblySheetViewProps {
  assemblySheet: AssemblySheet | null;
  pieces?: (ResolvedPieceWithCutSize | ResolvedPiece)[];
  wallShelvingOutput?: WallShelvingOutput | null;
  wallShelvingDefinition?: WallShelvingDefinition | null;
  onExportPdf?: () => void;
}

type DrawnSpan =
  | {
      axis: 'y';
      startY: number;
      endY: number;
      minXSpan: number;
      maxXSpan: number;
    }
  | {
      axis: 'x';
      startX: number;
      endX: number;
      floorY: number;
    };

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

  // Separate backing pieces from structural foreground panels
  const backPieces = displayPieces.filter((p) => p.role.includes('back'));
  const frontPieces = displayPieces.filter((p) => !p.role.includes('back'));
  const sortedDisplayPieces = [...backPieces, ...frontPieces];

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

      {/* Render Real Pieces: Backing first, then structural panels */}
      {hasRealPieces ? (
        <g id="carcass-pieces">
          {sortedDisplayPieces.map((p) => {
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
              fill = '#f8fafc';
              stroke = '#94a3b8';
              strokeDasharray = '4 4';
            }

            return (
              <g key={p.id}>
                <rect
                  x={px}
                  y={py}
                  width={pw}
                  height={ph}
                  fill={fill}
                  fillOpacity={isBack ? 0.6 : 1}
                  stroke={stroke}
                  strokeWidth="1.2"
                  strokeDasharray={strokeDasharray}
                  rx="1"
                />
                {/* Piece label on larger elements (skip back to keep interior uncluttered) */}
                {!isBack && pw >= 40 && ph >= 14 && (
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
            const occurrences = g.occurrences && g.occurrences.length > 0 ? g.occurrences : [];
            const pieceMap = new Map(displayPieces.map((p) => [p.id, p]));

            const renderedOccurrences: DrawnSpan[] = occurrences
              .map((occ): DrawnSpan | null => {
                const pieceA = pieceMap.get(occ.lowerPieceId);
                const pieceB = pieceMap.get(occ.upperPieceId);
                if (!pieceA || !pieceB) return null;
                const sizeA = determinePieceSpatialSize(pieceA);
                const sizeB = determinePieceSpatialSize(pieceB);

                if (occ.axis === 'x') {
                  const startX = Math.min(pieceA.positionMm.x + sizeA.x, pieceB.positionMm.x + sizeB.x);
                  const endX = Math.max(pieceA.positionMm.x, pieceB.positionMm.x);
                  if (endX <= startX) return null;
                  const bottomPiece = displayPieces.find((p) => p.role.includes('bottom'));
                  const floorY = bottomPiece ? bottomPiece.positionMm.y + determinePieceSpatialSize(bottomPiece).y : 0;
                  return {
                    axis: 'x',
                    startX,
                    endX,
                    floorY,
                  };
                }

                // Vertical span
                const startY = pieceA.positionMm.y + sizeA.y;
                const endY = pieceB.positionMm.y;
                if (endY <= startY) return null;
                const minXSpan = Math.max(pieceA.positionMm.x, pieceB.positionMm.x);
                const maxXSpan = Math.min(
                  pieceA.positionMm.x + sizeA.x,
                  pieceB.positionMm.x + sizeB.x,
                );
                return {
                  axis: 'y',
                  startY,
                  endY,
                  minXSpan,
                  maxXSpan,
                };
              })
              .filter((x): x is DrawnSpan => Boolean(x));

            const spansToDraw: DrawnSpan[] =
              renderedOccurrences.length > 0
                ? renderedOccurrences
                : (() => {
                    const shelves = displayPieces
                      .filter((p) => p.role.includes('shelf'))
                      .sort((a, b) => a.positionMm.y - b.positionMm.y);
                    const bottom = displayPieces.find((p) => p.role.includes('bottom'));
                    const top = displayPieces.find((p) => p.role.includes('top') || p.role.includes('rail'));
                    const list: DrawnSpan[] = [];

                    const horizPanels = [
                      ...(bottom ? [bottom] : []),
                      ...shelves,
                      ...(top ? [top] : []),
                    ].sort((a, b) => a.positionMm.y - b.positionMm.y);

                    for (let i = 0; i < horizPanels.length - 1; i++) {
                      const lower = horizPanels[i]!;
                      const upper = horizPanels[i + 1]!;
                      const lowerSize = determinePieceSpatialSize(lower);
                      const startY = lower.positionMm.y + lowerSize.y;
                      const endY = upper.positionMm.y;
                      const span = endY - startY;
                      if (Math.abs(span - g.clearSpanMm) <= 4.0) {
                        list.push({
                          axis: 'y',
                          startY,
                          endY,
                          minXSpan: Math.max(lower.positionMm.x, upper.positionMm.x),
                          maxXSpan: Math.min(
                            lower.positionMm.x + lowerSize.x,
                            upper.positionMm.x + determinePieceSpatialSize(upper).x,
                          ),
                        });
                      }
                    }
                    return list;
                  })();

            return (
              <g key={g.id}>
                {spansToDraw.map((span, occIdx) => {
                  if (span.axis === 'x') {
                    const spanW = span.endX - span.startX;
                    const gx = toSvgX(span.startX);
                    const gw = spanW * scale;
                    const gh = Math.min(22, Math.max(14, gw * 0.12));
                    const gy = toSvgY(span.floorY, gh / scale);
                    const dimY = gy - 12;

                    return (
                      <g key={`${g.id}-${occIdx}`}>
                        <rect
                          x={gx + 4}
                          y={gy}
                          width={Math.max(8, gw - 8)}
                          height={gh}
                          fill="url(#gauge-hatch)"
                          stroke="#2e7d32"
                          strokeWidth="1.5"
                          rx="2"
                        />
                        <rect
                          x={gx + 4}
                          y={gy}
                          width={Math.max(8, gw - 8)}
                          height={gh}
                          fill="#c8e6c9"
                          opacity="0.65"
                        />
                        <text
                          x={gx + gw / 2}
                          y={gy + gh / 2 + 3.5}
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="bold"
                          fill="#1b5e20"
                        >
                          {g.label} ({g.clearSpanMm} mm)
                        </text>
                        <line
                          x1={gx}
                          y1={dimY}
                          x2={gx + gw}
                          y2={dimY}
                          stroke="#1b5e20"
                          strokeWidth="1.5"
                          markerStart="url(#arrow)"
                          markerEnd="url(#arrow)"
                        />
                        <text
                          x={gx + gw / 2}
                          y={dimY - 4}
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="bold"
                          fill="#1b5e20"
                        >
                          {g.label}: {g.clearSpanMm} mm
                        </text>
                      </g>
                    );
                  }

                  const spanH = span.endY - span.startY;
                  const gy = toSvgY(span.startY, spanH);
                  const gh = Math.max(4, spanH * scale);
                  const spanLeftSvg = toSvgX(span.minXSpan);
                  const spanRightSvg = toSvgX(span.maxXSpan);
                  const spanWidthSvg = spanRightSvg - spanLeftSvg;
                  const blockW = Math.max(16, Math.min(26, spanWidthSvg * 0.16));

                  const leftBlockX = spanLeftSvg + 6;
                  const rightBlockX = spanRightSvg - blockW - 6;

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
  wallShelvingOutput,
  wallShelvingDefinition,
  onExportPdf,
}: AssemblySheetViewProps): ReactElement {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

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
                className="m3-button m3-button--filled"
                onClick={onExportPdf}
              >
                📄 Exportar Guía PDF
              </button>
            </div>
          )}
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
            style={{ padding: '12px', background: '#f8fafc', border: '1px solid #cbd5e1' }}
          >
            <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', color: '#0f172a' }}>
              ⚖️ Análisis de Flecha (Sagulator)
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#334155' }}>
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '4px 10px', borderRadius: '16px', background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#bae6fd', border: '1px solid #0284c7', display: 'inline-block' }}></span>
            Paneles y Estructura
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '4px 10px', borderRadius: '16px', background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#c8e6c9', border: '1px solid #2e7d32', display: 'inline-block' }}></span>
            Tiras Calibre ({assemblySheet.gauges.map((g) => g.label).join(', ') || 'N/A'})
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '4px 10px', borderRadius: '16px', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1' }}>
            <span style={{ width: '12px', height: '0px', borderTop: '2px dashed #94a3b8', display: 'inline-block' }}></span>
            Fondo Ranurado
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '4px 10px', borderRadius: '16px', background: '#f8fafc', color: '#475569', border: '1px solid #cbd5e1' }}>
            <span style={{ width: '12px', height: '0px', borderTop: '2px solid #546e7a', display: 'inline-block' }}></span>
            Cotas Generales (mm)
          </span>
        </div>
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
