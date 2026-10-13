# Project Plan: Furniture Design PWA

Document language: ASD-STE100 (Simplified Technical English).
Status: Draft 1.

## 1. Purpose

This project makes a web application for the design of panel furniture. The application is a Progressive Web App (PWA). It runs in a browser and works without a network.

The user is a furniture maker. The furniture maker builds kitchen furniture, desks, and other furniture from sheet material, for example Egger boards.

The application does these tasks:

- It helps the user design furniture with modules and templates.
- It makes the cut list, the cut plan, and the bill of materials.
- It calculates the cost.
- It checks the design against the rules of the material and the shop.
- It makes the machining data for each piece.
- It shows the furniture in 3D.

## 2. Roles

| Role | Task |
|---|---|
| Project owner | Directs the architecture. Accepts each phase. |
| Domain expert | A furniture maker. Gives and confirms all shop values. |
| AI agent | Writes the code, the tests, and the documents. |

## 3. Main rules

1. The model is the single source of truth. All outputs come from the model. Do not edit an output by hand.
2. A module is a complete section of finished furniture, for example one base cabinet. The module owns its pieces. Modules do not share pieces.
3. Data stays in catalogs, not in code. A new material, edge band, tool, or equipment is a new catalog entry. If a new catalog entry needs new code, the design is wrong.
4. Do not invent shop values. A shop value is a number such as a clearance, a minimum distance, a maximum depth, or a price. The domain expert must confirm each shop value. Mark each unconfirmed value with `TO_CONFIRM`.
5. The application is a design aid. It does not certify safety. For gas and electrical work, the application shows the manufacturer requirements. It gives a warning when the design does not meet them. A licensed installer does the installation.
6. Keep each phase small. Do not build the features of a later phase.

## 4. Terms

| Term | Meaning |
|---|---|
| Module | A complete section of finished furniture. It owns its pieces. |
| Piece | One panel. It has a 2D contour, a thickness, and a material. |
| Face | A surface of a piece. A piece has two large faces and one edge face for each segment of the contour. |
| Joint | A link between a face of one piece and a face of another piece. It has a kind, for example dowel. |
| Sub-assembly | A group of pieces and joints that a template makes, for example a drawer. |
| Operation | A machining action on a piece, for example a drill hole or a groove. |
| Tool | A cutting tool, for example a drill bit or a router bit. |
| Material | A sheet material with its rules. |
| Edge band | The finish on the edge of a piece. It can be adhesive tape, aluminium profile, veneer, or rod. |
| Equipment | An item that the furniture holds, for example a sink, an oven, or a power supply. It needs space and services. |
| External element | An item that this application designs but another party makes, for example a stone countertop. |
| Station | A place of work with machines. It is in the shop or at a third party. |
| Template | A set of rules that makes a sub-assembly from a few parameters. |
| Override | A manual change that the user makes to a result of the resolver. |
| Visible face | A face that the user can see in the finished furniture. |
| Structural piece | A piece that carries load or holds the shape of the furniture. |

## 5. Technical decisions

The project owner can change these decisions.

- Language: TypeScript, strict mode.
- User interface: React with Vite.
- Storage: IndexedDB. The application has no server.
- Heavy work: Web Workers. This includes nesting and validation.
- 3D view: three.js (from Phase 2).
- Tests: Vitest.
- Data format: JSON. Each JSON object has a `schemaVersion` field. A schema validator checks the data when the application loads it.
- Offline use: a service worker.
- Repository: a separate repository. Data exchange with other tools uses JSON files only.

## 6. Architecture

### 6.1 Three layers

1. **Intention.** The data that the user edits and the application saves.
2. **Resolution.** The code that calculates the pieces, the sizes, and the positions from the intention.
3. **Outputs.** The cut list, the cut plan, the cost, the 3D view, the machining sheets, and the exports. Outputs come from the resolved data. The user does not edit outputs.

A manual change to a resolved piece is an override. The application saves overrides separately. Each override attaches to the stable id of a piece.

### 6.2 Position and size

- **Position.** A placement tree gives the position. The root is a reference piece that the user chooses, for example the bottom panel. Each other piece has a position relative to its parent.
- **Size.** The joint graph gives the size. A joint can close a loop. For example, a shelf touches two sides. The width of the shelf is the distance between the inner faces of the two sides.

The resolver calculates in order of dependency. If the dependencies form a circle, the resolver reports an error.

