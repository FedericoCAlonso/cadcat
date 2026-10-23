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
  activeShellZone?: 'base' | 'plinth-height' | 'roof';
  onSelectShellZone?: (zone: 'base' | 'plinth-height' | 'roof') => void;
  hasBacking?: boolean;
  backingType?: BackingType;
  backingThicknessMm?: number;
  activeBackingZone?: 'anchor' | 'thickness';
  onSelectBackingZone?: (zone: 'anchor' | 'thickness') => void;
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
 * Enlarged, interactive CAD technical schematic for Modo Taller.
 * Takes advantage of the space freed by the unified Thumb Arc philosophy,
 * displaying live dimensions, structural cross-sections, and touchable CAD zones.
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
  activeBackingZone = 'anchor',
  onSelectBackingZone,
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
  const usableDepthMm = Math.max(1, Math.round((depth - backingReserveMm) * 10) / 10);
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
        flex: 1,
        minHeight: '175px',
        maxHeight: '265px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--md-sys-color-surface-container-lowest, #ffffff)',
        borderRadius: '18px',
        border: '1.5px solid var(--md-sys-color-outline-variant, #e0e3e7)',
        boxShadow: '0 6px 18px rgba(0,0,0,0.06)',
        boxSizing: 'border-box',
        padding: '6px 8px',
        overflow: 'hidden',
        position: 'relative',
        margin: '0 auto',
      }}
    >
      {/* ─────────────────────────────────────────────────────────────
          ETAPA 1: MÓDULO Y TIPO (Silueta arquitectónica ampliada)
         ───────────────────────────────────────────────────────────── */}
      {step === 'module-type' && (
        <svg viewBox="0 0 340 185" style={{ width: '100%', height: '100%' }}>
          <defs>
            <pattern id="cad-grid-1" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M 16 0 L 0 0 0 16" fill="none" stroke="var(--md-sys-color-outline-variant)" strokeWidth="0.4" opacity="0.45" />
            </pattern>
          </defs>
          <rect width="340" height="185" fill="url(#cad-grid-1)" />

          {/* Floor Reference Line */}
          <line x1="15" y1="166" x2="325" y2="166" stroke="var(--md-sys-color-outline)" strokeWidth="1.6" strokeDasharray="5 3" />
          <text x="20" y="178" fontSize="8" fill="var(--md-sys-color-outline)" fontWeight="700">NIVEL DE PISO TERMINADO</text>

          {isWallUnit && !isShelvingUnit ? (
            <g transform="translate(70, 12)">
              <line x1="10" y1="4" x2="190" y2="4" stroke="var(--md-sys-color-outline)" strokeWidth="1.4" strokeDasharray="3 3" />
              <text x="100" y="0" textAnchor="middle" fontSize="8" fill="var(--md-sys-color-outline)" fontWeight="700">MURO PORTANTE</text>

              <rect x="20" y="10" width="160" height="86" rx="4" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="2.4" />
              <line x1="100" y1="11" x2="100" y2="95" stroke="var(--md-sys-color-primary)" strokeWidth="1.6" strokeDasharray="3 3" />
              <path d="M 26,15 L 42,15 L 26,31 Z" fill="var(--md-sys-color-primary)" />
              <path d="M 174,15 L 158,15 L 174,31 Z" fill="var(--md-sys-color-primary)" />

              <text x="100" y="48" textAnchor="middle" fontSize="11.5" fontWeight="800" fill="var(--md-sys-color-on-primary-container)">ALACENA COLGANTE</text>
              <text x="100" y="65" textAnchor="middle" fontSize="8.8" fill="var(--md-sys-color-primary)" fontWeight="700">Fijación aérea · Suspendida</text>

              <line x1="100" y1="98" x2="100" y2="148" stroke="var(--md-sys-color-primary)" strokeWidth="1.3" strokeDasharray="3 2" />
              <rect x="38" y="112" width="124" height="20" rx="5" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-primary)" strokeWidth="1.2" />
              <text x="100" y="125" textAnchor="middle" fontSize="8.2" fill="var(--md-sys-color-primary)" fontWeight="700">Despeje sobre mesada</text>
            </g>
          ) : isTallUnit ? (
            <g transform="translate(105, 8)">
              <rect x="12" y="6" width="96" height="142" rx="4" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="2.4" />
              <line x1="12" y1="48" x2="108" y2="48" stroke="var(--md-sys-color-primary)" strokeWidth="2" />
              <line x1="12" y1="100" x2="108" y2="100" stroke="var(--md-sys-color-primary)" strokeWidth="2" />
              <rect x="20" y="148" width="80" height="10" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-outline)" strokeWidth="1.2" />
              <text x="60" y="30" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="var(--md-sys-color-on-primary-container)">ALACENA SUP.</text>
              <text x="60" y="77" textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--md-sys-color-primary)">TORRE / COLUMNA</text>
              <text x="60" y="127" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="var(--md-sys-color-on-primary-container)">BAJO INFERIOR</text>
            </g>
          ) : isDrawerUnit ? (
            <g transform="translate(65, 12)">
              <rect x="20" y="14" width="170" height="114" rx="4" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="2.4" />
              <rect x="27" y="21" width="156" height="28" rx="2.5" fill="var(--md-sys-color-surface)" stroke="var(--md-sys-color-primary)" strokeWidth="1.6" />
              <rect x="27" y="54" width="156" height="30" rx="2.5" fill="var(--md-sys-color-surface)" stroke="var(--md-sys-color-primary)" strokeWidth="1.6" />
              <rect x="27" y="89" width="156" height="32" rx="2.5" fill="var(--md-sys-color-surface)" stroke="var(--md-sys-color-primary)" strokeWidth="1.6" />
              <line x1="88" y1="35" x2="122" y2="35" stroke="var(--md-sys-color-primary)" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="88" y1="69" x2="122" y2="69" stroke="var(--md-sys-color-primary)" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="88" y1="105" x2="122" y2="105" stroke="var(--md-sys-color-primary)" strokeWidth="2.5" strokeLinecap="round" />
              <rect x="36" y="128" width="138" height="26" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-outline)" strokeWidth="1.2" />
              <text x="105" y="144" textAnchor="middle" fontSize="8.2" fontWeight="800" fill="var(--md-sys-color-outline)">CAJONERA MODULAR</text>
            </g>
          ) : isDoorUnit ? (
            <g transform="translate(65, 12)">
              <rect x="20" y="14" width="170" height="114" rx="4" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="2.4" />
              <line x1="105" y1="15" x2="105" y2="127" stroke="var(--md-sys-color-primary)" strokeWidth="2" />
              <polyline points="22,16 103,71 22,126" fill="none" stroke="var(--md-sys-color-primary)" strokeWidth="1.2" strokeDasharray="3 3" />
              <polyline points="188,16 107,71 188,126" fill="none" stroke="var(--md-sys-color-primary)" strokeWidth="1.2" strokeDasharray="3 3" />
              <circle cx="96" cy="71" r="3" fill="var(--md-sys-color-primary)" />
              <circle cx="114" cy="71" r="3" fill="var(--md-sys-color-primary)" />
              <rect x="36" y="128" width="138" height="26" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-outline)" strokeWidth="1.2" />
              <text x="105" y="48" textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--md-sys-color-on-primary-container)">MÓDULO CON PUERTAS</text>
              <text x="105" y="144" textAnchor="middle" fontSize="8.2" fontWeight="700" fill="var(--md-sys-color-outline)">Hojas batientes + Estantes</text>
            </g>
          ) : isPartitionUnit || isShelvingUnit ? (
            <g transform="translate(65, 12)">
              <rect x="20" y="14" width="170" height="114" rx="4" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="2.4" />
              <line x1="105" y1="14" x2="105" y2="128" stroke="var(--md-sys-color-primary)" strokeWidth="2.4" />
              <line x1="20" y1="52" x2="105" y2="52" stroke="var(--md-sys-color-primary)" strokeWidth="2.2" />
              <line x1="20" y1="90" x2="105" y2="90" stroke="var(--md-sys-color-primary)" strokeWidth="2.2" />
              <line x1="105" y1="71" x2="190" y2="71" stroke="var(--md-sys-color-primary)" strokeWidth="2.2" />
              <text x="62" y="36" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="var(--md-sys-color-primary)">Vano 1 (Izq)</text>
              <text x="147" y="46" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="var(--md-sys-color-primary)">Vano 2 (Der)</text>
              <rect x="36" y="128" width="138" height="26" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-outline)" strokeWidth="1.2" />
              <text x="105" y="144" textAnchor="middle" fontSize="8.2" fontWeight="700" fill="var(--md-sys-color-outline)">DIVISIÓN DE VANOS Y ESTANTES</text>
            </g>
          ) : (
            <g transform="translate(65, 12)">
              <rect x="12" y="8" width="186" height="13" rx="3" fill="var(--md-sys-color-surface-container-highest)" stroke="var(--md-sys-color-outline)" strokeWidth="1.3" />
              <text x="105" y="4" textAnchor="middle" fontSize="8.2" fill="var(--md-sys-color-outline)" fontWeight="800">{`MESADA ${depth} mm`}</text>

              <rect x="22" y="21" width="166" height="104" rx="3" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="2.4" />
              <line x1="105" y1="22" x2="105" y2="124" stroke="var(--md-sys-color-primary)" strokeWidth="1.4" strokeDasharray="4 3" />

              <rect x="40" y="125" width="130" height="29" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-outline)" strokeWidth="1.3" />
              <text x="105" y="143" textAnchor="middle" fontSize="8.2" fill="var(--md-sys-color-outline)" fontWeight="700">{`ZÓCALO RETRAÍDO (${plinthHeightMm} mm)`}</text>
              <text x="105" y="76" textAnchor="middle" fontSize="12" fontWeight="900" fill="var(--md-sys-color-on-primary-container)">BAJO MESADA BASE</text>
            </g>
          )}

          {/* Live outer dimensions summary badge */}
          <g transform="translate(226, 8)">
            <rect x="0" y="0" width="106" height="24" rx="7" fill="var(--md-sys-color-surface-container)" stroke="var(--md-sys-color-outline-variant)" strokeWidth="1.2" />
            <text x="53" y="15" textAnchor="middle" fontSize="8.2" fontWeight="800" fill="var(--md-sys-color-primary)">
              {`${width}×${height}×${depth} mm`}
            </text>
          </g>
        </svg>
      )}

      {/* ─────────────────────────────────────────────────────────────
          ETAPA 2: MEDIDAS PRINCIPALES (Isométrico interactivo ampliado)
         ───────────────────────────────────────────────────────────── */}
      {step === 'dimensions' && (
        <svg viewBox="0 0 340 185" style={{ width: '100%', height: '100%' }}>
          <defs>
            <pattern id="cad-grid-2" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M 16 0 L 0 0 0 16" fill="none" stroke="var(--md-sys-color-outline-variant)" strokeWidth="0.4" opacity="0.45" />
            </pattern>
          </defs>
          <rect width="340" height="185" fill="url(#cad-grid-2)" />

          {/* Luz interior útil badge top-right */}
          <g transform="translate(182, 6)">
            <rect x="0" y="0" width="150" height="24" rx="7" fill="var(--md-sys-color-surface-container)" stroke="var(--md-sys-color-outline-variant)" strokeWidth="1.2" />
            <text x="75" y="15" textAnchor="middle" fontSize="8" fontWeight="800" fill="var(--md-sys-color-primary)">
              {`Luz útil: ${interiorWidthMm}×${interiorHeightMm}×${usableDepthMm}`}
            </text>
          </g>

          <g transform="translate(15, 12)">
            {/* Top perspective face */}
            <path
              d="M 65,24 L 190,24 L 238,50 L 113,50 Z"
              onClick={() => onSelectDimension?.('depth')}
              style={{ cursor: 'pointer' }}
              fill={activeDimension === 'depth' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-high)'}
              stroke={activeDimension === 'depth' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)'}
              strokeWidth={activeDimension === 'depth' ? '2.6' : '1.4'}
              opacity="0.94"
            />
            {/* Left side face (depth) */}
            <path
              d="M 65,24 L 113,50 L 113,136 L 65,110 Z"
              onClick={() => onSelectDimension?.('depth')}
              style={{ cursor: 'pointer' }}
              fill={activeDimension === 'depth' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-highest)'}
              stroke={activeDimension === 'depth' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
              strokeWidth={activeDimension === 'depth' ? '2.6' : '1.6'}
            />
            {/* Front face (width & height) */}
            <rect
              x="113"
              y="50"
              width="125"
              height="86"
              rx="2"
              onClick={() => onSelectDimension?.(activeDimension === 'width' ? 'height' : 'width')}
              style={{ cursor: 'pointer' }}
              fill={activeDimension === 'width' || activeDimension === 'height' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface)'}
              stroke={activeDimension === 'width' || activeDimension === 'height' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
              strokeWidth={activeDimension === 'width' || activeDimension === 'height' ? '2.6' : '1.6'}
            />
            {/* Inner carcass cavity showing board thickness */}
            <rect
              x="119"
              y="56"
              width="113"
              height="74"
              rx="1"
              fill="var(--md-sys-color-surface-container-lowest, #ffffff)"
              stroke={activeDimension === 'thickness' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)'}
              strokeWidth={activeDimension === 'thickness' ? '2.2' : '1.1'}
              strokeDasharray={activeDimension === 'thickness' ? 'none' : '3 2'}
              pointerEvents="none"
            />

            {/* Thickness zoomed detail indicator at bottom right corner */}
            <circle
              cx="238"
              cy="136"
              r={activeDimension === 'thickness' ? '9' : '5.5'}
              onClick={() => onSelectDimension?.('thickness')}
              style={{ cursor: 'pointer' }}
              fill={activeDimension === 'thickness' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)'}
              stroke="var(--md-sys-color-surface)"
              strokeWidth="2"
            />

            {/* ── COTA ANCHO (Horizontal front bottom) ── */}
            <g onClick={() => onSelectDimension?.('width')} style={{ cursor: 'pointer' }}>
              <line
                x1="113"
                y1="154"
                x2="238"
                y2="154"
                stroke={activeDimension === 'width' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
                strokeWidth={activeDimension === 'width' ? '2.8' : '1.6'}
              />
              <path d="M 117,150 L 113,154 L 117,158" fill="none" stroke={activeDimension === 'width' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'} strokeWidth="1.8" />
              <path d="M 234,150 L 238,154 L 234,158" fill="none" stroke={activeDimension === 'width' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'} strokeWidth="1.8" />
              <rect
                x="142"
                y="144"
                width="66"
                height="20"
                rx="6"
                fill={activeDimension === 'width' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-high)'}
              />
              <text
                x="175"
                y="157.5"
                textAnchor="middle"
                fontSize="9.2"
                fontWeight="bold"
                fill={activeDimension === 'width' ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)'}
              >
                {`A: ${width} mm`}
              </text>
            </g>

            {/* ── COTA ALTO (Vertical right front) ── */}
            <g onClick={() => onSelectDimension?.('height')} style={{ cursor: 'pointer' }}>
              <line
                x1="250"
                y1="50"
                x2="250"
                y2="136"
                stroke={activeDimension === 'height' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
                strokeWidth={activeDimension === 'height' ? '2.8' : '1.6'}
              />
              <path d="M 246,54 L 250,50 L 254,54" fill="none" stroke={activeDimension === 'height' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'} strokeWidth="1.8" />
              <path d="M 246,132 L 250,136 L 254,132" fill="none" stroke={activeDimension === 'height' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'} strokeWidth="1.8" />
              <rect
                x="255"
                y="82"
                width="64"
                height="20"
                rx="6"
                fill={activeDimension === 'height' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-high)'}
              />
              <text
                x="287"
                y="95.5"
                textAnchor="middle"
                fontSize="9.2"
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
                x2="103"
                y2="46"
                stroke={activeDimension === 'depth' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
                strokeWidth={activeDimension === 'depth' ? '2.8' : '1.6'}
              />
              <rect
                x="38"
                y="36"
                width="66"
                height="20"
                rx="6"
                fill={activeDimension === 'depth' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-high)'}
              />
              <text
                x="71"
                y="49.5"
                textAnchor="middle"
                fontSize="9.2"
                fontWeight="bold"
                fill={activeDimension === 'depth' ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)'}
              >
                {`P: ${depth} mm`}
              </text>
            </g>

            {/* ── COTA ESPESOR (Callout badge) ── */}
            <g onClick={() => onSelectDimension?.('thickness')} style={{ cursor: 'pointer' }}>
              <line x1="242" y1="138" x2="260" y2="144" stroke={activeDimension === 'thickness' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'} strokeWidth="1.3" strokeDasharray="2 2" />
              <rect
                x="260"
                y="134"
                width="58"
                height="20"
                rx="6"
                fill={activeDimension === 'thickness' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-high)'}
              />
              <text
                x="289"
                y="147.5"
                textAnchor="middle"
                fontSize="8.8"
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
        <svg viewBox="0 0 340 185" style={{ width: '100%', height: '100%' }}>
          <defs>
            <pattern id="cad-grid-3" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M 16 0 L 0 0 0 16" fill="none" stroke="var(--md-sys-color-outline-variant)" strokeWidth="0.4" opacity="0.45" />
            </pattern>
          </defs>
          <rect width="340" height="185" fill="url(#cad-grid-3)" />

          <g transform="translate(12, 10)">
            {/* 1. FONDO */}
            <g onClick={() => onSelectMaterialRole?.('backing')} style={{ cursor: 'pointer' }}>
              <rect
                x="12"
                y="8"
                width="74"
                height="110"
                rx="4"
                fill={materialRole === 'backing' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-high)'}
                stroke={materialRole === 'backing' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
                strokeWidth={materialRole === 'backing' ? '2.6' : '1.4'}
                strokeDasharray={materialRole === 'backing' ? 'none' : '3 2'}
              />
              <text x="49" y="58" textAnchor="middle" fontSize="9.8" fontWeight="800" fill={materialRole === 'backing' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface)'}>
                🪵 FONDOS
              </text>
              <text x="49" y="74" textAnchor="middle" fontSize="8" fill="var(--md-sys-color-outline)" fontWeight="700">
                {`${backingThicknessMm} mm · Por vano`}
              </text>
            </g>

            {/* 2. CASCO */}
            <g onClick={() => onSelectMaterialRole?.('carcass')} style={{ cursor: 'pointer' }}>
              <rect
                x="96"
                y="8"
                width="84"
                height="110"
                rx="4"
                fill={materialRole === 'carcass' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-high)'}
                stroke={materialRole === 'carcass' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
                strokeWidth={materialRole === 'carcass' ? '2.6' : '1.5'}
              />
              <rect
                x="102"
                y="14"
                width="72"
                height="98"
                rx="2"
                fill="var(--md-sys-color-surface)"
                stroke="var(--md-sys-color-outline-variant)"
                strokeWidth="1"
              />
              <text x="138" y="58" textAnchor="middle" fontSize="9.8" fontWeight="800" fill={materialRole === 'carcass' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface)'}>
                🏛️ CASCO
              </text>
              <text x="138" y="74" textAnchor="middle" fontSize="8" fill="var(--md-sys-color-outline)" fontWeight="700">
                {`Estructura ${thickness} mm`}
              </text>
            </g>

            {/* 3. CAJONES */}
            <g onClick={() => onSelectMaterialRole?.('drawers')} style={{ cursor: 'pointer' }}>
              <rect
                x="190"
                y="8"
                width="62"
                height="110"
                rx="4"
                fill={materialRole === 'drawers' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-high)'}
                stroke={materialRole === 'drawers' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
                strokeWidth={materialRole === 'drawers' ? '2.6' : '1.4'}
              />
              <rect x="196" y="18" width="50" height="22" rx="2" fill="var(--md-sys-color-surface)" stroke="var(--md-sys-color-outline-variant)" strokeWidth="1" />
              <rect x="196" y="84" width="50" height="24" rx="2" fill="var(--md-sys-color-surface)" stroke="var(--md-sys-color-outline-variant)" strokeWidth="1" />
              <text x="221" y="60" textAnchor="middle" fontSize="9.2" fontWeight="800" fill={materialRole === 'drawers' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface)'}>
                🗄️ CAJONES
              </text>
              <text x="221" y="74" textAnchor="middle" fontSize="7.8" fill="var(--md-sys-color-outline)" fontWeight="700">
                Cajas int.
              </text>
            </g>

            {/* 4. FRENTES */}
            <g onClick={() => onSelectMaterialRole?.('fronts')} style={{ cursor: 'pointer' }}>
              <rect
                x="262"
                y="8"
                width="54"
                height="110"
                rx="4"
                fill={materialRole === 'fronts' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-high)'}
                stroke={materialRole === 'fronts' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
                strokeWidth={materialRole === 'fronts' ? '2.6' : '1.4'}
              />
              <circle cx="270" cy="63" r="3" fill="var(--md-sys-color-primary)" />
              <text x="289" y="58" textAnchor="middle" fontSize="9.2" fontWeight="800" fill={materialRole === 'fronts' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface)'}>
                🚪 FRENTES
              </text>
              <text x="289" y="74" textAnchor="middle" fontSize="7.8" fill="var(--md-sys-color-outline)" fontWeight="700">
                Puertas/Tapas
              </text>
            </g>

            {/* Active Role Technical Status Bar */}
            <rect x="12" y="128" width="304" height="30" rx="8" fill="var(--md-sys-color-surface-container)" stroke="var(--md-sys-color-outline-variant)" strokeWidth="1.2" />
            <text x="164" y="147" textAnchor="middle" fontSize="9" fontWeight="800" fill="var(--md-sys-color-primary)">
              {materialRole === 'carcass' && `Rol activo: Casco Exterior (${activeRoleThicknessMm ?? thickness} mm)${activeMaterialName ? ` · ${activeMaterialName}` : ''}`}
              {materialRole === 'fronts' && `Rol activo: Frentes y Puertas (${activeRoleThicknessMm ?? thickness} mm)${activeMaterialName ? ` · ${activeMaterialName}` : ''}`}
              {materialRole === 'drawers' && `Rol activo: Cajas de Cajón (${activeRoleThicknessMm ?? thickness} mm)${activeMaterialName ? ` · ${activeMaterialName}` : ''}`}
              {materialRole === 'backing' && `Rol activo: Fondos (${activeRoleThicknessMm ?? backingThicknessMm} mm)${activeMaterialName ? ` · ${activeMaterialName}` : ''}`}
            </text>
          </g>
        </svg>
      )}

      {/* ─────────────────────────────────────────────────────────────
          ETAPA 4 UNIFICADA: BASE Y TECHO (Corte estructural interactivo)
         ───────────────────────────────────────────────────────────── */}
      {step === 'base-roof' && (
        <svg viewBox="0 0 340 185" style={{ width: '100%', height: '100%' }}>
          <defs>
            <pattern id="cad-grid-4" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M 16 0 L 0 0 0 16" fill="none" stroke="var(--md-sys-color-outline-variant)" strokeWidth="0.4" opacity="0.45" />
            </pattern>
          </defs>
          <rect width="340" height="185" fill="url(#cad-grid-4)" />

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
              height="168"
              rx="12"
              fill={activeShellZone === 'roof' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-low)'}
              stroke={activeShellZone === 'roof' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)'}
              strokeWidth={activeShellZone === 'roof' ? '2.4' : '1.2'}
              opacity={activeShellZone === 'roof' ? 0.45 : 0.75}
            />
            <text x="78" y="18" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="var(--md-sys-color-primary)">
              1. CIERRE SUPERIOR (TECHO)
            </text>

            {roofType === 'front-back-rails' ? (
              <g transform="translate(18, 30)">
                <rect x="4" y="8" width="10" height="92" fill="var(--md-sys-color-surface-container-highest)" stroke="var(--md-sys-color-outline)" strokeWidth="1.3" />
                <rect x="106" y="8" width="10" height="92" fill="var(--md-sys-color-surface-container-highest)" stroke="var(--md-sys-color-outline)" strokeWidth="1.3" />
                <rect x="14" y="10" width="92" height="20" rx="2" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="2" />
                <rect x="14" y="58" width="92" height="20" rx="2" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="2" />
                <text x="60" y="23" textAnchor="middle" fontSize="7.8" fontWeight="800" fill="var(--md-sys-color-on-primary-container)">FAJA FRONTAL</text>
                <text x="60" y="71" textAnchor="middle" fontSize="7.8" fontWeight="800" fill="var(--md-sys-color-on-primary-container)">FAJA TRASERA</text>
                <text x="60" y="118" textAnchor="middle" fontSize="8.4" fontWeight="800" fill="var(--md-sys-color-primary)">2 Fajas Amarre (Mesada)</text>
              </g>
            ) : roofType === 'none' ? (
              <g transform="translate(18, 30)">
                <line x1="4" y1="6" x2="116" y2="6" stroke="var(--md-sys-color-outline)" strokeWidth="2" strokeDasharray="4 3" />
                <rect x="12" y="10" width="96" height="88" rx="2" fill="var(--md-sys-color-surface)" stroke="var(--md-sys-color-primary)" strokeWidth="2" />
                <line x1="12" y1="10" x2="108" y2="10" stroke="var(--md-sys-color-error, #ba1a1a)" strokeWidth="2.2" strokeDasharray="4 3" />
                <text x="60" y="52" textAnchor="middle" fontSize="9" fontWeight="800" fill="var(--md-sys-color-primary)">SIN TAPA</text>
                <text x="60" y="68" textAnchor="middle" fontSize="7.8" fill="var(--md-sys-color-on-surface-variant)">A tope con cielorraso</text>
                <text x="60" y="118" textAnchor="middle" fontSize="8.4" fontWeight="800" fill="var(--md-sys-color-primary)">Anti-mugre superior</text>
              </g>
            ) : (
              <g transform="translate(18, 30)">
                <rect x="12" y="8" width="96" height="18" rx="2" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="2" />
                <rect x="12" y="26" width="96" height="72" rx="2" fill="var(--md-sys-color-surface)" stroke="var(--md-sys-color-outline)" strokeWidth="1.5" />
                <text x="60" y="20" textAnchor="middle" fontSize="7.8" fontWeight="800" fill="var(--md-sys-color-on-primary-container)">{`TAPA CIEGA ${thickness}mm`}</text>
                <text x="60" y="66" textAnchor="middle" fontSize="8" fill="var(--md-sys-color-outline)">Cierre superior entero</text>
                <text x="60" y="118" textAnchor="middle" fontSize="8.4" fontWeight="800" fill="var(--md-sys-color-primary)">Tapa Ciega Completa</text>
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
              height="168"
              rx="12"
              fill={activeShellZone === 'base' || activeShellZone === 'plinth-height' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-low)'}
              stroke={activeShellZone === 'base' || activeShellZone === 'plinth-height' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)'}
              strokeWidth={activeShellZone === 'base' || activeShellZone === 'plinth-height' ? '2.4' : '1.2'}
              opacity={activeShellZone === 'base' || activeShellZone === 'plinth-height' ? 0.45 : 0.75}
            />
            <text x="78" y="18" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="var(--md-sys-color-primary)">
              2. APOYO INFERIOR (BASE)
            </text>

            {hasWallHangingRail ? (
              <g transform="translate(18, 28)">
                <line x1="12" y1="4" x2="12" y2="102" stroke="var(--md-sys-color-outline)" strokeWidth="2.4" />
                <polygon points="12,18 26,18 16,34 12,34" fill="var(--md-sys-color-primary)" />
                <rect x="24" y="10" width="84" height="78" rx="3" fill="var(--md-sys-color-surface)" stroke="var(--md-sys-color-primary)" strokeWidth="2" />
                <text x="66" y="48" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="var(--md-sys-color-primary)">SUSPENDIDO</text>
                <text x="66" y="64" textAnchor="middle" fontSize="7.5" fill="var(--md-sys-color-outline)">Faja colgado a pared</text>
                <text x="60" y="120" textAnchor="middle" fontSize="8.4" fontWeight="800" fill="var(--md-sys-color-primary)">Flotante / Alacena</text>
              </g>
            ) : hasPlinth ? (
              <g transform="translate(18, 28)">
                <rect x="12" y="6" width="96" height="62" rx="2" fill="var(--md-sys-color-surface)" stroke="var(--md-sys-color-outline)" strokeWidth="1.6" />
                <rect
                  x="28"
                  y="68"
                  width="74"
                  height="32"
                  fill="var(--md-sys-color-primary-container)"
                  stroke="var(--md-sys-color-primary)"
                  strokeWidth="2.2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectShellZone?.('plinth-height');
                  }}
                />
                <line x1="6" y1="100" x2="114" y2="100" stroke="var(--md-sys-color-outline)" strokeWidth="1.5" strokeDasharray="3 3" />
                <text x="65" y="88" textAnchor="middle" fontSize="8.4" fontWeight="800" fill="var(--md-sys-color-on-primary-container)">{`ZÓCALO ${plinthHeightMm} mm`}</text>
                <text x="60" y="40" textAnchor="middle" fontSize="7.8" fill="var(--md-sys-color-on-surface)" fontWeight="700">{`Casco: ${height - plinthHeightMm} mm`}</text>
                <text x="60" y="120" textAnchor="middle" fontSize="8.4" fontWeight="800" fill="var(--md-sys-color-primary)">{`Con Zócalo (${plinthHeightMm} mm)`}</text>
              </g>
            ) : (
              <g transform="translate(18, 28)">
                <rect x="12" y="8" width="96" height="86" rx="2" fill="var(--md-sys-color-surface)" stroke="var(--md-sys-color-outline)" strokeWidth="1.8" />
                <rect x="14" y="94" width="14" height="5" rx="1.5" fill="var(--md-sys-color-primary)" />
                <rect x="92" y="94" width="14" height="5" rx="1.5" fill="var(--md-sys-color-primary)" />
                <line x1="6" y1="99" x2="114" y2="99" stroke="var(--md-sys-color-outline)" strokeWidth="1.5" strokeDasharray="3 3" />
                <text x="60" y="52" textAnchor="middle" fontSize="8.5" fontWeight="800" fill="var(--md-sys-color-on-surface)">APOYO DIRECTO</text>
                <text x="60" y="66" textAnchor="middle" fontSize="7.5" fill="var(--md-sys-color-outline)">Regatón sanitario</text>
                <text x="60" y="120" textAnchor="middle" fontSize="8.4" fontWeight="800" fill="var(--md-sys-color-primary)">Directo al Piso</text>
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
          ETAPA 5: FONDO TRASERO (Corte lateral interactivo con tope interior)
         ───────────────────────────────────────────────────────────── */}
      {step === 'backing' && (
        <svg viewBox="0 0 340 185" style={{ width: '100%', height: '100%' }}>
          <defs>
            <pattern id="cad-grid-5" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M 16 0 L 0 0 0 16" fill="none" stroke="var(--md-sys-color-outline-variant)" strokeWidth="0.4" opacity="0.45" />
            </pattern>
          </defs>
          <rect width="340" height="185" fill="url(#cad-grid-5)" />

          {/* Left: Lateral Cross-Section showing shelf/equipment stopping FLUSH against the backing */}
          <g
            transform="translate(12, 12)"
            onClick={() => onSelectBackingZone?.('anchor')}
            style={{ cursor: 'pointer' }}
          >
            <rect
              x="6"
              y="6"
              width="142"
              height="122"
              rx="4"
              fill="var(--md-sys-color-surface-container-high)"
              stroke={activeBackingZone === 'anchor' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
              strokeWidth={activeBackingZone === 'anchor' ? '2.2' : '1.6'}
            />
            <text x="14" y="20" fontSize="7.8" fontWeight="700" fill="var(--md-sys-color-outline)">FRENTE (z=0)</text>
            <text x="96" y="20" fontSize="7.8" fontWeight="700" fill="var(--md-sys-color-outline)">FONDO</text>

            {hasBacking && backingType === 'groove' && backingThicknessMm < 15 ? (
              <>
                <rect x="118" y="20" width="10" height="96" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1.2" />
                <rect x="120" y="4" width="6" height="128" rx="1" fill="var(--md-sys-color-primary)" />
                <rect x="16" y="62" width="104" height="14" rx="2" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1.8" />
                <text x="68" y="72" textAnchor="middle" fontSize="7.8" fontWeight="800" fill="var(--md-sys-color-on-primary-container)">
                  {`Interior a tope (${usableDepthMm} mm)`}
                </text>
              </>
            ) : hasBacking && backingThicknessMm >= 15 ? (
              <>
                <rect x="130" y="6" width="18" height="122" rx="1.5" fill="var(--md-sys-color-primary)" />
                <rect x="16" y="62" width="114" height="14" rx="2" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1.8" />
                <text x="73" y="72" textAnchor="middle" fontSize="7.8" fontWeight="800" fill="var(--md-sys-color-on-primary-container)">
                  {`Interior a tope (${usableDepthMm} mm)`}
                </text>
              </>
            ) : hasBacking ? (
              <>
                <rect x="141" y="6" width="7" height="122" rx="1" fill="var(--md-sys-color-primary)" />
                <rect x="16" y="62" width="125" height="14" rx="2" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1.8" />
                <text x="78" y="72" textAnchor="middle" fontSize="7.8" fontWeight="800" fill="var(--md-sys-color-on-primary-container)">
                  {`Interior a tope (${usableDepthMm} mm)`}
                </text>
              </>
            ) : (
              <>
                <line x1="148" y1="6" x2="148" y2="128" stroke="var(--md-sys-color-error, #ba1a1a)" strokeWidth="2.2" strokeDasharray="4 3" />
                <rect x="16" y="62" width="132" height="14" rx="2" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1.8" />
                <text x="82" y="72" textAnchor="middle" fontSize="7.8" fontWeight="800" fill="var(--md-sys-color-on-primary-container)">
                  {`Paso libre (${usableDepthMm} mm)`}
                </text>
              </>
            )}

            <line x1="6" y1="142" x2="148" y2="142" stroke="var(--md-sys-color-outline)" strokeWidth="1.5" />
            <text x="77" y="155" textAnchor="middle" fontSize="8.2" fontWeight="800" fill="var(--md-sys-color-outline)">
              {`Prof. Casco: ${depth} mm`}
            </text>
          </g>

          {/* Right: Engineering Summary of Backing & Per-Bay Delimitation */}
          <g
            transform="translate(174, 14)"
            onClick={() => onSelectBackingZone?.('thickness')}
            style={{ cursor: 'pointer' }}
          >
            <rect
              x="0"
              y="0"
              width="154"
              height="152"
              rx="12"
              fill="var(--md-sys-color-surface-container)"
              stroke={activeBackingZone === 'thickness' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)'}
              strokeWidth={activeBackingZone === 'thickness' ? '2.2' : '1.2'}
            />
            <text x="12" y="24" fontSize="9.5" fontWeight="800" fill="var(--md-sys-color-primary)">
              {!hasBacking
                ? 'SIN FONDO (ABIERTO)'
                : backingThicknessMm >= 15
                  ? `FONDO ESTRUCTURAL ${backingThicknessMm}mm`
                  : backingType === 'groove'
                    ? `FONDO RANURADO (${backingThicknessMm} mm)`
                    : `FONDO APLICADO (${backingThicknessMm} mm)`}
            </text>
            <text x="12" y="46" fontSize="8.2" fill="var(--md-sys-color-on-surface)" fontWeight="800">
              {`• Prof. útil vano: ${usableDepthMm} mm`}
            </text>
            <text x="12" y="64" fontSize="8" fill="var(--md-sys-color-on-surface-variant)">
              {`• Descuento fondo: -${backingReserveMm} mm`}
            </text>
            <text x="12" y="82" fontSize="8" fill="var(--md-sys-color-on-surface-variant)">
              {hasBacking
                ? `• Placas de fondo: ${bayCount} (${bayCount === 1 ? '1 vano' : '1 por vano'})`
                : '• Sin placa trasera'}
            </text>
            <rect x="10" y="98" width="134" height="40" rx="8" fill="var(--md-sys-color-primary-container)" />
            <text x="77" y="115" textAnchor="middle" fontSize="7.8" fontWeight="800" fill="var(--md-sys-color-on-primary-container)">
              ✓ Equipamiento interior a tope
            </text>
            <text x="77" y="129" textAnchor="middle" fontSize="7.4" fill="var(--md-sys-color-on-primary-container)">
              Nunca sobrepasa la placa de fondo
            </text>
          </g>
        </svg>
      )}

      {/* ─────────────────────────────────────────────────────────────
          ETAPA 6: DIVISIÓN DE VANOS (Grilla occidental Izq -> Der ampliada)
         ───────────────────────────────────────────────────────────── */}
      {step === 'bays-grid' && (
        <svg viewBox="0 0 340 185" style={{ width: '100%', height: '100%' }}>
          <defs>
            <pattern id="cad-grid-6" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M 16 0 L 0 0 0 16" fill="none" stroke="var(--md-sys-color-outline-variant)" strokeWidth="0.4" opacity="0.45" />
            </pattern>
          </defs>
          <rect width="340" height="185" fill="url(#cad-grid-6)" />

          <g transform="translate(30, 8)">
            <text x="140" y="12" textAnchor="middle" fontSize="8.4" fontWeight="800" fill="var(--md-sys-color-primary)">
              {`ORDEN OCCIDENTAL (IZQUIERDA ➔ DERECHA) · ${bayCount} ${bayCount === 1 ? 'VANO' : 'VANOS'}`}
            </text>

            <rect x="10" y="20" width="260" height="122" rx="4" fill="var(--md-sys-color-surface)" stroke="var(--md-sys-color-outline)" strokeWidth="2.4" />

            {Array.from({ length: bayCount }).map((_, idx) => {
              const bayW = 260 / bayCount;
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
                      y="20"
                      width="4"
                      height="122"
                      fill="var(--md-sys-color-primary)"
                    />
                  )}

                  <rect
                    x={bayX + 3}
                    y="23"
                    width={bayW - 6}
                    height="116"
                    rx="3"
                    fill={isCurrent ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-low)'}
                    stroke={isCurrent ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)'}
                    strokeWidth={isCurrent ? 2.2 : 1}
                  />

                  <text
                    x={bayX + bayW / 2}
                    y="52"
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="900"
                    fill={isCurrent ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface)'}
                  >
                    {`VANO ${idx + 1}`}
                  </text>
                  <text
                    x={bayX + bayW / 2}
                    y="70"
                    textAnchor="middle"
                    fontSize="8.4"
                    fontWeight="800"
                    fill="var(--md-sys-color-primary)"
                  >
                    {`${realBayW} × ${realBayH} mm`}
                  </text>
                  <text
                    x={bayX + bayW / 2}
                    y="86"
                    textAnchor="middle"
                    fontSize="7.6"
                    fill="var(--md-sys-color-outline)"
                  >
                    {`Prof. útil: ${box?.depth ?? usableDepthMm} mm`}
                  </text>
                  {hasBacking && (
                    <text
                      x={bayX + bayW / 2}
                      y="104"
                      textAnchor="middle"
                      fontSize="7.6"
                      fontWeight="700"
                      fill="var(--md-sys-color-on-surface-variant)"
                    >
                      {`[Fondo ${idx + 1}]`}
                    </text>
                  )}
                  {bayData?.type === 'subdivided' && (
                    <text
                      x={bayX + bayW / 2}
                      y="122"
                      textAnchor="middle"
                      fontSize="8"
                      fontWeight="800"
                      fill="var(--md-sys-color-primary)"
                    >
                      🍱 Matriz activa
                    </text>
                  )}

                  <rect
                    x={bayX + bayW / 2 - 26}
                    y="148"
                    width="52"
                    height="18"
                    rx="5"
                    fill={isCurrent ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-high)'}
                  />
                  <text
                    x={bayX + bayW / 2}
                    y="160"
                    textAnchor="middle"
                    fontSize="8"
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
          ETAPA 7: EQUIPAMIENTO INTERIOR (Elevación dinámica ampliada)
         ───────────────────────────────────────────────────────────── */}
      {step === 'bays-equipment' && (
        <svg viewBox="0 0 340 185" style={{ width: '100%', height: '100%' }}>
          <defs>
            <pattern id="cad-grid-7" width="16" height="16" patternUnits="userSpaceOnUse">
              <path d="M 16 0 L 0 0 0 16" fill="none" stroke="var(--md-sys-color-outline-variant)" strokeWidth="0.4" opacity="0.45" />
            </pattern>
          </defs>
          <rect width="340" height="185" fill="url(#cad-grid-7)" />

          <g transform="translate(30, 10)">
            <rect x="10" y="10" width="260" height="130" rx="4" fill="var(--md-sys-color-surface)" stroke="var(--md-sys-color-outline)" strokeWidth="2.4" />

            {Array.from({ length: bayCount }).map((_, idx) => {
              const bayW = 260 / bayCount;
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
                    <line x1={bayX} y1="10" x2={bayX} y2="140" stroke="var(--md-sys-color-outline)" strokeWidth="2.6" />
                  )}

                  <rect
                    x={bayX + 3}
                    y="13"
                    width={bayW - 6}
                    height="124"
                    fill={isCurrent ? 'var(--md-sys-color-primary-container)' : 'transparent'}
                    stroke={isCurrent ? 'var(--md-sys-color-primary)' : 'transparent'}
                    strokeWidth={isCurrent ? 2.2 : 0}
                    rx={3}
                    opacity={isCurrent ? 0.55 : 0}
                  />

                  {/* Dynamic Shelves */}
                  {bayType === 'shelves' && (
                    <>
                      {Array.from({ length: Math.min(shelfCount, 6) }).map((__, sIdx) => {
                        const stepY = 124 / (Math.min(shelfCount, 6) + 1);
                        const sy = 13 + stepY * (sIdx + 1);
                        return (
                          <line
                            key={sIdx}
                            x1={bayX + 6}
                            y1={sy}
                            x2={bayX + bayW - 6}
                            y2={sy}
                            stroke="var(--md-sys-color-primary)"
                            strokeWidth="2.8"
                            strokeDasharray={isFixedShelf ? 'none' : '5 2'}
                          />
                        );
                      })}
                      <text x={bayX + bayW / 2} y="131" textAnchor="middle" fontSize="8" fontWeight="800" fill="var(--md-sys-color-primary)">
                        {`${shelfCount} ${shelfCount === 1 ? 'Estante' : 'Estantes'} (${isFixedShelf ? 'Fijos' : 'Reg.'})`}
                      </text>
                    </>
                  )}

                  {/* Dynamic Drawer Stack */}
                  {bayType === 'drawer-stack' && (
                    <>
                      {Array.from({ length: Math.min(drawerCount, 6) }).map((__, dIdx) => {
                        const visibleCount = Math.min(drawerCount, 6);
                        const availH = 114;
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
                              rx="2.5"
                              fill="var(--md-sys-color-surface-container-high)"
                              stroke="var(--md-sys-color-primary)"
                              strokeWidth="1.6"
                            />
                            <circle cx={bayX + bayW / 2} cy={dy + dh / 2} r="2.4" fill="var(--md-sys-color-primary)" />
                          </g>
                        );
                      })}
                    </>
                  )}

                  {/* Dynamic Doors */}
                  {bayType === 'doors' && (
                    <>
                      {Array.from({ length: Math.min(doorShelves, 4) }).map((__, sIdx) => {
                        const sy = 15 + (118 / (Math.min(doorShelves, 4) + 1)) * (sIdx + 1);
                        return (
                          <line
                            key={sIdx}
                            x1={bayX + 8}
                            y1={sy}
                            x2={bayX + bayW - 8}
                            y2={sy}
                            stroke="var(--md-sys-color-outline)"
                            strokeWidth="1.5"
                            strokeDasharray="3 3"
                          />
                        );
                      })}

                      {doorCount === 2 ? (
                        <>
                          <rect x={bayX + 6} y="15" width={(bayW - 14) / 2} height="118" rx="2" fill="var(--md-sys-color-surface-container)" fillOpacity="0.78" stroke="var(--md-sys-color-primary)" strokeWidth="1.8" />
                          <rect x={bayX + 8 + (bayW - 14) / 2} y="15" width={(bayW - 14) / 2} height="118" rx="2" fill="var(--md-sys-color-surface-container)" fillOpacity="0.78" stroke="var(--md-sys-color-primary)" strokeWidth="1.8" />
                          <circle cx={bayX + bayW / 2 - 4} cy="74" r="2.5" fill="var(--md-sys-color-primary)" />
                          <circle cx={bayX + bayW / 2 + 4} cy="74" r="2.5" fill="var(--md-sys-color-primary)" />
                        </>
                      ) : (
                        <>
                          <rect x={bayX + 6} y="15" width={bayW - 12} height="118" rx="2" fill="var(--md-sys-color-surface-container)" fillOpacity="0.78" stroke="var(--md-sys-color-primary)" strokeWidth="2" />
                          {doorHinge === 'left' ? (
                            <>
                              <polyline points={`${bayX + 7},16 ${bayX + bayW - 7},74 ${bayX + 7},132`} fill="none" stroke="var(--md-sys-color-primary)" strokeWidth="1.2" strokeDasharray="3 3" />
                              <circle cx={bayX + bayW - 13} cy="74" r="3" fill="var(--md-sys-color-primary)" />
                            </>
                          ) : (
                            <>
                              <polyline points={`${bayX + bayW - 7},16 ${bayX + 7},74 ${bayX + bayW - 7},132`} fill="none" stroke="var(--md-sys-color-primary)" strokeWidth="1.2" strokeDasharray="3 3" />
                              <circle cx={bayX + 13} cy="74" r="3" fill="var(--md-sys-color-primary)" />
                            </>
                          )}
                        </>
                      )}
                      <text x={bayX + bayW / 2} y="128" textAnchor="middle" fontSize="7.8" fontWeight="800" fill="var(--md-sys-color-primary)">
                        {`${doorCount === 2 ? '2 Hojas' : `1 Hoja (${doorHinge === 'left' ? 'Izq' : 'Der'})`}${doorShelves > 0 ? ` + ${doorShelves} Est.` : ''}`}
                      </text>
                    </>
                  )}

                  {bayType === 'subdivided' && (
                    <>
                      <rect x={bayX + 6} y="16" width={(bayW - 14) / 2} height="54" rx="2" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1.5" />
                      <rect x={bayX + 8 + (bayW - 14) / 2} y="16" width={(bayW - 14) / 2} height="54" rx="2" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-primary)" strokeWidth="1.5" />
                      <rect x={bayX + 6} y="74" width={bayW - 12} height="58" rx="2" fill="var(--md-sys-color-surface-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1.5" />
                      <text x={bayX + bayW / 2} y="106" textAnchor="middle" fontSize="8.4" fontWeight="800" fill="var(--md-sys-color-primary)">🍱 MATRIZ</text>
                    </>
                  )}

                  {bayType === 'empty' && (
                    <text x={bayX + bayW / 2} y="78" textAnchor="middle" fontSize="9.2" fontWeight="700" fill="var(--md-sys-color-outline)">
                      Vano Libre
                    </text>
                  )}

                  <rect
                    x={bayX + bayW / 2 - 24}
                    y="146"
                    width="48"
                    height="18"
                    rx="5"
                    fill={isCurrent ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-high)'}
                  />
                  <text
                    x={bayX + bayW / 2}
                    y="158"
                    textAnchor="middle"
                    fontSize="8.2"
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
