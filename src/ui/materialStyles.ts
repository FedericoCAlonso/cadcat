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

export const M3_SELECTED_PIECE_STYLE: PiecePbrStyle = {
  color: 0x56705f, // M3 sys primary (salvia #56705F)
  roughness: 0.45,
  metalness: 0.1,
  wireframeColor: 0xffffff,
};

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
 * Resolves the realistic PBR styling for any 3D piece box in the viewport.
 * Clearly differentiates furniture boards (placas) from stone/quartz countertops (mesadas).
 */
export function resolvePiecePbrStyle(
  role: string,
  materialId?: string,
  isSelected = false,
): PiecePbrStyle {
  if (isSelected) {
    return M3_SELECTED_PIECE_STYLE;
  }

  const isCountertopRole = role === 'countertop' || role.startsWith('countertop-');
  if (isCountertopRole) {
    if (materialId && COUNTERTOP_PBR_STYLES[materialId]) {
      return COUNTERTOP_PBR_STYLES[materialId]!;
    }
    return DEFAULT_COUNTERTOP_STYLE;
  }

  if (materialId && BOARD_PBR_STYLES[materialId]) {
    return BOARD_PBR_STYLES[materialId]!;
  }

  return DEFAULT_BOARD_STYLE;
}
