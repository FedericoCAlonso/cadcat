/**
 * Argentine Spanish localization dictionary and formatting helpers for Mobilius.
 * Provides workshop and carpentry terminology for UI display.
 */

export const ES_AR_PIECE_ROLES: Record<string, string> = {
  'side-left': 'Lateral izquierdo',
  'side-right': 'Lateral derecho',
  'bottom': 'Piso / Base',
  'top': 'Techo / Tapa',
  'back': 'Fondo / Trasera',
  'shelf': 'Estante',
  'partition': 'División vertical',
  'rail-front': 'Faja delantera',
  'rail-back': 'Faja trasera',
  'drawer-front': 'Frente de cajón',
  'drawer-side': 'Lateral de cajón',
  'drawer-box-front': 'Contrafrente de cajón',
  'drawer-box-back': 'Trasera de cajón',
  'drawer-bottom': 'Fondo de cajón',
  'door-left': 'Puerta izquierda',
  'door-right': 'Puerta derecha',
  'door-single': 'Puerta batiente',
  'assembly-gauge': 'Calibre de armado (Auxiliar)',
  'transom': 'Travesaño divisor',
  'tray-bottom': 'Piso de bandeja extraíble',
  'tray-lip-side': 'Faja lateral de bandeja',
  'tray-lip-front': 'Faja frontal de bandeja',
  'tray-lip-back': 'Faja trasera de bandeja',
  'shelf-brace': 'Refuerzo vertical anti-flexión',
  'bifold-leaf': 'Hoja articulada (Bi-Fold)',
};

export const ES_AR_TEMPLATE_NAMES: Record<string, string> = {
  'base-cabinet': 'Bajo mesada (1 estante)',
  'door-cabinet': 'Mueble con puertas batientes y estante',
  'drawer-unit': 'Cajonera (3 cajones)',
  'partition-cabinet': 'Mueble 2 vanos con división',
  'modular-empty': 'Modular: Hueco libre / Casco',
  'modular-drawer-unit-3': 'Modular: Cajonera 3 cajones (fr + mm)',
  'modular-door-cabinet': 'Modular: Alacena 2 puertas',
  'modular-partition-combo': 'Modular: 2 vanos (Estantes + Cajones)',
  'modular-pullout-tray': 'Modular: Bandeja extraíble telescópica',
  'modular-bifold-closure': 'Modular: Puerta plegable bi-fold',
};

export const ES_AR_EDGEBAND_KINDS: Record<string, string> = {
  adhesive: 'Melamínico / Adhesivo',
  'aluminium-profile': 'Perfil de aluminio',
  veneer: 'PVC / Enchapado',
  rod: 'Varilla rígida',
};

/**
 * Translates a piece role to Argentine workshop terminology.
 */
export function translatePieceRole(role: string): string {
  return ES_AR_PIECE_ROLES[role] ?? role;
}

/**
 * Translates a template identifier to Argentine workshop terminology.
 */
export function translateTemplateName(id: string, fallbackName: string): string {
  return ES_AR_TEMPLATE_NAMES[id] ?? fallbackName;
}

/**
 * Translates an edgeband kind to Argentine workshop terminology.
 */
export function translateEdgeBandKind(kind: string): string {
  return ES_AR_EDGEBAND_KINDS[kind] ?? kind;
}
