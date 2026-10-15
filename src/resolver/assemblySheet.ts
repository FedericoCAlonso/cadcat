import { jsPDF } from 'jspdf';
import type { ResolvedModule, ResolvedPiece } from './resolver';
import type { Joint, MachiningConfig } from '../model';
import { deriveAssemblyGauges, type AssemblyGauge } from './gauges';

export interface AssemblyStep {
  stepNumber: number;
  title: string;
  instruction: string;
  piecesInvolved: string[];
  gaugesInvolved: string[];
  hardwareSummary?: string;
  notes?: string;
}

export interface AssemblySheet {
  moduleId: string;
  title: string;
  steps: AssemblyStep[];
  gauges: AssemblyGauge[];
  totalSteps: number;
}

export interface GenerateAssemblySheetInput {
  module: ResolvedModule | { moduleId: string; pieces: ResolvedPiece[]; joints: Joint[] };
  gauges?: AssemblyGauge[];
  machiningConfig?: MachiningConfig;
}

/**
 * Generate sequential assembly steps for the manual workshop.
 * Uses assembly gauges (e.g., G1, G2) for precise shelf and divider placement without measuring.
 */
export function generateAssemblySheet(input: GenerateAssemblySheetInput): AssemblySheet {
  const { module } = input;
  const pieces = module.pieces.filter((p) => !p.isAuxiliary);
  const joints = module.joints;
  const gauges = input.gauges ?? deriveAssemblyGauges({ pieces, joints }, input.machiningConfig);

  const steps: AssemblyStep[] = [];
  let stepNumber = 1;

  // Gauge lookup map by lower & upper piece ids
  const gaugeByPair = new Map<string, string>();
  for (const g of gauges) {
    for (const occ of g.occurrences) {
      gaugeByPair.set(`${occ.lowerPieceId}->${occ.upperPieceId}`, g.label);
    }
  }

  // 1. Preparation Step
  const gaugeSummary = gauges.length > 0
    ? gauges.map((g) => `${g.label} (${g.clearSpanMm} mm)`).join(', ')
    : 'Ninguno requerido';

  steps.push({
    stepNumber: stepNumber++,
    title: 'Preparación y Verificación de Calibres',
    instruction: `Disponer todos los paneles cortados sobre el banco de trabajo. Verificar calibres de montaje: ${gaugeSummary}. Inspeccionar cantos y perforaciones.`,
    piecesInvolved: pieces.map((p) => p.id),
    gaugesInvolved: gauges.map((g) => g.label),
    notes: 'Asegurar que el banco de trabajo esté limpio y plano para prevenir rayaduras en las superficies.',
  });

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

  // 2. Hardware Pre-installation on flat panels
  const hardwareCount = joints.length;
  if (hardwareCount > 0 && (sideLeft || sideRight)) {
    const sideIds = [sideLeft?.id, sideRight?.id].filter((id): id is string => Boolean(id));
    steps.push({
      stepNumber: stepNumber++,
      title: 'Pre-mecanizado e Inserción de Herrajes',
      instruction: 'Colocar tarugos, pernos minifix y guías de cajón o bases de bisagra en los laterales en plano sobre el banco de trabajo.',
      piecesInvolved: sideIds,
      gaugesInvolved: [],
      hardwareSummary: `${hardwareCount} conexiones de unión planificadas`,
      notes: 'Montar herrajes sobre paneles en plano es más rápido y previene desalineaciones durante el ensamble del casco.',
    });
  }

  // 3. Base Carcass Assembly (Bottom + Sides)
  if (bottom && sideLeft) {
    steps.push({
      stepNumber: stepNumber++,
      title: 'Ensamblar Base con Lateral Izquierdo',
      instruction: `Posicionar la base (${bottom.id}) contra el lateral izquierdo (${sideLeft.id}). Enrasar cantos y fijar uniones.`,
      piecesInvolved: [bottom.id, sideLeft.id],
      gaugesInvolved: [],
      hardwareSummary: 'Tornillos Confirmat / Minifix',
    });
  }

  if (bottom && sideRight) {
    steps.push({
      stepNumber: stepNumber++,
      title: 'Ensamblar Base con Lateral Derecho',
      instruction: `Posicionar el lateral derecho (${sideRight.id}) contra la base (${bottom.id}). Enrasar cantos y fijar uniones.`,
      piecesInvolved: [bottom.id, sideRight.id],
      gaugesInvolved: [],
      hardwareSummary: 'Tornillos Confirmat / Minifix',
    });
  }

  // 4. Sequential Shelves Installation using Gauges
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
      // Find gauge matching clear span along Y
      const spanMm = previousHorizontalPiece
        ? shelf.positionMm.y - (previousHorizontalPiece.positionMm.y + previousHorizontalPiece.dimensionsMm.height)
        : shelf.positionMm.y;
      const matched = gauges.find((g) => Math.abs(g.clearSpanMm - spanMm) <= 2.0);
      if (matched) matchedGaugeLabel = matched.label;
    }

    if (matchedGaugeLabel) {
      steps.push({
        stepNumber: stepNumber++,
        title: `Instalar ${shelfName} con Calibre ${matchedGaugeLabel}`,
        instruction: `Apoyar el calibre (gauge ${matchedGaugeLabel}) sobre ${prevName}. Colocar ${shelfName} sobre el calibre (gauge ${matchedGaugeLabel}). Fijar uniones.`,
        piecesInvolved: [shelf.id, ...(previousHorizontalPiece ? [previousHorizontalPiece.id] : [])],
        gaugesInvolved: [matchedGaugeLabel],
        hardwareSummary: 'Tornillos confirmat o soportes de estante',
        notes: `El calibre ${matchedGaugeLabel} garantiza paralelismo exacto sin usar cinta métrica.`,
      });
    } else {
      steps.push({
        stepNumber: stepNumber++,
        title: `Instalar ${shelfName}`,
        instruction: `Posicionar ${shelfName} a la altura proyectada sobre ${prevName}. Verificar nivel y fijar uniones.`,
        piecesInvolved: [shelf.id],
        gaugesInvolved: [],
        hardwareSummary: 'Fijar tornillos confirmat',
      });
    }

    previousHorizontalPiece = shelf;
  }

  // 5. Rails / Top Panel Installation
  if (rails.length > 0) {
    const railIds = rails.map((r) => r.id);
    steps.push({
      stepNumber: stepNumber++,
      title: 'Instalar Fajas / Travesaños Superiores',
      instruction: `Posicionar las fajas superiores (${railIds.join(', ')}). Enrasar con el borde superior de los laterales y asegurar uniones.`,
      piecesInvolved: railIds,
      gaugesInvolved: [],
      hardwareSummary: 'Tornillos confirmat',
    });
  } else if (top) {
    steps.push({
      stepNumber: stepNumber++,
      title: 'Instalar Tapa Superior',
      instruction: `Posicionar la tapa superior (${top.id}) enrasada con el borde superior del mueble. Asegurar uniones.`,
      piecesInvolved: [top.id],
      gaugesInvolved: [],
      hardwareSummary: 'Tornillos Confirmat / Minifix',
    });
  }

  // 6. Squaring and Back Panel
  if (back) {
    steps.push({
      stepNumber: stepNumber++,
      title: 'Escuadrar Casco y Colocar Fondo',
      instruction: `Medir ambas diagonales entre esquinas opuestas del mueble. Verificar que coincidan con tolerancia ≤ 1 mm. Insertar o atornillar el fondo (${back.id}) en ranuras o solape y fijar.`,
      piecesInvolved: [back.id],
      gaugesInvolved: [],
      notes: 'El casco debe estar perfectamente a escuadra antes de fijar el fondo.',
    });
  }

  // 7. Final Inspection
  steps.push({
    stepNumber: stepNumber++,
    title: 'Inspección Final de Calidad',
    instruction: 'Retirar todas las tiras de calibre auxiliares del interior del mueble. Verificar apriete de tornillos y limpiar superficies.',
    piecesInvolved: [],
    gaugesInvolved: gauges.map((g) => g.label),
    notes: 'Confirmar que el ancho, alto y profundidad exteriores del módulo cumplan con las especificaciones del diseño.',
  });

  return {
    moduleId: module.moduleId,
    title: `Guía de Armado - ${module.moduleId}`,
    steps,
    gauges,
    totalSteps: steps.length,
  };
}

