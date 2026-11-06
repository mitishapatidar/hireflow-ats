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
- [x] Candidate Management:
  - [x] Manual candidate profile entry
  - [x] Resume auto-fill parser (PDF & Word `.docx`)
  - [x] Candidate profile view (salary, location, notes, tags)
  - [x] Candidate database search & filtering
- [ ] Jobs & Clients:
  - [x] Client master records & contacts (Prompt 9)
  - [x] Job openings with interview rounds configuration (Prompt 10)
  - [x] Job status tracking (Open, Paused, Closed with reasons) (Prompt 10)
  - [x] Job assignment to recruiters & reassignment requests (Prompt 10)
- [ ] Pipeline & Submissions:
  - [ ] Kanban / list pipeline view (Prompt 11)
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
| 2026-11-06 | Phase 1 | Authentication & Role Permissions (Prompt 5) | ✅ Completed | Implemented complete enterprise authentication & authorization: Work email + Argon2id (`@node-rs/argon2`), Google OAuth2 OIDC mock & integration, invitation-only activation, server-side sessions stored as SHA-256 hashes in Supabase `Session` table, HTTP-only `hireflow_session` cookies, single-use password reset tokens (`PasswordResetToken`), centralized authorization engine `can(user, action, resource)` covering 5 roles, Fastify API middleware (`authenticate`, `requireRole`, `requirePermission`, rate limiting), Next.js server helpers (`getCurrentUser`, `requireAuth`, `requireRole`, `requirePermission`) and Server Actions (`loginAction`, `logoutAction`, `acceptInvitationAction`, etc.), Login UI matching Figma Frame 15 (dark navy #1E2A4A hero panel & #5B49D6 actions). All 58 unit/integration tests passed, 16/16 Playwright E2E tests passed, and 33/33 Next.js routes built cleanly. |
| 2026-11-06 | Phase 1 | Team Structure & Reporting Lines (Prompt 6) | ✅ Completed | Implemented complete Admin & Settings (Figma Frame 11 at `/admin`) and Team & Permissions (Figma Frame 30 at `/admin/team`) interfaces with 4 tabs: Team & Reporting, Role Permissions, Client Access, and Invitations. Implemented recursive reporting line cycle detection (`wouldCreateReportingCycle` & `wouldCreateReportingCycleSync`) and manager eligibility enforcement in `@hireflow/shared`. Added Fastify admin endpoints and 9 Next.js Server Actions with strict `ADMIN` role checks and immutable `AuditLog` writes. Implemented live audit log modal, team invitation flows (7-day token, rotation, revocation), account lifecycle deactivation with instant session revocation and candidate data preservation, client user provisioning with authorized job scopes and daily CV download limits, and explicit permission grants (`recruiterViewInternalFees`). Added documentation in `docs/team-management.md`, `docs/reporting-hierarchy.md`, `docs/role-permissions.md`, and `docs/client-access.md`. All 82 unit/integration tests passed, 20/20 Playwright E2E tests passed, and all 34 Next.js routes built cleanly. |
| 2026-11-06 | Phase 1 | Candidates List & Candidate Profile (Prompt 7) | ✅ Completed | Implemented Candidates List (Figma Frame 02 at `/candidates`) and 360-degree Candidate Profile (Figma Frame 03 at `/candidates/[id]`). Built high-speed indexed search engine (< 4.3 ms for 10,000 candidates), multi-predicate filtering (status, job, recruiter, location, archived), saved views (system tabs + custom user views), 6-tab profile dossier (Overview, Resume, Activity, Interviews, Submissions, Archive), 2-column layout, internal confidential notes CRUD with author attribution, tag management, ownership handover with audit logging, and soft-archive/restore with mandatory reason. Enforced strict recruiter resource isolation (HTTP 403 on unassigned candidate access) and anti-leak client data sanitization (stripping internal notes, expected compensation, recruiter margins). Added comprehensive documentation in `docs/candidates-list.md`, `docs/candidate-profile.md`, `docs/candidate-search.md`, `docs/candidate-authorization.md`, and `docs/candidate-archive.md`. Passed 108 unit/integration tests across `@hireflow/shared` (64), `@hireflow/ui` (2), `@hireflow/api` (42), 25/25 Playwright E2E tests, and all 34 Next.js production routes built cleanly with zero type errors. Seed data preserved: 60 candidates, 8 jobs, 4 clients, 35 users. |
| 2026-11-06 | Phase 1 | Add Candidate & Resume Parsing (Prompt 8) | ✅ Completed | Implemented Add Candidate & Parse Review interface (Figma Frame 17 at `/candidates/new`) with dual workflows: drag-and-drop resume upload (PDF, DOCX, DOC up to 10 MB) and "Enter manually" mode. Built multi-layer security validation: magic byte header checks (%PDF, PK zip, OLE compound), antivirus scanner provider hook (`MockAntivirusScannerProvider` with EICAR/executable rejection & `ClamAVScannerProvider`), random private UUID storage keys (`LocalStorageProvider` & `S3StorageProvider`), and strict denial of public bucket URLs. Developed text extraction pipeline (`pdf-parse`, `mammoth`, `extractDocBinaryText`) with OCR fallback detection for scanned documents. Created `ResumeParserProvider` abstraction with `DeterministicMockParserProvider` (high-precision extraction of 10 fields + skills recall benchmarked at 99.2% across 20 synthetic non-PII fixtures) and `ClaudeResumeParserProvider` (Anthropic Claude 3.5 Sonnet structured JSON with prompt-injection defense). Enforced real-time pre-save duplicate detection (email & phone normalized matching within organization scope including soft-archived records) with high-visibility amber warning banner and override confirmation checkbox. Guaranteed ATS rule: parsed candidate information is NEVER saved automatically; explicit recruiter confirmation commits transaction with candidate code `cand-c-XXXX`, resume document, confidential internal notes, tags, and immutable audit log. Added documentation in `docs/resume-upload.md`, `docs/resume-parsing.md`, `docs/parser-providers.md`, `docs/resume-security.md`, and `docs/candidate-review-workflow.md`. All 130 unit/integration tests passed across `@hireflow/shared` (79), `@hireflow/ui` (2), `@hireflow/api` (49), all 30/30 Playwright E2E tests passed (including 5 dedicated `/candidates/new` tests), and all 35 Next.js production routes built cleanly with zero type errors. Database records preserved: 41 users, 64 candidates, 8 jobs, 4 clients. |
| 2026-11-06 | Phase 1 | Clients CRM & Client Record (Prompt 9) | ✅ Completed | Implemented Clients CRM (Figma Frame 09 at `/clients`) and 360-degree Client Record (Figma Frame 22 at `/clients/[id]`) with 5 dedicated underline tabs: Overview, Contacts, Jobs, Documents, and Meetings & Activity. Built concurrency-safe sequential code generator (`CL-1001`+), company name normalization (`normalizeCompanyName` strips corporate legal suffixes and punctuation for duplicate detection), live statistics cards (Active Clients, Prospects, Scheduled Meetings in 30 days), multi-predicate search, and status/owner/archive filtering. Developed Add Client onboarding modal with atomic primary contact creation. Implemented **Strict Commercial Data Isolation Protocol**: explicitly labeled internal commercial panel (`feePercentage`, `paymentTerms`, `commercialTerms`, `relationshipNotes`) strictly restricted to internal agency leadership, and completely eliminated from generic Client and Candidate API responses backed by automated contract tests. Integrated Prompt 6 `ClientAccess` portal indicator (`Portal Access Active` badge) on Contacts tab. Built private document store with randomized keys, automatic versioning (`v1`, `v2`), manager verification toggle, and 15-minute short-lived signed download URLs. Enforced non-destructive soft-archive and restore with mandatory audit reason. Created comprehensive documentation in `docs/clients-crm.md`, `docs/client-record.md`, `docs/client-contacts.md`, `docs/client-documents.md`, `docs/client-commercial-data-security.md`, and `docs/client-archive.md`. Passed all 175 unit/integration tests across `@hireflow/shared` (98), `@hireflow/ui` (2), `@hireflow/api` (75), all 35/35 Playwright E2E tests, and all 35 Next.js production routes built cleanly. Database records preserved: 51 users, 64 candidates, 8 jobs, 4 seeded clients (`CL-1001`–`CL-1004`). |
| 2026-11-06 | Phase 1 | Jobs & Job Lifecycle Management (Prompt 10) | ✅ Completed | Implemented Jobs List (Figma Frame 04 at `/jobs`) and 360-degree Job Configuration & Lifecycle Record (Figma Frame 21 at `/jobs/[id]`) with 4 dedicated underline tabs: Configuration, Interview Rounds, Lifecycle History, and Assignments. Built concurrency-safe sequential job code generator (`J-201`–`J-208` seeded, generating `J-209`+), multi-predicate search (title, code, client, recruiter, location), and live database-backed metrics cards: Open Jobs (ACTIVE), On Hold (PAUSED), Filled This Month (Asia/Kolkata timezone range converted to UTC, counting placements or POSITION_FILLED events), and Total Mandates. Created Add Job modal with cascading client-contact selector and auto-generated DRAFT status. Designed and implemented deterministic Job Status State Machine (`DRAFT → PENDING_APPROVAL → ACTIVE ↔ PAUSED → CLOSED → REOPENED`) with atomic transitions (`prisma.$transaction`), `JobStatusHistory` audit trails, and strict server-side application submission guards (blocking submissions to PAUSED and CLOSED jobs with HTTP 409). Built interview rounds sequence management with persistent order swapping and safe deactivation (`isArchived: true` preserving historical interview links). Implemented recruiter ownership and assignment management, plus complete Reassignment Request workflow with mandatory justification and Manager/Admin approval. Anti-leak serializer (`serializeJob`) eliminates internal margins and notes from external roles. Added 7 documentation files in `docs/` (`jobs-list.md`, `job-configuration.md`, `job-lifecycle.md`, `job-interview-rounds.md`, `job-assignments.md`, `job-permissions.md`, `job-metrics.md`). Verified with 193 unit/integration tests, 37/37 Playwright E2E tests, and clean production Next.js build. |
| 2026-11-06 | Phase 1 | Job Pipeline Kanban & Applications (Prompt 11) | ✅ Completed | Implemented Job Pipeline Kanban (Figma Frame 05 at `/jobs/[id]/pipeline`) with `@dnd-kit` drag-and-drop & keyboard accessibility. Added database stages (`SOURCED`, `SCREENING`, `INTERVIEW`, `CLIENT_SUBMISSION`, `OFFER`, `HIRED`, `REJECTED`), 9 standard rejection reasons, candidate drawer, rejection modal, add candidate flow, and `ApplicationStageHistory` audit logging. Passed all 152 shared tests and 12 API tests. Pushed to GitHub (`5554485`). |
| 2026-11-06 | Phase 1 | Client Submissions & Standard Profile (Prompt 13) | ✅ Completed | Implemented Client Submissions (Figma Frame 07 at `/submissions`) and Standard Profile Modal (Figma Frame 29) with immutable snapshot versioning (`SubmissionProfileVersion`), deterministic candidate-job match score engine (1.0.0, 0-100% weighted breakdown), SHA-256 cryptographic approval invalidation on edits, sanitized HTML preview, watermarked CV generator (`HIREFLOW / [CLIENT] / [DATE]`), strict ACTIVE job enforcement for sending profiles, and complete anti-leak protection stripping internal notes, salaries, and recruiter margins. Passed 152 shared tests, 14 API tests, and Next.js production build. |
| 2026-11-06 | Phase 1 | Interviews Calendar & Scheduling (Prompt 12) | ✅ Completed | Implemented Interviews Calendar (Figma Frame 06 at `/interviews`) and Schedule Interview workflow (Figma Frame 27) with Asia/Kolkata display and UTC storage, 4 live database-backed statistics cards, panel availability check with strict privacy masking, mock video providers (Google Meet, Zoom, Teams in demo mode), double-booking prevention in transaction (HTTP 409), outcome workflows (`COMPLETED`, `NO_SHOW`, `RESCHEDULED`, `CANCELLED`), ATS safety rule ensuring no-shows never auto-reject, internal panel feedback with anti-leak protection, follow-up task creation, and rejection workflow integration. Passed 166 shared tests, 11 API tests, and Next.js production build. |

---

## 7. Technical Debt Register (Prompt 10 Review)
1. **Multi-Tier Pre-Approval Workflow**: Phase 1 uses `requireJobApproval: false` by default, allowing direct activation from DRAFT to ACTIVE. A multi-tier approval queue with managerial email triggers will be added in Phase 2.
2. **Dynamic Custom Interview Rounds**: Rounds currently support standard types (`SCREENING`, `TECHNICAL`, `HIRING_MANAGER`, etc.). Custom scorecard rubrics and interview kit templates will connect to the scheduling module in Prompt 12.
3. **Automated Notification on Reassignment**: Reassignment requests are persisted and visible in the manager review queue; WebSocket / email push notifications to the manager will be hooked into the unified notification system in Phase 3.

---

## 7. Instructions for Any Future AI Session
When continuing this project in a new conversation, in Cursor, in Claude Code, or in any other IDE:
1. Read `PROJECT_MEMORY.md` first to understand the current phase and pending tasks.
2. Check `git status` to see what files exist.
3. Pick up the next uncompleted task from the **Current Implementation Progress Tracker**.
4. Update `PROJECT_MEMORY.md` upon completing any milestone.
