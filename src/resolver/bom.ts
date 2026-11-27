import {
  type EdgeBand,
  type Joint,
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

export interface BOMMaterialGroup {
  materialId: string;
  pieces: BOMPieceItem[];
  totalPieces: number;
  totalCutAreaM2: number;
}

export interface BillOfMaterials {
  moduleId: string;
  pieces: BOMPieceItem[];
  totalPieceCount: number;
  totalCutAreaM2: number;
  materialGroups?: BOMMaterialGroup[];
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
    case 'screw':
    case 'dowel-and-confirmat':
      if (contactLengthMm && contactLengthMm > 600) {
        return 3;
      }
      return 2;
    case 'hinge':
    case 'butt-hinge':
    case 'piano-hinge':
    case 'magnetic-catch':
    case 'push-catch':
    case 'roller-catch':
    case 'handle':
    case 'slide':
      // Each drawer/tray emits 2 slide joints (left & right); 1 rail per joint = 2 rails (1 pair) per drawer
      return 1;
    case 'shelf-pin':
      // Each adjustable shelf emits 2 shelf-pin joints (left & right); 2 pins per side = 4 pins per shelf
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
      return { hardwareId: 'hw-confirmat-7x50', name: 'Tornillo Confirmat 7×50 mm' };
    case 'cam-dowel':
      return { hardwareId: 'hw-cam-dowel-15', name: 'Minifix Ø15 mm + Perno' };
    case 'dowel':
      return { hardwareId: 'hw-dowel-8x35', name: 'Tarugo de Madera 8×35 mm' };
    case 'screw':
      return { hardwareId: 'hw-screw-wood', name: 'Tornillo Madera / Armado 4×40 mm' };
    case 'hinge':
      return { hardwareId: 'hw-hinge-cup-35', name: 'Bisagra Cazoleta Ø35 mm' };
    case 'butt-hinge':
      return { hardwareId: 'hw-hinge-butt', name: 'Bisagra Libro / Pomela' };
    case 'piano-hinge':
      return { hardwareId: 'hw-hinge-piano', name: 'Bisagra Piano Continua' };
    case 'magnetic-catch':
      return { hardwareId: 'hw-catch-magnetic', name: 'Retén Magnético con Contraplaca' };
    case 'push-catch':
      return { hardwareId: 'hw-catch-push', name: 'Expulsor Push-to-Open' };
    case 'roller-catch':
      return { hardwareId: 'hw-catch-roller', name: 'Retén a Rodillo' };
    case 'handle':
      return { hardwareId: 'hw-handle', name: 'Tirador / Manija con Tornillos M4' };
    case 'slide':
      return { hardwareId: 'hw-slide-telescopic', name: 'Corredera Telescópica (guía lateral; 2 = 1 par)' };
    case 'shelf-pin':
      return { hardwareId: 'hw-shelf-pin-5', name: 'Soporte / Pin de Estante Ø5 mm' };
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
  return pieces
    .filter((piece) => !piece.isAuxiliary)
    .map((piece) => {
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
  const nonAuxPieces = pieces.filter((piece) => !piece.isAuxiliary);
  const edgeBandMap = createEdgeBandMap(edgeBands);
  const lengths = calculateEdgeBandLengths(nonAuxPieces, edgeBands);
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
export function generateBOMHardware(
  resolvedModule: { joints: Joint[] } | ResolvedModule,
  jointStrategy?: string,
): BOMHardwareItem[] {
  const counts = new Map<string, { name: string; jointKind: string; count: number }>();

  const addItem = (hardwareId: string, name: string, jointKind: string, units: number) => {
    if (units <= 0) return;
    const existing = counts.get(hardwareId);
    if (existing) {
      existing.count += units;
    } else {
      counts.set(hardwareId, { name, jointKind, count: units });
    }
  };

  for (const joint of resolvedModule.joints) {
    const effectiveKind =
      joint.kind === 'confirmat' && jointStrategy ? jointStrategy : joint.kind;
    const contactLengthMm = joint.region ? joint.region.end - joint.region.start : undefined;

    if (effectiveKind === 'dowel-and-confirmat') {
      const units = getHardwareCountForJoint('confirmat', contactLengthMm);
      const confMeta = getHardwareMetadata('confirmat');
      const dowelMeta = getHardwareMetadata('dowel');
      if (confMeta) addItem(confMeta.hardwareId, confMeta.name, 'confirmat', units);
      if (dowelMeta) addItem(dowelMeta.hardwareId, dowelMeta.name, 'dowel', Math.min(2, units));
      continue;
    }

    const meta = getHardwareMetadata(effectiveKind);
    if (!meta) {
      continue;
    }

    const units = getHardwareCountForJoint(effectiveKind, contactLengthMm);
    addItem(meta.hardwareId, meta.name, effectiveKind, units);
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
 * Groups BOM piece items by their material ID.
 */
export function groupBOMPiecesByMaterial(pieces: BOMPieceItem[]): BOMMaterialGroup[] {
  const map = new Map<string, BOMPieceItem[]>();
  for (const piece of pieces) {
    const list = map.get(piece.materialId);
    if (list) {
      list.push(piece);
    } else {
      map.set(piece.materialId, [piece]);
    }
  }

  const groups: BOMMaterialGroup[] = [];
  for (const [materialId, groupPieces] of map.entries()) {
    const exactGroupAreaM2 = groupPieces.reduce(
      (acc, p) => acc + (p.cutDimensionsMm.width * p.cutDimensionsMm.height) / 1_000_000,
      0,
    );
    const totalCutAreaM2 = Number(exactGroupAreaM2.toFixed(3));
    groups.push({
      materialId,
      pieces: groupPieces,
      totalPieces: groupPieces.length,
      totalCutAreaM2,
    });
  }

  return groups;
}

/**
 * Make a complete Bill of Materials (BOM) for a resolved module.
 */
export function generateBillOfMaterials(
  resolvedModule: ResolvedModule,
  edgeBands: Map<string, EdgeBand> | EdgeBand[] | { edgeBands: EdgeBand[] },
  extraHardware?: BOMHardwareItem[],
  jointStrategy?: string,
): BillOfMaterials {
  const pieces = generateBOMPieces(resolvedModule.pieces, edgeBands);
  const edgeBandsSummary = generateBOMEdgeBands(resolvedModule.pieces, edgeBands);
  const hardware = generateBOMHardware(resolvedModule, jointStrategy);
  if (extraHardware && extraHardware.length > 0) {
    for (const extra of extraHardware) {
      if (extra.count <= 0) continue;
      const existing = hardware.find((h) => h.hardwareId === extra.hardwareId);
      if (existing) {
        existing.count += extra.count;
      } else {
        hardware.push({ ...extra });
      }
    }
  }
  const materialGroups = groupBOMPiecesByMaterial(pieces);

  const exactTotalAreaM2 = pieces.reduce(
    (sum, p) => sum + (p.cutDimensionsMm.width * p.cutDimensionsMm.height) / 1_000_000,
    0,
  );
  const totalCutAreaM2 = Number(exactTotalAreaM2.toFixed(3));

  const totalEdgeBandMeters = Number(
    edgeBandsSummary.reduce((sum, eb) => sum + eb.lengthMeters, 0).toFixed(3),
  );

  const totalHardwareCount = hardware.reduce((sum, hw) => sum + hw.count, 0);

  return {
    moduleId: resolvedModule.moduleId,
    pieces,
    totalPieceCount: pieces.length,
    totalCutAreaM2,
    materialGroups,
    edgeBands: edgeBandsSummary,
    totalEdgeBandMeters,
    hardware,
    totalHardwareCount,
  };
}