/**
 * Export assembly sheet guide as a clean, printable workshop PDF.
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
  const margin = 15;
  let y = 18;

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(moduleTitle ?? sheet.title, margin, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Módulo: ${sheet.moduleId} | Hoja de Armado Secuencial | Mobilius Workshop System`, margin, y);
  y += 10;

  // Assembly Gauges Section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Calibres de Montaje (Tiras Auxiliares de Taller)', margin, y);
  y += 6;

  if (sheet.gauges.length === 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('No se requieren calibres de montaje especiales para este módulo.', margin, y);
    y += 8;
  } else {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 4, pageWidth - 2 * margin, 6, 'F');
    doc.text('Calibre', margin + 2, y);
    doc.text('Luz Libre', margin + 25, y);
    doc.text('Ancho Tira', margin + 55, y);
    doc.text('Cantidad Usos', margin + 80, y);
    doc.text('Material / Rol', margin + 115, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    for (const g of sheet.gauges) {
      doc.text(g.label, margin + 2, y);
      doc.text(`${g.clearSpanMm} mm`, margin + 25, y);
      doc.text(`${g.widthMm} mm`, margin + 55, y);
      doc.text(`${g.spansCount} unión(es)`, margin + 80, y);
      doc.text('Retazo Auxiliar (assembly-gauge)', margin + 115, y);
      y += 5;
    }
    y += 5;
  }

  // Sequential Steps Section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Pasos Secuenciales de Armado', margin, y);
  y += 7;

  for (const step of sheet.steps) {
    // Check page break
    if (y > 260) {
      doc.addPage();
      y = 18;
    }

    // Step Header
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`[ ] Paso ${step.stepNumber}: ${step.title}`, margin, y);
    y += 5;

    // Step Instruction
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const instructionLines = doc.splitTextToSize(step.instruction, pageWidth - 2 * margin - 5);
    doc.text(instructionLines, margin + 5, y);
    y += instructionLines.length * 4.2;

    if (step.gaugesInvolved.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 100, 30);
      doc.text(`→ Calibres Requeridos: ${step.gaugesInvolved.join(', ')}`, margin + 5, y);
      doc.setTextColor(0, 0, 0);
      y += 4.5;
    }

    if (step.notes) {
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(90, 90, 90);
      doc.text(`Nota: ${step.notes}`, margin + 5, y);
      doc.setTextColor(0, 0, 0);
      y += 4.5;
    }

    y += 2.5;
  }

  return doc;
}
