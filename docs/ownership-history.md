# HireFlow ATS — Ownership History & Handover Audit Trail

## Overview
The Ownership History module provides an immutable, permanent audit log of all resource ownership changes (candidates, jobs, and tasks) across the organization.

---

## 1. Schema & Data Model
Every resource transfer creates an immutable record in `OwnershipHistory`:
- `id`: Unique identifier (UUID).
- `organizationId`: Multi-tenant organization boundary.
- `handoverRequestId`: Optional reference to the parent `HandoverRequest`.
- `entityType`: Transferred resource type (`CANDIDATE`, `JOB`, `TASK`).
- `entityId`: Unique identifier of the transferred resource.
- `entityName`: Snapshot display name/code of the resource at transfer time (e.g., candidate name, job title, task title).
- `fromUserId`: Previous owner identifier.
- `toUserId`: New designated owner identifier.
- `reason`: Justification recorded for the handover (e.g., "Relocation to Enterprise Pod", "Medical leave coverage").
- `transferredById`: User who approved and executed the transfer.
- `createdAt`: ISO-8601 UTC timestamp of execution.

---

## 2. Immutability Guarantees & Architectural Boundaries
- **Application-Level Append-Only Enforcement**:
  - The API layer (`/api/handover/*`) and Server Actions (`apps/web/src/actions/handover.ts`) strictly provide insertion and read-only query endpoints.
  - No update or delete endpoints or mutations exist in the application code for `OwnershipHistory` rows.
- **Database Immutability & Trigger Scope**:
  - True database-level immutability (PostgreSQL append-only triggers preventing SQL `UPDATE` or `DELETE` statements at the engine level) requires custom database migrations and trigger functions.
  - In accordance with `AGENTS.md` rules requiring explicit user approval before modifying database schemas or migrations, database-level triggers are documented as an infrastructure enhancement and have not been executed without explicit migration authorization.
- **Verified-Only Recording**:
  - History rows are created exclusively for entities whose ownership transfer was verified and executed within the atomic transaction.

---

## 3. Querying & Dashboards
- Accessible via the `/handover/history` dashboard and `GET /api/handover/ownership-history`.
- Supports filtering by:
  - Resource Entity Type (`CANDIDATE`, `JOB`, `TASK`).
  - Transferred From / Transferred To recruiter.
  - Date Range.
  - Free-text search matching entity names or reason descriptions.
