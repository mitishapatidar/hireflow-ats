# Application Rejections & Reason Taxonomy

## Rejection Architecture
Rejections require a registered `RejectionReason` and mandatory internal feedback.

### Reason Codes Seeded
- `SKILLS_MISMATCH`: Required technical or domain skills not met
- `EXPERIENCE_INSUFFICIENT`: Years of experience below mandate threshold
- `SALARY_UNALIGNED`: Candidate expectation exceeds client budget
- `LOCATION_MISMATCH`: Candidate unwilling or unable to relocate
- `FAILED_TECHNICAL`: Did not clear technical evaluation round
- `FAILED_CULTURE_FIT`: Behavioral or culture alignment concerns
- `OFFER_DECLINED`: Candidate declined the formal employment offer
- `NO_SHOW`: Candidate failed to attend scheduled interview
- `POSITION_CLOSED`: Job mandate was closed or cancelled by client

### Anti-Leak Protections
Rejection feedback and reasons are strictly internal to agency recruiters and managers. They are never exposed to candidates or external client portals.
