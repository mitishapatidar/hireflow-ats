# Manager Overview Dashboard (Figma Frame 13)

## 1. Overview
The **Manager Overview** dashboard (`/manager`) provides leadership and management teams at HireFlow agencies (such as Aureva Capital) with real-time operational visibility into recruitment throughput, team capacity, pending approval queues, and monthly commercial performance.

## 2. Access & Authorization
- **Roles Permitted:** `ADMIN`, `MANAGER`
- **Roles Prohibited:** `RECRUITER`, `CLIENT`, `CANDIDATE` (redirected to `/dashboard` or rejected with `403 FORBIDDEN`)
- **Scope Restriction:**
  - `ADMIN`: Organization-wide visibility across all teams and recruiters.
  - `MANAGER`: Scoped strictly to direct and indirect reporting subordinates resolved via recursive hierarchy traversal.

## 3. Real-Time KPI Metrics
The top KPI cards aggregate real database state from Supabase PostgreSQL via Prisma ORM:
1. **Mandates Awaiting Approval:** Active jobs in `PENDING_APPROVAL` status requiring manager sign-off.
2. **Submissions Awaiting Approval:** Candidate submissions in `PENDING_MANAGER_APPROVAL` status awaiting compliance sign-off.
3. **Active Recruiters in Team:** Count of active recruiters within the manager's reporting line.
4. **Placements This Month:** Offers with status `ACCEPTED` closed in the current calendar month with aggregated placement fees in INR (₹).

## 4. Pending Approval Action Queue
Displays an actionable preview of items awaiting manager action:
- **Mandate Approvals (`JOB`):** Displays client name, mandate title, salary range, openings, and submitting recruiter. Action button routes directly to `/approvals?tab=jobs`.
- **Candidate Submissions (`SUBMISSION`):** Displays candidate name, target job mandate, client company, submission version tag, and submitter name. Action button routes directly to `/approvals?tab=submissions`.

## 5. Recruiter Team Performance Breakdown
A consolidated table comparing recruiters within the manager's line:
- **Recruiter Profile:** Name, email, title, and avatar.
- **Active Mandates:** Count of currently assigned active jobs (`JobAssignment.status = ACTIVE`).
- **Submissions Sent:** Total submissions generated for client review.
- **Interviews Scheduled:** Count of candidate interviews where recruiter is on panel or assigned.
- **Monthly Placements:** Placements achieved during the active month.
- **Activity Target Compliance:** Percentage adherence against configured daily activity goals (calls, screenings, submissions).
