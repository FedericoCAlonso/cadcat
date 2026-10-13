# Ideas and Future Considerations

Document language: ASD-STE100 (Simplified Technical English).

This document lists ideas for future phases.
Do not implement these features in the current phase.

## 1. Storage and Portability

- **Backup and Restore:** Allow the user to export and import all IndexedDB stores as a single JSON file.
- **Automated Schema Migrations:** Implement sequential migration functions in the storage layer when `schemaVersion` increases.

## 2. Workshop Usability

- **High Contrast Theme:** Provide a workshop theme with high contrast text for bright or dusty environments.
- **Piece Label Printing:** Generate printable sticky labels with piece id, dimensions, edge bands, and barcode/QR code.

## 3. Nesting and Production

- **Manual Nesting Adjustments:** Allow the user to reposition or flip pieces inside sheet offcuts after automatic nesting runs.
- **Offcut Inventory:** Store unused rectangular sheet remnants in a local offcut catalog for future smaller jobs.

## 4. Hardware and Visuals

- **Hardware Footprint Visualizer:** Render interactive 2D hole templates for drawer slides and concealed hinges.
- **Machining Preview in 3D:** Show drilled holes and edge banding colors directly on the 3D model pieces.
