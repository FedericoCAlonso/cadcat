import { jsPDF } from 'jspdf';
import {
  DEFAULT_COMMERCIAL_QUOTE_CONFIG,
  type Material,
  type EdgeBand,
  type Hardware,
} from '../model';
import type { BillOfMaterials } from './bom';
import type { NestingResult } from '../workers';
import type { CountertopCalculationResult } from './countertop/types';

export interface ShoppingBoardRow {
  materialId: string;
  name: string;
  thicknessMm: number;
  sheetFormatMm: string;
  sheetsNeeded: number;
  netAreaM2: number;
  utilizationPercent: number;
  unitPrice: number | null;
  estimatedSubtotal: number | null;
}

export interface ShoppingEdgeBandRow {
  edgeBandId: string;
  name: string;
  thicknessLabel: string;
  netMeters: number;
  wastePercent: number;
  buyMeters: number;
  unitPrice: number | null;
  estimatedSubtotal: number | null;
}

export interface ShoppingHardwareRow {
  hardwareId: string;
  name: string;
  specification: string;
  count: number;
  unit: string;
  unitPrice: number | null;
  estimatedSubtotal: number | null;
}

export interface ShoppingCountertopRow {
  name: string;
  dimensionsText: string;
  quantity: number;
  totalAreaM2: number;
  unitPrice: number | null;
  estimatedSubtotal: number | null;
}

export interface ShoppingMaterialList {
  projectName: string;
  clientName: string;
  scopeLabel: string;
  moduleNames: string[];
  edgeBandWastePercent: number;
  boards: ShoppingBoardRow[];
  edgeBands: ShoppingEdgeBandRow[];
  hardware: ShoppingHardwareRow[];
  countertop: ShoppingCountertopRow | null;
  totals: {
    totalSheets: number;
    totalNetAreaM2: number;
    totalNetEdgeBandMeters: number;
    totalBuyEdgeBandMeters: number;
    totalHardwareUnits: number;
    estimatedMaterialsSubtotal: number;
    hasUnconfirmedPrices: boolean;
  };
}

