import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { BaseStructureEditor } from '../src/ui/BaseStructureEditor';

describe('BaseStructureEditor Component (Point 7)', () => {
  it('renders all structure configuration sections and inputs', () => {
    const html = renderToString(
      <BaseStructureEditor
        jointPriority="lateral-over-bottom"
        roofType="front-back-rails"
        railOrientation="vertical"
        hasMiddleBrace={true}
        middleBraceWidthMm={80}
        hasWallHangingRail={true}
        wallHangingRailWidthMm={100}
        hasPlinth={true}
        plinthHeightMm={100}
        plinthSetbackMm={50}
        hasBacking={true}
        onJointPriorityChange={vi.fn()}
        onRoofTypeChange={vi.fn()}
        onRailOrientationChange={vi.fn()}
        onHasMiddleBraceChange={vi.fn()}
        onMiddleBraceWidthChange={vi.fn()}
        onHasWallHangingRailChange={vi.fn()}
        onWallHangingRailWidthChange={vi.fn()}
        onHasPlinthChange={vi.fn()}
        onPlinthHeightChange={vi.fn()}
        onPlinthSetbackChange={vi.fn()}
        onHasBackingChange={vi.fn()}
        onSaveAsBaseTemplate={vi.fn()}
      />,
    );

    expect(html).toContain('Unión y Ensamble Estructural');
    expect(html).toContain('Prioridad de Costados / Piso:');
    expect(html).toContain('Costado pasa (Lateral continuo)');
    expect(html).toContain('Piso pasa (Fondo continuo)');
    expect(html).toContain('Tipo de Techo:');
    expect(html).toContain('Fajas / Travesaños (Bajo mesada)');
    expect(html).toContain('Travesaños y Refuerzos Superiores');
    expect(html).toContain('Vertical de Canto (Mayor resistencia)');
    expect(html).toContain('Refuerzo Central entre Fajas');
    expect(html).toContain('Faja Posterior de Amarre / Colgado');
    expect(html).toContain('Zócalo / Plinto Estructural');
    expect(html).toContain('Fondo de Módulo (Ranurado 3mm)');
    expect(html).toContain('Guardar Estructura como Módulo Base');
  });
});
