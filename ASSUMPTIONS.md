# Architectural & Technical Assumptions — Mobilius Sheet Cutting Optimizer

This document registers the design and architectural assumptions adopted during the implementation of the 2D sheet cutting optimizer as mandated by Section 2 (Rule 7) of `optimizador-corte-prompt.md`.

---

## 1. Coordinate System & Grain Alignment

- **Sheet Orientation**: The primary $X$ axis represents the sheet length (`lengthMm`), which is aligned with the grain direction when `grain === 'ALONG_LENGTH'`. The $Y$ axis represents the sheet width (`widthMm`).
- **Part Orientation & Rotation**:
  - `rotated === false`: Part's `lengthMm` (grain dimension) is parallel to the sheet's $X$ axis (`w = cutLengthMm`, `h = cutWidthMm`).
  - `rotated === true`: Part is rotated by 90°, placing its `lengthMm` parallel to the sheet's $Y$ axis (`w = cutWidthMm`, `h = cutLengthMm`).
- **Grain Relaxation**: For parts with `grain === 'AUTO'` and `visible === false`, rotation is allowed and marked as `grainRelaxed: true` in the placement instance.

---

## 2. Trimming & Usable Sheet Area

- **Trim Offsets**: `trimMm: { top, bottom, left, right }`.
- **Usable Bounding Box**:
  - Minimum coordinate: $X_{min} = \text{trim.left}$, $Y_{min} = \text{trim.bottom}$.
  - Maximum coordinate: $X_{max} = \text{sheetLength} - \text{trim.right}$, $Y_{max} = \text{sheetWidth} - \text{trim.top}$.
  - Usable dimensions: $\text{usableL} = X_{max} - X_{min}$, $\text{usableW} = Y_{max} - Y_{min}$.
- **Trim Cuts**: When trim margins $> 0$, 4 perimeter trim cuts (Stage 0) are emitted in the cut sequence. They are charged if `trimCutsAreCharged === true`.

---

## 3. Saw Kerf & Physical Separation

- **Kerf Application**: Every saw pass removes a material width equal to `kerfMm`.
- Two parts sharing a cut line are separated by at least `kerfMm`.
- For CNC (`MANUAL_FREE`), `kerfMm` represents tool diameter (default 6.0 mm). Cut length represents the perimeter of routed parts.

---

## 4. Offcuts & Residual Area

- **Usable Offcut Threshold**: Any residual free rectangle with both $w \ge \text{cost.minOffcutMm}$ and $h \ge \text{cost.minOffcutMm}$ is classified as a usable offcut (`offcuts: Rect[]`) and credited based on `offcutCreditPerM2`.
- **Waste Area**: The remaining area inside the usable bounds that does not contain parts or usable offcuts is classified as waste.

---

## 5. Staged Saw Constraints (`maxStages`)

- When `maxStages > 0`, cutting operations are constrained to tree depths $\le \text{maxStages}$.
  - Stage 1: Strips along the initial cut direction ($V$ or $H$).
  - Stage 2: Cross-cuts inside strips.
  - Stage 3: Piece sizing/trimming.
