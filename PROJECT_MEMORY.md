# Project Memory & Handoff Document: HireFlow ATS & Recruitment CRM

> **Note for any AI Agent or Developer:**  
> Read this file first. It contains the single source of truth for the project background, requirements, architectural decisions, completed work, and current roadmap. Always update this file whenever a task or milestone is completed.

---

## 1. Project Overview & Background
- **Project Name:** HireFlow ATS & Recruitment CRM
- **Organization / Client:** Aureva Capital Private Limited (Client: Recruitment & Staffing Agency)
- **Figma Design References:** Based on project wireframes & components (Frames 00–48)
- **Objective:** Build a complete, production-grade Applicant Tracking System (ATS) and Recruitment CRM from scratch. The system manages the entire recruitment lifecycle: sourcing & parsing resumes, managing candidates, jobs, and clients, running interviews and submissions, tracking offers and placements, team performance reporting, sales CRM for prospective clients, and a dedicated client portal.

---

## 2. Five Target User Roles & Permissions
1. **Recruiter:** Sourcing candidates, managing assigned jobs, scheduling interviews, candidate submissions to clients, daily task activity.
2. **Manager:** Assigning jobs, approving new jobs & client submissions, tracking pipelines, reviewing recruiter performance.
3. **Admin:** Full access control, team structure, email signatures, custom fields, data export limits, security, and audit logs.
4. **Client:** Dedicated client portal to track open job orders, review standardized candidate submissions, approve/reject profiles, view interview schedules.
5. **Candidate:** Candidate portal / tracking link: receive email/WhatsApp updates, self-schedule interview slots, view public careers portal.

---

## 3. Technology Stack Decisions
- **Full-Stack Framework:** Next.js (App Router, TypeScript, React 19/18)
- **Styling & Components:** Tailwind CSS, Lucide React icons, Radix UI / Shadcn UI patterns
- **Database:** PostgreSQL (Hosted on **Supabase**)
- **ORM & Data Layer:** **Prisma ORM** (strict type safety, migrations, relational queries)
- **Authentication:** NextAuth.js / Supabase Auth with Google OAuth2, Email/Password, and OTP 2-step verification
- **File & Document Storage:** Supabase Storage (Buckets: `resumes`, `client-documents`)
- **Document Parsing:** `pdf-parse` + `mammoth` (Word .docx) for automatic candidate profile extraction
- **Form & Validation:** React Hook Form + Zod schemas (client and server validation)

---

## 4. Strict Security & Architectural Rules (Claude-Style Discipline)
All development must adhere to `AGENTS.md` and `.agents/rules/`:
1. **Never Hard Delete:** Soft-delete only (`isArchived: true` with timestamp).
2. **Server-Side Authorization:** Every server action and API endpoint verifies role and tenant permissions.
3. **Data Leak Prevention:** Internal candidate notes, margins, and client commercial terms are never exposed to Client or Candidate APIs.
4. **Plan Before Code:** Produce a short implementation plan and wait for approval before modifying auth, permissions, DB schema, or 3rd-party integrations.
5. **Verification Protocol:** Run type checks (`tsc --noEmit`), linting, and manual verification after each step before marking it done.
6. **Small Diffs & Honesty:** Prefer small, reviewable changes and clearly report what works, what is untested, and what remains.

---

## 5. Scope Roadmap (3 Phases)

### Phase 1 — Core ATS Foundation (Current Target)
- [ ] Next.js + TypeScript + Tailwind initialization and setup
- [ ] Supabase PostgreSQL database connection + Prisma ORM schema
- [ ] Authentication (Email/Password, Google OAuth, Role-based route protection)
- [ ] Team structure & reporting lines (Admin, Manager, Recruiter)
- [ ] Candidate Management:
  - [ ] Manual candidate profile entry
  - [ ] Resume auto-fill parser (PDF & Word `.docx`)
  - [ ] Candidate profile view (salary, location, notes, tags)
  - [ ] Candidate database search & filtering
- [ ] Jobs & Clients:
  - [ ] Client master records & contacts
  - [ ] Job openings with interview rounds configuration
  - [ ] Job status tracking (Open, Paused, Closed with reasons)
  - [ ] Job assignment to recruiters
- [ ] Pipeline & Submissions:
  - [ ] Kanban / list pipeline view
  - [ ] Interview scheduling & rejection reasons
  - [ ] Standardized profile sharing with clients
- [ ] Communication & Sales CRM:
  - [ ] Email and WhatsApp message templates
  - [ ] Prospective client lead tracker & meeting logs
  - [ ] Convert won lead to job opening
  - [ ] Recruiter daily activity dashboard & job-wise pipeline metrics

