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
  selectedPieceId?: string | null;
  onSelectPiece?: (pieceId: string | null) => void;
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
 * Render 2.5D Isometric Exploded Assembly Map with reference balloons (#1, #2...).
 */
function renderExplodedSvg(
  sheet: AssemblySheet,
  pieces?: (ResolvedPieceWithCutSize | ResolvedPiece)[],
  activePieceId?: string | null,
  onSelectPiece?: (id: string | null) => void,
): ReactElement {
  const width = 760;
  const height = 480;
  const cos30 = 0.866025;
  const sin30 = 0.5;

  const pieceList = pieces ?? [];
  const pieceMap = new Map(pieceList.map((p) => [p.id, p]));

  // Project 3D point (X, Y, Z) into 2.5D Isometric screen coords
  const projectIso = (x: number, y: number, z: number) => ({
    x: (x - z) * cos30,
    y: (x + z) * sin30 - y,
  });

  // Collect projected vertices for all exploded pieces to calculate scale and bounding box
  interface ProjectedPiece {
    item: (typeof sheet.explodedMap)[0];
    vertices: { x: number; y: number }[];
    centerIso: { x: number; y: number };
    depthKey: number;
    spatialSize: { x: number; y: number; z: number };
  }

  const projectedPieces: ProjectedPiece[] = [];
  let minIsoX = Infinity, maxIsoX = -Infinity;
  let minIsoY = Infinity, maxIsoY = -Infinity;

  for (const expItem of sheet.explodedMap) {
    const origPiece = pieceMap.get(expItem.pieceId);
    const origPos = origPiece?.positionMm ?? { x: 0, y: 0, z: 0 };
    const spatialSize = origPiece
      ? determinePieceSpatialSize(origPiece)
      : { x: expItem.dimensionsMm.width, y: expItem.dimensionsMm.height, z: expItem.dimensionsMm.thickness };

    const posX = origPos.x + expItem.displacementOffsetMm.x;
    const posY = origPos.y + expItem.displacementOffsetMm.y;
    const posZ = origPos.z + expItem.displacementOffsetMm.z;

    const sx = Math.max(12, spatialSize.x);
    const sy = Math.max(12, spatialSize.y);
    const sz = Math.max(12, spatialSize.z);

    // 8 vertices in isometric space
    const v0 = projectIso(posX, posY, posZ);
    const v1 = projectIso(posX + sx, posY, posZ);
    const v2 = projectIso(posX + sx, posY + sy, posZ);
    const v3 = projectIso(posX, posY + sy, posZ);
    const v4 = projectIso(posX, posY, posZ + sz);
    const v5 = projectIso(posX + sx, posY, posZ + sz);
    const v6 = projectIso(posX + sx, posY + sy, posZ + sz);
    const v7 = projectIso(posX, posY + sy, posZ + sz);

    const verts = [v0, v1, v2, v3, v4, v5, v6, v7];
    for (const v of verts) {
      minIsoX = Math.min(minIsoX, v.x);
      maxIsoX = Math.max(maxIsoX, v.x);
      minIsoY = Math.min(minIsoY, v.y);
      maxIsoY = Math.max(maxIsoY, v.y);
    }

    const centerIso = projectIso(posX + sx / 2, posY + sy / 2, posZ + sz / 2);
    // Painter's algorithm depth sorting key
    const depthKey = (posX + sx / 2) + (posZ + sz / 2) - (posY + sy / 2);

    projectedPieces.push({
      item: expItem,
      vertices: verts,
      centerIso,
      depthKey,
      spatialSize,
    });
  }

  // Sort back-to-front
  projectedPieces.sort((a, b) => a.depthKey - b.depthKey);

  const spanX = Math.max(1, maxIsoX - minIsoX);
  const spanY = Math.max(1, maxIsoY - minIsoY);
  const marginX = 65;
  const marginY = 55;
  const drawW = width - 2 * marginX;
  const drawH = height - 2 * marginY;
  const scale = Math.min(drawW / spanX, drawH / spanY);

  const toSvgX = (isoX: number) => marginX + (isoX - minIsoX) * scale + (drawW - spanX * scale) / 2;
  const toSvgY = (isoY: number) => marginY + (isoY - minIsoY) * scale + (drawH - spanY * scale) / 2;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="assembly-svg assembly-exploded-svg"
      style={{
        width: '100%',
        height: 'auto',
        maxHeight: '480px',
        background: 'var(--surface, #ffffff)',
        borderRadius: '12px',
        border: '1px solid var(--border, #d9d2c3)',
      }}
      aria-label="Mapa axonométrico de vista explotada con referencias numeradas"
    >
      <defs>
        <pattern id="exploded-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="var(--border, #d9d2c3)" opacity="0.4" />
        </pattern>
      </defs>

      <rect width={width} height={height} fill="url(#exploded-grid)" />

      {/* Pieces Isometric Projection */}
      {projectedPieces.map((p) => {
        const isSelected = activePieceId === p.item.pieceId;
        const [, v1, v2, v3, v4, v5, v6, v7] = p.vertices;

        const sv1 = { x: toSvgX(v1!.x), y: toSvgY(v1!.y) };
        const sv2 = { x: toSvgX(v2!.x), y: toSvgY(v2!.y) };
        const sv3 = { x: toSvgX(v3!.x), y: toSvgY(v3!.y) };
        const sv4 = { x: toSvgX(v4!.x), y: toSvgY(v4!.y) };
        const sv5 = { x: toSvgX(v5!.x), y: toSvgY(v5!.y) };
        const sv6 = { x: toSvgX(v6!.x), y: toSvgY(v6!.y) };
        const sv7 = { x: toSvgX(v7!.x), y: toSvgY(v7!.y) };

        // Front Face (Z+): v4, v5, v6, v7
        const frontPoints = `${sv4.x},${sv4.y} ${sv5.x},${sv5.y} ${sv6.x},${sv6.y} ${sv7.x},${sv7.y}`;
        // Top Face (Y+): v7, v6, v2, v3
        const topPoints = `${sv7.x},${sv7.y} ${sv6.x},${sv6.y} ${sv2.x},${sv2.y} ${sv3.x},${sv3.y}`;
        // Right Face (X+): v5, v1, v2, v6
        const rightPoints = `${sv5.x},${sv5.y} ${sv1.x},${sv1.y} ${sv2.x},${sv2.y} ${sv6.x},${sv6.y}`;

        const frontFill = isSelected ? 'var(--primary, #56705f)' : 'var(--surface-2, #ede8dc)';
        const topFill = isSelected ? 'var(--primary-hover, #465c4e)' : '#f6f3ec';
        const rightFill = isSelected ? 'var(--primary-hover, #465c4e)' : '#dfd8c8';
        const strokeColor = isSelected ? 'var(--primary, #56705f)' : 'var(--text-muted, #5c655f)';

        // Center of front face for balloon
        const fcX = (sv4.x + sv6.x) / 2;
        const fcY = (sv4.y + sv6.y) / 2;

        // Balloon position offset
        const isLeftSide = p.item.role.includes('side-left') || p.item.role.includes('1');
        const bX = isLeftSide ? fcX - 42 : fcX + 42;
        const bY = fcY - 26;

        return (
          <g
            key={p.item.pieceId}
            style={{ cursor: 'pointer' }}
            onClick={() => onSelectPiece && onSelectPiece(isSelected ? null : p.item.pieceId)}
          >
            {/* Top Face */}
            <polygon points={topPoints} fill={topFill} stroke={strokeColor} strokeWidth="1" />
            {/* Right Face */}
            <polygon points={rightPoints} fill={rightFill} stroke={strokeColor} strokeWidth="1" />
            {/* Front Face */}
            <polygon
              points={frontPoints}
              fill={frontFill}
              stroke={strokeColor}
              strokeWidth="1.2"
              fillOpacity={p.item.role.includes('back') ? 0.6 : 0.95}
            />

            {/* Edge Banding Highlight (Front Edge) in Latón Brass */}
            <line
              x1={sv7.x}
              y1={sv7.y}
              x2={sv6.x}
              y2={sv6.y}
              stroke="var(--accent, #b08a3e)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Leader line to balloon */}
            <line
              x1={fcX}
              y1={fcY}
              x2={bX}
              y2={bY}
              stroke="var(--accent, #b08a3e)"
              strokeWidth="1.2"
              strokeDasharray="2 2"
            />

            {/* Reference Number Balloon */}
            <circle
              cx={bX}
              cy={bY}
              r="13"
              fill={isSelected ? 'var(--primary, #56705f)' : 'var(--surface, #ffffff)'}
              stroke={isSelected ? 'var(--primary-hover, #465c4e)' : 'var(--border, #d9d2c3)'}
              strokeWidth={isSelected ? '2' : '1.5'}
            />
            <text
              x={bX}
              y={bY + 3.8}
              textAnchor="middle"
              fontSize="10"
              fontWeight="bold"
              fill={isSelected ? '#ffffff' : 'var(--text, #1f2622)'}
            >
              #{p.item.referenceNumber}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Render technical 2D shop drawing for a specific panel pre-machining detail.
 */
function renderPanelDetailSvg(
  panel: AssemblySheet['panelDetails'][0],
): ReactElement {
  const width = 680;
  const height = 340;
  const marginL = 70;
  const marginR = 50;
  const marginT = 40;
  const marginB = 55;

  const drawW = width - marginL - marginR;
  const drawH = height - marginT - marginB;

  const pW = panel.dimensionsMm.width;
  const pH = panel.dimensionsMm.height;
  const scale = Math.min(drawW / Math.max(1, pW), drawH / Math.max(1, pH));

  const actualW = pW * scale;
  const actualH = pH * scale;

  const originX = marginL + (drawW - actualW) / 2;
  const originY = marginT + actualH + (drawH - actualH) / 2; // Bottom origin Y

  // Coordinate conversion from Datum (0,0): X from front (left), Y from bottom (upwards)
  const toSvgX = (xMm: number) => originX + xMm * scale;
  const toSvgY = (yMm: number) => originY - yMm * scale;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="assembly-svg panel-detail-svg"
      style={{
        width: '100%',
        height: 'auto',
        maxHeight: '340px',
        background: 'var(--surface, #ffffff)',
        borderRadius: '12px',
        border: '1px solid var(--border, #d9d2c3)',
      }}
      aria-label={`Plano técnico de pre-mecanizado para ${panel.name}`}
    >
      <defs>
        <marker id="arrow-datum" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--danger, #b3412f)" />
        </marker>
        <marker id="arrow-dim-panel" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--primary, #56705f)" />
        </marker>
      </defs>

      {/* Panel Outline Rectangle */}
      <rect
        x={originX}
        y={originY - actualH}
        width={actualW}
        height={actualH}
        fill="var(--surface-2, #ede8dc)"
        stroke="var(--text, #1f2622)"
        strokeWidth="1.5"
        rx="2"
      />

      {/* Front edge banding highlight (latón) */}
      <line
        x1={originX}
        y1={originY - actualH}
        x2={originX}
        y2={originY}
        stroke="var(--accent, #b08a3e)"
        strokeWidth="3.5"
      />

      {/* Datum (0,0) Origin Mark */}
      <circle cx={originX} cy={originY} r="5" fill="var(--danger, #b3412f)" />
      <line x1={originX - 12} y1={originY} x2={originX + 24} y2={originY} stroke="var(--danger, #b3412f)" strokeWidth="1.5" />
      <line x1={originX} y1={originY + 12} x2={originX} y2={originY - 24} stroke="var(--danger, #b3412f)" strokeWidth="1.5" />
      <text x={originX + 8} y={originY + 18} fontSize="9" fontWeight="bold" fill="var(--danger, #b3412f)">
        Datum (0,0) Frente-Base
      </text>

      {/* Panel Outer Dimension Lines */}
      {/* Width dimension (Bottom) */}
      <line
        x1={originX}
        y1={originY + 28}
        x2={originX + actualW}
        y2={originY + 28}
        stroke="var(--text-muted, #5c655f)"
        strokeWidth="1"
        markerStart="url(#arrow-dim-panel)"
        markerEnd="url(#arrow-dim-panel)"
      />
      <text x={originX + actualW / 2} y={originY + 40} textAnchor="middle" fontSize="10" fontWeight="bold" fill="var(--text, #1f2622)">
        Ancho: {pW} mm
      </text>

      {/* Height dimension (Left) */}
      <line
        x1={originX - 28}
        y1={originY}
        x2={originX - 28}
        y2={originY - actualH}
        stroke="var(--text-muted, #5c655f)"
        strokeWidth="1"
        markerStart="url(#arrow-dim-panel)"
        markerEnd="url(#arrow-dim-panel)"
      />
      <text
        x={originX - 34}
        y={originY - actualH / 2}
        textAnchor="middle"
        fontSize="10"
        fontWeight="bold"
        fill="var(--text, #1f2622)"
        transform={`rotate(-90 ${originX - 34} ${originY - actualH / 2})`}
      >
        Alto: {pH} mm
      </text>

      {/* Operations (Drills, Slide tracks, Hinge bases) */}
      {panel.operations.map((op, idx) => {
        const ox = toSvgX(op.xFromFrontMm);
        const oy = toSvgY(op.yFromBottomMm);
        const isSlide = op.hardwareType.includes('slide') || op.description.toLowerCase().includes('corredera');

        if (isSlide) {
          return (
            <g key={idx}>
              <line
                x1={originX}
                y1={oy}
                x2={originX + actualW}
                y2={oy}
                stroke="var(--primary, #56705f)"
                strokeWidth="1.8"
                strokeDasharray="4 3"
              />
              <circle cx={ox} cy={oy} r="3.5" fill="var(--primary, #56705f)" />
              <text x={originX + 10} y={oy - 4} fontSize="9" fontWeight="bold" fill="var(--primary, #56705f)">
                Guía corredera Y = {op.yFromBottomMm} mm
              </text>
            </g>
          );
        }

        return (
          <g key={idx}>
            <circle
              cx={ox}
              cy={oy}
              r="3.5"
              fill="var(--accent, #b08a3e)"
              stroke="var(--text, #1f2622)"
              strokeWidth="0.8"
            />
            <line x1={ox - 5} y1={oy} x2={ox + 5} y2={oy} stroke="var(--text, #1f2622)" strokeWidth="0.8" />
            <line x1={ox} y1={oy - 5} x2={ox} y2={oy + 5} stroke="var(--text, #1f2622)" strokeWidth="0.8" />
            <text x={ox + 6} y={oy + 3} fontSize="8" fill="var(--text, #1f2622)">
              Y={op.yFromBottomMm} (X={op.xFromFrontMm})
            </text>
          </g>
        );
      })}
    </svg>
  );
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

  const nonAuxPieces = (pieces ?? []).filter((p) => !p.isAuxiliary);
  const structuralPieces = nonAuxPieces.filter(
    (p) =>
      !p.role.includes('door') &&
      !p.role.includes('bifold') &&
      !p.role.includes('drawer-front') &&
      !p.role.includes('drawer-box'),
  );

  const displayPieces = structuralPieces.length > 0 ? structuralPieces : nonAuxPieces;
  const backPieces = displayPieces.filter((p) => p.role.includes('back'));
  const frontPieces = displayPieces.filter((p) => !p.role.includes('back'));
  const sortedDisplayPieces = [...backPieces, ...frontPieces];

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

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

  const toSvgX = (mmX: number) => originX + (mmX - (hasRealPieces ? minX : 0)) * scale;
  const toSvgY = (mmY: number, sizeH: number) => originY + (modH - (mmY - (hasRealPieces ? minY : 0) + sizeH)) * scale;

  const gauges = sheet.gauges;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="assembly-svg"
      style={{
        width: '100%',
        height: 'auto',
        maxHeight: '460px',
        background: 'var(--surface, #ffffff)',
        borderRadius: '12px',
        border: '1px solid var(--border, #d9d2c3)',
      }}
      aria-label="Esquema de elevación del casco y calibres de taller"
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--success, #3f7d4e)" />
        </marker>
        <marker id="arrow-dim" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--primary, #56705f)" />
        </marker>
        <pattern id="gauge-hatch" width="8" height="8" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="8" stroke="var(--success, #3f7d4e)" strokeWidth="2" />
        </pattern>
      </defs>

      {/* Render Real Pieces */}
      {hasRealPieces ? (
        <g id="carcass-pieces">
          {sortedDisplayPieces.map((p) => {
            const pos = p.positionMm ?? { x: 0, y: 0, z: 0 };
            const size = determinePieceSpatialSize(p);
            const px = toSvgX(pos.x);
            const py = toSvgY(pos.y, size.y);
            const pw = Math.max(1.5, size.x * scale);
            const ph = Math.max(1.5, size.y * scale);

            const isShelf = p.role.includes('shelf');
            const isBottom = p.role.includes('bottom');
            const isTopOrRail = p.role.includes('top') || p.role.includes('rail');
            const isBack = p.role.includes('back');

            let fill = 'var(--surface-2, #ede8dc)';
            let stroke = 'var(--text-muted, #5c655f)';
            let strokeDasharray: string | undefined;

            if (isShelf) {
              fill = 'var(--primary, #56705f)';
              stroke = 'var(--primary-hover, #465c4e)';
            } else if (isBack) {
              fill = 'var(--surface, #ffffff)';
              stroke = 'var(--border, #d9d2c3)';
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
                  fillOpacity={isBack ? 0.5 : 1}
                  stroke={stroke}
                  strokeWidth="1.2"
                  strokeDasharray={strokeDasharray}
                  rx="1"
                />
                {!isBack && pw >= 38 && ph >= 14 && (
                  <text
                    x={px + pw / 2}
                    y={py + ph / 2 + 3.5}
                    textAnchor="middle"
                    fontSize="9"
                    fill={isShelf ? '#ffffff' : 'var(--text, #1f2622)'}
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
        <g id="carcass-fallback">
          <rect x={originX} y={originY} width={12} height={actualDrawH} fill="var(--surface-2, #ede8dc)" stroke="var(--border, #d9d2c3)" strokeWidth="1.5" />
          <rect x={originX + actualDrawW - 12} y={originY} width={12} height={actualDrawH} fill="var(--surface-2, #ede8dc)" stroke="var(--border, #d9d2c3)" strokeWidth="1.5" />
          <rect x={originX + 12} y={originY + actualDrawH - 12} width={actualDrawW - 24} height={12} fill="var(--surface-2, #ede8dc)" stroke="var(--border, #d9d2c3)" strokeWidth="1.5" />
          <rect x={originX + 12} y={originY} width={actualDrawW - 24} height={12} fill="var(--surface-2, #ede8dc)" stroke="var(--border, #d9d2c3)" strokeWidth="1.5" />
        </g>
      )}

      {/* Assembly Gauges Placement */}
      {gauges.length > 0 && (
        <g id="assembly-gauges">
          {gauges.map((g) => {
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

                const startY = pieceA.positionMm.y + sizeA.y;
                const endY = pieceB.positionMm.y;
                if (endY <= startY) return null;
                const minXSpan = Math.max(pieceA.positionMm.x, pieceB.positionMm.x);
                const maxXSpan = Math.min(pieceA.positionMm.x + sizeA.x, pieceB.positionMm.x + sizeB.x);
                if (maxXSpan <= minXSpan) return null;

                return {
                  axis: 'y',
                  startY,
                  endY,
                  minXSpan,
                  maxXSpan,
                };
              })
              .filter((span): span is DrawnSpan => Boolean(span));

            return (
              <g key={g.id}>
                {renderedOccurrences.map((occ, occIdx) => {
                  if (occ.axis === 'x') {
                    const sx = toSvgX(occ.startX);
                    const ex = toSvgX(occ.endX);
                    const sy = toSvgY(occ.floorY, 0);
                    const sw = ex - sx;
                    const sh = Math.max(6, g.widthMm * scale);

                    return (
                      <g key={occIdx}>
                        <rect
                          x={sx + (sw - sw * 0.7) / 2}
                          y={sy - sh}
                          width={sw * 0.7}
                          height={sh}
                          fill="url(#gauge-hatch)"
                          stroke="var(--success, #3f7d4e)"
                          strokeWidth="1.2"
                          rx="2"
                        />
                        <text
                          x={sx + sw / 2}
                          y={sy - sh / 2 + 3}
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight="bold"
                          fill="var(--success, #3f7d4e)"
                        >
                          {g.label} ({g.clearSpanMm} mm)
                        </text>
                      </g>
                    );
                  }

                  const startY = toSvgY(occ.startY, 0);
                  const endY = toSvgY(occ.endY, 0);
                  const spanH = Math.abs(endY - startY);
                  const midY = (startY + endY) / 2;
                  const leftColX = toSvgX(occ.minXSpan) + 8;
                  const rightColX = toSvgX(occ.maxXSpan) - 8 - Math.max(6, g.widthMm * scale);
                  const stripW = Math.max(6, Math.min(18, g.widthMm * scale));

                  return (
                    <g key={occIdx}>
                      <rect
                        x={leftColX}
                        y={Math.min(startY, endY)}
                        width={stripW}
                        height={spanH}
                        fill="url(#gauge-hatch)"
                        stroke="var(--success, #3f7d4e)"
                        strokeWidth="1"
                        rx="1"
                      />
                      <rect
                        x={rightColX}
                        y={Math.min(startY, endY)}
                        width={stripW}
                        height={spanH}
                        fill="url(#gauge-hatch)"
                        stroke="var(--success, #3f7d4e)"
                        strokeWidth="1"
                        rx="1"
                      />
                      <line
                        x1={leftColX + stripW + 4}
                        y1={midY}
                        x2={rightColX - 4}
                        y2={midY}
                        stroke="var(--success, #3f7d4e)"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                        markerStart="url(#arrow)"
                        markerEnd="url(#arrow)"
                      />
                      <text
                        x={(leftColX + rightColX) / 2}
                        y={midY - 4}
                        textAnchor="middle"
                        fontSize="9"
                        fontWeight="bold"
                        fill="var(--success, #3f7d4e)"
                      >
                        Calibre {g.label}: {g.clearSpanMm} mm
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </g>
      )}

      {/* Outer Overall Dimensions */}
      <line
        x1={originX}
        y1={originY + actualDrawH + 18}
        x2={originX + actualDrawW}
        y2={originY + actualDrawH + 18}
        stroke="var(--primary, #56705f)"
        strokeWidth="1.2"
        markerStart="url(#arrow-dim)"
        markerEnd="url(#arrow-dim)"
      />
      <text
        x={originX + actualDrawW / 2}
        y={originY + actualDrawH + 32}
        textAnchor="middle"
        fontSize="10"
        fontWeight="bold"
        fill="var(--text, #1f2622)"
      >
        Ancho Total: {modW} mm
      </text>

      <line
        x1={originX + actualDrawW + 20}
        y1={originY}
        x2={originX + actualDrawW + 20}
        y2={originY + actualDrawH}
        stroke="var(--primary, #56705f)"
        strokeWidth="1.2"
        markerStart="url(#arrow-dim)"
        markerEnd="url(#arrow-dim)"
      />
      <text
        x={originX + actualDrawW + 36}
        y={originY + actualDrawH / 2}
        textAnchor="middle"
        fontSize="10"
        fontWeight="bold"
        fill="var(--text, #1f2622)"
        transform={`rotate(-90 ${originX + actualDrawW + 36} ${originY + actualDrawH / 2})`}
      >
        Alto Total: {modH} mm
      </text>
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
  selectedPieceId,
  onSelectPiece,
}: AssemblySheetViewProps): ReactElement {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [activeTab, setActiveTab] = useState<'all' | 'exploded' | 'panels' | 'gauges' | 'steps'>('all');
  const [selectedPanelIndex, setSelectedPanelIndex] = useState<number>(0);
  const [activeStepNumber, setActiveStepNumber] = useState<number | null>(null);

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
          style={{
            marginTop: '16px',
            overflowX: 'auto',
            background: 'var(--surface, #ffffff)',
            borderRadius: '8px',
            padding: '8px',
            border: '1px solid var(--border, #e2e8f0)',
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
        <span style={{ fontSize: '0.85rem', color: 'var(--danger, #b3412f)', fontWeight: 'bold' }}>
          📐 Diagonal de Escuadra: {assemblySheet.squaringDiagonalMm} mm (±1 mm)
        </span>
        <span style={{ color: 'var(--border, #d9d2c3)' }}>|</span>
        <span style={{ fontSize: '0.85rem', color: 'var(--primary, #56705f)', fontWeight: 'bold' }}>
          🧩 Piezas: {assemblySheet.explodedMap.length}
        </span>
      </div>

      {/* Navigation Sub-view Filter Chips */}
      <div
        className="assembly-view-switcher"
        style={{
          display: 'flex',
          gap: '8px',
          marginTop: '16px',
          overflowX: 'auto',
          paddingBottom: '4px',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`m3-btn m3-btn--small ${activeTab === 'all' ? 'm3-btn--filled' : 'm3-btn--outlined'}`}
          style={{ minHeight: '44px' }}
        >
          👁️ Vista Completa
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('exploded')}
          className={`m3-btn m3-btn--small ${activeTab === 'exploded' ? 'm3-btn--filled' : 'm3-btn--outlined'}`}
          style={{ minHeight: '44px' }}
        >
          🗺️ Vista Explotada (#1, #2...)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('panels')}
          className={`m3-btn m3-btn--small ${activeTab === 'panels' ? 'm3-btn--filled' : 'm3-btn--outlined'}`}
          style={{ minHeight: '44px' }}
        >
          🔍 Detalle de Paneles (Datum X, Y)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('gauges')}
          className={`m3-btn m3-btn--small ${activeTab === 'gauges' ? 'm3-btn--filled' : 'm3-btn--outlined'}`}
          style={{ minHeight: '44px' }}
        >
          📏 Calibres y Vanos ({assemblySheet.gauges.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('steps')}
          className={`m3-btn m3-btn--small ${activeTab === 'steps' ? 'm3-btn--filled' : 'm3-btn--outlined'}`}
          style={{ minHeight: '44px' }}
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

          {renderExplodedSvg(assemblySheet, pieces, selectedPieceId, onSelectPiece)}

          {/* Parts reference summary table */}
          <div style={{ marginTop: '12px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2, #ede8dc)', borderBottom: '1px solid var(--border, #d9d2c3)' }}>
                  <th style={{ padding: '8px 10px' }}>#Ref</th>
                  <th style={{ padding: '8px 10px' }}>Pieza / Rol</th>
                  <th style={{ padding: '8px 10px' }}>Corte (W × H × Esp)</th>
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
                        background: isSel ? 'var(--primary-container, #d8e4dc)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '8px 10px', fontWeight: 'bold' }}>
                        <span style={{ display: 'inline-block', width: '24px', height: '24px', lineHeight: '24px', textAlign: 'center', borderRadius: '50%', background: isSel ? 'var(--primary, #56705f)' : 'var(--border, #d9d2c3)', color: isSel ? '#ffffff' : 'var(--text, #1f2622)' }}>
                          {p.referenceNumber}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px' }}><strong>{p.name}</strong> ({p.pieceId})</td>
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
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '12px' }}>
            {assemblySheet.panelDetails.map((p, idx) => (
              <button
                key={p.pieceId}
                type="button"
                onClick={() => setSelectedPanelIndex(idx)}
                className={`m3-btn m3-btn--small ${selectedPanelIndex === idx ? 'm3-btn--filled' : 'm3-btn--outlined'}`}
                style={{ minHeight: '40px' }}
              >
                #{p.referenceNumber} {p.name}
              </button>
            ))}
          </div>

          {selectedPanel && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.4fr) minmax(280px, 1fr)', gap: '16px', alignItems: 'start' }}>
              <div>
                {renderPanelDetailSvg(selectedPanel)}
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
                  {selectedPanel.dimensionsMm.width} × {selectedPanel.dimensionsMm.height} × {selectedPanel.dimensionsMm.thickness} mm
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
            {renderAssemblySvg(assemblySheet, pieces)}
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
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleStep(step.stepNumber);
                    }}
                    style={{
                      marginTop: '3px',
                      cursor: 'pointer',
                      accentColor: 'var(--primary, #56705f)',
                      width: '20px',
                      height: '20px',
                      flexShrink: 0,
                    }}
                    aria-label={`Marcar paso ${step.stepNumber} como completado`}
                  />

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
                        {step.phase.toUpperCase()}
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
    </section>
  );
}