The id of a piece comes from its role and its logical position. The id does not change when the user changes a size.

### 6.3 Levels of the design

- **Module level.** The pieces that one module owns.
- **Ensemble level.** Items that cross more than one module, for example the countertop, the plinth, the cornice, and the equipment.
- **External level.** Items that another party makes.

An ensemble item rests on modules through joints. Equipment points to the modules that it affects.

### 6.4 Not planned yet

The model must not block these features. Do not build them now.

- A room layer with walls that are not square. A module is a rigid body that is built square. Filler pieces absorb the room errors.
- Corner modules and L-shaped runs.

## 7. Data model

The code below shows the shape of the data. The agent can change names. The agent must keep the ideas.

```ts
type Capability = 'yes' | 'no' | 'with-accessory';

interface MillingTolerance {
  hidden: 'yes' | 'no';
  visible: Capability;
  onStructuralPiece: 'yes' | 'no' | 'limited';
  maxDepthMm?: number;           // TO_CONFIRM
}

interface Material {
  id: string;
  name: string;
  thicknessMm: number;
  sheetSizeMm: { length: number; width: number };
  hasGrain: boolean;
  milling: MillingTolerance;
  heatResistant?: boolean;
  elasticModulusMPa?: number;    // TO_CONFIRM
  pricePerSheet?: number;        // TO_CONFIRM
}

interface EdgeBand {
  id: string;
  kind: 'adhesive' | 'aluminium-profile' | 'veneer' | 'rod';
  thicknessMm: number;           // changes the cut size
  pricePerMeter: number;         // TO_CONFIRM
  needsGroove?: boolean;
}

interface Piece {
  id: string;                    // stable id
  role: string;                  // for example "side-left", "shelf", "back"
  materialId: string;
  contour: Contour;              // 2D polygon, with holes if needed
  thicknessMm: number;
  faces: Face[];
  structural: boolean;           // default from the role. The user can change it.
  referenceFace: 'A' | 'B';      // the face that is up on the machine
}

interface Face {
  id: string;                    // role name, for example "front-edge"
  visible: boolean;              // default from the joints. The user can change it.
  edgeBandId?: string;
}

interface Joint {
  a: FaceRef;
  b: FaceRef;
  kind: 'dowel' | 'cam-dowel' | 'confirmat' | 'rebate' | 'groove' | 'glue' | 'butt';
  offsetMm?: number;
  region?: Interval;             // where on the face the joint is
}

interface Module {
  schemaVersion: number;
  id: string;
  parameters: Record<string, number>;   // width, height, depth
  rootPieceId: string;
  pieces: Piece[];
  joints: Joint[];
  subAssemblies: SubAssembly[];
  overrides: Record<string, Override>;
}

interface Operation {
  id: string;
  pieceId: string;
  faceId: string;
  toolId: string;
  kind: 'drill' | 'groove' | 'rebate' | 'cutout' | 'profile-route';
  path: AnchoredPath;            // anchored to edges, not to absolute positions
  depthMm: number;
  origin: 'derived' | 'manual';
  stationId?: string;
}

interface Station {
  id: string;
  name: string;
  place: 'own' | 'third-party';
  operations: Operation['kind'][];
  toolIds: string[];
  limits?: { minSizeMm?: number; maxSizeMm?: number };
  cost?: { perOperation?: number; perHour?: number };   // TO_CONFIRM
}

interface Equipment {
  id: string;
  kind: string;                  // "sink", "oven", "microwave", "power-supply", ...
  mounting?: 'top' | 'under' | 'flush';
  cutoutInTop?: Contour;
  reservedVolume: Box3D;
  requirements: {
    minEdgeDistanceMm?: number;  // TO_CONFIRM
    ventilation?: VentilationRule[];
    heatResistantFaces?: boolean;
    ports: ('gas' | 'water' | 'drain' | 'power' | 'air')[];
  };
}

interface ExternalElement {
  id: string;
  kind: 'countertop' | 'other';
  materialKind: string;          // "stone", "laminate", "board", "wood", ...
  weightKgPerM2?: number;        // TO_CONFIRM
  scope: 'own' | 'third-party' | 'customer';
  state: 'estimated' | 'measured-on-site';
}
```

## 8. Validation rules

### 8.1 Operations and material

The resolver checks each operation with three facts:

1. The face is visible or hidden.
2. The piece is structural or not.
3. The depth of the operation.

