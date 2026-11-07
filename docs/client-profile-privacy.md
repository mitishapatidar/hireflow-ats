# Client Profile Privacy & Anti-Leak Serializers (Prompt 22)

## Security Commandments
In compliance with enterprise ATS & SaaS security commandments, **no internal or commercial recruitment data may ever leak to the client portal**.

### Leaked Fields Prevented
The following fields are strictly excluded from client portal responses:
1. `internalNotes` (recruiter assessment, internal notes)
2. `salaryNotes` (internal candidate salary negotiations)
3. `feeBasis`, `feeAmount`, `margin` (agency commercial agreements and recruiter commissions)
4. `currentSalary`, `expectedSalary` (unless explicitly reviewed and standardized in standard profile)
5. `passwordHash`, `twoFactorSecret`, `backupCodes` (security credentials)
6. Internal interview panel debriefs between recruiters and hiring agency managers.

### Allow-List DTO Enforcement
All client responses pass through typed allow-list serializers defined in `@hireflow/shared`:
- `ClientSubmissionRowDTO`
- `ClientSubmissionDetailDTO`
- `ClientPositionDTO`
- `ClientInterviewDTO`
- `ClientProgressReportDTO`

Any property not defined in the DTO schema is discarded before serialization to JSON.
