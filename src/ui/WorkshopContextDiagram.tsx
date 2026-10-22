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
        maxWidth: '420px',
        height: '96px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--md-sys-color-surface-container-low, #f7f9fc)',
        borderRadius: '14px',
        border: '1px solid var(--md-sys-color-outline-variant, #e0e3e7)',
        boxSizing: 'border-box',
        padding: '2px 6px',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* ─────────────────────────────────────────────────────────────
          PASO 1: MÓDULO Y TIPO (Silueta de plantilla en contexto)
         ───────────────────────────────────────────────────────────── */}
      {step === 'module-type' && (
        <svg viewBox="0 0 280 90" style={{ width: '100%', height: '100%' }}>
          {/* Wall background grid reference */}
          <line x1="20" y1="78" x2="260" y2="78" stroke="var(--md-sys-color-outline-variant)" strokeWidth="1.5" strokeDasharray="3 3" />
          <text x="25" y="86" fontSize="7" fill="var(--md-sys-color-outline)" fontWeight="600">PISO DE OBRA</text>

          {isWallUnit ? (
            /* Wall-mounted unit hanging on wall */
            <g transform="translate(70, 8)">
              {/* Wall bracket */}
              <line x1="-15" y1="2" x2="155" y2="2" stroke="var(--md-sys-color-outline)" strokeWidth="1" strokeDasharray="2 2" />
              <text x="145" y="-1" fontSize="7" fill="var(--md-sys-color-outline)">PARED</text>
              {/* Cabinet box */}
              <rect x="25" y="8" width="90" height="48" rx="3" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1.8" />
              {/* Doors dividing line */}
              <line x1="70" y1="9" x2="70" y2="55" stroke="var(--md-sys-color-primary)" strokeWidth="1" strokeDasharray="2 2" />
              {/* Hanging bracket symbol */}
              <path d="M 30,12 L 40,12 L 40,22 Z" fill="var(--md-sys-color-primary)" />
              <text x="70" y="34" textAnchor="middle" fontSize="8" fontWeight="bold" fill="var(--md-sys-color-on-primary-container)">ALACENA COLGANTE</text>
              {/* Clearance line */}
              <line x1="70" y1="56" x2="70" y2="70" stroke="var(--md-sys-color-primary)" strokeWidth="1" markerEnd="url(#arrow)" />
              <text x="75" y="66" fontSize="6.5" fill="var(--md-sys-color-primary)" fontWeight="bold">↕ Despeje 550-600 mm</text>
            </g>
          ) : isTallUnit ? (
            /* Tall pantry / oven tower */
            <g transform="translate(90, 4)">
              <rect x="20" y="2" width="60" height="72" rx="3" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1.8" />
              <line x1="20" y1="26" x2="80" y2="26" stroke="var(--md-sys-color-primary)" strokeWidth="1.2" />
              <line x1="20" y1="50" x2="80" y2="50" stroke="var(--md-sys-color-primary)" strokeWidth="1.2" />
              <text x="50" y="16" textAnchor="middle" fontSize="7" fontWeight="bold" fill="var(--md-sys-color-on-primary-container)">SUPERIOR</text>
              <text x="50" y="40" textAnchor="middle" fontSize="7.5" fontWeight="bold" fill="var(--md-sys-color-primary)">TORRE HORNO</text>
              <text x="50" y="64" textAnchor="middle" fontSize="7" fontWeight="bold" fill="var(--md-sys-color-on-primary-container)">INFERIOR</text>
            </g>
          ) : (
            /* Standard Bajo Mesada cabinet */
            <g transform="translate(60, 6)">
              {/* Countertop reference slab */}
              <rect x="15" y="6" width="130" height="7" rx="1.5" fill="var(--md-sys-color-surface-container-highest)" stroke="var(--md-sys-color-outline)" strokeWidth="1" />
              <text x="80" y="4" textAnchor="middle" fontSize="6.5" fill="var(--md-sys-color-outline)" fontWeight="bold">MESADA 600 mm</text>
              {/* Carcass */}
              <rect x="25" y="14" width="110" height="52" rx="2" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1.8" />
              {/* Plinth / Zocalo */}
              <rect x="35" y="66" width="90" height="12" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-outline)" strokeWidth="1" />
              <text x="80" y="74" textAnchor="middle" fontSize="6" fill="var(--md-sys-color-outline)">ZÓCALO RETRAÍDO 50mm</text>
              <text x="80" y="42" textAnchor="middle" fontSize="9" fontWeight="800" fill="var(--md-sys-color-on-primary-container)">BAJO MESADA BASE</text>
            </g>
          )}

          {/* Quick badge top right */}
          <g transform="translate(205, 10)">
            <rect x="0" y="0" width="70" height="18" rx="6" fill="var(--md-sys-color-surface-container)" stroke="var(--md-sys-color-outline-variant)" strokeWidth="1" />
            <text x="35" y="12" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="var(--md-sys-color-primary)">⚙️ MODO TALLER</text>
          </g>
        </svg>
      )}

      {/* ─────────────────────────────────────────────────────────────
          PASO 2: MEDIDAS PRINCIPALES (Isométrico con cotas activas)
         ───────────────────────────────────────────────────────────── */}
      {step === 'dimensions' && (
        <svg viewBox="0 0 280 92" style={{ width: '100%', height: '100%' }}>
          {/* Isometric Cabinet Box
              Origin: (100, 52)
              Front face: x=100..180, y=28..72 (width=80, height=44)
              Depth offset: dx=-35, dy=-14 (depth vector)
          */}
          <g transform="translate(10, 0)">
            {/* Rear hidden/perspective lines */}
            <path
              d="M 65,14 L 145,14 L 180,28 L 100,28 Z"
              fill={activeDimension === 'depth' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-high)'}
              stroke={activeDimension === 'depth' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)'}
              strokeWidth={activeDimension === 'depth' ? '2' : '1'}
              opacity="0.85"
            />
            {/* Left side face (depth representation) */}
            <path
              d="M 65,14 L 100,28 L 100,72 L 65,58 Z"
              fill={activeDimension === 'depth' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-highest)'}
              stroke={activeDimension === 'depth' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
              strokeWidth={activeDimension === 'depth' ? '2.2' : '1.2'}
            />
            {/* Front face (width & height representation) */}
            <rect
              x="100"
              y="28"
              width="80"
              height="44"
              rx="1"
              fill={activeDimension === 'width' || activeDimension === 'height' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface)'}
              stroke={activeDimension === 'width' || activeDimension === 'height' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
              strokeWidth={activeDimension === 'width' || activeDimension === 'height' ? '2.2' : '1.2'}
            />

            {/* Thickness zoomed detail indicator at bottom right corner */}
            <circle
              cx="180"
              cy="72"
              r={activeDimension === 'thickness' ? '7' : '4'}
              fill={activeDimension === 'thickness' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)'}
              stroke="var(--md-sys-color-surface)"
              strokeWidth="1.5"
            />

            {/* ── COTA ANCHO (Horizontal front bottom) ── */}
            <g
              onClick={() => onSelectDimension?.('width')}
              style={{ cursor: 'pointer' }}
            >
              <line
                x1="100"
                y1="82"
                x2="180"
                y2="82"
                stroke={activeDimension === 'width' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
                strokeWidth={activeDimension === 'width' ? '2.5' : '1.2'}
              />
              <path d="M 103,79.5 L 100,82 L 103,84.5" fill="none" stroke={activeDimension === 'width' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'} strokeWidth="1.5" />
              <path d="M 177,79.5 L 180,82 L 177,84.5" fill="none" stroke={activeDimension === 'width' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'} strokeWidth="1.5" />
              <rect
                x="122"
                y="74"
                width="36"
                height="13"
                rx="3"
                fill={activeDimension === 'width' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-high)'}
              />
              <text
                x="140"
                y="83"
                textAnchor="middle"
                fontSize="7.5"
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
                x1="190"
                y1="28"
                x2="190"
                y2="72"
                stroke={activeDimension === 'height' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
                strokeWidth={activeDimension === 'height' ? '2.5' : '1.2'}
              />
              <path d="M 187.5,31 L 190,28 L 192.5,31" fill="none" stroke={activeDimension === 'height' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'} strokeWidth="1.5" />
              <path d="M 187.5,69 L 190,72 L 192.5,69" fill="none" stroke={activeDimension === 'height' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'} strokeWidth="1.5" />
              <rect
                x="194"
                y="43"
                width="36"
                height="13"
                rx="3"
                fill={activeDimension === 'height' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-high)'}
              />
              <text
                x="212"
                y="52"
                textAnchor="middle"
                fontSize="7.5"
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
                x1="60"
                y1="12"
                x2="95"
                y2="26"
                stroke={activeDimension === 'depth' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
                strokeWidth={activeDimension === 'depth' ? '2.5' : '1.2'}
              />
              <rect
                x="56"
                y="26"
                width="36"
                height="13"
                rx="3"
                fill={activeDimension === 'depth' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-high)'}
              />
              <text
                x="74"
                y="35"
                textAnchor="middle"
                fontSize="7.5"
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
              <line x1="184" y1="74" x2="215" y2="78" stroke={activeDimension === 'thickness' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'} strokeWidth="1" strokeDasharray="1.5 1.5" />
              <rect
                x="216"
                y="71"
                width="44"
                height="13"
                rx="3"
                fill={activeDimension === 'thickness' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-high)'}
              />
              <text
                x="238"
                y="80"
                textAnchor="middle"
                fontSize="7"
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
        <svg viewBox="0 0 280 90" style={{ width: '100%', height: '100%' }}>
          {/* Floor Reference Line */}
          <line x1="15" y1="78" x2="265" y2="78" stroke="var(--md-sys-color-outline-variant)" strokeWidth="1.5" strokeDasharray="3 3" />
          <text x="20" y="86" fontSize="6.5" fill="var(--md-sys-color-outline)">LÍNEA DE PISO TERMINADO</text>

          {hasWallHangingRail ? (
            /* Wall Hanging Detail */
            <g transform="translate(70, 4)">
              {/* Wall line */}
              <line x1="20" y1="0" x2="20" y2="80" stroke="var(--md-sys-color-outline)" strokeWidth="2" />
              <text x="12" y="45" fontSize="7" fill="var(--md-sys-color-outline)" transform="rotate(-90 12 45)">MURO / PARED</text>
              {/* French cleat / Hanging rail */}
              <polygon points="20,15 32,15 24,27 20,27" fill="var(--md-sys-color-primary)" />
              <polygon points="32,27 20,27 28,15 32,15" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1" />
              {/* Cabinet hanging */}
              <rect x="32" y="10" width="85" height="52" rx="2" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-primary)" strokeWidth="1.6" />
              <text x="74" y="38" textAnchor="middle" fontSize="7.5" fontWeight="bold" fill="var(--md-sys-color-primary)">MÓDULO SUSPENDIDO</text>
              <text x="74" y="48" textAnchor="middle" fontSize="6.5" fill="var(--md-sys-color-on-surface-variant)">Faja trasera de colgado 18 mm</text>
            </g>
          ) : hasPlinth ? (
            /* Zocalo / Retracted Plinth Detail */
            <g transform="translate(60, 6)">
              {/* Carcass side & bottom */}
              <rect x="25" y="8" width="120" height="48" rx="2" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-outline)" strokeWidth="1.5" />
              {/* Plinth front board with 50mm setback */}
              <rect x="42" y="56" width="90" height="22" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1.8" />
              {/* Setback dimension arrow */}
              <line x1="25" y1="67" x2="42" y2="67" stroke="var(--md-sys-color-primary)" strokeWidth="1.2" />
              <text x="33" y="64" textAnchor="middle" fontSize="6" fontWeight="bold" fill="var(--md-sys-color-primary)">50mm</text>
              <text x="87" y="69" textAnchor="middle" fontSize="7.5" fontWeight="800" fill="var(--md-sys-color-on-primary-container)">ZÓCALO RETRAÍDO</text>
              <text x="85" y="34" textAnchor="middle" fontSize="8" fontWeight="bold" fill="var(--md-sys-color-on-surface)">Piso de mueble asentado</text>
            </g>
          ) : (
            /* Direct floor support */
            <g transform="translate(60, 6)">
              <rect x="25" y="8" width="120" height="66" rx="2" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-outline)" strokeWidth="1.5" />
              {/* Glides / Regatones */}
              <rect x="23" y="74" width="12" height="4" rx="1" fill="var(--md-sys-color-primary)" />
              <rect x="135" y="74" width="12" height="4" rx="1" fill="var(--md-sys-color-primary)" />
              <text x="85" y="42" textAnchor="middle" fontSize="8" fontWeight="bold" fill="var(--md-sys-color-on-surface)">APOYO DIRECTO A PISO</text>
              <text x="85" y="52" textAnchor="middle" fontSize="6.5" fill="var(--md-sys-color-outline)">Costados con regatón antihumedad</text>
            </g>
          )}
        </svg>
      )}

      {/* ─────────────────────────────────────────────────────────────
          PASO 4: TECHO / AMARRES SUPERIORES
         ───────────────────────────────────────────────────────────── */}
      {step === 'roof-structure' && (
        <svg viewBox="0 0 280 90" style={{ width: '100%', height: '100%' }}>
          {roofType === 'front-back-rails' ? (
            /* 2 Tie Rails for Countertop */
            <g transform="translate(50, 8)">
              {/* Left & Right sides */}
              <rect x="10" y="8" width="12" height="64" rx="1" fill="var(--md-sys-color-surface-container-highest)" stroke="var(--md-sys-color-outline)" strokeWidth="1" />
              <rect x="158" y="8" width="12" height="64" rx="1" fill="var(--md-sys-color-surface-container-highest)" stroke="var(--md-sys-color-outline)" strokeWidth="1" />
              {/* Front Tie Rail */}
              <rect x="22" y="12" width="136" height="15" rx="1.5" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1.6" />
              <text x="90" y="22" textAnchor="middle" fontSize="7" fontWeight="bold" fill="var(--md-sys-color-on-primary-container)">FAJA FRONTAL (80 mm)</text>
              {/* Rear Tie Rail */}
              <rect x="22" y="52" width="136" height="15" rx="1.5" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1.6" />
              <text x="90" y="62" textAnchor="middle" fontSize="7" fontWeight="bold" fill="var(--md-sys-color-on-primary-container)">FAJA TRASERA (80 mm)</text>
              {/* Open center symbol */}
              <text x="90" y="42" textAnchor="middle" fontSize="7" fill="var(--md-sys-color-primary)" fontWeight="bold">✨ Centro abierto para bacha / anafe</text>
            </g>
          ) : roofType === 'none' ? (
            /* Open Top to Ceiling */
            <g transform="translate(60, 6)">
              {/* Ceiling line */}
              <line x1="10" y1="8" x2="150" y2="8" stroke="var(--md-sys-color-outline)" strokeWidth="2" strokeDasharray="3 3" />
              <text x="80" y="5" textAnchor="middle" fontSize="6.5" fill="var(--md-sys-color-outline)" fontWeight="bold">CIELORRASO / TECHO</text>
              {/* Carcass sides going up flush */}
              <rect x="25" y="10" width="110" height="62" rx="2" fill="var(--md-sys-color-surface-container-low)" stroke="var(--md-sys-color-primary)" strokeWidth="1.8" />
              <line x1="25" y1="10" x2="135" y2="10" stroke="var(--md-sys-color-error, #ba1a1a)" strokeWidth="1.5" strokeDasharray="4 2" />
              <text x="80" y="32" textAnchor="middle" fontSize="8" fontWeight="800" fill="var(--md-sys-color-primary)">SIN TAPA (HASTA EL TECHO)</text>
              <text x="80" y="44" textAnchor="middle" fontSize="6.8" fill="var(--md-sys-color-on-surface-variant)">Evita hueco juntamugre superior</text>
              <text x="80" y="56" textAnchor="middle" fontSize="6.5" fill="var(--md-sys-color-primary)" fontWeight="bold">Fondo deslizable desde arriba ⤵</text>
            </g>
          ) : (
            /* Solid Full Panel Roof */
            <g transform="translate(60, 10)">
              <rect x="25" y="8" width="110" height="15" rx="2" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1.8" />
              <text x="80" y="18" textAnchor="middle" fontSize="7.5" fontWeight="bold" fill="var(--md-sys-color-on-primary-container)">TAPA CIEGA COMPLETA (18 mm)</text>
              <rect x="25" y="23" width="110" height="48" rx="1" fill="var(--md-sys-color-surface)" stroke="var(--md-sys-color-outline)" strokeWidth="1.2" />
              <text x="80" y="50" textAnchor="middle" fontSize="7.5" fill="var(--md-sys-color-outline)">Cierre estanco superior tradicional</text>
            </g>
          )}
        </svg>
      )}

      {/* ─────────────────────────────────────────────────────────────
          PASO 5: FONDO TRASERO
         ───────────────────────────────────────────────────────────── */}
      {step === 'backing' && (
        <svg viewBox="0 0 280 90" style={{ width: '100%', height: '100%' }}>
          {backingType === 'groove' && hasBacking ? (
            /* Cross section of 4mm groove detail */
            <g transform="translate(60, 6)">
              {/* Lateral panel section */}
              <rect x="15" y="8" width="30" height="66" rx="1" fill="var(--md-sys-color-surface-container-highest)" stroke="var(--md-sys-color-outline)" strokeWidth="1.2" />
              {/* Groove cut: 4mm wide x 8mm deep at 10mm from back edge */}
              <rect x="27" y="16" width="6" height="50" fill="var(--md-sys-color-primary-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1" />
              {/* 3mm MDF panel seated inside */}
              <rect x="29" y="4" width="2.8" height="74" fill="var(--md-sys-color-primary)" />
              {/* Dimension callouts */}
              <text x="65" y="24" fontSize="7.5" fontWeight="bold" fill="var(--md-sys-color-primary)">RANURADO 4 mm</text>
              <text x="65" y="36" fontSize="6.8" fill="var(--md-sys-color-on-surface-variant)">Embutido a 10 mm del borde</text>
              <text x="65" y="48" fontSize="6.8" fill="var(--md-sys-color-outline)">Escuadra automática de taller</text>
              <text x="65" y="60" fontSize="6.5" fontWeight="bold" fill="var(--md-sys-color-primary)">✓ Fijación oculta profesional</text>
            </g>
          ) : hasBacking ? (
            /* Applied / Nailed backing */
            <g transform="translate(60, 8)">
              <rect x="20" y="8" width="25" height="62" rx="1" fill="var(--md-sys-color-surface-container-highest)" stroke="var(--md-sys-color-outline)" strokeWidth="1.2" />
              {/* Backing sheet on the exterior back face */}
              <rect x="16" y="6" width="4" height="66" fill="var(--md-sys-color-primary)" />
              <text x="60" y="26" fontSize="7.5" fontWeight="bold" fill="var(--md-sys-color-primary)">FONDO CLAVADO / ATORNILLADO</text>
              <text x="60" y="40" fontSize="6.8" fill="var(--md-sys-color-on-surface-variant)">Fijación directa perimetral por detrás</text>
              <text x="60" y="54" fontSize="6.5" fill="var(--md-sys-color-outline)">Montaje rápido en obra</text>
            </g>
          ) : (
            /* No backing */
            <g transform="translate(70, 10)">
              <rect x="20" y="6" width="100" height="58" rx="2" fill="none" stroke="var(--md-sys-color-outline)" strokeWidth="1.5" strokeDasharray="3 3" />
              <text x="70" y="32" textAnchor="middle" fontSize="8" fontWeight="bold" fill="var(--md-sys-color-error, #ba1a1a)">SIN FONDO (VANO ABIERTO)</text>
              <text x="70" y="44" textAnchor="middle" fontSize="6.8" fill="var(--md-sys-color-outline)">Para llaves de gas, cañerías o térmicas</text>
            </g>
          )}
        </svg>
      )}

      {/* ─────────────────────────────────────────────────────────────
          PASO 6: VANOS Y EQUIPAMIENTO (Elevación frontal dinámica)
         ───────────────────────────────────────────────────────────── */}
      {step === 'bays-equipment' && (
        <svg viewBox="0 0 280 90" style={{ width: '100%', height: '100%' }}>
          <g transform="translate(45, 6)">
            {/* Outer Cabinet frame */}
            <rect x="10" y="4" width="170" height="68" rx="2" fill="var(--md-sys-color-surface)" stroke="var(--md-sys-color-outline)" strokeWidth="1.5" />

            {/* Bays render */}
            {(() => {
              const count = gridType === '3-bays-vertical' ? 3 : gridType === '2-bays-vertical' ? 2 : 1;
              const bayW = 170 / count;

              return Array.from({ length: count }).map((_, idx) => {
                const bayX = 10 + idx * bayW;
                const isCurrent = idx === activeBayIndex;
                const bayData = bays[idx];
                const bayType = bayData?.type ?? 'empty';

                return (
                  <g key={idx}>
                    {/* Divider line between bays */}
                    {idx > 0 && (
                      <line x1={bayX} y1="4" x2={bayX} y2="72" stroke="var(--md-sys-color-outline)" strokeWidth="2" />
                    )}

                    {/* Bay interior background */}
                    <rect
                      x={bayX + 2}
                      y="6"
                      width={bayW - 4}
                      height="64"
                      fill={isCurrent ? 'var(--md-sys-color-primary-container)' : 'transparent'}
                      opacity={isCurrent ? 0.45 : 0}
                    />

                    {/* Bay content visualization */}
                    {bayType === 'shelves' && (
                      <>
                        <line x1={bayX + 4} y1="26" x2={bayX + bayW - 4} y2="26" stroke="var(--md-sys-color-primary)" strokeWidth="1.8" />
                        <line x1={bayX + 4} y1="48" x2={bayX + bayW - 4} y2="48" stroke="var(--md-sys-color-primary)" strokeWidth="1.8" />
                        <text x={bayX + bayW / 2} y="64" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="var(--md-sys-color-primary)">ESTANTES</text>
                      </>
                    )}

                    {bayType === 'drawer-stack' && (
                      <>
                        <rect x={bayX + 4} y="8" width={bayW - 8} height="16" rx="1" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-primary)" strokeWidth="1" />
                        <rect x={bayX + 4} y="28" width={bayW - 8} height="16" rx="1" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-primary)" strokeWidth="1" />
                        <rect x={bayX + 4} y="48" width={bayW - 8} height="20" rx="1" fill="var(--md-sys-color-surface-container-high)" stroke="var(--md-sys-color-primary)" strokeWidth="1" />
                        <circle cx={bayX + bayW / 2} cy="16" r="1.5" fill="var(--md-sys-color-primary)" />
                        <circle cx={bayX + bayW / 2} cy="36" r="1.5" fill="var(--md-sys-color-primary)" />
                        <circle cx={bayX + bayW / 2} cy="58" r="1.5" fill="var(--md-sys-color-primary)" />
                      </>
                    )}

                    {bayType === 'doors' && (
                      <>
                        <rect x={bayX + 4} y="8" width={bayW - 8} height="60" rx="1" fill="var(--md-sys-color-surface-container)" stroke="var(--md-sys-color-primary)" strokeWidth="1" />
                        <line x1={bayX + 6} y1="10" x2={bayX + bayW - 6} y2="66" stroke="var(--md-sys-color-outline-variant)" strokeWidth="1" strokeDasharray="2 2" />
                        <circle cx={bayX + bayW - 8} cy="38" r="2" fill="var(--md-sys-color-primary)" />
                        <text x={bayX + bayW / 2} y="34" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="var(--md-sys-color-primary)">PUERTA</text>
                      </>
                    )}

                    {bayType === 'empty' && (
                      <text x={bayX + bayW / 2} y="40" textAnchor="middle" fontSize="6.5" fill="var(--md-sys-color-outline)">Libre</text>
                    )}

                    {/* Column label badge */}
                    <rect x={bayX + bayW / 2 - 12} y="74" width="24" height="10" rx="2" fill={isCurrent ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container-high)'} />
                    <text x={bayX + bayW / 2} y="81" textAnchor="middle" fontSize="6" fontWeight="bold" fill={isCurrent ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-outline)'}>
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
        <svg viewBox="0 0 280 90" style={{ width: '100%', height: '100%' }}>
          <g transform="translate(60, 6)">
            {/* Exploded Carcass & Fronts */}
            {/* Carcass (sides, top, bottom) */}
            <rect
              x="20"
              y="10"
              width="80"
              height="56"
              rx="2"
              fill={materialRole === 'carcass' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-high)'}
              stroke={materialRole === 'carcass' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
              strokeWidth={materialRole === 'carcass' ? '2.2' : '1.2'}
            />

            {/* Front doors floating in front */}
            <rect
              x="115"
              y="10"
              width="45"
              height="56"
              rx="2"
              fill={materialRole === 'fronts' ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-high)'}
              stroke={materialRole === 'fronts' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline)'}
              strokeWidth={materialRole === 'fronts' ? '2.2' : '1.2'}
            />
            <circle cx="120" cy="38" r="2" fill="var(--md-sys-color-primary)" />

            {/* Role indicator label */}
            <text x="60" y="42" textAnchor="middle" fontSize="7.5" fontWeight="bold" fill={materialRole === 'carcass' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface)'}>
              CASCO
            </text>
            <text x="137" y="42" textAnchor="middle" fontSize="7" fontWeight="bold" fill={materialRole === 'fronts' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-on-surface)'}>
              FRENTES
            </text>

            <rect x="40" y="72" width="100" height="12" rx="3" fill="var(--md-sys-color-surface-container)" stroke="var(--md-sys-color-outline-variant)" strokeWidth="1" />
            <text x="90" y="80.5" textAnchor="middle" fontSize="6.5" fontWeight="bold" fill="var(--md-sys-color-primary)">
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
