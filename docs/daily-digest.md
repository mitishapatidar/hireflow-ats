# Daily Pending-Action Digest

## Overview
The Daily Digest is an automated briefing delivered every weekday at **08:30 IST** (`Asia/Kolkata` timezone). It consolidates critical operational action items for recruiters, hiring managers, and administrators into a single readable summary.

## Digest Contents & Aggregation
The digest calculates user-scoped and team-scoped metrics:
1. **Pending Approvals**:
   - Submissions awaiting client review or internal sign-off.
   - Pending job requisitions or offer approvals.
2. **Today's Scheduled Interviews**:
   - Time, candidate name, job title, interview round, panel members, and join link.
3. **Tasks Due Today & Overdue Follow-ups**:
   - Actionable list of tasks with priority badges and quick-link URLs.
4. **Stalled Pipeline Alerts**:
   - Candidates stranded in review or screening stages exceeding client SLA thresholds (e.g. > 48 hours without recruiter feedback).

## Scheduling & Execution
- **Cron Timing**: `30 8 * * 1-5` (`Asia/Kolkata` time, corresponding to 03:00 UTC Monday through Friday).
- **Trigger**: Managed via BullMQ repeatable job or Fastify scheduled trigger.
- **Persistence**: Every generated digest is saved to the `DailyDigest` model:
  - `userId`: Target user.
  - `digestDate`: Date string (`YYYY-MM-DD`).
  - `itemsCount`: Total number of pending items included.
  - `content`: JSON payload containing structured sections and items.
  - `status`: `SENT` | `SKIPPED` (if user has 0 pending items and preferences allow quiet mornings).
- **Delivery Channels**:
  - In-App Daily Digest tab in `/notifications` (Frame 35).
  - Morning email briefing to recruiter's corporate address.
