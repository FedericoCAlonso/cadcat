import { jsPDF } from 'jspdf';
import { type ResolvedPieceWithCutSize } from './edgeBand';
import { type DrillOperation, type FaceType } from '../model/operation';

export interface SheetOperationItem {
  id: string;
  faceType: FaceType;
  faceId: string;
  diameterMm: number;
  depthMm: number;
  isThrough: boolean;
  xMm: number;
  yMm: number;
  distFromLeftMm: number;
  distFromBottomMm: number;
  distFromRightMm: number;
  distFromTopMm: number;
  description: string;
  sourceJointKind?: string;
}

export interface PieceBandedEdges {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}

export interface PieceMachiningSheet {
  pieceId: string;
  role: string;
  materialId: string;
  dimensionsMm: {
    width: number;
    height: number;
    thickness: number;
  };
  cutDimensionsMm: {
    width: number;
    height: number;
  };
  bandedEdges: PieceBandedEdges;
  faceAOperations: SheetOperationItem[];
  faceBOperations: SheetOperationItem[];
  edgeOperations: SheetOperationItem[];
  totalOperations: number;
  requiresTurn: boolean;
  turnInstructions: string;
}

/**
 * Builds a piece machining sheet for manual workshop machines.
 * Computes coordinates from datum reference edges (Left X=0, Bottom Y=0).
 */
export function buildPieceMachiningSheet(
  piece: ResolvedPieceWithCutSize,
  operations: DrillOperation[],
): PieceMachiningSheet {
  const pWidth = piece.dimensionsMm?.width ?? piece.cutDimensionsMm.width;
  const pHeight = piece.dimensionsMm?.height ?? piece.cutDimensionsMm.height;
  const pThickness = piece.thicknessMm;

  // Extract banded edges from piece
  const bandedEdges: PieceBandedEdges = {
    top: false,
    bottom: false,
    left: false,
    right: false,
  };

  for (const b of piece.bandedEdges ?? []) {
    const fId = b.faceId.toLowerCase();
    if (fId.includes('top')) bandedEdges.top = true;
    if (fId.includes('bottom')) bandedEdges.bottom = true;
    if (fId.includes('left')) bandedEdges.left = true;
    if (fId.includes('right')) bandedEdges.right = true;
  }

  const pieceOps = operations.filter((op) => op.pieceId === piece.id);

  const faceAOperations: SheetOperationItem[] = [];
  const faceBOperations: SheetOperationItem[] = [];
  const edgeOperations: SheetOperationItem[] = [];

  for (const op of pieceOps) {
    const x = Math.round(op.positionMm.x * 10) / 10;
    const y = Math.round(op.positionMm.y * 10) / 10;

    const item: SheetOperationItem = {
      id: op.id,
      faceType: op.faceType,
      faceId: op.faceId,
      diameterMm: op.diameterMm,
      depthMm: op.depthMm,
      isThrough: op.isThrough,
      xMm: x,
      yMm: y,
      distFromLeftMm: x,
      distFromBottomMm: y,
      distFromRightMm: Math.round(Math.max(0, pWidth - x) * 10) / 10,
      distFromTopMm: Math.round(Math.max(0, pHeight - y) * 10) / 10,
      description: op.description ?? `${op.sourceJointKind ?? 'Drill'} hole`,
      sourceJointKind: op.sourceJointKind,
    };

    if (op.faceType === 'face-B') {
      faceBOperations.push(item);
    } else if (op.faceType === 'edge') {
      edgeOperations.push(item);
    } else {
      faceAOperations.push(item);
    }
  }

  const requiresTurn = faceBOperations.length > 0;
  const turnInstructions = requiresTurn
    ? 'GIRAR LA PIEZA: Contiene operaciones en Cara B. Girar la pieza sobre su eje longitudinal para mecanizar Cara B.'
    : 'No requiere giro: Todo el mecanizado de cara está en Cara A.';

  return {
    pieceId: piece.id,
    role: piece.role,
    materialId: piece.materialId,
    dimensionsMm: {
      width: pWidth,
      height: pHeight,
      thickness: pThickness,
    },
    cutDimensionsMm: {
      width: piece.cutDimensionsMm.width,
      height: piece.cutDimensionsMm.height,
    },
    bandedEdges,
    faceAOperations,
    faceBOperations,
    edgeOperations,
    totalOperations: pieceOps.length,
    requiresTurn,
    turnInstructions,
  };
}

/**
 * Builds machining sheets for all pieces in a module.
 */
