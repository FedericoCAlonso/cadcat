/**
 * Low-level AutoCAD Release 12 (AC1009) DXF Serializer.
 * Generates standards-compliant, clean ASCII DXF files without external CAD dependencies.
 */

import {
  AUTOCAD_R12_VERSION,
  DXF_MEASUREMENT_METRIC,
  DXF_INSUNITS_MILLIMETERS,
  DEFAULT_DXF_COORDINATE_PRECISION,
} from './dxfConstants';
import type {
  DxfEntity,
  DxfLayerDefinition,
  DxfLineEntity,
  DxfCircleEntity,
  DxfPolylineEntity,
  DxfTextEntity,
} from './dxfTypes';

function formatCoord(val: number, precision: number): string {
  if (Math.abs(val) < 1e-9) return '0.0';
  const fixed = val.toFixed(precision);
  const trimmed = fixed.includes('.') ? fixed.replace(/\.?0+$/, '') : fixed;
  return trimmed.includes('.') ? trimmed : `${trimmed}.0`;
}

/**
 * Builds an AutoCAD R12 DXF file string from defined layers and entities.
 */
export function buildDxfString(
  layers: DxfLayerDefinition[],
  entities: DxfEntity[],
  precision = DEFAULT_DXF_COORDINATE_PRECISION,
): string {
  const lines: string[] = [];

  const writePair = (code: number, value: string | number) => {
    lines.push(String(code));
    lines.push(String(value));
  };

  // 1. HEADER SECTION
  writePair(0, 'SECTION');
  writePair(2, 'HEADER');
  writePair(9, '$ACADVER');
  writePair(1, AUTOCAD_R12_VERSION);
  writePair(9, '$MEASUREMENT');
  writePair(70, DXF_MEASUREMENT_METRIC);
  writePair(9, '$INSUNITS');
  writePair(70, DXF_INSUNITS_MILLIMETERS);
  writePair(0, 'ENDSEC');

  // 2. TABLES SECTION
  writePair(0, 'SECTION');
  writePair(2, 'TABLES');

  // VPORT Table
  writePair(0, 'TABLE');
  writePair(2, 'VPORT');
  writePair(70, 0);
  writePair(0, 'ENDTAB');

  // LTYPE Table
  writePair(0, 'TABLE');
  writePair(2, 'LTYPE');
  writePair(70, 1);
  writePair(0, 'LTYPE');
  writePair(2, 'CONTINUOUS');
  writePair(70, 64);
  writePair(3, 'Solid line');
  writePair(72, 65);
  writePair(73, 0);
  writePair(40, '0.0');
  writePair(0, 'ENDTAB');

  // LAYER Table
  writePair(0, 'TABLE');
  writePair(2, 'LAYER');
  writePair(70, layers.length);

  for (const layer of layers) {
    writePair(0, 'LAYER');
    writePair(2, layer.name);
    writePair(70, 64);
    writePair(62, layer.color);
    writePair(6, layer.lineType ?? 'CONTINUOUS');
  }

  writePair(0, 'ENDTAB');
  writePair(0, 'ENDSEC');

  // 3. BLOCKS SECTION
  writePair(0, 'SECTION');
  writePair(2, 'BLOCKS');
  writePair(0, 'ENDSEC');

  // 4. ENTITIES SECTION
  writePair(0, 'SECTION');
  writePair(2, 'ENTITIES');

  for (const entity of entities) {
    switch (entity.type) {
      case 'LINE':
        writeLine(entity, writePair, precision);
        break;
      case 'CIRCLE':
        writeCircle(entity, writePair, precision);
        break;
      case 'POLYLINE':
        writePolyline(entity, writePair, precision);
        break;
      case 'TEXT':
        writeText(entity, writePair, precision);
        break;
    }
  }

  writePair(0, 'ENDSEC');

  // 5. EOF
  writePair(0, 'EOF');

  return lines.join('\r\n') + '\r\n';
}

function writeLine(
  entity: DxfLineEntity,
  writePair: (code: number, val: string | number) => void,
  precision: number,
): void {
  writePair(0, 'LINE');
  writePair(8, entity.layer);
  writePair(10, formatCoord(entity.start.x, precision));
  writePair(20, formatCoord(entity.start.y, precision));
  writePair(30, '0.0');
  writePair(11, formatCoord(entity.end.x, precision));
  writePair(21, formatCoord(entity.end.y, precision));
  writePair(31, '0.0');
}

function writeCircle(
  entity: DxfCircleEntity,
  writePair: (code: number, val: string | number) => void,
  precision: number,
): void {
  writePair(0, 'CIRCLE');
  writePair(8, entity.layer);
  writePair(10, formatCoord(entity.center.x, precision));
  writePair(20, formatCoord(entity.center.y, precision));
  writePair(30, '0.0');
  writePair(40, formatCoord(entity.radius, precision));
}

function writePolyline(
  entity: DxfPolylineEntity,
  writePair: (code: number, val: string | number) => void,
  precision: number,
): void {
  writePair(0, 'POLYLINE');
  writePair(8, entity.layer);
  writePair(66, 1);
  writePair(70, entity.isClosed ? 1 : 0);
  writePair(10, '0.0');
  writePair(20, '0.0');
  writePair(30, '0.0');

  for (const vertex of entity.vertices) {
    writePair(0, 'VERTEX');
    writePair(8, entity.layer);
    writePair(10, formatCoord(vertex.x, precision));
    writePair(20, formatCoord(vertex.y, precision));
    writePair(30, '0.0');
    if (vertex.bulge !== undefined && Math.abs(vertex.bulge) > 1e-6) {
      writePair(42, formatCoord(vertex.bulge, precision));
    }
  }

  writePair(0, 'SEQEND');
  writePair(8, entity.layer);
}

function writeText(
  entity: DxfTextEntity,
  writePair: (code: number, val: string | number) => void,
  precision: number,
): void {
  writePair(0, 'TEXT');
  writePair(8, entity.layer);
  writePair(10, formatCoord(entity.position.x, precision));
  writePair(20, formatCoord(entity.position.y, precision));
  writePair(30, '0.0');
  writePair(40, formatCoord(entity.height, precision));
  writePair(1, entity.text);
}
