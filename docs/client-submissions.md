# Client Submissions Architecture (Figma Frame 07)

## Overview
The Client Submissions module at `/submissions` enables recruiters and managers to manage candidate presentations to corporate clients.

## Key Features
- **Status Filter Chips:** Filter submissions by `All`, `Awaiting Approval`, `Approved`, `Changes Requested`, and `Rejected`.
- **Live Metrics:** Real-time totals reflecting database states without fabricating mock approvals.
- **Deterministic Match Indicator:** Displays calculated match percentage with an interactive tooltip breakdown.
- **Strict Anti-Leak Protection:** Client-facing standard profiles exclude confidential recruiter margins, candidate salary figures, and internal notes.
- **Job Status Enforcement:** Submissions can strictly only be dispatched if the job mandate is `ACTIVE`. If `PAUSED` or `CLOSED`, presentation is blocked with HTTP 409 Conflict.
