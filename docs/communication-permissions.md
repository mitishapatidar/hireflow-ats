# Communication Roles & Authorization Rules

## 1. Access Matrix
| Role | Inbox (`/communications`) | Send Email / WhatsApp | Edit Templates | Edit Team Signature | View Integrations |
|---|---|---|---|---|---|
| **ADMIN** | Full Access | Yes | Yes (Create/Edit) | Full Access (Can Edit) | Full Access |
| **MANAGER** | Full Access | Yes | Yes (Create/Edit) | Read-Only (Preview) | Full Access |
| **RECRUITER** | Full Access (Assigned scope) | Yes | Yes (Create/Edit) | Read-Only (Preview) | Full Access |
| **CLIENT** | **403 Forbidden** | **403 Forbidden** | **403 Forbidden** | **403 Forbidden** | **403 Forbidden** |
| **CANDIDATE** | **403 Forbidden** | **403 Forbidden** | **403 Forbidden** | **403 Forbidden** | **403 Forbidden** |

## 2. Strict Anti-Leak Protection
- Candidate responses and external views are sanitized via `serializeThreadSafe()`.
- Confidential recruiter margins, billing rates, and internal candidate notes are strictly excluded from all communication DTOs.
