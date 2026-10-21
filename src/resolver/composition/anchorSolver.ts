import { type Piece, type Joint, type InterferenceConfig, type SecondaryCut } from '../../model';
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
  interferences?: InterferenceConfig;
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
  interferences?: InterferenceConfig;
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
    railOrientation = 'horizontal',
    hasMiddleBrace = false,
    middleBraceWidthMm = 80,
    hasWallHangingRail = false,
    wallHangingRailWidthMm = 100,
    hasPlinth = false,
    plinthHeightMm = 100,
    plinthSetbackMm = 50,
    hasBacking: rawHasBacking = true,
    backingType = 'groove',
    backingGrooveDistanceMm = 15,
    backingGrooveDepthMm = 8,
    isIslandCabinet = false,
    rearStructuralRails = 'none',
    rearStructuralRailsWidthMm = 80,
  } = carcass;

  const hasBacking = isIslandCabinet ? false : rawHasBacking;

  const pieces: Piece[] = [];
  const joints: Joint[] = [];
  const placementNodes: PlacementNode[] = [];

  const leftPieceId = `${idPrefix}-side-left`;
  const rightPieceId = `${idPrefix}-side-right`;
  const bottomPieceId = `${idPrefix}-bottom`;
  let topPieceId = `${idPrefix}-roof`;

  const rootPieceId = leftPieceId;
  const plinthY = hasPlinth ? plinthHeightMm : 0;

  const obstacle = input.interferences?.columnObstacle?.enabled ? input.interferences.columnObstacle : undefined;
  const column = obstacle; // backward-compatibility alias
  const falseSquare = input.interferences?.falseSquare?.enabled ? input.interferences.falseSquare : undefined;

  const isBeam = obstacle?.type === 'horizontal-beam';
  const obstRefEdge = obstacle?.referenceEdge ?? (obstacle?.corner === 'back-right' ? 'right' : 'left');
  const obstDist = obstacle?.distanceFromReferenceMm ?? 0;
  const obstD = obstacle?.depthMm ?? 0;
  const obstH = obstacle?.heightMm ?? (isBeam ? 150 : height);
  const obstW = obstacle?.widthMm ?? (isBeam ? width : 150);

  // Compute obstacle bounding box in carcass coordinates [0, width] x [0, height] x [0, depth]
  let obstX0 = 0;
  let obstX1 = width;
  let obstY0 = 0;
  let obstY1 = height;

  if (obstacle) {
    if (isBeam) {
      if (obstacle.widthMm && obstacle.widthMm > 0 && obstacle.widthMm < width) {
        if (obstRefEdge === 'left') {
          obstX0 = obstDist;
          obstX1 = Math.min(width, obstDist + obstacle.widthMm);
        } else if (obstRefEdge === 'right') {
          obstX1 = Math.max(0, width - obstDist);
          obstX0 = Math.max(0, width - obstDist - obstacle.widthMm);
        } else {
          obstX0 = 0;
          obstX1 = obstacle.widthMm;
        }
      } else {
        obstX0 = 0;
        obstX1 = width;
      }

      if (obstRefEdge === 'top') {
        obstY1 = Math.max(0, height - obstDist);
        obstY0 = Math.max(0, height - obstDist - obstH);
      } else {
        obstY0 = obstDist;
        obstY1 = Math.min(height, obstDist + obstH);
      }
    } else {
      // vertical column
      if (obstRefEdge === 'right' || obstacle.corner === 'back-right') {
        obstX1 = Math.max(0, width - obstDist);
        obstX0 = Math.max(0, width - obstDist - obstW);
      } else {
        obstX0 = obstDist;
        obstX1 = Math.min(width, obstDist + obstW);
      }
      obstY0 = 0;
      obstY1 = obstacle.heightMm ?? height;
    }
  }

  let leftSideDepth = depth;
  let rightSideDepth = depth;

  if (falseSquare) {
    leftSideDepth = falseSquare.leftDepthMm;
    rightSideDepth = falseSquare.rightDepthMm;
  } else if (obstacle && !isBeam) {
    if (obstX0 <= T) {
      leftSideDepth = Math.max(50, depth - obstD);
    }
    if (obstX1 >= width - T) {
      rightSideDepth = Math.max(50, depth - obstD);
    }
  }

  const minCarcassDepth = Math.min(leftSideDepth, rightSideDepth);

  // Helper to build horizontal panel (bottom / roof) contour with obstacles
  function createHorizontalPanelContour(panelWidth: number, panelXOffset: number = T, panelY: number = 0) {
    if (falseSquare) {
      return {
        contour: {
          points: [
            { x: 0, y: 0 },
            { x: panelWidth, y: 0 },
            { x: panelWidth, y: rightSideDepth },
            { x: 0, y: leftSideDepth },
          ],
        },
        rawBoundingBox: { widthMm: panelWidth, heightMm: Math.max(leftSideDepth, rightSideDepth) },
        secondaryCuts: [
          {
            type: 'bevel-diagonal' as const,
            description: `Corte en falsa escuadra: chaflán trasero de ${leftSideDepth} mm a ${rightSideDepth} mm`,
            angleDeg: Math.round(Math.atan2(Math.abs(rightSideDepth - leftSideDepth), panelWidth) * (180 / Math.PI) * 10) / 10,
          },
        ],
      };
    }

    if (obstacle) {
      const panelY1 = panelY + T;
      const overlapsY = obstY0 < panelY1 && obstY1 > panelY;

      if (overlapsY) {
        const x_0 = Math.max(0, obstX0 - panelXOffset);
        const x_1 = Math.min(panelWidth, obstX1 - panelXOffset);

        if (x_1 > x_0) {
          const innerD = Math.max(20, depth - obstD);
          const notchW = Math.round(x_1 - x_0);

          if (x_0 <= 0 && x_1 >= panelWidth) {
            // Full rear deduction (e.g. beam across full cabinet)
            return {
              contour: createRectangularContour(panelWidth, innerD),
              rawBoundingBox: { widthMm: panelWidth, heightMm: depth },
              secondaryCuts: [
                {
                  type: 'notch' as const,
                  description: `Profundidad reducida por interferencia trasera: ${panelWidth} x ${obstD} mm`,
                  depthMm: obstD,
                },
              ],
            };
          }

          if (x_0 <= 0 && x_1 < panelWidth) {
            // Corner notch back-left
            const cutW = Math.round(x_1);
            return {
              contour: {
                points: [
                  { x: 0, y: 0 },
                  { x: panelWidth, y: 0 },
                  { x: panelWidth, y: depth },
                  { x: cutW, y: depth },
                  { x: cutW, y: innerD },
                  { x: 0, y: innerD },
                ],
              },
              rawBoundingBox: { widthMm: panelWidth, heightMm: depth },
              secondaryCuts: [
                {
                  type: 'notch' as const,
                  corner: 'back-left' as const,
                  widthMm: cutW,
                  depthMm: obstD,
                  description: `Destaje para columna trasera izquierda: ${cutW} x ${obstD} mm`,
                },
              ],
            };
          }

          if (x_0 > 0 && x_1 >= panelWidth) {
            // Corner notch back-right
            const cutW = Math.round(panelWidth - x_0);
            return {
              contour: {
                points: [
                  { x: 0, y: 0 },
                  { x: panelWidth, y: 0 },
                  { x: panelWidth, y: innerD },
                  { x: x_0, y: innerD },
                  { x: x_0, y: depth },
                  { x: 0, y: depth },
                ],
              },
              rawBoundingBox: { widthMm: panelWidth, heightMm: depth },
              secondaryCuts: [
                {
                  type: 'notch' as const,
                  corner: 'back-right' as const,
                  widthMm: cutW,
                  depthMm: obstD,
                  description: `Destaje para columna trasera derecha: ${cutW} x ${obstD} mm`,
                },
              ],
            };
          }

          if (x_0 > 0 && x_1 < panelWidth) {
            // Intermediate rear U-cutout (cajeado interior)
            return {
              contour: {
                points: [
                  { x: 0, y: 0 },
                  { x: panelWidth, y: 0 },
                  { x: panelWidth, y: depth },
                  { x: x_1, y: depth },
                  { x: x_1, y: innerD },
                  { x: x_0, y: innerD },
                  { x: x_0, y: depth },
                  { x: 0, y: depth },
                ],
              },
              rawBoundingBox: { widthMm: panelWidth, heightMm: depth },
              secondaryCuts: [
                {
                  type: 'notch' as const,
                  corner: 'intermediate-rear' as const,
                  widthMm: notchW,
                  depthMm: obstD,
                  description: `Cajeado interior para columna a ${Math.round(x_0)} mm del lateral: ${notchW} x ${obstD} mm`,
                },
              ],
            };
          }
        }
      }
    }

    return {
      contour: createRectangularContour(panelWidth, depth),
      rawBoundingBox: undefined,
      secondaryCuts: undefined,
    };
  }

  function createSidePieceContour(sideRole: 'side-left' | 'side-right', sideH: number) {
    const isLeft = sideRole === 'side-left';
    const sideNominalDepth = isLeft ? leftSideDepth : rightSideDepth;
    const isTouched = isLeft ? (obstX0 <= T) : (obstX1 >= width - T);

    if (obstacle && isBeam && isTouched) {
      if (obstRefEdge === 'top') {
        const yStep = Math.max(0, sideH - obstH);
        const xStep = Math.max(0, depth - obstD);
        return {
          contour: {
            points: [
              { x: 0, y: 0 },
              { x: depth, y: 0 },
              { x: depth, y: yStep },
              { x: xStep, y: yStep },
              { x: xStep, y: sideH },
              { x: 0, y: sideH },
            ],
          },
          rawBoundingBox: { widthMm: depth, heightMm: sideH },
          secondaryCuts: [
            {
              type: 'notch' as const,
              corner: 'top-rear' as const,
              widthMm: obstD,
              depthMm: obstH,
              description: `Destaje en lateral para viga superior: prof ${obstD} mm x alto ${obstH} mm`,
            },
          ],
        };
      } else {
        // 'bottom'
        const yStep = obstH;
        const xStep = Math.max(0, depth - obstD);
        return {
          contour: {
            points: [
              { x: 0, y: 0 },
              { x: xStep, y: 0 },
              { x: xStep, y: yStep },
              { x: depth, y: yStep },
              { x: depth, y: sideH },
              { x: 0, y: sideH },
            ],
          },
          rawBoundingBox: { widthMm: depth, heightMm: sideH },
          secondaryCuts: [
            {
              type: 'notch' as const,
              corner: 'bottom-rear' as const,
              widthMm: obstD,
              depthMm: obstH,
              description: `Destaje en lateral para escalón inferior: prof ${obstD} mm x alto ${obstH} mm`,
            },
          ],
        };
      }
    }

    // Vertical column or false square or normal
    let secondaryCuts: SecondaryCut[] | undefined = undefined;
    if (obstacle && !isBeam && isTouched) {
      secondaryCuts = [
        {
          type: 'notch',
          corner: isLeft ? 'back-left' : 'back-right',
          widthMm: obstD,
          depthMm: 0,
          description: `Lateral acortado por columna: ${sideNominalDepth} mm (reducido ${obstD} mm)`,
        },
      ];
    }

    return {
      contour: createRectangularContour(sideNominalDepth, sideH),
      rawBoundingBox: undefined,
      secondaryCuts,
    };
  }

  // 1. Carcass Sides and Bottom
  if (jointPriority === 'lateral-over-bottom' || jointPriority === 'miter-45') {
    // Left & Right sides run full height
    const leftSideRes = createSidePieceContour('side-left', height);
    const rightSideRes = createSidePieceContour('side-right', height);

    const sideLeft = createPiece({
      id: leftPieceId,
      role: 'side-left',
      materialId: carcassMaterialId,
      contour: leftSideRes.contour,
      thicknessMm: T,
      structural: true,
      rawBoundingBox: leftSideRes.rawBoundingBox,
      secondaryCuts: leftSideRes.secondaryCuts,
    });

    const sideRight = createPiece({
      id: rightPieceId,
      role: 'side-right',
      materialId: carcassMaterialId,
      contour: rightSideRes.contour,
      thicknessMm: T,
      structural: true,
      rawBoundingBox: rightSideRes.rawBoundingBox,
      secondaryCuts: rightSideRes.secondaryCuts,
    });

    // Bottom panel fits between sides
    const bottomWidth = width - 2 * T;
    const bottomContourRes = createHorizontalPanelContour(bottomWidth, T, plinthY);

    const bottom = createPiece({
      id: bottomPieceId,
      role: 'bottom',
      materialId: carcassMaterialId,
      contour: bottomContourRes.contour,
      thicknessMm: T,
      structural: true,
      rawBoundingBox: bottomContourRes.rawBoundingBox,
      secondaryCuts: bottomContourRes.secondaryCuts,
    });

    if (edgeBandId) {
      applyFrontEdgeBand(sideLeft, edgeBandId);
      applyFrontEdgeBand(sideRight, edgeBandId);
      applyFrontEdgeBand(bottom, edgeBandId);
      if (isIslandCabinet) {
        applyRearEdgeBand(sideLeft, edgeBandId);
        applyRearEdgeBand(sideRight, edgeBandId);
        applyRearEdgeBand(bottom, edgeBandId);
      }
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
      relativeOffset: { x: T, y: plinthY, z: 0 },
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
    const bottomContourRes = createHorizontalPanelContour(width, 0, plinthY);
    const bottom = createPiece({
      id: bottomPieceId,
      role: 'bottom',
      materialId: carcassMaterialId,
      contour: bottomContourRes.contour,
      thicknessMm: T,
      structural: true,
      rawBoundingBox: bottomContourRes.rawBoundingBox,
      secondaryCuts: bottomContourRes.secondaryCuts,
    });

    const sideHeight = (roofType === 'solid-panel' ? height - 2 * T : height - T) - plinthY;
    const leftSideRes = createSidePieceContour('side-left', sideHeight);
    const rightSideRes = createSidePieceContour('side-right', sideHeight);

    const sideLeft = createPiece({
      id: leftPieceId,
      role: 'side-left',
      materialId: carcassMaterialId,
      contour: leftSideRes.contour,
      thicknessMm: T,
      structural: true,
      rawBoundingBox: leftSideRes.rawBoundingBox,
      secondaryCuts: leftSideRes.secondaryCuts,
    });

    const sideRight = createPiece({
      id: rightPieceId,
      role: 'side-right',
      materialId: carcassMaterialId,
      contour: rightSideRes.contour,
      thicknessMm: T,
      structural: true,
      rawBoundingBox: rightSideRes.rawBoundingBox,
      secondaryCuts: rightSideRes.secondaryCuts,
    });

    if (edgeBandId) {
      applyFrontEdgeBand(sideLeft, edgeBandId);
      applyFrontEdgeBand(sideRight, edgeBandId);
      applyFrontEdgeBand(bottom, edgeBandId);
      if (isIslandCabinet) {
        applyRearEdgeBand(sideLeft, edgeBandId);
        applyRearEdgeBand(sideRight, edgeBandId);
        applyRearEdgeBand(bottom, edgeBandId);
      }
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
      relativeOffset: { x: 0, y: plinthY > 0 ? plinthY : -T, z: 0 },
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

  // 1.1 Plinth / Zócalo front panel (if enabled)
  if (hasPlinth) {
    const plinthPieceId = `${idPrefix}-plinth-front`;
    const plinthWidth = jointPriority === 'lateral-over-bottom' ? width - 2 * T : width;
    const plinthX = jointPriority === 'lateral-over-bottom' ? T : 0;

    const plinthPiece = createPiece({
      id: plinthPieceId,
      role: 'plinth-front',
      materialId: carcassMaterialId,
      contour: createRectangularContour(plinthWidth, plinthHeightMm),
      thicknessMm: T,
      structural: true,
    });

    if (edgeBandId) {
      applyFrontEdgeBand(plinthPiece, edgeBandId);
    }

    pieces.push(plinthPiece);

    placementNodes.push({
      pieceId: plinthPieceId,
      parentPieceId: leftPieceId,
      relativeOffset: { x: plinthX, y: 0, z: plinthSetbackMm },
    });

    joints.push(
      createJoint({
        a: { pieceId: leftPieceId, faceId: 'inner' },
        b: { pieceId: plinthPieceId, faceId: 'left-edge' },
        kind: 'confirmat',
      }),
      createJoint({
        a: { pieceId: rightPieceId, faceId: 'inner' },
        b: { pieceId: plinthPieceId, faceId: 'right-edge' },
        kind: 'confirmat',
      }),
    );
  }

  // 2. Roof / Top / Rails
  const isBottomPass = jointPriority === 'bottom-over-lateral';
  const interiorWidth = width - 2 * T;
  const interiorY = (isBottomPass ? 0 : T) + plinthY;

  if (roofType === 'solid-panel') {
    const isSolidFullWidth = isBottomPass;
    const topWidth = isSolidFullWidth ? width : interiorWidth;
    const topX = isSolidFullWidth ? 0 : T;
    const topY = isBottomPass ? height - 2 * T : height - T;

    const roofContourRes = createHorizontalPanelContour(topWidth, topX, topY);
    const roof = createPiece({
      id: topPieceId,
      role: 'top',
      materialId: carcassMaterialId,
      contour: roofContourRes.contour,
      thicknessMm: T,
      structural: true,
      rawBoundingBox: roofContourRes.rawBoundingBox,
      secondaryCuts: roofContourRes.secondaryCuts,
    });

    if (edgeBandId) {
      applyFrontEdgeBand(roof, edgeBandId);
      if (isIslandCabinet) {
        applyRearEdgeBand(roof, edgeBandId);
      }
    }
    pieces.push(roof);

    placementNodes.push({
      pieceId: topPieceId,
      parentPieceId: leftPieceId,
      relativeOffset: { x: topX, y: topY, z: 0 },
    });

    if (isBottomPass) {
      joints.push(
        createJoint({
          a: { pieceId: topPieceId, faceId: 'bottom' },
          b: { pieceId: leftPieceId, faceId: 'top-edge' },
          kind: 'confirmat',
        }),
        createJoint({
          a: { pieceId: topPieceId, faceId: 'bottom' },
          b: { pieceId: rightPieceId, faceId: 'top-edge' },
          kind: 'confirmat',
        }),
      );
    } else {
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
    }
  } else if (roofType === 'front-back-rails') {
    topPieceId = `${idPrefix}-rail-front`;
    const railFrontId = topPieceId;
    const railBackId = `${idPrefix}-rail-back`;
    const railY = isBottomPass ? height - 2 * T : height - T;
    const isVertical = railOrientation === 'vertical';

    const railFront = createPiece({
      id: railFrontId,
      role: isVertical ? 'rail-vertical' : 'rail',
      materialId: carcassMaterialId,
      contour: createRectangularContour(interiorWidth, railWidthMm),
      thicknessMm: T,
      structural: true,
    });

    const notchW = obstacle ? Math.min(interiorWidth - 40, Math.max(20, (obstacle.widthMm ?? 150) - T)) : 0;
    const backRailWidth = column ? Math.max(100, interiorWidth - notchW) : interiorWidth;
    const backRailX = column && column.corner === 'back-left' ? T + notchW : T;
    const backRailZ = falseSquare
      ? (isVertical ? minCarcassDepth - T : minCarcassDepth - railWidthMm)
      : (isVertical ? depth - T : depth - railWidthMm);

    const railBack = createPiece({
      id: railBackId,
      role: isVertical ? 'rail-vertical' : 'rail',
      materialId: carcassMaterialId,
      contour: createRectangularContour(backRailWidth, railWidthMm),
      thicknessMm: T,
      structural: true,
    });

    if (edgeBandId) {
      applyFrontEdgeBand(railFront, edgeBandId);
    }

    pieces.push(railFront, railBack);

    const vertRailY = railY + T - railWidthMm;

    placementNodes.push({
      pieceId: railFrontId,
      parentPieceId: leftPieceId,
      relativeOffset: {
        x: T,
        y: isVertical ? vertRailY : railY,
        z: 0,
      },
    });
    placementNodes.push({
      pieceId: railBackId,
      parentPieceId: leftPieceId,
      relativeOffset: {
        x: backRailX,
        y: isVertical ? vertRailY : railY,
        z: backRailZ,
      },
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

    // 2.1 Middle structural brace between rails (if enabled)
    if (hasMiddleBrace) {
      const middleBraceId = `${idPrefix}-brace-middle`;
      const braceLength = depth - (isVertical ? 2 * T : 2 * railWidthMm);

      const middleBrace = createPiece({
        id: middleBraceId,
        role: 'brace-middle',
        materialId: carcassMaterialId,
        contour: createRectangularContour(braceLength, middleBraceWidthMm),
        thicknessMm: T,
        structural: true,
      });

      pieces.push(middleBrace);

      const braceX = T + (interiorWidth - middleBraceWidthMm) / 2;
      const braceZ = isVertical ? T : railWidthMm;

      placementNodes.push({
        pieceId: middleBraceId,
        parentPieceId: leftPieceId,
        relativeOffset: { x: braceX, y: railY, z: braceZ },
      });

      joints.push(
        createJoint({
          a: { pieceId: railFrontId, faceId: 'inner' },
          b: { pieceId: middleBraceId, faceId: 'front-edge' },
          kind: 'confirmat',
        }),
        createJoint({
          a: { pieceId: railBackId, faceId: 'inner' },
          b: { pieceId: middleBraceId, faceId: 'back-edge' },
          kind: 'confirmat',
        }),
      );
    }
  } else {
    // roofType === 'none'
    topPieceId = leftPieceId;
  }

  // 2.2 Rear Wall Hanging Rail (if enabled)
  const isVerticalRail = roofType === 'front-back-rails' && railOrientation === 'vertical';
  const topObstructionMm = isVerticalRail ? railWidthMm : (roofType === 'none' ? 0 : T);
  const interiorHeight = height - T - plinthY - topObstructionMm;
  const interiorDepth = depth;

  if (hasWallHangingRail) {
    const hangingRailId = `${idPrefix}-hanging-rail`;
    const hangingRail = createPiece({
      id: hangingRailId,
      role: 'hanging-rail',
      materialId: carcassMaterialId,
      contour: createRectangularContour(interiorWidth, wallHangingRailWidthMm),
      thicknessMm: T,
      structural: true,
    });

    pieces.push(hangingRail);

    const hangingY = interiorY + interiorHeight - wallHangingRailWidthMm;
    const hangingZ = depth - T;

    placementNodes.push({
      pieceId: hangingRailId,
      parentPieceId: leftPieceId,
      relativeOffset: { x: T, y: hangingY, z: hangingZ },
    });

    joints.push(
      createJoint({
        a: { pieceId: leftPieceId, faceId: 'inner' },
        b: { pieceId: hangingRailId, faceId: 'left-edge' },
        kind: 'confirmat',
      }),
      createJoint({
        a: { pieceId: rightPieceId, faceId: 'inner' },
        b: { pieceId: hangingRailId, faceId: 'right-edge' },
        kind: 'confirmat',
      }),
    );
  }

  // 3. Interior Useful Cavity
  const interior: InteriorBounds = {
    x: T,
    y: interiorY,
    z: 0,
    width: interiorWidth,
    height: Math.max(50, interiorHeight),
    depth: interiorDepth,
  };

  // 4. Backing Panel (Smart: Thin grooved/overlay vs Thick structural confirmat)
  if (hasBacking) {
    const backPieceId = `${idPrefix}-back`;
    const isThickBack = backingThicknessMm >= 15 && backingType !== 'overlay';

    if (isThickBack) {
      // Point 5: Thick structural backing (15mm - 18mm)
      // Confirmat screws from sides & bottom into backing edges for structural rigidity
      const backWidth = interiorWidth;
      const backHeight = interiorHeight;

      const backPiece = createPiece({
        id: backPieceId,
        role: 'back',
        materialId: backingMaterialId ?? carcassMaterialId,
        contour: createRectangularContour(backWidth, backHeight),
        thicknessMm: backingThicknessMm,
        structural: true,
      });
      pieces.push(backPiece);

      const backZ = depth - backingThicknessMm;
      placementNodes.push({
        pieceId: backPieceId,
        parentPieceId: leftPieceId,
        relativeOffset: {
          x: T,
          y: interiorY,
          z: backZ,
        },
      });

      joints.push(
        createJoint({
          a: { pieceId: leftPieceId, faceId: 'inner' },
          b: { pieceId: backPieceId, faceId: 'left-edge' },
          kind: 'confirmat',
        }),
        createJoint({
          a: { pieceId: rightPieceId, faceId: 'inner' },
          b: { pieceId: backPieceId, faceId: 'right-edge' },
          kind: 'confirmat',
        }),
        createJoint({
          a: { pieceId: bottomPieceId, faceId: isBottomPass ? 'top' : 'inner' },
          b: { pieceId: backPieceId, faceId: 'bottom-edge' },
          kind: 'confirmat',
        }),
      );

      if (roofType === 'solid-panel') {
        joints.push(
          createJoint({
            a: { pieceId: topPieceId, faceId: 'bottom' },
            b: { pieceId: backPieceId, faceId: 'top-edge' },
            kind: 'confirmat',
          }),
        );
      }
    } else if (backingType === 'overlay') {
      // Point 5: Thin overlay backing (3mm tacked/screwed onto rear cantos: lateral, top, and bottom)
      const backWidth = width;
      const backHeight = height - plinthY;

      const backPiece = createPiece({
        id: backPieceId,
        role: 'back',
        materialId: backingMaterialId ?? carcassMaterialId,
        contour: createRectangularContour(backWidth, backHeight),
        thicknessMm: backingThicknessMm,
        structural: false,
      });
      pieces.push(backPiece);

      placementNodes.push({
        pieceId: backPieceId,
        parentPieceId: leftPieceId,
        relativeOffset: {
          x: 0,
          y: plinthY,
          z: depth,
        },
      });

      joints.push(
        createJoint({
          a: { pieceId: leftPieceId, faceId: 'rear-edge' },
          b: { pieceId: backPieceId, faceId: 'inner' },
          kind: 'screw',
        }),
        createJoint({
          a: { pieceId: rightPieceId, faceId: 'rear-edge' },
          b: { pieceId: backPieceId, faceId: 'inner' },
          kind: 'screw',
        }),
        createJoint({
          a: { pieceId: bottomPieceId, faceId: 'rear-edge' },
          b: { pieceId: backPieceId, faceId: 'inner' },
          kind: 'screw',
        }),
      );

      if (roofType === 'solid-panel') {
        joints.push(
          createJoint({
            a: { pieceId: topPieceId, faceId: 'rear-edge' },
            b: { pieceId: backPieceId, faceId: 'inner' },
            kind: 'screw',
          }),
        );
      } else if (roofType === 'front-back-rails') {
        joints.push(
          createJoint({
            a: { pieceId: `${idPrefix}-rail-back`, faceId: 'rear-edge' },
            b: { pieceId: backPieceId, faceId: 'inner' },
            kind: 'screw',
          }),
        );
      }
    } else {
      // Point 5: Thin grooved backing (default 3mm/5.5mm sliding into perimeter grooves)
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
          a: { pieceId: bottomPieceId, faceId: isBottomPass ? 'top' : 'inner' },
          b: { pieceId: backPieceId, faceId: 'bottom-edge' },
          kind: 'groove',
        }),
      );

      if (roofType === 'solid-panel') {
        joints.push(
          createJoint({
            a: { pieceId: topPieceId, faceId: 'bottom' },
            b: { pieceId: backPieceId, faceId: 'top-edge' },
            kind: 'groove',
          }),
        );
      } else if (roofType === 'front-back-rails') {
        joints.push(
          createJoint({
            a: { pieceId: `${idPrefix}-rail-back`, faceId: 'inner' },
            b: { pieceId: backPieceId, faceId: 'top-edge' },
            kind: 'groove',
          }),
        );
      }
    }
  }

  // Point 6: Rear structural rails / stretchers (tirantes estructurales traseros)
  if (rearStructuralRails === 'top-and-bottom' || rearStructuralRails === 'top-only') {
    const rearRailTopId = `${idPrefix}-rear-rail-top`;
    const rearRailTop = createPiece({
      id: rearRailTopId,
      role: 'rail-vertical',
      materialId: carcassMaterialId,
      contour: createRectangularContour(interiorWidth, rearStructuralRailsWidthMm),
      thicknessMm: T,
      structural: true,
    });
    pieces.push(rearRailTop);

    const topRailY = interiorY + interiorHeight - rearStructuralRailsWidthMm;
    placementNodes.push({
      pieceId: rearRailTopId,
      parentPieceId: leftPieceId,
      relativeOffset: {
        x: T,
        y: topRailY,
        z: depth - T,
      },
    });

    joints.push(
      createJoint({
        a: { pieceId: leftPieceId, faceId: 'inner' },
        b: { pieceId: rearRailTopId, faceId: 'left-edge' },
        kind: 'confirmat',
      }),
      createJoint({
        a: { pieceId: rightPieceId, faceId: 'inner' },
        b: { pieceId: rearRailTopId, faceId: 'right-edge' },
        kind: 'confirmat',
      }),
    );

    if (rearStructuralRails === 'top-and-bottom') {
      const rearRailBottomId = `${idPrefix}-rear-rail-bottom`;
      const rearRailBottom = createPiece({
        id: rearRailBottomId,
        role: 'rail-vertical',
        materialId: carcassMaterialId,
        contour: createRectangularContour(interiorWidth, rearStructuralRailsWidthMm),
        thicknessMm: T,
        structural: true,
      });
      pieces.push(rearRailBottom);

      placementNodes.push({
        pieceId: rearRailBottomId,
        parentPieceId: leftPieceId,
        relativeOffset: {
          x: T,
          y: interiorY,
          z: depth - T,
        },
      });

      joints.push(
        createJoint({
          a: { pieceId: leftPieceId, faceId: 'inner' },
          b: { pieceId: rearRailBottomId, faceId: 'left-edge' },
          kind: 'confirmat',
        }),
        createJoint({
          a: { pieceId: rightPieceId, faceId: 'inner' },
          b: { pieceId: rearRailBottomId, faceId: 'right-edge' },
          kind: 'confirmat',
        }),
      );
    }
  }

  // 6. Column cover piece (tapa de columna interior)
  if (obstacle && !isBeam) {
    const coverId = `${idPrefix}-column-cover`;
    const colWidth = obstacle.widthMm ?? 150;
    const notchW = Math.min(interiorWidth - 40, Math.max(20, colWidth - (obstX0 <= T ? T : 0)));
    const coverPiece = createPiece({
      id: coverId,
      role: 'column-cover-side',
      materialId: carcassMaterialId,
      contour: createRectangularContour(obstD, interiorHeight),
      thicknessMm: T,
      structural: false,
    });
    pieces.push(coverPiece);

    let coverX = obstX1;
    if (obstX0 <= T) {
      coverX = T + notchW;
    } else if (obstX1 >= width - T) {
      coverX = width - T - notchW;
    } else {
      coverX = obstX1;
    }

    placementNodes.push({
      pieceId: coverId,
      parentPieceId: leftPieceId,
      relativeOffset: {
        x: coverX,
        y: interiorY,
        z: depth - obstD,
      },
    });
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
    interferences: input.interferences,
  };
}

function applyFrontEdgeBand(piece: Piece, edgeBandId: string): void {
  const frontFace = piece.faces.find((f) => f.id === 'right-edge');
  if (frontFace) {
    frontFace.edgeBandId = edgeBandId;
  }
}

function applyRearEdgeBand(piece: Piece, edgeBandId: string): void {
  const isVertical = piece.role.includes('side') || piece.role.includes('partition');
  const targetFaceId = isVertical ? 'left-edge' : 'bottom-edge';
  const rearFace = piece.faces.find((f) => f.id === targetFaceId) ?? piece.faces.find((f) => f.id === 'left-edge');
  if (rearFace) {
    rearFace.edgeBandId = edgeBandId;
  }
}
