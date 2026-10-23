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

export interface DividerEdgeBox {
  id: string;
  path: number[]; // Path to the subdivided node that owns this divider
  dividerIndex: number;
  axis: 'horizontal' | 'vertical'; // 'horizontal' divides X (vertical partition), 'vertical' divides Y (horizontal shelf)
  x: number;
  y: number;
  width: number;
  height: number;
  thicknessMm: number;
  jointType?: 'confirmat' | 'minifix' | 'dado-groove';
  materialId?: string;
}

export interface TreeGeometryResult {
  cells: CellBox[];
  dividers: DividerEdgeBox[];
}

/**
 * Computes all leaf cells and internal divider edges (aristas) with their exact 2D coordinates (x, y, w, h in mm)
 * within an available bay cavity using recursive grid resolution.
 */
export function computeTreeGeometry(
  content: BayContent,
  availableWidth: number,
  availableHeight: number,
  defaultDividerT = 18,
): TreeGeometryResult {
  const cells: CellBox[] = [];
  const dividers: DividerEdgeBox[] = [];

  function traverse(
    curr: BayContent,
    x: number,
    y: number,
    w: number,
    h: number,
    path: number[],
  ) {
    if (curr.type !== 'subdivided' || !curr.tracks || curr.tracks.length === 0) {
      cells.push({
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

    // Compute divider edge geometry
    for (let d = 0; d < resolved.dividers.length; d++) {
      const div = resolved.dividers[d]!;
      const edgeId = `edge-${path.join('-') || 'root'}-${d}`;

      if (isHorizontal) {
        // Vertical partition dividing X
        dividers.push({
          id: edgeId,
          path,
          dividerIndex: d,
          axis: 'horizontal',
          x: Math.round(x + div.offsetMm),
          y: Math.round(y),
          width: Math.round(div.thicknessMm),
          height: Math.round(h),
          thicknessMm: div.thicknessMm,
          jointType: sub.jointType,
          materialId: sub.dividerMaterialId,
        });
      } else {
        // Horizontal shelf dividing Y
        dividers.push({
          id: edgeId,
          path,
          dividerIndex: d,
          axis: 'vertical',
          x: Math.round(x),
          y: Math.round(y + div.offsetMm),
          width: Math.round(w),
          height: Math.round(div.thicknessMm),
          thicknessMm: div.thicknessMm,
          jointType: sub.jointType,
          materialId: sub.dividerMaterialId,
        });
      }
    }

    // Traverse child tracks
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
        const childX = x;
        const childY = y + track.offsetMm;
        const childW = w;
        const childH = track.sizeMm;
        traverse(childContent, childX, childY, childW, childH, childPath);
      }
    }
  }

  traverse(content, 0, 0, availableWidth, availableHeight, []);
  return { cells, dividers };
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
  return computeTreeGeometry(content, availableWidth, availableHeight, defaultDividerT).cells;
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
 * Returns a canonical string key for a tree path (e.g. [0, 1] -> "0.1", [] -> "root").
 */
export function pathKey(path: readonly number[]): string {
  return path.length === 0 ? 'root' : path.join('.');
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
 * Immutably updates multiple leaf cells at their respective paths in a single batch operation.
 */
export function updateCellsAtPaths(
  root: BayContent,
  paths: readonly (readonly number[])[],
  updater: BayContent | ((current: BayContent, path: readonly number[]) => BayContent),
): BayContent {
  let next = root;
  for (const p of paths) {
    const mutablePath = [...p];
    const current = getCellAtPath(next, mutablePath) ?? { type: 'empty' };
    const replacement = typeof updater === 'function' ? updater(current, p) : updater;
    next = updateCellAtPath(next, mutablePath, replacement);
  }
  return next;
}

/**
 * Immutably updates the properties of an arista (divider) at a specific subdivision path.
 */
export function updateDividerAtPath(
  root: BayContent,
  path: number[],
  updates: {
    dividerThicknessMm?: number;
    jointType?: 'confirmat' | 'minifix' | 'dado-groove';
    dividerMaterialId?: string;
  },
): BayContent {
  const current = getCellAtPath(root, path);
  if (!current || current.type !== 'subdivided') return root;

  const sub = current as BayContentSubdivided;
  const newThickness = updates.dividerThicknessMm ?? sub.dividerThicknessMm ?? 18;
  const newJoint = updates.jointType ?? sub.jointType ?? (newThickness <= 9 ? 'dado-groove' : 'confirmat');

  let defaultMat = sub.dividerMaterialId;
  if (newThickness <= 6) defaultMat = 'mat-plywood-guatambu-6';
  else if (newThickness <= 9) defaultMat = 'mat-plywood-guatambu-9';

  const updated: BayContentSubdivided = {
    ...sub,
    dividerThicknessMm: newThickness,
    jointType: newJoint,
    dividerMaterialId: updates.dividerMaterialId ?? defaultMat,
  };

  return updateCellAtPath(root, path, updated);
}

/**
 * Distributes tracks in a subdivision evenly (Word table "Distribuir filas/columnas uniformemente").
 */
export function distributeTracksEvenlyAtPath(root: BayContent, path: number[]): BayContent {
  const current = getCellAtPath(root, path);
  if (!current || current.type !== 'subdivided') return root;

  const sub = current as BayContentSubdivided;
  const balancedTracks: TrackSize[] = sub.tracks.map(() => ({
    type: 'fractional',
    valueFr: 1,
  }));

  return updateCellAtPath(root, path, {
    ...sub,
    tracks: balancedTracks,
  });
}

/**
 * Updates a specific track's sizing mode (fixed mm vs fractional fr) and value.
 */
export function updateTrackAtPath(
  root: BayContent,
  path: number[],
  trackIndex: number,
  newTrack: TrackSize,
): BayContent {
  const current = getCellAtPath(root, path);
  if (!current || current.type !== 'subdivided') return root;

  const sub = current as BayContentSubdivided;
  if (trackIndex < 0 || trackIndex >= sub.tracks.length) return root;

  const nextTracks = [...sub.tracks];
  nextTracks[trackIndex] = newTrack;

  return updateCellAtPath(root, path, {
    ...sub,
    tracks: nextTracks,
  });
}

/**
 * Replaces all tracks of a subdivided node at path with custom track definitions.
 * Preserves existing child bays where possible.
 */
export function updateSubdivisionTracksAtPath(
  root: BayContent,
  path: number[],
  newTracks: TrackSize[],
): BayContent {
  const current = getCellAtPath(root, path);
  if (!current || current.type !== 'subdivided') return root;

  const sub = current as BayContentSubdivided;
  const newBays: BayContent[] = newTracks.map((_, i) => sub.bays[i] ?? { type: 'empty' });

  return updateCellAtPath(root, path, {
    ...sub,
    tracks: newTracks,
    bays: newBays,
  });
}

/**
 * Appends a new track (division) to the subdivision at path.
 */
export function addTrackAtPath(
  root: BayContent,
  path: number[],
  track: TrackSize = { type: 'fractional', valueFr: 1 },
): BayContent {
  const current = getCellAtPath(root, path);
  if (!current || current.type !== 'subdivided') return root;

  const sub = current as BayContentSubdivided;
  return updateCellAtPath(root, path, {
    ...sub,
    tracks: [...sub.tracks, track],
    bays: [...sub.bays, { type: 'empty' }],
  });
}

/**
 * Removes a track and its child cell from the subdivision at path.
 */
export function removeTrackAtPath(
  root: BayContent,
  path: number[],
  trackIndex: number,
): BayContent {
  const current = getCellAtPath(root, path);
  if (!current || current.type !== 'subdivided') return root;

  const sub = current as BayContentSubdivided;
  if (sub.tracks.length <= 1) {
    // If removing the only track, replace subdivision with empty or remaining child
    return updateCellAtPath(root, path, sub.bays[0] ?? { type: 'empty' });
  }

  const nextTracks = sub.tracks.filter((_, i) => i !== trackIndex);
  const nextBays = sub.bays.filter((_, i) => i !== trackIndex);

  return updateCellAtPath(root, path, {
    ...sub,
    tracks: nextTracks,
    bays: nextBays,
  });
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
 * Splits multiple leaf cells at their respective paths in a single batch operation.
 */
export function splitCellsAtPaths(
  root: BayContent,
  paths: readonly (readonly number[])[],
  axis: 'horizontal' | 'vertical',
  tracks: TrackSize[],
  dividerThicknessMm = 18,
  dividerMaterialId?: string,
  jointType?: 'dado-groove' | 'confirmat',
): BayContent {
  let next = root;
  for (const p of paths) {
    next = splitCellAtPath(
      next,
      [...p],
      axis,
      tracks,
      dividerThicknessMm,
      dividerMaterialId,
      jointType,
    );
  }
  return next;
}

/**
 * Creates an aligned N rows x M columns matrix grid (Word-style initial table creation).
 * Supports continuous reference spine boards with custom thickness (e.g. 18mm or 6mm)
 * and custom track sizing for rows and columns.
 */
export function createMatrixGrid(
  rows: number,
  cols: number,
  continuity: 'horizontal-continuous' | 'vertical-continuous' = 'horizontal-continuous',
  dividerThicknessMm = 18,
  jointType?: 'confirmat' | 'dado-groove',
  customRowTracks?: TrackSize[],
  customColTracks?: TrackSize[],
  secondaryDividerThicknessMm?: number,
): BayContent {
  const safeRows = Math.max(1, Math.min(12, Math.round(rows)));
  const safeCols = Math.max(1, Math.min(12, Math.round(cols)));

  if (safeRows === 1 && safeCols === 1) {
    return { type: 'empty' };
  }

  const effectiveJoint = jointType ?? (dividerThicknessMm <= 9 ? 'dado-groove' : 'confirmat');
  let dividerMaterialId: string | undefined = undefined;
  if (dividerThicknessMm <= 6) dividerMaterialId = 'mat-plywood-guatambu-6';
  else if (dividerThicknessMm <= 9) dividerMaterialId = 'mat-plywood-guatambu-9';

  const secThickness = secondaryDividerThicknessMm ?? dividerThicknessMm;
  const secJoint = secThickness <= 9 ? 'dado-groove' : (jointType ?? 'confirmat');
  let secMaterialId: string | undefined = undefined;
  if (secThickness <= 6) secMaterialId = 'mat-plywood-guatambu-6';
  else if (secThickness <= 9) secMaterialId = 'mat-plywood-guatambu-9';

  const defaultRowTracks: TrackSize[] = customRowTracks ?? Array.from({ length: safeRows }, () => ({
    type: 'fractional',
    valueFr: 1,
  }));

  const defaultColTracks: TrackSize[] = customColTracks ?? Array.from({ length: safeCols }, () => ({
    type: 'fractional',
    valueFr: 1,
  }));

  if (safeRows === 1) {
    // Single row with M columns
    return {
      type: 'subdivided',
      axis: 'horizontal',
      tracks: defaultColTracks,
      bays: defaultColTracks.map(() => ({ type: 'empty' })),
      dividerThicknessMm,
      dividerMaterialId,
      jointType: effectiveJoint,
    };
  }

  if (safeCols === 1) {
    // Single column with N rows
    return {
      type: 'subdivided',
      axis: 'vertical',
      tracks: defaultRowTracks,
      bays: defaultRowTracks.map(() => ({ type: 'empty' })),
      dividerThicknessMm,
      dividerMaterialId,
      jointType: effectiveJoint,
    };
  }

  // Multi-row and multi-column grid
  if (continuity === 'horizontal-continuous') {
    // Shelves run full width continuously (primary reference spine); each row has columns
    const rowBays: BayContent[] = defaultRowTracks.map(
      (): BayContentSubdivided => ({
        type: 'subdivided',
        axis: 'horizontal',
        tracks: defaultColTracks,
        bays: defaultColTracks.map(() => ({ type: 'empty' })),
        dividerThicknessMm: secThickness,
        dividerMaterialId: secMaterialId,
        jointType: secJoint,
      }),
    );

    return {
      type: 'subdivided',
      axis: 'vertical',
      tracks: defaultRowTracks,
      bays: rowBays,
      dividerThicknessMm,
      dividerMaterialId,
      jointType: effectiveJoint,
    };
  }

  // Vertical partitions run floor-to-roof continuously; each column has rows
  const colBays: BayContent[] = defaultColTracks.map(
    (): BayContentSubdivided => ({
      type: 'subdivided',
      axis: 'vertical',
      tracks: defaultRowTracks,
      bays: defaultRowTracks.map(() => ({ type: 'empty' })),
      dividerThicknessMm: secThickness,
      dividerMaterialId: secMaterialId,
      jointType: secJoint,
    }),
  );

  return {
    type: 'subdivided',
    axis: 'horizontal',
    tracks: defaultColTracks,
    bays: colBays,
    dividerThicknessMm,
    dividerMaterialId,
    jointType: effectiveJoint,
  };
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
