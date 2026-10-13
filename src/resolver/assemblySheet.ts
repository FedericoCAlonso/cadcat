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
    : 'None required';

  steps.push({
    stepNumber: stepNumber++,
    title: 'Preparation & Gauge Verification',
    instruction: `Lay out all cut panels on workbench. Verify assembly gauges: ${gaugeSummary}. Inspect edges and drill patterns.`,
    piecesInvolved: pieces.map((p) => p.id),
    gaugesInvolved: gauges.map((g) => g.label),
    notes: 'Ensure workbench is clean and flat to prevent panel surface scratches.',
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
      title: 'Pre-drill & Hardware Insertion',
      instruction: 'Insert dowels, cam pins, and drawer runners or hinge plates on side panels while flat on workbench.',
      piecesInvolved: sideIds,
      gaugesInvolved: [],
      hardwareSummary: `${hardwareCount} joint connections planned`,
      notes: 'Mounting hardware on flat panels is faster and prevents drill misalignment during carcass assembly.',
    });
  }

  // 3. Base Carcass Assembly (Bottom + Sides)
  if (bottom && sideLeft) {
    steps.push({
      stepNumber: stepNumber++,
      title: 'Assemble Bottom to Left Side',
      instruction: `Position bottom panel (${bottom.id}) against left side (${sideLeft.id}). Align edges flush and secure joints.`,
      piecesInvolved: [bottom.id, sideLeft.id],
      gaugesInvolved: [],
      hardwareSummary: 'Confirmat / Cam Lock screws',
    });
  }

  if (bottom && sideRight) {
    steps.push({
      stepNumber: stepNumber++,
      title: 'Assemble Bottom to Right Side',
      instruction: `Position right side (${sideRight.id}) against bottom panel (${bottom.id}). Align edges flush and secure joints.`,
      piecesInvolved: [bottom.id, sideRight.id],
      gaugesInvolved: [],
      hardwareSummary: 'Confirmat / Cam Lock screws',
    });
  }

  // 4. Sequential Shelves Installation using Gauges
  let previousHorizontalPiece = bottom;

  for (let i = 0; i < shelves.length; i++) {
    const shelf = shelves[i]!;
    const shelfName = `shelf ${i + 1} (${shelf.id})`;
    const prevName = previousHorizontalPiece ? previousHorizontalPiece.id : 'bottom panel';

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
        title: `Install ${shelfName} with Gauge ${matchedGaugeLabel}`,
        instruction: `Place gauge ${matchedGaugeLabel} on ${prevName}. Place ${shelfName} on gauge ${matchedGaugeLabel}. Secure joints.`,
        piecesInvolved: [shelf.id, ...(previousHorizontalPiece ? [previousHorizontalPiece.id] : [])],
        gaugesInvolved: [matchedGaugeLabel],
        hardwareSummary: 'Fasten confirmat screws or shelf supports',
        notes: `Gauge ${matchedGaugeLabel} guarantees exact parallel alignment without measuring tape.`,
      });
    } else {
      steps.push({
        stepNumber: stepNumber++,
        title: `Install ${shelfName}`,
        instruction: `Position ${shelfName} at design height above ${prevName}. Check level and secure joints.`,
        piecesInvolved: [shelf.id],
        gaugesInvolved: [],
        hardwareSummary: 'Fasten confirmat screws',
      });
    }

    previousHorizontalPiece = shelf;
  }

  // 5. Rails / Top Panel Installation
  if (rails.length > 0) {
    const railIds = rails.map((r) => r.id);
    steps.push({
      stepNumber: stepNumber++,
      title: 'Install Top Rails',
      instruction: `Position top stretchers/rails (${railIds.join(', ')}). Clamp flush with top edge of side panels and fasten joints.`,
      piecesInvolved: railIds,
      gaugesInvolved: [],
      hardwareSummary: 'Confirmat screws',
    });
  } else if (top) {
    steps.push({
      stepNumber: stepNumber++,
      title: 'Install Top Panel',
      instruction: `Position top panel (${top.id}) flush with carcass upper edges. Secure joints.`,
      piecesInvolved: [top.id],
      gaugesInvolved: [],
      hardwareSummary: 'Confirmat / Cam Lock screws',
    });
  }

  // 6. Squaring and Back Panel
  if (back) {
    steps.push({
      stepNumber: stepNumber++,
      title: 'Square Carcass & Attach Back Panel',
      instruction: `Measure both diagonal dimensions across cabinet corners. Verify diagonals match within 1 mm. Position back panel (${back.id}) into grooves/rebates and fasten.`,
      piecesInvolved: [back.id],
      gaugesInvolved: [],
      notes: 'Carcase must be perfectly square before fixing the back panel.',
    });
  }

  // 7. Final Inspection
  steps.push({
    stepNumber: stepNumber++,
    title: 'Final Quality Check',
    instruction: 'Remove all auxiliary gauge strips from carcass interior. Inspect joint tightness and clean surfaces.',
    piecesInvolved: [],
    gaugesInvolved: gauges.map((g) => g.label),
    notes: 'Confirm module exterior width, height, and depth meet specification.',
  });

  return {
    moduleId: module.moduleId,
    title: `Assembly Guide - ${module.moduleId}`,
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
  doc.text(`Module: ${sheet.moduleId} | Sequential Assembly Sheet | Mobilius Workshop System`, margin, y);
  y += 10;

  // Assembly Gauges Section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Assembly Gauges (Auxiliary Workshop Strips)', margin, y);
  y += 6;

  if (sheet.gauges.length === 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.text('No specialized assembly gauges required for this module.', margin, y);
    y += 8;
  } else {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 4, pageWidth - 2 * margin, 6, 'F');
    doc.text('Gauge', margin + 2, y);
    doc.text('Clear Span', margin + 25, y);
    doc.text('Width', margin + 55, y);
    doc.text('Usage Count', margin + 80, y);
    doc.text('Material / Role', margin + 115, y);
    y += 6;

    doc.setFont('helvetica', 'normal');
    for (const g of sheet.gauges) {
      doc.text(g.label, margin + 2, y);
      doc.text(`${g.clearSpanMm} mm`, margin + 25, y);
      doc.text(`${g.widthMm} mm`, margin + 55, y);
      doc.text(`${g.spansCount} joint(s)`, margin + 80, y);
      doc.text('Auxiliary Offcut (role: assembly-gauge)', margin + 115, y);
      y += 5;
    }
    y += 5;
  }

  // Sequential Steps Section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Sequential Assembly Steps', margin, y);
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
    doc.text(`[ ] Step ${step.stepNumber}: ${step.title}`, margin, y);
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
      doc.text(`→ Required Gauges: ${step.gaugesInvolved.join(', ')}`, margin + 5, y);
      doc.setTextColor(0, 0, 0);
      y += 4.5;
    }

    if (step.notes) {
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(90, 90, 90);
      doc.text(`Note: ${step.notes}`, margin + 5, y);
      doc.setTextColor(0, 0, 0);
      y += 4.5;
    }

    y += 2.5;
  }

  return doc;
}
