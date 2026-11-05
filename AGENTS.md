# HireFlow ATS & Recruitment CRM — Agent Guidelines

## Product Context
HireFlow is an enterprise Applicant Tracking System (ATS) and Recruitment CRM built for recruitment agencies.
Key stakeholders: Recruiters, Managers, Admins, Clients, and Candidates.

---

## 1. How to Work (Claude-Style Discipline)

- **Plan First**: Before writing code, inspect existing files and produce a concise implementation plan.
  - **Wait for explicit user approval** on any task modifying **authentication, role permissions, database schema (migrations), or third-party API integrations**.
- **Laser Focus**: Work on **one feature or task at a time**. Do not refactor or modify unrelated files.
- **Zero Hallucination**: Never invent APIs, environment variables, library methods, or package versions. If unsure, read the documentation or ask.
- **Verification Protocol**: After every code change:
  - Run type checking (`tsc --noEmit` or `npm run build`), linting, and tests.
  - Fix any failures immediately before declaring the step done.
  - Always execute and verify functionality; never claim something works without running it.
- **Small, Reviewable Diffs**: Prefer compact, modular changes. When choosing an architecture pattern or library, explain trade-offs in 2–3 lines.
- **Honesty About Gaps**: Clearly state what is implemented, what is untested, and what is mocked or remaining.

---

## 2. ATS & SaaS Security Commandments

1. **Never Hard Delete**: Candidate profiles, jobs, client records, and submissions must **never be hard-deleted**. Always use an `isArchived` flag or soft-deletion with timestamp.
2. **Strict Server-Side Authorization**: Never rely solely on client-side route guards or hidden UI elements. Every Server Action and API route must verify the user's role and tenant/client permissions.
3. **Data Leak Prevention**:
   - Never expose internal candidate notes, client commercial fees, or recruiter margin fields to Client Portal or Candidate API responses.
   - Use strict response DTOs / Zod schema serialization.
4. **Audit Trail**: Every significant status change (e.g., candidate stage change, job closure, submission to client, fee agreement) must be logged in an audit/activity table.

---

## 3. Technology Standards

- **Frontend & Fullstack**: Next.js (App Router), TypeScript (strict mode), React Server Components where applicable.
- **Database & ORM**: PostgreSQL (hosted on Supabase) accessed via **Prisma ORM**.
- **Styling**: Tailwind CSS with clean, accessible component patterns (Radix UI / Shadcn). Mobile-responsive by default.
- **State & Forms**: React Hook Form with Zod schemas for all client and server validations.
