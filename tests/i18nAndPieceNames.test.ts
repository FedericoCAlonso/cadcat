import { describe, it, expect } from 'vitest';
import { getFriendlyPieceName } from '../src/resolver/assemblySheet';
import {
  translateAssemblyPhase,
  translateHardwareType,
  getActiveDictionary,
  esDictionary,
} from '../src/i18n';

describe('i18n and Piece Friendly Names', () => {
  describe('getFriendlyPieceName drawer-specific precedence', () => {
    it('prioritizes drawer box parts over generic cabinet pieces', () => {
      // Drawer side box must be named "Lateral de Cajón", not generic "Lateral"
      expect(getFriendlyPieceName('drawer-box-side')).toBe('Lateral de Cajón');
      expect(getFriendlyPieceName('drawer-box-side-left')).toBe('Lateral Izquierdo de Cajón');
      expect(getFriendlyPieceName('drawer-box-side-right')).toBe('Lateral Derecho de Cajón');
      expect(getFriendlyPieceName('drawer-side')).toBe('Lateral de Cajón');

      // Drawer bottom must be named "Fondo de Cajón", not "Base / Piso"
      expect(getFriendlyPieceName('drawer-box-bottom')).toBe('Fondo de Cajón');
      expect(getFriendlyPieceName('drawer-bottom')).toBe('Fondo de Cajón');

      // Drawer back/counterfront must be named "Trasera de Cajón", not "Fondo"
      expect(getFriendlyPieceName('drawer-box-back')).toBe('Trasera de Cajón');
      expect(getFriendlyPieceName('drawer-back')).toBe('Trasera de Cajón');
      expect(getFriendlyPieceName('drawer-counterfront')).toBe('Trasera de Cajón');

      // Drawer front
      expect(getFriendlyPieceName('drawer-front')).toBe('Frente de Cajón');
      expect(getFriendlyPieceName('drawer-box-front')).toBe('Frente de Cajón');
    });

    it('correctly names standard carcass cabinet components', () => {
      expect(getFriendlyPieceName('side-left')).toBe('Lateral Izquierdo');
      expect(getFriendlyPieceName('side-right')).toBe('Lateral Derecho');
      expect(getFriendlyPieceName('side')).toBe('Lateral');
      expect(getFriendlyPieceName('bottom')).toBe('Base / Piso');
      expect(getFriendlyPieceName('top')).toBe('Tapa Superior / Techo');
      expect(getFriendlyPieceName('shelf')).toBe('Estante');
      expect(getFriendlyPieceName('back')).toBe('Fondo');
      expect(getFriendlyPieceName('rail')).toBe('Faja / Travesaño');
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