### Phase 2 — Control, Scale & Productivity
- [ ] Two-step OTP login & auto-logout
- [ ] Manager approval workflows (new jobs, pre-submission approvals)
- [ ] Client-wise submission rules & custom fields
- [ ] Bulk resume upload & duplicate profile detection/merging
- [ ] Candidate direct email from ATS & interview no-show tracking
- [ ] Offer management
- [ ] Global search (`Cmd+K`) & Recruiter MIS reports
- [ ] Excel / CSV data export with permissions

### Phase 3 — Automation & Advanced Features
- [ ] Unified notification center & automated interview reminders
- [ ] Auto-generated video interview links (Google Meet / Zoom)
- [ ] Candidate self-scheduling interface
- [ ] Custom report builder & automated client progress emails
- [ ] Placements, client fees, and payment tracking
- [ ] CV watermarking on downloads & bulk outreach (Email/SMS)
- [ ] Branded public careers page

---

## 6. Current Implementation Progress Tracker

| Date | Phase | Task | Status | Details |
| :--- | :--- | :--- | :--- | :--- |
| 2026-11-06 | Prep | Project Rules & Standards Setup | ✅ Completed | Created `AGENTS.md`, `.agents/rules/security.md`, `.agents/rules/database.md`, and `.agents/workflows/review.md`. |
| 2026-11-06 | Prep | Project Memory & Handoff Documentation | ✅ Completed | Created `PROJECT_MEMORY.md` to persist complete context across AI sessions and tools. |
| 2026-11-06 | Prep | Git & GitHub Repository Setup | ✅ Completed | Created GitHub repository [mitishapatidar/hireflow-ats](https://github.com/mitishapatidar/hireflow-ats) and pushed initial commit. |
| 2026-11-06 | Phase 0 | Monorepo Setup (Prompt 1) | ✅ Completed | Created Turborepo + pnpm monorepo (`apps/web`, `apps/api`, `packages/db`, `packages/shared`, `packages/ui`). Passed `turbo build` and `turbo test`. |
| 2026-11-06 | Phase 0 | Design System from Figma (Prompt 2) | ✅ Completed | Built comprehensive reusable design system in `@hireflow/ui` with exact Figma tokens (#5B49D6, #EEEBFB, #1E2A4A, #F6F7FB, #FFFFFF, #E6E8F0, #1B2236, #6B7490) and 13-section showcase at `/design`. Passed all builds and tests. |
| 2026-11-06 | Phase 0 | Live Vercel Production Deployment | ✅ Completed | Deployed to Vercel: [hireflow-ats-nine.vercel.app](https://hireflow-ats-nine.vercel.app) & [hireflow-ats-nine.vercel.app/design](https://hireflow-ats-nine.vercel.app/design). |
| 2026-11-06 | Phase 0 | Application Shell & Role Nav (Prompt 3) | ✅ Completed | Built config-driven navigation in `@hireflow/shared`, Next.js route groups `(internal)`, `(client)`, `(candidate)`, `(public)`, dark navy shell (#1E2A4A), top bar with Ctrl+K command palette, notifications, mobile drawer, dev role switcher context, route guards, and 22 landing pages. Passed 14 unit tests, 9 Playwright E2E tests, and 29/29 Next.js static page builds. |
| 2026-11-06 | Phase 1 | Database Schema & Supabase Setup (Prompt 4) | ✅ Completed | Implemented production schema with 54 models and 13 enums across modules A–J in `packages/db`. Synchronized with remote Supabase PostgreSQL instance. Generated migration history (`20261106000000_init_hireflow_schema`). Seeded idempotent dataset: 1 Org, 6 Users, 4 Clients, 8 Jobs, 60 Candidates, Applications, Interviews, Offers, and 1 closed Placement (₹3,23,000 fee). Created complete ER diagram in `docs/erd.md`. Passed all unit tests, typechecks, and 29/29 web page builds. |
| 2026-11-06 | Phase 1 | Authentication & Role Permissions (Prompt 5) | ⏳ Next | Next milestone awaiting explicit user approval. |

---

## 7. Instructions for Any Future AI Session
When continuing this project in a new conversation, in Cursor, in Claude Code, or in any other IDE:
1. Read `PROJECT_MEMORY.md` first to understand the current phase and pending tasks.
2. Check `git status` to see what files exist.
3. Pick up the next uncompleted task from the **Current Implementation Progress Tracker**.
4. Update `PROJECT_MEMORY.md` upon completing any milestone.
