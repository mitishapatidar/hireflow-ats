# HireFlow ATS — Phase 1 Client Demo Presentation Script

**Client / Tenant:** Aureva Capital Private Limited  
**Duration:** 30–45 minutes  
**Presenter:** Lead Solutions Architect / Lead Recruiter  
**Demo Accounts Ready:** `anika.rao@hireflow.io` (Admin), `riya.desai@hireflow.io` (Manager), `mitisha.p@hireflow.io` (Recruiter)  
**Password:** `HireFlow@2026!`

---

## 1. Demo Flow Overview (22-Step Journey)

| Step # | Screen & Route | Action & Talking Point | Key Figma Ref |
|---|---|---|---|
| **01** | `/login` | Sign in as Recruiter (`mitisha.p@hireflow.io`). Mention role-based authentication and secure session cookie. | Frame 30 |
| **02** | `/dashboard` | Recruiter Dashboard overview: Live KPIs (Open Jobs, Candidates, Today's Interviews, Pending Submissions), Today's Agenda. | Frame 01 |
| **03** | `/dashboard/activity` | Recruiter Daily Activity: Show targets vs actuals (calls, sourced, submissions, interviews booked). | Frame 39 |
| **04** | `/candidates` | Candidate Pool: Search by skill ("React", "Kubernetes"), filter by status and experience. Highlight zero hard deletes. | Frame 03 |
| **05** | `/candidates/new` | Add Candidate & Resume Upload: Drag & drop PDF resume. Automatic text extraction and skill auto-tagging. | Frame 03 |
| **06** | `/candidates/[id]` | Candidate 360 Profile: Tabs for Overview, Experience, protected Internal Notes, Documents, and Activity Timeline. | Frame 04 |
| **07** | `/jobs` | Jobs Directory: Requisitions table with live stage count pills, client links, and target margins. | Frame 02 |
| **08** | `/jobs/new` | Create Job Requisition: Define client, salary range, workplace type (Hybrid/Remote), and interview rounds. | Frame 02 |
| **09** | `/jobs/[id]/pipeline` | Kanban Pipeline: Interactive drag-and-drop from Sourced -> Screening -> Technical Interview. | Frame 05 |
| **10** | `/interviews` | Interviews Calendar: Monthly/Weekly views showing scheduled rounds with Google Meet links. | Frame 06 |
| **11** | `/interviews/schedule` | Schedule Interview Modal: Availability check, panel member selection, mock video meeting link generator. | Frame 27 |
| **12** | `/interviews/[id]/feedback` | Panel Feedback Form: Scorecard evaluation (Technical, Communication), recommendation (Strong Yes). | Frame 27 |
| **13** | `/submissions` | Client Submissions List: Match score badge (92%), approval status badge, submission history. | Frame 07 |
| **14** | `/submissions/[id]/profile` | Standard Profile Generator: Recruiter-side view of sanitized, client-ready profile with watermark. | Frame 29 |
| **15** | `/submissions/[id]/preview` | HTML & PDF Preview: Verification that confidential margins and personal candidate phone are omitted. | Frame 29 |
| **16** | `/submissions/[id]/send` | Send to Client: Mock email / WhatsApp integration dispatch with immutable audit log recording. | Frame 07 |
| **17** | `/clients` | Clients CRM: Company profiles, active jobs count, account owner recruiter, fee terms. | Frame 08 |
| **18** | `/clients/[id]` | Client 360 View: Contacts directory, commercial agreement details, active requisitions. | Frame 09 |
| **19** | `/sales` | Sales CRM: Opportunities pipeline (Proposal, Negotiation, Closed Won) and upcoming client meetings. | Frame 23 |
| **20** | `/communications` | Communications Hub: Candidate messaging threads, email & WhatsApp template library with merge tags. | Frame 24 & 25 |
| **21** | `/team` | Switch to Admin (`anika.rao@hireflow.io`): Team structure, user roles, permission matrix, invitation management. | Frame 15 |
| **22** | `/audit` | Audit Trail: Immutable chronological activity log showing who did what, when, and IP address. | Frame 17 |

---

## 2. Presenter Preparation & Fallback Procedures

1. **Pre-Demo Sanity Check:**
   - Run `pnpm demo:reset` 10 minutes prior to call to ensure a pristine state.
   - Verify web server is running on `http://localhost:3000`.
   - Ensure demo credentials are ready in a scratchpad.
2. **Offline / Sandboxed Integrations Notice:**
   - In accordance with HireFlow ATS rules, external integrations (Gmail, Outlook, WhatsApp Business Cloud, Twilio SMS, Google Meet) are presented with realistic mock providers and sandbox markers.
   - Explain to client: *"All integration abstractions are production-ready; we run in secure sandbox mode so no unsolicited test emails or messages are dispatched to real candidate inboxes."*
3. **Recovery Command:**
   - If a presenter makes unwanted data modifications during a live presentation, simply run:
     ```bash
     pnpm demo:reset
     ```
     Within 15 seconds, the entire demo environment is restored to its exact canonical baseline.
