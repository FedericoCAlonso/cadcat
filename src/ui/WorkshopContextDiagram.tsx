import { type ReactElement } from 'react';
import { type RoofType, type BackingType, type BayContent, type BayBoundingBox } from '../resolver';
import { resolveBackingReserveMm } from '../resolver/composition/backingReserve';
import { type ObraGridType, type MaterialRole } from './ModoObraWizard';

export type WorkshopStepId =
  | 'module-type'
  | 'dimensions'
  | 'material'
  | 'base-roof'
  | 'base-support'
  | 'roof-structure'
  | 'backing'
  | 'bays-grid'
  | 'bays-equipment';

export interface WorkshopContextDiagramProps {
  step: WorkshopStepId;
  selectedTemplateId?: string;
  width?: number;
  height?: number;
  depth?: number;
  thickness?: number;
  activeDimension?: 'width' | 'height' | 'depth' | 'thickness';
  onSelectDimension?: (dim: 'width' | 'height' | 'depth' | 'thickness') => void;
  hasPlinth?: boolean;
  plinthHeightMm?: number;
  hasWallHangingRail?: boolean;
  roofType?: RoofType;
  activeShellZone?: 'base' | 'roof';
  onSelectShellZone?: (zone: 'base' | 'roof') => void;
  hasBacking?: boolean;
  backingType?: BackingType;
  backingThicknessMm?: number;
  gridType?: ObraGridType;
  bays?: BayContent[];
  bayBoxes?: BayBoundingBox[];
  activeBayIndex?: number;
  onSelectBayIndex?: (idx: number) => void;
  materialRole?: MaterialRole;
  onSelectMaterialRole?: (role: MaterialRole) => void;
  activeMaterialName?: string;
  activeRoleThicknessMm?: number;
}

/**
 * Responsive, zero-dependency interactive SVG CAD context diagrams for Modo Taller / Obra.
 * Occupies the upper visual zone of the mobile wizard to provide immediate, proportional,
 * and interactive engineering feedback for each of the 7 stages.
 */
