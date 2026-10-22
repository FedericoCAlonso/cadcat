import { type ReactElement } from 'react';
import { type RoofType, type BackingType, type BayContent } from '../resolver';
import { type ObraGridType, type MaterialRole } from './ModoObraWizard';

export type WorkshopStepId =
  | 'module-type'
  | 'dimensions'
  | 'base-support'
  | 'roof-structure'
  | 'backing'
  | 'bays-equipment'
  | 'material';

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
  hasWallHangingRail?: boolean;
  roofType?: RoofType;
  hasBacking?: boolean;
  backingType?: BackingType;
  gridType?: ObraGridType;
  bays?: BayContent[];
  activeBayIndex?: number;
  materialRole?: MaterialRole;
}

/**
 * Responsive, zero-dependency SVG context diagrams for Modo Taller / Obra.
 * Occupies the upper passive space of the wizard to provide immediate visual feedback.
 * Upgraded with realistic aspect ratio (340x170), generous proportions, and crisp engineering details.
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
  hasWallHangingRail = false,
  roofType = 'front-back-rails',
  hasBacking = true,
  backingType = 'groove',
  gridType = '1-bay',
  bays = [],
  activeBayIndex = 0,
  materialRole = 'carcass',
}: WorkshopContextDiagramProps): ReactElement {
  const isWallUnit = selectedTemplateId.includes('wall') || selectedTemplateId.includes('alacena');
  const isTallUnit = selectedTemplateId.includes('tall') || selectedTemplateId.includes('torre');

  return (
    <div
      role="img"
      aria-label={`Esquema técnico de contexto: ${step}`}
      style={{
        width: '100%',
        maxWidth: '460px',
        height: '180px',
        minHeight: '160px',
        maxHeight: '220px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--md-sys-color-surface-container-lowest, #ffffff)',
        borderRadius: '16px',
        border: '1px solid var(--md-sys-color-outline-variant, #e0e3e7)',
        boxShadow: '0 4px 14px rgba(0,0,0,0.05)',
        boxSizing: 'border-box',
        padding: '6px 8px',
        overflow: 'hidden',
        position: 'relative',
        margin: '0 auto 0.4rem',
        flexShrink: 0,
      }}
    >
      {/* ─────────────────────────────────────────────────────────────
          PASO 1: MÓDULO Y TIPO (Silueta de plantilla en contexto)
         ───────────────────────────────────────────────────────────── */}
      {step === 'module-type' && (
        <svg viewBox="0 0 340 170" style={{ width: '100%', height: '100%' }}>
          {/* Floor Reference Line */}
          <line x1="15" y1="152" x2="325" y2="152" stroke="var(--md-sys-color-outline-variant)" strokeWidth="1.5" strokeDasharray="4 4" />
          <text x="20" y="163" fontSize="8" fill="var(--md-sys-color-outline)" fontWeight="700">PISO DE OBRA</text>

          {isWallUnit ? (
            /* Wall-mounted unit hanging on wall */
            <g transform="translate(75, 12)">
              {/* Wall line & reference */}
              <line x1="5" y1="2" x2="195" y2="2" stroke="var(--md-sys-color-outline)" strokeWidth="1.2" strokeDasharray="3 3" />
              <text x="180" y="-1" fontSize="8" fill="var(--md-sys-color-outline)" fontWeight="600">PARED</text>

              {/* Cabinet box */}
              <rect x="25" y="10" width="140" height="76" rx="4" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="2.2" />
              {/* Doors dividing line */}
              <line x1="95" y1="11" x2="95" y2="85" stroke="var(--md-sys-color-primary)" strokeWidth="1.5" strokeDasharray="3 3" />
              {/* Hanging bracket symbol */}
              <path d="M 32,16 L 46,16 L 46,30 Z" fill="var(--md-sys-color-primary)" />
              <path d="M 158,16 L 144,16 L 144,30 Z" fill="var(--md-sys-color-primary)" />

              <text x="95" y="44" textAnchor="middle" fontSize="11" fontWeight="bold" fill="var(--md-sys-color-on-primary-container)">ALACENA COLGANTE</text>
              <text x="95" y="60" textAnchor="middle" fontSize="8.5" fill="var(--md-sys-color-primary)">2 Puertas batientes</text>

              {/* Clearance line down to base countertop */}
              <line x1="95" y1="88" x2="95" y2="135" stroke="var(--md-sys-color-primary)" strokeWidth="1.2" strokeDasharray="3 2" />
              <rect x="45" y="104" width="100" height="18" rx="4" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-primary)" strokeWidth="1" />
              <text x="95" y="116" textAnchor="middle" fontSize="8" fill="var(--md-sys-color-primary)" fontWeight="bold">Despeje 550-600 mm</text>
            </g>
          ) : isTallUnit ? (
            /* Tall pantry / oven tower */
            <g transform="translate(115, 6)">
              <rect x="15" y="6" width="80" height="142" rx="4" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="2.2" />
              <line x1="15" y1="46" x2="95" y2="46" stroke="var(--md-sys-color-primary)" strokeWidth="1.8" />
              <line x1="15" y1="96" x2="95" y2="96" stroke="var(--md-sys-color-primary)" strokeWidth="1.8" />
              <text x="55" y="30" textAnchor="middle" fontSize="8.5" fontWeight="bold" fill="var(--md-sys-color-on-primary-container)">SUPERIOR</text>
              <text x="55" y="74" textAnchor="middle" fontSize="10" fontWeight="bold" fill="var(--md-sys-color-primary)">TORRE HORNO</text>
              <text x="55" y="122" textAnchor="middle" fontSize="8.5" fontWeight="bold" fill="var(--md-sys-color-on-primary-container)">INFERIOR</text>
            </g>
          ) : (
            /* Standard Bajo Mesada cabinet */
            <g transform="translate(65, 10)">
              {/* Countertop reference slab */}
              <rect x="15" y="8" width="180" height="12" rx="3" fill="var(--md-sys-color-surface-container-highest)" stroke="var(--md-sys-color-outline)" strokeWidth="1.2" />
              <text x="105" y="4" textAnchor="middle" fontSize="8" fill="var(--md-sys-color-outline)" fontWeight="bold">MESADA 600 mm</text>

              {/* Carcass */}
              <rect x="25" y="20" width="160" height="95" rx="3" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="2.2" />
              {/* Center dividing line */}
              <line x1="105" y1="21" x2="105" y2="114" stroke="var(--md-sys-color-primary)" strokeWidth="1.2" strokeDasharray="3 3" />

              {/* Plinth / Zocalo */}
              <rect x="42" y="115" width="126" height="34" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-outline)" strokeWidth="1.2" />
              <text x="105" y="136" textAnchor="middle" fontSize="8" fill="var(--md-sys-color-outline)" fontWeight="600">ZÓCALO RETRAÍDO 50mm</text>
              <text x="105" y="72" textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--md-sys-color-on-primary-container)">BAJO MESADA BASE</text>
            </g>
          )}

          {/* Quick badge top right */}
          <g transform="translate(255, 12)">
            <rect x="0" y="0" width="75" height="20" rx="6" fill="var(--md-sys-color-surface-container)" stroke="var(--md-sys-color-outline-variant)" strokeWidth="1" />
            <text x="37.5" y="14" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="var(--md-sys-color-primary)">⚙️ MODO TALLER</text>
          </g>
        </svg>
      )}

      {/* ─────────────────────────────────────────────────────────────
          PASO 2: MEDIDAS PRINCIPALES (Isométrico con cotas activas)
         ───────────────────────────────────────────────────────────── */}
      {step === 'dimensions' && (
        <svg viewBox="0 0 340 170" style={{ width: '100%', height: '100%' }}>
          <g transform="translate(20, 5)">
            {/* Top perspective face */}
            <path
              d="M 65,22 L 185,22 L 235,48 L 115,48 Z"
              fill={activeDimension === 'depth' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-high)'}
              stroke={activeDimension === 'depth' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)'}
              strokeWidth={activeDimension === 'depth' ? '2.5' : '1.2'}
              opacity="0.9"
            />
            {/* Left side face (depth) */}
            <path
              d="M 65,22 L 115,48 L 115,130 L 65,104 Z"
              fill={activeDimension === 'depth' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-highest)'}
              stroke={activeDimension === 'depth' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
              strokeWidth={activeDimension === 'depth' ? '2.5' : '1.5'}
            />
            {/* Front face (width & height) */}
            <rect
              x="115"
              y="48"
              width="120"
              height="82"
              rx="2"
              fill={activeDimension === 'width' || activeDimension === 'height' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface)'}
              stroke={activeDimension === 'width' || activeDimension === 'height' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
              strokeWidth={activeDimension === 'width' || activeDimension === 'height' ? '2.5' : '1.5'}
            />

            {/* Thickness zoomed detail indicator at bottom right corner */}
            <circle
              cx="235"
              cy="130"
              r={activeDimension === 'thickness' ? '9' : '5'}
              fill={activeDimension === 'thickness' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)'}
              stroke="var(--md-sys-color-surface)"
              strokeWidth="2"
            />

            {/* ── COTA ANCHO (Horizontal front bottom) ── */}
            <g
              onClick={() => onSelectDimension?.('width')}
              style={{ cursor: 'pointer' }}
            >
              <line
                x1="115"
                y1="146"
                x2="235"
                y2="146"
                stroke={activeDimension === 'width' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
                strokeWidth={activeDimension === 'width' ? '2.8' : '1.5'}
              />
              <path d="M 119,142 L 115,146 L 119,150" fill="none" stroke={activeDimension === 'width' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'} strokeWidth="1.8" />
              <path d="M 231,142 L 235,146 L 231,150" fill="none" stroke={activeDimension === 'width' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'} strokeWidth="1.8" />
              <rect
                x="148"
                y="136"
                width="54"
                height="19"
                rx="4"
                fill={activeDimension === 'width' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-high)'}
              />
              <text
                x="175"
                y="149"
                textAnchor="middle"
                fontSize="9"
                fontWeight="bold"
                fill={activeDimension === 'width' ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)'}
              >
                {`${width} mm`}
              </text>
            </g>

            {/* ── COTA ALTO (Vertical right front) ── */}
            <g
              onClick={() => onSelectDimension?.('height')}
              style={{ cursor: 'pointer' }}
            >
              <line
                x1="248"
                y1="48"
                x2="248"
                y2="130"
                stroke={activeDimension === 'height' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
                strokeWidth={activeDimension === 'height' ? '2.8' : '1.5'}
              />
              <path d="M 244,52 L 248,48 L 252,52" fill="none" stroke={activeDimension === 'height' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'} strokeWidth="1.8" />
              <path d="M 244,126 L 248,130 L 252,126" fill="none" stroke={activeDimension === 'height' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'} strokeWidth="1.8" />
              <rect
                x="254"
                y="80"
                width="54"
                height="19"
                rx="4"
                fill={activeDimension === 'height' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-high)'}
              />
              <text
                x="281"
                y="93"
                textAnchor="middle"
                fontSize="9"
                fontWeight="bold"
                fill={activeDimension === 'height' ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)'}
              >
                {`${height} mm`}
              </text>
            </g>

            {/* ── COTA PROFUNDIDAD (Oblique top left) ── */}
            <g
              onClick={() => onSelectDimension?.('depth')}
              style={{ cursor: 'pointer' }}
            >
              <line
                x1="55"
                y1="18"
                x2="105"
                y2="44"
                stroke={activeDimension === 'depth' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
                strokeWidth={activeDimension === 'depth' ? '2.8' : '1.5'}
              />
              <rect
                x="52"
                y="36"
                width="54"
                height="19"
                rx="4"
                fill={activeDimension === 'depth' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-high)'}
              />
              <text
                x="79"
                y="49"
                textAnchor="middle"
                fontSize="9"
                fontWeight="bold"
                fill={activeDimension === 'depth' ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)'}
              >
                {`${depth} mm`}
              </text>
            </g>

            {/* ── COTA ESPESOR (Callout badge) ── */}
            <g
              onClick={() => onSelectDimension?.('thickness')}
              style={{ cursor: 'pointer' }}
            >
              <line x1="240" y1="133" x2="265" y2="138" stroke={activeDimension === 'thickness' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'} strokeWidth="1.2" strokeDasharray="2 2" />
              <rect
                x="266"
                y="128"
                width="54"
                height="19"
                rx="4"
                fill={activeDimension === 'thickness' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-high)'}
              />
              <text
                x="293"
                y="141"
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
          PASO 3: BASE / ESTRUCTURA DE PISO
         ───────────────────────────────────────────────────────────── */}
      {step === 'base-support' && (
        <svg viewBox="0 0 340 170" style={{ width: '100%', height: '100%' }}>
          <line x1="15" y1="152" x2="325" y2="152" stroke="var(--md-sys-color-outline-variant)" strokeWidth="1.5" strokeDasharray="4 4" />
          <text x="20" y="163" fontSize="8" fill="var(--md-sys-color-outline)" fontWeight="700">LÍNEA DE PISO TERMINADO</text>

          {hasWallHangingRail ? (
            /* Wall Hanging Detail */
            <g transform="translate(85, 12)">
              <line x1="20" y1="0" x2="20" y2="140" stroke="var(--md-sys-color-outline)" strokeWidth="2.5" />
              <text x="10" y="70" fontSize="8.5" fill="var(--md-sys-color-outline)" transform="rotate(-90 10 70)">MURO / PARED</text>
              {/* French cleat hanging rail */}
              <polygon points="20,25 36,25 25,45 20,45" fill="var(--md-sys-color-primary)" />
              <polygon points="36,45 20,45 31,25 36,25" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1.2" />
              {/* Cabinet hanging */}
              <rect x="36" y="16" width="120" height="95" rx="3" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-primary)" strokeWidth="2.2" />
              <text x="96" y="62" textAnchor="middle" fontSize="10" fontWeight="bold" fill="var(--md-sys-color-primary)">MÓDULO SUSPENDIDO</text>
              <text x="96" y="78" textAnchor="middle" fontSize="8" fill="var(--md-sys-color-on-surface-variant)">Faja trasera de colgado 18 mm</text>
            </g>
          ) : hasPlinth ? (
            /* Zocalo / Retracted Plinth Detail */
            <g transform="translate(75, 12)">
              <rect x="25" y="12" width="150" height="85" rx="3" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-outline)" strokeWidth="2" />
              {/* Plinth front board with 50mm setback */}
              <rect x="52" y="97" width="115" height="42" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="2.2" />
              <line x1="25" y1="118" x2="52" y2="118" stroke="var(--md-sys-color-primary)" strokeWidth="1.5" />
              <text x="38" y="114" textAnchor="middle" fontSize="8" fontWeight="bold" fill="var(--md-sys-color-primary)">50mm</text>
              <text x="110" y="122" textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--md-sys-color-on-primary-container)">ZÓCALO RETRAÍDO</text>
              <text x="100" y="58" textAnchor="middle" fontSize="10.5" fontWeight="bold" fill="var(--md-sys-color-on-surface)">Piso de mueble asentado</text>
            </g>
          ) : (
            /* Direct floor support */
            <g transform="translate(75, 12)">
              <rect x="25" y="12" width="150" height="126" rx="3" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-outline)" strokeWidth="2" />
              <rect x="23" y="138" width="16" height="7" rx="2" fill="var(--md-sys-color-primary)" />
              <rect x="161" y="138" width="16" height="7" rx="2" fill="var(--md-sys-color-primary)" />
              <text x="100" y="70" textAnchor="middle" fontSize="10.5" fontWeight="bold" fill="var(--md-sys-color-on-surface)">APOYO DIRECTO A PISO</text>
              <text x="100" y="88" textAnchor="middle" fontSize="8.5" fill="var(--md-sys-color-outline)">Costados con regatón antihumedad</text>
            </g>
          )}
        </svg>
      )}

      {/* ─────────────────────────────────────────────────────────────
          PASO 4: TECHO / AMARRES SUPERIORES
         ───────────────────────────────────────────────────────────── */}
      {step === 'roof-structure' && (
        <svg viewBox="0 0 340 170" style={{ width: '100%', height: '100%' }}>
          {roofType === 'front-back-rails' ? (
            /* 2 Tie Rails for Countertop */
            <g transform="translate(65, 14)">
              <rect x="10" y="10" width="16" height="110" rx="2" fill="var(--md-sys-color-surface-container-highest)" stroke="var(--md-sys-color-outline)" strokeWidth="1.5" />
              <rect x="184" y="10" width="16" height="110" rx="2" fill="var(--md-sys-color-surface-container-highest)" stroke="var(--md-sys-color-outline)" strokeWidth="1.5" />
              {/* Front Tie Rail */}
              <rect x="26" y="16" width="158" height="26" rx="3" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="2" />
              <text x="105" y="32" textAnchor="middle" fontSize="9" fontWeight="bold" fill="var(--md-sys-color-on-primary-container)">FAJA FRONTAL (80 mm)</text>
              {/* Rear Tie Rail */}
              <rect x="26" y="88" width="158" height="26" rx="3" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="2" />
              <text x="105" y="104" textAnchor="middle" fontSize="9" fontWeight="bold" fill="var(--md-sys-color-on-primary-container)">FAJA TRASERA (80 mm)</text>
              <text x="105" y="68" textAnchor="middle" fontSize="9.5" fill="var(--md-sys-color-primary)" fontWeight="bold">✨ Centro abierto para bacha / anafe</text>
            </g>
          ) : roofType === 'none' ? (
            /* Open Top to Ceiling */
            <g transform="translate(75, 12)">
              <line x1="10" y1="12" x2="190" y2="12" stroke="var(--md-sys-color-outline)" strokeWidth="2" strokeDasharray="4 4" />
              <text x="100" y="8" textAnchor="middle" fontSize="8" fill="var(--md-sys-color-outline)" fontWeight="bold">CIELORRASO / TECHO</text>
              <rect x="25" y="16" width="150" height="115" rx="3" fill="var(--md-sys-color-surface-container-low)" stroke="var(--md-sys-color-primary)" strokeWidth="2.2" />
              <line x1="25" y1="16" x2="175" y2="16" stroke="var(--md-sys-color-error, #ba1a1a)" strokeWidth="2" strokeDasharray="5 3" />
              <text x="100" y="55" textAnchor="middle" fontSize="10.5" fontWeight="800" fill="var(--md-sys-color-primary)">SIN TAPA (HASTA EL TECHO)</text>
              <text x="100" y="74" textAnchor="middle" fontSize="8.5" fill="var(--md-sys-color-on-surface-variant)">Evita hueco juntamugre superior</text>
              <text x="100" y="92" textAnchor="middle" fontSize="8.5" fill="var(--md-sys-color-primary)" fontWeight="bold">Fondo deslizable desde arriba ⤵</text>
            </g>
          ) : (
            /* Solid Full Panel Roof */
            <g transform="translate(75, 14)">
              <rect x="25" y="12" width="150" height="24" rx="3" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="2.2" />
              <text x="100" y="27" textAnchor="middle" fontSize="9.5" fontWeight="bold" fill="var(--md-sys-color-on-primary-container)">TAPA CIEGA COMPLETA (18 mm)</text>
              <rect x="25" y="36" width="150" height="92" rx="2" fill="var(--md-sys-color-surface)" stroke="var(--md-sys-color-outline)" strokeWidth="1.5" />
              <text x="100" y="86" textAnchor="middle" fontSize="9" fill="var(--md-sys-color-outline)">Cierre estanco superior tradicional</text>
            </g>
          )}
        </svg>
      )}

      {/* ─────────────────────────────────────────────────────────────
          PASO 5: FONDO TRASERO
         ───────────────────────────────────────────────────────────── */}
      {step === 'backing' && (
        <svg viewBox="0 0 340 170" style={{ width: '100%', height: '100%' }}>
          {backingType === 'groove' && hasBacking ? (
            /* Cross section of 4mm groove detail */
            <g transform="translate(65, 12)">
              <rect x="20" y="10" width="45" height="125" rx="2" fill="var(--md-sys-color-surface-container-highest)" stroke="var(--md-sys-color-outline)" strokeWidth="1.8" />
              <rect x="36" y="24" width="10" height="95" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1.5" />
              <rect x="39" y="6" width="4.5" height="135" fill="var(--md-sys-color-primary)" />
              <text x="85" y="38" fontSize="10.5" fontWeight="bold" fill="var(--md-sys-color-primary)">RANURADO 4 mm</text>
              <text x="85" y="56" fontSize="8.5" fill="var(--md-sys-color-on-surface-variant)">Embutido a 10 mm del borde</text>
              <text x="85" y="74" fontSize="8.5" fill="var(--md-sys-color-outline)">Escuadra automática de taller</text>
              <text x="85" y="92" fontSize="8.5" fontWeight="bold" fill="var(--md-sys-color-primary)">✓ Fijación oculta profesional</text>
            </g>
          ) : hasBacking ? (
            /* Applied / Nailed backing */
            <g transform="translate(65, 14)">
              <rect x="25" y="12" width="40" height="120" rx="2" fill="var(--md-sys-color-surface-container-highest)" stroke="var(--md-sys-color-outline)" strokeWidth="1.8" />
              <rect x="18" y="8" width="7" height="128" fill="var(--md-sys-color-primary)" />
              <text x="80" y="44" fontSize="10.5" fontWeight="bold" fill="var(--md-sys-color-primary)">FONDO CLAVADO / ATORNILLADO</text>
              <text x="80" y="66" fontSize="8.5" fill="var(--md-sys-color-on-surface-variant)">Fijación directa perimetral por detrás</text>
              <text x="80" y="88" fontSize="8.5" fill="var(--md-sys-color-outline)">Montaje rápido en obra</text>
            </g>
          ) : (
            /* No backing */
            <g transform="translate(85, 18)">
              <rect x="20" y="10" width="130" height="105" rx="3" fill="none" stroke="var(--md-sys-color-outline)" strokeWidth="2" strokeDasharray="5 4" />
              <text x="85" y="54" textAnchor="middle" fontSize="10.5" fontWeight="bold" fill="var(--md-sys-color-error, #ba1a1a)">SIN FONDO (VANO ABIERTO)</text>
              <text x="85" y="74" textAnchor="middle" fontSize="8.5" fill="var(--md-sys-color-outline)">Para llaves de gas, cañerías o térmicas</text>
            </g>
          )}
        </svg>
      )}

      {/* ─────────────────────────────────────────────────────────────
          PASO 6: VANOS Y EQUIPAMIENTO (Elevación frontal dinámica)
         ───────────────────────────────────────────────────────────── */}
      {step === 'bays-equipment' && (
        <svg viewBox="0 0 340 170" style={{ width: '100%', height: '100%' }}>
          <g transform="translate(50, 10)">
            <rect x="10" y="8" width="220" height="118" rx="3" fill="var(--md-sys-color-surface)" stroke="var(--md-sys-color-outline)" strokeWidth="2" />

            {(() => {
              const count = gridType === '3-bays-vertical' ? 3 : gridType === '2-bays-vertical' ? 2 : 1;
              const bayW = 220 / count;

              return Array.from({ length: count }).map((_, idx) => {
                const bayX = 10 + idx * bayW;
                const isCurrent = idx === activeBayIndex;
                const bayData = bays[idx];
                const bayType = bayData?.type ?? 'empty';

                return (
                  <g key={idx}>
                    {idx > 0 && (
                      <line x1={bayX} y1="8" x2={bayX} y2="126" stroke="var(--md-sys-color-outline)" strokeWidth="2.5" />
                    )}

                    <rect
                      x={bayX + 3}
                      y="11"
                      width={bayW - 6}
                      height="112"
                      fill={isCurrent ? 'var(--md-sys-color-primary-container)' : 'transparent'}
                      stroke={isCurrent ? 'var(--md-sys-color-primary)' : 'transparent'}
                      strokeWidth={isCurrent ? 2 : 0}
                      rx={2}
                      opacity={isCurrent ? 0.7 : 0}
                    />

                    {bayType === 'shelves' && (
                      <>
                        <line x1={bayX + 6} y1="46" x2={bayX + bayW - 6} y2="46" stroke="var(--md-sys-color-primary)" strokeWidth="2.5" />
                        <line x1={bayX + 6} y1="84" x2={bayX + bayW - 6} y2="84" stroke="var(--md-sys-color-primary)" strokeWidth="2.5" />
                        <text x={bayX + bayW / 2} y="108" textAnchor="middle" fontSize="8.5" fontWeight="bold" fill="var(--md-sys-color-primary)">ESTANTES</text>
                      </>
                    )}

                    {bayType === 'drawer-stack' && (
                      <>
                        <rect x={bayX + 6} y="15" width={bayW - 12} height="28" rx="2" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-primary)" strokeWidth="1.5" />
                        <rect x={bayX + 6} y="49" width={bayW - 12} height="28" rx="2" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-primary)" strokeWidth="1.5" />
                        <rect x={bayX + 6} y="83" width={bayW - 12} height="36" rx="2" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-primary)" strokeWidth="1.5" />
                        <circle cx={bayX + bayW / 2} cy="29" r="2.5" fill="var(--md-sys-color-primary)" />
                        <circle cx={bayX + bayW / 2} cy="63" r="2.5" fill="var(--md-sys-color-primary)" />
                        <circle cx={bayX + bayW / 2} cy="101" r="2.5" fill="var(--md-sys-color-primary)" />
                      </>
                    )}

                    {bayType === 'doors' && (
                      <>
                        <rect x={bayX + 6} y="14" width={bayW - 12} height="106" rx="2" fill="var(--md-sys-color-surface-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1.8" />
                        <line x1={bayX + 8} y1="16" x2={bayX + bayW - 8} y2="118" stroke="var(--md-sys-color-outline-variant)" strokeWidth="1.2" strokeDasharray="3 3" />
                        <circle cx={bayX + bayW - 14} cy="66" r="3" fill="var(--md-sys-color-primary)" />
                        <text x={bayX + bayW / 2} y="62" textAnchor="middle" fontSize="9" fontWeight="bold" fill="var(--md-sys-color-primary)">PUERTA</text>
                      </>
                    )}

                    {bayType === 'empty' && (
                      <text x={bayX + bayW / 2} y="68" textAnchor="middle" fontSize="9" fill="var(--md-sys-color-outline)">Libre</text>
                    )}

                    {/* Column label badge */}
                    <rect x={bayX + bayW / 2 - 18} y="132" width="36" height="15" rx="3" fill={isCurrent ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-high)'} />
                    <text x={bayX + bayW / 2} y="142.5" textAnchor="middle" fontSize="8" fontWeight="bold" fill={isCurrent ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-outline)'}>
                      {`Vano ${idx + 1}`}
                    </text>
                  </g>
                );
              });
            })()}
          </g>
        </svg>
      )}

      {/* ─────────────────────────────────────────────────────────────
          PASO 7: TABLERO / MELAMINA (Despiece por capas coloreadas)
         ───────────────────────────────────────────────────────────── */}
      {step === 'material' && (
        <svg viewBox="0 0 340 170" style={{ width: '100%', height: '100%' }}>
          <g transform="translate(70, 10)">
            <rect
              x="20"
              y="14"
              width="100"
              height="95"
              rx="3"
              fill={materialRole === 'carcass' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-high)'}
              stroke={materialRole === 'carcass' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
              strokeWidth={materialRole === 'carcass' ? '2.5' : '1.5'}
            />

            <rect
              x="135"
              y="14"
              width="60"
              height="95"
              rx="3"
              fill={materialRole === 'fronts' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-high)'}
              stroke={materialRole === 'fronts' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
              strokeWidth={materialRole === 'fronts' ? '2.5' : '1.5'}
            />
            <circle cx="145" cy="62" r="3" fill="var(--md-sys-color-primary)" />

            <text x="70" y="66" textAnchor="middle" fontSize="10.5" fontWeight="bold" fill={materialRole === 'carcass' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface)'}>
              CASCO
            </text>
            <text x="165" y="66" textAnchor="middle" fontSize="10" fontWeight="bold" fill={materialRole === 'fronts' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface)'}>
              FRENTES
            </text>

            <rect x="25" y="122" width="170" height="20" rx="5" fill="var(--md-sys-color-surface-container)" stroke="var(--md-sys-color-outline-variant)" strokeWidth="1" />
            <text x="110" y="135" textAnchor="middle" fontSize="8.5" fontWeight="bold" fill="var(--md-sys-color-primary)">
              {materialRole === 'carcass' && 'Editando Placa para: Casco Exterior'}
              {materialRole === 'fronts' && 'Editando Placa para: Frentes y Puertas'}
              {materialRole === 'drawers' && 'Editando Placa para: Cajas de Cajón'}
              {materialRole === 'backing' && 'Editando Placa para: Fondos de 3mm'}
            </text>
          </g>
        </svg>
      )}
    </div>
  );
}
