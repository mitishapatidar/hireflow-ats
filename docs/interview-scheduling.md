# Interview Scheduling Workflow (Figma Frame 27)

## 1. Overview
The scheduling workflow enables authorized recruiters and managers to book interview rounds for candidate applications with double-booking prevention, panel coordination, and mock meeting generation.

## 2. Requirements & Validations
- **Eligible Jobs:** Only jobs with status `ACTIVE` may receive new interview schedules (HTTP 409 returned for `PAUSED`, `CLOSED`, or `DRAFT` jobs).
- **Candidate Application:** Must belong to an active candidate within the organization.
- **Job Rounds:** Dynamically populated from `JobRound` with order and default duration.
- **Panel Members:** At least one active internal user must be assigned to the interview panel.
- **Timezone & Storage:** Scheduled wall time is entered in IST, converted to UTC, and stored as an ISO timestamp in `Interview.scheduledAt`.
- **Double-Booking Protection:** Atomic concurrency check in `prisma.$transaction`. If an overlapping interview exists for any assigned panel member, the transaction rolls back and returns HTTP 409 Conflict.
- **Mock Video Meeting Link:** Generates deterministic demo meeting links labeled `Demo mode`. Live Google Workspace and Microsoft Teams APIs connect in Prompt 25.
