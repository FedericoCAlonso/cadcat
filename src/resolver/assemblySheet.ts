import { jsPDF } from 'jspdf';
import type { ResolvedModule, ResolvedPiece } from './resolver';
import type { Joint, MachiningConfig } from '../model';
import { deriveAssemblyGauges, type AssemblyGauge } from './gauges';
import { determinePieceSpatialSize } from './spatial3d';
import type { PieceMachiningSheet } from './machiningSheet';

export interface AssemblyHardwareRequirement {
  type: 'confirmat' | 'minifix' | 'dowel' | 'euro-screw' | 'wood-screw' | 'slide' | 'hinge-plate' | 'shelf-pin' | 'bracket';
  label: string;
  quantity: number;
  toolRequired?: string;
  pilotDrillMm?: number;
}

export interface AssemblyStep {
  stepNumber: number;
  phase: 'preparation' | 'pre-assembly' | 'carcass' | 'shelves' | 'rails' | 'squaring' | 'drawers' | 'doors' | 'inspection';
  title: string;
  instruction: string;
  piecesInvolved: string[];
  basePieceIds?: string[];
  gaugesInvolved: string[];
  hardwareRequirements: AssemblyHardwareRequirement[];
  hardwareSummary?: string;
  toolsRequired: string[];
  criticalDimensionMm?: {
    label: string;
    valueMm: number;
    toleranceMm: number;
  };
  workshopTips?: string[];
  referenceEdge?: 'front' | 'back' | 'top' | 'bottom';
  notes?: string;
}

export interface ExplodedPieceMapItem {
  referenceNumber: number;
  pieceId: string;
  role: string;
  name: string;
  dimensionsMm: { width: number; height: number; thickness: number };
  materialId?: string;
  bandedEdgesSummary: string;
  hardwarePreparedCount: number;
  displacementOffsetMm: { x: number; y: number; z: number };
}

export interface PanelDetailItem {
  pieceId: string;
  referenceNumber: number;
  role: string;
  name: string;
  dimensionsMm: { width: number; height: number; thickness: number };
  bandedEdges: { top: boolean; bottom: boolean; left: boolean; right: boolean };
  datumNotes: string;
  hardwareInstalled: AssemblyHardwareRequirement[];
  operations: {
    yFromBottomMm: number;
    xFromFrontMm: number;
    description: string;
    hardwareType: string;
    drillSpecs?: string;
  }[];
}

export interface AssemblySheet {
  moduleId: string;
  title: string;
  moduleDimensionsMm: { width: number; height: number; depth: number };
  squaringDiagonalMm: number;
  steps: AssemblyStep[];
  gauges: AssemblyGauge[];
  totalSteps: number;
  explodedMap: ExplodedPieceMapItem[];
  panelDetails: PanelDetailItem[];
  totalHardwareBOM: AssemblyHardwareRequirement[];
}

export interface GenerateAssemblySheetInput {
  module: ResolvedModule | { moduleId: string; pieces: ResolvedPiece[]; joints: Joint[] };
  gauges?: AssemblyGauge[];
  machiningConfig?: MachiningConfig;
  machiningSheets?: PieceMachiningSheet[];
  moduleDimensions?: { width: number; height: number; depth: number };
}

