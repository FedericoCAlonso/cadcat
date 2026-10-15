import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { CountertopEditorView } from '../src/ui/CountertopEditorView';
import {
  DEFAULT_COUNTERTOP_MATERIALS,
  DEFAULT_EQUIPMENT_ITEMS,
  type CountertopDefinition,
} from '../src/model';
import { calculateCountertop } from '../src/resolver';

describe('CountertopEditorView Component (Phase 3 UI)', () => {
  const granite = DEFAULT_COUNTERTOP_MATERIALS[0]!;
  const testDefinition: CountertopDefinition = {
    schemaVersion: 1,
    id: 'test-countertop',
    name: 'Mesada Test',
    materialId: granite.id,
    widthMm: 1200,
    depthMm: 620,
    frontOverhangMm: 25,
    leftOverhangMm: 0,
    rightOverhangMm: 0,
    backOverhangMm: 0,
    edgeFinish: 'straight-polished',
    miteredSkirtHeightMm: 0,
    cornerRadii: { frontLeftMm: 0, frontRightMm: 0, backLeftMm: 0, backRightMm: 0 },
    backsplash: { hasSplash: true, heightMm: 60, thicknessMm: 20 },
    leftSplash: { hasSplash: false, heightMm: 60, thicknessMm: 20 },
    rightSplash: { hasSplash: false, heightMm: 60, thicknessMm: 20 },
    placements: [
      {
        equipmentId: 'eq-sink-johnson-luxon-ln50',
        centerXMm: 600,
        centerOffsetYMm: 0,
        sinkDrawerAdaptation: 'false-front',
        frontRailOrientation: 'vertical',
      },
    ],
  };

  it('renders disabled prompt when countertop is disabled', () => {
    const html = renderToString(
      <CountertopEditorView
        countertopEnabled={false}
        onToggleCountertop={vi.fn()}
        countertopCalculation={null}
        countertopDefinition={testDefinition}
        countertopMaterials={DEFAULT_COUNTERTOP_MATERIALS}
        equipmentCatalog={DEFAULT_EQUIPMENT_ITEMS}
        selectedMaterialId={granite.id}
        onSelectMaterial={vi.fn()}
        selectedEquipmentId="none"
        onSelectEquipment={vi.fn()}
        sinkDrawerAdaptation="false-front"
        onSelectSinkDrawerAdaptation={vi.fn()}
        frontRailOrientation="vertical"
        onSelectFrontRailOrientation={vi.fn()}
        frontOverhangMm={25}
        onFrontOverhangChange={vi.fn()}
        edgeFinish="straight-polished"
        onEdgeFinishChange={vi.fn()}
        hasBacksplash={true}
        onToggleBacksplash={vi.fn()}
        backsplashHeightMm={60}
        onBacksplashHeightChange={vi.fn()}
        onExportPdf={vi.fn()}
      />,
    );

    expect(html).toContain('La mesada se encuentra desactivada para este mueble');
    expect(html).toContain('Habilitar Mesada');
  });

  it('renders full M3 controls, material cards, sink adaptation and SVG drawing when enabled', () => {
    const calculation = calculateCountertop(testDefinition, granite, DEFAULT_EQUIPMENT_ITEMS);

    const html = renderToString(
      <CountertopEditorView
        countertopEnabled={true}
        onToggleCountertop={vi.fn()}
        countertopCalculation={calculation}
        countertopDefinition={testDefinition}
        countertopMaterials={DEFAULT_COUNTERTOP_MATERIALS}
        equipmentCatalog={DEFAULT_EQUIPMENT_ITEMS}
        selectedMaterialId={granite.id}
        onSelectMaterial={vi.fn()}
        selectedEquipmentId="eq-sink-johnson-luxon-ln50"
        onSelectEquipment={vi.fn()}
        sinkDrawerAdaptation="false-front"
        onSelectSinkDrawerAdaptation={vi.fn()}
        frontRailOrientation="vertical"
        onSelectFrontRailOrientation={vi.fn()}
        frontOverhangMm={25}
        onFrontOverhangChange={vi.fn()}
        edgeFinish="straight-polished"
        onEdgeFinishChange={vi.fn()}
        hasBacksplash={true}
        onToggleBacksplash={vi.fn()}
        backsplashHeightMm={60}
        onBacksplashHeightChange={vi.fn()}
        onExportPdf={vi.fn()}
      />,
    );

    // Section 1: Material & Finish
    expect(html).toContain('1. Material y Espesor de la Piedra');
    expect(html).toContain('Granito Gris Mara 20mm');
    expect(html).toContain('Canto Recto Pulido');
    expect(html).toContain('Zócalo Sanitario (Trasero)');

    // Section 2: Equipment & Cutout
    expect(html).toContain('2. Bacha / Anafe y Mueble');
    expect(html).toContain('Johnson Acero Luxon LN50');
    expect(html).toContain('Adaptación de Cajón Superior');
    expect(html).toContain('Falso Frente');
    expect(html).toContain('Cajón Escotado');
    expect(html).toContain('Travesaño Superior Delantero');
    expect(html).toContain('De Canto / Vertical');

    // Section 3: Diagnostic & Structural Check
    expect(html).toContain('Diagnóstico Físico');
    expect(html).toContain('Peso Total Estimado:');
    expect(html).toContain('Puentes de piedra seguros contra rotura');

    // Section 4: SVG Workshop Drawing
    expect(html).toContain('Plano Técnico de Marmolería');
    expect(html).toContain('PLANO DE MARMOLERÍA');
    expect(html).toContain('FRENTE PULIDO');
    expect(html).toContain('Exportar Plano PDF');
  });
});
