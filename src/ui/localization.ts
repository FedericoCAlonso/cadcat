/**
 * Spanish localization dictionary and formatting helpers for CadCat.
 * Provides workshop and carpentry terminology for UI display.
 */
import { t, getLocale, setLocale, type LocaleCode } from '../locales';

export { t, getLocale, setLocale, type LocaleCode };

/**
 * Canonical aliases mapping common workshop piece identifiers/roles to standardized locale keys.
 */
const ROLE_ALIASES: Record<string, string> = {
  'lateral_izq': 'side-left',
  'lateral-izq': 'side-left',
  'side_left': 'side-left',
  'lateral-left': 'side-left',
  'lateral_der': 'side-right',
  'lateral-der': 'side-right',
  'side_right': 'side-right',
  'lateral-right': 'side-right',
  'base': 'bottom',
  'piso': 'bottom',
  'techo': 'top',
  'tapa': 'top',
  'fondo': 'back',
  'estante': 'shelf',
  'division': 'partition',
  'frente_cajon': 'drawer-front',
  'lateral_cajon': 'drawer-side',
  'fondo_cajon': 'drawer-bottom',
};

/**
 * Translates a piece role to workshop terminology.
 */
export function translatePieceRole(role: string): string {
  const canonicalRole = ROLE_ALIASES[role] ?? role;
  const key = `roles.${canonicalRole}`;
  const translated = t(key);
  return translated !== key ? translated : role;
}

/**
 * Translates a template identifier to workshop terminology.
 */
export function translateTemplateName(id: string, fallbackName: string): string {
  const key = `templates.${id}`;
  const translated = t(key);
  return translated !== key ? translated : fallbackName;
}

/**
 * Translates an edgeband kind to workshop terminology.
 */
export function translateEdgeBandKind(kind: string): string {
  const key = `edgebands.${kind}`;
  const translated = t(key);
  return translated !== key ? translated : kind;
}
