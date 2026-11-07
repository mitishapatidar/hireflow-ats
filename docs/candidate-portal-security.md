# HireFlow ATS — Candidate Portal Data Isolation & Anti-Leak Security

**Prompt:** Prompt 25  
**Tenant:** Aureva Capital Private Limited  

---

## 1. Threat Model & Data Leakage Prevention

The Candidate Portal is accessed by external applicants whose authorization level is restricted strictly to their own application journey. Under no circumstances should internal recruiter or agency commercial data reach candidate-facing responses.

### Forbidden Keys & Information
The runtime serializer validator `assertCandidateSafe()` asserts that none of the following fields exist anywhere in JSON payloads returned to candidates:

- `feePercentage`, `paymentTerms`, `recruiterMargin`, `fixedFee`
- `internalNotes`, `reviewerNotes`, `scorecard`, `technicalScore`
- `submissionFeedback` (internal recruiter discussions)
- Other candidates' identities or interview outcomes

---

## 2. Server-Side Authentication & Session Policy

1. **Role Enforcement:** All candidate endpoints (`/api/candidate-portal/*`) verify `user.role === UserRole.CANDIDATE` (or `ADMIN` in dev impersonation mode).
2. **Tenancy & Candidate Isolation:** Candidate profiles resolve through `userId` binding on the `Candidate` model. Users can only query applications and interviews where `candidate.userId === authenticatedUser.id`.
3. **No Hard Deletes:** Candidate records, applications, and invitations only support soft deletion (`isArchived: true`).
