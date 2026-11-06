# HireFlow ATS — Phase 1 Figma Visual Review & Design System Compliance

**Tenant:** Aureva Capital Private Limited  
**Design Reference:** HireFlow ATS & Recruitment CRM Figma System  
**Review Scope:** Frames 01, 02, 03, 04, 05, 06, 07, 08, 09, 15, 17, 21, 22, 23, 24, 25, 27, 29, 30, 39  
**Status:** Approved & Verified

---

## 1. Design Token Matrix Verification

All web interfaces adhere strictly to the approved enterprise recruitment color system:

| Token Name | Hex Code | Usage in Application | Verified Status |
|---|---|---|---|
| **Primary Brand** | `#5B49D6` | Primary CTAs, active tab indicators, selected states | Verified |
| **Primary Light** | `#EEEBFB` | Active menu background, badge backgrounds, hover states | Verified |
| **Navy Accent** | `#1E2A4A` | Sidebar background, modal headers, executive navigation | Verified |
| **Background Neutral** | `#F6F7FB` | Main application shell background, card container backgrounds | Verified |
| **Card Surface** | `#FFFFFF` | Table rows, card backgrounds, modal bodies, dropdown menus | Verified |
| **Border Neutral** | `#E6E8F0` | Dividers, card borders, table separators, input field borders | Verified |
| **Text Primary** | `#1B2236` | Headings, candidate names, job titles, primary data text | Verified |
| **Text Muted** | `#6B7490` | Subtitles, labels, timestamps, secondary metadata | Verified |
| **Success Status** | `#12B76A` | Placed candidates, accepted offers, healthy pipeline badges | Verified |
| **Warning Status** | `#F59E0B` | Pending approvals, nearing deadlines, review stage badges | Verified |
| **Danger Status** | `#E5484D` | Rejected applications, lost opportunities, critical alerts | Verified |
| **Info / Tech Accent**| `#3B82F6` | Interview scheduling, mock video links, informational tooltips| Verified |

---

## 2. Frame-by-Frame Compliance Review

### Frame 01 — Recruiter Dashboard (`/dashboard`)
- **Header & Navigation:** Deep Navy (`#1E2A4A`) sidebar with `#5B49D6` active indicator for "Dashboard".
- **KPI Summary Cards:** Clean `#FFFFFF` cards with `#E6E8F0` borders displaying Open Jobs, Active Candidates, Interviews Scheduled Today, and Pending Client Submissions.
- **Pipeline Snapshot:** Visual funnel stages with percentage distribution and stage counters.
- **Agenda / Today's Schedule:** Dynamic chronological listing of today's interviews and follow-up meetings.

### Frame 02 — Jobs Directory & Creation (`/jobs`)
- **Data Table:** Dense recruitment table with status pills (Draft: `#6B7490`, Active: `#12B76A`, Paused: `#F59E0B`, Closed: `#E5484D`).
- **Create Job Drawer:** Standardized form inputs with `#5B49D6` focus rings and validation error indicators.

### Frame 03 — Candidates Pool (`/candidates`)
- **Candidate Cards / Table:** Displays candidate name, rating stars, current company, tags with `#EEEBFB` badges, and quick actions.
- **Search & Filters:** Debounced search bar, tag multi-select, and archived toggle switch.

### Frame 04 — Candidate Profile & Detail (`/candidates/[id]`)
- **Header Summary:** Candidate avatar, contact details, parsed resume chips, and stage breadcrumbs.
- **Tabs:** Overview, Experience, Education, Notes (strictly protected), Communications Timeline, and Documents.

### Frame 05 — Job Pipeline Kanban (`/jobs/[id]/pipeline`)
- **Kanban Columns:** Sourced, Screened, Submitted, Interview, Offer, Hired, Rejected.
- **Candidate Drag Cards:** Clean card elevation, rating indicators, tags, interview pill, and drop targets with `#5B49D6` highlight.

### Frame 06 — Interviews Calendar (`/interviews`)
- **Views:** Monthly, Weekly, and Day view toggles with `#5B49D6` active tab.
- **Event Blocks:** Color-coded interview chips with candidate name, job title, and mock video call link badge.

### Frame 07 — Client Submissions (`/submissions`)
- **Submission Table:** Candidate match score percentage badge (`#12B76A` for >=80%), submission status, client contact, and version history.
- **Actions:** View Standard Profile, Download Watermarked PDF, Send to Client.

### Frame 08 & 09 — Clients CRM (`/clients`, `/clients/[id]`)
- **Client Cards:** Company logo, active jobs count, account owner recruiter, fee terms (strictly protected).
- **Contacts & Requisitions:** Nested relationship lists with one-click job opening.

### Frame 15 — Team Management & Permissions (`/team`)
- **Role Assignment:** Multi-role user management (Admin, Manager, Recruiter, Client, Candidate).
- **Security:** Granular permission toggle matrix, invitation links with token expiry.

### Frame 17 — Activity Audit Logs (`/audit`)
- **Immutable Log:** Chronological table displaying actor, action, entity type, timestamp, IP address, and changed diffs.

### Frame 21 & 22 — Offers & Placements (`/offers`, `/placements`)
- **Offer Tracking:** Offer details, compensation, client sign-off, candidate acceptance workflow.
- **Placement Records:** Start date, billing fee calculation, recruiter commission attribution.

### Frame 23 — Sales Opportunities & Meetings (`/sales`)
- **Sales Funnel:** Qualified, Proposal, Negotiation, Closed Won, Closed Lost.
- **Meetings:** Scheduled client discovery calls and follow-ups.

### Frame 24 & 25 — Communications Inbox & Templates (`/communications`)
- **Inbox:** Multi-channel tabs (Email, WhatsApp, SMS, Internal Notes).
- **Template Drawer:** Reusable templates with dynamic merge fields (`{{candidate_name}}`, `{{job_title}}`, `{{company_name}}`).

### Frame 27 — Schedule Interview & Feedback Modal (`/interviews/schedule`)
- **Schedule Workflow:** Step-by-step panel member picker, availability slot matrix, mock video meeting link generator, and automatic candidate notification toggle.
- **Feedback Form:** Competency rating criteria (Technical, Communication, Culture Fit), recommendation dropdown (Strong Yes, Yes, Neutral, No, Strong No), and internal feedback notes.

### Frame 29 — Standard Profile Generator (`/submissions/[id]/profile`)
- **Sanitized Profile View:** Client-ready CV presentation stripped of confidential recruiter margin data, direct candidate phone numbers, and internal recruiter notes.
- **Watermark:** Client-branded dynamic watermark ("CONFIDENTIAL - SUBMITTED TO [CLIENT NAME]").

### Frame 30 — Settings & Integrations (`/settings`)
- **Integrations:** Gmail, Outlook, WhatsApp Business Cloud, Twilio SMS status toggles with clear "Mock / Sandboxed" indicator when using developer credentials.

### Frame 39 — Recruiter Daily Activity (`/dashboard/activity`)
- **Activity Metrics:** Submissions target vs actual, interviews booked, outbound calls, offer acceptances.

---

## 3. Responsive & Accessibility Validation

- **Viewport Tests:** Mobile (375px), Tablet (768px), Desktop (1440px). Responsive sidebar collapses to mobile bottom bar / hamburger drawer cleanly.
- **Contrast Ratios:** Text primary (`#1B2236`) against background (`#FFFFFF` and `#F6F7FB`) yields contrast ratio > 12:1 (exceeds WCAG AAA requirement of 7:1).
- **Focus Rings:** Visible focus ring on interactive inputs (`ring-2 ring-[#5B49D6] ring-offset-2`).
