import { jsPDF } from 'jspdf';
import type { CommercialQuoteResult } from './quote';

export interface CommercialQuotePdfMetadata {
  projectName: string;
  clientName: string;
  quoteNumber?: string;
  issueDate?: Date;
  workshopName?: string;
}

function formatMoney(amount: number, currency: 'ARS' | 'USD'): string {
  const symbol = currency === 'USD' ? 'USD ' : '$ ';
  return `${symbol}${amount.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Generates a clean, client-facing Commercial Quote PDF (A4 portrait).
 * Strictly hides internal workshop costs, overhead, and profit margins.
 */
export function exportCommercialQuotePdf(
  quote: CommercialQuoteResult,
  meta: CommercialQuotePdfMetadata,
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentW = pageWidth - 2 * margin;
  const issueDate = meta.issueDate ?? new Date();
  const validUntil = new Date(issueDate.getTime() + quote.config.validityDays * 86_400_000);
  const dateFmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  const quoteNum =
    meta.quoteNumber ??
    `PRES-${issueDate.getFullYear()}${String(issueDate.getMonth() + 1).padStart(2, '0')}${String(issueDate.getDate()).padStart(2, '0')}`;

  // Header Banner (CadCat Salvia #435B4C)
  let y = 14;
  doc.setFillColor(67, 91, 76);
  doc.rect(margin, y, contentW, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('PRESUPUESTO COMERCIAL', margin + 5, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(meta.workshopName ?? 'CadCat · Carpintería a Medida', margin + 5, y + 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`N° ${quoteNum}`, pageWidth - margin - 5, y + 9, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Fecha: ${dateFmt(issueDate)} | Válido hasta: ${dateFmt(validUntil)}`, pageWidth - margin - 5, y + 16, {
    align: 'right',
  });

  y += 28;

  // Client & Project Card
  doc.setFillColor(246, 243, 236);
  doc.setDrawColor(217, 210, 195);
  doc.rect(margin, y, contentW, 18, 'FD');
  doc.setTextColor(31, 38, 34);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(`Cliente: ${meta.clientName || 'Cliente'}`, margin + 4, y + 6.5);
  doc.text(`Proyecto: ${meta.projectName || 'Mobiliario a Medida'}`, margin + 4, y + 13);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Módulos: ${quote.totalModuleUnits} unidad(es) | Plazo estimado: ${quote.config.leadTimeDays} días hábiles`,
    pageWidth - margin - 4,
    y + 13,
    { align: 'right' },
  );

  y += 25;

  // 1. Scope / Modules Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('1. Detalle del Mobiliario Cotizado', margin, y);
  y += 5;

  doc.setFillColor(237, 232, 220);
  doc.rect(margin, y, contentW, 6.5, 'F');
  doc.setFontSize(8.5);
  doc.text('Ítem', margin + 3, y + 4.4);
  doc.text('Módulo / Descripción', margin + 16, y + 4.4);
  doc.text('Dimensiones (An × Al × Prof)', margin + 100, y + 4.4);
  doc.text('Cant.', margin + 162, y + 4.4);
  y += 7.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  quote.modules.forEach((mod, idx) => {
    if (y > pageHeight - 55) {
      doc.addPage();
      y = 18;
    }
    const details: string[] = [];
    if (mod.drawerCount > 0) details.push(`${mod.drawerCount} cajón(es)`);
    if (mod.doorCount > 0) details.push(`${mod.doorCount} puerta(s)`);
    if (mod.shelfCount > 0) details.push(`${mod.shelfCount} estante(s)`);
    const desc = details.length > 0 ? `${mod.name} (${details.join(', ')})` : mod.name;
    const wrappedDesc = doc.splitTextToSize(desc, 80) as string[];
    const rowHeight = Math.max(6, wrappedDesc.length * 4 + 2);

    doc.text(String(idx + 1), margin + 3, y + 3.5);
    doc.text(wrappedDesc, margin + 16, y + 3.5);
    doc.text(`${mod.widthMm} × ${mod.heightMm} × ${mod.depthMm} mm`, margin + 100, y + 3.5);
    doc.text(`${Math.max(1, Math.floor(mod.quantity || 1))} un.`, margin + 162, y + 3.5);

    doc.setDrawColor(230, 226, 216);
    doc.setLineWidth(0.2);
    doc.line(margin, y + rowHeight - 1, margin + contentW, y + rowHeight - 1);
    y += rowHeight;
  });

  y += 5;

  // 2. Technical Specifications (client-safe, zero internal costs)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('2. Especificaciones Técnicas Incluidas', margin, y);
  y += 5.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const hwSummaryText =
    quote.hardwareSummary.length > 0
      ? `${quote.hardwareSummary.slice(0, 6).join(' · ')}${
          quote.hardwareSummary.length > 6 ? ` (+${quote.hardwareSummary.length - 6} más)` : ''
        }`
      : 'Herrajes estándar de carpintería';
  const specLines: string[] = [
    `• Placas y materiales: ${quote.materialsSummary.length > 0 ? quote.materialsSummary.join(', ') : 'Según muestra aprobada'}.`,
    `• Herrajes incluidos: ${hwSummaryText}.`,
  ];
  if (quote.countertopSummary) {
    specLines.push(`• Mesada / Marmolería: ${quote.countertopSummary}.`);
  }
  if (quote.config.deliveryCost > 0 || quote.config.installationCost > 0) {
    const extras: string[] = [];
    if (quote.config.deliveryCost > 0) extras.push('flete/entrega');
    if (quote.config.installationCost > 0) extras.push('instalación en obra');
    specLines.push(`• Servicios incluidos: ${extras.join(' e ')}.`);
  }

  for (const line of specLines) {
    const wrapped = doc.splitTextToSize(line, contentW - 4);
    doc.text(wrapped, margin + 2, y);
    y += wrapped.length * 4.3;
  }

  y += 6;

  // 3. Commercial Totals Summary Box
  if (y > pageHeight - 62) {
    doc.addPage();
    y = 18;
  }

  const boxW = 92;
  const boxX = margin + contentW - boxW;
  const rowCount =
    3 + (quote.client.discountAmount > 0 ? 1 : 0) + (quote.client.vatPercent > 0 ? 1 : 0);
  const boxH = 12 + rowCount * 6.5;

  doc.setFillColor(246, 243, 236);
  doc.setDrawColor(67, 91, 76);
  doc.setLineWidth(0.5);
  doc.rect(boxX, y, boxW, boxH, 'FD');

  let ty = y + 7;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(31, 38, 34);

  if (quote.client.discountAmount > 0) {
    doc.text('Precio Lista Neto:', boxX + 4, ty);
    doc.text(formatMoney(quote.client.netBeforeDiscount, quote.client.currency), boxX + boxW - 4, ty, {
      align: 'right',
    });
    ty += 6;
    doc.setTextColor(46, 108, 66);
    doc.text(`Bonificación (${quote.client.discountPercent}%):`, boxX + 4, ty);
    doc.text(`- ${formatMoney(quote.client.discountAmount, quote.client.currency)}`, boxX + boxW - 4, ty, {
      align: 'right',
    });
    doc.setTextColor(31, 38, 34);
    ty += 6;
  }

  doc.text('Subtotal Neto:', boxX + 4, ty);
  doc.text(formatMoney(quote.client.netSubtotal, quote.client.currency), boxX + boxW - 4, ty, {
    align: 'right',
  });
  ty += 6;

  if (quote.client.vatPercent > 0) {
    doc.text(`IVA (${quote.client.vatPercent}%):`, boxX + 4, ty);
    doc.text(formatMoney(quote.client.vatAmount, quote.client.currency), boxX + boxW - 4, ty, {
      align: 'right',
    });
    ty += 6;
  }

  doc.setDrawColor(67, 91, 76);
  doc.line(boxX + 3, ty - 2.5, boxX + boxW - 3, ty - 2.5);
  ty += 3;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(67, 91, 76);
  doc.text('TOTAL FINAL:', boxX + 4, ty);
  doc.text(formatMoney(quote.client.finalTotal, quote.client.currency), boxX + boxW - 4, ty, {
    align: 'right',
  });
  ty += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(92, 101, 95);
  doc.text(
    `Equivalente aprox. (${quote.client.equivalentCurrency} · TC ${quote.client.exchangeRateArsPerUsd}): ${formatMoney(
      quote.client.equivalentFinalTotal,
      quote.client.equivalentCurrency,
    )}`,
    boxX + boxW - 4,
    ty,
    { align: 'right' },
  );

  y += boxH + 8;

  // 4. Commercial Conditions
  doc.setTextColor(31, 38, 34);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('3. Condiciones Comerciales y Validez', margin, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const termsLines = [
    `• Forma de pago: ${quote.config.paymentTerms}`,
    `• Validez de la oferta: ${quote.config.validityDays} días corridos (hasta el ${dateFmt(validUntil)}).`,
    `• Plazo de fabricación estimado: ${quote.config.leadTimeDays} días hábiles desde confirmación y aprobación de medidas en obra.`,
  ];
  if (quote.config.clientNotes?.trim()) {
    termsLines.push(`• Notas: ${quote.config.clientNotes.trim()}`);
  }
  if (quote.hasUnconfirmedPrices) {
    termsLines.push(
      '• Aclaración: Algunos insumos o materiales del detalle se encuentran sujetos a confirmación de precio vigente.',
    );
  }
  for (const tLine of termsLines) {
    const wrapped = doc.splitTextToSize(tLine, contentW);
    doc.text(wrapped, margin, y);
    y += wrapped.length * 4.2;
  }

  return doc;
}
