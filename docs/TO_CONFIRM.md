# Values to Confirm (Shop Values)

Document language: ASD-STE100 (Simplified Technical English).

The domain expert must confirm each value in this document.
Do not invent values.
Keep the marker `TO_CONFIRM` until the domain expert confirms the value.

## 1. Seed Catalog Values

### Materials

| Material ID | Field | Current Value | Confirmed Value | Notes |
|---|---|---|---|---|
| `mat-egger-white-18` | `milling.maxDepthMm` | `TO_CONFIRM` | | Maximum safe groove depth. |
| `mat-egger-white-18` | `elasticModulusMPa` | `TO_CONFIRM` | | Used for shelf deflection calculation. |
| `mat-egger-white-18` | `pricePerSheet` | `TO_CONFIRM` | | Local supplier price per sheet. |
| `mat-egger-oak-18` | `milling.maxDepthMm` | `TO_CONFIRM` | | Maximum safe groove depth. |
| `mat-egger-oak-18` | `elasticModulusMPa` | `TO_CONFIRM` | | Used for shelf deflection calculation. |
| `mat-egger-oak-18` | `pricePerSheet` | `TO_CONFIRM` | | Local supplier price per sheet. |

### Edge Bands

| Edge Band ID | Field | Current Value | Confirmed Value | Notes |
|---|---|---|---|---|
| `eb-white-08` | `pricePerMeter` | `TO_CONFIRM` | | Local supplier price per meter. |
| `eb-oak-20` | `pricePerMeter` | `TO_CONFIRM` | | Local supplier price per meter. |

### Nesting and Cutting (Phase 1 Task 5)

| Parameter | Current Default | Confirmed Value | Notes |
|---|---|---|---|
| Saw kerf (`sawKerfMm`) | `3.2 mm (TO_CONFIRM)` | | Blade cut thickness of panel saw. |
| Trim margin (`trimMarginMm`) | `10.0 mm (TO_CONFIRM)` | | Perimeter waste margin on raw sheet. |
| Price per cut pass (`pricePerCutPass`) | `TO_CONFIRM` | | Workshop cost per through-cut pass of the panel saw. |

### Hardware (Phase 1 Task 6 & Phase 2 Task 2)

| Hardware ID | Field | Current Value | Confirmed Value | Notes |
|---|---|---|---|---|
| `hw-confirmat-7x50` | `pricePerUnit` | `TO_CONFIRM` | | Confirmat screw unit price. |
| `hw-cam-dowel-15` | `pricePerUnit` | `TO_CONFIRM` | | Cam lock and dowel set price. |
| `hw-dowel-8x35` | `pricePerUnit` | `TO_CONFIRM` | | Wooden dowel unit price. |
| `hw-hinge-cup-35` | `pricePerUnit` | `TO_CONFIRM` | | Concealed Euro cup hinge 35mm. |
| `hw-slide-telescopic` | `pricePerUnit` | `TO_CONFIRM` | | Ball bearing telescopic slide pair. |
| `hw-shelf-pin-5` | `pricePerUnit` | `TO_CONFIRM` | | Shelf support pin 5mm unit price. |

### Drawer & Slide Clearances (Phase 1 Task 9 & Phase 2 Task 2)

| Parameter | Current Default | Confirmed Value | Notes |
|---|---|---|---|
| Telescopic slide clearance (`slideClearanceTelescopicMm`) | `25.4 mm (TO_CONFIRM)` | | 12.7 mm per side for ball bearing slides. |
| Undermount slide clearance (`slideClearanceUndermountMm`) | `10.0 mm (TO_CONFIRM)` | | 5.0 mm per side for concealed undermount slides. |
| Metal box slide clearance (`slideClearanceMetalBoxMm`) | `31.0 mm (TO_CONFIRM)` | | 15.5 mm per side for metal drawer box profiles. |
| Roller slide clearance | `25.0 mm (TO_CONFIRM)` | | 12.5 mm per side for bottom metal roller slides. |
| Drawer reveal gap (`drawerFrontGapMm`) | `3.0 mm (TO_CONFIRM)` | | Vertical and horizontal gap between drawer fronts. |
| Drawer box front offset (`drawerBoxFrontOffsetMm`) | `10.0 mm (TO_CONFIRM)` | | Inset setback of drawer box behind carcase or inset front. |
| Drawer box bottom clearance (`drawerBoxBottomClearanceMm`) | `15.0 mm (TO_CONFIRM)` | | Vertical clearance below drawer box for runner. |
| Door full-overlay reveal (`doorOverlayRevealMm`) | `1.5 mm (TO_CONFIRM)` | | Perimeter reveal for full-overlay door. |
| Door half-overlay reveal (`doorHalfOverlayRevealMm`) | `1.5 mm (TO_CONFIRM)` | | Perimeter reveal for half-overlay door on shared side. |
| Door inset gap (`doorInsetGapMm`) | `2.0 mm (TO_CONFIRM)` | | Perimeter clearance gap between inset door and carcase. |
| Adjustable shelf lateral gap | `2.0 mm (TO_CONFIRM)` | | 1.0 mm per side for smooth insertion onto shelf pins. |
| Hinge end setback distance (`doorHingeMarginMm`) | `100.0 mm (TO_CONFIRM)` | | Distance from top/bottom door edge to hinge center. |

### Machining and Assembly Gauges (Phase 2 Work Package 2)

| Parameter | Current Default | Confirmed Value | Notes |
|---|---|---|---|
| Default assembly gauge width (`defaultGaugeWidthMm`) | `50.0 mm (TO_CONFIRM)` | | Standard width for auxiliary gauge strips cut from offcuts. |

### Shelf Deflection Limits (Phase 2 Task 5)

