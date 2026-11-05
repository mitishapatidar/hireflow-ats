# Database & Supabase Guidelines

## 1. Schema Conventions
- Use Prisma ORM with Supabase PostgreSQL.
- Primary keys: UUIDs (`@default(uuid())`) or CUIDs for all records.
- All tables must include:
  - `createdAt DateTime @default(now())`
  - `updatedAt DateTime @updatedAt`
  - `isArchived Boolean @default(false)` (for soft-deleting candidates, jobs, clients).

## 2. Relationships & Referential Integrity
- Use explicit foreign keys with indexed relations.
- Never cascade hard deletes on primary business entities (Candidate, Job, Client).
- Duplicate Candidate Protection: Index candidate email and normalized phone number to enable duplicate detection and merge workflows.

## 3. Querying & Performance
- Always paginate candidate lists and application pipelines. Never perform unbounded `findMany()` queries without limits.
- Optimize search queries with PostgreSQL full-text search indexes or trigram matching for candidate skills and names.
