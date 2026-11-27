import type { Material, EdgeBand } from '../model';
import type { ResolvedPieceWithCutSize, BandedEdgeInfo } from './edgeBand';
import type { ConsolidatedPiece } from './projectConsolidator';
import { resolvePieceGrainAxis } from './piece';
import { translateRoleKey } from '../locales';

/**
 * Standard Argentine / LATAM placacentro row (compatible with CorteCloud / Lepton / Optimik).
 * Largo is aligned with the grain axis whenever the material has grain.
 * L1 / L2 correspond to the two long edges (parallel to Largo);
 * A1 / A2 correspond to the two short/cross edges (parallel to Ancho).
 */
export interface PlacacentroCutRow {
  lengthMm: number;
  widthMm: number;
  quantity: number;
  materialId: string;
  materialName: string;
  thicknessMm: number;
  respectGrain: boolean;
  /** Edge band thickness on Long Edge 1 (e.g. "0.8" or "2.0" or "") */
  l1: string;
  /** Edge band thickness on Long Edge 2 */
  l2: string;
  /** Edge band thickness on Short/Cross Edge 1 */
  a1: string;
  /** Edge band thickness on Short/Cross Edge 2 */
  a2: string;
  pieceLabel: string;
  moduleName: string;
}

function escapeCsvCell(val: string | number | boolean): string {
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatEdgeCode(edge: BandedEdgeInfo | undefined, edgeBandMap: Map<string, EdgeBand>): string {
  if (!edge) return '';
  const band = edgeBandMap.get(edge.edgeBandId);
  const bandThickness = typeof band?.thicknessMm === 'number' ? band.thicknessMm : 0;
  const thickness = edge.thicknessMm || bandThickness;
  if (thickness <= 0) return '';
  return String(Math.round(thickness * 100) / 100);
}

/**
 * Groups resolved pieces into placacentro-ready cut rows (Largo × Ancho × Cant × Veta × L1/L2/A1/A2).
 * Rules:
 * - If material has grain and piece's grain axis is 'height', Largo = cutHeightMm, Ancho = cutWidthMm (swapped).
 * - If material has no grain, Largo = max(cutWidthMm, cutHeightMm) and Ancho = min(cutWidthMm, cutHeightMm)
 *   for clean placacentro presentation, remapping L1/L2/A1/A2 edges accordingly.
 * - Excludes auxiliary pieces unless explicitly requested.
 */
export function buildPlacacentroCutRows(
  pieces: (ResolvedPieceWithCutSize | ConsolidatedPiece)[],
  materials: Material[],
  edgeBands: EdgeBand[],
  options?: { includeAuxiliary?: boolean; defaultModuleName?: string },
): PlacacentroCutRow[] {
  const matMap = new Map(materials.map((m) => [m.id, m]));
  const ebMap = new Map(edgeBands.map((e) => [e.id, e]));
  const includeAux = options?.includeAuxiliary ?? false;
  const defaultModName = options?.defaultModuleName ?? 'Módulo Principal';

  const groupMap = new Map<string, PlacacentroCutRow>();

  for (const p of pieces) {
    if (p.isAuxiliary && !includeAux) continue;

    const mat = matMap.get(p.materialId);
    const hasGrain = Boolean(mat?.hasGrain);
    const grainAxis = hasGrain ? resolvePieceGrainAxis(p) : 'none';

    const rawW = Math.round(p.cutDimensionsMm.width * 10) / 10;
    const rawH = Math.round(p.cutDimensionsMm.height * 10) / 10;

    // Determine whether piece height becomes Largo (L) and width becomes Ancho (A)
    const heightIsLength = hasGrain ? grainAxis === 'height' : rawH > rawW;
    const lengthMm = heightIsLength ? rawH : rawW;
    const widthMm = heightIsLength ? rawW : rawH;

    // Edge band lookup:
    // On raw 2D piece: top-edge & bottom-edge run along width; left-edge & right-edge run along height.
    const topEdge = p.bandedEdges?.find((b) => b.faceId.includes('top'));
    const bottomEdge = p.bandedEdges?.find((b) => b.faceId.includes('bottom'));
    const leftEdge = p.bandedEdges?.find((b) => b.faceId.includes('left'));
    const rightEdge = p.bandedEdges?.find((b) => b.faceId.includes('right'));

    // L1/L2 run parallel to Largo; A1/A2 run parallel to Ancho
    const l1 = formatEdgeCode(heightIsLength ? leftEdge : topEdge, ebMap);
    const l2 = formatEdgeCode(heightIsLength ? rightEdge : bottomEdge, ebMap);
    const a1 = formatEdgeCode(heightIsLength ? topEdge : leftEdge, ebMap);
    const a2 = formatEdgeCode(heightIsLength ? bottomEdge : rightEdge, ebMap);

    const pieceLabel = translateRoleKey(p.role);
    const moduleName = 'moduleName' in p && p.moduleName ? p.moduleName : defaultModName;
    const materialName = mat?.name ?? p.materialId;

    const groupKey = [
      p.materialId,
      lengthMm,
      widthMm,
      p.thicknessMm,
      hasGrain && grainAxis !== 'none' ? '1' : '0',
      l1,
      l2,
      a1,
      a2,
      pieceLabel,
      moduleName,
    ].join('|');

    const existing = groupMap.get(groupKey);
    if (existing) {
      existing.quantity += 1;
    } else {
      groupMap.set(groupKey, {
        lengthMm,
        widthMm,
        quantity: 1,
        materialId: p.materialId,
        materialName,
        thicknessMm: p.thicknessMm,
        respectGrain: hasGrain && grainAxis !== 'none',
        l1,
        l2,
        a1,
        a2,
        pieceLabel,
        moduleName,
      });
    }
  }

  return Array.from(groupMap.values()).sort((a, b) => {
    if (a.materialName !== b.materialName) return a.materialName.localeCompare(b.materialName);
    if (b.lengthMm !== a.lengthMm) return b.lengthMm - a.lengthMm;
    return b.widthMm - a.widthMm;
  });
}

/**
 * Exports cut list in Argentine/LATAM Placacentro CSV format (CorteCloud / Lepton / Optimik).
 */
export function exportPlacacentroCsv(
  pieces: (ResolvedPieceWithCutSize | ConsolidatedPiece)[],
  materials: Material[],
  edgeBands: EdgeBand[],
  options?: { includeAuxiliary?: boolean; defaultModuleName?: string },
): string {
  const rows = buildPlacacentroCutRows(pieces, materials, edgeBands, options);
  const headers = [
    'Largo (mm)',
    'Ancho (mm)',
    'Cantidad',
    'Material',
    'Espesor (mm)',
    'Veta',
    'L1',
    'L2',
    'A1',
    'A2',
    'Pieza',
    'Módulo',
  ];

  const lines: string[] = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        escapeCsvCell(r.lengthMm),
        escapeCsvCell(r.widthMm),
        escapeCsvCell(r.quantity),
        escapeCsvCell(r.materialName),
        escapeCsvCell(r.thicknessMm),
        escapeCsvCell(r.respectGrain ? 'Sí' : 'No'),
        escapeCsvCell(r.l1),
        escapeCsvCell(r.l2),
        escapeCsvCell(r.a1),
        escapeCsvCell(r.a2),
        escapeCsvCell(r.pieceLabel),
        escapeCsvCell(r.moduleName),
      ].join(','),
    );
  }

  return lines.join('\r\n');
}
