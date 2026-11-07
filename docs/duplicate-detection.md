# HireFlow ATS — Centralized Duplicate Detection & Scoring Documentation

**Module:** Sourcing & Ingestion (Prompt 20)  
**Implementation:** `packages/shared/src/duplicates.ts`  
**Tenant:** Aureva Capital Private Limited  

---

## 1. Overview
Duplicate profiles create clutter, fractured candidate histories, conflicting recruiter ownership, and fractured client submission tracking. HireFlow ATS utilizes a centralized, multi-tiered duplicate detection and scoring engine operating identically across:
1. Single resume uploads (`/candidates/new`).
2. Bulk resume imports (`/sourcing/import`).
3. Chrome Extension clips (`apps/extension`).
4. Inbound email ingestion (`INBOUND_EMAIL`).
5. External job boards (`NAUKRI`, `FOUNDIT`).

---

## 2. Multi-Tiered Matching Algorithm

The engine evaluates input candidate criteria against existing candidate records in the organization:

### Tier 1: Exact Normalized Email Match
- **Normalization:** Lowercase, whitespace trimmed, dot-stripped for Gmail domains (`john.doe@gmail.com` -> `johndoe@gmail.com`).
- **Score:** `1.00` (100% confidence).
- **Category:** `EXACT_DUPLICATE`.
- **Reason:** `EXACT_EMAIL_MATCH`.

### Tier 2: Exact Normalized Phone Match
- **Normalization:** Strips all non-digit characters, leading `+91`, country code prefixes, and leading zero. Matches standard 10-digit Indian mobile numbers (`+91 98765 43210` -> `9876543210`).
- **Score:** `1.00` (100% confidence).
- **Category:** `EXACT_DUPLICATE`.
- **Reason:** `EXACT_PHONE_MATCH`.

### Tier 3: Fuzzy Name & Company Match
- **Name Similarity:** Evaluated using normalized **Levenshtein Distance** ratio:
  $$\text{Similarity}(s_1, s_2) = 1 - \frac{\text{Levenshtein}(s_1, s_2)}{\max(\text{len}(s_1), \text{len}(s_2))}$$
  - $\ge 0.85$ indicates a strong name match.
- **Company Similarity:** Evaluated using **Token Overlap Ratio** (Jaccard-like intersection over union of normalized alphanumeric tokens):
  $$\text{TokenOverlap}(A, B) = \frac{2 \cdot |A \cap B|}{|A| + |B|}$$
  - Handles variations like "Infosys Ltd" vs "Infosys Technologies".
- **Combined Fuzzy Scoring:**
  - If Name Match $\ge 0.85$ and Company Match $\ge 0.70$:
    - **Score:** $0.70 + 0.30 \times (\text{nameScore} \times 0.6 + \text{companyScore} \times 0.4)$
    - **Category:** `POSSIBLE_DUPLICATE` (or `EXACT_DUPLICATE` if score $\ge 0.90$).
    - **Reason:** `STRONG_NAME_COMPANY_MATCH`.

---

## 3. Inclusion of Archived & Soft-Deleted Profiles
- Candidates flagged as `isArchived: true` are **included** in duplicate checks.
- This prevents a previously archived candidate from being re-created as a duplicate record without their historical applications, interview feedback, or non-compete notes being surfaced.

---

## 4. `DuplicatePair` Lifecycle

When a potential duplicate is detected during bulk ingestion or sourcing capture:
1. A `DuplicatePair` record is created linking `primaryCandidateId` and `duplicateCandidateId`.
2. Status is set to `UNREVIEWED`.
3. Recruiter reviews in **Duplicate Review & Merge Studio** (`/sourcing/duplicates`).
4. Two paths:
   - **Different Candidates:** Recruiter marks pair as `RESOLVED_DIFFERENT`. Audit trail is logged.
   - **Confirmed Duplicate:** Recruiter launches Side-by-Side Merge Studio. Status transitions to `MERGED` with link to `CandidateMerge` record.