export interface ShoppingMaterialListInput {
  bom: BillOfMaterials;
  nestingResult: NestingResult;
  materials: Material[];
  edgeBands: EdgeBand[];
  hardware: Hardware[];
  edgeBandWastePercent?: number;
  countertop?: CountertopCalculationResult | null;
  countertopQuantity?: number;
  projectName?: string;
  clientName?: string;
  scopeLabel?: string;
  moduleNames?: string[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function escapeCsv(val: string | number): string {
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatMoney(amount: number): string {
  return `$ ${amount.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Pure SSOT builder for the carpenter's Shopping Material List (BOM).
 * Combines nesting sheet counts, BOM edge banding (+ configured waste %),
 * consolidated hardware/fasteners, and optional countertop.
 */
export function buildShoppingMaterialList(
  input: ShoppingMaterialListInput,
): ShoppingMaterialList {
  const { bom, nestingResult, materials, edgeBands, hardware, countertop } = input;
  const wastePercent = Math.max(
    0,
    input.edgeBandWastePercent ?? DEFAULT_COMMERCIAL_QUOTE_CONFIG.edgeBandWastePercent,
  );
  const wasteFactor = 1 + wastePercent / 100;

  const matMap = new Map(materials.map((m) => [m.id, m]));
  const ebMap = new Map(edgeBands.map((e) => [e.id, e]));
  const hwMap = new Map(hardware.map((h) => [h.id, h]));

  // 1. Boards / Sheets grouped by materialId (SSOT: exact nesting sheets + BOM net area)
  const netAreaByMat = new Map<string, number>();
  for (const piece of bom.pieces) {
    const exactPieceAreaM2 =
      (piece.cutDimensionsMm.width * piece.cutDimensionsMm.height) / 1_000_000;
    netAreaByMat.set(
      piece.materialId,
      (netAreaByMat.get(piece.materialId) ?? 0) + exactPieceAreaM2,
    );
  }

  const sheetsByMat = new Map<
    string,
    { count: number; sheetLengthMm: number; sheetWidthMm: number; totalSheetAreaM2: number }
  >();
  for (const s of nestingResult.sheets) {
    const areaM2 = (s.sheetLengthMm * s.sheetWidthMm) / 1_000_000;
    const prev = sheetsByMat.get(s.materialId);
    if (prev) {
      prev.count += 1;
      prev.totalSheetAreaM2 += areaM2;
    } else {
      sheetsByMat.set(s.materialId, {
        count: 1,
        sheetLengthMm: s.sheetLengthMm,
        sheetWidthMm: s.sheetWidthMm,
        totalSheetAreaM2: areaM2,
      });
    }
  }

  const allMatIds = Array.from(new Set([...sheetsByMat.keys(), ...netAreaByMat.keys()]));
  const boards: ShoppingBoardRow[] = allMatIds.map((materialId) => {
    const mat = matMap.get(materialId);
    const sheetInfo = sheetsByMat.get(materialId);
    const sheetsNeeded = sheetInfo?.count ?? 0;
    const matLen = typeof mat?.sheetSizeMm?.length === 'number' ? mat.sheetSizeMm.length : 0;
    const matWid = typeof mat?.sheetSizeMm?.width === 'number' ? mat.sheetSizeMm.width : 0;
    const lenMm = sheetInfo?.sheetLengthMm ?? matLen;
    const widMm = sheetInfo?.sheetWidthMm ?? matWid;
    const netAreaM2 = round3(netAreaByMat.get(materialId) ?? 0);
    const totalSheetAreaM2 = sheetInfo?.totalSheetAreaM2 ?? 0;
    const utilizationPercent =
      totalSheetAreaM2 > 0 ? round1(Math.min(100, (netAreaM2 / totalSheetAreaM2) * 100)) : 0;
    const unitPrice =
      typeof mat?.pricePerSheet === 'number' && !Number.isNaN(mat.pricePerSheet) && mat.pricePerSheet >= 0
        ? mat.pricePerSheet
        : null;
    const estimatedSubtotal = unitPrice !== null ? round2(sheetsNeeded * unitPrice) : null;
    const matThick = typeof mat?.thicknessMm === 'number' ? mat.thicknessMm : undefined;

    return {
      materialId,
      name: mat?.name ?? materialId,
      thicknessMm: matThick ?? bom.pieces.find((p) => p.materialId === materialId)?.thicknessMm ?? 0,
      sheetFormatMm: lenMm > 0 && widMm > 0 ? `${lenMm} × ${widMm} mm` : 'Formato estándar',
      sheetsNeeded,
      netAreaM2,
      utilizationPercent,
      unitPrice,
      estimatedSubtotal,
    };
  });

  // 2. Edge bands (+ configured waste %)
  const edgeBandRows: ShoppingEdgeBandRow[] = bom.edgeBands.map((eb) => {
    const cat = ebMap.get(eb.edgeBandId);
    const netMeters = round2(eb.lengthMeters);
    const rawBuyMeters = eb.lengthMeters * wasteFactor;
    const buyMeters = round2(rawBuyMeters);
    const unitPrice =
      typeof cat?.pricePerMeter === 'number' && !Number.isNaN(cat.pricePerMeter) && cat.pricePerMeter >= 0
        ? cat.pricePerMeter
        : null;
    const estimatedSubtotal = unitPrice !== null ? round2(rawBuyMeters * unitPrice) : null;
    const thicknessLabel =
      typeof cat?.thicknessMm === 'number' ? `${cat.thicknessMm} mm` : 'Espesor estándar';

    return {
      edgeBandId: eb.edgeBandId,
      name: cat?.name ?? eb.kind ?? eb.edgeBandId,
      thicknessLabel,
      netMeters,
      wastePercent,
      buyMeters,
      unitPrice,
      estimatedSubtotal,
    };
  });

  // 3. Hardware & fasteners
  const hardwareRows: ShoppingHardwareRow[] = bom.hardware.map((hw) => {
    const cat = hwMap.get(hw.hardwareId);
    const unitPrice =
      typeof cat?.pricePerUnit === 'number' && !Number.isNaN(cat.pricePerUnit) && cat.pricePerUnit >= 0
        ? cat.pricePerUnit
        : null;
    const estimatedSubtotal = unitPrice !== null ? round2(hw.count * unitPrice) : null;
    const specification =
      hw.jointKind === 'slide' && hw.count % 2 === 0
        ? `${hw.count / 2} par(es) (${hw.count} guías)`
        : hw.jointKind === 'slide'
          ? `${hw.count} guía(s)`
          : 'Estándar de carpintería';

    return {
      hardwareId: hw.hardwareId,
      name: cat?.name ?? hw.name,
      specification,
      count: hw.count,
      unit: 'un.',
      unitPrice,
      estimatedSubtotal,
    };
  });

  // 4. Countertop (optional)
  let countertopRow: ShoppingCountertopRow | null = null;
  if (countertop) {
    const qty = Math.max(1, Math.floor(input.countertopQuantity ?? 1));
    const totalAreaM2 = round2(countertop.areaM2 * qty);
    const unitPrice =
      typeof countertop.material.pricePerM2 === 'number' &&
      !Number.isNaN(countertop.material.pricePerM2) &&
      countertop.material.pricePerM2 >= 0
        ? countertop.material.pricePerM2
        : null;
    const estimatedSubtotal =
      unitPrice !== null ? round2(countertop.areaM2 * qty * unitPrice) : null;
    countertopRow = {
      name: countertop.material.name,
      dimensionsText: `${countertop.widthMm} × ${countertop.depthMm} × ${countertop.thicknessMm} mm${qty > 1 ? ` (×${qty})` : ''}`,
      quantity: qty,
      totalAreaM2,
      unitPrice,
      estimatedSubtotal,
    };
  }

  let estimatedMaterialsSubtotal = 0;
  let hasUnconfirmedPrices = false;
  const accumulate = (sub: number | null) => {
    if (sub === null) {
      hasUnconfirmedPrices = true;
    } else {
      estimatedMaterialsSubtotal += sub;
    }
  };
  boards.forEach((b) => accumulate(b.estimatedSubtotal));
  edgeBandRows.forEach((e) => accumulate(e.estimatedSubtotal));
  hardwareRows.forEach((h) => accumulate(h.estimatedSubtotal));
  if (countertopRow) accumulate(countertopRow.estimatedSubtotal);

  return {
    projectName: input.projectName?.trim() || 'Proyecto CadCat',
    clientName: input.clientName?.trim() || 'Taller',
    scopeLabel: input.scopeLabel ?? 'Módulo Actual',
    moduleNames: input.moduleNames ?? [],
    edgeBandWastePercent: wastePercent,
    boards,
    edgeBands: edgeBandRows,
    hardware: hardwareRows,
    countertop: countertopRow,
    totals: {
      totalSheets: boards.reduce((sum, b) => sum + b.sheetsNeeded, 0),
      totalNetAreaM2: round3(bom.totalCutAreaM2),
      totalNetEdgeBandMeters: round2(bom.totalEdgeBandMeters),
      totalBuyEdgeBandMeters: round2(bom.totalEdgeBandMeters * wasteFactor),
      totalHardwareUnits: hardwareRows.reduce((sum, h) => sum + h.count, 0),
      estimatedMaterialsSubtotal: round2(estimatedMaterialsSubtotal),
      hasUnconfirmedPrices,
    },
  };
}

/**
 * Exports the carpenter's Shopping Material List (BOM) to 100% Spanish CSV.
 */
export function exportShoppingListCsv(list: ShoppingMaterialList): string {
  const headers = [
    'Categoría',
    'Ítem / Material',
    'Especificación',
    'Cantidad a Comprar',
    'Unidad',
    'Cantidad Neta',
    'Precio Unitario ($)',
    'Subtotal Est. ($)',
  ];
  const rows: string[] = [headers.join(',')];

  for (const b of list.boards) {
    rows.push(
      [
        'Placa',
        b.name,
        `${b.sheetFormatMm} · ${b.thicknessMm} mm (${b.utilizationPercent}% aprovec.)`,
        b.sheetsNeeded,
        'placa(s)',
        `${b.netAreaM2} m²`,
        b.unitPrice !== null ? b.unitPrice : 'A confirmar',
        b.estimatedSubtotal !== null ? b.estimatedSubtotal : 'A confirmar',
      ]
        .map(escapeCsv)
        .join(','),
    );
  }

  for (const eb of list.edgeBands) {
    rows.push(
      [
        'Tapacanto',
        eb.name,
        `${eb.thicknessLabel} (+${eb.wastePercent}% merma)`,
        eb.buyMeters,
        'm',
        `${eb.netMeters} m`,
        eb.unitPrice !== null ? eb.unitPrice : 'A confirmar',
        eb.estimatedSubtotal !== null ? eb.estimatedSubtotal : 'A confirmar',
      ]
        .map(escapeCsv)
        .join(','),
    );
  }

  for (const hw of list.hardware) {
    rows.push(
      [
        'Herraje',
        hw.name,
        hw.specification,
        hw.count,
        hw.unit,
        `${hw.count} ${hw.unit}`,
        hw.unitPrice !== null ? hw.unitPrice : 'A confirmar',
        hw.estimatedSubtotal !== null ? hw.estimatedSubtotal : 'A confirmar',
      ]
        .map(escapeCsv)
        .join(','),
    );
  }

  if (list.countertop) {
    const ct = list.countertop;
    rows.push(
      [
        'Mesada',
        ct.name,
        ct.dimensionsText,
        ct.totalAreaM2,
        'm²',
        `${ct.totalAreaM2} m²`,
        ct.unitPrice !== null ? ct.unitPrice : 'A confirmar',
        ct.estimatedSubtotal !== null ? ct.estimatedSubtotal : 'A confirmar',
      ]
        .map(escapeCsv)
        .join(','),
    );
  }

  return rows.join('\r\n');
}

/**
 * Exports a clean A4 portrait Shopping Material Checklist PDF for the maderera & ferretería.
 */
export function exportShoppingListPdf(
  list: ShoppingMaterialList,
  issueDate = new Date(),
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageWidth - 2 * margin;
  const dateFmt = `${String(issueDate.getDate()).padStart(2, '0')}/${String(issueDate.getMonth() + 1).padStart(2, '0')}/${issueDate.getFullYear()}`;

  const ensureSpace = (neededMm: number, currentY: number): number => {
    if (currentY + neededMm > pageHeight - 16) {
      doc.addPage();
      return 16;
    }
    return currentY;
  };

  // Header Banner (CadCat Salvia #435B4C)
  let y = 14;
  doc.setFillColor(67, 91, 76);
  doc.rect(margin, y, contentW, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('LISTA DE MATERIALES Y COMPRAS (BOM)', margin + 4, y + 8.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(
    `Proyecto: ${list.projectName} · Alcance: ${list.scopeLabel}`,
    margin + 4,
    y + 15,
  );
  doc.text(`Fecha: ${dateFmt}`, pageWidth - margin - 4, y + 8.5, { align: 'right' });
  doc.text(
    `Placas: ${list.totals.totalSheets} · Cantos: ${list.totals.totalBuyEdgeBandMeters} m · Herrajes: ${list.totals.totalHardwareUnits} un.`,
    pageWidth - margin - 4,
    y + 15,
    { align: 'right' },
  );

  y += 26;
  doc.setTextColor(31, 38, 34);

  if (list.moduleNames.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const modLine = `Módulos incluidos: ${list.moduleNames.join(' · ')}`;
    const wrappedMods = doc.splitTextToSize(modLine, contentW) as string[];
    doc.text(wrappedMods, margin, y);
    y += wrappedMods.length * 4 + 3;
  }

  const drawSectionHeader = (title: string) => {
    y = ensureSpace(16, y);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(67, 91, 76);
    doc.text(title, margin, y);
    y += 4.5;
    doc.setTextColor(31, 38, 34);
  };

  const drawTableHeader = (cols: Array<{ label: string; x: number; align?: 'left' | 'right' }>) => {
    doc.setFillColor(237, 232, 220);
    doc.rect(margin, y, contentW, 6.2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.2);
    for (const c of cols) {
      doc.text(c.label, c.x, y + 4.3, c.align ? { align: c.align } : undefined);
    }
    y += 7.2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.2);
  };

  // 1. Placas y Tableros
  drawSectionHeader('1. Placas y Tableros (Maderera / Placacentro)');
  drawTableHeader([
    { label: 'OK', x: margin + 2 },
    { label: 'Material / Espesor', x: margin + 11 },
    { label: 'Formato Placa', x: margin + 88 },
    { label: 'Área Neta', x: margin + 124 },
    { label: 'Comprar', x: margin + 148 },
    { label: 'Subtotal Est.', x: margin + contentW - 2, align: 'right' },
  ]);

  for (const b of list.boards) {
    const labelLines = doc.splitTextToSize(`${b.name} (${b.thicknessMm} mm)`, 74) as string[];
    const rowH = Math.max(6, labelLines.length * 3.8 + 2);
    y = ensureSpace(rowH + 2, y);
    doc.setDrawColor(67, 91, 76);
    doc.rect(margin + 2.2, y + 0.6, 3.2, 3.2);
    doc.text(labelLines, margin + 11, y + 3.4);
    doc.text(b.sheetFormatMm, margin + 88, y + 3.4);
    doc.text(`${b.netAreaM2.toFixed(2)} m²`, margin + 124, y + 3.4);
    doc.setFont('helvetica', 'bold');
    doc.text(`${b.sheetsNeeded} pl.`, margin + 148, y + 3.4);
    doc.setFont('helvetica', 'normal');
    doc.text(
      b.estimatedSubtotal !== null ? formatMoney(b.estimatedSubtotal) : 'A confirmar',
      margin + contentW - 2,
      y + 3.4,
      { align: 'right' },
    );
    doc.setDrawColor(230, 226, 216);
    doc.line(margin, y + rowH - 0.8, margin + contentW, y + rowH - 0.8);
    y += rowH;
  }

  y += 5;

  // 2. Tapacantos
  if (list.edgeBands.length > 0) {
    drawSectionHeader(`2. Tapacantos (incluye +${list.edgeBandWastePercent}% de merma)`);
    drawTableHeader([
      { label: 'OK', x: margin + 2 },
      { label: 'Tapacanto / Espesor', x: margin + 11 },
      { label: 'Metros Netos', x: margin + 96 },
      { label: 'Comprar (+merma)', x: margin + 126 },
      { label: 'Subtotal Est.', x: margin + contentW - 2, align: 'right' },
    ]);

    for (const eb of list.edgeBands) {
      const labelLines = doc.splitTextToSize(`${eb.name} (${eb.thicknessLabel})`, 82) as string[];
      const rowH = Math.max(6, labelLines.length * 3.8 + 2);
      y = ensureSpace(rowH + 2, y);
      doc.rect(margin + 2.2, y + 0.6, 3.2, 3.2);
      doc.text(labelLines, margin + 11, y + 3.4);
      doc.text(`${eb.netMeters.toFixed(2)} m`, margin + 96, y + 3.4);
      doc.setFont('helvetica', 'bold');
      doc.text(`${eb.buyMeters.toFixed(2)} m`, margin + 126, y + 3.4);
      doc.setFont('helvetica', 'normal');
      doc.text(
        eb.estimatedSubtotal !== null ? formatMoney(eb.estimatedSubtotal) : 'A confirmar',
        margin + contentW - 2,
        y + 3.4,
        { align: 'right' },
      );
      doc.setDrawColor(230, 226, 216);
      doc.line(margin, y + rowH - 0.8, margin + contentW, y + rowH - 0.8);
      y += rowH;
    }

    y += 5;
  }

  // 3. Herrajes y Tornillería
  if (list.hardware.length > 0) {
    drawSectionHeader('3. Herrajes y Tornillería (Ferretería)');
    drawTableHeader([
      { label: 'OK', x: margin + 2 },
      { label: 'Herraje / Fijación', x: margin + 11 },
      { label: 'Detalle', x: margin + 96 },
      { label: 'Cantidad', x: margin + 138 },
      { label: 'Subtotal Est.', x: margin + contentW - 2, align: 'right' },
    ]);

    for (const hw of list.hardware) {
      const labelLines = doc.splitTextToSize(hw.name, 82) as string[];
      const rowH = Math.max(6, labelLines.length * 3.8 + 2);
      y = ensureSpace(rowH + 2, y);
      doc.rect(margin + 2.2, y + 0.6, 3.2, 3.2);
      doc.text(labelLines, margin + 11, y + 3.4);
      doc.text(hw.specification, margin + 96, y + 3.4);
      doc.setFont('helvetica', 'bold');
      doc.text(`${hw.count} ${hw.unit}`, margin + 138, y + 3.4);
      doc.setFont('helvetica', 'normal');
      doc.text(
        hw.estimatedSubtotal !== null ? formatMoney(hw.estimatedSubtotal) : 'A confirmar',
        margin + contentW - 2,
        y + 3.4,
        { align: 'right' },
      );
      doc.setDrawColor(230, 226, 216);
      doc.line(margin, y + rowH - 0.8, margin + contentW, y + rowH - 0.8);
      y += rowH;
    }

    y += 5;
  }

  // 4. Mesada (opcional)
  if (list.countertop) {
    const ct = list.countertop;
    drawSectionHeader('4. Mesada / Marmolería');
    drawTableHeader([
      { label: 'OK', x: margin + 2 },
      { label: 'Material', x: margin + 11 },
      { label: 'Dimensiones', x: margin + 88 },
      { label: 'Superficie', x: margin + 138 },
      { label: 'Subtotal Est.', x: margin + contentW - 2, align: 'right' },
    ]);
    const ctNameLines = doc.splitTextToSize(ct.name, 74) as string[];
    const ctRowH = Math.max(8, ctNameLines.length * 3.8 + 2.5);
    y = ensureSpace(ctRowH + 2, y);
    doc.setDrawColor(67, 91, 76);
    doc.rect(margin + 2.2, y + 0.6, 3.2, 3.2);
    doc.text(ctNameLines, margin + 11, y + 3.4);
    doc.text(ct.dimensionsText, margin + 88, y + 3.4);
    doc.setFont('helvetica', 'bold');
    doc.text(`${ct.totalAreaM2.toFixed(2)} m²`, margin + 138, y + 3.4);
    doc.setFont('helvetica', 'normal');
    doc.text(
      ct.estimatedSubtotal !== null ? formatMoney(ct.estimatedSubtotal) : 'A confirmar',
      margin + contentW - 2,
      y + 3.4,
      { align: 'right' },
    );
    y += ctRowH;
  }

  // Summary box
  y = ensureSpace(20, y + 2);
  doc.setFillColor(246, 243, 236);
  doc.setDrawColor(67, 91, 76);
  doc.setLineWidth(0.4);
  doc.rect(margin, y, contentW, list.totals.hasUnconfirmedPrices ? 16 : 11, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(67, 91, 76);
  doc.text('SUBTOTAL ESTIMADO DE MATERIALES (PRECIOS CONFIRMADOS):', margin + 4, y + 7);
  doc.text(
    formatMoney(list.totals.estimatedMaterialsSubtotal),
    margin + contentW - 4,
    y + 7,
    { align: 'right' },
  );
  if (list.totals.hasUnconfirmedPrices) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 75, 20);
    doc.text(
      'Nota: Hay ítems con precio "A confirmar" en el catálogo local. Cargalos en Catálogos para totalizar el 100%.',
      margin + 4,
      y + 13,
    );
  }

  return doc;
}
