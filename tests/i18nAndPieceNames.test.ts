import { describe, it, expect } from 'vitest';
import { getFriendlyPieceName } from '../src/resolver/assemblySheet';
import { translateRoleKey } from '../src/locales';
import {
  translateAssemblyPhase,
  translateHardwareType,
  getActiveDictionary,
  esDictionary,
} from '../src/i18n';

describe('i18n and Piece Friendly Names', () => {
  describe('getFriendlyPieceName drawer-specific precedence', () => {
    it('prioritizes drawer box parts over generic cabinet pieces using canonical locale SSOT', () => {
      // Drawer side box must be named "Lateral de cajón", not generic "Lateral"
      expect(getFriendlyPieceName('drawer-box-side')).toBe('Lateral de cajón');
      expect(getFriendlyPieceName('drawer-box-side-left')).toBe('Lateral izquierdo de cajón');
      expect(getFriendlyPieceName('drawer-box-side-right')).toBe('Lateral derecho de cajón');
      expect(getFriendlyPieceName('drawer-side')).toBe('Lateral de cajón');

      // Drawer bottom must be named "Fondo de cajón", not "Piso / Base"
      expect(getFriendlyPieceName('drawer-box-bottom')).toBe('Fondo de cajón');
      expect(getFriendlyPieceName('drawer-bottom')).toBe('Fondo de cajón');

      // Drawer back/counterfront must be named "Trasera de cajón", not "Fondo posterior"
      expect(getFriendlyPieceName('drawer-box-back')).toBe('Trasera de cajón');
      expect(getFriendlyPieceName('drawer-back')).toBe('Trasera de cajón');
      expect(getFriendlyPieceName('drawer-counterfront')).toBe('Trasera de cajón');

      // Drawer front vs inner drawer box counter-front (distinct names to avoid collision)
      expect(getFriendlyPieceName('drawer-front')).toBe('Frente de cajón');
      expect(getFriendlyPieceName('drawer-box-front')).toBe('Contrafrente de cajón');
    });

    it('correctly names standard carcass cabinet components matching es.json SSOT', () => {
      expect(getFriendlyPieceName('side-left')).toBe('Lateral izquierdo');
      expect(getFriendlyPieceName('side-right')).toBe('Lateral derecho');
      expect(getFriendlyPieceName('side')).toBe('Lateral');
      expect(getFriendlyPieceName('bottom')).toBe('Piso / Base');
      expect(getFriendlyPieceName('top')).toBe('Techo / Tapa');
      expect(getFriendlyPieceName('shelf')).toBe('Estante');
      expect(getFriendlyPieceName('back')).toBe('Fondo posterior');
      expect(getFriendlyPieceName('rail')).toBe('Faja de amarre');
    });

    it('translates all modular piece roles via locale dictionary including rail and structural parts', () => {
      expect(translateRoleKey('rail')).toBe('Faja de amarre');
      expect(translateRoleKey('rail-vertical')).toBe('Faja vertical');
      expect(translateRoleKey('plinth-front')).toBe('Zócalo frontal');
      expect(translateRoleKey('brace-middle')).toBe('Refuerzo central');
      expect(translateRoleKey('hanging-rail')).toBe('Riel de colgado');
      expect(translateRoleKey('hinge-spacer')).toBe('Suplemento de bisagra');
      expect(translateRoleKey('false-front')).toBe('Frente fijo');
      expect(translateRoleKey('wall-shelf')).toBe('Estante de pared amurado');
    });
  });

  describe('Assembly Guide and PDF localization', () => {
    it('translates all assembly step phases to Spanish', () => {
      expect(translateAssemblyPhase('preparation')).toBe('Preparación');
      expect(translateAssemblyPhase('pre-assembly')).toBe('Pre-armado');
      expect(translateAssemblyPhase('carcass')).toBe('Estructura');
      expect(translateAssemblyPhase('shelves')).toBe('Estantes');
      expect(translateAssemblyPhase('rails')).toBe('Fajas / Amarres');
      expect(translateAssemblyPhase('squaring')).toBe('Escuadrado');
      expect(translateAssemblyPhase('drawers')).toBe('Cajones');
      expect(translateAssemblyPhase('doors')).toBe('Puertas');
      expect(translateAssemblyPhase('inspection')).toBe('Inspección final');
    });

    it('translates all BOM hardware types to Spanish', () => {
      expect(translateHardwareType('confirmat')).toBe('Tornillo Confirmat');
      expect(translateHardwareType('minifix')).toBe('Perno Minifix');
      expect(translateHardwareType('slide')).toBe('Guía corredera');
      expect(translateHardwareType('shelf-pin')).toBe('Soporte para estante');
      expect(translateHardwareType('shelf_pin')).toBe('Soporte para estante');
      expect(translateHardwareType('hinge')).toBe('Bisagra cazoleta');
      expect(translateHardwareType('hinge-plate')).toBe('Base de bisagra');
      expect(translateHardwareType('dowel')).toBe('Tarugo de madera');
    });

    it('exposes the active dictionary with es as default', () => {
      const dict = getActiveDictionary();
      expect(dict.locale).toBe('es');
      expect(dict).toBe(esDictionary);
    });
  });
});
