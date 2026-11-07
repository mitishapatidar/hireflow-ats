# HireFlow ATS — Bulk Resume Import Documentation

**Module:** Sourcing & Ingestion (Prompt 20)  
**Figma Reference:** Frame 18 — Bulk Import  
**Route:** `/sourcing/import`  
**Tenant:** Aureva Capital Private Limited  

---

## 1. Overview & Business Requirements
Bulk Resume Import empowers recruiters and recruiting managers to process candidate CVs in batches of up to 50 resumes simultaneously (supporting `.pdf`, `.doc`, and `.docx` file formats up to 10MB per document).

### Critical Golden Rule
> **No automatic candidate creation:** Staged, parsed, or clipped candidates are **never** committed directly to the active candidate pool without explicit human review and approval by an authorized recruiter.

---

## 2. Architecture & Pipeline Lifecycle

```
[User Drag & Drop / File Select]
             │
             ▼
[File Security & Magic Byte Validation] ──── (Rejects invalid formats / sizes)
             │
             ▼
[Database Batch Staging (ImportBatch)] ─── Status: PROCESSING
             │
             ▼
[Async / Sync Worker Pipeline]
   ├─ Antivirus Scanning
   ├─ Text Extraction (pdf-parse / mammoth)
   ├─ Information Extraction (Name, Email, Phone, Company, Title, Skills, Exp)
   ├─ Multi-Tiered Duplicate Evaluation
   └─ Item Staging (ImportItem) ─── Status: AWAITING_REVIEW
             │
             ▼
[Recruiter Human Review & Verification]
   ├─ Side-by-side inspection of parsed fields
   ├─ Duplicate resolution / confirmation
   ├─ Job requisition assignment
   └─ Explicit "Create Candidate" Approval ─── Status: APPROVED
```

---

## 3. Data Models (`packages/db/prisma/schema.prisma`)

### `ImportBatch`
- `id`: UUID primary key.
- `batchCode`: Human-readable identifier (e.g., `BATCH-M4X91-A8F2`).
- `fileName`: Descriptive name or primary archive identifier.
- `importType`: `BULK_RESUME` (extensible to `CSV` and `JOB_BOARD`).
- `totalRecords`: Total number of uploaded files in batch.
- `processedRecords`: Number of processed items.
- `parsedRecords`: Successfully parsed CVs.
- `duplicateRecords`: Count of potential duplicate profiles identified.
- `failedRecords`: Number of unparseable or rejected files.
- `pendingReviewCount`: Count of items awaiting recruiter review.
- `status`: Batch status (`CREATED`, `PROCESSING`, `AWAITING_REVIEW`, `COMPLETED`, `CANCELLED`).
- `uploadedById` / `createdById`: Recruiter identity.

### `ImportItem`
- `id`: UUID primary key.
- `importBatchId`: Reference to parent `ImportBatch`.
- `fileName`: Original file name.
- `fileKey`: S3 / Storage provider storage reference.
- `recordData`: Structured JSON of extracted candidate fields (Name, Email, Phone, Company, Title, Skills, Exp).
- `parserConfidence`: Decimal confidence score from parser.
- `duplicateStatus`: `NO_MATCH`, `EXACT_DUPLICATE`, or `POSSIBLE_DUPLICATE`.
- `duplicateScore`: Computed duplicate match score (0–100%).
- `duplicateCandidateId`: Matched candidate ID if duplicate found.
- `status`: `PENDING`, `PROCESSING`, `AWAITING_REVIEW`, `APPROVED`, `REJECTED`, `FAILED`.
- `createdCandidateId`: Foreign key to `Candidate` once explicitly approved.

---

## 4. API Endpoints

- `POST /api/sourcing/import/batches`: Creates new batch, initiates virus scan and parsing.
- `GET /api/sourcing/import/batches`: Lists batches for the authenticated organization.
- `GET /api/sourcing/import/batches/:id`: Retrieves batch details and item statuses.
- `POST /api/sourcing/import/batches/:id/cancel`: Cancels pending processing.
- `POST /api/sourcing/import/items/:id/review`: Updates extracted fields during recruiter review.
- `POST /api/sourcing/import/items/:id/create-candidate`: Explicit recruiter action creating candidate record and linking application.

---

## 5. Security & Tenant Isolation
- **Role Enforcement:** Accessible only by `ADMIN`, `MANAGER`, and `RECRUITER`. Strictly forbidden for `CLIENT` and `CANDIDATE` roles (403 Forbidden).
- **Tenant Boundary:** All queries enforce `where: { organizationId: user.organizationId }`.
- **Audit Logging:** Every batch creation, cancellation, item edit, and approval writes an immutable audit record to `AuditLog`.