function getFriendlyPieceName(role: string): string {
  const r = role.toLowerCase();
  if (r.includes('side-left') || (r.includes('side') && r.includes('1'))) return 'Lateral Izquierdo';
  if (r.includes('side-right') || (r.includes('side') && r.includes('2'))) return 'Lateral Derecho';
  if (r.includes('side')) return 'Lateral';
  if (r.includes('bottom') || r.includes('base') || r.includes('piso')) return 'Base / Piso';
  if (r.includes('top') && !r.includes('rail')) return 'Tapa Superior / Techo';
  if (r.includes('rail')) return 'Faja / Travesaño';
  if (r.includes('shelf')) return 'Estante';
  if (r.includes('partition') || r.includes('divider')) return 'Divisor Vertical';
  if (r.includes('back')) return 'Fondo';
  if (r.includes('door')) return 'Puerta';
  if (r.includes('drawer-front')) return 'Frente de Cajón';
  if (r.includes('drawer-box-side')) return 'Lateral de Cajón';
  if (r.includes('drawer-box-back')) return 'Trasera de Cajón';
  if (r.includes('drawer-box-bottom')) return 'Fondo de Cajón';
  if (r.includes('drawer')) return 'Cajón';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/**
 * Generate sequential assembly steps for the manual workshop.
 * Computes exact squaring diagonals, exploded mapping, panel pre-assembly details,
 * and uses assembly gauges (e.g., G1, G2) for precise shelf and divider placement without measuring.
 */
export function generateAssemblySheet(input: GenerateAssemblySheetInput): AssemblySheet {
  const { module } = input;
  const pieces = module.pieces.filter((p) => !p.isAuxiliary);
  const joints = module.joints;
  const gauges = input.gauges ?? deriveAssemblyGauges({ pieces, joints }, input.machiningConfig);
  const machiningSheets = input.machiningSheets ?? [];

  // Calculate overall bounding box dimensions
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const p of pieces) {
    const pos = p.positionMm ?? { x: 0, y: 0, z: 0 };
    const size = determinePieceSpatialSize(p);
    minX = Math.min(minX, pos.x);
    maxX = Math.max(maxX, pos.x + size.x);
    minY = Math.min(minY, pos.y);
    maxY = Math.max(maxY, pos.y + size.y);
    minZ = Math.min(minZ, pos.z);
    maxZ = Math.max(maxZ, pos.z + size.z);
  }

  const modWidth = input.moduleDimensions?.width ??
    (Number.isFinite(maxX - minX) && (maxX - minX) > 0 ? Math.round(maxX - minX) : 600);
  const modHeight = input.moduleDimensions?.height ??
    (Number.isFinite(maxY - minY) && (maxY - minY) > 0 ? Math.round(maxY - minY) : 800);
  const modDepth = input.moduleDimensions?.depth ??
    (Number.isFinite(maxZ - minZ) && (maxZ - minZ) > 0 ? Math.round(maxZ - minZ) : 550);

  // Exact squaring diagonal calculation (Pythagoras theorem on frontal carcass rectangle)
  const squaringDiagonalMm = Math.round(Math.hypot(modWidth, modHeight) * 10) / 10;

  // Gauge lookup map by lower & upper piece ids
  const gaugeByPair = new Map<string, string>();
  for (const g of gauges) {
    for (const occ of g.occurrences) {
      gaugeByPair.set(`${occ.lowerPieceId}->${occ.upperPieceId}`, g.label);
    }
  }

  // Identify key carcass pieces
  const sideLeft = pieces.find((p) => p.role.includes('side-left') || (p.role.includes('side') && p.role.includes('1')));
  const sideRight = pieces.find((p) => p.role.includes('side-right') || (p.role.includes('side') && p.role.includes('2')));
  const bottom = pieces.find((p) => p.role.includes('bottom'));
  const back = pieces.find((p) => p.role.includes('back'));
  const rails = pieces.filter((p) => p.role.includes('rail'));
  const top = pieces.find((p) => p.role.includes('top') && !p.role.includes('rail'));
  const shelves = pieces
    .filter((p) => p.role.includes('shelf'))
    .sort((a, b) => a.positionMm.y - b.positionMm.y);
  const partitions = pieces
    .filter((p) => p.role.includes('partition') || p.role.includes('divider'))
    .sort((a, b) => a.positionMm.x - b.positionMm.x);
  const drawers = pieces.filter((p) => p.role.includes('drawer'));
  const doors = pieces.filter((p) => p.role.includes('door'));

  // 1. Build Exploded Piece Mapping (#1, #2, #3...)
  const sortedPiecesForExplosion = [
    ...(sideLeft ? [sideLeft] : []),
    ...(sideRight && sideRight.id !== sideLeft?.id ? [sideRight] : []),
    ...(bottom ? [bottom] : []),
    ...(top ? [top] : []),
    ...rails,
    ...shelves,
    ...partitions,
    ...(back ? [back] : []),
    ...doors,
    ...drawers,
  ];

  // Append any pieces not yet categorized
  for (const p of pieces) {
    if (!sortedPiecesForExplosion.some((sp) => sp.id === p.id)) {
      sortedPiecesForExplosion.push(p);
    }
  }

  const pieceRefMap = new Map<string, number>();
  const explodedMap: ExplodedPieceMapItem[] = [];

  sortedPiecesForExplosion.forEach((p, idx) => {
    const refNum = idx + 1;
    pieceRefMap.set(p.id, refNum);
    const size = determinePieceSpatialSize(p);
    const thickness = p.thicknessMm ?? (size.z <= 6 ? size.z : 18);

    // Compute exploded visual displacement offset
    let dx = 0;
    let dy = 0;
    let dz = 0;
    const r = p.role.toLowerCase();

    if (r.includes('side-left') || (r.includes('side') && r.includes('1'))) {
      dx = -140;
    } else if (r.includes('side-right') || (r.includes('side') && r.includes('2'))) {
      dx = 140;
    } else if (r.includes('bottom')) {
      dy = -100;
    } else if (r.includes('top') || r.includes('rail')) {
      dy = 100;
    } else if (r.includes('back')) {
      dz = -160;
    } else if (r.includes('door') || r.includes('drawer-front')) {
      dz = 160;
    } else if (r.includes('shelf')) {
      dy = 0;
    }

    // Determine edge band summary
    let bandedSummary = 'Canto frontal visto';
    if (r.includes('back')) {
      bandedSummary = 'Sin cantos (oculto en ranura)';
    } else if (r.includes('shelf')) {
      bandedSummary = 'Frente 2 mm PVC (canto visto)';
    } else if (r.includes('side')) {
      bandedSummary = 'Frente 2 mm PVC / Sup-Inf 0.45 mm';
    } else if (r.includes('bottom') || r.includes('top')) {
      bandedSummary = 'Frente 2 mm PVC / Laterales ciegos';
    }

    // Count prepared hardware for this piece
    const pieceSheet = machiningSheets.find((s) => s.pieceId === p.id);
    const preparedCount = pieceSheet?.totalOperations ?? 0;

    explodedMap.push({
      referenceNumber: refNum,
      pieceId: p.id,
      role: p.role,
      name: getFriendlyPieceName(p.role),
      dimensionsMm: {
        width: Math.round(size.x),
        height: Math.round(size.y),
        thickness,
      },
      materialId: p.materialId,
      bandedEdgesSummary: bandedSummary,
      hardwarePreparedCount: preparedCount,
      displacementOffsetMm: { x: dx, y: dy, z: dz },
    });
  });

  // 2. Build Panel Pre-assembly Detail Views (Sides, Partitions, Bottom, Doors)
  const panelDetails: PanelDetailItem[] = [];
  const panelsRequiringDetail = pieces.filter((p) => {
    const r = p.role.toLowerCase();
    return (
      r.includes('side') ||
      r.includes('partition') ||
      r.includes('divider') ||
      (r.includes('bottom') && joints.some((j) => j.a.pieceId === p.id || j.b.pieceId === p.id)) ||
      r.includes('door') ||
      r.includes('drawer-front')
    );
  });

  for (const panel of panelsRequiringDetail) {
    const refNum = pieceRefMap.get(panel.id) ?? 1;
    const size = determinePieceSpatialSize(panel);
    const panelSheet = machiningSheets.find((s) => s.pieceId === panel.id);
    const panelOps: PanelDetailItem['operations'] = [];
    const panelHardware: AssemblyHardwareRequirement[] = [];

    // Extract operations from machining sheets if available
    if (panelSheet && panelSheet.totalOperations > 0) {
      const allOps = [
        ...panelSheet.faceAOperations,
        ...panelSheet.faceBOperations,
      ];

      for (const op of allOps) {
        panelOps.push({
          yFromBottomMm: Math.round(op.distFromBottomMm),
          xFromFrontMm: Math.round(op.distFromLeftMm),
          description: op.description,
          hardwareType: op.sourceJointKind ?? 'drill',
          drillSpecs: `ø${op.diameterMm} x ${op.depthMm} mm`,
        });
      }
    } else {
      // Fallback: derive operations from module geometry and joints
      const panelHeight = Math.max(size.x, size.y);
      const panelDepth = Math.min(size.x, size.y) > 0 ? Math.min(size.x, size.y) : modDepth;

      // Bottom joint
      if (panel.role.includes('side')) {
        panelOps.push({
          yFromBottomMm: 9,
          xFromFrontMm: 50,
          description: 'Orificio confirmat unión con base/piso',
          hardwareType: 'confirmat',
          drillSpecs: 'ø5 x 50 mm (pasante)',
        });
        panelOps.push({
          yFromBottomMm: 9,
          xFromFrontMm: Math.max(50, panelDepth - 50),
          description: 'Orificio confirmat unión con base/piso',
          hardwareType: 'confirmat',
          drillSpecs: 'ø5 x 50 mm (pasante)',
        });

        // Top joint
        panelOps.push({
          yFromBottomMm: Math.max(9, panelHeight - 9),
          xFromFrontMm: 50,
          description: 'Orificio confirmat unión con techo/faja',
          hardwareType: 'confirmat',
          drillSpecs: 'ø5 x 50 mm (pasante)',
        });
        panelOps.push({
          yFromBottomMm: Math.max(9, panelHeight - 9),
          xFromFrontMm: Math.max(50, panelDepth - 50),
          description: 'Orificio confirmat unión con techo/faja',
          hardwareType: 'confirmat',
          drillSpecs: 'ø5 x 50 mm (pasante)',
        });

        // Shelf joints
        for (const shelf of shelves) {
          const shelfRelY = Math.round(shelf.positionMm.y + 9);
          panelOps.push({
            yFromBottomMm: shelfRelY,
            xFromFrontMm: 50,
            description: `Fijación estante ${shelf.id}`,
            hardwareType: 'confirmat',
            drillSpecs: 'ø5 x 50 mm',
          });
          panelOps.push({
            yFromBottomMm: shelfRelY,
            xFromFrontMm: Math.max(50, panelDepth - 50),
            description: `Fijación estante ${shelf.id}`,
            hardwareType: 'confirmat',
            drillSpecs: 'ø5 x 50 mm',
          });
        }
      }
    }

    // Hardware summary for this panel
    if (panelOps.some((o) => o.hardwareType.includes('confirmat'))) {
      const count = panelOps.filter((o) => o.hardwareType.includes('confirmat')).length;
      panelHardware.push({
        type: 'confirmat',
        label: 'Tornillo Confirmat 7x50 mm',
        quantity: count,
        toolRequired: 'Llave Allen 4 mm / Mecha 5 mm',
        pilotDrillMm: 5.0,
      });
    }

    if (panelOps.some((o) => o.hardwareType.includes('minifix'))) {
      panelHardware.push({
        type: 'minifix',
        label: 'Pernos de Minifix System 32',
        quantity: 4,
        toolRequired: 'Destornillador PZ2',
        pilotDrillMm: 5.0,
      });
    }

    if (doors.length > 0 && panel.role.includes('side')) {
      panelHardware.push({
        type: 'hinge-plate',
        label: 'Bases de bisagra cazoleta (System 32)',
        quantity: 2,
        toolRequired: 'Destornillador PH2 / Tornillos 3.5x16 mm',
      });
    }

    panelDetails.push({
      pieceId: panel.id,
      referenceNumber: refNum,
      role: panel.role,
      name: getFriendlyPieceName(panel.role),
      dimensionsMm: {
        width: Math.round(size.x),
        height: Math.round(size.y),
        thickness: panel.thicknessMm ?? 18,
      },
      bandedEdges: {
        top: true,
        bottom: false,
        left: true,
        right: false,
      },
      datumNotes: 'Origen Datum (0,0): Esquina inferior frontal. Todas las cotas medidas en mm desde esta referencia.',
      hardwareInstalled: panelHardware,
      operations: panelOps,
    });
  }

  // 3. Sequential Assembly Steps with Exact Metrics
  const steps: AssemblyStep[] = [];
  let stepNumber = 1;

  // Step 1: Preparation & Verification
  const gaugeSummary = gauges.length > 0
    ? gauges.map((g) => `${g.label} (${g.clearSpanMm} mm)`).join(', ')
    : 'Ninguno requerido';

  const toolsPreparation = [
    'Cinta métrica metálica',
    'Escuadra de comprobación 90°',
    'Llave Allen 4 mm o punta hexagonal 4 mm',
    'Destornillador punta PZ2 / PH2',
    'Mecha escalonada para confirmat 5x7 mm',
    'Martillo de goma con taco mártir de madera',
    'Prensas sargento (mínimo 2 unidades)',
  ];

  steps.push({
    stepNumber: stepNumber++,
    phase: 'preparation',
    title: 'Preparación y Verificación de Calibres',
    instruction: `Disponer todos los paneles cortados (#1 a #${explodedMap.length}) sobre el banco de trabajo limpio. Verificar calibres de montaje: ${gaugeSummary}. Inspeccionar cantos y perforaciones.`,
    piecesInvolved: pieces.map((p) => p.id),
    gaugesInvolved: gauges.map((g) => g.label),
    hardwareRequirements: [],
    hardwareSummary: 'Verificación visual de tornillería y calibres',
    toolsRequired: toolsPreparation,
    workshopTips: [
      'Asegurar que el banco de trabajo esté libre de aserrín o virutas para prevenir rayaduras en la melamina.',
      'Identificar la cara frontal con tapacantos de 2 mm para mantenerla siempre orientada hacia el frente de trabajo.',
    ],
    notes: 'Asegurar que el banco de trabajo esté limpio y plano para prevenir rayaduras en las superficies.',
  });

  // Step 2: Pre-machining and Hardware on Flat Panels
  const sideIds = [sideLeft?.id, sideRight?.id].filter((id): id is string => Boolean(id));
  if (sideIds.length > 0) {
    const preAssemblyHardware: AssemblyHardwareRequirement[] = [];
    if (doors.length > 0) {
      preAssemblyHardware.push({
        type: 'hinge-plate',
        label: 'Bases de bisagra cazoleta',
        quantity: doors.length * 2,
        toolRequired: 'Destornillador PH2 / Tornillos autorroscantes 3.5x16 mm',
      });
    }
    if (drawers.length > 0) {
      preAssemblyHardware.push({
        type: 'slide',
        label: 'Guías de corredera telescópica (miembro de mueble)',
        quantity: Math.max(2, Math.floor(drawers.length / 4) * 2),
        toolRequired: 'Tornillos Euro 6.3x13 mm o 3.5x16 mm',
      });
    }
    preAssemblyHardware.push({
      type: 'dowel',
      label: 'Tarugos de madera haya 8x30 mm',
      quantity: 6,
      toolRequired: 'Martillo de goma y cola vinílica D3',
      pilotDrillMm: 8.0,
    });

    steps.push({
      stepNumber: stepNumber++,
      phase: 'pre-assembly',
      title: 'Pre-mecanizado e Inserción de Herrajes en Banco',
      instruction: 'Colocar tarugos, pernos minifix y guías de cajón o bases de bisagra en los laterales en plano sobre el banco de trabajo según las cotas milimétricas del plano de detalle.',
      piecesInvolved: sideIds,
      gaugesInvolved: [],
      hardwareRequirements: preAssemblyHardware,
      hardwareSummary: `${joints.length > 0 ? joints.length : preAssemblyHardware.reduce((acc, h) => acc + h.quantity, 0)} conexiones de unión planificadas`,
      toolsRequired: ['Destornillador PZ2 / PH2', 'Martillo de goma', 'Cola vinílica'],
      workshopTips: [
        'Montar herrajes sobre paneles en plano en el banco es 4 veces más rápido y previene desalineaciones durante el ensamble del casco.',
        'No introducir los tarugos a golpes secos directos: use siempre taco mártir para no dañar los cantos melamínicos.',
      ],
      notes: 'Montar herrajes sobre paneles en plano es más rápido y previene desalineaciones durante el ensamble del casco.',
    });
  }

  // Step 3: Base Carcass Assembly (Bottom + Left Side)
  if (bottom && sideLeft) {
    const bottomSideHardware: AssemblyHardwareRequirement[] = [
      {
        type: 'confirmat',
        label: 'Tornillos Confirmat 7x50 mm',
        quantity: Math.max(2, Math.round(modDepth / 250)),
        toolRequired: 'Llave Allen 4 mm / Punta Hex 4',
        pilotDrillMm: 5.0,
      },
    ];

    steps.push({
      stepNumber: stepNumber++,
      phase: 'carcass',
      title: 'Ensamblar Base con Lateral Izquierdo',
      instruction: `Posicionar la base (${bottom.id}) contra el lateral izquierdo (${sideLeft.id}). Enrasar cantos y fijar uniones firmemente.`,
      piecesInvolved: [bottom.id, sideLeft.id],
      gaugesInvolved: [],
      hardwareRequirements: bottomSideHardware,
      hardwareSummary: 'Tornillos Confirmat / Minifix',
      toolsRequired: ['Prensa escuadra a 90°', 'Llave Allen 4 mm', 'Mecha piloto 5 mm'],
      referenceEdge: 'front',
      criticalDimensionMm: {
        label: 'Alineación de canto frontal',
        valueMm: 0.0,
        toleranceMm: 0.5,
      },
      workshopTips: [
        'Alinear los cantos frontales a ras absoluto (0.0 mm) antes de apretar.',
        'Verificar que la ranura posterior para el fondo de 9 mm quede continua y en el mismo plano.',
      ],
    });
  }

  // Step 4: Base Carcass Assembly (Bottom + Right Side)
  if (bottom && sideRight && sideRight.id !== sideLeft?.id) {
    const bottomSideHardware: AssemblyHardwareRequirement[] = [
      {
        type: 'confirmat',
        label: 'Tornillos Confirmat 7x50 mm',
        quantity: Math.max(2, Math.round(modDepth / 250)),
        toolRequired: 'Llave Allen 4 mm',
        pilotDrillMm: 5.0,
      },
    ];

    steps.push({
      stepNumber: stepNumber++,
      phase: 'carcass',
      title: 'Ensamblar Base con Lateral Derecho',
      instruction: `Posicionar el lateral derecho (${sideRight.id}) contra la base (${bottom.id}). Enrasar cantos y fijar uniones.`,
      piecesInvolved: [bottom.id, sideRight.id],
      gaugesInvolved: [],
      hardwareRequirements: bottomSideHardware,
      hardwareSummary: 'Tornillos Confirmat / Minifix',
      toolsRequired: ['Prensa escuadra a 90°', 'Llave Allen 4 mm'],
      referenceEdge: 'front',
      criticalDimensionMm: {
        label: 'Alineación de canto frontal',
        valueMm: 0.0,
        toleranceMm: 0.5,
      },
      workshopTips: [
        'Mantener el módulo apoyado sobre el lateral izquierdo mientras se monta el lateral derecho.',
      ],
    });
  }

  // Step 5: Sequential Shelves Installation using Gauges
  let previousHorizontalPiece = bottom;

  for (let i = 0; i < shelves.length; i++) {
    const shelf = shelves[i]!;
    const shelfName = `estante ${i + 1} (${shelf.id})`;
    const prevName = previousHorizontalPiece ? previousHorizontalPiece.id : 'panel inferior (piso)';

    let matchedGaugeLabel: string | undefined;
    if (previousHorizontalPiece) {
      matchedGaugeLabel = gaugeByPair.get(`${previousHorizontalPiece.id}->${shelf.id}`);
    }

    if (!matchedGaugeLabel && gauges.length > 0) {
      const prevThickness = previousHorizontalPiece ? (previousHorizontalPiece.thicknessMm ?? 18) : 18;
      const spanMm = previousHorizontalPiece
        ? shelf.positionMm.y - (previousHorizontalPiece.positionMm.y + prevThickness)
        : shelf.positionMm.y;
      const matched = gauges.find((g) => Math.abs(g.clearSpanMm - spanMm) <= 2.0);
      if (matched) matchedGaugeLabel = matched.label;
    }

    const shelfHardware: AssemblyHardwareRequirement[] = [
      {
        type: 'confirmat',
        label: 'Tornillos Confirmat 7x50 mm o Soportes de estante',
        quantity: 4,
        toolRequired: 'Llave Allen 4 mm o Destornillador',
        pilotDrillMm: 5.0,
      },
    ];

    if (matchedGaugeLabel) {
      const matchedGauge = gauges.find((g) => g.label === matchedGaugeLabel);
      const spanVal = matchedGauge?.clearSpanMm ?? 320;

      steps.push({
        stepNumber: stepNumber++,
        phase: 'shelves',
        title: `Instalar ${shelfName} con Calibre ${matchedGaugeLabel}`,
        instruction: `Apoyar el calibre (gauge ${matchedGaugeLabel}) sobre ${prevName}. Colocar ${shelfName} sobre el calibre (gauge ${matchedGaugeLabel}). Fijar uniones.`,
        piecesInvolved: [shelf.id, ...(previousHorizontalPiece ? [previousHorizontalPiece.id] : [])],
        gaugesInvolved: [matchedGaugeLabel],
        hardwareRequirements: shelfHardware,
        hardwareSummary: 'Tornillos confirmat o soportes de estante',
        toolsRequired: ['Calibre auxiliar ' + matchedGaugeLabel, 'Llave Allen 4 mm'],
        criticalDimensionMm: {
          label: `Luz libre de vano calibre ${matchedGaugeLabel}`,
          valueMm: spanVal,
          toleranceMm: 0.5,
        },
        workshopTips: [
          `El calibre ${matchedGaugeLabel} garantiza paralelismo exacto sin acumular errores de lectura con cinta métrica.`,
          'Deslizar el calibre suavemente hacia afuera una vez asegurada la primera fijación de cada lado.',
        ],
        notes: `El calibre ${matchedGaugeLabel} garantiza paralelismo exacto sin usar cinta métrica.`,
      });
    } else {
      steps.push({
        stepNumber: stepNumber++,
        phase: 'shelves',
        title: `Instalar ${shelfName}`,
        instruction: `Posicionar ${shelfName} a la altura proyectada sobre ${prevName}. Verificar nivel y fijar uniones.`,
        piecesInvolved: [shelf.id],
        gaugesInvolved: [],
        hardwareRequirements: shelfHardware,
        hardwareSummary: 'Fijar tornillos confirmat',
        toolsRequired: ['Cinta métrica', 'Nivel de burbuja', 'Llave Allen 4 mm'],
      });
    }

    previousHorizontalPiece = shelf;
  }

  // Step 6: Rails / Top Panel Installation
  if (rails.length > 0) {
    const railIds = rails.map((r) => r.id);
    const railHardware: AssemblyHardwareRequirement[] = [
      {
        type: 'confirmat',
        label: 'Tornillos Confirmat 7x50 mm',
        quantity: rails.length * 2,
        toolRequired: 'Llave Allen 4 mm',
      },
    ];

    steps.push({
      stepNumber: stepNumber++,
      phase: 'rails',
      title: 'Instalar Fajas / Travesaños Superiores',
      instruction: `Posicionar las fajas superiores (${railIds.join(', ')}). Enrasar con el borde superior de los laterales y asegurar uniones firmemente.`,
      piecesInvolved: railIds,
      gaugesInvolved: [],
      hardwareRequirements: railHardware,
      hardwareSummary: 'Tornillos confirmat',
      toolsRequired: ['Prensas sargento', 'Llave Allen 4 mm'],
      workshopTips: [
        'Las fajas delanteras y traseras evitan que el casco sufra deformaciones por alabeo antes de colocar la cubierta o mesada.',
      ],
    });
  } else if (top) {
    const topHardware: AssemblyHardwareRequirement[] = [
      {
        type: 'confirmat',
        label: 'Tornillos Confirmat 7x50 mm',
        quantity: Math.max(2, Math.round(modDepth / 250) * 2),
        toolRequired: 'Llave Allen 4 mm',
      },
    ];

    steps.push({
      stepNumber: stepNumber++,
      phase: 'carcass',
      title: 'Instalar Tapa Superior',
      instruction: `Posicionar la tapa superior (${top.id}) enrasada con el borde superior del mueble. Asegurar uniones.`,
      piecesInvolved: [top.id],
      gaugesInvolved: [],
      hardwareRequirements: topHardware,
      hardwareSummary: 'Tornillos Confirmat / Minifix',
      toolsRequired: ['Prensas sargento', 'Llave Allen 4 mm'],
      referenceEdge: 'top',
    });
  }

  // Step 7: Squaring and Back Panel (Mathematical Squaring)
  if (back) {
    const backFastenersCount = Math.round(((modWidth + modHeight) * 2) / 120);
    const backHardware: AssemblyHardwareRequirement[] = [
      {
        type: 'wood-screw',
        label: 'Tornillos autorroscantes 3.5x20 mm o clavos con arandela',
        quantity: Math.max(16, backFastenersCount),
        toolRequired: 'Destornillador PZ2 o Martillo carpintero',
      },
    ];

    steps.push({
      stepNumber: stepNumber++,
      phase: 'squaring',
      title: 'Escuadrar Casco y Colocar Fondo',
      instruction: `Medir ambas diagonales entre esquinas opuestas del mueble. Verificar que coincidan con tolerancia ≤ 1 mm (valor teórico calculado: ${squaringDiagonalMm} mm). Insertar o atornillar el fondo (${back.id}) en ranuras o solape y fijar.`,
      piecesInvolved: [back.id],
      gaugesInvolved: [],
      hardwareRequirements: backHardware,
      hardwareSummary: `${backHardware[0]!.quantity} fijaciones perimetrales`,
      toolsRequired: ['Cinta métrica metálica', 'Destornillador PZ2', 'Prensas de apriete cruzado'],
      criticalDimensionMm: {
        label: 'Diagonal de escuadra teórica calculada (D1 = D2)',
        valueMm: squaringDiagonalMm,
        toleranceMm: 1.0,
      },
      workshopTips: [
        `Comprobar que Diagonal A-D = Diagonal B-C = ${squaringDiagonalMm} mm. Si difieren, ejercer presión diagonal con la prensa sargento hasta igualarlas.`,
        'El fondo rigidiza y bloquea la escuadra permanente del mueble; nunca fijarlo si las diagonales difieren más de 1 mm.',
      ],
      notes: 'El casco debe estar perfectamente a escuadra antes de fijar el fondo.',
    });
  } else {
    steps.push({
      stepNumber: stepNumber++,
      phase: 'squaring',
      title: 'Escuadrar Casco Estructural',
      instruction: `Medir ambas diagonales entre esquinas opuestas del mueble. Verificar que coincidan con tolerancia ≤ 1 mm (valor teórico calculado: ${squaringDiagonalMm} mm). Ajustar prensas sargento hasta igualar diagonales y apretar definitivamente todas las uniones.`,
      piecesInvolved: pieces.filter((p) => p.role.includes('side') || p.role.includes('bottom') || p.role.includes('top')).map((p) => p.id),
      gaugesInvolved: [],
      hardwareRequirements: [],
      hardwareSummary: 'Verificación de escuadra con cinta métrica',
      toolsRequired: ['Cinta métrica metálica', 'Prensas de apriete cruzado'],
      criticalDimensionMm: {
        label: 'Diagonal de escuadra teórica calculada (D1 = D2)',
        valueMm: squaringDiagonalMm,
        toleranceMm: 1.0,
      },
      workshopTips: [
        `Comprobar que Diagonal A-D = Diagonal B-C = ${squaringDiagonalMm} mm. Ambas lecturas deben ser idénticas antes de retirar las prensas.`,
      ],
      notes: 'El casco debe estar perfectamente a escuadra antes del apriete final.',
    });
  }

  // Step 8: Sub-assemblies (Drawers & Doors)
  if (drawers.length > 0 || doors.length > 0) {
    const subAssemblyHardware: AssemblyHardwareRequirement[] = [];
    if (drawers.length > 0) {
      subAssemblyHardware.push({
        type: 'slide',
        label: 'Tornillos fijación cajón 3.5x14 mm',
        quantity: 8,
        toolRequired: 'Destornillador PH2',
      });
    }
    if (doors.length > 0) {
      subAssemblyHardware.push({
        type: 'hinge-plate',
        label: 'Bisagras cazoleta 35 mm con tornillos de regulación',
        quantity: doors.length * 2,
        toolRequired: 'Destornillador PH2',
      });
    }

    steps.push({
      stepNumber: stepNumber++,
      phase: 'drawers',
      title: 'Montaje de Cajones, Frentes y Puertas',
      instruction: 'Deslizar los cajones sobre sus guías telescópicas. Montar las puertas en los brazos de bisagra. Calibrar las luces perimetrales de 2.0 mm mediante los tornillos de regulación tridimensional.',
      piecesInvolved: [...drawers.map((d) => d.id), ...doors.map((d) => d.id)],
      gaugesInvolved: [],
      hardwareRequirements: subAssemblyHardware,
      hardwareSummary: 'Herrajes móviles de apertura',
      toolsRequired: ['Destornillador PH2', 'Espaciadores de 2 mm para luz de frente'],
      criticalDimensionMm: {
        label: 'Luz perimetral entre frentes y casco',
        valueMm: 2.0,
        toleranceMm: 0.5,
      },
      workshopTips: [
        'Utilizar espaciadores de 2 mm en los laterales y base del frente para mantener separación uniforme.',
        'Ajustar el tornillo de profundidad de la bisagra antes de apretar la altura.',
      ],
    });
  }

  // Step 9: Final Quality Inspection
  steps.push({
    stepNumber: stepNumber++,
    phase: 'inspection',
    title: 'Inspección Final de Calidad',
    instruction: 'Retirar todas las tiras de calibre auxiliares del interior del mueble. Verificar apriete de tornillos y limpiar superficies.',
    piecesInvolved: [],
    gaugesInvolved: gauges.map((g) => g.label),
    hardwareRequirements: [],
    hardwareSummary: 'Tapas embellecedoras autoadhesivas',
    toolsRequired: ['Paño de microfibra', 'Solución limpiadora de melamina', 'Tapas cubre-tornillo'],
    workshopTips: [
      'Colocar tapas cubre-tornillo del color exacto de la placa sobre las cabezas de tornillos visibles.',
      'Comprobar la apertura fluida y suave de cajones y puertas sin roces mecánicos.',
    ],
    notes: 'Confirmar que el ancho, alto y profundidad exteriores del módulo cumplan con las especificaciones del diseño.',
  });

  // Calculate Total Hardware BOM across all steps
  const hardwareMap = new Map<string, AssemblyHardwareRequirement>();
  for (const step of steps) {
    for (const h of step.hardwareRequirements) {
      const existing = hardwareMap.get(h.label);
      if (existing) {
        existing.quantity += h.quantity;
      } else {
        hardwareMap.set(h.label, { ...h });
      }
    }
  }

  const totalHardwareBOM = Array.from(hardwareMap.values());

  return {
    moduleId: module.moduleId,
    title: `Guía de Armado - ${module.moduleId}`,
    moduleDimensionsMm: {
      width: modWidth,
      height: modHeight,
      depth: modDepth,
    },
    squaringDiagonalMm,
    steps,
    gauges,
    totalSteps: steps.length,
    explodedMap,
    panelDetails,
    totalHardwareBOM,
  };
}

