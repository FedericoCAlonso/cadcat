import es from './es.json';
import en from './en.json';

export type LocaleCode = 'es' | 'en';

export const LOCALES: Record<LocaleCode, Record<string, unknown>> = {
  es,
  en,
};

let currentLocale: LocaleCode = 'es';

/**
 * Gets the current active locale code.
 */
export function getLocale(): LocaleCode {
  return currentLocale;
}

/**
 * Sets the current active locale code.
 */
export function setLocale(locale: LocaleCode): void {
  if (LOCALES[locale]) {
    currentLocale = locale;
  }
}

/**
 * Retrieves a nested value from a dictionary using dot-notation.
 */
function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return typeof current === 'string' ? current : undefined;
}

/**
 * Translates a key path using the active locale dictionary.
 * Supports string interpolation for parameters: `{paramName}`.
 * Falls back to Spanish (es), then to the raw key if not found.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const activeDict = LOCALES[currentLocale] ?? es;
  let text = getNestedValue(activeDict, key);

  if (text === undefined && currentLocale !== 'es') {
    text = getNestedValue(es, key);
  }

  if (text === undefined) {
    return key;
  }

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }

  return text;
}

const ROLE_ALIASES: Record<string, string> = {
  lateral_izq: 'side-left',
  'lateral-izq': 'side-left',
  side_left: 'side-left',
  'lateral-left': 'side-left',
  lateral_der: 'side-right',
  'lateral-der': 'side-right',
  side_right: 'side-right',
  'lateral-right': 'side-right',
  base: 'bottom',
  piso: 'bottom',
  techo: 'top',
  tapa: 'top',
  fondo: 'back',
  estante: 'shelf',
  division: 'partition',
  frente_cajon: 'drawer-front',
  lateral_cajon: 'drawer-side',
  fondo_cajon: 'drawer-bottom',
};

/**
 * Translates a canonical or aliased piece role to localized workshop terminology.
 */
export function translateRoleKey(role: string): string {
  const cleanRole = role.replace(/^\[[^\]]+\]\s*/, '').trim();
  const canonicalRole = ROLE_ALIASES[cleanRole] ?? cleanRole;
  const key = `roles.${canonicalRole}`;
  const translated = t(key);
  return translated !== key ? translated : cleanRole;
}
