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
/**
 * Translates technical piece IDs or roles into friendly Argentine Spanish descriptions.
 */
export function translatePieceLabel(pieceId: string): string {
  const lower = pieceId.toLowerCase();
  if (lower.startsWith('gauge') || lower.includes('calibre')) {
    const match = lower.match(/g\d+/);
    return match ? `Calibre ${match[0].toUpperCase()}` : 'Calibre de armado';
  }
  // Drawer components first to avoid matching generic side/bottom
  if (lower.includes('drawer-box-side-left') || lower.includes('lateral-cajon-izq')) return 'Lat. cajón izq';
  if (lower.includes('drawer-box-side-right') || lower.includes('lateral-cajon-der')) return 'Lat. cajón der';
  if (lower.includes('drawer-box-front') || lower.includes('cabezal-cajon')) return 'Frente int. cajón';
  if (lower.includes('drawer-box-back') || lower.includes('contrafrente')) return 'Contrafrente cajón';
  if (lower.includes('drawer-bottom') || lower.includes('fondo-cajon')) return 'Fondo cajón';
  if (lower.includes('drawer-front') || lower.includes('frente-cajon')) return 'Frente cajón';

  // Carcase components
  if (lower.includes('side-left') || lower.includes('lateral-izq') || lower.includes('side_left')) return 'Lateral izquierdo';
  if (lower.includes('side-right') || lower.includes('lateral-der') || lower.includes('side_right')) return 'Lateral derecho';
  if (lower.includes('partition') || lower.includes('divisor') || lower.includes('separador')) return 'Divisor vertical';
  if (lower.includes('bottom') || lower.includes('piso')) return 'Piso';
  if (lower.includes('roof') || lower.includes('techo') || lower.includes('top')) return 'Techo';
  if (lower.includes('rail-front') || lower.includes('faja-front')) return 'Faja sup. frontal';
  if (lower.includes('rail-back') || lower.includes('faja-tras')) return 'Faja sup. trasera';
  if (lower.includes('rail') || lower.includes('travesaño') || lower.includes('transom')) return 'Travesaño';
  if (lower.includes('shelf-adj') || lower.includes('estante-movil')) return 'Estante móvil';
  if (lower.includes('shelf') || lower.includes('estante')) return 'Estante';
  if (lower.includes('door-left') || lower.includes('puerta-izq')) return 'Puerta izq';
  if (lower.includes('door-right') || lower.includes('puerta-der')) return 'Puerta der';
  if (lower.includes('door') || lower.includes('puerta')) return 'Puerta';
  if (lower.includes('back') || lower.includes('fondo') || lower.includes('trasera')) return 'Fondo trasero';
  return pieceId;
}

/**
 * Export nesting result to a visual 2D diagram PDF.
 * Uses 100% Argentine Spanish labels, piece codes, and a sheet piece summary table.
 */
