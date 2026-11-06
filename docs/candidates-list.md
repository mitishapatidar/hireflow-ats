# HireFlow ATS — Candidates List Specification (Figma Frame 02)

## 1. Overview
The Candidates List interface (`/candidates`) is the primary workspace for recruiters, hiring managers, and agency administrators to discover, filter, segment, and advance talent through recruitment pipelines.

- **Design Reference:** Figma Frame 02 (`c:\git and github\New folder\New folder\Screenshot 2026-11-05 233506.png`)
- **Route:** `apps/web/src/app/(internal)/candidates/page.tsx`
- **Client Component:** `apps/web/src/app/(internal)/candidates/CandidatesClientView.tsx`
- **Tenant:** Aureva Capital Private Limited

---

## 2. Visual Layout & UI Components

### A. Page Header
- **Breadcrumbs:** `Home > Candidates`
- **Title:** `Candidates` (H1, 24px bold, text `#1B2236`)
- **Subtitle:** "Find, organise and move talent through your hiring pipeline."
- **Stats Pill:** Displays total candidates in pipeline (e.g., `Total 60 candidates in pipeline`).
- **Primary CTA:** `+ New` button navigating to candidate creation.

### B. Search & Filter Bar
- **Full-Text Search Input:** Instant multi-field search across candidate name, email, skills, and tags.
- **Saved View Pills:** Quick filters for one-click access:
  - `All candidates`: Clears all filters, displays total pool.
  - `My Active`: Filters to candidates owned by current user where `isArchived = false`.
  - `In Interview`: Filters to candidates with applications currently in interview stages.
  - `Archived`: Displays soft-archived talent pool (`isArchived = true`).
  - `+ Save view`: Opens modal to save custom multi-predicate filters as reusable tabs.

### C. Advanced Multi-Predicate Filters
- **Stage Dropdown:** Sourced, Screening, Submitted, Client Review, Interview, Offer, Hired, Rejected.
- **Job Dropdown:** Filter by active mandate across client engagements.
- **Recruiter Dropdown:** Filter by candidate owner / recruiter.
- **Location Input:** Free-text filter for city/region (e.g., Mumbai, Bengaluru, Pune).
- **Include Archived Checkbox:** Toggles inclusion of archived talent.
- **Clear All Filters:** Resets filters when any non-default filter is applied.

### D. Candidates Data Table
Columns matching Figma Frame 02:
1. **Candidate:** Avatar with initials, full name, email address.
2. **Applied for:** Job title and client legal name badge.
3. **Experience:** Total professional experience in years (e.g. `8.5 years`).
4. **Location:** Candidate location with map pin indicator.
5. **Stage:** Colorful pill badge corresponding to hiring status.
6. **Updated:** Relative timestamp (e.g. `Today`, `2 days ago`).
7. **Actions:** `View Profile` link navigating directly to `/candidates/[id]`.

### E. Pagination
- Displays current slice: `Showing 1 to 15 of 60 candidates`.
- Previous & Next pagination controls with active page indicator `1 / 4`.

### F. Bottom Feature Chips (Phase Roadmap)
Bottom action chips provide discoverability for features scheduled across Phase 1 and Phase 2:
- **Duplicate detection:** Scans candidate submissions across email, phone, and LinkedIn handles. Informational preview with Prompt 20 link.
- **Auto-fill from PDF/Word:** Previews automated AI resume parsing arriving in Prompt 8.
- **Bulk resume upload:** Previews asynchronous batch ingestion arriving in Prompt 20.
- **Recruiter permissions:** Direct shortcut to `/admin/team?tab=permissions`.
- **Archive instead of delete:** Explains HireFlow's zero hard-delete compliance policy.

---

## 3. Server Actions & Performance
- **Server Action:** `getCandidatesListAction` in `apps/web/src/actions/candidates.ts`.
- **Pagination SLA:** 15 candidates per page default, indexed database queries.
- **Decimal Serialization:** All Prisma `Decimal` instances are transformed into plain JavaScript primitives before crossing the RSC boundary.
