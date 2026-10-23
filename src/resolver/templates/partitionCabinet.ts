import {
  type Material,
  type EdgeBand,
  type Module,
  type Piece,
  type Joint,
  type SubAssembly,
} from '../../model';
import { createPiece, createRectangularContour } from '../piece';
import { createJoint } from '../joint';
import { PlacementTree } from '../tree';
import { resolveModule } from '../resolver';
import { applyEdgeBandRule, type ResolvedPieceWithCutSize } from '../edgeBand';
import { buildPartition } from './partition';
import { buildShelf } from './shelf';
import { buildDrawerSubAssembly, type DrawerSlideType } from './drawer';
import { applyFrontEdgeBand } from '../frontEdge';

export interface PartitionCabinetParams {
  width: number;
  height: number;
  depth: number;
  partitionRatio?: number; // default 0.5 (centered)
  slideType?: DrawerSlideType; // default 'telescopic'
}

export const DEFAULT_PARTITION_CABINET_PARAMS: PartitionCabinetParams = {
  width: 900,
  height: 850,
  depth: 560,
  partitionRatio: 0.5,
  slideType: 'telescopic',
};

export interface PartitionCabinetResult {
  module: Module;
  placementTree: PlacementTree;
  resolvedPieces: ResolvedPieceWithCutSize[];
}

/**
 * Builds a 2-Bay Cabinet with a vertical partition:
 * - Left bay: 2 shelves
 * - Right bay: 3 drawers with slide type configuration
 */