export function exportCutPlanPdf(
  nestingResult: NestingResult,
  documentTitle = 'Plano de Corte Mobilius',
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
    doc.text('No se generaron hojas en el plano de corte.', 14, 35);
    return doc;
  }

  nestingResult.sheets.forEach((sheet, index) => {
    if (index > 0) {
      doc.addPage('a4', 'landscape');
    }

    // Header in Spanish
    doc.setFontSize(15);
    doc.text(`${documentTitle} - Hoja ${sheet.sheetIndex + 1} de ${nestingResult.sheets.length}`, 14, 13);

    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(
      `Material: ${sheet.materialId} | Formato Placa: ${sheet.sheetLengthMm} x ${sheet.sheetWidthMm} mm | ` +
      `Aprovechamiento: ${sheet.utilizationPercentage}% | Piezas en hoja: ${sheet.placedPieces.length}`,
      14,
      19,
    );

    // Group placed pieces to generate short codes [P1], [P2], etc.
    interface PieceGroupItem {
      code: string;
      name: string;
      width: number;
      height: number;
      count: number;
    }
    const groupMap = new Map<string, PieceGroupItem>();
    const pieceCodeMap = new Map<string, string>();
    let groupIndex = 1;

    for (const piece of sheet.placedPieces) {
      const friendlyName = translatePieceLabel(piece.pieceId);
      const w = Math.round(piece.width);
      const h = Math.round(piece.height);
      const key = `${friendlyName}_${w}_${h}`;

      if (!groupMap.has(key)) {
        const code = `P${groupIndex++}`;
        groupMap.set(key, { code, name: friendlyName, width: w, height: h, count: 1 });
        pieceCodeMap.set(piece.pieceId, code);
      } else {
        const item = groupMap.get(key)!;
        item.count++;
        pieceCodeMap.set(piece.pieceId, item.code);
      }
    }

    // Layout configuration: Sheet diagram on top, summary table below
    const marginX = 14;
    const marginY = 24;
    const maxDrawWidth = pageWidth - 2 * marginX;
    const maxDrawHeight = 115; // leaves 60mm below for piece checklist table

    const scaleX = maxDrawWidth / sheet.sheetLengthMm;
    const scaleY = maxDrawHeight / sheet.sheetWidthMm;
    const scale = Math.min(scaleX, scaleY);

    const drawW = sheet.sheetLengthMm * scale;
    const drawH = sheet.sheetWidthMm * scale;

    // Raw sheet outline
    doc.setFillColor(245, 245, 245);
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.5);
    doc.rect(marginX, marginY, drawW, drawH, 'FD');

    // Draw pieces
    for (const piece of sheet.placedPieces) {
      const px = marginX + piece.x * scale;
      const py = marginY + piece.y * scale;
      const pw = piece.width * scale;
      const ph = piece.height * scale;

      // Piece box
      doc.setFillColor(219, 234, 254); // Soft blue
      doc.setDrawColor(30, 64, 175);
      doc.setLineWidth(0.3);
      doc.rect(px, py, pw, ph, 'FD');

      const friendlyName = translatePieceLabel(piece.pieceId);
      const code = pieceCodeMap.get(piece.pieceId) ?? 'P';
      const w = Math.round(piece.width);
      const h = Math.round(piece.height);

      // Render piece label with short code and name
      doc.setTextColor(20, 20, 20);
      if (pw > 26 && ph > 10) {
        doc.setFontSize(7.5);
        doc.text(`[${code}] ${friendlyName}`, px + 1.5, py + 3.8);
        doc.setFontSize(6.5);
        doc.text(`${w} x ${h} mm`, px + 1.5, py + 7.5);
      } else if (pw > 14 && ph > 6) {
        doc.setFontSize(6.5);
        doc.text(`[${code}]`, px + 1, py + 3.5);
        if (ph > 9) {
          doc.text(`${w}x${h}`, px + 1, py + 6.8);
        }
      } else if (pw > 7 && ph > 4.5) {
        doc.setFontSize(5.5);
        doc.text(`[${code}]`, px + 0.8, py + 3);
      }
    }

    // Summary table per sheet
    let tableY = marginY + drawH + 5;
    if (tableY < pageHeight - 20) {
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'bold');
      doc.text('Detalle de Piezas en esta Hoja:', marginX, tableY);
      tableY += 3;

      // Table Header Row
      const tableW = Math.min(drawW, 200);
      doc.setFillColor(226, 232, 240);
      doc.rect(marginX, tableY, tableW, 4.5, 'FD');
      doc.setFontSize(7.5);
      doc.text('Ref', marginX + 2, tableY + 3.2);
      doc.text('Pieza / Denominación', marginX + 16, tableY + 3.2);
      doc.text('Medida de Corte', marginX + 105, tableY + 3.2);
      doc.text('Cant.', marginX + 165, tableY + 3.2);
      tableY += 4.5;

      // Table Rows
      doc.setFont('helvetica', 'normal');
      for (const item of groupMap.values()) {
        if (tableY > pageHeight - 8) break;
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);
        doc.text(`[${item.code}]`, marginX + 2, tableY + 3.2);
        doc.text(item.name, marginX + 16, tableY + 3.2);
        doc.text(`${item.width} x ${item.height} mm`, marginX + 105, tableY + 3.2);
        doc.text(String(item.count), marginX + 168, tableY + 3.2);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.15);
        doc.line(marginX, tableY + 4.2, marginX + tableW, tableY + 4.2);
        tableY += 4.2;
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
