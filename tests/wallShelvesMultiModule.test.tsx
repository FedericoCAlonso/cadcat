import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import React, { useEffect, act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { useModuleViewModel } from '../src/ui/useModuleViewModel';
import { PieceListView } from '../src/ui/PieceListView';
import { projectModuleItemSchema } from '../src/model';
import { buildWallShelving, runProjectNesting, exportCutPlanPdf, type ResolvedPieceWithCutSize } from '../src/resolver';
import { getSeedMaterials } from '../src/catalog';

function createHookRunner<T>(useHook: () => T) {
  let latestResult: T | undefined;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  function TestComponent() {
    const hookVal = useHook();
    useEffect(() => {
      latestResult = hookVal;
    });
    latestResult = hookVal;
    return null;
  }

  act(() => {
    root.render(React.createElement(TestComponent));
  });

  return {
    get current() {
      return latestResult!;
    },
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('Wall Shelves Multi-Module Persistence & Cutting Diagram Consolidation', () => {
  it('validates optional per-module wallShelves config in projectModuleItemSchema', () => {
    const parsed = projectModuleItemSchema.parse({
      id: 'mod-ws-1',
      name: 'Estantes 1400',
      quantity: 1,
      templateId: 'wall-shelves',
      width: 1400,
      height: 1600,
      depth: 350,
      wallShelves: {
        shelfCount: 6,
        verticalSpacingMm: 300,
        baseElevationYMm: 700,
        bracketType: 'floating-pin',
        wallType: 'solid-brick',
        loadCategory: 'heavy',
        boundaryCondition: 'free-ends',
        overhangMode: 'balanced-cantilever',
      },
    });

    expect(parsed.wallShelves?.shelfCount).toBe(6);
    expect(parsed.wallShelves?.bracketType).toBe('floating-pin');
  });

  it('preserves independent shelf counts across two wall-shelves modules when adding and switching modules', () => {
    const runner = createHookRunner(() => useModuleViewModel());

    // Configure Module 1 as wall-shelves: 1400x350, 6 shelves
    act(() => {
      runner.current.setSelectedTemplateId('wall-shelves');
    });
    act(() => {
      runner.current.setWidth(1400);
      runner.current.setDepth(350);
      runner.current.setWallShelvesShelfCount(6);
    });
    expect(runner.current.resolvedPieces).toHaveLength(6);

    // Add Module 2 as wall-shelves: 900x280, 6 shelves
    act(() => {
      runner.current.addProjectModule('Estantes 900', 'wall-shelves');
    });
    act(() => {
      runner.current.setWidth(900);
      runner.current.setDepth(280);
      runner.current.setWallShelvesShelfCount(6);
    });

    // Both modules must resolve 6 shelves each -> 12 consolidated pieces total
    expect(runner.current.resolvedPieces).toHaveLength(6);
    expect(runner.current.consolidatedPieces).toHaveLength(12);
    expect(runner.current.consolidatedBom?.totalPieceCount).toBe(12);

    const mod1Pieces = runner.current.consolidatedPieces.filter((p) => p.moduleId === 'mod-1');
    const mod2Pieces = runner.current.consolidatedPieces.filter((p) => p.moduleId !== 'mod-1');
    expect(mod1Pieces).toHaveLength(6);
    expect(mod2Pieces).toHaveLength(6);
    mod1Pieces.forEach((p) => expect(p.dimensionsMm).toEqual({ width: 1400, height: 350 }));
    mod2Pieces.forEach((p) => expect(p.dimensionsMm).toEqual({ width: 900, height: 280 }));

    // Now test asymmetric counts: set Module 2 to 1 shelf with quantity = 6 (still 6 total!)
    act(() => {
      runner.current.setWallShelvesShelfCount(1);
    });
    const mod2Id = runner.current.activeModuleId;
    act(() => {
      runner.current.updateProjectModuleQuantity(mod2Id, 6);
    });
    expect(runner.current.consolidatedPieces).toHaveLength(12);

    // Switch back to Module 1: Module 2 (now inactive) must remain 1 * 6 = 6 (NOT hardcoded 3 * 6 = 18!)
    act(() => {
      runner.current.setActiveModule('mod-1');
    });
    expect(runner.current.wallShelvesShelfCount).toBe(6);
    expect(runner.current.width).toBe(1400);
    expect(runner.current.depth).toBe(350);
    expect(runner.current.consolidatedPieces).toHaveLength(12);
    expect(runner.current.consolidatedPieces.filter((p) => p.moduleId === 'mod-1')).toHaveLength(6);
    expect(runner.current.consolidatedPieces.filter((p) => p.moduleId === mod2Id)).toHaveLength(6);

    runner.unmount();
  });

  it('places all 12 shelves from two wall-shelves modules in nesting and groups them cleanly in PDF', () => {
    const mat = getSeedMaterials().materials[0]!;
    const out1 = buildWallShelving({
      id: 'mod-1',
      widthMm: 1400,
      depthMm: 350,
      thicknessMm: 18,
      shelfCount: 6,
      verticalSpacingMm: 320,
      bracketType: 'l-bracket',
      wallType: 'solid-brick',
      loadCategory: 'medium',
      boundaryCondition: 'free-ends',
      overhangMode: 'balanced-cantilever',
      materialId: mat.id,
    });
    const out2 = buildWallShelving({
      id: 'mod-2',
      widthMm: 900,
      depthMm: 280,
      thicknessMm: 18,
      shelfCount: 6,
      verticalSpacingMm: 320,
      bracketType: 'l-bracket',
      wallType: 'solid-brick',
      loadCategory: 'medium',
      boundaryCondition: 'free-ends',
      overhangMode: 'balanced-cantilever',
      materialId: mat.id,
    });

    const toResolved = (pieces: typeof out1.module.pieces) =>
      pieces.map((p) => ({
        ...p,
        positionMm: { x: 0, y: 0, z: 0 },
        dimensionsMm: { width: p.contour.points[1]!.x, height: p.contour.points[2]!.y },
        cutDimensionsMm: { width: p.contour.points[1]!.x, height: p.contour.points[2]!.y },
        cutContour: p.contour,
        bandedEdges: [],
      }));

    const nesting = runProjectNesting(
      [
        { moduleId: 'mod-1', moduleName: 'Estantes 1400', quantity: 1, pieces: toResolved(out1.module.pieces) },
        { moduleId: 'mod-2', moduleName: 'Estantes 900', quantity: 1, pieces: toResolved(out2.module.pieces) },
      ],
      { materials: [mat] },
    );

    expect(nesting.unplacedPieces).toHaveLength(0);
    const totalPlaced = nesting.sheets.reduce((acc, s) => acc + s.placedPieces.length, 0);
    expect(totalPlaced).toBe(12);

    const mod1Placed = nesting.sheets.flatMap((s) => s.placedPieces).filter((p) => p.pieceId.startsWith('mod-1__'));
    const mod2Placed = nesting.sheets.flatMap((s) => s.placedPieces).filter((p) => p.pieceId.startsWith('mod-2__'));
    expect(mod1Placed).toHaveLength(6);
    expect(mod2Placed).toHaveLength(6);

    const doc = exportCutPlanPdf(nesting, 'Plano Estantes');
    expect(doc.getNumberOfPages()).toBe(nesting.totalSheets);
  });

  it('includes wall-shelves hardware in module BOM and consolidated project BOM scaled by quantity', () => {
    const runner = createHookRunner(() => useModuleViewModel());

    act(() => {
      runner.current.setSelectedTemplateId('wall-shelves');
    });
    act(() => {
      runner.current.setWidth(900);
      runner.current.setDepth(280);
      runner.current.setWallShelvesShelfCount(1);
    });

    const singleBrackets = runner.current.bom?.hardware.find((h) => h.hardwareId === 'hw-l-bracket')?.count ?? 0;
    expect(singleBrackets).toBeGreaterThan(0);
    expect(runner.current.bom?.totalHardwareCount).toBeGreaterThan(0);

    act(() => {
      runner.current.updateProjectModuleQuantity(runner.current.activeModuleId, 6);
    });

    const batchBrackets = runner.current.consolidatedBom?.hardware.find((h) => h.hardwareId === 'hw-l-bracket')?.count ?? 0;
    expect(batchBrackets).toBe(singleBrackets * 6);

    runner.unmount();
  });

  it('displays batch total pieces and edgeband meters in PieceListView when activeModuleQuantity > 1', () => {
    const samplePiece: ResolvedPieceWithCutSize = {
      id: 'mod-1-shelf-0',
      role: 'wall-shelf',
      materialId: 'mat-egger-white-18',
      contour: { points: [{ x: 0, y: 0 }, { x: 900, y: 0 }, { x: 900, y: 280 }, { x: 0, y: 280 }] },
      thicknessMm: 18,
      faces: [],
      structural: false,
      referenceFace: 'A',
      positionMm: { x: 0, y: 0, z: 0 },
      dimensionsMm: { width: 900, height: 280 },
      cutDimensionsMm: { width: 898.4, height: 279.2 },
      cutContour: { points: [{ x: 0, y: 0 }, { x: 898.4, y: 0 }, { x: 898.4, y: 279.2 }, { x: 0, y: 279.2 }] },
      bandedEdges: [
        { faceId: 'bottom-edge', edgeBandId: 'eb-white-08', thicknessMm: 0.8, lengthMm: 900 },
        { faceId: 'left-edge', edgeBandId: 'eb-white-08', thicknessMm: 0.8, lengthMm: 280 },
        { faceId: 'right-edge', edgeBandId: 'eb-white-08', thicknessMm: 0.8, lengthMm: 280 },
      ],
    };

    const html = renderToString(
      <PieceListView
        pieces={[samplePiece]}
        projectScope="current-module"
        activeModuleQuantity={6}
      />,
    );

    const text = html.replace(/<!-- -->/g, '');
    expect(text).toContain('(6 piezas)');
    expect(text).toContain('6 piezas de corte');
    expect(text).toContain('×6 u.');
    expect(text).toContain('8.76 m');
  });
});
