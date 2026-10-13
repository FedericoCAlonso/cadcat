import { type ModularModuleDefinition } from './types';

export interface ModularPreset {
  id: string;
  name: string;
  description: string;
  defaultDimensions: { width: number; height: number; depth: number };
  createDefinition: (
    dims?: { width?: number; height?: number; depth?: number },
    materials?: {
      carcassMaterialId?: string;
      frontsMaterialId?: string;
      drawerBoxesMaterialId?: string;
      backingsMaterialId?: string;
    },
    edgeBandId?: string,
  ) => ModularModuleDefinition;
}

export const MODULAR_PRESETS: ModularPreset[] = [
  {
    id: 'preset-empty',
    name: 'Módulo Vacío / Hueco Libre',
    description: 'Estructura perimetral con fajas de amarre superiores y fondo ranurado.',
    defaultDimensions: { width: 600, height: 720, depth: 560 },
    createDefinition: (dims, mats, ebId) => ({
      id: 'module-preset-empty',
      carcass: {
        width: dims?.width ?? 600,
        height: dims?.height ?? 720,
        depth: dims?.depth ?? 560,
        jointPriority: 'lateral-over-bottom',
        roofType: 'front-back-rails',
        railWidthMm: 80,
        hasBacking: true,
      },
      bays: [{ type: 'empty' }],
      materials: {
        carcassMaterialId: mats?.carcassMaterialId ?? 'mat-egger-white-18',
        frontsMaterialId: mats?.frontsMaterialId ?? 'mat-egger-white-18',
        drawerBoxesMaterialId: mats?.drawerBoxesMaterialId ?? 'mat-egger-white-18',
        backingsMaterialId: mats?.backingsMaterialId ?? 'mat-egger-white-18',
      },
      edgeBandId: ebId,
    }),
  },
  {
    id: 'preset-base-shelf',
    name: 'Bajo Mesada Clásico (1 Estante)',
    description: 'Casco con fajas de amarre superiores y 1 estante regulable central.',
    defaultDimensions: { width: 600, height: 720, depth: 560 },
    createDefinition: (dims, mats, ebId) => ({
      id: 'module-preset-base-shelf',
      carcass: {
        width: dims?.width ?? 600,
        height: dims?.height ?? 720,
        depth: dims?.depth ?? 560,
        jointPriority: 'lateral-over-bottom',
        roofType: 'front-back-rails',
        railWidthMm: 80,
        hasBacking: true,
      },
      bays: [
        {
          type: 'shelves',
          count: 1,
          shelfType: 'adjustable',
          setbackMm: 20,
        },
      ],
      materials: {
        carcassMaterialId: mats?.carcassMaterialId ?? 'mat-egger-white-18',
        frontsMaterialId: mats?.frontsMaterialId ?? 'mat-egger-white-18',
        drawerBoxesMaterialId: mats?.drawerBoxesMaterialId ?? 'mat-egger-white-18',
        backingsMaterialId: mats?.backingsMaterialId ?? 'mat-egger-white-18',
      },
      edgeBandId: ebId,
    }),
  },
  {
    id: 'preset-drawer-unit-3',
    name: 'Cajonera 3 Cajones (Cubertero + 2 Olleros)',
    description: 'Cajón superior fijo de 140mm y 2 cajones inferiores proporcionales en 1fr 1fr con frentes aplicados.',
    defaultDimensions: { width: 500, height: 720, depth: 560 },
    createDefinition: (dims, mats, ebId) => ({
      id: 'module-preset-drawer-unit-3',
      carcass: {
        width: dims?.width ?? 500,
        height: dims?.height ?? 720,
        depth: dims?.depth ?? 560,
        jointPriority: 'lateral-over-bottom',
        roofType: 'front-back-rails',
        railWidthMm: 80,
        hasBacking: true,
      },
      bays: [
        {
          type: 'drawer-stack',
          drawerTracks: [
            { type: 'fixed', valueMm: 140 },
            { type: 'fractional', valueFr: 1 },
            { type: 'fractional', valueFr: 1 },
          ],
          frontMount: 'applied',
          slideType: 'telescopic',
          gapMm: 2.5,
        },
      ],
      materials: {
        carcassMaterialId: mats?.carcassMaterialId ?? 'mat-egger-white-18',
        frontsMaterialId: mats?.frontsMaterialId ?? 'mat-egger-oak-18',
        drawerBoxesMaterialId: mats?.drawerBoxesMaterialId ?? 'mat-egger-white-18',
        backingsMaterialId: mats?.backingsMaterialId ?? 'mat-egger-white-18',
      },
      edgeBandId: ebId,
    }),
  },
  {
    id: 'preset-door-cabinet-2',
    name: 'Alacena / Mueble 2 Puertas',
    description: 'Mueble con techo macizo, 1 estante interior y 2 puertas batientes full-overlay.',
    defaultDimensions: { width: 800, height: 720, depth: 350 },
    createDefinition: (dims, mats, ebId) => ({
      id: 'module-preset-door-cabinet-2',
      carcass: {
        width: dims?.width ?? 800,
        height: dims?.height ?? 720,
        depth: dims?.depth ?? 350,
        jointPriority: 'lateral-over-bottom',
        roofType: 'solid-panel',
        hasBacking: true,
      },
      bays: [
        {
          type: 'doors',
          count: 2,
          mountType: 'full-overlay',
        },
      ],
      materials: {
        carcassMaterialId: mats?.carcassMaterialId ?? 'mat-egger-white-18',
        frontsMaterialId: mats?.frontsMaterialId ?? 'mat-egger-oak-18',
        drawerBoxesMaterialId: mats?.drawerBoxesMaterialId ?? 'mat-egger-white-18',
        backingsMaterialId: mats?.backingsMaterialId ?? 'mat-egger-white-18',
      },
      edgeBandId: ebId,
    }),
  },
  {
    id: 'preset-partition-combo',
    name: 'Módulo Combinado 2 Vanos (Estantes + Cajones)',
    description: 'División vertical en 2 vanos: izquierdo con 2 estantes y derecho con 3 cajones.',
    defaultDimensions: { width: 900, height: 720, depth: 560 },
    createDefinition: (dims, mats, ebId) => ({
      id: 'module-preset-partition-combo',
      carcass: {
        width: dims?.width ?? 900,
        height: dims?.height ?? 720,
        depth: dims?.depth ?? 560,
        jointPriority: 'lateral-over-bottom',
        roofType: 'front-back-rails',
        railWidthMm: 80,
        hasBacking: true,
      },
      grid: {
        axis: 'horizontal',
        tracks: [
          { type: 'fractional', valueFr: 1 },
          { type: 'fractional', valueFr: 1 },
        ],
        dividerThicknessMm: 18,
      },
      bays: [
        {
          type: 'shelves',
          count: 2,
          shelfType: 'adjustable',
          setbackMm: 20,
        },
        {
          type: 'drawer-stack',
          drawerTracks: [
            { type: 'fractional', valueFr: 1 },
            { type: 'fractional', valueFr: 1 },
            { type: 'fractional', valueFr: 1 },
          ],
          frontMount: 'applied',
          slideType: 'telescopic',
        },
      ],
      materials: {
        carcassMaterialId: mats?.carcassMaterialId ?? 'mat-egger-white-18',
        frontsMaterialId: mats?.frontsMaterialId ?? 'mat-egger-oak-18',
        drawerBoxesMaterialId: mats?.drawerBoxesMaterialId ?? 'mat-egger-white-18',
        backingsMaterialId: mats?.backingsMaterialId ?? 'mat-egger-white-18',
      },
      edgeBandId: ebId,
    }),
  },
  {
    id: 'preset-pullout-tray',
    name: 'Bajo Mesada con Bandeja Extraíble',
    description: 'Módulo con 1 bandeja extraíble con correderas telescópicas y 1 estante superior.',
    defaultDimensions: { width: 600, height: 720, depth: 560 },
    createDefinition: (dims, mats, ebId) => ({
      id: 'module-preset-pullout-tray',
      carcass: {
        width: dims?.width ?? 600,
        height: dims?.height ?? 720,
        depth: dims?.depth ?? 560,
        jointPriority: 'lateral-over-bottom',
        roofType: 'front-back-rails',
        railWidthMm: 80,
        hasBacking: true,
      },
      bays: [
        {
          type: 'pull-out-tray',
          lipHeightMm: 45,
          slideType: 'telescopic',
        },
      ],
      materials: {
        carcassMaterialId: mats?.carcassMaterialId ?? 'mat-egger-white-18',
        frontsMaterialId: mats?.frontsMaterialId ?? 'mat-egger-white-18',
        drawerBoxesMaterialId: mats?.drawerBoxesMaterialId ?? 'mat-egger-white-18',
        backingsMaterialId: mats?.backingsMaterialId ?? 'mat-egger-white-18',
      },
      edgeBandId: ebId,
    }),
  },
  {
    id: 'preset-bifold-closure',
    name: 'Alacena con Puerta Elevable Plegable (Bi-Fold)',
    description: 'Alacena con techo macizo y puerta doble plegable de apertura vertical.',
    defaultDimensions: { width: 800, height: 700, depth: 350 },
    createDefinition: (dims, mats, ebId) => ({
      id: 'module-preset-bifold-closure',
      carcass: {
        width: dims?.width ?? 800,
        height: dims?.height ?? 700,
        depth: dims?.depth ?? 350,
        jointPriority: 'lateral-over-bottom',
        roofType: 'solid-panel',
        hasBacking: true,
      },
      bays: [
        {
          type: 'bi-fold-closure',
          leafTracks: [
            { type: 'fractional', valueFr: 1 },
            { type: 'fractional', valueFr: 1 },
          ],
          hingeType: 'aventos',
          openingDirection: 'vertical-lift',
        },
      ],
      materials: {
        carcassMaterialId: mats?.carcassMaterialId ?? 'mat-egger-white-18',
        frontsMaterialId: mats?.frontsMaterialId ?? 'mat-egger-oak-18',
        drawerBoxesMaterialId: mats?.drawerBoxesMaterialId ?? 'mat-egger-white-18',
        backingsMaterialId: mats?.backingsMaterialId ?? 'mat-egger-white-18',
      },
      edgeBandId: ebId,
    }),
  },
];

export function getModularPresetById(presetId: string): ModularPreset {
  const found = MODULAR_PRESETS.find((p) => p.id === presetId);
  return found ?? MODULAR_PRESETS[0]!;
}