| Parameter | Current Default | Confirmed Value | Notes |
|---|---|---|---|
| Elastic modulus default (`DEFAULT_ELASTIC_MODULUS_MPA`) | `3000 MPa (TO_CONFIRM)` | | Default modulus of elasticity for wood panel boards (PB/MDF). |
| Maximum deflection ratio (`maxDeflectionRatio`) | `200 (TO_CONFIRM)` | | Span ratio limit L / 200 for shelf sag under load. |
| Maximum absolute deflection (`maxAbsoluteDeflectionMm`) | `3.0 mm (TO_CONFIRM)` | | Maximum absolute sag limit in millimeters. |
| Design uniform load (`designUniformLoadKgM2`) | `30.0 kg/m² (TO_CONFIRM)` | | Standard storage load per square meter for kitchen cabinets. |

### Countertop & Built-In Equipment (Phase 3)

| Parameter / Item ID | Field | Current Default | Confirmed Value | Notes |
|---|---|---|---|---|
| `ct-granite-gris-mara-20` | `pricePerM2` | `TO_CONFIRM` | | Natural stone material cost per m². |
| `ct-granite-negro-brasil-20` | `pricePerM2` | `TO_CONFIRM` | | Natural stone material cost per m². |
| `ct-quartz-white-zeus-20` | `pricePerM2` | `TO_CONFIRM` | | Quartz composite material cost per m². |
| `ct-sintered-dekton-12` | `pricePerM2` | `TO_CONFIRM` | | Sintered ultracompact stone material cost per m². |
| `ct-wood-paraiso-30` | `pricePerM2` | `TO_CONFIRM` | | Finger-joint solid wood panel cost per m². |
| `ct-hpl-laminate-postformed-30` | `pricePerM2` | `TO_CONFIRM` | | HPL postformed countertop cost per m². |
| `eq-sink-johnson-luxon-ln50` | `price` | `TO_CONFIRM` | | Undermount single basin sink retail/trade price. |
| `eq-sink-mipileta-420e` | `price` | `TO_CONFIRM` | | Undermount compact sink retail/trade price. |
| `eq-sink-johnson-c37` | `price` | `TO_CONFIRM` | | Undermount double basin sink retail/trade price. |
| `eq-cooktop-domec-gas-4` | `price` | `TO_CONFIRM` | | Built-in 4-burner gas cooktop price. |
| `eq-cooktop-orbis-induction-4` | `price` | `TO_CONFIRM` | | Built-in 4-zone induction cooktop price. |
| `eq-oven-ariston-builtin-60` | `price` | `TO_CONFIRM` | | Built-in 60cm electric oven price. |
| Countertop front overhang | `frontOverhangMm` | `25.0 mm (TO_CONFIRM)` | | Standard countertop overhang beyond door/drawer front face. |
| Backsplash height | `backsplash.heightMm` | `60.0 mm (TO_CONFIRM)` | | Standard wall upstand/zocalín height in stone. |
| Faucet hole diameter | `faucetHole.diameterMm` | `35.0 mm (TO_CONFIRM)` | | Standard single-lever mixer tap borehole diameter. |

### Workshop Machining Tools (Phase 4 Task 1)

| Tool ID | Field | Current Default | Confirmed Value | Notes |
|---|---|---|---|---|
| `tool-drill-3` | `price` | `TO_CONFIRM` | | Ø3mm screw guide drill bit unit price. |
| `tool-drill-5` | `price` | `TO_CONFIRM` | | Ø5mm system 32 drill bit unit price. |
| `tool-drill-8` | `price` | `TO_CONFIRM` | | Ø8mm dowel drill bit unit price. |
| `tool-drill-10` | `price` | `TO_CONFIRM` | | Ø10mm connector drill bit unit price. |
| `tool-forstner-15` | `price` | `TO_CONFIRM` | | Ø15mm Minifix cam forstner bit unit price. |
| `tool-forstner-35` | `price` | `TO_CONFIRM` | | Ø35mm hinge cup forstner bit unit price. |
| `tool-router-straight-3` | `price` | `TO_CONFIRM` | | Ø3mm straight bit for 3mm back grooves. |
| `tool-router-straight-6` | `price` | `TO_CONFIRM` | | Ø6mm straight bit for 5.5mm grooves/cables. |
| `tool-router-straight-10` | `price` | `TO_CONFIRM` | | Ø10mm straight bit for hardware pockets. |
| `tool-router-straight-12` | `price` | `TO_CONFIRM` | | Ø12mm perimeter cutter for CNC. |
| `tool-router-chamfer-45` | `price` | `TO_CONFIRM` | | 45° chamfer profile router bit. |
| `tool-router-roundover-r3`| `price` | `TO_CONFIRM` | | R3mm roundover profile router bit. |
| `tool-router-jpull` | `price` | `TO_CONFIRM` | | J-Pull integrated grip router bit. |

## 2. General Shop Values (from Plan Section 12)

1. **Sheet sizes and thicknesses.** Confirm actual board dimensions in local shop stock.
2. **Saw kerf and trim margin.** Kerf width of panel saw blade and boundary trim margin.
3. **Edge band types and thicknesses.** Confirmed edge band stock and finished thickness impact.
4. **Structural piece rules.** Rules that determine which pieces must be structural.
5. **Maximum groove depth.** Safe limit for hidden grooves per board core type.
6. **Drawer and slide clearances.** Side, bottom, and back clearance for standard slides.
7. **Hinge boring positions.** Cup hole diameter, edge setback, and distance from ends.
8. **Countertop overhang.** Standard front and side overhang dimensions.
9. **Shop machines and labor rates.** Setup time and hourly cost per station.
10. **CNC shop parameters.** File format requirements, tool diameters, and external job pricing.
11. **Equipment specifications.** Installation clearances for sinks, ovens, and cooktops.
