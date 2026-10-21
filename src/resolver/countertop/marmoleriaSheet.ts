import { jsPDF } from 'jspdf';
import type { CountertopCalculationResult } from './types';

/**
 * Generates an SVG workshop drawing for the stone fabricator (marmolero).
 * Shows outer dimensions, cutouts, faucet hole, safety bridges, edge finishes and backsplashes.
 */
export function generateMarmoleriaSheetSvg(calc: CountertopCalculationResult): string {
  const { widthMm, depthMm, thicknessMm, material, definition, cutouts, totalWeightKg, areaM2 } = calc;

  const svgWidth = 1000;
  const svgHeight = 650;
  const paddingX = 120;
  const paddingY = 120;

  const drawingAreaWidth = svgWidth - 2 * paddingX;
  const drawingAreaHeight = svgHeight - 2 * paddingY;

  const scaleX = drawingAreaWidth / Math.max(100, widthMm);
  const scaleY = drawingAreaHeight / Math.max(100, depthMm);
  const scale = Math.min(scaleX, scaleY, 0.7);

  const drawW = widthMm * scale;
  const drawD = depthMm * scale;

  const originX = paddingX + (drawingAreaWidth - drawW) / 2;
  const originY = paddingY + (drawingAreaHeight - drawD) / 2;

  const toSvgX = (xMm: number) => originX + xMm * scale;
  // SVG drawing convention: Contrafrente (Wall/Backsplash) at top (originY), Frente Pulido at bottom (originY + drawD)
  const toSvgY = (yMm: number) => originY + (depthMm - yMm) * scale;

  let svgElements = '';

  // 1. Backsplash indication (top of diagram / against wall)
  if (definition.backsplash.hasSplash) {
    const splashH = Math.max(6, definition.backsplash.thicknessMm * scale * 2);
    svgElements += `
      <!-- Rear Backsplash -->
      <rect x="${originX}" y="${originY - splashH - 4}" width="${drawW}" height="${splashH}"
            fill="#e2e8f0" stroke="#475569" stroke-width="1.5" stroke-dasharray="3,3" rx="2" />
      <text x="${originX + drawW / 2}" y="${originY - splashH - 8}"
            text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#475569">
        CONTRAFRENTE (PARED / ZÓCALO) — Zócalo Trasero: ${widthMm} x ${definition.backsplash.heightMm} x ${definition.backsplash.thicknessMm} mm
      </text>
    `;
  } else {
    svgElements += `
      <!-- Rear wall edge marker -->
      <text x="${originX + drawW / 2}" y="${originY - 8}"
            text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#475569">
        CONTRAFRENTE (PARED)
      </text>
    `;
  }

  // 2. Countertop Slab
  const frontRadius = definition.cornerRadii.frontLeftMm * scale;
  svgElements += `
    <!-- Countertop main slab -->
    <rect x="${originX}" y="${originY}" width="${drawW}" height="${drawD}"
          fill="#f1f5f9" stroke="#0f172a" stroke-width="2.5" rx="${Math.max(2, frontRadius)}" />
    
    <!-- Stone texture / subtle grid line -->
    <rect x="${originX + 2}" y="${originY + 2}" width="${drawW - 4}" height="${drawD - 4}"
          fill="none" stroke="#cbd5e1" stroke-width="1" />
  `;

  // 3. Polished edge markers (Front & exposed sides)
  svgElements += `
    <!-- Front polished edge line -->
    <line x1="${originX}" y1="${originY + drawD}" x2="${originX + drawW}" y2="${originY + drawD}"
          stroke="#0284c7" stroke-width="4" stroke-linecap="round" />
    <text x="${originX + drawW / 2}" y="${originY + drawD + 18}"
          text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#0284c7">
      FRENTE PULIDO (${definition.edgeFinish.toUpperCase()}) - Vuelo: ${definition.frontOverhangMm} mm
    </text>
  `;

  // 4. Equipment Cutouts & Monocomando holes
  for (let idx = 0; idx < cutouts.length; idx++) {
    const c = cutouts[idx]!;
    const cx = toSvgX(c.boundsMm.minXMm);
    // In inverted Y (0=front, depth=back), maxYMm is closer to the wall (top of SVG)
    const cy = toSvgY(c.boundsMm.maxYMm);
    const cw = c.boundsMm.widthMm * scale;
    const cd = c.boundsMm.depthMm * scale;
    const cr = c.cornerRadiusMm * scale;

    svgElements += `
      <!-- Cutout #${idx + 1}: ${c.brandModel} -->
      <g id="cutout-${idx}">
        <rect x="${cx}" y="${cy}" width="${cw}" height="${cd}"
              fill="#fee2e2" stroke="#dc2626" stroke-width="2" rx="${cr}" />
        
        <!-- Diagonal cross hatching to indicate through-hole -->
        <line x1="${cx}" y1="${cy}" x2="${cx + cw}" y2="${cy + cd}"
              stroke="#ef4444" stroke-width="1" stroke-dasharray="4,4" opacity="0.6" />
        <line x1="${cx + cw}" y1="${cy}" x2="${cx}" y2="${cy + cd}"
              stroke="#ef4444" stroke-width="1" stroke-dasharray="4,4" opacity="0.6" />

        <!-- Center Crosshair -->
        <line x1="${cx + cw / 2 - 12}" y1="${cy + cd / 2}" x2="${cx + cw / 2 + 12}" y2="${cy + cd / 2}"
              stroke="#b91c1c" stroke-width="1.5" />
        <line x1="${cx + cw / 2}" y1="${cy + cd / 2 - 12}" x2="${cx + cw / 2}" y2="${cy + cd / 2 + 12}"
              stroke="#b91c1c" stroke-width="1.5" />

        <!-- Cutout Label -->
        <rect x="${cx + cw / 2 - 80}" y="${cy + cd / 2 - 20}" width="160" height="40"
              fill="#ffffff" stroke="#f87171" stroke-width="1" rx="4" />
        <text x="${cx + cw / 2}" y="${cy + cd / 2 - 6}"
              text-anchor="middle" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#991b1b">
          ${c.brandModel.length > 24 ? c.brandModel.slice(0, 24) + '...' : c.brandModel}
        </text>
        <text x="${cx + cw / 2}" y="${cy + cd / 2 + 10}"
              text-anchor="middle" font-family="system-ui, sans-serif" font-size="10" font-weight="600" fill="#b91c1c">
          Calado: ${c.boundsMm.widthMm} x ${c.boundsMm.depthMm} (R${c.cornerRadiusMm})
        </text>

        <!-- Bridge Cotas (Back to Wall / Front to Frente Pulido) -->
        <line x1="${cx + cw / 2}" y1="${originY}" x2="${cx + cw / 2}" y2="${cy}"
              stroke="#0f766e" stroke-width="1.2" stroke-dasharray="2,2" />
        <text x="${cx + cw / 2 + 5}" y="${originY + (cy - originY) / 2 + 4}"
              font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#0f766e">
          Puente Post: ${c.remainingBridgesMm.backMm} mm
        </text>

        <line x1="${cx + cw / 2}" y1="${cy + cd}" x2="${cx + cw / 2}" y2="${originY + drawD}"
              stroke="#0f766e" stroke-width="1.2" stroke-dasharray="2,2" />
        <text x="${cx + cw / 2 + 5}" y="${cy + cd + (originY + drawD - (cy + cd)) / 2 + 4}"
              font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#0f766e">
          Puente Ant: ${c.remainingBridgesMm.frontMm} mm
        </text>
      </g>
    `;

    // Faucet hole if present (single hole towards contrafrente / back wall)
    if (c.faucetHole) {
      const fx = toSvgX(c.faucetHole.centerXMm);
      const fy = toSvgY(c.faucetHole.centerYMm);
      const fr = (c.faucetHole.diameterMm / 2) * scale;

      svgElements += `
        <!-- Single Faucet Hole Ø${c.faucetHole.diameterMm} mm for monocomando tap -->
        <circle cx="${fx}" cy="${fy}" r="${Math.max(6, fr)}"
                fill="#dbeafe" stroke="#1d4ed8" stroke-width="2" />
        <line x1="${fx - 5}" y1="${fy}" x2="${fx + 5}" y2="${fy}" stroke="#1d4ed8" stroke-width="1.2" />
        <line x1="${fx}" y1="${fy - 5}" x2="${fx}" y2="${fy + 5}" stroke="#1d4ed8" stroke-width="1.2" />
        <text x="${fx}" y="${fy - 10}"
              text-anchor="middle" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#1e40af">
          Canilla Ø${c.faucetHole.diameterMm}mm
        </text>
      `;
    }
  }

  // 5. Exterior Dimensions & Cotas
  svgElements += `
    <!-- Top Overall Width Cota -->
    <line x1="${originX}" y1="${originY - 24}" x2="${originX + drawW}" y2="${originY - 24}"
          stroke="#334155" stroke-width="1.5" />
    <line x1="${originX}" y1="${originY - 30}" x2="${originX}" y2="${originY - 18}"
          stroke="#334155" stroke-width="1.5" />
    <line x1="${originX + drawW}" y1="${originY - 30}" x2="${originX + drawW}" y2="${originY - 18}"
          stroke="#334155" stroke-width="1.5" />
    <text x="${originX + drawW / 2}" y="${originY - 30}"
          text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="#0f172a">
      Largo Total: ${widthMm} mm
    </text>

    <!-- Left Overall Depth Cota -->
    <line x1="${originX - 24}" y1="${originY}" x2="${originX - 24}" y2="${originY + drawD}"
          stroke="#334155" stroke-width="1.5" />
    <line x1="${originX - 30}" y1="${originY}" x2="${originX - 18}" y2="${originY}"
          stroke="#334155" stroke-width="1.5" />
    <line x1="${originX - 30}" y1="${originY + drawD}" x2="${originX - 18}" y2="${originY + drawD}"
          stroke="#334155" stroke-width="1.5" />
    <text x="${originX - 32}" y="${originY + drawD / 2}"
          text-anchor="middle" font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="#0f172a"
          transform="rotate(-90, ${originX - 32}, ${originY + drawD / 2})">
      Profundidad: ${depthMm} mm
    </text>
  `;

  // 6. Title Box / Cartela (Technical info block)
  svgElements += `
    <g id="cartela" transform="translate(40, ${svgHeight - 75})">
      <rect x="0" y="0" width="${svgWidth - 80}" height="55"
            fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" rx="6" />
      <text x="16" y="22" font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="#0f172a">
        PLANO DE MARMOLERÍA — ${definition.name.toUpperCase()}
      </text>
      <text x="16" y="42" font-family="system-ui, sans-serif" font-size="11" font-weight="500" fill="#475569">
        Material: <tspan font-weight="700" fill="#0f172a">${material.name}</tspan> (${thicknessMm} mm) | 
        Área: <tspan font-weight="700" fill="#0f172a">${areaM2} m²</tspan> | 
        Peso Est.: <tspan font-weight="700" fill="#0f172a">~${totalWeightKg} kg</tspan> | 
        Cantos: <tspan font-weight="700" fill="#0f172a">${definition.edgeFinish}</tspan>
      </text>
    </g>
  `;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" 
         width="100%" height="auto" style="display:block; max-width: 100%; border-radius: 8px;">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#334155" />
        </marker>
      </defs>
      ${svgElements}
    </svg>
  `.trim();
}

/**
 * Exports a formal technical PDF drawing of the countertop for stone fabricators.
 */
export function exportMarmoleriaPdf(
  calc: CountertopCalculationResult,
  docTitle = 'Plano Técnico de Marmolería y Mesada',
): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm
  const margin = 14;

  // Header Title & Logo Box
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // #0f172a
  doc.text(docTitle, margin, margin + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // #64748b
  doc.text(
    `CadCat PWA · Documento técnico para corte, calado y pulido de marmolería · Fecha: ${new Date().toLocaleDateString()}`,
    margin,
    margin + 10,
  );

  doc.setDrawColor(203, 213, 225); // #cbd5e1
  doc.setLineWidth(0.5);
  doc.line(margin, margin + 13, pageWidth - margin, margin + 13);

  // Technical Summary Box (Top-Right / Left)
  const boxY = margin + 16;
  doc.setFillColor(248, 250, 252); // #f8fafc
  doc.roundedRect(margin, boxY, pageWidth - 2 * margin, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Especificación de Material y Dimensiones', margin + 4, boxY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);

  const col1X = margin + 4;
  const col2X = margin + 65;
  const col3X = margin + 135;
  const col4X = margin + 205;

  doc.text(`Material: ${calc.material.name}`, col1X, boxY + 12);
  doc.text(`Espesor: ${calc.thicknessMm} mm`, col1X, boxY + 18);

  doc.text(`Largo Total: ${calc.widthMm} mm`, col2X, boxY + 12);
  doc.text(`Profundidad: ${calc.depthMm} mm`, col2X, boxY + 18);

  doc.text(`Superficie: ${calc.areaM2} m²`, col3X, boxY + 12);
  doc.text(`Peso Estimado: ~${calc.totalWeightKg} kg`, col3X, boxY + 18);

  doc.text(`Canto Visto: ${calc.definition.edgeFinish}`, col4X, boxY + 12);
  doc.text(`Vuelo Frontal: ${calc.definition.frontOverhangMm} mm`, col4X, boxY + 18);

  // Drawing Viewport Area
  const drawAreaY = boxY + 28;
  const drawAreaH = 100;
  const drawAreaW = pageWidth - 2 * margin;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, drawAreaY, drawAreaW, drawAreaH, 2, 2, 'FD');

  // Compute scale for PDF drawing
  const scaleX = (drawAreaW - 60) / calc.widthMm;
  const scaleY = (drawAreaH - 35) / calc.depthMm;
  const pdfScale = Math.min(scaleX, scaleY, 0.18);

  const slabW = calc.widthMm * pdfScale;
  const slabD = calc.depthMm * pdfScale;

  const slabX = margin + (drawAreaW - slabW) / 2;
  const slabY = drawAreaY + (drawAreaH - slabD) / 2;

  // Draw main countertop slab
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.6);
  doc.rect(slabX, slabY, slabW, slabD, 'FD');

  // Front Polished Edge line in blue
  doc.setDrawColor(2, 132, 199);
  doc.setLineWidth(1.2);
  doc.line(slabX, slabY + slabD, slabX + slabW, slabY + slabD);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(2, 132, 199);
  doc.text('FRENTE PULIDO', slabX + slabW / 2, slabY + slabD + 4, { align: 'center' });

  // Draw cutouts
  for (const c of calc.cutouts) {
    const cx = slabX + c.boundsMm.minXMm * pdfScale;
    // Align with Contrafrente (Wall) at top: maxYMm is closest to top (slabY)
    const cy = slabY + (calc.depthMm - c.boundsMm.maxYMm) * pdfScale;
    const cw = c.boundsMm.widthMm * pdfScale;
    const cd = c.boundsMm.depthMm * pdfScale;

    doc.setFillColor(254, 226, 226);
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.4);
    doc.rect(cx, cy, cw, cd, 'FD');

    // Cross lines
    doc.setDrawColor(239, 68, 68);
    doc.setLineWidth(0.2);
    doc.line(cx, cy, cx + cw, cy + cd);
    doc.line(cx + cw, cy, cx, cy + cd);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(153, 27, 27);
    doc.text(
      `Calado: ${c.boundsMm.widthMm}x${c.boundsMm.depthMm} (R${c.cornerRadiusMm})`,
      cx + cw / 2,
      cy + cd / 2,
      { align: 'center' },
    );

    // Single Faucet hole circle if present (towards contrafrente/back wall)
    if (c.faucetHole) {
      const fx = slabX + c.faucetHole.centerXMm * pdfScale;
      const fy = slabY + (calc.depthMm - c.faucetHole.centerYMm) * pdfScale;
      doc.setFillColor(219, 234, 254);
      doc.setDrawColor(29, 78, 216);
      doc.circle(fx, fy, 2, 'FD');
      doc.setDrawColor(29, 78, 216);
      doc.setLineWidth(0.15);
      doc.line(fx - 1.5, fy, fx + 1.5, fy);
      doc.line(fx, fy - 1.5, fx, fy + 1.5);
      doc.setFontSize(6);
      doc.setTextColor(30, 64, 175);
      doc.text(`Ø${c.faucetHole.diameterMm} (1 boca)`, fx, fy - 3, { align: 'center' });
    }
  }

  // Dimension Cotas on PDF
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(`${calc.widthMm} mm`, slabX + slabW / 2, slabY - 3, { align: 'center' });
  doc.text(`${calc.depthMm} mm`, slabX - 4, slabY + slabD / 2, { align: 'right' });

  // Bottom Table: Cutouts, Backsplash & Notes
  const tableY = drawAreaY + drawAreaH + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Detalle de Calados y Zócalos Sanitarios', margin, tableY + 3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);

  let curY = tableY + 7;
  for (const c of calc.cutouts) {
    const bridgeText = `Puente anterior: ${c.remainingBridgesMm.frontMm} mm | Puente posterior: ${c.remainingBridgesMm.backMm} mm`;
    doc.text(
      `• ${c.brandModel} (${c.kind}): Calado ${c.boundsMm.widthMm} x ${c.boundsMm.depthMm} mm · ${bridgeText}`,
      margin,
      curY,
    );
    curY += 4;
  }

  if (calc.definition.backsplash.hasSplash) {
    doc.text(
      `• Zócalo Trasero: ${calc.widthMm} x ${calc.definition.backsplash.heightMm} mm (Espesor: ${calc.definition.backsplash.thicknessMm} mm)`,
      margin,
      curY,
    );
    curY += 4;
  }

  // Notes and Warnings
  if (calc.overhangAnalysis.warnings.length > 0) {
    doc.setTextColor(185, 28, 28);
    doc.setFont('helvetica', 'bold');
    doc.text(`⚠️ Nota: ${calc.overhangAnalysis.warnings[0]}`, margin, curY);
  }

  return doc;
}
