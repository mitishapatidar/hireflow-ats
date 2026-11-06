# Job Pipeline (Kanban Board) Architecture

## Overview
The Job Pipeline module provides a job-specific Kanban board at `/jobs/[id]/pipeline` allowing recruiters and managers to manage candidate applications across stages.

## Key Features
- **Job-Specific View:** Scoped to a single job mandate with code, title, client name, and open positions.
- **Accessible Kanban:** Built with `@dnd-kit` supporting pointer drag-and-drop and full keyboard navigation (Space to grab, Arrow keys to navigate, Space to drop).
- **8 Dynamic Stages:** Sourced, Screening, Interview, Technical, Client Review, Offer, Placed, Rejected.
- **Candidate Drawer:** Slide-over detail view with candidate profile, salary expectations, notes, and activity timeline.
- **Structured Rejection:** Mandatory rejection reason code and feedback; strictly prevents silent rejections.
- **Duplicate Prevention:** Duplicate applications for the same candidate and job return HTTP 409 `DUPLICATE_APPLICATION`.
- **Anti-Leak Security:** Candidacy cards and drawers exclude confidential recruiter margins, client commercial terms, and placement fees.
