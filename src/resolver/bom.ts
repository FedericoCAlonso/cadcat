import {
  type EdgeBand,
} from '../model';
import { type ResolvedModule, type ResolvedPiece } from './resolver';
import {
  calculatePieceCutSize,
  calculateEdgeBandLengths,
  createEdgeBandMap,
  type BandedEdgeInfo,
} from './edgeBand';

export interface BOMPieceItem {
  pieceId: string;
  role: string;
  materialId: string;
  finishedDimensionsMm: { width: number; height: number };
  cutDimensionsMm: { width: number; height: number };
  thicknessMm: number;
  areaM2: number;
  structural: boolean;
  bandedEdges: BandedEdgeInfo[];
}

export interface BOMEdgeBandItem {
  edgeBandId: string;
  kind: string;
  lengthMm: number;
  lengthMeters: number;
}

export interface BOMHardwareItem {
  hardwareId: string;
  name: string;
  jointKind: string;
  count: number;
}

export interface BillOfMaterials {
  moduleId: string;
  pieces: BOMPieceItem[];
  totalPieceCount: number;
  totalCutAreaM2: number;
  edgeBands: BOMEdgeBandItem[];
  totalEdgeBandMeters: number;
  hardware: BOMHardwareItem[];
  totalHardwareCount: number;
}

/**
 * Determine the hardware units needed for a joint based on kind and length.
 */
export function getHardwareCountForJoint(jointKind: string, contactLengthMm?: number): number {
  switch (jointKind) {
    case 'confirmat':
    case 'cam-dowel':
    case 'dowel':
      if (contactLengthMm && contactLengthMm > 600) {
        return 3;
      }
      return 2;
    case 'butt':
    case 'rebate':
    case 'groove':
    case 'glue':
    default:
      return 0;
  }
}

/**
 * Map joint kind to hardware item metadata.
 */
function getHardwareMetadata(jointKind: string): { hardwareId: string; name: string } | null {
  switch (jointKind) {
    case 'confirmat':
      return { hardwareId: 'hw-confirmat-7x50', name: 'Confirmat Screw 7x50mm' };
    case 'cam-dowel':
      return { hardwareId: 'hw-cam-dowel-15', name: 'Cam Lock & Connecting Dowel 15mm' };
    case 'dowel':
      return { hardwareId: 'hw-dowel-8x35', name: 'Wooden Dowel 8x35mm' };
    default:
      return null;
  }
}

/**
 * Generate piece cut list items with cut sizes, area, and banded edges.
 */
export function generateBOMPieces(
  pieces: ResolvedPiece[],
  edgeBands: Map<string, EdgeBand> | EdgeBand[] | { edgeBands: EdgeBand[] },
): BOMPieceItem[] {
  return pieces.map((piece) => {
    const cutSize = calculatePieceCutSize(piece, edgeBands);
    const areaM2 = (cutSize.cutDimensionsMm.width * cutSize.cutDimensionsMm.height) / 1_000_000;

    const bandedEdges: BandedEdgeInfo[] = [];
    if (cutSize.bandedEdges.bottom) bandedEdges.push(cutSize.bandedEdges.bottom);
    if (cutSize.bandedEdges.right) bandedEdges.push(cutSize.bandedEdges.right);
    if (cutSize.bandedEdges.top) bandedEdges.push(cutSize.bandedEdges.top);
    if (cutSize.bandedEdges.left) bandedEdges.push(cutSize.bandedEdges.left);

    return {
      pieceId: piece.id,
      role: piece.role,
      materialId: piece.materialId,
      finishedDimensionsMm: cutSize.finishedDimensionsMm,
      cutDimensionsMm: cutSize.cutDimensionsMm,
      thicknessMm: piece.thicknessMm,
      areaM2: Number(areaM2.toFixed(4)),
      structural: piece.structural,
      bandedEdges,
    };
  });
}

/**
 * Generate edge band meter summary per type.
 */
export function generateBOMEdgeBands(
  pieces: ResolvedPiece[],
  edgeBands: Map<string, EdgeBand> | EdgeBand[] | { edgeBands: EdgeBand[] },
): BOMEdgeBandItem[] {
  const edgeBandMap = createEdgeBandMap(edgeBands);
  const lengths = calculateEdgeBandLengths(pieces, edgeBands);
  const items: BOMEdgeBandItem[] = [];

  for (const [id, lengthMm] of lengths.entries()) {
    const band = edgeBandMap.get(id);
    const lengthMeters = Number((lengthMm / 1000).toFixed(3));
    items.push({
      edgeBandId: id,
      kind: band?.kind ?? 'unknown',
      lengthMm,
      lengthMeters,
    });
  }

  return items;
}

/**
 * Count hardware items derived from module joints.
 */
export function generateBOMHardware(resolvedModule: ResolvedModule): BOMHardwareItem[] {
  const counts = new Map<string, { name: string; jointKind: string; count: number }>();

  for (const joint of resolvedModule.joints) {
    const meta = getHardwareMetadata(joint.kind);
    if (!meta) {
      continue;
    }

    const contactLengthMm = joint.region ? joint.region.end - joint.region.start : undefined;
    const units = getHardwareCountForJoint(joint.kind, contactLengthMm);

    if (units > 0) {
      const existing = counts.get(meta.hardwareId);
      if (existing) {
        existing.count += units;
      } else {
        counts.set(meta.hardwareId, {
          name: meta.name,
          jointKind: joint.kind,
          count: units,
        });
      }
    }
  }

  const result: BOMHardwareItem[] = [];
  for (const [hardwareId, info] of counts.entries()) {
    result.push({
      hardwareId,
      name: info.name,
      jointKind: info.jointKind,
      count: info.count,
    });
  }

  return result;
}

/**
 * Make a complete Bill of Materials (BOM) for a resolved module.
 */
export function generateBillOfMaterials(
  resolvedModule: ResolvedModule,
  edgeBands: Map<string, EdgeBand> | EdgeBand[] | { edgeBands: EdgeBand[] },
): BillOfMaterials {
  const pieces = generateBOMPieces(resolvedModule.pieces, edgeBands);
  const edgeBandsSummary = generateBOMEdgeBands(resolvedModule.pieces, edgeBands);
  const hardware = generateBOMHardware(resolvedModule);

  const totalCutAreaM2 = Number(
    pieces.reduce((sum, p) => sum + p.areaM2, 0).toFixed(4),
  );

  const totalEdgeBandMeters = Number(
    edgeBandsSummary.reduce((sum, eb) => sum + eb.lengthMeters, 0).toFixed(3),
  );

  const totalHardwareCount = hardware.reduce((sum, hw) => sum + hw.count, 0);

  return {
    moduleId: resolvedModule.moduleId,
    pieces,
    totalPieceCount: pieces.length,
    totalCutAreaM2,
    edgeBands: edgeBandsSummary,
    totalEdgeBandMeters,
    hardware,
    totalHardwareCount,
  };
}
