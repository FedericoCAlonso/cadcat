import type { ReactElement } from 'react';
import {
  type AssemblySheet,
  type ResolvedPiece,
  type ResolvedPieceWithCutSize,
  determinePieceSpatialSize,
} from '../../resolver';
import { DEFAULT_UI_CONFIG } from '../../config';
import {
  resolveNonOverlappingLabels,
  type RawOperationLabel,
  type PositionedOperationLabel,
} from '../viewer/labelLayout';

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
 * Render 2.5D Axonometric Exploded Assembly Map with reference balloons (#1, #2...),
 * assembly trajectories, step sequence filtering, and multi-angle axonometric projections.
 */
export function renderExplodedSvg(
  sheet: AssemblySheet,
  pieces: (ResolvedPieceWithCutSize | ResolvedPiece)[] | undefined,
  activePieceId: string | null | undefined,
  onSelectPiece: ((id: string | null) => void) | undefined,
  explosionRatio: number,
  viewAngle: 'iso-right' | 'iso-left' | 'top' | 'front',
  showTrajectories: boolean,
  showBalloons: boolean,
  showEdgeBanding: boolean,
  activeFilterStep: number | null,
): ReactElement {
  const width = 840;
  const height = 520;
  const cos30 = 0.866025;
  const sin30 = 0.5;

  const pieceList = pieces ?? [];
  const pieceMap = new Map(pieceList.map((p) => [p.id, p]));

  const project = (x: number, y: number, z: number) => {
    switch (viewAngle) {
      case 'iso-left':
        return {
          x: (x + z) * cos30,
          y: (z - x) * sin30 - y,
        };
      case 'top':
        return {
          x: x - z * 0.35,
          y: z * 0.75 - y * 0.25,
        };
      case 'front':
        return {
          x: x + z * 0.22,
          y: -y - z * 0.16,
        };
      case 'iso-right':
      default:
        return {
          x: (x - z) * cos30,
          y: (x + z) * sin30 - y,
        };
    }
  };

  const currentStep =
    activeFilterStep !== null
      ? sheet.steps.find((s) => s.stepNumber === activeFilterStep) ?? null
      : null;

  const isStepPiece = (pieceId: string) => {
    if (!currentStep) return true;
    return currentStep.piecesInvolved.includes(pieceId);
  };

  // Base displacement distance scaled by ratio
  const baseDist = 170 * explosionRatio;
  const modH = sheet.moduleDimensionsMm.height || 800;

  interface ProjectedPiece {
    item: (typeof sheet.explodedMap)[0];
    vertices: { x: number; y: number }[];
    origSvg: { x: number; y: number };
    centerSvg: { x: number; y: number };
    depthKey: number;
    spatialSize: { x: number; y: number; z: number };
    isStepActive: boolean;
  }

  let minIsoX = Infinity, maxIsoX = -Infinity;
  let minIsoY = Infinity, maxIsoY = -Infinity;

  interface IntermediatePiece {
    item: (typeof sheet.explodedMap)[0];
    origCenterIso: { x: number; y: number };
    expCenterIso: { x: number; y: number };
    vertsIso: { x: number; y: number }[];
    depthKey: number;
    spatialSize: { x: number; y: number; z: number };
    isStepActive: boolean;
  }

  const intermediatePieces: IntermediatePiece[] = [];

  for (const expItem of sheet.explodedMap) {
    const origPiece = pieceMap.get(expItem.pieceId);
    const origPos = origPiece?.positionMm ?? { x: 0, y: 0, z: 0 };
    const spatialSize = origPiece
      ? determinePieceSpatialSize(origPiece)
      : { x: expItem.dimensionsMm.width, y: expItem.dimensionsMm.height, z: expItem.dimensionsMm.thickness };

    const r = expItem.role.toLowerCase();
    let dx = 0, dy = 0, dz = 0;

    if (r.includes('side-left') || (r.includes('side') && r.includes('1') && !r.includes('box'))) {
      dx = -baseDist * 1.35;
    } else if (r.includes('side-right') || (r.includes('side') && r.includes('2') && !r.includes('box'))) {
      dx = baseDist * 1.35;
    } else if (r.includes('bottom') && !r.includes('box')) {
      dy = -baseDist * 1.15;
    } else if (r.includes('top') || r.includes('roof')) {
      dy = baseDist * 1.15;
    } else if (r.includes('rail-front')) {
      dy = baseDist * 0.95;
      dz = -baseDist * 0.7;
    } else if (r.includes('rail-back')) {
      dy = baseDist * 0.95;
      dz = baseDist * 0.7;
    } else if (r.includes('rail')) {
      dy = baseDist * 0.95;
    } else if (r.includes('back') && !r.includes('box')) {
      dz = -baseDist * 1.6;
    } else if (r.includes('door')) {
      dz = baseDist * 2.1;
      if (r.includes('left') || r.includes('1')) dx = -baseDist * 0.35;
      if (r.includes('right') || r.includes('2')) dx = baseDist * 0.35;
    } else if (r.includes('drawer-front')) {
      dz = baseDist * 2.3;
    } else if (r.includes('drawer-box') || r.includes('box-')) {
      const forwardDist = baseDist * 1.8;
      dz = forwardDist;
      if (r.includes('side-left') || r.includes('box-side-l')) dx = -baseDist * 0.45;
      else if (r.includes('side-right') || r.includes('box-side-r')) dx = baseDist * 0.45;
      else if (r.includes('bottom') || r.includes('box-bottom')) dy = -baseDist * 0.35;
      else if (r.includes('back') || r.includes('box-back')) dz = forwardDist - baseDist * 0.45;
    } else if (r.includes('shelf')) {
      const isUpper = (origPos.y + spatialSize.y / 2) > modH / 2;
      dy = (isUpper ? 0.4 : -0.4) * baseDist;
      dz = baseDist * 0.3;
    } else if (r.includes('partition')) {
      dz = baseDist * 0.35;
    } else if (r.includes('plinth')) {
      dy = -baseDist * 1.7;
    } else {
      const cx = sheet.moduleDimensionsMm.width / 2;
      const cy = sheet.moduleDimensionsMm.height / 2;
      const cz = sheet.moduleDimensionsMm.depth / 2;
      const vx = (origPos.x + spatialSize.x / 2) - cx;
      const vy = (origPos.y + spatialSize.y / 2) - cy;
      const vz = (origPos.z + spatialSize.z / 2) - cz;
      const len = Math.hypot(vx, vy, vz) || 1;
      dx = (vx / len) * baseDist;
      dy = (vy / len) * baseDist;
      dz = (vz / len) * baseDist;
    }

    const posX = origPos.x + dx;
    const posY = origPos.y + dy;
    const posZ = origPos.z + dz;

    const sx = Math.max(12, spatialSize.x);
    const sy = Math.max(12, spatialSize.y);
    const sz = Math.max(12, spatialSize.z);

    const v0 = project(posX, posY, posZ);
    const v1 = project(posX + sx, posY, posZ);
    const v2 = project(posX + sx, posY + sy, posZ);
    const v3 = project(posX, posY + sy, posZ);
    const v4 = project(posX, posY, posZ + sz);
    const v5 = project(posX + sx, posY, posZ + sz);
    const v6 = project(posX + sx, posY + sy, posZ + sz);
    const v7 = project(posX, posY + sy, posZ + sz);
    const vertsIso = [v0, v1, v2, v3, v4, v5, v6, v7];

    for (const v of vertsIso) {
      minIsoX = Math.min(minIsoX, v.x);
      maxIsoX = Math.max(maxIsoX, v.x);
      minIsoY = Math.min(minIsoY, v.y);
      maxIsoY = Math.max(maxIsoY, v.y);
    }

    const origCenterIso = project(origPos.x + sx / 2, origPos.y + sy / 2, origPos.z + sz / 2);
    const expCenterIso = project(posX + sx / 2, posY + sy / 2, posZ + sz / 2);

    minIsoX = Math.min(minIsoX, origCenterIso.x);
    maxIsoX = Math.max(maxIsoX, origCenterIso.x);
    minIsoY = Math.min(minIsoY, origCenterIso.y);
    maxIsoY = Math.max(maxIsoY, origCenterIso.y);

    const cX = posX + sx / 2;
    const cY = posY + sy / 2;
    const cZ = posZ + sz / 2;
    let depthKey = 0;
    switch (viewAngle) {
      case 'iso-left':
        depthKey = -cX + cZ - cY;
        break;
      case 'top':
        depthKey = cY;
        break;
      case 'front':
        depthKey = cZ;
        break;
      case 'iso-right':
      default:
        depthKey = cX + cZ - cY;
        break;
    }

    intermediatePieces.push({
      item: expItem,
      origCenterIso,
      expCenterIso,
      vertsIso,
      depthKey,
      spatialSize,
      isStepActive: isStepPiece(expItem.pieceId),
    });
  }

  intermediatePieces.sort((a, b) => a.depthKey - b.depthKey);

  const spanX = Math.max(1, maxIsoX - minIsoX);
  const spanY = Math.max(1, maxIsoY - minIsoY);
  const marginX = 95;
  const marginY = 75;
  const drawW = width - 2 * marginX;
  const drawH = height - 2 * marginY;
  const scale = Math.min(drawW / spanX, drawH / spanY);

  const toSvgX = (isoX: number) => marginX + (isoX - minIsoX) * scale + (drawW - spanX * scale) / 2;
  const toSvgY = (isoY: number) => marginY + (isoY - minIsoY) * scale + (drawH - spanY * scale) / 2;

  const projectedPieces: ProjectedPiece[] = intermediatePieces.map((p) => ({
    item: p.item,
    vertices: p.vertsIso.map((v) => ({ x: toSvgX(v.x), y: toSvgY(v.y) })),
    origSvg: { x: toSvgX(p.origCenterIso.x), y: toSvgY(p.origCenterIso.y) },
    centerSvg: { x: toSvgX(p.expCenterIso.x), y: toSvgY(p.expCenterIso.y) },
    depthKey: p.depthKey,
    spatialSize: p.spatialSize,
    isStepActive: p.isStepActive,
  }));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="assembly-svg assembly-exploded-svg"
      style={{
        width: '100%',
        height: 'auto',
        maxHeight: '520px',
        background: 'var(--surface, #ffffff)',
        borderRadius: '12px',
        border: '1px solid var(--border, #d9d2c3)',
        userSelect: 'none',
      }}
      aria-label="Mapa axonométrico de vista explotada con referencias numeradas"
    >
      <defs>
        <pattern id="exploded-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="var(--border, #d9d2c3)" opacity="0.4" />
        </pattern>
      </defs>

      <rect width={width} height={height} fill="url(#exploded-grid)" />

      {/* 1. Trajectory Lines Layer (Behind pieces) */}
      {showTrajectories && explosionRatio > 0.05 && (
        <g className="assembly-trajectories" opacity={0.85}>
          {projectedPieces.map((p) => {
            if (!p.isStepActive) return null;
            const isSel = activePieceId === p.item.pieceId;
            const dist = Math.hypot(p.centerSvg.x - p.origSvg.x, p.centerSvg.y - p.origSvg.y);
            if (dist < 10) return null;

            const trajColor = isSel ? 'var(--primary, #56705f)' : 'var(--accent, #b08a3e)';
            const trajWidth = isSel ? 2.2 : 1.2;

            return (
              <g key={`traj-${p.item.pieceId}`}>
                {/* Docking anchor circle at assembled destination */}
                <circle
                  cx={p.origSvg.x}
                  cy={p.origSvg.y}
                  r={isSel ? 4 : 2.5}
                  fill={trajColor}
                  stroke="var(--surface, #ffffff)"
                  strokeWidth="1"
                />
                {/* Dashed trajectory line connecting assembled to exploded position */}
                <line
                  x1={p.origSvg.x}
                  y1={p.origSvg.y}
                  x2={p.centerSvg.x}
                  y2={p.centerSvg.y}
                  stroke={trajColor}
                  strokeWidth={trajWidth}
                  strokeDasharray={isSel ? '5 3' : '3 3'}
                />
              </g>
            );
          })}
        </g>
      )}

      {/* 2. Pieces Layer */}
      {(() => {
        const placedBalloons: Array<{ x: number; y: number }> = [];
        const MIN_BALLOON_DIST = 28;
        return projectedPieces.map((p) => {
        const isSelected = activePieceId === p.item.pieceId;
        const [sv0, sv1, sv2, sv3, sv4, sv5, sv6, sv7] = p.vertices;

        const frontPoints = `${sv4!.x},${sv4!.y} ${sv5!.x},${sv5!.y} ${sv6!.x},${sv6!.y} ${sv7!.x},${sv7!.y}`;
        const topPoints = `${sv7!.x},${sv7!.y} ${sv6!.x},${sv6!.y} ${sv2!.x},${sv2!.y} ${sv3!.x},${sv3!.y}`;
        const rightPoints = `${sv5!.x},${sv5!.y} ${sv1!.x},${sv1!.y} ${sv2!.x},${sv2!.y} ${sv6!.x},${sv6!.y}`;
        const leftPoints = `${sv0!.x},${sv0!.y} ${sv4!.x},${sv4!.y} ${sv7!.x},${sv7!.y} ${sv3!.x},${sv3!.y}`;

        const isGhosted = !p.isStepActive;

        let frontFill = 'var(--surface-2, #ede8dc)';
        let topFill = '#faf8f4';
        let sideFill = '#ded8cb';
        let strokeColor = 'var(--text-muted, #5c655f)';
        let strokeWidth = 1.0;
        let opacity = 0.95;

        if (isSelected) {
          frontFill = 'var(--primary, #56705f)';
          topFill = 'var(--primary-hover, #465c4e)';
          sideFill = '#3b4e42';
          strokeColor = 'var(--primary, #56705f)';
          strokeWidth = 2.0;
        } else if (isGhosted) {
          frontFill = '#e8e4da';
          topFill = '#f0ede6';
          sideFill = '#dfdacd';
          strokeColor = 'var(--border, #d9d2c3)';
          strokeWidth = 0.8;
          opacity = 0.18;
        }

        const useLeftFace = viewAngle === 'iso-left';

        // Front face center for balloon placement (with collision avoidance)
        const fcX = (sv4!.x + sv6!.x) / 2;
        const fcY = (sv4!.y + sv6!.y) / 2;

        const dx = fcX - width / 2;
        const dy = fcY - height / 2;
        const len = Math.hypot(dx, dy) || 1;
        let bX = Math.max(38, Math.min(width - 38, fcX + (dx / len) * 52));
        let bY = Math.max(38, Math.min(height - 38, fcY + (dy / len) * 40));

        if (showBalloons && !isGhosted) {
          for (let attempt = 0; attempt < 8; attempt++) {
            const clash = placedBalloons.find(
              (other) => Math.hypot(other.x - bX, other.y - bY) < MIN_BALLOON_DIST,
            );
            if (!clash) break;
            bY = Math.max(32, Math.min(height - 32, bY + (attempt % 2 === 0 ? -MIN_BALLOON_DIST : MIN_BALLOON_DIST)));
            if (Math.hypot(clash.x - bX, clash.y - bY) < MIN_BALLOON_DIST) {
              bX = Math.max(32, Math.min(width - 32, bX + (bX >= width / 2 ? MIN_BALLOON_DIST : -MIN_BALLOON_DIST)));
            }
          }
          placedBalloons.push({ x: bX, y: bY });
        }

        return (
          <g
            key={p.item.pieceId}
            style={{ cursor: 'pointer', transition: 'opacity 0.2s ease' }}
            opacity={opacity}
            onClick={() => onSelectPiece && onSelectPiece(isSelected ? null : p.item.pieceId)}
          >
            {/* Top Face */}
            <polygon points={topPoints} fill={topFill} stroke={strokeColor} strokeWidth={strokeWidth} />
            {/* Side Face (Left or Right depending on viewing angle) */}
            {useLeftFace ? (
              <polygon points={leftPoints} fill={sideFill} stroke={strokeColor} strokeWidth={strokeWidth} />
            ) : (
              <polygon points={rightPoints} fill={sideFill} stroke={strokeColor} strokeWidth={strokeWidth} />
            )}
            {/* Front Face */}
            <polygon
              points={frontPoints}
              fill={frontFill}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              fillOpacity={p.item.role.includes('back') ? 0.6 : 0.95}
            />

            {/* Edge Banding Highlight (Front Edge) in Latón Brass */}
            {showEdgeBanding && !isGhosted && (
              <line
                x1={sv7!.x}
                y1={sv7!.y}
                x2={sv6!.x}
                y2={sv6!.y}
                stroke="var(--accent, #b08a3e)"
                strokeWidth={isSelected ? '3.5' : '2.5'}
                strokeLinecap="round"
              />
            )}

            {/* Reference Number Balloon & Leader line */}
            {showBalloons && !isGhosted && (
              <g className="exploded-balloon-group">
                <line
                  x1={fcX}
                  y1={fcY}
                  x2={bX}
                  y2={bY}
                  stroke="var(--accent, #b08a3e)"
                  strokeWidth="1.2"
                  strokeDasharray="2 2"
                />
                <circle
                  cx={bX}
                  cy={bY}
                  r="13"
                  fill={isSelected ? 'var(--primary, #56705f)' : 'var(--surface, #ffffff)'}
                  stroke={isSelected ? 'var(--primary-hover, #465c4e)' : 'var(--border, #d9d2c3)'}
                  strokeWidth={isSelected ? '2.5' : '1.5'}
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
            )}
          </g>
        );
      });
      })()}
    </svg>
  );
}

/**
 * Render technical 2D shop drawing for a specific panel pre-machining detail.
 * Dynamically sizes the SVG viewBox around the panel and its CAD annotations, eliminating
 * dead margins to center and maximize drawing size in mobile cards. Prevents operation
 * label collisions via non-overlapping label layout and guarantees minimum font sizes.
 */
export function renderPanelDetailSvg(
  panel: AssemblySheet['panelDetails'][0],
): ReactElement {
  const pW = panel.dimensionsMm.width;
  const pH = panel.dimensionsMm.height;

  // Target bounding size for the panel itself inside the SVG coordinate space
  const targetDrawW = 500;
  const targetDrawH = 250;
  const scale = Math.min(targetDrawW / Math.max(1, pW), targetDrawH / Math.max(1, pH));

  const actualW = pW * scale;
  const actualH = pH * scale;

  // Clearances for CAD annotations:
  // Left: Height dimension line (-26) and rotated label (-32 to -54)
  const marginL = 56;
  // Right: Clearance for operation labels extending past panel border
  const marginR = 112;
  // Top: Clearance above panel top
  const marginT = 24;
  // Bottom: Width dimension line (+26), text (+38), and Datum mark note (+18)
  const marginB = 46;

  const contentW = Math.ceil(marginL + actualW + marginR);
  const contentH = Math.ceil(marginT + actualH + marginB);

  const originX = marginL;
  const originY = marginT + actualH; // Bottom origin Y

  // Coordinate conversion from Datum (0,0): X from front (left), Y from bottom (upwards)
  const toSvgX = (xMm: number) => originX + xMm * scale;
  const toSvgY = (yMm: number) => originY - yMm * scale;

  // Compute font size guaranteed to meet panelDetailMinFontSizePx on screen (mobile card ~350px)
  const minFontPx = DEFAULT_UI_CONFIG.panelDetailMinFontSizePx ?? 11;
  const baseFontSize = Math.max(minFontPx, Math.round(minFontPx * Math.max(1, contentW / 350)));
  const labelFontSize = Math.max(10, Math.round(baseFontSize * 0.9));

  // Deduplicate slide guide labels that share the same Y height (e.g. front & rear screws of same rail)
  const seenSlideY = new Set<number>();
  const rawLabels: RawOperationLabel[] = [];
  const slideLabelOpIndices = new Set<number>();
  panel.operations.forEach((op, idx) => {
    const ox = toSvgX(op.xFromFrontMm);
    const oy = toSvgY(op.yFromBottomMm);
    const isSlide = op.hardwareType.includes('slide') || op.description.toLowerCase().includes('corredera');
    if (isSlide) {
      const yKey = Math.round(op.yFromBottomMm * 10);
      if (seenSlideY.has(yKey)) return;
      seenSlideY.add(yKey);
      slideLabelOpIndices.add(idx);
    }
    rawLabels.push({
      id: `op-${idx}`,
      x: isSlide ? originX + 12 : Math.min(ox + 8, contentW - 108),
      y: isSlide ? oy - 4 : oy + 3,
      text: isSlide
        ? `Guía corredera Y = ${op.yFromBottomMm} mm`
        : `Y=${op.yFromBottomMm} (X=${op.xFromFrontMm})`,
      isSlide,
    });
  });

  // Dedicated exclusion box reserving space for Datum (0,0) Frente-Base note
  const datumExclusion = [
    {
      id: 'datum-origin-mark',
      x: originX,
      y: originY + 4,
      width: Math.min(160, Math.round(contentW * 0.45)),
      height: 24,
    },
  ];

  const positionedLabels = resolveNonOverlappingLabels(
    rawLabels,
    labelFontSize + 4,
    Math.max(65, Math.round(contentW * 0.2)),
    datumExclusion,
    originY - 2,
  );

  const labelMap = new Map<string, PositionedOperationLabel>(
    positionedLabels.map((l) => [l.id, l]),
  );

  return (
    <svg
      viewBox={`0 0 ${contentW} ${contentH}`}
      className="assembly-svg panel-detail-svg"
      style={{
        width: '100%',
        height: 'auto',
        maxHeight: '340px',
        maxWidth: `${contentW}px`,
        display: 'block',
        margin: '0 auto',
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
      <text x={originX + 8} y={originY + 18} fontSize={labelFontSize} fontWeight="bold" fill="var(--danger, #b3412f)">
        Datum (0,0) Frente-Base
      </text>

      {/* Panel Outer Dimension Lines */}
      {/* Width dimension (Bottom) */}
      <line
        x1={originX}
        y1={originY + 26}
        x2={originX + actualW}
        y2={originY + 26}
        stroke="var(--text-muted, #5c655f)"
        strokeWidth="1"
        markerStart="url(#arrow-dim-panel)"
        markerEnd="url(#arrow-dim-panel)"
      />
      <text x={originX + actualW / 2} y={originY + 38} textAnchor="middle" fontSize={baseFontSize} fontWeight="bold" fill="var(--text, #1f2622)">
        Ancho: {pW} mm
      </text>

      {/* Height dimension (Left) */}
      <line
        x1={originX - 26}
        y1={originY}
        x2={originX - 26}
        y2={originY - actualH}
        stroke="var(--text-muted, #5c655f)"
        strokeWidth="1"
        markerStart="url(#arrow-dim-panel)"
        markerEnd="url(#arrow-dim-panel)"
      />
      <text
        x={originX - 32}
        y={originY - actualH / 2}
        textAnchor="middle"
        fontSize={baseFontSize}
        fontWeight="bold"
        fill="var(--text, #1f2622)"
        transform={`rotate(-90 ${originX - 32} ${originY - actualH / 2})`}
      >
        Alto: {pH} mm
      </text>

      {/* Operations (Drills, Slide tracks, Hinge bases) */}
      {panel.operations.map((op, idx) => {
        const ox = toSvgX(op.xFromFrontMm);
        const oy = toSvgY(op.yFromBottomMm);
        const isSlide = op.hardwareType.includes('slide') || op.description.toLowerCase().includes('corredera');
        const opId = `op-${idx}`;
        const posLabel = labelMap.get(opId);
        const labelX = posLabel ? posLabel.renderedX : (isSlide ? originX + 12 : ox + 8);
        const labelY = posLabel ? posLabel.renderedY : (isSlide ? oy - 4 : oy + 3);

        if (isSlide) {
          const showRailLineAndLabel = slideLabelOpIndices.has(idx);
          return (
            <g key={idx}>
              {showRailLineAndLabel && (
                <line
                  x1={originX}
                  y1={oy}
                  x2={originX + actualW}
                  y2={oy}
                  stroke="var(--primary, #56705f)"
                  strokeWidth="1.8"
                  strokeDasharray="4 3"
                />
              )}
              <circle cx={ox} cy={oy} r="3.5" fill="var(--primary, #56705f)" />
              {showRailLineAndLabel && (
                <text x={labelX} y={labelY} fontSize={labelFontSize} fontWeight="bold" fill="var(--primary, #56705f)">
                  Guía corredera Y = {op.yFromBottomMm} mm
                </text>
              )}
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
            {posLabel && posLabel.staggerLevel !== 0 && (
              <line
                x1={ox + 4}
                y1={oy}
                x2={labelX - 2}
                y2={labelY - 2}
                stroke="var(--text-muted, #5c655f)"
                strokeWidth="0.8"
                strokeDasharray="2 2"
              />
            )}
            <text x={labelX} y={labelY} fontSize={labelFontSize} fill="var(--text, #1f2622)">
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
export function renderAssemblySvg(
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

