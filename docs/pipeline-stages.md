# Pipeline Stages & Customization

## Stage Architecture
The stage architecture is represented by the `Stage` model in PostgreSQL via Prisma:
- `id`: Unique identifier (e.g. `stage-sourced`, `stage-placed`)
- `organizationId`: Scoped to tenant (e.g. `org-aureva-1`)
- `clientId`: Optional override for client-specific pipelines
- `name`: Human-readable label (e.g. "Screening", "Client Review")
- `stageType`: Enum `ApplicationStatus` backing the stage
- `order`: Integer sequence (0-7 for default stages)
- `isArchived`: Soft-deletion support

## Default Stages
1. SOURCED (0)
2. SCREENING (1)
3. INTERVIEW (2)
4. TECHNICAL (3)
5. CLIENT_REVIEW (4)
6. OFFER (5)
7. PLACED (6)
8. REJECTED (7)
