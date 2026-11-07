# Client Portal Permissions & Authorization (Prompt 22)

## Role Isolation & Multi-Tenant Boundary
The Client Portal enforces strict multi-tenant boundaries at every layer:

### 1. User Identity & Scope
- All client endpoints (`/api/client-portal/*`) require authentication (`requireAuth`) and `UserRole.CLIENT`.
- Any recruiter, manager, or candidate attempting to access `/api/client-portal/*` receives `HTTP 403 Forbidden`.
- The user's active client scope is resolved directly on the server via `user.clientAccess.clientId`.
- If `clientAccess` is inactive or missing, requests are denied with `HTTP 403 Forbidden: Active client access scope is required`.

### 2. Cross-Client Data Isolation
- Client A can **never** query or view records belonging to Client B.
- Database queries explicitly filter by `clientId: clientAccess.clientId` across all jobs, submissions, interviews, and progress reports.
- Attempting to access another client's submission ID returns `HTTP 404 Not Found` (anti-enumeration principle).

### 3. Client Navigation & Layout Guard
- Client users navigating to internal admin or recruiter routes (`/admin`, `/dashboard`, `/candidates`) are intercepted by Next.js middleware and redirected to `/no-permission` (`HTTP 403`).
- The internal recruiter workspace navigation bar is completely replaced with the dedicated `ClientLayout` shell.
