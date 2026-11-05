# HireFlow ATS & Recruitment CRM — Project Rules & Architecture

## 1. Product Overview
- **Name:** HireFlow
- **Type:** Enterprise Applicant Tracking System (ATS) + Recruitment CRM
- **Target Audience:** Recruitment agencies, recruiters, managers, admins, clients, and candidates.

## 2. Product Roles
The platform operates on strict Role-Based Access Control (RBAC):
1. **RECRUITER:** Candidate sourcing, job pipeline management, interview scheduling, client submissions.
2. **MANAGER:** Job assignments, submission and job approvals, team performance tracking.
3. **ADMIN:** System configuration, permissions, audit logs, team management, billing/margins.
4. **CLIENT:** Dedicated client portal for reviewing submitted candidates, open positions, and progress reports.
5. **CANDIDATE:** Candidate self-service portal, status updates, interview slot scheduling.

## 3. Technology Stack
- **Web:** Next.js 14 App Router, React 18, TypeScript
- **API:** Node.js, Fastify, TypeScript
- **Database:** PostgreSQL (hosted on Supabase) + Prisma ORM
- **Queue & Async:** Redis + BullMQ
- **Styling & UI:** Tailwind CSS, Lucide React, shared `@hireflow/ui` design system
- **Validation:** Zod schemas shared across client and server (`@hireflow/shared`)
- **Testing:** Vitest (unit/integration) + Playwright (E2E)
- **Monorepo:** pnpm workspaces + Turborepo

## 4. Design Tokens (Figma Source of Truth)
- **Primary:** `#5B49D6` (Buttons, active nav, brand links)
- **Primary Soft:** `#EEEBFB` (Chips, info banners, selection states)
- **Navy:** `#1E2A4A` (Sidebar, login hero)
- **Page Background:** `#F6F7FB` (Application background)
- **Card:** `#FFFFFF` (Cards, modals, tables)
- **Border:** `#E6E8F0` (Borders, dividers, inputs)
- **Text:** `#1B2236` (Headings, body copy)
- **Muted:** `#6B7490` (Helper text, secondary labels — WCAG AA compliant)
- **Success:** `#12B76A` / Soft: `#E3F6EC`
- **Warning:** `#F59E0B` / Soft: `#FEF3DC`
- **Danger:** `#E5484D` / Soft: `#FDECEC`
- **Info:** `#3B82F6` / Soft: `#E5F0FF`
- **Radii:** Inputs: `8px`, Cards: `12px`, Pills: `9999px`
- **Spacing Scale:** Multiples of `4px`

## 5. Security & Architectural Commandments
1. **Never Hard Delete:** Soft-delete only (`isArchived: true` with actor, reason, timestamp).
2. **Server-Side Authorization:** Every server action and API endpoint verifies role and tenant permissions.
3. **Data Leak Prevention:** Internal candidate notes, margins, and client commercial terms are never exposed to Client or Candidate APIs.
4. **Zero Fake Backends:** Never use fake responses or mock data and claim it is completed functionality.
5. **Structured Audit Logs:** Every state change writes an `AuditLog` row.
6. **Strict Input Validation:** All external inputs validated with shared Zod schemas.
7. **Timezone:** Store timestamps in UTC; display in Asia/Kolkata (IST).
