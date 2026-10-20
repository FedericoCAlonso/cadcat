import 'fake-indexeddb/auto';
import { act } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { App } from '../src/ui/App';
import * as useModuleViewModelModule from '../src/ui/useModuleViewModel';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('Modo Obra Fullscreen 3D Viewport & Landscape Experience', () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;
  const originalMatchMedia = window.matchMedia;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;

  beforeEach(() => {
    window.innerWidth = 375;
    window.innerHeight = 667;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);
  });

  afterEach(() => {
    window.innerWidth = originalInnerWidth;
    window.innerHeight = originalInnerHeight;
    window.matchMedia = originalMatchMedia;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    vi.restoreAllMocks();
  });

  it('renders the floating back button (FAB) in 3D inspection mode', () => {
    const handleSetTab = vi.fn();

    // Mock useModuleViewModel to simulate active 3D mode in one-hand site device
    const mockVm = {
      uiMode: 'site' as const,
      isOneHandDevice: true,
      activeTab: '3d' as const,
      setActiveTab: handleSetTab,
      handMode: 'right' as const,
      projectModules: [{ id: 'mod-1', name: 'Alacena Superior' }],
      activeModuleId: 'mod-1',
      spatialBoxes: [],
      spatialBounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 600, y: 700, z: 320 }, center: { x: 300, y: 350, z: 160 }, size: { x: 600, y: 700, z: 320 } },
      resolvedPieces: [],
      explodedRatio: 0,
      setExplodedRatio: vi.fn(),
      selectedPieceId: null,
      setSelectedPieceId: vi.fn(),
      shelfDeflections: [],
      pieceJointOverrides: {},
      setPieceJointOverride: vi.fn(),
      jointStrategy: 'confirmat' as const,
      kinematicBoxes: [],
      kinematicMechanisms: [],
      kinematicsState: {},
      setMechanismOpenRatio: vi.fn(),
      materials: [],
      edgeBands: [],
      pieceMaterialOverrides: {},
      pieceThicknessOverrides: {},
      pieceEdgeBandOverrides: {},
      setPieceMaterial: vi.fn(),
      setPieceThickness: vi.fn(),
      setPieceEdgeBands: vi.fn(),
      countertopCalculation: null,
      isLoading: false,
      error: null,
      statusMessage: null,
    };

    vi.spyOn(useModuleViewModelModule, 'useModuleViewModel').mockReturnValue(mockVm as unknown as ReturnType<typeof useModuleViewModelModule.useModuleViewModel>);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<App />);
    });

    // 1. Must render floating action button (FAB) at the bottom
    const fabButton = container.querySelector('.modo-obra-floating-back-fab') as HTMLButtonElement;
    expect(fabButton).toBeDefined();
    expect(fabButton.textContent).toContain('Volver al Editor');

    // 2. Clicking FAB calls setActiveTab('form')
    act(() => {
      fabButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(handleSetTab).toHaveBeenCalledWith('form');

    // 3. In portrait mode (375x667), shows rotation suggestion for CAD
    expect(container.textContent).toContain('Girar para CAD');

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('adapts to landscape orientation with landscape class and panoramic CAD badge', () => {
    // Set landscape dimensions (844 x 390)
    window.innerWidth = 844;
    window.innerHeight = 390;

    const mockVm = {
      uiMode: 'site' as const,
      isOneHandDevice: true,
      activeTab: '3d' as const,
      setActiveTab: vi.fn(),
      handMode: 'right' as const,
      projectModules: [{ id: 'mod-1', name: 'Bajo Mesada 800' }],
      activeModuleId: 'mod-1',
      spatialBoxes: [],
      spatialBounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 800, y: 750, z: 580 }, center: { x: 400, y: 375, z: 290 }, size: { x: 800, y: 750, z: 580 } },
      resolvedPieces: [],
      explodedRatio: 0,
      setExplodedRatio: vi.fn(),
      selectedPieceId: null,
      setSelectedPieceId: vi.fn(),
      shelfDeflections: [],
      pieceJointOverrides: {},
      setPieceJointOverride: vi.fn(),
      jointStrategy: 'confirmat' as const,
      kinematicBoxes: [],
      kinematicMechanisms: [],
      kinematicsState: {},
      setMechanismOpenRatio: vi.fn(),
      materials: [],
      edgeBands: [],
      pieceMaterialOverrides: {},
      pieceThicknessOverrides: {},
      pieceEdgeBandOverrides: {},
      setPieceMaterial: vi.fn(),
      setPieceThickness: vi.fn(),
      setPieceEdgeBands: vi.fn(),
      countertopCalculation: null,
      isLoading: false,
      error: null,
      statusMessage: null,
    };

    vi.spyOn(useModuleViewModelModule, 'useModuleViewModel').mockReturnValue(mockVm as unknown as ReturnType<typeof useModuleViewModelModule.useModuleViewModel>);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(<App />);
    });

    // 1. Should have landscape class for CAD full viewport
    const landscapeViewport = container.querySelector('.modo-obra-3d-fullscreen--landscape');
    expect(landscapeViewport).toBeDefined();

    // 2. Should show panoramic CAD badge
    expect(container.textContent).toContain('Vista Panorámica CAD');

    // 3. Floating back button remains present in landscape
    const fabButton = container.querySelector('.modo-obra-floating-back-fab');
    expect(fabButton).toBeDefined();

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
