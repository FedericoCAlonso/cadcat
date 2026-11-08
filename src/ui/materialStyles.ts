import { DEFAULT_UI_CONFIG } from '../config';

/**
 * Centralized PBR material styling for 3D Viewport.
 * Adheres strictly to zero-hardcoding and Material Design 3 guidelines.
 */

export interface PiecePbrStyle {
  color: number;
  roughness: number;
  metalness: number;
  wireframeColor: number;
}

/**
 * Resolves the selection PBR style for a selected piece in light or dark theme.
 * Uses a vibrant violet/purple color from config that is distinct from all role palette colors,
 * preserving a clean white technical outline.
 *
 * @param theme Active UI theme ('light' or 'dark').
 * @returns PiecePbrStyle with distinct selection color and white outline.
 */
export function resolveSelectedPieceStyle(theme: 'light' | 'dark' = 'light'): PiecePbrStyle {
  const hex = theme === 'dark'
    ? (DEFAULT_UI_CONFIG.selectedPieceColor?.dark ?? '#9575CD')
    : (DEFAULT_UI_CONFIG.selectedPieceColor?.light ?? '#7E57C2');
  const colorNum = parseInt(hex.replace('#', ''), 16);
  return {
    color: colorNum,
    roughness: 0.35,
    metalness: 0.15,
    wireframeColor: 0xffffff,
  };
}

export const M3_SELECTED_PIECE_STYLE: PiecePbrStyle = resolveSelectedPieceStyle('light');

export const COUNTERTOP_PBR_STYLES: Record<string, PiecePbrStyle> = {
  'ct-granite-gris-mara-20': {
    color: 0x64748b, // Granite Gris Mara (slate stone)
    roughness: 0.35,
    metalness: 0.15,
    wireframeColor: 0x334155,
  },
  'ct-granite-negro-brasil-20': {
    color: 0x1e2022, // Granite Negro Brasil (deep polished black)
    roughness: 0.25,
    metalness: 0.2,
    wireframeColor: 0x64748b,
  },
  'ct-quartz-white-zeus-20': {
    color: 0xf8fafc, // Silestone Blanco Zeus (pure polished quartz)
    roughness: 0.15,
    metalness: 0.1,
    wireframeColor: 0x94a3b8,
  },
  'ct-sintered-dekton-12': {
    color: 0x334155, // Dekton Sintered Stone (high-tech charcoal slate)
    roughness: 0.3,
    metalness: 0.12,
    wireframeColor: 0x64748b,
  },
  'ct-wood-paraiso-30': {
    color: 0xd97706, // Solid Paraíso Wood (warm amber golden)
    roughness: 0.45,
    metalness: 0.05,
    wireframeColor: 0x92400e,
  },
  'ct-hpl-laminate-postformed-30': {
    color: 0x94a3b8, // Postformed HPL laminate (neutral mineral grey)
    roughness: 0.4,
    metalness: 0.05,
    wireframeColor: 0x475569,
  },
};

export const DEFAULT_COUNTERTOP_STYLE: PiecePbrStyle = {
  color: 0x475569, // Polished stone tone
  roughness: 0.3,
  metalness: 0.15,
  wireframeColor: 0x1e293b,
};

export const BOARD_PBR_STYLES: Record<string, PiecePbrStyle> = {
  'mat-egger-white-18': {
    color: 0xf8fafc, // Pure white melamine
    roughness: 0.45,
    metalness: 0.05,
    wireframeColor: 0x94a3b8,
  },
  'mat-egger-oak-18': {
    color: 0xd4b996, // Natural Halifax Oak melamine
    roughness: 0.55,
    metalness: 0.05,
    wireframeColor: 0x785338,
  },
  'mat-mdf-white-3': {
    color: 0xf1f5f9, // MDF White 3mm back
    roughness: 0.5,
    metalness: 0.02,
    wireframeColor: 0x94a3b8,
  },
  'mat-mdf-raw-3': {
    color: 0xc8ad8d, // Raw MDF / Fibrofácil crudo 3mm (warm wood fiber tone)
    roughness: 0.75,
    metalness: 0.0,
    wireframeColor: 0x8c6d48,
  },
  'mat-mdf-raw-6': {
    color: 0xc8ad8d, // Raw MDF / Fibrofácil crudo 6mm (warm wood fiber tone)
    roughness: 0.75,
    metalness: 0.0,
    wireframeColor: 0x8c6d48,
  },
};

export const DEFAULT_BOARD_STYLE: PiecePbrStyle = {
  color: 0xdfd7cd, // Classic warm wood/melamine board tone
  roughness: 0.55,
  metalness: 0.05,
  wireframeColor: 0x444746,
};

export const STAINLESS_STEEL_SINK_STYLE: PiecePbrStyle = {
  color: 0xa8b2c1, // Brushed stainless steel
  roughness: 0.25,
  metalness: 0.85,
  wireframeColor: 0x475569,
};

/**
 * Functional role categories for ergonomic 3D piece visualization (Stage 5 Step B).
 */
export type RoleCategory = 'sides' | 'base' | 'back' | 'top' | 'fronts' | 'other';

/**
 * Pure function that classifies a piece role string into one of the 6 canonical functional categories.
 *
 * @param role Piece role string (e.g. 'side-left', 'lateral_izq', 'drawer-front', 'shelf').
 * @returns Canonical category: 'sides', 'base', 'back', 'top', 'fronts', or 'other'.
 */
