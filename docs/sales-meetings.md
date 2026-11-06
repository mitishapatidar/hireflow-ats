# Sales Discovery Meetings & Calendar Sync

**Module:** Sales CRM  
**Playbook Phase:** Phase 1 — Prompt 15  
**Figma Reference:** Frame 23 — Sales Opportunities & Meetings  

## 1. Overview

Client discovery meetings are tracked within the Sales CRM to manage business development touchpoints, align on mandate requirements, and document commercial discussions with hiring managers and corporate talent leaders.

## 2. Indian Standard Time (IST) Alignment

All meeting dates and time slots are displayed and scheduled in Indian Standard Time (`Asia/Kolkata`, UTC+5:30).

- Input times are converted to ISO UTC timestamps for database persistence.
- Output times are rendered formatted in IST (e.g., `14:30 IST`).

## 3. Calendar Synchronization & Demo Notice

Until production OAuth calendar write permissions (Google Workspace / Microsoft 365) are activated in Prompt 25:
- `calendarProvider` is recorded as `DEMO_MODE`.
- A mock calendar event ID is generated (`mock-cal-<timestamp>`).
- The UI explicitly renders a transparent notice:  
  `"Demo mode — live Google/Outlook event connects in production OAuth"`.
- System guidelines prohibit claiming a simulated meeting was synced to an external Google/Outlook calendar.

## 4. Meeting Outcome Tracking

Recruiters record the outcome of completed meetings:
- Status transition: `SCHEDULED` -> `COMPLETED`, `CANCELLED`, or `RESCHEDULED`.
- Outcome summary: Brief notes on JD alignment, headcount budget, and fee negotiations.
- Next action: Immediate next step (e.g., "Share NDA and standard rate card").
- Next follow-up timestamp: Synchronized automatically with `Opportunity.nextFollowUpAt`.
