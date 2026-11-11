import { esDictionary } from './es';
import type { AssemblyPhase, I18nDictionary } from './types';

let currentDictionary: I18nDictionary = esDictionary;

/**
 * Configure the active i18n dictionary. Defaults to Spanish (esDictionary).
 */
export function setDictionary(dict: I18nDictionary): void {
  currentDictionary = dict;
}

/**
 * Translate an assembly guide step phase into the localized human-readable name.
 *
 * @param phase Phase key (e.g. 'preparation', 'carcass', 'drawers')
 * @returns Localized label (e.g. 'Preparación', 'Estructura', 'Cajones')
 */
export function translateAssemblyPhase(phase: string): string {
  const norm = phase.toLowerCase() as AssemblyPhase;
  if (norm in currentDictionary.phases) {
    return currentDictionary.phases[norm];
  }
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

/**
 * Translate a hardware type key into its localized technical name.
 *
 * @param type Hardware key (e.g. 'confirmat', 'slide', 'minifix')
 * @returns Localized name (e.g. 'Tornillo Confirmat', 'Guía corredera')
 */
export function translateHardwareType(type: string): string {
  const norm = type.toLowerCase();
  if (norm in currentDictionary.hardware) {
    return currentDictionary.hardware[norm]!;
  }
  return type.toUpperCase();
}

/**
 * Access the active dictionary directly.
 */
export function getActiveDictionary(): I18nDictionary {
  return currentDictionary;
}

export * from './types';
export { esDictionary } from './es';
