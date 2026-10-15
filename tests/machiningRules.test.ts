import { describe, it, expect } from 'vitest';
import {
  type Piece,
  type Material,
  type DrillOperation,
  type CustomDrillOperation,
  type CustomHoleSeriesOperation,
  type CustomGrooveOperation,
  type CustomRebateOperation,
  type CustomPocketOperation,
  type CustomEdgeProfileOperation,
} from '../src/model';
import {
  calculatePocketCornerRelief,
  validatePieceMachiningRules,
  extractPieceDimensions,
} from '../src/resolver/machining';

describe('Machining Rules & Validation Solver (Phase 4 Step 2)', () => {
  const dummyPiece: Piece = {
    id: 'side-left',
    role: 'carcase-side',
    materialId: 'mat-melamine-18',
    thicknessMm: 18,
    structural: true,
    referenceFace: 'A',
    faces: [
      { id: 'face-A', visible: true },
      { id: 'face-B', visible: false },
      { id: 'top', visible: false },
      { id: 'bottom', visible: false },
      { id: 'left', visible: false },
      { id: 'right', visible: true },
    ],
    contour: {
      points: [
        { x: 0, y: 0 },
        { x: 600, y: 0 },
        { x: 600, y: 800 },
        { x: 0, y: 800 },
      ],
    },
  };

  const particleboardMaterial: Material = {
    schemaVersion: 1,
    id: 'mat-melamine-18',
    name: 'Melamina Blanca 18mm Aglomerado',
    thicknessMm: 18,
    sheetSizeMm: { length: 2800, width: 2070 },
    hasGrain: false,
    milling: {
      hidden: 'yes',
      visible: 'no',
      onStructuralPiece: 'limited',
      maxDepthMm: 10,
    },
  };

  const mdfMaterial: Material = {
    schemaVersion: 1,
    id: 'mat-mdf-18',
    name: 'Fibrofacil MDF 18mm',
    thicknessMm: 18,
    sheetSizeMm: { length: 2800, width: 2070 },
    hasGrain: false,
    milling: {
      hidden: 'yes',
      visible: 'yes',
      onStructuralPiece: 'limited',
      maxDepthMm: 12,
    },
  };

  describe('Inside Corner Tool Radius & Dog-Bone Relief Calculator', () => {
    it('calculates natural-radius relief with accurate tangent centers and SVG arc path', () => {
      const pocket = {
        xMm: 100,
        yMm: 100,
        widthMm: 200,
        heightMm: 150,
        cornerRadiusMm: 5,
        cornerTreatment: 'natural-radius' as const,
      };

      const result = calculatePocketCornerRelief(pocket);
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
      expect(result.corners.length).toBe(4);

      // Bottom-left corner: vertex at (100, 100), center at (105, 105)
      const bl = result.corners.find((c) => c.corner === 'bottom-left');
      expect(bl).toBeDefined();
      expect(bl?.vertexMm).toEqual({ x: 100, y: 100 });
      expect(bl?.reliefCenterMm).toEqual({ x: 105, y: 105 });
      expect(bl?.reliefRadiusMm).toBe(5);
      expect(bl?.clearanceDepthMm).toBe(0);

      // Top-right corner: vertex at (300, 250), center at (295, 245)
      const tr = result.corners.find((c) => c.corner === 'top-right');
      expect(tr?.vertexMm).toEqual({ x: 300, y: 250 });
      expect(tr?.reliefCenterMm).toEqual({ x: 295, y: 245 });

      expect(result.svgPath).toContain('M 100 105');
      expect(result.svgPath).toContain('A 5 5 0 0 0');
    });

    it('calculates dog-bone relief so center extends diagonally at 45 deg and passes through vertex', () => {
      const r = 5;
      const pocket = {
        xMm: 50,
        yMm: 50,
        widthMm: 120,
        heightMm: 80,
        cornerRadiusMm: r,
        cornerTreatment: 'dog-bone' as const,
      };

      const result = calculatePocketCornerRelief(pocket);
      expect(result.valid).toBe(true);

      const delta = r / Math.SQRT2;
      const bl = result.corners.find((c) => c.corner === 'bottom-left');
      expect(bl).toBeDefined();
      expect(bl?.reliefCenterMm.x).toBeCloseTo(50 + delta, 4);
      expect(bl?.reliefCenterMm.y).toBeCloseTo(50 + delta, 4);

      // Verify distance from center to vertex (50, 50) is exactly r
      const distToVertex = Math.sqrt(
        Math.pow(bl!.reliefCenterMm.x - 50, 2) + Math.pow(bl!.reliefCenterMm.y - 50, 2),
      );
      expect(distToVertex).toBeCloseTo(r, 4);

      // Clearance depth into corner should be r*(sqrt(2)-1)
      expect(bl?.clearanceDepthMm).toBeCloseTo(r * (Math.SQRT2 - 1), 4);
    });

    it('calculates t-bone relief along X and Y axes', () => {
      const pocketX = {
        xMm: 20,
        yMm: 30,
        widthMm: 100,
        heightMm: 60,
        cornerRadiusMm: 4,
        cornerTreatment: 't-bone' as const,
        tBoneAxis: 'x' as const,
      };

      const resX = calculatePocketCornerRelief(pocketX);
      expect(resX.valid).toBe(true);
      const blX = resX.corners.find((c) => c.corner === 'bottom-left');
      expect(blX?.reliefCenterMm).toEqual({ x: 20, y: 34 });

      const pocketY = {
        ...pocketX,
        tBoneAxis: 'y' as const,
      };
      const resY = calculatePocketCornerRelief(pocketY);
      expect(resY.valid).toBe(true);
      const blY = resY.corners.find((c) => c.corner === 'bottom-left');
      expect(blY?.reliefCenterMm).toEqual({ x: 24, y: 30 });
    });

    it('generates sharp rectangle contour when cornerRadius is 0', () => {
      const pocket = {
        xMm: 10,
        yMm: 15,
        widthMm: 80,
        heightMm: 50,
        cornerRadiusMm: 0,
      };

      const res = calculatePocketCornerRelief(pocket);
      expect(res.valid).toBe(true);
      expect(res.svgPath).toBe('M 10 15 L 90 15 L 90 65 L 10 65 Z');
    });

    it('rejects invalid pocket with tool diameter larger than cutout dimensions', () => {
      const pocket = {
        xMm: 0,
        yMm: 0,
        widthMm: 20,
        heightMm: 50,
        cornerRadiusMm: 15, // cutter diameter = 30mm > width 20mm
      };

      const res = calculatePocketCornerRelief(pocket);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('excede la dimensión mínima'))).toBe(true);
    });
  });

  describe('Rule 8.1 - Material Milling Tolerance Validator', () => {
    it('warns when milling operation is on visible face of particleboard (RULE_8_1_VISIBLE_FACE)', () => {
      const groove: CustomGrooveOperation = {
        kind: 'groove',
        id: 'g-1',
        pieceId: dummyPiece.id,
        faceType: 'face-A', // Face A is visible on dummyPiece
        axis: 'x',
        offsetMm: 50,
        widthMm: 4,
        depthMm: 8,
      };

      const issues = validatePieceMachiningRules({
        piece: dummyPiece,
        material: particleboardMaterial,
        customOperations: [groove],
      });

      const issue = issues.find((i) => i.code === 'RULE_8_1_VISIBLE_FACE');
      expect(issue).toBeDefined();
      expect(issue?.level).toBe('warning');
      expect(issue?.message).toContain('no tolera fresados en caras visibles');
    });

    it('allows milling on hidden face (face-B) without visible face warning', () => {
      const groove: CustomGrooveOperation = {
        kind: 'groove',
        id: 'g-2',
        pieceId: dummyPiece.id,
        faceType: 'face-B', // Face B is hidden (visible: false)
        axis: 'x',
        offsetMm: 50,
        widthMm: 4,
        depthMm: 8,
      };

      const issues = validatePieceMachiningRules({
        piece: dummyPiece,
        material: particleboardMaterial,
        customOperations: [groove],
      });

      const visibleIssue = issues.find((i) => i.code === 'RULE_8_1_VISIBLE_FACE');
      expect(visibleIssue).toBeUndefined();
    });

    it('allows milling on visible face when material is MDF with visible: "yes"', () => {
      const rebate: CustomRebateOperation = {
        kind: 'rebate',
        id: 'r-1',
        pieceId: dummyPiece.id,
        faceType: 'face-A',
        edge: 'top',
        widthMm: 12,
        depthMm: 6,
      };

      const issues = validatePieceMachiningRules({
        piece: dummyPiece,
        material: mdfMaterial,
        customOperations: [rebate],
      });

      const visibleIssue = issues.find((i) => i.code === 'RULE_8_1_VISIBLE_FACE');
      expect(visibleIssue).toBeUndefined();
    });

    it('emits error when milling depth exceeds confirmed material maxDepthMm on structural piece', () => {
      const deepGroove: CustomGrooveOperation = {
        kind: 'groove',
        id: 'g-deep',
        pieceId: dummyPiece.id,
        faceType: 'face-B',
        axis: 'x',
        offsetMm: 100,
        widthMm: 6,
        depthMm: 14, // maxDepthMm is 10 on particleboardMaterial
      };

      const issues = validatePieceMachiningRules({
        piece: dummyPiece,
        material: particleboardMaterial,
        customOperations: [deepGroove],
      });

      const structuralIssue = issues.find((i) => i.code === 'RULE_8_1_STRUCTURAL_DEPTH_EXCEEDED');
      expect(structuralIssue).toBeDefined();
      expect(structuralIssue?.level).toBe('error');
    });

    it('emits error if milling is strictly prohibited on structural piece', () => {
      const fragileMaterial: Material = {
        ...particleboardMaterial,
        milling: {
          hidden: 'yes',
          visible: 'no',
          onStructuralPiece: 'no',
        },
      };

      const cutout: CustomPocketOperation = {
        kind: 'cutout',
        id: 'c-1',
        pieceId: dummyPiece.id,
        faceType: 'face-B',
        xMm: 100,
        yMm: 100,
        widthMm: 150,
        heightMm: 100,
        depthMm: 18,
        isThrough: true,
      };

      const issues = validatePieceMachiningRules({
        piece: dummyPiece,
        material: fragileMaterial,
        customOperations: [cutout],
      });

      const issue = issues.find((i) => i.code === 'RULE_8_1_STRUCTURAL_PROHIBITED');
      expect(issue).toBeDefined();
      expect(issue?.level).toBe('error');
    });
  });

  describe('Boundary & Residual Thickness Validations', () => {
    it('detects hole placed outside piece bounds and edge intersect margin', () => {
      // dummyPiece is 600x800mm
      const outDrill: CustomDrillOperation = {
        kind: 'drill',
        id: 'd-out',
        pieceId: dummyPiece.id,
        faceType: 'face-A',
        xMm: 650, // exceeds 600
        yMm: 100,
        diameterMm: 8,
        depthMm: 12,
        isThrough: false,
      };

      const issues = validatePieceMachiningRules({
        piece: dummyPiece,
        customOperations: [outDrill],
      });

      expect(issues.some((i) => i.code === 'OUT_OF_BOUNDS')).toBe(true);

      const edgeDrill: CustomDrillOperation = {
        kind: 'drill',
        id: 'd-edge',
        pieceId: dummyPiece.id,
        faceType: 'face-A',
        xMm: 2, // radius is 8/2 = 4mm, 2mm cuts into the edge!
        yMm: 100,
        diameterMm: 8,
        depthMm: 12,
        isThrough: false,
      };

      const edgeIssues = validatePieceMachiningRules({
        piece: dummyPiece,
        customOperations: [edgeDrill],
      });

      expect(edgeIssues.some((i) => i.code === 'EDGE_INTERSECT')).toBe(true);
    });

    it('detects hole-series exceeding piece bounds', () => {
      // 600x800mm. Start at Y=750, count=4, pitch=32 => 750, 782, 814 (> 800)
      const series: CustomHoleSeriesOperation = {
        kind: 'hole-series',
        id: 's-overflow',
        pieceId: dummyPiece.id,
        faceType: 'face-A',
        startXMm: 37,
        startYMm: 750,
        axis: 'y',
        pitchMm: 32,
        count: 4,
        diameterMm: 5,
        depthMm: 12,
        isThrough: false,
      };

      const issues = validatePieceMachiningRules({
        piece: dummyPiece,
        customOperations: [series],
      });

      expect(issues.some((i) => i.code === 'OUT_OF_BOUNDS')).toBe(true);
    });

    it('warns when blind operation residual thickness is too thin (< 3mm) or cuts through', () => {
      // Piece thickness is 18mm
      const deepDrill: CustomDrillOperation = {
        kind: 'drill',
        id: 'd-thin',
        pieceId: dummyPiece.id,
        faceType: 'face-A',
        xMm: 200,
        yMm: 200,
        diameterMm: 10,
        depthMm: 16.5, // 18 - 16.5 = 1.5mm residual < 3mm
        isThrough: false,
      };

      const issues = validatePieceMachiningRules({
        piece: dummyPiece,
        customOperations: [deepDrill],
      });

      expect(issues.some((i) => i.code === 'RESIDUAL_THICKNESS_TOO_THIN')).toBe(true);

      const throughMistake: CustomDrillOperation = {
        ...deepDrill,
        depthMm: 19, // Exceeds 18mm but isThrough is false!
      };

      const throughIssues = validatePieceMachiningRules({
        piece: dummyPiece,
        customOperations: [throughMistake],
      });

      expect(throughIssues.some((i) => i.code === 'BLIND_OPERATION_THROUGH')).toBe(true);
    });

    it('detects cutout with tool radius too large for pocket', () => {
      const pocketOp: CustomPocketOperation = {
        kind: 'cutout',
        id: 'c-small',
        pieceId: dummyPiece.id,
        faceType: 'face-A',
        xMm: 100,
        yMm: 100,
        widthMm: 15,
        heightMm: 40,
        depthMm: 18,
        isThrough: true,
        cornerRadiusMm: 10, // Diameter 20 > width 15!
      };

      const issues = validatePieceMachiningRules({
        piece: dummyPiece,
        customOperations: [pocketOp],
      });

      expect(issues.some((i) => i.code === 'TOOL_TOO_LARGE_FOR_POCKET')).toBe(true);
    });

    it('detects edge profile operation with depth exceeding thickness', () => {
      const deepProfile: CustomEdgeProfileOperation = {
        kind: 'edge-profile',
        id: 'prof-too-deep',
        pieceId: dummyPiece.id,
        faceType: 'face-A',
        edge: 'top',
        profileKind: 'j-pull',
        depthMm: 20, // 20mm > 18mm thickness!
        widthMm: 35,
      };

      const issues = validatePieceMachiningRules({
        piece: dummyPiece,
        customOperations: [deepProfile],
      });

      expect(issues.some((i) => i.code === 'PROFILE_DEPTH_EXCEEDS_THICKNESS')).toBe(true);
    });
  });

  describe('Joint / Fastener Collision Checks', () => {
    const jointDrill: DrillOperation = {
      schemaVersion: 1,
      id: 'joint-drill-1',
      pieceId: dummyPiece.id,
      faceId: 'inner',
      faceType: 'face-A',
      diameterMm: 5,
      depthMm: 50,
      isThrough: false,
      positionMm: { x: 50, y: 50 },
      origin: 'derived',
      sourceJointKind: 'confirmat',
    };

    it('warns when custom drill hole collides with a joint drill hole', () => {
      const collidingDrill: CustomDrillOperation = {
        kind: 'drill',
        id: 'd-col',
        pieceId: dummyPiece.id,
        faceType: 'face-A',
        xMm: 52, // Distance to joint is ~2mm, required is (5+5)/2 + 5 = 10mm
        yMm: 50,
        diameterMm: 5,
        depthMm: 12,
        isThrough: false,
      };

      const issues = validatePieceMachiningRules({
        piece: dummyPiece,
        customOperations: [collidingDrill],
        derivedOperations: [jointDrill],
      });

      const colIssue = issues.find((i) => i.code === 'COLLISION_WITH_JOINT');
      expect(colIssue).toBeDefined();
      expect(colIssue?.level).toBe('warning');
      expect(colIssue?.message).toContain('confirmat');
    });

    it('does not warn when custom drill is safely separated from joint hole', () => {
      const safeDrill: CustomDrillOperation = {
        kind: 'drill',
        id: 'd-safe',
        pieceId: dummyPiece.id,
        faceType: 'face-A',
        xMm: 150, // 100mm away
        yMm: 150,
        diameterMm: 5,
        depthMm: 12,
        isThrough: false,
      };

      const issues = validatePieceMachiningRules({
        piece: dummyPiece,
        customOperations: [safeDrill],
        derivedOperations: [jointDrill],
      });

      expect(issues.some((i) => i.code === 'COLLISION_WITH_JOINT')).toBe(false);
    });

    it('warns when cutout intersects or encompasses a joint hole', () => {
      const collidingCutout: CustomPocketOperation = {
        kind: 'cutout',
        id: 'c-joint-cut',
        pieceId: dummyPiece.id,
        faceType: 'face-A',
        xMm: 40,
        yMm: 40,
        widthMm: 100,
        heightMm: 100, // covers (50, 50)
        depthMm: 18,
        isThrough: true,
      };

      const issues = validatePieceMachiningRules({
        piece: dummyPiece,
        customOperations: [collidingCutout],
        derivedOperations: [jointDrill],
      });

      const colIssue = issues.find((i) => i.code === 'COLLISION_WITH_JOINT');
      expect(colIssue).toBeDefined();
    });
  });

  describe('extractPieceDimensions helper', () => {
    it('correctly extracts width, height and thickness from piece contour', () => {
      const dims = extractPieceDimensions(dummyPiece);
      expect(dims.width).toBe(600);
      expect(dims.height).toBe(800);
      expect(dims.thickness).toBe(18);
    });

    it('uses explicit dimensionsMm property when present on ResolvedPiece', () => {
      const resolvedPiece = {
        ...dummyPiece,
        dimensionsMm: { width: 550, height: 750 },
      };
      const dims = extractPieceDimensions(resolvedPiece);
      expect(dims.width).toBe(550);
      expect(dims.height).toBe(750);
      expect(dims.thickness).toBe(18);
    });
  });
});
