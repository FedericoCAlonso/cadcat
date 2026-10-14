import { describe, it, expect } from 'vitest';
import {
  buildBaseCabinet,
  buildDrawerUnit,
  TEMPLATES,
  getTemplateById,
} from '../src/resolver';
import type { Material, EdgeBand } from '../src/model';

const sampleMaterial: Material = {
  schemaVersion: 1,
  id: 'mat-egger-white-18',
  name: 'Egger White 18mm',
  thicknessMm: 18,
  sheetSizeMm: { length: 2800, width: 2070 },
  hasGrain: false,
  milling: { hidden: 'yes', visible: 'no', onStructuralPiece: 'limited' },
};

const sampleEdgeBands: EdgeBand[] = [
  {
    schemaVersion: 1,
    id: 'eb-white-08',
    kind: 'adhesive',
    thicknessMm: 0.8,
    pricePerMeter: 1.5,
  },
];

describe('Template 1: Base Cabinet (Section 9 Task 9)', () => {
  it('generates two sides, bottom, front/back rails, back panel, and one shelf', () => {
    const { module, resolvedPieces } = buildBaseCabinet(
      { width: 600, height: 800, depth: 560 },
      sampleMaterial,
      sampleEdgeBands,
      'eb-white-08',
    );

    expect(module.id).toBe('module-base-cabinet');
    // Exactly 7 pieces: 2 sides, bottom, shelf, 2 rails, back
    expect(resolvedPieces).toHaveLength(7);

    const roles = resolvedPieces.map((p) => p.role);
    expect(roles).toContain('side-left');
    expect(roles).toContain('side-right');
    expect(roles).toContain('bottom');
    expect(roles).toContain('shelf');
    expect(roles).toContain('rail-front');
    expect(roles).toContain('rail-back');
    expect(roles).toContain('back');

    // Finished dimensions check (T = 18 mm)
    // Inner span: 600 - 36 = 564 mm
    const bottom = resolvedPieces.find((p) => p.role === 'bottom');
    expect(bottom?.dimensionsMm.width).toBe(564);
    expect(bottom?.dimensionsMm.height).toBe(560);

    const shelf = resolvedPieces.find((p) => p.role === 'shelf');
    expect(shelf?.dimensionsMm.width).toBe(564);
    expect(shelf?.dimensionsMm.height).toBe(540);

    const rail = resolvedPieces.find((p) => p.role === 'rail-front');
    expect(rail?.dimensionsMm.width).toBe(564);
    expect(rail?.dimensionsMm.height).toBe(100);
  });

  it('updates all dependent piece dimensions when width parameter changes', () => {
    const { resolvedPieces: pieces600 } = buildBaseCabinet(
      { width: 600, height: 800, depth: 560 },
      sampleMaterial,
    );
    const bottom600 = pieces600.find((p) => p.role === 'bottom');
    expect(bottom600?.dimensionsMm.width).toBe(564);

    const { resolvedPieces: pieces900 } = buildBaseCabinet(
      { width: 900, height: 800, depth: 560 },
      sampleMaterial,
    );
    const bottom900 = pieces900.find((p) => p.role === 'bottom');
    // 900 - 36 = 864 mm
    expect(bottom900?.dimensionsMm.width).toBe(864);
  });
});

describe('Template 2: Drawer Unit (Section 9 Task 9)', () => {
  it('generates carcase and 3 drawer sub-assemblies with slide clearances', () => {
    const { module, resolvedPieces } = buildDrawerUnit(
      { width: 600, height: 800, depth: 560, drawerCount: 3 },
      sampleMaterial,
      sampleEdgeBands,
      'eb-white-08',
    );

    expect(module.id).toBe('module-drawer-unit');
    // 3 sub-assemblies
    expect(module.subAssemblies).toHaveLength(3);
    expect(module.subAssemblies[0]?.templateId).toBe('drawer');
    expect(module.subAssemblies[1]?.templateId).toBe('drawer');
    expect(module.subAssemblies[2]?.templateId).toBe('drawer');

    // Total pieces: 6 carcase pieces + 3 * 6 drawer pieces = 24 pieces
    expect(resolvedPieces).toHaveLength(24);

    // Inner carcase: 600 - 36 = 564 mm
    // Drawer box width: 564 - 25.4 (slide clearance) = 539 mm (rounded)
    const sub1 = module.subAssemblies[0]!;
    expect(sub1.parameters['boxWidth']).toBe(539);

    const drawerBottom = resolvedPieces.find((p) => p.id === 'drawer-box-bottom-1');
    expect(drawerBottom).toBeDefined();
    // Bottom sits inside box sides (T = 18): 539 - 36 = 503 mm
    expect(drawerBottom?.dimensionsMm.width).toBe(503);
  });

  it('updates drawer box widths when drawer unit cabinet width changes', () => {
    const { module: modA } = buildDrawerUnit(
      { width: 600, height: 800, depth: 560, drawerCount: 3 },
      sampleMaterial,
    );
    expect(modA.subAssemblies[0]?.parameters['boxWidth']).toBe(539);

    const { module: modB } = buildDrawerUnit(
      { width: 800, height: 800, depth: 560, drawerCount: 3 },
      sampleMaterial,
    );
    // Inner carcase: 800 - 36 = 764 mm
    // Drawer box width: 764 - 25.4 = 739 mm (rounded)
    expect(modB.subAssemblies[0]?.parameters['boxWidth']).toBe(739);
  });
});

describe('Template Registry', () => {
  it('registers only the base empty carcass template', () => {
    expect(TEMPLATES).toHaveLength(1);
    expect(TEMPLATES[0]!.id).toBe('modular-empty');
    expect(TEMPLATES[0]!.name).toBe('Estructura Hueco Libre');

    const emptyTpl = getTemplateById('modular-empty');
    expect(emptyTpl.id).toBe('modular-empty');
  });

  it('supports resolving dynamic user templates', () => {
    const userTpl = {
      id: 'user-custom-1',
      schemaVersion: 1 as const,
      name: 'Mi Módulo Personalizado',
      description: 'Módulo de prueba',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      dimensions: { width: 600, height: 720, depth: 550 },
      carcassSettings: {
        roofType: 'solid-panel' as const,
        jointPriority: 'lateral-over-bottom' as const,
        hasBacking: true,
      },
      gridType: '1-bay' as const,
      bays: [{ type: 'empty' as const }],
    };

    const resolved = getTemplateById('user-custom-1', [userTpl]);
    expect(resolved.id).toBe('user-custom-1');
    expect(resolved.name).toBe('Mi Módulo Personalizado');
  });
});

