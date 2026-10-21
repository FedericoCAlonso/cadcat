import type {
  Piece,
  Material,
  EdgeBand,
  PieceLabelData,
  PieceLabelEdgeBand,
} from '../../model';
import { type PieceMachining } from '../../model/operation';
import {
  calculatePieceCutSize,
  createEdgeBandMap,
} from '../edgeBand';
import { translatePieceRole } from '../../ui/localization';

export interface ExtractLabelDataOptions {
  orderId?: string;
  clientName?: string;
  moduleId?: string;
  moduleName?: string;
  materials: Material[] | Map<string, Material>;
  edgeBands: EdgeBand[] | Map<string, EdgeBand>;
  machiningList?: PieceMachining[];
  includeAuxiliaryGauges?: boolean;
}

/**
 * Extracts normalized, print-ready label data for each piece in a module or project.
 */
export function extractPieceLabelData(
  pieces: Piece[],
  options: ExtractLabelDataOptions,
): PieceLabelData[] {
  const materialMap = options.materials instanceof Map
    ? options.materials
    : new Map(options.materials.map((m) => [m.id, m]));

  const edgeBandMap = createEdgeBandMap(options.edgeBands);
  const machiningMap = new Map((options.machiningList ?? []).map((m) => [m.pieceId, m]));

  const filteredPieces = pieces.filter((p) => {
    if (p.isAuxiliary && !options.includeAuxiliaryGauges) {
      return false;
    }
    return true;
  });

  const totalPieces = filteredPieces.length;

  return filteredPieces.map((piece, index) => {
    const material = materialMap.get(piece.materialId);
    const materialName = material?.name ?? piece.materialId;
    const hasGrain = material?.hasGrain ?? false;

    const cutInfo = calculatePieceCutSize(piece, edgeBandMap);

    const formatEdge = (bandInfo?: { edgeBandId: string; thicknessMm: number }): PieceLabelEdgeBand | undefined => {
      if (!bandInfo) return undefined;
      const eb = edgeBandMap.get(bandInfo.edgeBandId);
      return {
        code: bandInfo.edgeBandId,
        name: eb ? `${eb.id} (${bandInfo.thicknessMm} mm)` : `${bandInfo.thicknessMm} mm`,
        thicknessMm: bandInfo.thicknessMm,
      };
    };

    const edgeBands = {
      top: formatEdge(cutInfo.bandedEdges.top),
      bottom: formatEdge(cutInfo.bandedEdges.bottom),
      left: formatEdge(cutInfo.bandedEdges.left),
      right: formatEdge(cutInfo.bandedEdges.right),
    };

    // Edge notes helper for clarity in workshop
    if (piece.role === 'bottom' && edgeBands.bottom) {
      edgeBands.bottom.note = 'FRENTE';
    }
    if (piece.role.startsWith('side')) {
      if (edgeBands.bottom) {
        edgeBands.bottom.note = 'PISO';
      }
      if (edgeBands.right) {
        edgeBands.right.note = 'FRENTE';
      }
    }

    // Machining summary
    const machining = machiningMap.get(piece.id);
    let hasMachining = false;
    let machiningSummary = '';

    if (machining && machining.operations.length > 0) {
      hasMachining = true;
      const faceAOps = machining.operations.filter((op) => op.faceId === 'face-A' || op.faceId === 'face-top');
      const faceBOps = machining.operations.filter((op) => op.faceId === 'face-B' || op.faceId === 'face-bottom');
      const parts: string[] = [];
      if (faceAOps.length > 0) parts.push(`Cara A: ${faceAOps.length} perf.`);
      if (faceBOps.length > 0) parts.push(`Cara B: ${faceBOps.length} perf.`);
      machiningSummary = parts.join(' | ') || `${machining.operations.length} operaciones`;
    }

    const secondaryOperationsSummary: string[] = [];
    if (piece.secondaryCuts && piece.secondaryCuts.length > 0) {
      for (const cut of piece.secondaryCuts) {
        secondaryOperationsSummary.push(cut.description);
      }
    }

    const roleName = translatePieceRole(piece.role);
    const pieceDisplayName = piece.isAuxiliary
      ? `Calibre Auxiliar (${roleName})`
      : roleName;

    return {
      orderId: options.orderId ?? 'ORD-001',
      clientName: options.clientName ?? 'Taller CadCat',
      moduleId: options.moduleId ?? 'MOD-01',
      moduleName: options.moduleName ?? 'Módulo Estándar',
      pieceId: piece.id,
      pieceName: pieceDisplayName,
      pieceIndex: index + 1,
      totalPieces,
      materialName,
      thicknessMm: piece.thicknessMm,
      cutWidthMm: Math.round(cutInfo.cutDimensionsMm.width * 10) / 10,
      cutHeightMm: Math.round(cutInfo.cutDimensionsMm.height * 10) / 10,
      finishedWidthMm: Math.round(cutInfo.finishedDimensionsMm.width * 10) / 10,
      finishedHeightMm: Math.round(cutInfo.finishedDimensionsMm.height * 10) / 10,
      hasGrain,
      grainDirection: hasGrain ? 'length' : 'none',
      edgeBands,
      secondaryOperationsSummary: secondaryOperationsSummary.length > 0 ? secondaryOperationsSummary : undefined,
      hasMachining,
      machiningSummary,
      qrData: `cadcat://p/${options.moduleId ?? 'mod'}/${piece.id}`,
    };
  });
}