/**
 * Export assembly sheet guide as a clean, printable workshop PDF.
 * Generates an engineering-grade manual with cover specifications,
 * exploded parts map, panel pre-machining Datum details, and sequential checklist.
 */
export function exportAssemblyGuidePdf(
  sheet: AssemblySheet,
  moduleTitle?: string,
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = 16;

  // -------------------------------------------------------------
  // PÁGINA 1: Carátula, Especificaciones, BOM y Mapa Explotado
  // -------------------------------------------------------------
  // Header banner
  doc.setFillColor(86, 112, 95); // Mobilius Salvia (#56705F)
  doc.rect(margin, y, pageWidth - 2 * margin, 18, 'F');

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('MOBILIUS — MANUAL TÉCNICO DE ARMADO EN TALLER', margin + 4, y + 8);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Módulo: ${sheet.moduleId} | Dimensiones: ${sheet.moduleDimensionsMm.width} x ${sheet.moduleDimensionsMm.height} x ${sheet.moduleDimensionsMm.depth} mm | Diagonal Escuadra: ${sheet.squaringDiagonalMm} mm`, margin + 4, y + 14);

  y += 24;
  doc.setTextColor(31, 38, 34); // Mobilius Text (#1F2622)

  // Subtitle
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(moduleTitle ?? sheet.title, margin, y);
  y += 7;

  // Total Hardware BOM Table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Cómputo Total de Herrajes y Fijaciones (BOM)', margin, y);
  y += 5;

  doc.setFillColor(237, 232, 220); // Mobilius Surface-2 (#EDE8DC)
  doc.rect(margin, y, pageWidth - 2 * margin, 6, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Cant.', margin + 3, y + 4.2);
  doc.text('Herraje / Fijación', margin + 18, y + 4.2);
  doc.text('Herramienta / Broca', margin + 95, y + 4.2);
  doc.text('Fase de Uso', margin + 145, y + 4.2);
  y += 7;

  doc.setFont('helvetica', 'normal');
  for (const h of sheet.totalHardwareBOM) {
    doc.text(`${h.quantity} un.`, margin + 3, y + 3.5);
    doc.text(h.label, margin + 18, y + 3.5);
    doc.text(h.toolRequired ?? 'Punta estándar', margin + 95, y + 3.5);
    doc.text(h.type.toUpperCase(), margin + 145, y + 3.5);
    y += 5.5;
  }
  y += 4;

  // Exploded Piece Map Table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Mapa de Referencias de Piezas (#1, #2...)', margin, y);
  y += 5;

  doc.setFillColor(237, 232, 220);
  doc.rect(margin, y, pageWidth - 2 * margin, 6, 'F');
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('#Ref', margin + 3, y + 4.2);
  doc.text('Nombre / Rol', margin + 18, y + 4.2);
  doc.text('Medidas Corte (W x H x Esp)', margin + 70, y + 4.2);
  doc.text('Especificación de Cantos', margin + 125, y + 4.2);
  y += 7;

  doc.setFont('helvetica', 'normal');
  for (const p of sheet.explodedMap) {
    if (y > pageHeight - 20) {
      doc.addPage();
      y = 16;
    }
    doc.setFont('helvetica', 'bold');
    doc.text(`#${p.referenceNumber}`, margin + 3, y + 3.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`${p.name} (${p.pieceId})`, margin + 18, y + 3.5);
    doc.text(`${p.dimensionsMm.width} x ${p.dimensionsMm.height} x ${p.dimensionsMm.thickness} mm`, margin + 70, y + 3.5);
    doc.text(p.bandedEdgesSummary, margin + 125, y + 3.5);
    y += 5.2;
  }

  // -------------------------------------------------------------
  // PÁGINA 2: Calibres de Montaje y Pre-mecanizado Datum
  // -------------------------------------------------------------
  doc.addPage();
  y = 16;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('3. Calibres de Montaje Derivados (Tiras Auxiliares de Vano)', margin, y);
  y += 6;

  if (sheet.gauges.length === 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('No se requieren calibres de montaje especiales para este módulo.', margin, y);
    y += 8;
  } else {
    doc.setFillColor(237, 232, 220);
    doc.rect(margin, y, pageWidth - 2 * margin, 6, 'F');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('Calibre', margin + 3, y + 4.2);
    doc.text('Luz Libre (Largo)', margin + 25, y + 4.2);
    doc.text('Ancho Tira', margin + 65, y + 4.2);
    doc.text('Cantidad Usos', margin + 95, y + 4.2);
    doc.text('Material / Origen', margin + 130, y + 4.2);
    y += 7;

    doc.setFont('helvetica', 'normal');
    for (const g of sheet.gauges) {
      doc.text(g.label, margin + 3, y + 3.5);
      doc.text(`${g.clearSpanMm} mm`, margin + 25, y + 3.5);
      doc.text(`${g.widthMm} mm`, margin + 65, y + 3.5);
      doc.text(`${g.spansCount} unión(es)`, margin + 95, y + 3.5);
      doc.text('Retazo Auxiliar de Taller', margin + 130, y + 3.5);
      y += 5.5;
    }
    y += 6;
  }

  // Panel Pre-machining Datum Table
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('4. Cotas de Pre-mecanizado en Banco (Datum X=0 Frente, Y=0 Base)', margin, y);
  y += 6;

  for (const pDetail of sheet.panelDetails) {
    if (y > pageHeight - 35) {
      doc.addPage();
      y = 16;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Panel #${pDetail.referenceNumber}: ${pDetail.name} (${pDetail.dimensionsMm.width} x ${pDetail.dimensionsMm.height} x ${pDetail.dimensionsMm.thickness} mm)`, margin, y);
    y += 4.5;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(92, 101, 95);
    doc.text(pDetail.datumNotes, margin, y);
    doc.setTextColor(31, 38, 34);
    y += 4.5;

    if (pDetail.operations.length > 0) {
      doc.setFillColor(245, 243, 236);
      doc.rect(margin, y, pageWidth - 2 * margin, 5, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Cota Y (Base)', margin + 3, y + 3.5);
      doc.text('Cota X (Frente)', margin + 32, y + 3.5);
      doc.text('Mecanizado / Broca', margin + 65, y + 3.5);
      doc.text('Descripción de Operación', margin + 110, y + 3.5);
      y += 6;

      doc.setFont('helvetica', 'normal');
      for (const op of pDetail.operations.slice(0, 12)) {
        if (y > pageHeight - 20) {
          doc.addPage();
          y = 16;
        }
        doc.text(`${op.yFromBottomMm} mm`, margin + 3, y + 3.2);
        doc.text(`${op.xFromFrontMm} mm`, margin + 32, y + 3.2);
        doc.text(op.drillSpecs ?? op.hardwareType, margin + 65, y + 3.2);
        doc.text(op.description, margin + 110, y + 3.2);
        y += 4.8;
      }
    }
    y += 5;
  }

  // -------------------------------------------------------------
  // PÁGINA 3+: Pasos Secuenciales con Diagonales y Checklists
  // -------------------------------------------------------------
  doc.addPage();
  y = 16;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('5. Secuencia de Armado Paso a Paso (Checklist de Taller)', margin, y);
  y += 7;

  for (const step of sheet.steps) {
    if (y > pageHeight - 35) {
      doc.addPage();
      y = 16;
    }

    // Step Header with Box
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`[ ] Paso ${step.stepNumber}: ${step.title}`, margin, y);

    // Phase Tag
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(86, 112, 95);
    doc.text(`[Fase: ${step.phase.toUpperCase()}]`, pageWidth - margin - 35, y);
    doc.setTextColor(31, 38, 34);
    y += 5;

    // Step Instruction
    doc.setFontSize(9);
    const instructionLines = doc.splitTextToSize(step.instruction, pageWidth - 2 * margin - 6);
    doc.text(instructionLines, margin + 4, y);
    y += instructionLines.length * 4.2;

    // Hardware Requirements callout
    if (step.hardwareRequirements.length > 0) {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      const hwStr = step.hardwareRequirements.map((h) => `${h.quantity}x ${h.label}`).join(' + ');
      doc.text(`→ Fijaciones: ${hwStr}`, margin + 4, y);
      y += 4.2;
    }

    // Critical dimensions
    if (step.criticalDimensionMm) {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(179, 65, 47); // Mobilius Danger
      doc.text(`★ COTA CRÍTICA: ${step.criticalDimensionMm.label} = ${step.criticalDimensionMm.valueMm} mm (Tol: ±${step.criticalDimensionMm.toleranceMm} mm)`, margin + 4, y);
      doc.setTextColor(31, 38, 34);
      y += 4.2;
    }

    // Gauges callout
    if (step.gaugesInvolved.length > 0) {
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(63, 125, 78); // Mobilius Success
      doc.text(`→ Calibres Requeridos: ${step.gaugesInvolved.join(', ')}`, margin + 4, y);
      doc.setTextColor(31, 38, 34);
      y += 4.2;
    }

    // Workshop Tips
    if (step.workshopTips && step.workshopTips.length > 0) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(92, 101, 95);
      for (const tip of step.workshopTips) {
        const tipLines = doc.splitTextToSize(`💡 Tip: ${tip}`, pageWidth - 2 * margin - 6);
        doc.text(tipLines, margin + 4, y);
        y += tipLines.length * 3.8;
      }
      doc.setTextColor(31, 38, 34);
    } else if (step.notes) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(92, 101, 95);
      doc.text(`Nota: ${step.notes}`, margin + 4, y);
      doc.setTextColor(31, 38, 34);
      y += 4;
    }

    y += 3.5;
  }

  return doc;
}