export function buildModuleMachiningSheets(
  pieces: ResolvedPieceWithCutSize[],
  operations: DrillOperation[],
): PieceMachiningSheet[] {
  return pieces.map((p) => buildPieceMachiningSheet(p, operations));
}

/**
 * Renders an SVG technical drawing for Face A or Face B of a piece.
 */
export function renderPieceMachiningSvg(
  sheet: PieceMachiningSheet,
  face: 'face-A' | 'face-B',
  options: { svgWidth?: number; svgHeight?: number } = {},
): string {
  const widthMm = sheet.dimensionsMm.width;
  const heightMm = sheet.dimensionsMm.height;
  const ops = face === 'face-A' ? sheet.faceAOperations : sheet.faceBOperations;

  const targetWidth = options.svgWidth ?? 640;
  const targetHeight = options.svgHeight ?? 420;

  const margin = 50;
  const availableDrawW = targetWidth - 2 * margin;
  const availableDrawH = targetHeight - 2 * margin - (face === 'face-B' && sheet.requiresTurn ? 40 : 0);

  const scale = Math.min(availableDrawW / widthMm, availableDrawH / heightMm, 1.2);
  const drawW = widthMm * scale;
  const drawH = heightMm * scale;

  const originX = margin + (availableDrawW - drawW) / 2;
  const originY = margin + (availableDrawH - drawH) / 2 + (face === 'face-B' && sheet.requiresTurn ? 40 : 0);

  const svgParts: string[] = [];

  svgParts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${targetWidth} ${targetHeight}" width="100%" height="100%" style="background-color: #fafafa; font-family: sans-serif;">`,
  );

  // Turn banner for Face B
  if (face === 'face-B' && sheet.requiresTurn) {
    svgParts.push(`
      <rect x="20" y="12" width="${targetWidth - 40}" height="32" rx="6" fill="#fff3cd" stroke="#ffc107" stroke-width="1.5" />
      <text x="${targetWidth / 2}" y="32" text-anchor="middle" font-size="13" font-weight="bold" fill="#664d03">
        ⚠️ ATENCIÓN: GIRAR LA PIEZA PARA MECANIZAR CARA B (TURN PIECE OVER)
      </text>
    `);
  }

  // Piece Rectangle
  svgParts.push(
    `<rect x="${originX}" y="${originY}" width="${drawW}" height="${drawH}" fill="#e8eaed" stroke="#1f1f1f" stroke-width="2" />`,
  );

  // Banded Edges (highlighted with bold blue outline)
  const bandStroke = '#0b57d0';
  const bandWidth = 4;
  if (sheet.bandedEdges.top) {
    svgParts.push(
      `<line x1="${originX}" y1="${originY}" x2="${originX + drawW}" y2="${originY}" stroke="${bandStroke}" stroke-width="${bandWidth}" />`,
    );
  }
  if (sheet.bandedEdges.bottom) {
    svgParts.push(
      `<line x1="${originX}" y1="${originY + drawH}" x2="${originX + drawW}" y2="${originY + drawH}" stroke="${bandStroke}" stroke-width="${bandWidth}" />`,
    );
  }
  if (sheet.bandedEdges.left) {
    svgParts.push(
      `<line x1="${originX}" y1="${originY}" x2="${originX}" y2="${originY + drawH}" stroke="${bandStroke}" stroke-width="${bandWidth}" />`,
    );
  }
  if (sheet.bandedEdges.right) {
    svgParts.push(
      `<line x1="${originX + drawW}" y1="${originY}" x2="${originX + drawW}" y2="${originY + drawH}" stroke="${bandStroke}" stroke-width="${bandWidth}" />`,
    );
  }

  // Datum Reference Origin Marker at bottom-left (originX, originY + drawH)
  const datumX = originX;
  const datumY = originY + drawH;
  svgParts.push(`
    <g transform="translate(${datumX}, ${datumY})">
      <circle cx="0" cy="0" r="4" fill="#ba1a1a" />
      <line x1="-12" y1="0" x2="25" y2="0" stroke="#ba1a1a" stroke-width="1.5" />
      <line x1="0" y1="12" x2="0" y2="-25" stroke="#ba1a1a" stroke-width="1.5" />
      <text x="-8" y="18" font-size="10" font-weight="bold" fill="#ba1a1a">Datum (0,0)</text>
    </g>
  `);

  // Overall Dimensions
  svgParts.push(`
    <text x="${originX + drawW / 2}" y="${datumY + 28}" text-anchor="middle" font-size="11" font-weight="bold" fill="#444746">
      Ancho: ${widthMm} mm
    </text>
    <text x="${originX - 18}" y="${originY + drawH / 2}" text-anchor="middle" font-size="11" font-weight="bold" fill="#444746" transform="rotate(-90, ${originX - 18}, ${originY + drawH / 2})">
      Alto: ${heightMm} mm
    </text>
  `);

  if (ops.length === 0) {
    svgParts.push(`
      <text x="${originX + drawW / 2}" y="${originY + drawH / 2}" text-anchor="middle" font-size="14" fill="#747775">
        Sin operaciones en ${face === 'face-A' ? 'Cara A' : 'Cara B'}
      </text>
    `);
  }

  // Draw operations
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]!;
    const hx = originX + op.xMm * scale;
    // In technical drawing, Y starts from bottom edge
    const hy = datumY - op.yMm * scale;
    const r = Math.max(3, (op.diameterMm / 2) * scale * 1.5);

    // Dimension lines (cotas) from left edge and bottom edge
    svgParts.push(`
      <line x1="${originX}" y1="${hy}" x2="${hx}" y2="${hy}" stroke="#747775" stroke-dasharray="2 2" stroke-width="1" />
      <line x1="${hx}" y1="${datumY}" x2="${hx}" y2="${hy}" stroke="#747775" stroke-dasharray="2 2" stroke-width="1" />
    `);

    // Hole center mark
    svgParts.push(`
      <circle cx="${hx}" cy="${hy}" r="${r}" fill="${op.isThrough ? '#0b57d0' : '#4f378b'}" fill-opacity="0.25" stroke="#1f1f1f" stroke-width="1.2" />
      <line x1="${hx - r - 3}" y1="${hy}" x2="${hx + r + 3}" y2="${hy}" stroke="#1f1f1f" stroke-width="1" />
      <line x1="${hx}" y1="${hy - r - 3}" x2="${hx}" y2="${hy + r + 3}" stroke="#1f1f1f" stroke-width="1" />
      <circle cx="${hx}" cy="${hy}" r="1.5" fill="#ba1a1a" />
    `);

    // Hole Callout Label
    const calloutY = hy - r - 5;
    svgParts.push(`
      <g>
        <rect x="${hx - 22}" y="${calloutY - 11}" width="44" height="13" rx="3" fill="#ffffff" stroke="#c4c7c5" stroke-width="0.8" />
        <text x="${hx}" y="${calloutY - 2}" text-anchor="middle" font-size="8" font-weight="bold" fill="#1f1f1f">
          Ø${op.diameterMm}x${op.depthMm}
        </text>
        <text x="${hx}" y="${datumY - 2}" text-anchor="middle" font-size="7.5" fill="#00639b" font-weight="bold">
          X:${op.xMm}
        </text>
        <text x="${originX + 2}" y="${hy - 2}" font-size="7.5" fill="#00639b" font-weight="bold">
          Y:${op.yMm}
        </text>
      </g>
    `);
  }

  svgParts.push('</svg>');
  return svgParts.join('\n');
}