export function WorkshopContextDiagram({
  step,
  selectedTemplateId = 'base-modular',
  width = 800,
  height = 750,
  depth = 580,
  thickness = 18,
  activeDimension = 'width',
  onSelectDimension,
  hasPlinth = true,
  plinthHeightMm = 100,
  hasWallHangingRail = false,
  roofType = 'front-back-rails',
  activeShellZone = 'base',
  onSelectShellZone,
  hasBacking = true,
  backingType = 'groove',
  backingThicknessMm = 3,
  gridType = '1-bay',
  bays = [],
  bayBoxes = [],
  activeBayIndex = 0,
  onSelectBayIndex,
  materialRole = 'carcass',
  onSelectMaterialRole,
  activeMaterialName,
  activeRoleThicknessMm,
}: WorkshopContextDiagramProps): ReactElement {
  const tplLower = selectedTemplateId.toLowerCase();
  const isWallUnit = tplLower.includes('wall') || tplLower.includes('alacena');
  const isTallUnit = tplLower.includes('tall') || tplLower.includes('torre');
  const isDrawerUnit = tplLower.includes('drawer') || tplLower.includes('cajon');
  const isDoorUnit = tplLower.includes('door') || tplLower.includes('puerta');
  const isPartitionUnit = tplLower.includes('partition') || tplLower.includes('vano') || tplLower.includes('subdiv');
  const isShelvingUnit = tplLower.includes('shelf') || tplLower.includes('estante');

  const bayCount = gridType === '3-bays-vertical' ? 3 : gridType === '2-bays-vertical' ? 2 : 1;

  const backingReserveMm = resolveBackingReserveMm({
    hasBacking,
    backingType,
    backingThicknessMm,
  });
  const usableDepthMm = Math.max(1, Math.round(( depth - backingReserveMm ) * 10) / 10);
  const interiorWidthMm = Math.max(100, Math.round(width - 2 * thickness));
  const interiorHeightMm = Math.max(
    100,
    Math.round(height - 2 * thickness - (hasPlinth && !hasWallHangingRail ? plinthHeightMm : 0)),
  );

  return (
    <div
      role="img"
      aria-label={`Esquema técnico de contexto: ${step}`}
      style={{
        width: '100%',
        maxWidth: '460px',
        height: '146px',
        minHeight: '132px',
        maxHeight: '160px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--md-sys-color-surface-container-lowest, #ffffff)',
        borderRadius: '16px',
        border: '1px solid var(--md-sys-color-outline-variant, #e0e3e7)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.05)',
        boxSizing: 'border-box',
        padding: '4px 6px',
        overflow: 'hidden',
        position: 'relative',
        margin: '0 auto 0.2rem',
        flexShrink: 0,
      }}
    >
      {/* ─────────────────────────────────────────────────────────────
          ETAPA 1: MÓDULO Y TIPO (Silueta CAD según plantilla activa)
         ───────────────────────────────────────────────────────────── */}
      {step === 'module-type' && (
        <svg viewBox="0 0 340 170" style={{ width: '100%', height: '100%' }}>
          {/* Floor Reference Line */}
          <line x1="15" y1="154" x2="325" y2="154" stroke="var(--md-sys-color-outline-variant)" strokeWidth="1.5" strokeDasharray="4 4" />
          <text x="20" y="165" fontSize="7.5" fill="var(--md-sys-color-outline)" fontWeight="700">NIVEL DE PISO</text>

          {isWallUnit && !isShelvingUnit ? (
            /* Alacena Colgante */
            <g transform="translate(70, 10)">
              <line x1="10" y1="4" x2="190" y2="4" stroke="var(--md-sys-color-outline)" strokeWidth="1.2" strokeDasharray="3 3" />
              <text x="100" y="0" textAnchor="middle" fontSize="7.5" fill="var(--md-sys-color-outline)" fontWeight="700">MURO PORTANTE</text>

              <rect x="25" y="10" width="150" height="78" rx="4" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="2.2" />
              <line x1="100" y1="11" x2="100" y2="87" stroke="var(--md-sys-color-primary)" strokeWidth="1.5" strokeDasharray="3 3" />
              <path d="M 30,15 L 44,15 L 30,29 Z" fill="var(--md-sys-color-primary)" />
              <path d="M 170,15 L 156,15 L 170,29 Z" fill="var(--md-sys-color-primary)" />

              <text x="100" y="45" textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--md-sys-color-on-primary-container)">ALACENA COLGANTE</text>
              <text x="100" y="61" textAnchor="middle" fontSize="8.5" fill="var(--md-sys-color-primary)" fontWeight="700">Fijación aérea · Suspendida</text>

              <line x1="100" y1="90" x2="100" y2="140" stroke="var(--md-sys-color-primary)" strokeWidth="1.2" strokeDasharray="3 2" />
              <rect x="42" y="105" width="116" height="18" rx="4" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-primary)" strokeWidth="1" />
              <text x="100" y="117" textAnchor="middle" fontSize="8" fill="var(--md-sys-color-primary)" fontWeight="700">Despeje sobre mesada</text>
            </g>
          ) : isTallUnit ? (
            /* Torre Horno / Despensero */
            <g transform="translate(105, 6)">
              <rect x="15" y="6" width="90" height="132" rx="4" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="2.2" />
              <line x1="15" y1="44" x2="105" y2="44" stroke="var(--md-sys-color-primary)" strokeWidth="1.8" />
              <line x1="15" y1="92" x2="105" y2="92" stroke="var(--md-sys-color-primary)" strokeWidth="1.8" />
              <rect x="23" y="138" width="74" height="10" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-outline)" strokeWidth="1.2" />
              <text x="60" y="28" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--md-sys-color-on-primary-container)">ALACENA SUP.</text>
              <text x="60" y="71" textAnchor="middle" fontSize="9.5" fontWeight="800" fill="var(--md-sys-color-primary)">TORRE / COLUMNA</text>
              <text x="60" y="118" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--md-sys-color-on-primary-container)">BAJO INFERIOR</text>
            </g>
          ) : isDrawerUnit ? (
            /* Cajonera */
            <g transform="translate(65, 10)">
              <rect x="25" y="14" width="160" height="104" rx="3" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="2.2" />
              <rect x="31" y="20" width="148" height="26" rx="2" fill="var(--md-sys-color-surface)" stroke="var(--md-sys-color-primary)" strokeWidth="1.5" />
              <rect x="31" y="50" width="148" height="28" rx="2" fill="var(--md-sys-color-surface)" stroke="var(--md-sys-color-primary)" strokeWidth="1.5" />
              <rect x="31" y="82" width="148" height="30" rx="2" fill="var(--md-sys-color-surface)" stroke="var(--md-sys-color-primary)" strokeWidth="1.5" />
              <line x1="90" y1="33" x2="120" y2="33" stroke="var(--md-sys-color-primary)" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="90" y1="64" x2="120" y2="64" stroke="var(--md-sys-color-primary)" strokeWidth="2.2" strokeLinecap="round" />
              <line x1="90" y1="97" x2="120" y2="97" stroke="var(--md-sys-color-primary)" strokeWidth="2.2" strokeLinecap="round" />
              <rect x="40" y="118" width="130" height="24" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-outline)" strokeWidth="1.2" />
              <text x="105" y="133" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--md-sys-color-outline)">CAJONERA MODULAR</text>
            </g>
          ) : isDoorUnit ? (
            /* Módulo con Puertas */
            <g transform="translate(65, 10)">
              <rect x="25" y="14" width="160" height="104" rx="3" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="2.2" />
              <line x1="105" y1="15" x2="105" y2="117" stroke="var(--md-sys-color-primary)" strokeWidth="1.8" />
              <polyline points="27,16 103,66 27,116" fill="none" stroke="var(--md-sys-color-primary)" strokeWidth="1" strokeDasharray="3 3" />
              <polyline points="183,16 107,66 183,116" fill="none" stroke="var(--md-sys-color-primary)" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx="97" cy="66" r="2.8" fill="var(--md-sys-color-primary)" />
              <circle cx="113" cy="66" r="2.8" fill="var(--md-sys-color-primary)" />
              <rect x="40" y="118" width="130" height="24" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-outline)" strokeWidth="1.2" />
              <text x="105" y="45" textAnchor="middle" fontSize="10.5" fontWeight="800" fill="var(--md-sys-color-on-primary-container)">MÓDULO CON PUERTAS</text>
              <text x="105" y="133" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--md-sys-color-outline)">Hojas batientes + Estantes</text>
            </g>
          ) : isPartitionUnit || isShelvingUnit ? (
            /* Módulo Subdividido / Estantería */
            <g transform="translate(65, 10)">
              <rect x="25" y="14" width="160" height="104" rx="3" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="2.2" />
              <line x1="105" y1="14" x2="105" y2="118" stroke="var(--md-sys-color-primary)" strokeWidth="2.2" />
              <line x1="25" y1="48" x2="105" y2="48" stroke="var(--md-sys-color-primary)" strokeWidth="2" />
              <line x1="25" y1="82" x2="105" y2="82" stroke="var(--md-sys-color-primary)" strokeWidth="2" />
              <line x1="105" y1="66" x2="185" y2="66" stroke="var(--md-sys-color-primary)" strokeWidth="2" />
              <text x="65" y="34" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--md-sys-color-primary)">Vano 1 (Izq)</text>
              <text x="145" y="44" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--md-sys-color-primary)">Vano 2 (Der)</text>
              <rect x="40" y="118" width="130" height="24" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-outline)" strokeWidth="1.2" />
              <text x="105" y="133" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--md-sys-color-outline)">DIVISIÓN DE VANOS Y ESTANTES</text>
            </g>
          ) : (
            /* Bajo Mesada Base Estándar */
            <g transform="translate(65, 10)">
              <rect x="15" y="8" width="180" height="12" rx="3" fill="var(--md-sys-color-surface-container-highest)" stroke="var(--md-sys-color-outline)" strokeWidth="1.2" />
              <text x="105" y="4" textAnchor="middle" fontSize="8" fill="var(--md-sys-color-outline)" fontWeight="bold">{`MESADA ${depth} mm`}</text>

              <rect x="25" y="20" width="160" height="95" rx="3" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="2.2" />
              <line x1="105" y1="21" x2="105" y2="114" stroke="var(--md-sys-color-primary)" strokeWidth="1.2" strokeDasharray="3 3" />

              <rect x="42" y="115" width="126" height="28" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-outline)" strokeWidth="1.2" />
              <text x="105" y="132" textAnchor="middle" fontSize="8" fill="var(--md-sys-color-outline)" fontWeight="600">{`ZÓCALO RETRAÍDO (${plinthHeightMm} mm)`}</text>
              <text x="105" y="72" textAnchor="middle" fontSize="11.5" fontWeight="800" fill="var(--md-sys-color-on-primary-container)">BAJO MESADA BASE</text>
            </g>
          )}

          {/* Live outer dimensions summary badge */}
          <g transform="translate(232, 10)">
            <rect x="0" y="0" width="98" height="22" rx="6" fill="var(--md-sys-color-surface-container)" stroke="var(--md-sys-color-outline-variant)" strokeWidth="1" />
            <text x="49" y="14" textAnchor="middle" fontSize="7.8" fontWeight="800" fill="var(--md-sys-color-primary)">
              {`${width}×${height}×${depth}`}
            </text>
          </g>
        </svg>
      )}

      {/* ─────────────────────────────────────────────────────────────
          ETAPA 2: MEDIDAS PRINCIPALES (Isométrico interactivo con luz útil)
         ───────────────────────────────────────────────────────────── */}
      {step === 'dimensions' && (
        <svg viewBox="0 0 340 170" style={{ width: '100%', height: '100%' }}>
          {/* Luz interior útil badge top-right */}
          <g transform="translate(195, 6)">
            <rect x="0" y="0" width="136" height="22" rx="6" fill="var(--md-sys-color-surface-container)" stroke="var(--md-sys-color-outline-variant)" strokeWidth="1" />
            <text x="68" y="14" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="var(--md-sys-color-on-surface-variant)">
              {`Luz útil: ${interiorWidthMm}×${interiorHeightMm}×${usableDepthMm}`}
            </text>
          </g>

          <g transform="translate(15, 6)">
            {/* Top perspective face */}
            <path
              d="M 65,24 L 185,24 L 232,48 L 112,48 Z"
              onClick={() => onSelectDimension?.('depth')}
              style={{ cursor: 'pointer' }}
              fill={activeDimension === 'depth' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-high)'}
              stroke={activeDimension === 'depth' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)'}
              strokeWidth={activeDimension === 'depth' ? '2.4' : '1.2'}
              opacity="0.92"
            />
            {/* Left side face (depth) */}
            <path
              d="M 65,24 L 112,48 L 112,128 L 65,104 Z"
              onClick={() => onSelectDimension?.('depth')}
              style={{ cursor: 'pointer' }}
              fill={activeDimension === 'depth' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-highest)'}
              stroke={activeDimension === 'depth' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
              strokeWidth={activeDimension === 'depth' ? '2.5' : '1.5'}
            />
            {/* Front face (width & height) */}
            <rect
              x="112"
              y="48"
              width="120"
              height="80"
              rx="2"
              onClick={() => onSelectDimension?.(activeDimension === 'width' ? 'height' : 'width')}
              style={{ cursor: 'pointer' }}
              fill={activeDimension === 'width' || activeDimension === 'height' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface)'}
              stroke={activeDimension === 'width' || activeDimension === 'height' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
              strokeWidth={activeDimension === 'width' || activeDimension === 'height' ? '2.5' : '1.5'}
            />
            {/* Inner carcass cavity showing board thickness */}
            <rect
              x="118"
              y="54"
              width="108"
              height="68"
              rx="1"
              fill="var(--md-sys-color-surface-container-lowest, #ffffff)"
              stroke={activeDimension === 'thickness' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)'}
              strokeWidth={activeDimension === 'thickness' ? '2' : '1'}
              strokeDasharray={activeDimension === 'thickness' ? 'none' : '2 2'}
              pointerEvents="none"
            />

            {/* Thickness zoomed detail indicator at bottom right corner */}
            <circle
              cx="232"
              cy="128"
              r={activeDimension === 'thickness' ? '8' : '5'}
              onClick={() => onSelectDimension?.('thickness')}
              style={{ cursor: 'pointer' }}
              fill={activeDimension === 'thickness' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)'}
              stroke="var(--md-sys-color-surface)"
              strokeWidth="2"
            />

            {/* ── COTA ANCHO (Horizontal front bottom) ── */}
            <g onClick={() => onSelectDimension?.('width')} style={{ cursor: 'pointer' }}>
              <line
                x1="112"
                y1="145"
                x2="232"
                y2="145"
                stroke={activeDimension === 'width' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
                strokeWidth={activeDimension === 'width' ? '2.8' : '1.5'}
              />
              <path d="M 116,141 L 112,145 L 116,149" fill="none" stroke={activeDimension === 'width' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'} strokeWidth="1.8" />
              <path d="M 228,141 L 232,145 L 228,149" fill="none" stroke={activeDimension === 'width' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'} strokeWidth="1.8" />
              <rect
                x="141"
                y="135"
                width="62"
                height="19"
                rx="5"
                fill={activeDimension === 'width' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-high)'}
              />
              <text
                x="172"
                y="148"
                textAnchor="middle"
                fontSize="9"
                fontWeight="bold"
                fill={activeDimension === 'width' ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)'}
              >
                {`A: ${width} mm`}
              </text>
            </g>

            {/* ── COTA ALTO (Vertical right front) ── */}
            <g onClick={() => onSelectDimension?.('height')} style={{ cursor: 'pointer' }}>
              <line
                x1="245"
                y1="48"
                x2="245"
                y2="128"
                stroke={activeDimension === 'height' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
                strokeWidth={activeDimension === 'height' ? '2.8' : '1.5'}
              />
              <path d="M 241,52 L 245,48 L 249,52" fill="none" stroke={activeDimension === 'height' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'} strokeWidth="1.8" />
              <path d="M 241,124 L 245,128 L 249,124" fill="none" stroke={activeDimension === 'height' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'} strokeWidth="1.8" />
              <rect
                x="251"
                y="78"
                width="62"
                height="19"
                rx="5"
                fill={activeDimension === 'height' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-high)'}
              />
              <text
                x="282"
                y="91"
                textAnchor="middle"
                fontSize="9"
                fontWeight="bold"
                fill={activeDimension === 'height' ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)'}
              >
                {`H: ${height} mm`}
              </text>
            </g>

            {/* ── COTA PROFUNDIDAD (Oblique top left) ── */}
            <g onClick={() => onSelectDimension?.('depth')} style={{ cursor: 'pointer' }}>
              <line
                x1="54"
                y1="20"
                x2="102"
                y2="44"
                stroke={activeDimension === 'depth' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
                strokeWidth={activeDimension === 'depth' ? '2.8' : '1.5'}
              />
              <rect
                x="42"
                y="36"
                width="62"
                height="19"
                rx="5"
                fill={activeDimension === 'depth' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-high)'}
              />
              <text
                x="73"
                y="49"
                textAnchor="middle"
                fontSize="9"
                fontWeight="bold"
                fill={activeDimension === 'depth' ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)'}
              >
                {`P: ${depth} mm`}
              </text>
            </g>

            {/* ── COTA ESPESOR (Callout badge) ── */}
            <g onClick={() => onSelectDimension?.('thickness')} style={{ cursor: 'pointer' }}>
              <line x1="236" y1="130" x2="258" y2="136" stroke={activeDimension === 'thickness' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'} strokeWidth="1.2" strokeDasharray="2 2" />
              <rect
                x="258"
                y="126"
                width="56"
                height="19"
                rx="5"
                fill={activeDimension === 'thickness' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-high)'}
              />
              <text
                x="286"
                y="139"
                textAnchor="middle"
                fontSize="8.5"
                fontWeight="bold"
                fill={activeDimension === 'thickness' ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)'}
              >
                {`e: ${thickness} mm`}
              </text>
            </g>
          </g>
        </svg>
      )}

      {/* ─────────────────────────────────────────────────────────────
          ETAPA 3: PLACAS Y ESPESORES (Despiece interactivo de 4 roles)
         ───────────────────────────────────────────────────────────── */}
      {step === 'material' && (
        <svg viewBox="0 0 340 170" style={{ width: '100%', height: '100%' }}>
          <g transform="translate(12, 8)">
            {/* 1. FONDO (Back panel shifted behind) */}
            <g
              onClick={() => onSelectMaterialRole?.('backing')}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x="14"
                y="8"
                width="74"
                height="96"
                rx="3"
                fill={materialRole === 'backing' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-high)'}
                stroke={materialRole === 'backing' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
                strokeWidth={materialRole === 'backing' ? '2.5' : '1.4'}
                strokeDasharray={materialRole === 'backing' ? 'none' : '3 2'}
              />
              <text x="51" y="52" textAnchor="middle" fontSize="9.5" fontWeight="800" fill={materialRole === 'backing' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface)'}>
                🪵 FONDOS
              </text>
              <text x="51" y="66" textAnchor="middle" fontSize="7.8" fill="var(--md-sys-color-outline)" fontWeight="700">
                {`${backingThicknessMm} mm · Por vano`}
              </text>
            </g>

            {/* 2. CASCO (Main Carcass structure) */}
            <g
              onClick={() => onSelectMaterialRole?.('carcass')}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x="98"
                y="8"
                width="82"
                height="96"
                rx="3"
                fill={materialRole === 'carcass' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-high)'}
                stroke={materialRole === 'carcass' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
                strokeWidth={materialRole === 'carcass' ? '2.5' : '1.5'}
              />
              <rect
                x="104"
                y="14"
                width="70"
                height="84"
                rx="1"
                fill="var(--md-sys-color-surface)"
                stroke="var(--md-sys-color-outline-variant)"
                strokeWidth="1"
              />
              <text x="139" y="52" textAnchor="middle" fontSize="9.5" fontWeight="800" fill={materialRole === 'carcass' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface)'}>
                🏛️ CASCO
              </text>
              <text x="139" y="66" textAnchor="middle" fontSize="7.8" fill="var(--md-sys-color-outline)" fontWeight="700">
                {`Estructura ${thickness} mm`}
              </text>
            </g>

            {/* 3. CAJONES (Interior drawer boxes) */}
            <g
              onClick={() => onSelectMaterialRole?.('drawers')}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x="190"
                y="8"
                width="62"
                height="96"
                rx="3"
                fill={materialRole === 'drawers' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-high)'}
                stroke={materialRole === 'drawers' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
                strokeWidth={materialRole === 'drawers' ? '2.5' : '1.4'}
              />
              <rect x="196" y="18" width="50" height="20" rx="2" fill="var(--md-sys-color-surface)" stroke="var(--md-sys-color-outline-variant)" strokeWidth="1" />
              <rect x="196" y="74" width="50" height="22" rx="2" fill="var(--md-sys-color-surface)" stroke="var(--md-sys-color-outline-variant)" strokeWidth="1" />
              <text x="221" y="54" textAnchor="middle" fontSize="9" fontWeight="800" fill={materialRole === 'drawers' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface)'}>
                🗄️ CAJONES
              </text>
              <text x="221" y="66" textAnchor="middle" fontSize="7.5" fill="var(--md-sys-color-outline)" fontWeight="700">
                Cajas int.
              </text>
            </g>

            {/* 4. FRENTES (Doors & Drawer Fronts) */}
            <g
              onClick={() => onSelectMaterialRole?.('fronts')}
              style={{ cursor: 'pointer' }}
            >
              <rect
                x="262"
                y="8"
                width="54"
                height="96"
                rx="3"
                fill={materialRole === 'fronts' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-high)'}
                stroke={materialRole === 'fronts' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
                strokeWidth={materialRole === 'fronts' ? '2.5' : '1.4'}
              />
              <circle cx="270" cy="56" r="2.8" fill="var(--md-sys-color-primary)" />
              <text x="289" y="52" textAnchor="middle" fontSize="9" fontWeight="800" fill={materialRole === 'fronts' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface)'}>
                🚪 FRENTES
              </text>
              <text x="289" y="66" textAnchor="middle" fontSize="7.5" fill="var(--md-sys-color-outline)" fontWeight="700">
                Puertas/Tapas
              </text>
            </g>

            {/* Active Role Technical Status Bar */}
            <rect x="14" y="114" width="302" height="28" rx="7" fill="var(--md-sys-color-surface-container)" stroke="var(--md-sys-color-outline-variant)" strokeWidth="1" />
            <text x="165" y="132" textAnchor="middle" fontSize="8.8" fontWeight="800" fill="var(--md-sys-color-primary)">
              {materialRole === 'carcass' && `Rol activo: Casco Exterior (${activeRoleThicknessMm ?? thickness} mm)${activeMaterialName ? ` · ${activeMaterialName}` : ''}`}
              {materialRole === 'fronts' && `Rol activo: Frentes y Puertas (${activeRoleThicknessMm ?? thickness} mm)${activeMaterialName ? ` · ${activeMaterialName}` : ''}`}
              {materialRole === 'drawers' && `Rol activo: Cajas de Cajón (${activeRoleThicknessMm ?? thickness} mm)${activeMaterialName ? ` · ${activeMaterialName}` : ''}`}
              {materialRole === 'backing' && `Rol activo: Fondos (${activeRoleThicknessMm ?? backingThicknessMm} mm)${activeMaterialName ? ` · ${activeMaterialName}` : ''}`}
            </text>
          </g>
        </svg>
      )}

      {/* ─────────────────────────────────────────────────────────────
          ETAPA 4 UNIFICADA: BASE Y TECHO (Corte estructural superior + inferior)
         ───────────────────────────────────────────────────────────── */}
      {step === 'base-roof' && (
        <svg viewBox="0 0 340 170" style={{ width: '100%', height: '100%' }}>
          {/* Left Panel: CIERRE SUPERIOR (TECHO) */}
          <g
            transform="translate(8, 8)"
            onClick={() => onSelectShellZone?.('roof')}
            style={{ cursor: 'pointer' }}
          >
            <rect
              x="0"
              y="0"
              width="156"
              height="154"
              rx="10"
              fill={activeShellZone === 'roof' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-low)'}
              stroke={activeShellZone === 'roof' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)'}
              strokeWidth={activeShellZone === 'roof' ? '2.2' : '1.2'}
              opacity={activeShellZone === 'roof' ? 0.35 : 0.7}
            />
            <text x="78" y="16" textAnchor="middle" fontSize="8.2" fontWeight="800" fill="var(--md-sys-color-primary)">
              1. CIERRE SUPERIOR (TECHO)
            </text>

            {roofType === 'front-back-rails' ? (
              <g transform="translate(18, 26)">
                <rect x="4" y="8" width="10" height="84" fill="var(--md-sys-color-surface-container-highest)" stroke="var(--md-sys-color-outline)" strokeWidth="1.2" />
                <rect x="106" y="8" width="10" height="84" fill="var(--md-sys-color-surface-container-highest)" stroke="var(--md-sys-color-outline)" strokeWidth="1.2" />
                <rect x="14" y="10" width="92" height="18" rx="2" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1.8" />
                <rect x="14" y="54" width="92" height="18" rx="2" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1.8" />
                <text x="60" y="22" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="var(--md-sys-color-on-primary-container)">FAJA FRONTAL</text>
                <text x="60" y="66" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="var(--md-sys-color-on-primary-container)">FAJA TRASERA</text>
                <text x="60" y="108" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--md-sys-color-primary)">2 Fajas Amarre (Mesada)</text>
              </g>
            ) : roofType === 'none' ? (
              <g transform="translate(18, 26)">
                <line x1="4" y1="6" x2="116" y2="6" stroke="var(--md-sys-color-outline)" strokeWidth="1.8" strokeDasharray="4 3" />
                <rect x="12" y="10" width="96" height="80" rx="2" fill="var(--md-sys-color-surface)" stroke="var(--md-sys-color-primary)" strokeWidth="1.8" />
                <line x1="12" y1="10" x2="108" y2="10" stroke="var(--md-sys-color-error, #ba1a1a)" strokeWidth="2" strokeDasharray="4 3" />
                <text x="60" y="48" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="var(--md-sys-color-primary)">SIN TAPA</text>
                <text x="60" y="64" textAnchor="middle" fontSize="7.5" fill="var(--md-sys-color-on-surface-variant)">A tope con cielorraso</text>
                <text x="60" y="108" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--md-sys-color-primary)">Anti-mugre superior</text>
              </g>
            ) : (
              <g transform="translate(18, 26)">
                <rect x="12" y="8" width="96" height="16" rx="2" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="2" />
                <rect x="12" y="24" width="96" height="66" rx="2" fill="var(--md-sys-color-surface)" stroke="var(--md-sys-color-outline)" strokeWidth="1.4" />
                <text x="60" y="19" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="var(--md-sys-color-on-primary-container)">{`TAPA CIEGA ${thickness}mm`}</text>
                <text x="60" y="60" textAnchor="middle" fontSize="7.8" fill="var(--md-sys-color-outline)">Cierre superior entero</text>
                <text x="60" y="108" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--md-sys-color-primary)">Tapa Ciega Completa</text>
              </g>
            )}
          </g>

          {/* Right Panel: APOYO INFERIOR (BASE) */}
          <g
            transform="translate(176, 8)"
            onClick={() => onSelectShellZone?.('base')}
            style={{ cursor: 'pointer' }}
          >
            <rect
              x="0"
              y="0"
              width="156"
              height="154"
              rx="10"
              fill={activeShellZone === 'base' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-low)'}
              stroke={activeShellZone === 'base' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)'}
              strokeWidth={activeShellZone === 'base' ? '2.2' : '1.2'}
              opacity={activeShellZone === 'base' ? 0.35 : 0.7}
            />
            <text x="78" y="16" textAnchor="middle" fontSize="8.2" fontWeight="800" fill="var(--md-sys-color-primary)">
              2. APOYO INFERIOR (BASE)
            </text>

            {hasWallHangingRail ? (
              <g transform="translate(18, 24)">
                <line x1="12" y1="4" x2="12" y2="96" stroke="var(--md-sys-color-outline)" strokeWidth="2.2" />
                <polygon points="12,18 26,18 16,34 12,34" fill="var(--md-sys-color-primary)" />
                <rect x="24" y="10" width="84" height="72" rx="3" fill="var(--md-sys-color-surface)" stroke="var(--md-sys-color-primary)" strokeWidth="2" />
                <text x="66" y="46" textAnchor="middle" fontSize="8.2" fontWeight="800" fill="var(--md-sys-color-primary)">SUSPENDIDO</text>
                <text x="66" y="60" textAnchor="middle" fontSize="7.2" fill="var(--md-sys-color-outline)">Faja colgado a pared</text>
                <text x="60" y="110" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--md-sys-color-primary)">Flotante / Alacena</text>
              </g>
            ) : hasPlinth ? (
              <g transform="translate(18, 24)">
                <rect x="12" y="6" width="96" height="58" rx="2" fill="var(--md-sys-color-surface)" stroke="var(--md-sys-color-outline)" strokeWidth="1.6" />
                <rect x="28" y="64" width="74" height="28" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="2" />
                <line x1="6" y1="92" x2="114" y2="92" stroke="var(--md-sys-color-outline)" strokeWidth="1.4" strokeDasharray="3 3" />
                <text x="65" y="81" textAnchor="middle" fontSize="8" fontWeight="800" fill="var(--md-sys-color-on-primary-container)">{`ZÓCALO ${plinthHeightMm} mm`}</text>
                <text x="60" y="38" textAnchor="middle" fontSize="7.5" fill="var(--md-sys-color-on-surface)">{`Casco: ${height - plinthHeightMm} mm`}</text>
                <text x="60" y="110" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--md-sys-color-primary)">{`Con Zócalo (${plinthHeightMm} mm)`}</text>
              </g>
            ) : (
              <g transform="translate(18, 24)">
                <rect x="12" y="8" width="96" height="80" rx="2" fill="var(--md-sys-color-surface)" stroke="var(--md-sys-color-outline)" strokeWidth="1.8" />
                <rect x="14" y="88" width="14" height="5" rx="1.5" fill="var(--md-sys-color-primary)" />
                <rect x="92" y="88" width="14" height="5" rx="1.5" fill="var(--md-sys-color-primary)" />
                <line x1="6" y1="93" x2="114" y2="93" stroke="var(--md-sys-color-outline)" strokeWidth="1.4" strokeDasharray="3 3" />
                <text x="60" y="48" textAnchor="middle" fontSize="8.2" fontWeight="800" fill="var(--md-sys-color-on-surface)">APOYO DIRECTO</text>
                <text x="60" y="62" textAnchor="middle" fontSize="7.2" fill="var(--md-sys-color-outline)">Regatón sanitario</text>
                <text x="60" y="110" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--md-sys-color-primary)">Directo al Piso</text>
              </g>
            )}
          </g>
        </svg>
      )}

      {/* Compatibilidad con pasos individuales legados base-support y roof-structure */}
      {step === 'base-support' && (
        <svg viewBox="0 0 340 170" style={{ width: '100%', height: '100%' }}>
          <line x1="15" y1="152" x2="325" y2="152" stroke="var(--md-sys-color-outline-variant)" strokeWidth="1.5" strokeDasharray="4 4" />
          <text x="20" y="163" fontSize="8" fill="var(--md-sys-color-outline)" fontWeight="700">LÍNEA DE PISO TERMINADO</text>
          {hasWallHangingRail ? (
            <g transform="translate(85, 12)">
              <line x1="20" y1="0" x2="20" y2="140" stroke="var(--md-sys-color-outline)" strokeWidth="2.5" />
              <rect x="36" y="16" width="120" height="95" rx="3" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-primary)" strokeWidth="2.2" />
              <text x="96" y="62" textAnchor="middle" fontSize="10" fontWeight="bold" fill="var(--md-sys-color-primary)">MÓDULO SUSPENDIDO</text>
            </g>
          ) : hasPlinth ? (
            <g transform="translate(75, 12)">
              <rect x="25" y="12" width="150" height="85" rx="3" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-outline)" strokeWidth="2" />
              <rect x="52" y="97" width="115" height="42" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="2.2" />
              <text x="110" y="122" textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--md-sys-color-on-primary-container)">{`ZÓCALO ${plinthHeightMm} mm`}</text>
            </g>
          ) : (
            <g transform="translate(75, 12)">
              <rect x="25" y="12" width="150" height="126" rx="3" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-outline)" strokeWidth="2" />
              <text x="100" y="70" textAnchor="middle" fontSize="10.5" fontWeight="bold" fill="var(--md-sys-color-on-surface)">APOYO DIRECTO A PISO</text>
            </g>
          )}
        </svg>
      )}

      {step === 'roof-structure' && (
        <svg viewBox="0 0 340 170" style={{ width: '100%', height: '100%' }}>
          {roofType === 'front-back-rails' ? (
            <g transform="translate(65, 14)">
              <rect x="26" y="16" width="158" height="26" rx="3" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="2" />
              <text x="105" y="32" textAnchor="middle" fontSize="9" fontWeight="bold" fill="var(--md-sys-color-on-primary-container)">FAJA FRONTAL</text>
              <rect x="26" y="88" width="158" height="26" rx="3" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="2" />
              <text x="105" y="104" textAnchor="middle" fontSize="9" fontWeight="bold" fill="var(--md-sys-color-on-primary-container)">FAJA TRASERA</text>
            </g>
          ) : roofType === 'none' ? (
            <g transform="translate(75, 12)">
              <rect x="25" y="16" width="150" height="115" rx="3" fill="var(--md-sys-color-surface-container-low)" stroke="var(--md-sys-color-primary)" strokeWidth="2.2" />
              <text x="100" y="55" textAnchor="middle" fontSize="10.5" fontWeight="800" fill="var(--md-sys-color-primary)">SIN TAPA (HASTA EL TECHO)</text>
            </g>
          ) : (
            <g transform="translate(75, 14)">
              <rect x="25" y="12" width="150" height="24" rx="3" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="2.2" />
              <text x="100" y="27" textAnchor="middle" fontSize="9.5" fontWeight="bold" fill="var(--md-sys-color-on-primary-container)">TAPA CIEGA COMPLETA</text>
            </g>
          )}
        </svg>
      )}

      {/* ─────────────────────────────────────────────────────────────
          ETAPA 5: FONDO TRASERO (Corte lateral con tope de interior y reserva)
         ───────────────────────────────────────────────────────────── */}
      {step === 'backing' && (
        <svg viewBox="0 0 340 170" style={{ width: '100%', height: '100%' }}>
          {/* Left: Lateral Cross-Section showing shelf/equipment stopping FLUSH against the backing */}
          <g transform="translate(14, 10)">
            {/* Lateral panel */}
            <rect x="8" y="8" width="138" height="112" rx="3" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-outline)" strokeWidth="1.8" />
            <text x="14" y="20" fontSize="7.5" fontWeight="700" fill="var(--md-sys-color-outline)">FRENTE (z=0)</text>
            <text x="92" y="20" fontSize="7.5" fontWeight="700" fill="var(--md-sys-color-outline)">FONDO</text>

            {hasBacking && backingType === 'groove' && backingThicknessMm < 15 ? (
              /* Groove backing inset from rear edge */
              <>
                <rect x="118" y="18" width="10" height="92" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1.2" />
                <rect x="120" y="4" width="6" height="120" rx="1" fill="var(--md-sys-color-primary)" />
                {/* Interior shelf stopping FLUSH at x=120 */}
                <rect x="18" y="58" width="102" height="12" rx="1.5" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1.8" />
                <text x="69" y="67" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="var(--md-sys-color-on-primary-container)">
                  {`Interior a tope (${usableDepthMm} mm)`}
                </text>
              </>
            ) : hasBacking && backingThicknessMm >= 15 ? (
              /* Structural thick 18mm backing flush at rear */
              <>
                <rect x="128" y="8" width="18" height="112" rx="1.5" fill="var(--md-sys-color-primary)" />
                <rect x="18" y="58" width="110" height="12" rx="1.5" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1.8" />
                <text x="73" y="67" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="var(--md-sys-color-on-primary-container)">
                  {`Interior a tope (${usableDepthMm} mm)`}
                </text>
              </>
            ) : hasBacking ? (
              /* Overlay / Applied backing */
              <>
                <rect x="139" y="8" width="7" height="112" rx="1" fill="var(--md-sys-color-primary)" />
                <rect x="18" y="58" width="121" height="12" rx="1.5" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1.8" />
                <text x="78" y="67" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="var(--md-sys-color-on-primary-container)">
                  {`Interior a tope (${usableDepthMm} mm)`}
                </text>
              </>
            ) : (
              /* No backing (open) */
              <>
                <line x1="146" y1="8" x2="146" y2="120" stroke="var(--md-sys-color-error, #ba1a1a)" strokeWidth="2" strokeDasharray="4 3" />
                <rect x="18" y="58" width="128" height="12" rx="1.5" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1.8" />
                <text x="82" y="67" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="var(--md-sys-color-on-primary-container)">
                  {`Paso libre (${usableDepthMm} mm)`}
                </text>
              </>
            )}

            {/* Total depth dimension line */}
            <line x1="8" y1="134" x2="146" y2="134" stroke="var(--md-sys-color-outline)" strokeWidth="1.4" />
            <text x="77" y="145" textAnchor="middle" fontSize="8" fontWeight="700" fill="var(--md-sys-color-outline)">
              {`Prof. Casco: ${depth} mm`}
            </text>
          </g>

          {/* Right: Engineering Summary of Backing & Per-Bay Delimitation */}
          <g transform="translate(174, 14)">
            <rect x="0" y="0" width="154" height="136" rx="10" fill="var(--md-sys-color-surface-container)" stroke="var(--md-sys-color-outline-variant)" strokeWidth="1.2" />
            <text x="12" y="22" fontSize="9.5" fontWeight="800" fill="var(--md-sys-color-primary)">
              {!hasBacking
                ? 'SIN FONDO (ABIERTO)'
                : backingThicknessMm >= 15
                  ? `FONDO ESTRUCTURAL ${backingThicknessMm}mm`
                  : backingType === 'groove'
                    ? `FONDO RANURADO (${backingThicknessMm} mm)`
                    : `FONDO APLICADO (${backingThicknessMm} mm)`}
            </text>
            <text x="12" y="42" fontSize="8" fill="var(--md-sys-color-on-surface)" fontWeight="700">
              {`• Prof. útil vano: ${usableDepthMm} mm`}
            </text>
            <text x="12" y="58" fontSize="7.8" fill="var(--md-sys-color-on-surface-variant)">
              {`• Descuento fondo: -${backingReserveMm} mm`}
            </text>
            <text x="12" y="74" fontSize="7.8" fill="var(--md-sys-color-on-surface-variant)">
              {hasBacking
                ? `• Placas de fondo: ${bayCount} (${bayCount === 1 ? '1 vano' : '1 por vano'})`
                : '• Sin placa trasera'}
            </text>
            <rect x="10" y="88" width="134" height="36" rx="6" fill="var(--md-sys-color-primary-container)" />
            <text x="77" y="103" textAnchor="middle" fontSize="7.6" fontWeight="800" fill="var(--md-sys-color-on-primary-container)">
              ✓ Equipamiento interior a tope
            </text>
            <text x="77" y="116" textAnchor="middle" fontSize="7.2" fill="var(--md-sys-color-on-primary-container)">
              Nunca sobrepasa la placa de fondo
            </text>
          </g>
        </svg>
      )}

      {/* ─────────────────────────────────────────────────────────────
          ETAPA 6: DIVISIÓN DE VANOS (Grilla occidental Izq -> Der con luces reales)
         ───────────────────────────────────────────────────────────── */}
      {step === 'bays-grid' && (
        <svg viewBox="0 0 340 170" style={{ width: '100%', height: '100%' }}>
          <g transform="translate(35, 8)">
            <text x="135" y="10" textAnchor="middle" fontSize="8" fontWeight="800" fill="var(--md-sys-color-primary)">
              {`ORDEN OCCIDENTAL (IZQUIERDA ➔ DERECHA) · ${bayCount} ${bayCount === 1 ? 'VANO' : 'VANOS'}`}
            </text>

            <rect x="10" y="16" width="250" height="110" rx="3" fill="var(--md-sys-color-surface)" stroke="var(--md-sys-color-outline)" strokeWidth="2.2" />

            {Array.from({ length: bayCount }).map((_, idx) => {
              const bayW = 250 / bayCount;
              const bayX = 10 + idx * bayW;
              const isCurrent = idx === activeBayIndex;
              const box = bayBoxes[idx];
              const realBayW = box?.width ?? Math.round((width - (bayCount + 1) * thickness) / bayCount);
              const realBayH = box?.height ?? interiorHeightMm;
              const bayData = bays[idx];

              return (
                <g
                  key={idx}
                  onClick={() => onSelectBayIndex?.(idx)}
                  style={{ cursor: 'pointer' }}
                >
                  {idx > 0 && (
                    <rect
                      x={bayX - 2}
                      y="16"
                      width="4"
                      height="110"
                      fill="var(--md-sys-color-primary)"
                    />
                  )}

                  <rect
                    x={bayX + 3}
                    y="19"
                    width={bayW - 6}
                    height="104"
                    rx="2"
                    fill={isCurrent ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-low)'}
                    stroke={isCurrent ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)'}
                    strokeWidth={isCurrent ? 2 : 1}
                  />

                  <text
                    x={bayX + bayW / 2}
                    y="46"
                    textAnchor="middle"
                    fontSize="9.5"
                    fontWeight="800"
                    fill={isCurrent ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface)'}
                  >
                    {`VANO ${idx + 1}`}
                  </text>
                  <text
                    x={bayX + bayW / 2}
                    y="62"
                    textAnchor="middle"
                    fontSize="8"
                    fontWeight="700"
                    fill="var(--md-sys-color-primary)"
                  >
                    {`${realBayW} × ${realBayH} mm`}
                  </text>
                  <text
                    x={bayX + bayW / 2}
                    y="76"
                    textAnchor="middle"
                    fontSize="7.2"
                    fill="var(--md-sys-color-outline)"
                  >
                    {`Prof. útil: ${box?.depth ?? usableDepthMm} mm`}
                  </text>
                  {hasBacking && (
                    <text
                      x={bayX + bayW / 2}
                      y="92"
                      textAnchor="middle"
                      fontSize="7.2"
                      fontWeight="700"
                      fill="var(--md-sys-color-on-surface-variant)"
                    >
                      {`[Fondo ${idx + 1}]`}
                    </text>
                  )}
                  {bayData?.type === 'subdivided' && (
                    <text
                      x={bayX + bayW / 2}
                      y="110"
                      textAnchor="middle"
                      fontSize="7.5"
                      fontWeight="800"
                      fill="var(--md-sys-color-primary)"
                    >
                      🍱 Matriz activa
                    </text>
                  )}

                  {/* Bottom badge */}
                  <rect
                    x={bayX + bayW / 2 - 24}
                    y="132"
                    width="48"
                    height="16"
                    rx="4"
                    fill={isCurrent ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-high)'}
                  />
                  <text
                    x={bayX + bayW / 2}
                    y="143"
                    textAnchor="middle"
                    fontSize="7.8"
                    fontWeight="800"
                    fill={isCurrent ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-outline)'}
                  >
                    {idx === 0 && bayCount > 1 ? '1 · Izq' : idx === bayCount - 1 && bayCount > 1 ? `${idx + 1} · Der` : `Vano ${idx + 1}`}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      )}

      {/* ─────────────────────────────────────────────────────────────
          ETAPA 7: EQUIPAMIENTO INTERIOR (Elevación dinámica fiel al estado real)
         ───────────────────────────────────────────────────────────── */}
      {step === 'bays-equipment' && (
        <svg viewBox="0 0 340 170" style={{ width: '100%', height: '100%' }}>
          <g transform="translate(35, 8)">
            <rect x="10" y="10" width="250" height="118" rx="3" fill="var(--md-sys-color-surface)" stroke="var(--md-sys-color-outline)" strokeWidth="2.2" />

            {Array.from({ length: bayCount }).map((_, idx) => {
              const bayW = 250 / bayCount;
              const bayX = 10 + idx * bayW;
              const isCurrent = idx === activeBayIndex;
              const bayData = bays[idx];
              const bayType = bayData?.type ?? 'empty';
              const shelfCount = bayData?.type === 'shelves' ? Math.max(1, bayData.count ?? 2) : 0;
              const isFixedShelf = bayData?.type === 'shelves' && bayData.shelfType === 'fixed';
              const drawerCount =
                bayData?.type === 'drawer-stack'
                  ? Math.max(1, bayData.drawerTracks?.length ?? 3)
                  : 0;
              const doorCount = bayData?.type === 'doors' ? (bayData.count ?? 1) : 1;
              const doorHinge = bayData?.type === 'doors' ? (bayData.hingeSide ?? 'left') : 'left';
              const doorShelves = bayData?.type === 'doors' ? (bayData.interiorShelvesCount ?? 0) : 0;

              return (
                <g
                  key={idx}
                  onClick={() => onSelectBayIndex?.(idx)}
                  style={{ cursor: 'pointer' }}
                >
                  {idx > 0 && (
                    <line x1={bayX} y1="10" x2={bayX} y2="128" stroke="var(--md-sys-color-outline)" strokeWidth="2.5" />
                  )}

                  <rect
                    x={bayX + 3}
                    y="13"
                    width={bayW - 6}
                    height="112"
                    fill={isCurrent ? 'var(--md-sys-color-primary-container)' : 'transparent'}
                    stroke={isCurrent ? 'var(--md-sys-color-primary)' : 'transparent'}
                    strokeWidth={isCurrent ? 2 : 0}
                    rx={2}
                    opacity={isCurrent ? 0.55 : 0}
                  />

                  {/* Dynamic Shelves (exact count + fixed/adjustable indicator) */}
                  {bayType === 'shelves' && (
                    <>
                      {Array.from({ length: Math.min(shelfCount, 6) }).map((__, sIdx) => {
                        const stepY = 112 / (Math.min(shelfCount, 6) + 1);
                        const sy = 13 + stepY * (sIdx + 1);
                        return (
                          <line
                            key={sIdx}
                            x1={bayX + 6}
                            y1={sy}
                            x2={bayX + bayW - 6}
                            y2={sy}
                            stroke="var(--md-sys-color-primary)"
                            strokeWidth="2.6"
                            strokeDasharray={isFixedShelf ? 'none' : '5 2'}
                          />
                        );
                      })}
                      <text x={bayX + bayW / 2} y="119" textAnchor="middle" fontSize="7.8" fontWeight="800" fill="var(--md-sys-color-primary)">
                        {`${shelfCount} ${shelfCount === 1 ? 'Estante' : 'Estantes'} (${isFixedShelf ? 'Fijos' : 'Reg.'})`}
                      </text>
                    </>
                  )}

                  {/* Dynamic Drawer Stack (exact drawer count) */}
                  {bayType === 'drawer-stack' && (
                    <>
                      {Array.from({ length: Math.min(drawerCount, 6) }).map((__, dIdx) => {
                        const visibleCount = Math.min(drawerCount, 6);
                        const availH = 104;
                        const gap = 3;
                        const dh = (availH - gap * (visibleCount - 1)) / visibleCount;
                        const dy = 16 + dIdx * (dh + gap);
                        return (
                          <g key={dIdx}>
                            <rect
                              x={bayX + 6}
                              y={dy}
                              width={bayW - 12}
                              height={dh}
                              rx="2"
                              fill="var(--md-sys-color-surface-container-high)"
                              stroke="var(--md-sys-color-primary)"
                              strokeWidth="1.5"
                            />
                            <circle cx={bayX + bayW / 2} cy={dy + dh / 2} r="2.2" fill="var(--md-sys-color-primary)" />
                          </g>
                        );
                      })}
                    </>
                  )}

                  {/* Dynamic Doors (1 or 2 leaves, hinge side, and interior shelves behind door) */}
                  {bayType === 'doors' && (
                    <>
                      {/* Interior shelves behind door (dashed) */}
                      {Array.from({ length: Math.min(doorShelves, 4) }).map((__, sIdx) => {
                        const sy = 15 + (106 / (Math.min(doorShelves, 4) + 1)) * (sIdx + 1);
                        return (
                          <line
                            key={sIdx}
                            x1={bayX + 8}
                            y1={sy}
                            x2={bayX + bayW - 8}
                            y2={sy}
                            stroke="var(--md-sys-color-outline)"
                            strokeWidth="1.4"
                            strokeDasharray="3 3"
                          />
                        );
                      })}

                      {doorCount === 2 ? (
                        <>
                          <rect x={bayX + 6} y="15" width={(bayW - 14) / 2} height="106" rx="2" fill="var(--md-sys-color-surface-container)" fillOpacity="0.78" stroke="var(--md-sys-color-primary)" strokeWidth="1.6" />
                          <rect x={bayX + 8 + (bayW - 14) / 2} y="15" width={(bayW - 14) / 2} height="106" rx="2" fill="var(--md-sys-color-surface-container)" fillOpacity="0.78" stroke="var(--md-sys-color-primary)" strokeWidth="1.6" />
                          <circle cx={bayX + bayW / 2 - 4} cy="68" r="2.3" fill="var(--md-sys-color-primary)" />
                          <circle cx={bayX + bayW / 2 + 4} cy="68" r="2.3" fill="var(--md-sys-color-primary)" />
                        </>
                      ) : (
                        <>
                          <rect x={bayX + 6} y="15" width={bayW - 12} height="106" rx="2" fill="var(--md-sys-color-surface-container)" fillOpacity="0.78" stroke="var(--md-sys-color-primary)" strokeWidth="1.8" />
                          {doorHinge === 'left' ? (
                            <>
                              <polyline points={`${bayX + 7},16 ${bayX + bayW - 7},68 ${bayX + 7},120`} fill="none" stroke="var(--md-sys-color-primary)" strokeWidth="1.1" strokeDasharray="3 3" />
                              <circle cx={bayX + bayW - 13} cy="68" r="2.8" fill="var(--md-sys-color-primary)" />
                            </>
                          ) : (
                            <>
                              <polyline points={`${bayX + bayW - 7},16 ${bayX + 7},68 ${bayX + bayW - 7},120`} fill="none" stroke="var(--md-sys-color-primary)" strokeWidth="1.1" strokeDasharray="3 3" />
                              <circle cx={bayX + 13} cy="68" r="2.8" fill="var(--md-sys-color-primary)" />
                            </>
                          )}
                        </>
                      )}
                      <text x={bayX + bayW / 2} y="116" textAnchor="middle" fontSize="7.4" fontWeight="800" fill="var(--md-sys-color-primary)">
                        {`${doorCount === 2 ? '2 Hojas' : `1 Hoja (${doorHinge === 'left' ? 'Izq' : 'Der'})`}${doorShelves > 0 ? ` + ${doorShelves} Est.` : ''}`}
                      </text>
                    </>
                  )}

                  {bayType === 'subdivided' && (
                    <>
                      <rect x={bayX + 6} y="16" width={(bayW - 14) / 2} height="48" rx="2" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1.4" />
                      <rect x={bayX + 8 + (bayW - 14) / 2} y="16" width={(bayW - 14) / 2} height="48" rx="2" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-primary)" strokeWidth="1.4" />
                      <rect x={bayX + 6} y="68" width={bayW - 12} height="52" rx="2" fill="var(--md-sys-color-surface-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1.4" />
                      <text x={bayX + bayW / 2} y="98" textAnchor="middle" fontSize="8" fontWeight="800" fill="var(--md-sys-color-primary)">🍱 MATRIZ</text>
                    </>
                  )}

                  {bayType === 'empty' && (
                    <text x={bayX + bayW / 2} y="72" textAnchor="middle" fontSize="8.8" fontWeight="700" fill="var(--md-sys-color-outline)">
                      Vano Libre
                    </text>
                  )}

                  {/* Interactive Column label badge */}
                  <rect
                    x={bayX + bayW / 2 - 22}
                    y="133"
                    width="44"
                    height="16"
                    rx="4"
                    fill={isCurrent ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-high)'}
                  />
                  <text
                    x={bayX + bayW / 2}
                    y="144"
                    textAnchor="middle"
                    fontSize="8"
                    fontWeight="bold"
                    fill={isCurrent ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-outline)'}
                  >
                    {`Vano ${idx + 1}`}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}
