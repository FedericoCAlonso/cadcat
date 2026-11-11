/**
 * Core type definitions for CadCat Internationalization (i18n).
 * Provides strongly-typed translation dictionaries for assembly phases,
 * hardware specifications, piece roles, and workshop UI strings.
 */

export type AssemblyPhase =
  | 'preparation'
  | 'pre-assembly'
  | 'carcass'
  | 'shelves'
  | 'rails'
  | 'squaring'
  | 'drawers'
  | 'doors'
  | 'inspection';

export type HardwareType =
  | 'confirmat'
  | 'minifix'
  | 'slide'
  | 'shelf_pin'
  | 'shelf-pin'
  | 'hinge'
  | 'hinge-plate'
  | 'dowel'
  | 'screw'
  | 'wood-screw'
  | 'euro-screw'
  | 'bracket';

export interface I18nDictionary {
  locale: string;
  phases: Record<AssemblyPhase, string>;
  hardware: Record<string, string>;
  common: {
    phaseLabel: string;
    datumOrigin: string;
    width: string;
    height: string;
    thickness: string;
  };
}
