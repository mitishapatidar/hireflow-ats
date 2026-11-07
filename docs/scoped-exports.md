# HireFlow ATS — Scoped Exports Architecture

## Overview
Scoped Export (Figma Frame 37) provides structured, secure data extraction from HireFlow ATS across 8 core entities. It guarantees privacy protection, prevents formula injection, and mandates re-verification for sensitive columns.

---

## Supported Entities & Column Catalogs

| Entity Type | Available Columns | Sensitive Columns (Requires Re-Verification) | Forbidden Fields (Never Exported) |
|---|---|---|---|
| `CANDIDATE` | Full Name, Email, Phone, Current Role, Current Company, Location, Experience Years, Notice Period, Current CTC, Expected CTC, Status, Created At | `phone`, `currentCtc`, `expectedCtc` | `notes`, `internalNotes`, `passwordHash` |
| `JOB` | Title, Code, Client Legal Name, Department, Location, Remote Type, Employment Type, Status, Openings, Budget Min, Budget Max, Target Date, Created At | `budgetMin`, `budgetMax` | `recruiterCommission`, `marginPercent`, `internalNotes` |
| `CLIENT` | Legal Name, Code, Industry, Website, Tier, Status, Created At | None | `billingDetails`, `commercialTerms`, `marginPercent` |
| `APPLICATION` | Application Code, Candidate Name, Candidate Email, Job Title, Stage, Score, Applied At, Created At | None | `rejectionInternalNote` |
| `SUBMISSION` | Candidate Name, Job Title, Client Name, Status, Version, Submitted At, Feedback | `feedback` | `recruiterNotes`, `commercialFee` |
| `INTERVIEW` | Candidate Name, Job Title, Round Type, Scheduled At, Duration Mins, Status, Outcome | `outcome` | `internalInterviewerNotes` |
| `PLACEMENT` | Candidate Name, Job Title, Client Name, Placement Date, Joining Date, Salary Offered, Fee Percentage, Invoice Status | `salaryOffered`, `feePercentage` | `recruiterCommission` |
| `AUDIT_LOG` | Timestamp, Actor Email, Actor Role, Action, Entity, Entity ID, IP Address, User Agent | None | `details.password`, `details.token`, `details.secret` |

---

## Formula Injection Defense (CSV / Excel)
To prevent CSV Formula Injection (DDE attacks) when spreadsheets open exported CSV files:
1. Any cell string value starting with `=`, `+`, `-`, `@`, tab (`\t`), or carriage return (`\r`) is prepended with a single quote (`'`).
2. Values containing commas, quotes, or newlines are escaped according to RFC-4180 with enclosing double quotes (`"`), with internal quotes doubled (`""`).

## Sensitive Column Security
- When an export request includes sensitive columns (e.g., candidate CTC, job budgets, placement fees), the system validates that the requesting user has completed a Prompt 17 sensitive-action re-verification challenge within the last 15 minutes.
- If re-verification is missing or expired, the request is rejected with `403 Forbidden` (`REVERIFICATION_REQUIRED`).

## Audit Logging
- Every export generation emits a `DATA_EXPORT` action in the `AuditLog` recording the entity type, row count, file size, selected columns, and whether sensitive columns were included.
