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
