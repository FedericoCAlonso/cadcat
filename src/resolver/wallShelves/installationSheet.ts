import { jsPDF } from 'jspdf';
import type { WallShelvingDefinition, WallShelvingOutput } from './types';

/**
 * Generates an SVG installation sheet / wall drilling template
 * showing exact mm coordinates for laser leveling and wall drilling.
 */
export function generateInstallationSheetSvg(
  output: WallShelvingOutput,
  def: WallShelvingDefinition,
): string {
  const { widthMm, depthMm, shelfCount, verticalSpacingMm, baseElevationYMm = 800, wallType, bracketType } = def;
  const { bracketCalculation, installationPoints } = output;

  const totalHeightMm = (shelfCount - 1) * verticalSpacingMm + 400;
  const paddingX = 140;
  const paddingY = 120;
  const svgWidth = 1000;
  const svgHeight = 700;

  const drawingAreaWidth = svgWidth - 2 * paddingX;
  const drawingAreaHeight = svgHeight - 2 * paddingY;

  // Scale factors to fit within drawing area
  const scaleX = drawingAreaWidth / Math.max(100, widthMm);
  const scaleY = drawingAreaHeight / Math.max(100, totalHeightMm);
  const scale = Math.min(scaleX, scaleY, 0.85);

  const originX = paddingX + (drawingAreaWidth - widthMm * scale) / 2;
  const originY = svgHeight - paddingY;

  // Convert (xMm, yMm) to SVG coordinates (Y is inverted)
  const toSvgX = (xMm: number) => originX + xMm * scale;
  const toSvgY = (yRelativeMm: number) => originY - yRelativeMm * scale;

  let svgElements = '';

  // 1. Background Grid / Wall reference
  svgElements += `
    <!-- Wall boundary and floor datum -->
    <rect x="${originX - 40}" y="${originY - totalHeightMm * scale - 20}" 
          width="${widthMm * scale + 80}" height="${totalHeightMm * scale + 40}" 
          fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="4,4" rx="6" />
    <line x1="${originX - 60}" y1="${originY}" x2="${originX + widthMm * scale + 60}" y2="${originY}" 
          stroke="#475569" stroke-width="2.5" />
    <text x="${originX - 50}" y="${originY + 22}" font-family="system-ui, sans-serif" font-size="12" font-weight="600" fill="#475569">
      NPT (Nivel Piso Terminado ±0.00)
    </text>
  `;

  // 2. Render Shelves silhouettes and Laser datum lines
  for (let sIdx = 0; sIdx < shelfCount; sIdx++) {
    const relY = sIdx * verticalSpacingMm + 100; // relative elevation above datum line
    const sy = toSvgY(relY);
    const sx = originX;
    const sw = widthMm * scale;
    const sh = Math.max(8, def.thicknessMm * scale);

    // Laser horizontal datum line
    svgElements += `
      <line x1="${originX - 30}" y1="${sy}" x2="${originX + sw + 30}" y2="${sy}" 
            stroke="#ef4444" stroke-width="1" stroke-dasharray="6,4" opacity="0.6" />
      <text x="${originX - 35}" y="${sy + 4}" text-anchor="end" font-family="system-ui, sans-serif" font-size="10" font-weight="600" fill="#ef4444">
        Línea Láser: ${(baseElevationYMm + sIdx * verticalSpacingMm)} mm
      </text>
    `;

    // Shelf body
    svgElements += `
      <rect x="${sx}" y="${sy - sh}" width="${sw}" height="${sh}" 
            fill="#dbeafe" stroke="#3b82f6" stroke-width="1.5" rx="2" />
      <text x="${sx + sw / 2}" y="${sy - sh / 2 + 4}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="#1e40af">
        Estante ${sIdx + 1} (${widthMm} x ${depthMm} x ${def.thicknessMm} mm)
      </text>
    `;
  }

  // 3. Render Bracket drilling crosshairs and coordinates
  installationPoints.forEach((pt) => {
    const relY = pt.shelfIndex * verticalSpacingMm + 100;
    const cx = toSvgX(pt.xMm);
    const cy = toSvgY(relY);
    const r = 8;

    svgElements += `
      <!-- Crosshair for bracket at (${pt.xMm}, ${pt.yMm}) -->
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="#fee2e2" stroke="#dc2626" stroke-width="2" />
      <line x1="${cx - r - 4}" y1="${cy}" x2="${cx + r + 4}" y2="${cy}" stroke="#dc2626" stroke-width="1.5" />
      <line x1="${cx}" y1="${cy - r - 4}" x2="${cx}" y2="${cy + r + 4}" stroke="#dc2626" stroke-width="1.5" />
      <text x="${cx}" y="${cy + 20}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#991b1b">
        X = ${pt.xMm} mm
      </text>
    `;
  });

  // 4. Horizontal dimensions between brackets
  const positions = bracketCalculation.bracketPositionsMm;
  const topShelfRelY = (shelfCount - 1) * verticalSpacingMm + 100;
  const cotaY = toSvgY(topShelfRelY) - 40;

  // Cota from left edge to first bracket
  if (positions.length > 0 && positions[0]! > 0) {
    const x0 = toSvgX(0);
    const x1 = toSvgX(positions[0]!);
    svgElements += `
      <line x1="${x0}" y1="${cotaY}" x2="${x1}" y2="${cotaY}" stroke="#0f766e" stroke-width="1.5" />
      <circle cx="${x0}" cy="${cotaY}" r="2.5" fill="#0f766e" />
      <circle cx="${x1}" cy="${cotaY}" r="2.5" fill="#0f766e" />
      <text x="${(x0 + x1) / 2}" y="${cotaY - 6}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="10" font-weight="600" fill="#0f766e">
        ${positions[0]} mm
      </text>
    `;
  }

  // Cotas between consecutive brackets
  for (let i = 0; i < positions.length - 1; i++) {
    const xA = toSvgX(positions[i]!);
    const xB = toSvgX(positions[i + 1]!);
    const span = positions[i + 1]! - positions[i]!;

    svgElements += `
      <line x1="${xA}" y1="${cotaY}" x2="${xB}" y2="${cotaY}" stroke="#0f766e" stroke-width="1.5" />
      <circle cx="${xA}" cy="${cotaY}" r="2.5" fill="#0f766e" />
      <circle cx="${xB}" cy="${cotaY}" r="2.5" fill="#0f766e" />
      <text x="${(xA + xB) / 2}" y="${cotaY - 6}" text-anchor="middle" font-family="system-ui, sans-serif" font-size="10" font-weight="600" fill="#0f766e">
        ${span} mm
      </text>
    `;
  }

  // 5. Technical Workshop Header & Specifications Box
  const headerHtml = `
    <g transform="translate(30, 25)">
      <text x="0" y="20" font-family="system-ui, sans-serif" font-size="18" font-weight="700" fill="#0f172a">
        PLANO DE REPLANTEO Y TALADRADO DE PARED - ESTANTERÍA CON MÉNSULAS
      </text>
      <text x="0" y="38" font-family="system-ui, sans-serif" font-size="12" fill="#64748b">
        Mobilius Workshop Engine • Tipo: ${bracketType.toUpperCase()} • Pared: ${wallType.toUpperCase()}
      </text>
    </g>
    <g transform="translate(${svgWidth - 360}, 25)">
      <rect x="0" y="0" width="330" height="90" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1" rx="4" />
      <text x="12" y="20" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#0f172a">
        ESPECIFICACIONES DE INSTALACIÓN
      </text>
      <text x="12" y="36" font-family="system-ui, sans-serif" font-size="10" fill="#334155">
        • Taco sugerido: ${bracketCalculation.recommendedAnchor.brandModel}
      </text>
      <text x="12" y="52" font-family="system-ui, sans-serif" font-size="10" fill="#334155">
        • Tornillo: ${bracketCalculation.recommendedAnchor.screwDiameterMm}x${bracketCalculation.recommendedAnchor.screwLengthMm} mm (tracción est.: ${bracketCalculation.pullOutForceKg} kg/ménsula)
      </text>
      <text x="12" y="68" font-family="system-ui, sans-serif" font-size="10" fill="#334155">
        • Carga de diseño: ${bracketCalculation.designLoadKgM2} kg/m² (${bracketCalculation.totalShelfLoadKg} kg totales/estante)
      </text>
      <text x="12" y="82" font-family="system-ui, sans-serif" font-size="10" font-weight="600" fill="#166534">
        • Flecha calculada: ${bracketCalculation.calculatedDeflectionMm} mm (Límite: ${bracketCalculation.allowableDeflectionMm} mm)
      </text>
    </g>
  `;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="100%" style="background-color: #ffffff; border-radius: 8px;">
      ${headerHtml}
      ${svgElements}
    </svg>
  `.trim();
}

/**
 * Exports wall shelving installation and drilling guide as a clean workshop PDF.
 */
export function exportWallShelvesInstallationPdf(
  output: WallShelvingOutput,
  def: WallShelvingDefinition,
  title?: string,
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 18;

  // Header Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title ?? 'Plano de Replanteo y Perforación en Pared', margin, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Estantería de pared con ménsulas | Mobilius Workshop System', margin, y);
  y += 8;

  // Parameter Summary Box
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, pageWidth - 2 * margin, 26, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y, pageWidth - 2 * margin, 26, 'S');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Parámetros de Diseño:', margin + 3, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(`• Dimensiones estante: ${def.widthMm} x ${def.depthMm} x ${def.thicknessMm} mm`, margin + 3, y + 11);
  doc.text(`• Niveles: ${def.shelfCount} estantes | Separación: ${def.verticalSpacingMm} mm`, margin + 3, y + 16);
  doc.text(`• Cota base NPT: ${def.baseElevationYMm ?? 800} mm sobre piso`, margin + 3, y + 21);

  doc.setFont('helvetica', 'bold');
  doc.text('Configuración de Montaje:', margin + 95, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.text(`• Tipo de soporte: ${def.bracketType}`, margin + 95, y + 11);
  doc.text(`• Tipo de pared: ${def.wallType}`, margin + 95, y + 16);
  doc.text(`• Categoría de carga: ${def.loadCategory} (${output.bracketCalculation.designLoadKgM2} kg/m²)`, margin + 95, y + 21);

  y += 32;

  // Recommended Fasteners & Anchors Card
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Anclajes y Fijaciones Recomendadas', margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const anchor = output.bracketCalculation.recommendedAnchor;
  doc.text(`• Modelo de Taco: ${anchor.brandModel} (${anchor.notes})`, margin, y);
  y += 5;
  doc.text(`• Tornillo recomendado: Ø${anchor.screwDiameterMm} mm x ${anchor.screwLengthMm} mm de largo`, margin, y);
  y += 5;
  doc.text(`• Tracción máxima estimada: ~${output.bracketCalculation.pullOutForceKg} kg / soporte`, margin, y);
  y += 5;
  doc.text(`• Ménsulas sugeridas: ${output.bracketCalculation.bracketCountPerShelf} por estante (${output.bracketCalculation.totalBrackets} totales)`, margin, y);
  y += 5;
  doc.text(`• Luz libre entre soportes: ${output.bracketCalculation.maxSpanMm} mm | Voladizo: ${output.bracketCalculation.cantileverMm} mm`, margin, y);
  y += 5;
  doc.text(`• Flecha elástica calculada: ${output.bracketCalculation.calculatedDeflectionMm} mm (Límite admisible: ${output.bracketCalculation.allowableDeflectionMm} mm)`, margin, y);
  y += 10;

  // Laser Leveling and Drilling Table
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Tabla de Replanteo y Perforaciones en Pared (Coordenadas Láser)', margin, y);
  y += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y - 4, pageWidth - 2 * margin, 6, 'F');
  doc.text('Estante N°', margin + 3, y);
  doc.text('Soporte N°', margin + 30, y);
  doc.text('Cota X (desde izq.)', margin + 65, y);
  doc.text('Altura Y (sobre NPT)', margin + 115, y);
  doc.text('Referencia Láser', margin + 155, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  output.installationPoints.forEach((pt) => {
    if (y > 270) {
      doc.addPage();
      y = 18;
    }
    const elev = (def.baseElevationYMm ?? 800) + pt.shelfIndex * def.verticalSpacingMm;
    doc.text(`Estante ${pt.shelfIndex + 1}`, margin + 3, y);
    doc.text(`Soporte ${pt.bracketIndex + 1}`, margin + 30, y);
    doc.text(`${pt.xMm} mm`, margin + 65, y);
    doc.text(`${elev} mm`, margin + 115, y);
    doc.text(`Línea horizontal ${pt.shelfIndex + 1}`, margin + 155, y);
    y += 5;
  });

  return doc;
}

