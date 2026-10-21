import { jsPDF } from 'jspdf';
import {
  type LabelLayoutConfig,
  type PieceLabelData,
  LABEL_LAYOUT_PRESETS,
} from '../../model';

export interface GenerateLabelPdfOptions {
  layout?: LabelLayoutConfig;
  showCuttingGuidelines?: boolean;
}

/**
 * Renders a crisp pseudo-QR code matrix inside a specified bounding box.
 */
function drawQrPlaceholder(
  doc: jsPDF,
  x: number,
  y: number,
  size: number,
  dataString: string,
): void {
  // Background white box with subtle outline
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(180, 190, 205);
  doc.rect(x, y, size, size, 'FD');

  const cellSize = size / 7;

  // Draw 3 Corner Finder Patterns (standard QR markers)
  const drawFinderPattern = (fx: number, fy: number) => {
    doc.setFillColor(20, 30, 45);
    doc.rect(fx, fy, cellSize * 2.2, cellSize * 2.2, 'F');
    doc.setFillColor(255, 255, 255);
    doc.rect(fx + cellSize * 0.45, fy + cellSize * 0.45, cellSize * 1.3, cellSize * 1.3, 'F');
    doc.setFillColor(20, 30, 45);
    doc.rect(fx + cellSize * 0.75, fy + cellSize * 0.75, cellSize * 0.7, cellSize * 0.7, 'F');
  };

  // Top-left
  drawFinderPattern(x + cellSize * 0.4, y + cellSize * 0.4);
  // Top-right
  drawFinderPattern(x + size - cellSize * 2.6, y + cellSize * 0.4);
  // Bottom-left
  drawFinderPattern(x + cellSize * 0.4, y + size - cellSize * 2.6);

  // Pseudo-random data dots based on string hash for deterministic visual texture
  let hash = 0;
  for (let i = 0; i < dataString.length; i++) {
    hash = (hash << 5) - hash + dataString.charCodeAt(i);
    hash |= 0;
  }

  doc.setFillColor(30, 40, 55);
  for (let r = 2; r < 5; r++) {
    for (let c = 2; c < 5; c++) {
      if ((hash + r * 7 + c) % 2 === 0) {
        doc.rect(x + c * cellSize, y + r * cellSize, cellSize * 0.8, cellSize * 0.8, 'F');
      }
    }
  }

  // QR label below
  doc.setFontSize(4.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 115, 130);
  doc.text('CADCAT ID', x + size / 2, y + size + 2, { align: 'center' });
}

/**
 * Draws a single piece label at coordinates (x, y) with dimensions (w, h).
 */