The resolver compares these facts with the `MillingTolerance` of the material. The result is one of these:

- `ok`
- `ok with accessory X`
- `not allowed`, with the reason

An operation that is visible by its nature, for example a molding or a wedge-shaped handle groove, is always checked as visible.

The material of a piece can differ from the material of the module. If an operation is not allowed, the application suggests a change of material for that piece only, or an accessory.

### 8.2 Equipment

When the user puts equipment in the design, the application does these checks:

- The equipment is at the minimum distance from the edges of the countertop.
- The equipment does not cross a joint between two modules or two countertop parts.
- The reserved volume does not touch hardware, drawers, or pieces.
- The faces around a heat source are made of a heat-resistant material.
- The ventilation openings of the equipment exist in the pieces around it.

The application shows the manufacturer requirements as catalog data. It does not say that a design is safe.

### 8.3 Edge bands

The cut size of a piece is the finished size minus the thickness of the edge band on each banded side. The cut list always shows the cut size.

## 9. Phases

The agent does one phase at a time. The project owner accepts a phase before the next phase starts.

### Phase 0: Foundation

**Goal.** A working empty project with the data contracts and tests.

**Tasks.**

1. Create the repository and the folder structure.
2. Set up Vite, React, TypeScript (strict), and Vitest.
3. Make the PWA shell. It must open without a network.
4. Make a small IndexedDB layer for save and load.
5. Write the schemas for Material, EdgeBand, Piece, Face, Joint, and Module.
6. Make the seed catalogs with two materials and two edge bands. Mark all shop values `TO_CONFIRM`.
7. Write tests for the schemas.
8. Make the files `docs/DECISIONS.md`, `docs/TO_CONFIRM.md`, and `docs/IDEAS.md`.

**Acceptance criteria.**

- The application builds with no errors.
- All tests pass.
- The application opens without a network after the first load.
- The catalogs load and pass the schema check.

**Out of scope.** The resolver, the nesting, and the 3D view.

### Phase 1: Core (first usable version)

**Goal.** From a module definition, the application makes the cut list, the cut plan, and the cost.

**Tasks.**

1. Make pieces from a contour and a thickness. Make the faces.
2. Make the joints. Make the resolver for position (tree) and size (graph).
3. Apply the edge band rule from section 8.3.
4. Make the bill of materials: pieces, edge band meters by type, and hardware count.
5. Make guillotine nesting in a Web Worker. Respect the sheet size, the grain direction, and the saw kerf (`TO_CONFIRM`).
6. Calculate the cost of material, edge band, and hardware.
7. Make the module form: parameters, material, and edge band. Make a list view of the pieces.
8. Export the cut list as CSV. Export the cut plan as PDF.
9. Make two templates: a base cabinet (two sides, bottom, rails, back, one shelf) and a drawer unit.

**Acceptance criteria.**

- A change to the width of the module updates all dependent sizes.
- The domain expert compares the output for three real jobs with the output of his current application. The cut lists are the same.
- Tests cover the resolver, the edge band sizes, and the nesting. In the nesting tests, no pieces overlap and all pieces are inside the sheet.

**Out of scope.** The 3D view, the machining, the equipment, and the CNC.

### Phase 2: 3D view, templates, and derived machining

**Goal.** The user sees the module in 3D. The application derives the drilling from the joints.

**Tasks.**

1. Make the 3D view with three.js. Add an exploded view and face selection.
2. Make templates for door (with hinges), drawer (with slide types), shelf, and partition.
3. Derive the drill operations from the joints.
4. Make a machining sheet for each piece for manual machines. Show face A and face B, the operations, and the dimensions from the edges.
5. Make a simple deflection check for shelves. Use the beam formula and the material data. The check gives a warning only. Mark the limits `TO_CONFIRM`.

**Acceptance criteria.**

- The 3D view shows the same pieces as the cut list.
- The domain expert confirms that the drill positions of one real cabinet are correct.
- The machining sheet shows operations on the bottom face with a "turn the piece" mark.

### Phase 3: Equipment and external elements

**Goal.** The application handles a countertop and a sink.

**Tasks.**

1. Make the ensemble level. Make the countertop as an external element that rests on modules.
2. Add the support check and the overhang rule. Add the weight rule for heavy materials.
3. Make the equipment catalog. Add sink, oven, and microwave.
4. Put equipment in a design. Make the cutout, the reserved volume, and the effect on the module pieces.
5. Make the checks from section 8.2.
6. Make a hand-off sheet for the third party as PDF and DXF.
7. Import a cutout template from DXF or SVG.

