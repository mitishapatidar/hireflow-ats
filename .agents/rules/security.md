# Security & Access Control Rules

## 1. Role-Based Access Control (RBAC)
- Five distinct roles: `ADMIN`, `MANAGER`, `RECRUITER`, `CLIENT`, `CANDIDATE`.
- Permissions must be evaluated on the server on every request:
  - **Recruiters**: Can view and manage only jobs and candidates assigned to them (or shared within their team).
  - **Managers**: Can approve job openings, approve candidate submissions to clients, view team-wide metrics, and assign jobs.
  - **Admins**: Full system configuration, audit logs, team management, billing/margins, and export privileges.
  - **Clients**: Access restricted exclusively to their company's open jobs and approved candidate submissions. Zero access to candidates of other clients or internal agency notes.
  - **Candidates**: Restricted strictly to their own application status and interview self-scheduling links.

## 2. Authentication & Sessions
- Secure session tokens with HTTP-only cookies.
- Two-step OTP verification for sensitive operations and admin access.
- Auto-logout on token expiration and idle timeout.

## 3. Data Protection
- Sanitize all resume upload files (validate MIME types: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document).
- Watermark or restrict bulk CV downloads to prevent unauthorized database scraping.
