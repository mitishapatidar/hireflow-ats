# HireFlow ATS — Candidate Merge Engine Documentation

**Module:** Sourcing & Ingestion (Prompt 20)  
**Figma Reference:** Frame 19 — Duplicate Review & Merge  
**Route:** `/sourcing/duplicates`  
**Tenant:** Aureva Capital Private Limited  

---

## 1. Overview & Non-Destructive Policy
Candidate profile merging combines duplicate profiles into a single comprehensive record while ensuring **zero data loss**. 

### Security & Compliance Invariants
1. **Never Hard Delete:** Secondary candidate records are **never deleted**. The secondary record is soft-archived with `isArchived: true, isMerged: true, mergedIntoCandidateId: master.id, mergedAt: now()`.
2. **Atomic Transaction:** Merge execution runs inside an ACID database transaction. Any failure rolls back completely.
3. **Mandatory Confirmation Keyword:** Recruiter must explicitly type `"MERGE"` in uppercase to execute the merge.
4. **Relational Re-Parenting:** All associated historical child entities are re-parented to the Master candidate:
   - Resumes & Documents (`CandidateDocument`)
   - Recruiter Notes (`CandidateNote`)
   - Tags (`CandidateTag`)
   - Applications (`Application`)
   - Interview records & feedback (`Interview`)
   - Client submissions (`Submission`)
   - Offers (`Offer`)
   - Placements (`Placement`)

---

## 2. Side-by-Side Resolution (`MERGE_FIELD_CATALOG`)

Recruiters choose field-by-field values to retain on the Master record:

| Catalog Field | Type | Resolution Behavior |
| :--- | :--- | :--- |
| `name` | String | Choose Master or Secondary value |
| `email` | String | Choose Master or Secondary (non-chosen can be stored in metadata) |
| `phone` | String | Choose Master or Secondary |
| `currentCompany` | String | Choose Master or Secondary |
| `currentTitle` | String | Choose Master or Secondary |
| `location` | String | Choose Master or Secondary |
| `experienceYears` | Decimal | Choose Master or Secondary |
| `currentSalary` | Decimal | Choose Master or Secondary |
| `expectedSalary` | Decimal | Choose Master or Secondary |
| `noticePeriod` | String | Choose Master or Secondary |
| `skills` | String Array | **Automatic Union** of skills from both profiles |
| `source` | String | Retain Master original source or override |

---

## 3. Application Conflict Resolution
A candidate cannot hold duplicate applications for the same job requisition.
- Before merging, the engine inspects all applications of Master ($A_{\text{master}}$) and Secondary ($A_{\text{secondary}}$).
- If both profiles have an application for Job $J$:
  - The Master application is preserved.
  - The Secondary application's interview notes, feedbacks, and submissions are linked to the Master application.
- Non-colliding applications are seamlessly re-parented (`candidateId = master.id`).

---

## 4. Audit Log & `CandidateMerge` Record

Every merge generates an immutable `CandidateMerge` row:
- `id`: UUID primary key.
- `organizationId`: Tenant ID.
- `masterCandidateId`: Retained candidate profile.
- `secondaryCandidateId`: Soft-archived candidate profile.
- `mergedById`: Recruiter who authorized the merge.
- `mergeReason`: Text rationale provided by recruiter.
- `fieldsRetained`: JSON object recording choices (`{ name: 'MASTER', email: 'SECONDARY', ... }`).
- `preservedCounts`: JSON snapshot of relational counts preserved.
- `createdAt`: Timestamp in IST / UTC.
