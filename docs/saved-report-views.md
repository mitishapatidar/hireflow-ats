# Saved Report Views

## Overview
Saved Report Views allow users to bookmark, manage, and share report configurations across HireFlow ATS.

## Data Model
- **Model**: `ReportDefinition` (`packages/db/prisma/schema.prisma`)
  - `id`: UUID primary key
  - `name`: Human-readable name
  - `description`: Optional context description
  - `entityType`: Primary entity (`CANDIDATES`, `JOBS`, etc.)
  - `columns`: Array of selected column keys
  - `filters`: JSON object of applied filters (dateRange, status, recruiterId, etc.)
  - `groupBy`: Optional grouping column
  - `sortBy`: Column key for ordering
  - `sortOrder`: `asc` or `desc`
  - `visibility`: `PRIVATE`, `TEAM`, or `ORGANIZATION`
  - `createdById`: Foreign key to `User`
  - `isArchived`: Soft deletion flag (records are never hard deleted)
- **Model**: `ReportShare`
  - Connects `ReportDefinition` to specific recipient users or teams with read/run permissions.

## Visibility Levels
1. **PRIVATE**: Visible only to the report creator. Default on creation.
2. **TEAM**: Visible to team members belonging to the same manager hierarchy.
3. **ORGANIZATION**: Visible to all internal staff with reporting permissions.

## Deletion & Retention Policy
- Follows ATS Security Commandment 1: **Never Hard Delete**.
- Deleting a view sets `isArchived = true` with a soft deletion timestamp.
- Archived views remain accessible to compliance audits.
