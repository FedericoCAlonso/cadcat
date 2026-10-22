import {
  type BayContent,
  type BayContentSubdivided,
  type TrackSize,
} from './types';
import { resolveTracks } from './gridSolver';

export interface CellBox {
  path: number[];
  x: number;
  y: number;
  width: number;
  height: number;
  content: BayContent;
  isLeaf: boolean;
}

/**
 * Computes all leaf cells and their geometric bounding boxes (x, y, w, h in mm)
 * within an available bay cavity using recursive grid resolution.
 */
export function computeLeafCells(
  content: BayContent,
  availableWidth: number,
  availableHeight: number,
  defaultDividerT = 18,
): CellBox[] {
  const result: CellBox[] = [];

  function traverse(
    curr: BayContent,
    x: number,
    y: number,
    w: number,
    h: number,
    path: number[],
  ) {
    if (curr.type !== 'subdivided' || !curr.tracks || curr.tracks.length === 0) {
      result.push({
        path,
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(w),
        height: Math.round(h),
        content: curr,
        isLeaf: true,
      });
      return;
    }

    const sub = curr as BayContentSubdivided;
    const dividerT = sub.dividerThicknessMm ?? (sub.jointType === 'dado-groove' ? 6 : defaultDividerT);
    const isHorizontal = sub.axis === 'horizontal'; // dividing in X
    const availableSpace = isHorizontal ? w : h;

    const resolved = resolveTracks(availableSpace, sub.tracks, dividerT);

    for (let i = 0; i < resolved.tracks.length; i++) {
      const track = resolved.tracks[i]!;
      const childContent = sub.bays[i] ?? { type: 'empty' };
      const childPath = [...path, i];

      if (isHorizontal) {
        // Vertical partitions dividing X
        const childX = x + track.offsetMm;
        const childY = y;
        const childW = track.sizeMm;
        const childH = h;
        traverse(childContent, childX, childY, childW, childH, childPath);
      } else {
        // Horizontal shelves dividing Y
        // Track offset is from top or bottom. We render top-to-bottom for 2D UI:
        // Top row is track resolved from top if desired, or index 0 is bottom.
        // In UI canvas, y increases downward.
        const childX = x;
        const childY = y + track.offsetMm;
        const childW = w;
        const childH = track.sizeMm;
        traverse(childContent, childX, childY, childW, childH, childPath);
      }
    }
  }

  traverse(content, 0, 0, availableWidth, availableHeight, []);
  return result;
}

/**
 * Retrieves a cell at a specific tree path (e.g. [0, 1] for 1st child of 2nd child).
 */
export function getCellAtPath(root: BayContent, path: number[]): BayContent | null {
  let curr = root;
  for (const idx of path) {
    if (curr.type !== 'subdivided') return null;
    const sub = curr as BayContentSubdivided;
    const next = sub.bays[idx];
    if (!next) return null;
    curr = next;
  }
  return curr;
}

/**
 * Immutably updates the cell content at a specific path.
 */
export function updateCellAtPath(
  root: BayContent,
  path: number[],
  newCell: BayContent,
): BayContent {
  if (path.length === 0) {
    return newCell;
  }

  if (root.type !== 'subdivided') {
    return root;
  }

  const sub = root as BayContentSubdivided;
  const nextIdx = path[0]!;
  const restPath = path.slice(1);

  const updatedBays = [...sub.bays];
  const targetChild = updatedBays[nextIdx] ?? { type: 'empty' };
  updatedBays[nextIdx] = updateCellAtPath(targetChild, restPath, newCell);

  return {
    ...sub,
    bays: updatedBays,
  };
}

/**
 * Splits a cell at a specific path into rows or columns (Word-table style split).
 */
export function splitCellAtPath(
  root: BayContent,
  path: number[],
  axis: 'horizontal' | 'vertical',
  tracks: TrackSize[],
  dividerThicknessMm = 18,
  dividerMaterialId?: string,
  jointType?: 'dado-groove' | 'confirmat',
): BayContent {
  const currentCell: BayContent = getCellAtPath(root, path) ?? { type: 'empty' };
  const initialContent: BayContent = currentCell.type === 'subdivided' ? { type: 'empty' } : currentCell;

  const childBays: BayContent[] = tracks.map((_, i): BayContent =>
    i === 0 ? initialContent : { type: 'empty' },
  );

  const newSubdivided: BayContentSubdivided = {
    type: 'subdivided',
    axis,
    tracks,
    bays: childBays,
    dividerThicknessMm,
    dividerMaterialId,
    jointType: jointType ?? (dividerThicknessMm <= 9 ? 'dado-groove' : 'confirmat'),
  };

  return updateCellAtPath(root, path, newSubdivided);
}

/**
 * Removes the subdivision on a cell's parent (Word-table style merge/un-split).
 */
export function removeSplitAtPath(root: BayContent, path: number[]): BayContent {
  if (path.length === 0) {
    return { type: 'empty' };
  }

  // Replace parent node with empty cell or the first child's content
  const parentPath = path.slice(0, -1);
  return updateCellAtPath(root, parentPath, { type: 'empty' });
}