export function classifyPieceRoleCategory(role: string): RoleCategory {
  const r = role.toLowerCase().replace(/_/g, '-');

  // Structural rails/fajas belong to top carcase structure
  if (r.startsWith('rail') || r.includes('faja')) {
    return 'top';
  }

  // Fronts (drawers and doors)
  if (r.includes('front') || r.includes('frente') || r.includes('door') || r.includes('puerta')) {
    return 'fronts';
  }

  // Backings and rear panels
  if (r.includes('back') || r.includes('fondo') || r.includes('backing')) {
    return 'back';
  }

  // Base, bottom floors, tray bottoms
  if (r.includes('bottom') || r.includes('base') || r.includes('piso') || r.includes('tray-bottom')) {
    return 'base';
  }

  // Carcase roof / top / lids
  if (r.includes('top') || r.includes('techo') || r.includes('tapa')) {
    return 'top';
  }

  // Carcase sides and drawer box sides
  if (r.includes('side') || r.includes('lateral')) {
    return 'sides';
  }

  // Shelves, dividers, transoms, assembly gauges, etc.
  return 'other';
}

/**
 * High-contrast PBR palette mapping role categories in light and dark themes (Stage 5 Step B).
 * Adheres strictly to WCAG 2.1 AA and Material Design 3 surface tokens.
 */
export const ROLE_CATEGORY_PBR_STYLES: Record<'light' | 'dark', Record<RoleCategory, PiecePbrStyle>> = {
  light: {
    sides: {
      color: 0x4a6b82, // Slate blue: distinct from warm light background
      roughness: 0.45,
      metalness: 0.05,
      wireframeColor: 0x223543,
    },
    base: {
      color: 0x536859, // Deep sage olive: ground plane grounding
      roughness: 0.5,
      metalness: 0.05,
      wireframeColor: 0x25352a,
    },
    back: {
      color: 0xa26d50, // Warm terracotta / craft fiberboard
      roughness: 0.7,
      metalness: 0.02,
      wireframeColor: 0x543321,
    },
    top: {
      color: 0x3e7674, // Deep pine teal
      roughness: 0.45,
      metalness: 0.05,
      wireframeColor: 0x1b3b3a,
    },
    fronts: {
      color: 0xc4883b, // Luminous honey / warm amber oak
      roughness: 0.4,
      metalness: 0.08,
      wireframeColor: 0x694314,
    },
    other: {
      color: 0x6c698d, // Heather indigo for shelves and partitions
      roughness: 0.55,
      metalness: 0.05,
      wireframeColor: 0x34324a,
    },
  },
  dark: {
    sides: {
      color: 0x6ea2c7, // Luminous steel blue for dark theme
      roughness: 0.4,
      metalness: 0.08,
      wireframeColor: 0x9bc4e2,
    },
    base: {
      color: 0x7eb38b, // Fresh sage green
      roughness: 0.45,
      metalness: 0.05,
      wireframeColor: 0xa7d4b2,
    },
    back: {
      color: 0xd9926c, // Light terracotta
      roughness: 0.65,
      metalness: 0.02,
      wireframeColor: 0xefbca0,
    },
    top: {
      color: 0x5bbab6, // Bright sea teal
      roughness: 0.4,
      metalness: 0.08,
      wireframeColor: 0x8edcd9,
    },
    fronts: {
      color: 0xe5aa59, // Warm golden ochre
      roughness: 0.35,
      metalness: 0.1,
      wireframeColor: 0xf5d097,
    },
    other: {
      color: 0x9995c7, // Soft lilac mist
      roughness: 0.5,
      metalness: 0.05,
      wireframeColor: 0xc3c0e5,
    },
  },
};

/**
 * Resolves the realistic PBR styling for any 3D piece box in the viewport.
 * Clearly differentiates furniture boards (placas) from stone/quartz countertops (mesadas),
 * and supports functional role-based color coding when enabled.
 *
 * @param role Piece role identifier.
 * @param materialId Optional material ID from piece.
 * @param isSelected Whether the piece is actively selected.
 * @param colorByRole When true, applies the functional role color palette.
 * @param theme Color theme ('light' | 'dark').
 * @returns PiecePbrStyle with color, roughness, metalness, and wireframeColor.
 */
export function resolvePiecePbrStyle(
  role: string,
  materialId?: string,
  isSelected = false,
  colorByRole = false,
  theme: 'light' | 'dark' = 'light',
): PiecePbrStyle {
  if (isSelected) {
    return resolveSelectedPieceStyle(theme);
  }

  const isCountertopRole = role === 'countertop' || role.startsWith('countertop-');
  if (isCountertopRole) {
    if (materialId && COUNTERTOP_PBR_STYLES[materialId]) {
      return COUNTERTOP_PBR_STYLES[materialId]!;
    }
    return DEFAULT_COUNTERTOP_STYLE;
  }

  if (colorByRole) {
    const category = classifyPieceRoleCategory(role);
    const themeStyles = ROLE_CATEGORY_PBR_STYLES[theme] ?? ROLE_CATEGORY_PBR_STYLES.light;
    return themeStyles[category];
  }

  if (materialId && BOARD_PBR_STYLES[materialId]) {
    return BOARD_PBR_STYLES[materialId]!;
  }

  return DEFAULT_BOARD_STYLE;
}
