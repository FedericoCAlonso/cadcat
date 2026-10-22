import { type Piece, type Joint, type SubAssembly } from '../../../model';
import { type PlacementNode } from '../../tree';
import { subdivideBay } from '../gridSolver';
import {
  type IBayContentResolver,
  type BayResolutionContext,
  type ComponentSolverResult,
} from './types';
import { type BayContentSubdivided } from '../types';

/**
 * Resolver for subdivided interior bays (SRP, OCP, LSP).
 * Subdivides a parent bay volume horizontally (into zones/shelves) or vertically (into cubbies/tabiques),
 * supporting thin partition boards (6mm/9mm Guatambú plywood) with dado-groove joints or structural 18mm boards,
 * and recursively resolves the content of each resulting child bay cell.
 */
export class SubdividedBayResolver implements IBayContentResolver<BayContentSubdivided> {
  public readonly type = 'subdivided' as const;

  public resolve(context: BayResolutionContext<BayContentSubdivided>): ComponentSolverResult {
    const { bay, content, materials, options, registry } = context;
    const {
      carcassThicknessMm: T,
      edgeBandId,
      idPrefix = `bay-${bay.bayIndex}`,
    } = options;

    const pieces: Piece[] = [];
    const joints: Joint[] = [];
    const placementNodes: PlacementNode[] = [];
    const subAssemblies: SubAssembly[] = [];

    const {
      axis,
      tracks,
      bays: subBays = [],
      dividerThicknessMm,
      dividerMaterialId,
      jointType,
      dividerSetbackMm = 0,
    } = content;

    if (!tracks || tracks.length === 0) {
      return { pieces, joints, placementNodes, subAssemblies };
    }

    // Determine thickness, joint type, and material
    const isDado = jointType === 'dado-groove' || (!jointType && (dividerThicknessMm ? dividerThicknessMm <= 9 : true));
    const effectiveDividerT = dividerThicknessMm ?? (isDado ? 6 : T);
    const effectiveJointKind = isDado ? 'groove' : 'confirmat';
    const isStructural = !isDado;

    let defaultMat = materials.carcassMaterialId;
    if (isDado) {
      defaultMat = effectiveDividerT <= 6 ? 'mat-plywood-guatambu-6' : 'mat-plywood-guatambu-9';
    }
    const effectiveDividerMat = dividerMaterialId ?? defaultMat;

    // Subdivide the bay bounding box into child cells and divider pieces
    const subResult = subdivideBay(
      bay,
      {
        axis,
        tracks,
        dividerThicknessMm: effectiveDividerT,
      },
      effectiveDividerMat,
      effectiveDividerT,
      edgeBandId,
      `${idPrefix}-div`,
      {
        jointKind: effectiveJointKind,
        dividerSetbackMm,
        structural: isStructural,
        rootPieceId: options.rootPieceId,
      },
    );

    pieces.push(...subResult.dividerPieces);
    joints.push(...subResult.dividerJoints);
    placementNodes.push(...subResult.dividerPlacements);

    // Recursively resolve the equipment inside each child cell
    for (let i = 0; i < subResult.bayBoxes.length; i++) {
      const childBay = subResult.bayBoxes[i]!;
      const childContent = subBays[i] ?? { type: 'empty' };

      const childResolver = registry?.getResolver(childContent.type);
      if (childResolver) {
        const childResult = childResolver.resolve({
          bay: childBay,
          content: childContent,
          materials,
          options: {
            ...options,
            idPrefix: `${idPrefix}-cell-${i + 1}`,
          },
          registry,
        });

        pieces.push(...childResult.pieces);
        joints.push(...childResult.joints);
        placementNodes.push(...childResult.placementNodes);
        subAssemblies.push(...childResult.subAssemblies);
      }
    }

    return {
      pieces,
      joints,
      placementNodes,
      subAssemblies,
    };
  }
}
