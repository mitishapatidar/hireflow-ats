# Global Command Search Architecture (Prompt 21, Frame 45)

## Overview
HireFlow provides centralized `Ctrl+K` / `Cmd+K` command search across Candidates, Jobs, and Clients.

---

## 1. Role Scoping & Permission Guardrails

Every search query is strictly filtered server-side based on the authenticated actor's role:
- **`ADMIN` / `MANAGER` / `RECRUITER`**:
  - Full search across candidates, active job mandates, and clients in the organization.
- **`CLIENT`**:
  - Can only search candidates submitted to their active jobs.
  - Can only view jobs belonging to their client account.
  - **Zero Access to Clients Table**: Clients can never search or view other client accounts.
- **`CANDIDATE`**:
  - Zero search access across agency-internal candidates, jobs, or clients.

---

## 2. Categorized Entity Tabs
- **`All`**: Aggregated count and blended quick results.
- **`Candidates`**: Name, current title, company, location, and skills tags.
- **`Jobs`**: Title, job code, hiring client, location, and active status chip.
- **`Clients`**: Legal entity name, client code, industry, and account status.
