# Client Submission Rules & Compliance Validation

## 1. Overview
Recruitment agencies must comply with strict client SLAs and presentation standards to prevent client rejections, lost mandates, and regulatory penalties. Client Submission Rules allow agencies to configure automated pre-submission gates per client account.

## 2. Configurable Submission Rules
Stored in the `SubmissionRule` model linked to `ClientWorkflow`:
1. **`requireCompleteProfile` (Boolean):**
   - Validates candidate summary length (>= 30 chars).
   - Validates candidate current headline is set.
   - Validates candidate core skills list (at least 3 skills).
2. **`requireCvDocument` (Boolean):**
   - Checks candidate documents table for a non-archived `RESUME` attachment.
3. **`requirePortfolioUrl` (Boolean):**
   - Requires valid URL for portfolio or code samples (e.g. GitHub, Figma, personal website).
4. **`requireExpectedSalary` (Boolean):**
   - Requires verified numerical compensation expectations.
5. **`requireNoticePeriod` (Boolean):**
   - Requires availability / notice period declaration (e.g., "Immediate", "30 days", "90 days").
6. **`requireCandidateConsent` (Boolean):**
   - Enforces candidate representation consent timestamp (`consentRecordedAt`).
7. **`requiresManagerApproval` (Boolean):**
   - Enforces internal manager review before transmission to client.
8. **`profileFormat` (Enum):**
   - `STANDARDIZED_ANONYMIZED`: Redacts candidate contact info to prevent direct client circumvention.
   - `BRANDED_STANDARD`: Standard agency header and watermark with candidate details.
   - `ORIGINAL_ATTACHED`: Direct forwarding of candidate original CV file.

## 3. Evaluation Engine (`validateSubmissionAgainstClientRules`)
The validation function evaluates each rule against the submission snapshot and returns:
```typescript
{
  allPassed: boolean,
  isValid: boolean,
  checks: Array<{
    rule: string,
    label: string,
    required: boolean,
    passed: boolean,
    message?: string
  }>,
  evaluatedAt: string,
  clientWorkflowVersion: number
}
```
All checks are displayed as green checkmarks or red warnings in the Approval Drawer.
