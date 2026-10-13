export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface PlacementNode {
  pieceId: string;
  parentPieceId?: string;
  relativeOffset: Position3D;
}

/**
 * Placement tree that computes piece positions relative to a root piece.
 */
export class PlacementTree {
  private readonly nodes = new Map<string, PlacementNode>();
  public readonly rootPieceId: string;

  constructor(rootPieceId: string) {
    if (!rootPieceId) {
      throw new Error('Placement tree must have a non-empty rootPieceId');
    }
    this.rootPieceId = rootPieceId;
    this.nodes.set(rootPieceId, {
      pieceId: rootPieceId,
      relativeOffset: { x: 0, y: 0, z: 0 },
    });
  }

  /**
   * Set or update a placement node.
   */
  public setNode(node: PlacementNode): void {
    if (node.pieceId !== this.rootPieceId && !node.parentPieceId) {
      throw new Error(`Non-root piece "${node.pieceId}" must specify a parentPieceId`);
    }
    this.nodes.set(node.pieceId, node);
  }

  /**
   * Check if a node is registered.
   */
  public hasNode(pieceId: string): boolean {
    return this.nodes.has(pieceId);
  }

  /**
   * Get a node by pieceId.
   */
  public getNode(pieceId: string): PlacementNode | undefined {
    return this.nodes.get(pieceId);
  }

  /**
   * Calculate absolute positions for all registered pieces.
   * Reports an error if dependencies form a cycle.
   */
  public resolvePositions(rootOrigin: Position3D = { x: 0, y: 0, z: 0 }): Map<string, Position3D> {
    const resolved = new Map<string, Position3D>();
    resolved.set(this.rootPieceId, { ...rootOrigin });

    const visiting = new Set<string>();

    const getPosition = (pieceId: string): Position3D => {
      const existing = resolved.get(pieceId);
      if (existing) {
        return existing;
      }

      if (visiting.has(pieceId)) {
        throw new Error(`Circular dependency detected in placement tree at piece "${pieceId}"`);
      }

      const node = this.nodes.get(pieceId);
      if (!node || !node.parentPieceId) {
        throw new Error(`Piece "${pieceId}" has no valid parent path to root`);
      }

      visiting.add(pieceId);
      const parentPos = getPosition(node.parentPieceId);
      visiting.delete(pieceId);

      const absPos: Position3D = {
        x: parentPos.x + node.relativeOffset.x,
        y: parentPos.y + node.relativeOffset.y,
        z: parentPos.z + node.relativeOffset.z,
      };

      resolved.set(pieceId, absPos);
      return absPos;
    };

    for (const pieceId of this.nodes.keys()) {
      getPosition(pieceId);
    }

    return resolved;
  }
}
