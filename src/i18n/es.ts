import type { I18nDictionary } from './types';
import esLocale from '../locales/es.json';

/**
 * Spanish (es-AR / es-ES) workshop dictionary for CadCat.
 * Single Source of Truth: hydrated directly from src/locales/es.json.
 */
export const esDictionary: I18nDictionary = {
  locale: 'es',
  phases: esLocale.assembly.phases,
  hardware: esLocale.assembly.hardware,
  common: esLocale.assembly.common,
};