export function drawSinglePieceLabel(
  doc: jsPDF,
  label: PieceLabelData,
  x: number,
  y: number,
  w: number,
  h: number,
  showOutline = true,
): void {
  // Border guideline
  if (showOutline) {
    doc.setDrawColor(210, 220, 230);
    doc.setLineWidth(0.2);
    doc.rect(x, y, w, h, 'S');
  }

  const margin = 2.5;
  let curY = y + margin + 2.5;

  // -------------------------------------------------------------
  // Header: Order ID + Client + Index
  // -------------------------------------------------------------
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139); // Slate-500

  const headerLeft = `${label.orderId} · ${label.clientName.toUpperCase()}`.substring(0, 35);
  doc.text(headerLeft, x + margin, curY);

  const headerRight = `#${label.pieceIndex} / ${label.totalPieces}`;
  doc.text(headerRight, x + w - margin, curY, { align: 'right' });
  curY += 3.2;

  // Module and Piece Name
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42); // Slate-900
  const pieceTitle = `[${label.moduleId}] ${label.pieceName}`;
  doc.text(pieceTitle, x + margin, curY);
  curY += 2.2;

  // Header separator
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(x + margin, curY, x + w - margin, curY);
  curY += 3.2;

  // -------------------------------------------------------------
  // Primary Cut Dimensions (Large & Bold)
  // -------------------------------------------------------------
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`CORTE: ${label.cutWidthMm} x ${label.cutHeightMm} mm`, x + margin, curY);
  curY += 3.2;

  // Finished Size and Material
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  const finText = `(Fin: ${label.finishedWidthMm} x ${label.finishedHeightMm} mm) · ${label.materialName} ${label.thicknessMm}mm`;
  doc.text(finText, x + margin, curY);
  curY += 2.8;

  // Grain indicator
  if (label.hasGrain) {
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 83, 9); // Amber-700
    doc.text(`↔ Veta en cota ${label.cutHeightMm} mm`, x + margin, curY);
  }
  curY += 3.5;

  // -------------------------------------------------------------
  // Center Section: Edge Banding Compass (Brújula de Cantos)
  // -------------------------------------------------------------
  const compassW = 34;
  const compassH = 14;
  const compassX = x + margin + 1;
  const compassY = curY;

  // Center mini piece rectangle
  const miniW = 14;
  const miniH = 8;
  const miniX = compassX + (compassW - miniW) / 2;
  const miniY = compassY + (compassH - miniH) / 2;

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(148, 163, 184);
  doc.rect(miniX, miniY, miniW, miniH, 'FD');

  doc.setFontSize(5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('PIEZA', miniX + miniW / 2, miniY + miniH / 2 + 1.2, { align: 'center' });

  // Format edge thickness text
  const edgeStr = (eb?: { thicknessMm: number; note?: string }) => {
    if (!eb || eb.thicknessMm === 0) return 'S/C';
    return `${eb.thicknessMm}${eb.note ? ' ' + eb.note : ''}`;
  };

  doc.setFontSize(5.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);

  // Top edge (L1)
  doc.text(edgeStr(label.edgeBands.top), miniX + miniW / 2, miniY - 1, { align: 'center' });
  // Bottom edge (L2)
  doc.text(edgeStr(label.edgeBands.bottom), miniX + miniW / 2, miniY + miniH + 3, { align: 'center' });
  // Left edge (A1)
  doc.text(edgeStr(label.edgeBands.left), miniX - 1.5, miniY + miniH / 2 + 1, { align: 'right' });
  // Right edge (A2)
  doc.text(edgeStr(label.edgeBands.right), miniX + miniW + 1.5, miniY + miniH / 2 + 1, { align: 'left' });

  // -------------------------------------------------------------
  // QR Code / Visual Anchor (Right Side)
  // -------------------------------------------------------------
  const qrSize = 13.5;
  const qrX = x + w - margin - qrSize;
  const qrY = compassY - 1;
  drawQrPlaceholder(doc, qrX, qrY, qrSize, label.qrData || label.pieceId);

  // -------------------------------------------------------------
  // Footer: Machining operations / Secondary cut alert
  // -------------------------------------------------------------
  const footerY = y + h - margin - 0.5;

  if (label.secondaryOperationsSummary && label.secondaryOperationsSummary.length > 0) {
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(185, 28, 28); // Red-700
    doc.text(`⚠️ ${label.secondaryOperationsSummary.join(' · ')}`, x + margin, footerY);
  } else if (label.hasMachining) {
    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(3, 105, 161); // Sky-700
    doc.text(`⚙️ ${label.machiningSummary || 'Lleva mecanizados de ensamble'}`, x + margin, footerY);
  } else {
    doc.setFontSize(5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);
    doc.text('Corte recto limpio · Sin perforaciones', x + margin, footerY);
  }
}

/**
 * Generates an A4 or Thermal Roll PDF document with all piece labels.
 */
export function exportLabelsPdf(
  labels: PieceLabelData[],
  options: GenerateLabelPdfOptions = {},
): jsPDF {
  const layout = options.layout ?? LABEL_LAYOUT_PRESETS['thermal-100x50'];

  if (layout.isContinuousRoll) {
    // -------------------------------------------------------------
    // Continuous Thermal Roll (e.g. 100x50mm or 80x50mm)
    // -------------------------------------------------------------
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [layout.pageWidthMm, layout.pageHeightMm],
    });

    labels.forEach((label, index) => {
      if (index > 0) {
        doc.addPage([layout.pageWidthMm, layout.pageHeightMm], 'landscape');
      }
      drawSinglePieceLabel(
        doc,
        label,
        0,
        0,
        layout.labelWidthMm,
        layout.labelHeightMm,
        options.showCuttingGuidelines ?? false,
      );
    });

    return doc;
  }

  // ---------------------------------------------------------------
  // Standard Sheet Layout (e.g. A4 with 12, 16, or 8 labels per sheet)
  // ---------------------------------------------------------------
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const {
    columns,
    labelsPerPage,
    labelWidthMm,
    labelHeightMm,
    marginLeftMm,
    marginTopMm,
    horizontalGapMm,
    verticalGapMm,
  } = layout;

  labels.forEach((label, index) => {
    const indexOnPage = index % labelsPerPage;

    if (index > 0 && indexOnPage === 0) {
      doc.addPage('a4', 'portrait');
    }

    const col = indexOnPage % columns;
    const row = Math.floor(indexOnPage / columns);

    const x = marginLeftMm + col * (labelWidthMm + horizontalGapMm);
    const y = marginTopMm + row * (labelHeightMm + verticalGapMm);

    drawSinglePieceLabel(
      doc,
      label,
      x,
      y,
      labelWidthMm,
      labelHeightMm,
      options.showCuttingGuidelines ?? true,
    );
  });

  return doc;
}
