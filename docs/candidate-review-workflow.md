# Candidate Review Workflow & Pre-Save Duplicate Resolution

## Core ATS Mandate
**Parsed candidate information must NEVER be saved automatically.** A human recruiter must review, edit where necessary, and explicitly click **"Review & Save Candidate"** to commit the record to the database.

---

## Screen Workflow (Figma Frame 17)

The `/candidates/new` interface provides two parallel entry avenues into the review form:

1. **Resume Upload Path**: Recruiter drops a resume file; the system extracts text and pre-populates fields with confidence scores.
2. **Manual Entry Path**: Recruiter clicks "Enter manually", immediately expanding the form with empty fields.

Both paths converge on the exact same review form, ensuring identical validation, duplicate protection, ownership assignment, and audit trail creation.

---

## Pre-Save Duplicate Candidate Resolution

Duplicate candidates degrade pipeline integrity and confuse client hiring managers. HireFlow ATS enforces real-time pre-save duplicate detection at two critical points:

1. **Client-Side Real-Time Warning**:
   - As soon as the email or phone field loses focus (or when resume parsing completes), an asynchronous duplicate lookup runs.
   - If a matching candidate exists in the organization (including soft-archived candidates), a high-visibility amber banner appears:
     > **Possible duplicate candidate detected**  
     > Possible duplicate: **Aarav Shah** · same EMAIL found in record **cand-c-0001**. Review existing record before saving a new profile.
   - The banner provides a direct link to view the existing candidate profile.
   - To proceed with saving, the recruiter must check:
     `[x] I confirm this is a different individual and wish to proceed with saving.`

2. **Server-Side Transactional Guard**:
   - Inside `prisma.$transaction`, the server repeats the duplicate check immediately before issuing the `INSERT` query.
   - If an unconfirmed duplicate is detected, the transaction aborts with HTTP 409 Conflict.

---

## Transactional Candidate Creation & Audit Trail

When "Review & Save Candidate" is clicked:
1. `name` and `email` are validated via shared Zod schema.
2. Candidate code `cand-c-XXXX` is assigned sequentially.
3. Candidate record is inserted with `status = 'NEW'`, `source = 'Resume Upload' | 'Manual Entry'`.
4. Attached resume document is saved to `CandidateDocument` table with document type `RESUME`.
5. Internal confidential notes are saved to `CandidateNote` table.
6. Recruiter tags are persisted in `CandidateTag` join table.
7. An entry is appended to `AuditLog` recording the actor, action `CANDIDATE_CREATED`, and IP address.
8. Recruiter is redirected to `/candidates/[id]`.
