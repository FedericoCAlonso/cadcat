import {
  type FaceRef,
  type Joint,
  type JointKind,
  type Interval,
  validateJoint,
} from '../model';

export interface CreateJointInput {
  a: FaceRef;
  b: FaceRef;
  kind: JointKind;
  offsetMm?: number;
  doorOffsetMm?: number;
  hingeSide?: 'left' | 'right';
  region?: Interval;
  hingeCrank?: 'codo-0' | 'codo-9' | 'codo-18';
}

/**
 * Create and validate a joint between two piece faces.
 */
export function createJoint(input: CreateJointInput): Joint {
  return validateJoint(input);
}

/**
 * Graph of joints connecting pieces in a module.
 */
export class JointGraph {
  private readonly adjacency = new Map<string, Joint[]>();
  private readonly jointsList: Joint[] = [];

  constructor(joints: Joint[] = []) {
    for (const joint of joints) {
      this.addJoint(joint);
    }
  }

  /**
   * Add a joint to the graph.
   */
  public addJoint(joint: Joint): void {
    const validJoint = validateJoint(joint);
    this.jointsList.push(validJoint);

    this.registerAdjacency(validJoint.a.pieceId, validJoint);
    this.registerAdjacency(validJoint.b.pieceId, validJoint);
  }

  private registerAdjacency(pieceId: string, joint: Joint): void {
    const list = this.adjacency.get(pieceId) ?? [];
    list.push(joint);
    this.adjacency.set(pieceId, list);
  }

  /**
   * Get all joints connected to a piece.
   */
  public getJointsForPiece(pieceId: string): Joint[] {
    return this.adjacency.get(pieceId) ?? [];
  }

  /**
   * Get joints between two specific pieces.
   */
  public getJointsBetween(pieceAId: string, pieceBId: string): Joint[] {
    const list = this.adjacency.get(pieceAId) ?? [];
    return list.filter((j) =>
      (j.a.pieceId === pieceAId && j.b.pieceId === pieceBId) ||
      (j.a.pieceId === pieceBId && j.b.pieceId === pieceAId),
    );
  }

  /**
   * Get all connected neighbor piece IDs for a piece.
   */
  public getNeighbors(pieceId: string): string[] {
    const joints = this.getJointsForPiece(pieceId);
    const neighbors = new Set<string>();

    for (const j of joints) {
      const neighbor = j.a.pieceId === pieceId ? j.b.pieceId : j.a.pieceId;
      neighbors.add(neighbor);
    }

    return Array.from(neighbors);
  }

  /**
   * Get all joints in the graph.
   */
  public getAllJoints(): Joint[] {
    return [...this.jointsList];
  }
}
