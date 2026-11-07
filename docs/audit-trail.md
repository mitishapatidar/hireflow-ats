# HireFlow ATS — Compliance Audit Trail & Secret Redaction

## Overview
The Compliance Audit Trail (Figma Frame 33 Tab 5) provides an immutable, tamper-evident log of all administrative, security, workflow, and data access events across the organization.

---

## 1. Audit Log Schema
Each event is stored in PostgreSQL:
- `id`: Unique identifier (UUID).
- `organizationId`: Multi-tenant boundary.
- `actorId`: User ID who initiated the operation.
- `action`: Normalized event action code (e.g., `DATA_EXPORT`, `CANDIDATE_RESTORED`, `POLICY_UPDATED`, `CUSTOM_FIELD_CREATED`).
- `entity`: Target entity name (`Candidate`, `Job`, `DownloadPolicy`, etc.).
- `entityId`: Identifier of the impacted record.
- `details`: JSON payload containing context, metadata, and state changes (`before`, `after`, or operation parameters).
- `ipAddress`: Remote client IP address.
- `userAgent`: Client User-Agent string.
- `createdAt`: ISO-8601 UTC timestamp.

---

## 2. Recursive Credential & Secret Scrubbing
Before writing to `AuditLog` or returning audit payloads in API responses or CSV exports, all `details` objects pass through `redactAuditSecrets()`:
- Keys matching secret patterns (`password`, `token`, `secret`, `otp`, `apiKey`, `authorization`, `cookie`, `credential`) are recursively stripped and replaced with `"[REDACTED]"`.
- Plaintext passwords, 2FA OTP codes, session tokens, and webhook secrets are never stored or exposed in audit trails.

---

## 3. Side-by-Side Before/After Diff Inspector
In `/admin/data-governance` (Tab 5), clicking on any update action opens a sliding side-by-side comparison drawer:
- **Before State**: Left-hand pane showing previous state.
- **After State**: Right-hand pane showing modified state.
- **Visual Highlighting**:
  - Added keys highlighted in green.
  - Removed keys highlighted in red with strikethrough.
  - Modified values highlighted in amber with exact old/new comparisons.

---

## 4. Audit CSV Export
Administrators can export the filtered audit trail to CSV:
- Strictly RFC-4180 compliant.
- Formula injection defended.
- Secret-redacted details JSON serialized safely into spreadsheet cells.
