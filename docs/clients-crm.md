# HireFlow ATS & Recruitment CRM — Clients CRM (`/clients`)

## 1. Overview & Business Context

The **Clients CRM** interface (Figma Frame 09) serves as the agency master hub for managing corporate recruitment clients, business prospects, commercial agreements, and assigned recruiters/account owners for **Aureva Capital Private Limited** (`org-aureva-1`).

Key URL:
- `/clients`: Main CRM directory with live operational statistics, multi-predicate search, status filters, client data table, and modal onboarding.

---

## 2. Architectural Design & Concurrency-Safe Sequential Code Generation

### A. Client Code Sequence (`CL-XXXX`)
- Every client entity within the organization is assigned a unique, immutable client code starting at `CL-1001` (e.g. `CL-1001`, `CL-1002`, `CL-1003`, `CL-1004`, `CL-1005`...).
- **Concurrency Safety:** Generation runs inside an atomic PostgreSQL serializable transaction (`prisma.$transaction`).
- It extracts the highest current numeric suffix across existing records (e.g., `CL-1004` -> `1004`) and assigns `CL-${highest + 1}`.

### B. Company Name Normalization & Duplicate Prevention
To prevent accidental duplicate client accounts:
- `normalizeCompanyName(name)` cleans legal suffixes:
  1. Replaces non-alphanumeric punctuation with spaces (`Pvt. Ltd.` -> `pvt ltd`).
  2. Strips company entity keywords using word boundaries (`private`, `pvt`, `limited`, `ltd`, `inc`, `incorporated`, `llc`, `corp`, `corporation`).
  3. Trims and collapses multiple spaces.
- **Server-Side Duplicate Guard:** When creating a new client, if a normalized name matches an active organization client, the server rejects creation with **HTTP 409 Conflict** (`DUPLICATE_CLIENT_NAME`).

---

## 3. UI Layout & Component Structure (Figma Frame 09)

### A. Operational Statistics Cards
Positioned above the table, displaying live metrics computed on demand:
1. **Active Clients (`stats.activeCount`)**: Count of non-archived clients with status `ACTIVE`.
2. **Prospects (`stats.prospectCount`)**: Count of non-archived clients with status `PROSPECT`.
3. **Scheduled Meetings (`stats.meetingsCount`)**: Count of scheduled meetings across all agency clients in the next 30 days (`scheduledAt >= now AND scheduledAt <= now + 30d`).

### B. Filter & Search Controls
- **Search Bar:** Real-time search across company name, client code, industry, and primary contact name/email.
- **Status Filter:** Dropdown supporting `ALL`, `ACTIVE`, `PROSPECT`, `INACTIVE`.
- **Relationship Owner Filter:** Dropdown populated with active internal users (`ADMIN`, `MANAGER`, `RECRUITER`).
- **Archive Filter Toggle:** Allows switching between `Active Records`, `Archived Records`, and `All Records`.
- **Reset Filters Button:** Automatically appears when filters are active to restore default CRM state.

### C. Data Table Columns
- **Company & Industry:** Legal name, monospace code badge (`CL-XXXX`), external website link, and industry/location.
- **Primary Contact:** Name, designation, and email.
- **Open Jobs:** Count badge of open job orders/mandates.
- **Relationship Owner:** Assigned internal team member.
- **Status Badge:**
  - Active: emerald badge (`#12B76A`)
  - Prospect: sky badge (`#0284C7`)
  - Inactive: slate badge
  - Archived: slate-200 badge
- **Next Step:** Immediate scheduled action or follow-up task.
- **Actions Menu:** "View" navigation button, Quick Edit modal trigger, and Archive/Restore trigger.

---

## 4. API & Server Actions Reference

### Server Actions (`apps/web/src/actions/clients.ts`):
- `getClientsAction(rawFilters)`: Returns `{ success: true, clients: ClientSummaryDTO[], stats, pagination }`.
- `createClientAction(input)`: Validates input with Zod, checks duplicates, generates sequential code, creates optional primary contact, logs audit entry, and revalidates `/clients`.
- `updateClientAction(id, input)`: Updates profile information and logs audit entry.
- `archiveClientAction(id, reason)`: Soft-archives client with mandatory reason (minimum 3 characters).
- `restoreClientAction(id, reason?)`: Restores client back to active CRM status.

### Fastify Endpoints (`apps/api/src/routes/clients.ts`):
- `GET /api/clients`: Paginated list and live statistics.
- `POST /api/clients`: Concurrency-safe creation.
- `PATCH /api/clients/:id`: Profile metadata update.
- `POST /api/clients/:id/archive`: Archive action with audit log.
- `POST /api/clients/:id/restore`: Restore action with audit log.