/**
 * Generates an A4 PDF machining sheet for manual machines using jsPDF.
 */
export function exportMachiningSheetPdf(
  sheets: PieceMachiningSheet | PieceMachiningSheet[],
  documentTitle = 'Mobilius - Plano de Mecanizado de Taller',
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const list = Array.isArray(sheets) ? sheets : [sheets];
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const marginX = 14;

  list.forEach((sheet, index) => {
    if (index > 0) {
      doc.addPage('a4', 'portrait');
    }

    // Title banner
    doc.setFillColor(11, 87, 208);
    doc.rect(marginX, 12, pageWidth - 2 * marginX, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(documentTitle, marginX + 4, 18.5);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Hoja ${index + 1} de ${list.length}`, pageWidth - marginX - 25, 18.5);

    // Piece Information Header Box
    let currentY = 25;
    doc.setDrawColor(196, 199, 197);
    doc.setFillColor(245, 247, 250);
    doc.rect(marginX, currentY, pageWidth - 2 * marginX, 22, 'FD');

    doc.setTextColor(31, 31, 31);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Pieza: ${sheet.pieceId} (${sheet.role})`, marginX + 3, currentY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(
      `Material: ${sheet.materialId} | Espesor: ${sheet.dimensionsMm.thickness} mm`,
      marginX + 3,
      currentY + 12,
    );
    doc.text(
      `Medida Final: ${sheet.dimensionsMm.width} x ${sheet.dimensionsMm.height} mm | Corte: ${sheet.cutDimensionsMm.width} x ${sheet.cutDimensionsMm.height} mm`,
      marginX + 3,
      currentY + 18,
    );

    const bandSummary = `Tapacantos: Sup: ${sheet.bandedEdges.top ? 'Sí' : 'No'} | Inf: ${sheet.bandedEdges.bottom ? 'Sí' : 'No'} | Izq: ${sheet.bandedEdges.left ? 'Sí' : 'No'} | Der: ${sheet.bandedEdges.right ? 'Sí' : 'No'}`;
    doc.text(bandSummary, marginX + 100, currentY + 12);

    currentY += 26;

    // Face A Diagram Area
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(11, 87, 208);
    doc.text('CARA A (Cara de referencia / Front Face)', marginX, currentY);

    currentY += 4;
    const diagramBoxW = pageWidth - 2 * marginX;
    const diagramBoxH = 55;

    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(196, 199, 197);
    doc.rect(marginX, currentY, diagramBoxW, diagramBoxH, 'FD');

    // Draw scaled piece rectangle inside diagram box
    const maxDrawW = diagramBoxW - 35;
    const maxDrawH = diagramBoxH - 15;
    const scaleA = Math.min(
      maxDrawW / sheet.dimensionsMm.width,
      maxDrawH / sheet.dimensionsMm.height,
    );
    const drawW = sheet.dimensionsMm.width * scaleA;
    const drawH = sheet.dimensionsMm.height * scaleA;
    const drawX = marginX + 22;
    const drawY = currentY + 6;

    // Piece rectangle
    doc.setFillColor(232, 234, 237);
    doc.setDrawColor(50, 50, 50);
    doc.setLineWidth(0.4);
    doc.rect(drawX, drawY, drawW, drawH, 'FD');

    // Reference Datum indicator
    doc.setDrawColor(186, 26, 26);
    doc.setLineWidth(0.6);
    doc.line(drawX, drawY + drawH, drawX + 8, drawY + drawH);
    doc.line(drawX, drawY + drawH, drawX, drawY + drawH - 8);
    doc.setTextColor(186, 26, 26);
    doc.setFontSize(6.5);
    doc.text('Datum (0,0)', drawX - 14, drawY + drawH + 3);

    // Dimension labels
    doc.setTextColor(70, 70, 70);
    doc.setFontSize(7);
    doc.text(`${sheet.dimensionsMm.width} mm`, drawX + drawW / 2 - 6, drawY + drawH + 4);
    doc.text(`${sheet.dimensionsMm.height} mm`, drawX - 12, drawY + drawH / 2);

    // Face A drill holes
    doc.setFontSize(6.5);
    for (const op of sheet.faceAOperations) {
      const hx = drawX + op.xMm * scaleA;
      const hy = drawY + drawH - op.yMm * scaleA;

      doc.setDrawColor(20, 20, 20);
      doc.setLineWidth(0.2);
      doc.circle(hx, hy, 1.2, 'D');
      doc.line(hx - 2, hy, hx + 2, hy);
      doc.line(hx, hy - 2, hx, hy + 2);

      doc.setTextColor(11, 87, 208);
      doc.text(`Ø${op.diameterMm}`, hx + 1.5, hy - 1);
    }

    currentY += diagramBoxH + 6;

    // Face B Section / Turn Indicator
    if (sheet.requiresTurn) {
      // Prominent Warning Box
      doc.setFillColor(255, 243, 205);
      doc.setDrawColor(255, 193, 7);
      doc.setLineWidth(0.6);
      doc.rect(marginX, currentY, pageWidth - 2 * marginX, 9, 'FD');

      doc.setTextColor(102, 77, 3);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text(
        '⚠️ ATENCIÓN: GIRAR LA PIEZA PARA MECANIZAR CARA B (TURN PIECE OVER)',
        marginX + 6,
        currentY + 6,
      );

      currentY += 12;

      // Cara B Diagram Box
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(11, 87, 208);
      doc.text('CARA B (Cara posterior / Reversal Face)', marginX, currentY);

      currentY += 4;
      const diagramBoxHB = 45;
      doc.setFillColor(250, 250, 250);
      doc.setDrawColor(196, 199, 197);
      doc.rect(marginX, currentY, diagramBoxW, diagramBoxHB, 'FD');

      const maxDrawHB = diagramBoxHB - 15;
      const scaleB = Math.min(
        maxDrawW / sheet.dimensionsMm.width,
        maxDrawHB / sheet.dimensionsMm.height,
      );
      const drawWB = sheet.dimensionsMm.width * scaleB;
      const drawHB = sheet.dimensionsMm.height * scaleB;
      const drawXB = marginX + 22;
      const drawYB = currentY + 6;

      doc.setFillColor(232, 234, 237);
      doc.setDrawColor(50, 50, 50);
      doc.setLineWidth(0.4);
      doc.rect(drawXB, drawYB, drawWB, drawHB, 'FD');

      // Face B drill holes
      doc.setFontSize(6.5);
      for (const op of sheet.faceBOperations) {
        const hx = drawXB + op.xMm * scaleB;
        const hy = drawYB + drawHB - op.yMm * scaleB;

        doc.setDrawColor(20, 20, 20);
        doc.setLineWidth(0.2);
        doc.circle(hx, hy, 1.2, 'D');
        doc.line(hx - 2, hy, hx + 2, hy);
        doc.line(hx, hy - 2, hx, hy + 2);

        doc.setTextColor(11, 87, 208);
        doc.text(`Ø${op.diameterMm}`, hx + 1.5, hy - 1);
      }

      currentY += diagramBoxHB + 6;
    } else {
      // Note indicating Cara B is blank
      doc.setFillColor(245, 245, 245);
      doc.setDrawColor(220, 220, 220);
      doc.rect(marginX, currentY, pageWidth - 2 * marginX, 7, 'FD');
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(
        'Cara B lisa: No contiene mecanizados en reverso (No requiere giro de pieza).',
        marginX + 4,
        currentY + 4.8,
      );
      currentY += 11;
    }

    // Operations Table
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(31, 31, 31);
    doc.text('Tabla de Perforaciones y Cotas desde Bordes (mm)', marginX, currentY);

    currentY += 4;
    const colX = [
      marginX,
      marginX + 10,
      marginX + 28,
      marginX + 75,
      marginX + 92,
      marginX + 112,
      marginX + 130,
      marginX + 155,
      marginX + 180,
    ];

    // Table Header
    doc.setFillColor(230, 235, 245);
    doc.setDrawColor(180, 190, 205);
    doc.rect(marginX, currentY, pageWidth - 2 * marginX, 6, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(20, 20, 20);
    doc.text('#', colX[0]! + 2, currentY + 4.2);
    doc.text('Cara', colX[1]! + 1, currentY + 4.2);
    doc.text('Descripción / Tipo', colX[2]! + 1, currentY + 4.2);
    doc.text('Ø (mm)', colX[3]! + 1, currentY + 4.2);
    doc.text('Prof. (mm)', colX[4]! + 1, currentY + 4.2);
    doc.text('Pasante', colX[5]! + 1, currentY + 4.2);
    doc.text('X (desde Izq.)', colX[6]! + 1, currentY + 4.2);
    doc.text('Y (desde Inf.)', colX[7]! + 1, currentY + 4.2);

    currentY += 6;

    const allOps = [
      ...sheet.faceAOperations,
      ...sheet.faceBOperations,
      ...sheet.edgeOperations,
    ];

    if (allOps.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('Esta pieza no requiere operaciones de perforado.', marginX + 4, currentY + 4);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);

      allOps.forEach((op, opIdx) => {
        if (currentY > 280) return; // Protect against page overflow

        const rowBg = opIdx % 2 === 0 ? 255 : 248;
        doc.setFillColor(rowBg, rowBg, rowBg);
        doc.rect(marginX, currentY, pageWidth - 2 * marginX, 5, 'F');

        doc.setTextColor(30, 30, 30);
        doc.text(String(opIdx + 1), colX[0]! + 2, currentY + 3.5);
        doc.text(op.faceType, colX[1]! + 1, currentY + 3.5);
        doc.text(op.description.slice(0, 35), colX[2]! + 1, currentY + 3.5);
        doc.text(String(op.diameterMm), colX[3]! + 3, currentY + 3.5);
        doc.text(String(op.depthMm), colX[4]! + 3, currentY + 3.5);
        doc.text(op.isThrough ? 'Sí' : 'No', colX[5]! + 2, currentY + 3.5);
        doc.text(`${op.xMm} mm`, colX[6]! + 1, currentY + 3.5);
        doc.text(`${op.yMm} mm`, colX[7]! + 1, currentY + 3.5);

        currentY += 5;
      });
    }
  });

  return doc;
}
