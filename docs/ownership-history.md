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

## 2. Immutability & Querying
- Records in `OwnershipHistory` cannot be updated or deleted.
- Accessible via the `/handover/history` dashboard and `GET /api/handover/ownership-history`.
- Supports filtering by:
  - Resource Entity Type (`CANDIDATE`, `JOB`, `TASK`).
  - Transferred From / Transferred To recruiter.
  - Date Range.
  - Free-text search matching entity names or reason descriptions.
