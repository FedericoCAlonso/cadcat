/**
 * Spanish localization dictionary and formatting helpers for CadCat.
 * Provides workshop and carpentry terminology for UI display.
 */
import { t, getLocale, setLocale, type LocaleCode } from '../locales';

export { t, getLocale, setLocale, type LocaleCode };

/**
 * Translates a piece role to workshop terminology.
 */
export function translatePieceRole(role: string): string {
  const key = `roles.${role}`;
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
