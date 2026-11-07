# HireFlow ATS — Data Governance Architecture

## Overview
Data Governance in HireFlow ATS (Phase 2, Prompt 19) provides enterprise controls over organizational data access, custom data model extensions, candidate retention lifecycles, role-based download quotas, and compliance auditing.

The module aligns with **Figma Frame 33** (`/admin/data-governance`) and **Figma Frame 37** (Scoped Export Modal).

---

## 5 Data Governance Pillars

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Data Governance Module (/admin/data-governance)       │
├──────────────┬──────────────┬──────────────┬─────────────┬─────────────┤
│ 1. Scoped    │ 2. Custom    │ 3. Archive & │ 4. Download │ 5. Audit    │
│    Export    │    Fields    │    Restore   │    Policy   │    Trail    │
└──────────────┴──────────────┴──────────────┴─────────────┴─────────────┘
```

### 1. Scoped Export (Frame 37)
- Multi-entity export support: Candidates, Jobs, Clients, Applications, Submissions, Interviews, Placements, and System Audit Logs.
- Selective column customization with default sets.
- Formula injection defense (`=`, `+`, `-`, `@`, `\t`, `\r` escaped with leading `'`).
- Sensitive column protection: requires active sensitive-action re-verification (15-minute validity window from Prompt 17).
- Strict CSV generation following RFC-4180.
- Automatic exclusion of secret credentials, system hashes, recruiter margins, and internal notes.

### 2. Workspace Custom Fields (Frame 33 Tab 2)
- Extends standard entities (`CANDIDATE`, `JOB`, `CLIENT`) without requiring direct database migrations.
- 6 supported data types: `TEXT`, `NUMBER`, `DATE`, `URL`, `SELECT`, `MULTI_SELECT`.
- Field visibility classification: `INTERNAL_ONLY` vs `CLIENT_PROFILE_INCLUDED`.
- Client submission workflow enforcement: client-specific custom field rules can mark fields as strictly mandatory before candidates can be submitted (integrated with Prompt 18 submission rules).
- Versioned field definitions with soft-archival (`isActive: false`).

### 3. Archive & Restore (Frame 33 Tab 3)
- Strict compliance with SaaS Security Commandments: zero hard deletes (`isArchived: true` only).
- Active duplicate conflict detection: Prevents restoring an archived candidate if an active candidate with the same email already exists in the organization.
- Mandatory audit justification: Every candidate restoration requires a non-trivial audit reason (minimum 5 characters).
- Immutable audit trail recording (`CANDIDATE_RESTORED`).

### 4. Download Policy (Frame 33 Tab 4)
- Role-based daily CV download quotas (`RECRUITER`, `MANAGER`, `CLIENT`, `ADMIN`).
- Quota tracking bounded by midnight Asia/Kolkata (IST / `UTC+05:30`).
- Dynamic client watermarking on candidate resumes: `HIREFLOW / [CLIENT NAME] / [DATE]`.
- Atomic download logging in `DownloadLog` with quota exhaustion protection (`429 Quota Exceeded`).

### 5. Compliance Audit Trail (Frame 33 Tab 5)
- Searchable organization audit logs with filtering by action and entity.
- Side-by-side Before/After diff inspector drawer with visual highlights of added, modified, and deleted keys.
- Automatic secret scrubbing: Recursive redaction of passwords, OTP secrets, session tokens, webhook secrets, and API keys (`[REDACTED]`).
- Sanitized compliance audit CSV export with RFC-4180 formatting.

---

## Authorization & Security

1. **Role Enforcement:**
   - Complete Data Governance module access (`/admin/data-governance` and `/api/governance/*`) is strictly restricted to users with `ADMIN` role.
   - Manager and Recruiter export actions are restricted to permitted entity scopes and bound by their daily download quota.
2. **Multi-Tenancy:**
   - All database queries, custom fields, client rules, download policies, and export records are strictly partitioned by `organizationId`.
   - Cross-organization data access is rejected at both the API gateway and ORM level.
3. **Data Leakage Safeguards:**
   - Internal recruiter margins, fee percentages, and private hiring notes are globally blacklisted from all client-facing or standard exports.
