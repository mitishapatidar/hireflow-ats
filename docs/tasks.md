# Follow-up Tasks Management

## Overview
Follow-up Tasks in HireFlow ATS (Figma Frame 35) enable recruiters, managers, and administrators to track critical actions across candidate pipelines, interview preparations, client check-ins, and compliance requirements.

## Core Capabilities
- **Creation & Assignment**:
  - Tasks can be associated with any internal entity (`CANDIDATE`, `JOB`, `INTERVIEW`, `CLIENT`, or `SUBMISSION`).
  - Strict role-based delegation rules: Admins and Managers can assign tasks to any team member. Recruiters can only assign tasks to themselves.
- **Due Date & Snooze Controls**:
  - Support for `dueDate` and explicit `reminderAt` timestamps.
  - Snooze presets: 1 hour, 3 hours, tomorrow morning (09:00 IST), or custom date-time.
  - Snoozing a task automatically pushes the reminder, clears previous pending notifications, and records an audit log.
- **Completion & State Lifecycle**:
  - Tasks support transitions: `PENDING` -> `COMPLETED`, `SNOOZED`, or `CANCELLED`.
  - Completing a task cancels any scheduled BullMQ delayed reminders.
  - Filtering by status: `all`, `today`, `overdue`, and `completed`.
- **Soft-Archiving**:
  - Tasks are never hard deleted; tasks use `isArchived: true` with audit traceability.

## Data Model
- `Task` model in Prisma:
  - `id`: Unique identifier (UUID).
  - `title`: Short task summary (1-200 characters).
  - `description`: Detailed markdown or text notes.
  - `priority`: `LOW`, `MEDIUM`, `HIGH`, `URGENT`.
  - `status`: `PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`.
  - `dueDate`: Date when the task is due.
  - `reminderAt`: Optional timestamp for pre-due alert (e.g. 15 minutes before).
  - `snoozedUntil`: Pushed deadline when snoozed.
  - `relatedEntity`: `CANDIDATE` | `JOB` | `INTERVIEW` | `CLIENT` | `SUBMISSION`.
  - `relatedEntityId`: ID of the linked record.
  - `assignedToId`: Responsible user ID.
  - `createdById`: Creator user ID.
  - `isArchived`: Soft deletion flag.
