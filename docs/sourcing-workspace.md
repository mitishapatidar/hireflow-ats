# HireFlow ATS — Sourcing Workspace Documentation

**Module:** Sourcing & Ingestion (Prompt 20)  
**Figma Reference:** Frame 20 — Sourcing Workspace  
**Route:** `/sourcing`  
**Tenant:** Aureva Capital Private Limited  

---

## 1. Overview
The Sourcing Workspace acts as a centralized intake and pre-candidate staging area for Aureva Capital. It aggregates prospective candidate profiles captured across 6 channels:
1. `MANUAL_UPLOAD`: Single resume upload.
2. `BULK_IMPORT`: Multi-resume batch uploads.
3. `CHROME_EXTENSION`: Web Clipper captures from LinkedIn, Naukri, and Foundit.
4. `INBOUND_EMAIL`: CVs ingested from recruiter email boxes.
5. `NAUKRI`: Direct Naukri Resdex / eHire candidate searches.
6. `FOUNDIT`: Direct Foundit India integration.

---

## 2. Ingestion Flow & Explicit Review Gate

```
  External Sources (Chrome Extension, Bulk Import, Email, Job Boards)
                             │
                             ▼
                  [SourcingItem Staging]
               (Status: PENDING_REVIEW)
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   [Duplicate Detected]              [Unique Candidate]
 (duplicateStatus: FLAG)           (duplicateStatus: UNIQUE)
            │                                 │
            └────────────────┬────────────────┘
                             ▼
              [Human Recruiter Review Modal]
                 ├─ Inspect & Edit Fields
                 ├─ Review Duplicate Matches
                 ├─ Map to Job Requisition
                 └─ Enter Recruiter Notes
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
       [Approved]                        [Rejected]
  (Creates Candidate &               (Status: REJECTED,
   Application Record)                No Profile Created)
```

---

## 3. Key UI Elements (Figma Frame 20)

### A. Four Primary KPI Cards
- **Total Sourced:** Count of items staged across all 6 channels.
- **Awaiting Review:** Profiles awaiting recruiter review before becoming candidates.
- **Duplicate Flags:** Sourced profiles matching existing database records.
- **Approved Candidates:** Sourced items successfully converted into active candidate records.

### B. Filter Bar
- **Search Input:** Debounced full-text search across candidate name, email, and current company.
- **Source Filter:** Filter by channel (`ALL`, `CHROME_EXTENSION`, `BULK_IMPORT`, etc.).
- **Status Filter:** `PENDING_REVIEW`, `APPROVED`, `REJECTED`.
- **Job Requisition Selector:** Filter by mapped requisition.

### C. Review & Approval Modal
- Pre-populated editable form: Full Name, Email, Phone, Company, Title, Location, Experience Years, Skills.
- Duplicate comparison alert: Shows match percentage and existing candidate name.
- Job mapping dropdown: Link directly to active job opening.
- Explicit "Approve & Create Candidate" action.