**Acceptance criteria.**

- Test case: two base modules, a stone countertop, and a double sink. The application gives the correct cutout and reserved volume.
- The application gives a warning when the sink crosses a module joint.
- The cost shows the countertop as a line with its scope.

### Phase 4: Digital carpenter and detail

**Goal.** The user applies machining operations on the assembled furniture.

**Tasks.**

1. Make the tool catalog.
2. Make these operations: drill, series of holes, straight groove, rebate, rectangular cutout, and round cutout.
3. Save the position of each operation anchored to edges.
4. Check all operations again when the user changes a parameter. Show the operations that fall outside a piece or collide.
5. Use the checks from section 8.1.
6. Show the tool radius in the inside corners of cutouts.
7. Make the profile editor in 2D. Extrude a profile along a path to make a molding or a drawer front detail.
8. Make a profile router bit as a tool. A profile router bit with a path makes a profile on an edge.
9. Import hardware drawings from DXF or SVG. Make simple hardware drawings.
10. Add the manual operations to the machining sheet.

**Acceptance criteria.**

- A router operation on a visible face of particleboard is not allowed. The application suggests an accessory or a different material for that piece.
- A groove on a hidden face of a non-structural piece is allowed.
- A change of width keeps the operations at the correct distance from their edges.

### Phase 5: Stations and CNC

**Goal.** The user sends work to a CNC shop.

**Tasks.**

1. Make the station catalog. Add the own machines and one CNC shop.
2. Assign each operation to a station. Show a routing sheet with the order of work.
3. Add the cost by station.
4. Add a free nesting mode for CNC. Keep the guillotine mode for the own saw.
5. Export DXF files with layers by operation type and drill diameter.
6. Add a preview of the machining before the export.

**Acceptance criteria.**

- The CNC shop accepts the file for a first small job.
- The finished pieces fit the pieces that the shop makes.

**Note.** Do not write a format for a specific machine brand before the CNC shop gives a sample file.

### Phase 6: Services and lighting

**Goal.** The application handles gas, ventilation, cables, and LED lighting.

**Tasks.**

1. Make ports and routes. A route links two ports through the pieces. Each passage makes an operation on a piece.
2. Make the ventilation openings for equipment.
3. Make the check for heat-resistant faces in an oven niche.
4. Make LED strip templates with aluminium profile. Use a surface profile or an inset profile. An inset profile needs a groove, and the material rules apply.
5. Calculate the power of the LED strips. Place the power supply in a space that is accessible and has air flow.
6. Make a drawer template with a light diffuser.
7. Add an optional high-quality render.

**Acceptance criteria.**

- The domain expert and an electrician review the outputs for one real kitchen.
- The application gives warnings that match the manufacturer data sheets.

## 10. Definition of done for a task

A task is done when all of these are true:

- The code compiles with no errors.
- All tests pass.
- New behavior has tests.
- New shop values are in `docs/TO_CONFIRM.md`.
- Decisions that change the design are in `docs/DECISIONS.md`.
- The agent gives a short report to the project owner.

## 11. Risks

| Risk | Action |
|---|---|
| The scope grows. | Do one phase at a time. Add new equipment as catalog entries. |
| The agent invents shop values. | Use `TO_CONFIRM`. The domain expert reviews all values. |
| A wrong export damages sheets. | Make a preview. Do a small test job first. |
| Complex 3D geometry is heavy. | Limit the operations. Use a solid-geometry library only if it is necessary. |
| A model change breaks saved data. | Use `schemaVersion`. Write a migration for each change. |
| The agent loses context in long sessions. | Do one task for each session. Keep `docs/DECISIONS.md` current. |

## 12. Values that the domain expert must confirm

1. The sheet sizes and thicknesses that the shop uses.
2. The saw kerf and the trim margin of a sheet.
3. The edge band types and their thicknesses.
4. The pieces that are structural, for each type of furniture.
5. The maximum depth of a hidden groove, for each material.
6. The clearances of drawers and slides.
7. The hinge positions and the boring distances.
8. The standard overhang of a countertop.
9. The machines in the shop and the time for each operation.
10. The CNC shop file format, the tolerances, and the prices.
11. The manufacturer data sheets for the sink, the oven, and the microwave.
