import { jsPDF } from 'jspdf';
import { type ResolvedPieceWithCutSize, type BandedEdgeInfo } from './edgeBand';
import { type BOMPieceItem } from './bom';
import { type NestingResult } from '../workers';

/**
 * Escape a CSV field value.
 */
function escapeCsv(val: string | number | boolean): string {
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Format banded edges into a readable CSV string.
 */
function formatBandedEdges(banded: BandedEdgeInfo[]): string {
  if (banded.length === 0) return 'None';
  return banded.map((b) => `${b.faceId} (${b.thicknessMm}mm)`).join('; ');
}

/**
 * Export pieces cut list to CSV format.
 * Section 8.3: The cut list always shows the cut size.
 */
export function exportCutListCsv(
  pieces: (ResolvedPieceWithCutSize | BOMPieceItem)[],
): string {
  const headers = [
    'Piece ID',
    'Role',
    'Material ID',
    'Finished Width (mm)',
    'Finished Height (mm)',
    'Cut Width (mm)',
    'Cut Height (mm)',
    'Thickness (mm)',
    'Structural',
    'Edge Bands',
  ];

  const rows: string[] = [headers.join(',')];

  for (const piece of pieces) {
    const finishedW = 'dimensionsMm' in piece
      ? piece.dimensionsMm.width
      : piece.finishedDimensionsMm.width;
    const finishedH = 'dimensionsMm' in piece
      ? piece.dimensionsMm.height
      : piece.finishedDimensionsMm.height;
    const cutW = piece.cutDimensionsMm.width;
    const cutH = piece.cutDimensionsMm.height;
    const bandedStr = formatBandedEdges(piece.bandedEdges);

    const pieceId = 'id' in piece ? piece.id : piece.pieceId;
    const row = [
      escapeCsv(pieceId),
      escapeCsv(piece.role),
      escapeCsv(piece.materialId),
      escapeCsv(finishedW),
      escapeCsv(finishedH),
      escapeCsv(cutW),
      escapeCsv(cutH),
      escapeCsv(piece.thicknessMm),
      escapeCsv(piece.structural ? 'Yes' : 'No'),
      escapeCsv(bandedStr),
    ];

    rows.push(row.join(','));
  }

  return rows.join('\r\n');
}

/**
 * Generate a PDF cut plan showing sheet diagrams and cut piece positions.
 */
export function exportCutPlanPdf(
  nestingResult: NestingResult,
  documentTitle = 'Mobilius - Sheet Cut Plan',
): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  if (nestingResult.sheets.length === 0) {
    doc.setFontSize(18);
    doc.text(documentTitle, 14, 20);
    doc.setFontSize(12);
    doc.text('No sheets generated in nesting plan.', 14, 35);
    return doc;
  }

  nestingResult.sheets.forEach((sheet, index) => {
    if (index > 0) {
      doc.addPage('a4', 'landscape');
    }

    // Header
    doc.setFontSize(16);
    doc.text(`${documentTitle} - Sheet ${sheet.sheetIndex + 1} of ${nestingResult.sheets.length}`, 14, 15);

    doc.setFontSize(10);
    doc.text(
      `Material: ${sheet.materialId} | Sheet Size: ${sheet.sheetLengthMm} x ${sheet.sheetWidthMm} mm | ` +
      `Utilization: ${sheet.utilizationPercentage}% | Placed Pieces: ${sheet.placedPieces.length}`,
      14,
      22,
    );

    // Draw scaled sheet diagram
    const marginX = 14;
    const marginY = 28;
    const maxDrawWidth = pageWidth - 2 * marginX;
    const maxDrawHeight = pageHeight - marginY - 14;

    const scaleX = maxDrawWidth / sheet.sheetLengthMm;
    const scaleY = maxDrawHeight / sheet.sheetWidthMm;
    const scale = Math.min(scaleX, scaleY);

    const drawW = sheet.sheetLengthMm * scale;
    const drawH = sheet.sheetWidthMm * scale;

    // Sheet raw outline (grey fill)
    doc.setFillColor(240, 240, 240);
    doc.setDrawColor(80, 80, 80);
    doc.setLineWidth(0.5);
    doc.rect(marginX, marginY, drawW, drawH, 'FD');

    // Draw pieces
    doc.setFontSize(7);
    for (const piece of sheet.placedPieces) {
      const px = marginX + piece.x * scale;
      const py = marginY + piece.y * scale;
      const pw = piece.width * scale;
      const ph = piece.height * scale;

      // Piece box
      doc.setFillColor(215, 230, 245);
      doc.setDrawColor(25, 75, 125);
      doc.setLineWidth(0.3);
      doc.rect(px, py, pw, ph, 'FD');

      // Piece label if space permits
      if (pw > 15 && ph > 8) {
        doc.setTextColor(20, 20, 20);
        const label = piece.pieceId;
        const dims = `${piece.width}x${piece.height}`;
        doc.text(label, px + 2, py + 4);
        if (ph > 12) {
          doc.text(dims, px + 2, py + 8);
        }
      }
    }
  });

  return doc;
}

/**
 * Trigger file download in browser environments.
 */
export function triggerBrowserDownload(
  fileName: string,
  content: string | Blob | Uint8Array,
  mimeType: string,
): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const blob = content instanceof Blob
    ? content
    : new Blob([content as unknown as BlobPart], { type: mimeType });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
