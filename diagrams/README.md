# Diagrams Index (Lab 3)

This index marks the **master deliverable artifacts** and keeps existing files as supporting references.

## Master Deliverables

1. **Complete Use Case Model**
- `Use Case Diagrams/SmartLocateSG_UseCaseModel_Master.puml`

2. **Design Model - Class Diagram**
- `Class Diagrams/SmartLocateSG_DesignClassDiagram_Master.puml`

3. **Design Model - Dialog Map**
- `Dialog Map/SmartLocateSG_DialogMap_Master.puml`

4. **System Architecture**
- `System Architecture/SmartLocateSG_SystemArchitecture.puml`
- `System Architecture/README.md`

## Supporting References
Feature-specific diagrams in each folder remain valid supporting views for deeper detail (auth, map, portfolio, compare, sequence-level scenarios).

## Traceability Pointers
- Use case descriptions: `project_descriptions/usecase_model_description.md`
- Frontend behavior source: `frontend/client/src/pages/*`
- API flow source: `frontend/server/routes.ts`
- Persistence source: `database/database_schema.sql`

## Notes
- Master diagrams were aligned against current implementation and schema.
- Existing legacy/draft diagram files are intentionally retained for history and discussion.

## Generate PNG and SVG
Run the script below from the repository root (or from the `diagrams` folder):

```powershell
powershell -ExecutionPolicy Bypass -File "diagrams/render-diagrams.ps1"
```

Optional clean-render (deletes existing PNG/SVG first):

```powershell
powershell -ExecutionPolicy Bypass -File "diagrams/render-diagrams.ps1" -Clean
```

Output behavior:
- If a `.puml` file is inside a `puml files` subfolder, generated `.png` and `.svg` files are written to that subfolder's parent diagram folder.
- Otherwise, generated files are written next to the `.puml` source.
