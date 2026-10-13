import { type Piece, type Joint } from '../../model';
import { createPiece, createRectangularContour } from '../piece';
import { createJoint } from '../joint';
import { type PlacementNode } from '../tree';
import {
  type CarcassDefinition,
  type InteriorBounds,
} from './types';

export interface AnchorSolverInput {
  carcass: CarcassDefinition;
  carcassMaterialId: string;
  carcassThicknessMm: number;
  backingMaterialId?: string;
  backingThicknessMm?: number;
  edgeBandId?: string;
  idPrefix?: string;
}

export interface AnchorSolverResult {
  pieces: Piece[];
  joints: Joint[];
  placementNodes: PlacementNode[];
  rootPieceId: string;
  interior: InteriorBounds;
  leftPieceId: string;
  rightPieceId: string;
  bottomPieceId: string;
  topPieceId: string;
}

/**
 * Resolves carcass structural panels, anchor priority joints, and interior boundary cavity.
 */
export function resolveCarcass(input: AnchorSolverInput): AnchorSolverResult {
  const {
    carcass,
    carcassMaterialId,
    carcassThicknessMm: T,
    backingMaterialId,
    backingThicknessMm = carcass.backingThicknessMm ?? 3,
    edgeBandId,
    idPrefix = 'carcass',
  } = input;

  const {
    width,
    height,
    depth,
    jointPriority = 'lateral-over-bottom',
    roofType = 'front-back-rails',
    railWidthMm = 80,
    hasBacking = true,
    backingGrooveDistanceMm = 15,
    backingGrooveDepthMm = 8,
  } = carcass;

  const pieces: Piece[] = [];
  const joints: Joint[] = [];
  const placementNodes: PlacementNode[] = [];

  const leftPieceId = `${idPrefix}-side-left`;
  const rightPieceId = `${idPrefix}-side-right`;
  const bottomPieceId = `${idPrefix}-bottom`;
  let topPieceId = `${idPrefix}-roof`;

  const rootPieceId = leftPieceId;

  // 1. Carcass Sides and Bottom
  if (jointPriority === 'lateral-over-bottom' || jointPriority === 'miter-45') {
    // Left & Right sides run full height
    const sideLeft = createPiece({
      id: leftPieceId,
      role: 'side-left',
      materialId: carcassMaterialId,
      contour: createRectangularContour(depth, height),
      thicknessMm: T,
      structural: true,
    });

    const sideRight = createPiece({
      id: rightPieceId,
      role: 'side-right',
      materialId: carcassMaterialId,
      contour: createRectangularContour(depth, height),
      thicknessMm: T,
      structural: true,
    });

    // Bottom panel fits between sides
    const bottomWidth = width - 2 * T;
    const bottom = createPiece({
      id: bottomPieceId,
      role: 'bottom',
      materialId: carcassMaterialId,
      contour: createRectangularContour(bottomWidth, depth),
      thicknessMm: T,
      structural: true,
    });

    if (edgeBandId) {
      applyFrontEdgeBand(sideLeft, edgeBandId);
      applyFrontEdgeBand(sideRight, edgeBandId);
      applyFrontEdgeBand(bottom, edgeBandId);
    }

    pieces.push(sideLeft, sideRight, bottom);

    placementNodes.push({
      pieceId: rightPieceId,
      parentPieceId: leftPieceId,
      relativeOffset: { x: width - T, y: 0, z: 0 },
    });
    placementNodes.push({
      pieceId: bottomPieceId,
      parentPieceId: leftPieceId,
      relativeOffset: { x: T, y: 0, z: 0 },
    });

    // Joints: confirmat from sides to bottom
    joints.push(
      createJoint({
        a: { pieceId: leftPieceId, faceId: 'inner' },
        b: { pieceId: bottomPieceId, faceId: 'left-edge' },
        kind: 'confirmat',
      }),
      createJoint({
        a: { pieceId: rightPieceId, faceId: 'inner' },
        b: { pieceId: bottomPieceId, faceId: 'right-edge' },
        kind: 'confirmat',
      }),
    );
  } else {
    // bottom-over-lateral: Bottom panel runs full width
    const bottom = createPiece({
      id: bottomPieceId,
      role: 'bottom',
      materialId: carcassMaterialId,
      contour: createRectangularContour(width, depth),
      thicknessMm: T,
      structural: true,
    });

    const sideHeight = roofType === 'solid-panel' ? height - 2 * T : height - T;

    const sideLeft = createPiece({
      id: leftPieceId,
      role: 'side-left',
      materialId: carcassMaterialId,
      contour: createRectangularContour(depth, sideHeight),
      thicknessMm: T,
      structural: true,
    });

    const sideRight = createPiece({
      id: rightPieceId,
      role: 'side-right',
      materialId: carcassMaterialId,
      contour: createRectangularContour(depth, sideHeight),
      thicknessMm: T,
      structural: true,
    });

    if (edgeBandId) {
      applyFrontEdgeBand(sideLeft, edgeBandId);
      applyFrontEdgeBand(sideRight, edgeBandId);
      applyFrontEdgeBand(bottom, edgeBandId);
    }

    pieces.push(sideLeft, sideRight, bottom);

    placementNodes.push({
      pieceId: rightPieceId,
      parentPieceId: leftPieceId,
      relativeOffset: { x: width - T, y: 0, z: 0 },
    });
    placementNodes.push({
      pieceId: bottomPieceId,
      parentPieceId: leftPieceId,
      relativeOffset: { x: 0, y: -T, z: 0 },
    });

    // Joints: confirmat from bottom into side lower edges
    joints.push(
      createJoint({
        a: { pieceId: bottomPieceId, faceId: 'top' },
        b: { pieceId: leftPieceId, faceId: 'bottom-edge' },
        kind: 'confirmat',
      }),
      createJoint({
        a: { pieceId: bottomPieceId, faceId: 'top' },
        b: { pieceId: rightPieceId, faceId: 'bottom-edge' },
        kind: 'confirmat',
      }),
    );
  }

  // 2. Roof / Top / Rails
  const interiorWidth = width - 2 * T;
  const interiorY = T;

  if (roofType === 'solid-panel') {
    const isSolidFullWidth = jointPriority === 'bottom-over-lateral';
    const topWidth = isSolidFullWidth ? width : interiorWidth;
    const topX = isSolidFullWidth ? 0 : T;

    const roof = createPiece({
      id: topPieceId,
      role: 'top',
      materialId: carcassMaterialId,
      contour: createRectangularContour(topWidth, depth),
      thicknessMm: T,
      structural: true,
    });

    if (edgeBandId) applyFrontEdgeBand(roof, edgeBandId);
    pieces.push(roof);

    placementNodes.push({
      pieceId: topPieceId,
      parentPieceId: leftPieceId,
      relativeOffset: { x: topX, y: height - T, z: 0 },
    });

    joints.push(
      createJoint({
        a: { pieceId: leftPieceId, faceId: 'inner' },
        b: { pieceId: topPieceId, faceId: 'left-edge' },
        kind: 'confirmat',
      }),
      createJoint({
        a: { pieceId: rightPieceId, faceId: 'inner' },
        b: { pieceId: topPieceId, faceId: 'right-edge' },
        kind: 'confirmat',
      }),
    );
  } else if (roofType === 'front-back-rails') {
    topPieceId = `${idPrefix}-rail-front`;
    const railFrontId = topPieceId;
    const railBackId = `${idPrefix}-rail-back`;

    const railFront = createPiece({
      id: railFrontId,
      role: 'rail',
      materialId: carcassMaterialId,
      contour: createRectangularContour(interiorWidth, railWidthMm),
      thicknessMm: T,
      structural: true,
    });

    const railBack = createPiece({
      id: railBackId,
      role: 'rail',
      materialId: carcassMaterialId,
      contour: createRectangularContour(interiorWidth, railWidthMm),
      thicknessMm: T,
      structural: true,
    });

    if (edgeBandId) {
      applyFrontEdgeBand(railFront, edgeBandId);
    }

    pieces.push(railFront, railBack);

    placementNodes.push({
      pieceId: railFrontId,
      parentPieceId: leftPieceId,
      relativeOffset: { x: T, y: height - T, z: 0 },
    });
    placementNodes.push({
      pieceId: railBackId,
      parentPieceId: leftPieceId,
      relativeOffset: { x: T, y: height - T, z: depth - railWidthMm },
    });

    joints.push(
      createJoint({
        a: { pieceId: leftPieceId, faceId: 'inner' },
        b: { pieceId: railFrontId, faceId: 'left-edge' },
        kind: 'confirmat',
      }),
      createJoint({
        a: { pieceId: rightPieceId, faceId: 'inner' },
        b: { pieceId: railFrontId, faceId: 'right-edge' },
        kind: 'confirmat',
      }),
      createJoint({
        a: { pieceId: leftPieceId, faceId: 'inner' },
        b: { pieceId: railBackId, faceId: 'left-edge' },
        kind: 'confirmat',
      }),
      createJoint({
        a: { pieceId: rightPieceId, faceId: 'inner' },
        b: { pieceId: railBackId, faceId: 'right-edge' },
        kind: 'confirmat',
      }),
    );
  } else {
    // roofType === 'none'
    topPieceId = leftPieceId;
  }

  // 3. Interior Useful Cavity
  const interiorHeight =
    roofType === 'none' ? height - T : height - 2 * T;
  const interiorDepth = depth;

  const interior: InteriorBounds = {
    x: T,
    y: interiorY,
    z: 0,
    width: interiorWidth,
    height: interiorHeight,
    depth: interiorDepth,
  };

  // 4. Backing Panel (Fondos ranurados)
  if (hasBacking) {
    const backPieceId = `${idPrefix}-back`;
    const backWidth = interiorWidth + 2 * backingGrooveDepthMm;
    const backHeight = interiorHeight + 2 * backingGrooveDepthMm;

    const backPiece = createPiece({
      id: backPieceId,
      role: 'back',
      materialId: backingMaterialId ?? carcassMaterialId,
      contour: createRectangularContour(backWidth, backHeight),
      thicknessMm: backingThicknessMm,
      structural: false,
    });
    pieces.push(backPiece);

    const backZ = depth - backingGrooveDistanceMm - backingThicknessMm;
    placementNodes.push({
      pieceId: backPieceId,
      parentPieceId: leftPieceId,
      relativeOffset: {
        x: T - backingGrooveDepthMm,
        y: interiorY - backingGrooveDepthMm,
        z: backZ,
      },
    });

    joints.push(
      createJoint({
        a: { pieceId: leftPieceId, faceId: 'inner' },
        b: { pieceId: backPieceId, faceId: 'left-edge' },
        kind: 'groove',
      }),
      createJoint({
        a: { pieceId: rightPieceId, faceId: 'inner' },
        b: { pieceId: backPieceId, faceId: 'right-edge' },
        kind: 'groove',
      }),
      createJoint({
        a: { pieceId: bottomPieceId, faceId: 'inner' },
        b: { pieceId: backPieceId, faceId: 'bottom-edge' },
        kind: 'groove',
      }),
    );
  }

  return {
    pieces,
    joints,
    placementNodes,
    rootPieceId,
    interior,
    leftPieceId,
    rightPieceId,
    bottomPieceId,
    topPieceId,
  };
}

function applyFrontEdgeBand(piece: Piece, edgeBandId: string): void {
  const frontFace = piece.faces.find((f) => f.id === 'right-edge');
  if (frontFace) {
    frontFace.edgeBandId = edgeBandId;
  }
}
