# Report Query Engine Architecture

## Overview
The Report Query Engine (`apps/api/src/services/report-builder.ts` and `packages/shared/src/reports.ts`) provides a secure, optimized, and performant data fetching pipeline for internal ATS custom reports.

## Query Lifecycle
1. **Schema Validation**:
   - Incoming query requests are validated against `ReportQuerySchema` (Zod).
   - Validates entity, selected columns, filters, groupBy, sort, page, and limit.
2. **Column Allowlist & Verification**:
   - Columns are checked against `REPORT_COLUMN_CATALOG` and `FORBIDDEN_REPORT_FIELDS`.
   - Any unpermitted or forbidden fields (e.g. `rawPassword`, `passwordHash`, `twoFactorSecret`, client commercial rates for non-admins) immediately throw a 400 Bad Request error.
3. **Role-Based Row Scoping**:
   - `RECRUITER`: Automatically injects `recruiterId: userId` or filters by assigned jobs and candidates.
   - `MANAGER` / `ADMIN`: Operates within tenant organization boundaries (`tenantId`).
   - `CLIENT` / `CANDIDATE`: Blocked at the route guard level (`requireRole`).
4. **Optimized Execution & Pagination**:
   - Aggregations are calculated via Prisma `groupBy` and count queries.
   - Bounded queries (`take: 5` for preview, bounded streaming batches for export).
   - Relations are eagerly loaded using selective Prisma `include` blocks.
5. **Data Transformation & Aggregation**:
   - Flattens nested relations according to dot-notation keys (e.g., `client.name`, `job.title`, `candidate.fullName`).
   - Group summaries compute item counts and averages dynamically.
6. **Timezone Normalization**:
   - All input dates and system timestamps are stored in UTC in PostgreSQL.
   - Live query responses provide metadata formatted in `Asia/Kolkata` (IST) with explicit timezone offsets.
