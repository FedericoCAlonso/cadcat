import { describe, it, expect } from 'vitest';
import {
  shouldShowPieceMachining,
  countPieceMachiningOperations,
  formatHolesCountText,
} from '../src/ui/viewer/machiningVisibility';
import {
  classifyPieceRoleCategory,
  resolvePiecePbrStyle,
  M3_SELECTED_PIECE_STYLE,
  ROLE_CATEGORY_PBR_STYLES,
} from '../src/ui/materialStyles';
import type { PieceMachiningSheet } from '../src/resolver';

describe('Stage 5 Step B: Machining Visibility & Role Colors', () => {
  describe('classifyPieceRoleCategory & resolvePiecePbrStyle (Role Colors)', () => {
    it('classifies various piece role names into canonical role categories', () => {
      // Sides
      expect(classifyPieceRoleCategory('side-left')).toBe('sides');
      expect(classifyPieceRoleCategory('side-right')).toBe('sides');
      expect(classifyPieceRoleCategory('lateral_izq')).toBe('sides');
      expect(classifyPieceRoleCategory('lateral-der')).toBe('sides');
      expect(classifyPieceRoleCategory('column-cover-side')).toBe('sides');
      expect(classifyPieceRoleCategory('drawer-side')).toBe('sides');

      // Base
      expect(classifyPieceRoleCategory('bottom')).toBe('base');
      expect(classifyPieceRoleCategory('base')).toBe('base');
      expect(classifyPieceRoleCategory('piso')).toBe('base');
      expect(classifyPieceRoleCategory('drawer-bottom')).toBe('base');
      expect(classifyPieceRoleCategory('tray-bottom')).toBe('base');

      // Back
      expect(classifyPieceRoleCategory('back')).toBe('back');
      expect(classifyPieceRoleCategory('fondo')).toBe('back');
      expect(classifyPieceRoleCategory('backing')).toBe('back');

      // Top / Rails
      expect(classifyPieceRoleCategory('top')).toBe('top');
      expect(classifyPieceRoleCategory('techo')).toBe('top');
      expect(classifyPieceRoleCategory('rail-front')).toBe('top');
      expect(classifyPieceRoleCategory('rail-back')).toBe('top');

      // Fronts
      expect(classifyPieceRoleCategory('drawer-front')).toBe('fronts');
      expect(classifyPieceRoleCategory('door-left')).toBe('fronts');
      expect(classifyPieceRoleCategory('door-right')).toBe('fronts');
      expect(classifyPieceRoleCategory('door-single')).toBe('fronts');

      // Other
      expect(classifyPieceRoleCategory('shelf')).toBe('other');
      expect(classifyPieceRoleCategory('partition')).toBe('other');
      expect(classifyPieceRoleCategory('assembly-gauge')).toBe('other');
      expect(classifyPieceRoleCategory('transom')).toBe('other');
    });

    it('resolves distinct role colors in light and dark themes with high contrast', () => {
      const sideLight = resolvePiecePbrStyle('side-left', undefined, false, true, 'light');
      const sideDark = resolvePiecePbrStyle('side-left', undefined, false, true, 'dark');

      expect(sideLight.color).toBe(ROLE_CATEGORY_PBR_STYLES.light.sides.color);
      expect(sideDark.color).toBe(ROLE_CATEGORY_PBR_STYLES.dark.sides.color);
      expect(sideLight.color).not.toBe(sideDark.color);

      const baseLight = resolvePiecePbrStyle('bottom', undefined, false, true, 'light');
      const frontLight = resolvePiecePbrStyle('drawer-front', undefined, false, true, 'light');
      expect(baseLight.color).not.toBe(frontLight.color);
    });

    it('preserves M3_SELECTED_PIECE_STYLE when piece is selected even with colorByRole active', () => {
      const selectedStyle = resolvePiecePbrStyle('side-left', undefined, true, true, 'light');
      expect(selectedStyle).toBe(M3_SELECTED_PIECE_STYLE);
    });
  });

  describe('shouldShowPieceMachining (3-State On-Demand Machining)', () => {
    it('mode "no": unconditionally hides machining marks regardless of conditions', () => {
      expect(
        shouldShowPieceMachining({
          mode: 'no',
          pieceId: 'piece-1',
          hoveredPieceId: 'piece-1',
          selectedPieceId: 'piece-1',
          cameraDistanceMm: 500, // Very close
          explodedRatio: 0.5, // Highly exploded
        }),
      ).toBe(false);
    });

    it('mode "always": unconditionally shows machining marks regardless of distance or selection', () => {
      expect(
        shouldShowPieceMachining({
          mode: 'always',
          pieceId: 'piece-1',
          cameraDistanceMm: 3000, // Far away
          explodedRatio: 0,
        }),
      ).toBe(true);
    });

    describe('mode "auto": context-sensitive on-demand visibility', () => {
      it('hides marks at default overview zoom when not hovered, selected, or exploded', () => {
        expect(
          shouldShowPieceMachining({
            mode: 'auto',
            pieceId: 'piece-1',
            hoveredPieceId: null,
            selectedPieceId: null,
            cameraDistanceMm: 1750, // Default camera fit distance
            distanceThresholdMm: 1200,
            explodedRatio: 0,
            explodedThreshold: 0.08,
          }),
        ).toBe(false);
      });

      it('shows marks when camera distance is closer than threshold (zoomed in)', () => {
        expect(
          shouldShowPieceMachining({
            mode: 'auto',
            pieceId: 'piece-1',
            cameraDistanceMm: 1100, // Closer than 1200
            distanceThresholdMm: 1200,
            explodedRatio: 0,
          }),
        ).toBe(true);
      });

      it('shows marks when explodedRatio exceeds explodedThreshold', () => {
        expect(
          shouldShowPieceMachining({
            mode: 'auto',
            pieceId: 'piece-1',
            cameraDistanceMm: 1800,
            explodedRatio: 0.15, // Above 0.08 threshold
            explodedThreshold: 0.08,
          }),
        ).toBe(true);
      });

      it('shows marks only for the hovered piece when hovering over a piece', () => {
        // Hovered piece shows marks
        expect(
          shouldShowPieceMachining({
            mode: 'auto',
            pieceId: 'piece-side-1',
            hoveredPieceId: 'piece-side-1',
            cameraDistanceMm: 1800,
            explodedRatio: 0,
          }),
        ).toBe(true);

        // Other pieces remain clean
        expect(
          shouldShowPieceMachining({
            mode: 'auto',
            pieceId: 'piece-bottom',
            hoveredPieceId: 'piece-side-1',
            cameraDistanceMm: 1800,
            explodedRatio: 0,
          }),
        ).toBe(false);
      });

      it('shows marks for the selected piece in the inspector', () => {
        expect(
          shouldShowPieceMachining({
            mode: 'auto',
            pieceId: 'piece-side-1',
            selectedPieceId: 'piece-side-1',
            cameraDistanceMm: 1800,
            explodedRatio: 0,
          }),
        ).toBe(true);

        expect(
          shouldShowPieceMachining({
            mode: 'auto',
            pieceId: 'piece-other',
            selectedPieceId: 'piece-side-1',
            cameraDistanceMm: 1800,
            explodedRatio: 0,
          }),
        ).toBe(false);
      });
    });
  });

  describe('countPieceMachiningOperations & formatHolesCountText', () => {
    it('correctly aggregates standard and custom operations from machining sheet', () => {
      const mockSheet: PieceMachiningSheet = {
        pieceId: 'piece-1',
        role: 'side-left',
        materialId: 'mat-1',
        dimensionsMm: { width: 560, height: 800, thickness: 18 },
        cutDimensionsMm: { width: 560, height: 800 },
        bandedEdges: { top: false, bottom: false, left: false, right: false },
        faceAOperations: [],
        faceBOperations: [],
        edgeOperations: [],
        totalOperations: 38,
        customOperations: [
          { id: 'custom-1', kind: 'drill', pieceId: 'piece-1', faceType: 'face-A', xMm: 50, yMm: 100, diameterMm: 5, depthMm: 12, isThrough: false },
          { id: 'custom-2', kind: 'drill', pieceId: 'piece-1', faceType: 'face-A', xMm: 50, yMm: 200, diameterMm: 5, depthMm: 12, isThrough: false },
          { id: 'custom-3', kind: 'drill', pieceId: 'piece-1', faceType: 'face-A', xMm: 50, yMm: 300, diameterMm: 5, depthMm: 12, isThrough: false },
          { id: 'custom-4', kind: 'drill', pieceId: 'piece-1', faceType: 'face-A', xMm: 50, yMm: 400, diameterMm: 5, depthMm: 12, isThrough: false },
        ],
        requiresTurn: false,
        turnInstructions: '',
      };

      // 38 standard + 4 custom = 42 operations
      expect(countPieceMachiningOperations(mockSheet)).toBe(42);
      expect(formatHolesCountText(42)).toBe('42 agujeros');
    });

    it('formats singular and plural hole text cleanly', () => {
      expect(formatHolesCountText(1)).toBe('1 agujero');
      expect(formatHolesCountText(0)).toBe('0 agujeros');
      expect(formatHolesCountText(12)).toBe('12 agujeros');
    });
  });
});