export function buildPartitionCabinet(
  params: PartitionCabinetParams,
  material: Material,
  edgeBands: EdgeBand[] = [],
  edgeBandId?: string,
): PartitionCabinetResult {
  const widthMm = params.width;
  const heightMm = params.height;
  const depthMm = params.depth;
  const ratio = params.partitionRatio ?? 0.5;
  const slideType = params.slideType ?? 'telescopic';
  const T = typeof material.thicknessMm === 'number' ? material.thicknessMm : 18;
  const materialId = material.id;

  const innerWidth = widthMm - 2 * T;
  const innerHeight = heightMm - 2 * T;

  // 1. Carcase Sides
  const sideLeft = createPiece({
    id: 'part-cab-side-left',
    role: 'side-left',
    materialId,
    contour: createRectangularContour(depthMm, heightMm),
    thicknessMm: T,
  });
  const sideRight = createPiece({
    id: 'part-cab-side-right',
    role: 'side-right',
    materialId,
    contour: createRectangularContour(depthMm, heightMm),
    thicknessMm: T,
  });
  if (edgeBandId) {
    applyFrontEdgeBand(sideLeft, edgeBandId);
    applyFrontEdgeBand(sideRight, edgeBandId);
  }

  // 2. Carcase Bottom
  const bottom = createPiece({
    id: 'part-cab-bottom',
    role: 'bottom',
    materialId,
    contour: createRectangularContour(innerWidth, depthMm),
    thicknessMm: T,
  });
  if (edgeBandId) {
    applyFrontEdgeBand(bottom, edgeBandId);
  }

  // 3. Rails (top front and top back)
  const railFront = createPiece({
    id: 'part-cab-rail-front',
    role: 'rail-front',
    materialId,
    contour: createRectangularContour(innerWidth, 100),
    thicknessMm: T,
  });
  const railBack = createPiece({
    id: 'part-cab-rail-back',
    role: 'rail-back',
    materialId,
    contour: createRectangularContour(innerWidth, 100),
    thicknessMm: T,
  });

  // 4. Back Panel
  const back = createPiece({
    id: 'part-cab-back',
    role: 'back',
    materialId,
    contour: createRectangularContour(innerWidth, heightMm - T),
    thicknessMm: T,
    structural: false,
  });

  const pieces: Piece[] = [sideLeft, sideRight, bottom, railFront, railBack, back];

  const joints: Joint[] = [
    createJoint({
      a: { pieceId: 'part-cab-side-left', faceId: 'inner' },
      b: { pieceId: 'part-cab-bottom', faceId: 'left-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'part-cab-side-right', faceId: 'inner' },
      b: { pieceId: 'part-cab-bottom', faceId: 'right-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'part-cab-side-left', faceId: 'inner' },
      b: { pieceId: 'part-cab-rail-front', faceId: 'left-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'part-cab-side-right', faceId: 'inner' },
      b: { pieceId: 'part-cab-rail-front', faceId: 'right-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'part-cab-side-left', faceId: 'inner' },
      b: { pieceId: 'part-cab-rail-back', faceId: 'left-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'part-cab-side-right', faceId: 'inner' },
      b: { pieceId: 'part-cab-rail-back', faceId: 'right-edge' },
      kind: 'confirmat',
    }),
    createJoint({
      a: { pieceId: 'part-cab-bottom', faceId: 'rear-edge' },
      b: { pieceId: 'part-cab-back', faceId: 'bottom-edge' },
      kind: 'rebate',
    }),
  ];

  const placementTree = new PlacementTree('part-cab-side-left');
  placementTree.setNode({
    pieceId: 'part-cab-side-right',
    parentPieceId: 'part-cab-side-left',
    relativeOffset: { x: widthMm - T, y: 0, z: 0 },
  });
  placementTree.setNode({
    pieceId: 'part-cab-bottom',
    parentPieceId: 'part-cab-side-left',
    relativeOffset: { x: T, y: 0, z: 0 },
  });
  placementTree.setNode({
    pieceId: 'part-cab-rail-front',
    parentPieceId: 'part-cab-side-left',
    relativeOffset: { x: T, y: heightMm - T, z: 0 },
  });
  placementTree.setNode({
    pieceId: 'part-cab-rail-back',
    parentPieceId: 'part-cab-side-left',
    relativeOffset: { x: T, y: heightMm - T, z: depthMm - 100 },
  });
  placementTree.setNode({
    pieceId: 'part-cab-back',
    parentPieceId: 'part-cab-side-left',
    relativeOffset: { x: T, y: T, z: depthMm - T },
  });

  // 5. Vertical Partition
  const partRes = buildPartition(
    {
      id: 'part-cab-partition',
      openingWidthMm: innerWidth,
      openingHeightMm: innerHeight,
      depthMm: depthMm - 10,
      carcaseThicknessMm: T,
      materialId,
      ratio,
      bottomPieceId: 'part-cab-bottom',
      edgeBandId,
    },
    'part-cab-side-left',
  );
  pieces.push(partRes.piece);
  joints.push(...partRes.joints);
  placementTree.setNode(partRes.placementNode);

  // 6. Left Bay Shelves (2 adjustable shelves)
  const leftBayWidth = partRes.leftBayWidthMm;
  for (let s = 1; s <= 2; s++) {
    const shelfElev = Math.round((s * innerHeight) / 3);
    const shelf = buildShelf(
      {
        id: `part-cab-shelf-left-${s}`,
        openingWidthMm: leftBayWidth,
        depthMm: depthMm - 20,
        elevationYMm: shelfElev,
        carcaseThicknessMm: T,
        materialId,
        mountType: 'adjustable',
        edgeBandId,
      },
      'part-cab-side-left',
    );
    pieces.push(shelf.piece);
    joints.push(...shelf.joints);
    placementTree.setNode(shelf.placementNode);
  }

  // 7. Right Bay Drawers (3 drawers)
  const rightBayWidth = partRes.rightBayWidthMm;
  const drawerCount = 3;
  const gap = 2.0;
  const availableDrawerH = innerHeight - 20;
  const drawerFrontH = Math.round((availableDrawerH - (drawerCount + 1) * gap) / drawerCount);
  const boxH = Math.max(80, drawerFrontH - 40);

  const subAssemblies: SubAssembly[] = [];

  for (let d = 0; d < drawerCount; d++) {
    const drawerIdx = d + 1;
    const baseY = T + gap + d * (drawerFrontH + gap);

    const drawer = buildDrawerSubAssembly(
      {
        idPrefix: 'part-cab-drawer',
        index: drawerIdx,
        openingWidthMm: rightBayWidth,
        depthMm,
        frontHeightMm: drawerFrontH,
        boxHeightMm: boxH,
        baseYMm: baseY,
        carcaseThicknessMm: T,
        materialId,
        slideType,
        edgeBandId,
        gapMm: gap,
      },
      'part-cab-side-left',
    );

    // Adjust X position into right bay (after left bay and partition)
    const rightBayOffset = partRes.partitionXMm + T - T;
    for (const node of drawer.placementNodes) {
      node.relativeOffset.x += rightBayOffset;
      placementTree.setNode(node);
    }

    pieces.push(...drawer.pieces);
    joints.push(...drawer.joints);
    subAssemblies.push(drawer.subAssembly);
  }

  const module: Module = {
    schemaVersion: 1,
    id: 'module-partition-cabinet',
    parameters: {
      width: widthMm,
      height: heightMm,
      depth: depthMm,
    },
    rootPieceId: 'part-cab-side-left',
    pieces,
    joints,
    subAssemblies,
    overrides: {},
  };

  const resolved = resolveModule({ module, placementTree });
  const resolvedPieces = resolved.pieces.map((p) => applyEdgeBandRule(p, edgeBands));

  return {
    module,
    placementTree,
    resolvedPieces,
  };
}
