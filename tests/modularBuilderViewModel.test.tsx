import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import React, { useEffect, act } from 'react';
import { createRoot } from 'react-dom/client';
import { useModuleViewModel } from '../src/ui/useModuleViewModel';

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

describe('useModuleViewModel Interactive Modular Builder', () => {
  it('initializes with default parameters and allows toggling roof type', async () => {
    const runner = createHookRunner(() => useModuleViewModel());

    // Initially classic template
    expect(runner.current.roofType).toBe('front-back-rails');
    expect(runner.current.isCustomModular).toBe(false);

    // Switch roof type to solid panel (tapa entera)
    act(() => {
      runner.current.setRoofType('solid-panel');
    });

    expect(runner.current.roofType).toBe('solid-panel');
    expect(runner.current.isCustomModular).toBe(true);

    // Resolved pieces should include top instead of rails
    const roles = runner.current.resolvedPieces.map((p) => p.role);
    expect(roles).toContain('top');
    expect(roles).not.toContain('rail');

    runner.unmount();
  });

  it('allows adding and removing drawers dynamically', () => {
    const runner = createHookRunner(() => useModuleViewModel());

    // Equip bay 0 with drawer stack
    act(() => {
      runner.current.setBayContentType(0, 'drawer-stack');
    });

    expect(runner.current.isCustomModular).toBe(true);
    const bay = runner.current.bays[0];
    expect(bay?.type).toBe('drawer-stack');
    if (bay?.type === 'drawer-stack') {
      expect(bay.drawerTracks).toHaveLength(3);
    }

    // Add a 4th drawer
    act(() => {
      runner.current.addDrawer(0);
    });

    const bayAfterAdd = runner.current.bays[0];
    if (bayAfterAdd?.type === 'drawer-stack') {
      expect(bayAfterAdd.drawerTracks).toHaveLength(4);
    }

    // Check that resolved pieces contain 4 drawer fronts
    const drawerFronts = runner.current.resolvedPieces.filter((p) => p.role === 'drawer-front');
    expect(drawerFronts).toHaveLength(4);

    // Remove a drawer -> back to 3
    act(() => {
      runner.current.removeDrawer(0);
    });

    const bayAfterRemove = runner.current.bays[0];
    if (bayAfterRemove?.type === 'drawer-stack') {
      expect(bayAfterRemove.drawerTracks).toHaveLength(3);
    }

    runner.unmount();
  });

  it('allows adding and removing shelves dynamically', () => {
    const runner = createHookRunner(() => useModuleViewModel());

    act(() => {
      runner.current.setBayContentType(0, 'shelves');
    });

    const bay = runner.current.bays[0];
    expect(bay?.type).toBe('shelves');
    if (bay?.type === 'shelves') {
      expect(bay.count).toBe(2);
    }

    // Add a 3rd shelf
    act(() => {
      runner.current.addShelf(0);
    });

    const bayAfterAdd = runner.current.bays[0];
    if (bayAfterAdd?.type === 'shelves') {
      expect(bayAfterAdd.count).toBe(3);
    }

    const shelves = runner.current.resolvedPieces.filter((p) => p.role === 'shelf');
    expect(shelves).toHaveLength(3);

    // Remove a shelf -> back to 2
    act(() => {
      runner.current.removeShelf(0);
    });

    const bayAfterRemove = runner.current.bays[0];
    if (bayAfterRemove?.type === 'shelves') {
      expect(bayAfterRemove.count).toBe(2);
    }

    runner.unmount();
  });

  it('allows creating a 2-bay module with partition and custom bay contents', () => {
    const runner = createHookRunner(() => useModuleViewModel());

    act(() => {
      runner.current.setGridType('2-bays-vertical');
      runner.current.setBayContentType(0, 'shelves');
      runner.current.setBayContentType(1, 'drawer-stack');
    });

    expect(runner.current.bays).toHaveLength(2);
    expect(runner.current.bays[0]?.type).toBe('shelves');
    expect(runner.current.bays[1]?.type).toBe('drawer-stack');

    // Should resolve vertical partition piece
    const partition = runner.current.resolvedPieces.find((p) => p.role === 'partition');
    expect(partition).toBeDefined();

    // Should resolve shelves in bay 1 and drawers in bay 2
    const shelves = runner.current.resolvedPieces.filter((p) => p.role === 'shelf');
    expect(shelves.length).toBeGreaterThanOrEqual(1);

    const drawerFronts = runner.current.resolvedPieces.filter((p) => p.role === 'drawer-front');
    expect(drawerFronts.length).toBeGreaterThanOrEqual(2);

    runner.unmount();
  });
});
