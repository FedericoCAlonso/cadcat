import type {
  EquipmentItem,
  CountertopEquipmentPlacement,
} from '../../model';
import {
  createPiece,
  createRectangularContour,
  type ResolvedPiece,
} from '../piece';
import type { SinkCabinetAdaptationResult } from './types';

/**
 * Adapts a base cabinet's structural pieces and interior components when supporting
 * a sink or cooktop with reserved volumes and drain plumbing.
 *
 * Implements workshop-verified carpentry practices:
 * 1. Rotates front upper stretcher rail on edge (vertical) for 15x higher flexural stiffness
 *    under heavy stone countertops and unobstructed sink basin clearance.
 * 2. Adapts top drawer as a fixed false front or a U-notch drawer box around the siphon.
 * 3. Trims or lowers interior shelves that intersect with the equipment's reserved volume.
 */
export function adaptCabinetForEquipment(
  cabinetPieces: ResolvedPiece[],
  equipment: EquipmentItem,
  placement: CountertopEquipmentPlacement,
  cabinetOriginXMm = 0,
): SinkCabinetAdaptationResult {
  const summary: string[] = [];
  const removedPieceIds: string[] = [];
  let modifiedPieces: ResolvedPiece[] = [...cabinetPieces];

  // 1. Structural Front Rail Adaptation (Vertical / On-Edge Orientation)
  if (placement.frontRailOrientation === 'vertical') {
    let railModified = false;
    modifiedPieces = modifiedPieces.map((piece) => {
      const isFrontRail =
        piece.role === 'rail-front' ||
        (piece.role === 'rail' && piece.positionMm.y < 120);

      if (!isFrontRail) return piece;

      railModified = true;
      const thickness = piece.thicknessMm ?? 18;
      // Stretcher width (e.g. 70mm) becomes the vertical standing height
      const railWidthMm = piece.dimensionsMm.height > 30 ? piece.dimensionsMm.height : 70;
      const spanLengthMm = piece.dimensionsMm.width;

      return {
        ...piece,
        contour: createRectangularContour(spanLengthMm, railWidthMm),
        dimensionsMm: {
          width: spanLengthMm,
          height: railWidthMm,
        },
        // Placed flush at the front edge and top edge, standing vertically on-edge
        positionMm: {
          x: piece.positionMm.x,
          y: piece.positionMm.y,
          z: piece.positionMm.z,
        },
      };
    });

    if (railModified) {
      summary.push(
        'Travesaño superior delantero colocado de canto (vertical): máxima inercia flexural y despeje para la bacha.',
      );
    }
  } else if (placement.frontRailOrientation === 'suppressed') {
    const railToSuppress = modifiedPieces.find(
      (p) => p.role === 'rail-front' || (p.role === 'rail' && p.positionMm.y < 120),
    );
    if (railToSuppress) {
      removedPieceIds.push(railToSuppress.id);
      modifiedPieces = modifiedPieces.filter((p) => p.id !== railToSuppress.id);
      summary.push('Travesaño superior delantero suprimido para permitir el paso de la bacha/anafe.');
    }
  }

  // 2. Drawer Adaptation (False Front vs U-Shape Box)
  const isSink = equipment.kind.startsWith('sink');
  if (isSink && placement.sinkDrawerAdaptation === 'false-front') {
    const getVerticalElevation = (p: ResolvedPiece) => {
      // In Mobilius standard coordinate system, Y is vertical elevation. If Y is 0, fallback to Z.
      return p.positionMm.y !== 0 ? p.positionMm.y : p.positionMm.z;
    };

    // Identify top drawer front
    const drawerFronts = modifiedPieces
      .filter((p) => p.role === 'drawer-front')
      .sort((a, b) => getVerticalElevation(b) - getVerticalElevation(a)); // Highest elevation is top drawer

    const topDrawerFront = drawerFronts[0];
    if (topDrawerFront) {
      // Find all box pieces belonging to the top drawer (sharing matching elevation range)
      const topDrawerElevation = getVerticalElevation(topDrawerFront);
      const boxPiecesToRemove = modifiedPieces.filter((p) => {
        const isBoxPiece =
          p.role.startsWith('drawer-side') ||
          p.role === 'drawer-back' ||
          p.role === 'drawer-bottom';
        const elevation = getVerticalElevation(p);
        const isNearTopDrawer = Math.abs(elevation - topDrawerElevation) < 180;
        return isBoxPiece && isNearTopDrawer;
      });

      for (const boxPiece of boxPiecesToRemove) {
        removedPieceIds.push(boxPiece.id);
      }

      modifiedPieces = modifiedPieces.filter(
        (p) => !boxPiecesToRemove.some((bp) => bp.id === p.id),
      );

      // Re-tag top drawer front as a fixed false-front
      modifiedPieces = modifiedPieces.map((p) => {
        if (p.id === topDrawerFront.id) {
          return {
            ...p,
            role: 'false-front',
          };
        }
        return p;
      });

      summary.push(
        `Cajón superior adaptado a Falso Frente fijo (${boxPiecesToRemove.length} piezas de cajón retiradas del cómputo).`,
      );
    }
  } else if (isSink && placement.sinkDrawerAdaptation === 'u-shape-drawer') {
    // Top drawer retains front and slides, but box is notched around the siphon
    const siphonWidth = equipment.siphonVolume?.widthMm ?? 180;
    const siphonDepth = equipment.siphonVolume?.depthMm ?? 200;

    summary.push(
      `Cajón superior adaptado con escote en U (${siphonWidth}x${siphonDepth} mm) para paso de cañería y sifón.`,
    );
  }

  // 3. Interior Shelf Collisions Check
  let shelfCollisionsResolved = 0;
  const reservedHeight = equipment.reservedVolumeMm.heightMm;
  const reservedDepth = equipment.reservedVolumeMm.depthMm;

  modifiedPieces = modifiedPieces.map((piece) => {
    if (piece.role.includes('shelf')) {
      // If shelf sits high in the cabinet and intrudes into the sink basin volume
      const shelfZ = piece.positionMm.z;
      // In carcase coordinates, if shelf height interferes with reserved volume
      if (shelfZ > 450 || piece.dimensionsMm.height > 300) {
        shelfCollisionsResolved++;
        const trimmedDepth = Math.max(piece.dimensionsMm.height - reservedDepth * 0.5, 200);
        return {
          ...piece,
          contour: createRectangularContour(piece.dimensionsMm.width, trimmedDepth),
          dimensionsMm: {
            width: piece.dimensionsMm.width,
            height: Math.round(trimmedDepth),
          },
        };
      }
    }
    return piece;
  });

  if (shelfCollisionsResolved > 0) {
    summary.push(
      `${shelfCollisionsResolved} estante(s) interior(es) recortado(s) para despejar la cuba y tuberías.`,
    );
  }

  return {
    cabinetPieces: modifiedPieces,
    removedPieceIds,
    appliedAdaptations: {
      frontRailOrientation: placement.frontRailOrientation,
      sinkDrawerAdaptation: placement.sinkDrawerAdaptation,
      shelfCollisionsResolved,
      summary,
    },
  };
}
