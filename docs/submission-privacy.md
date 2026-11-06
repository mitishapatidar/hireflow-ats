# Submission Privacy & Anti-Leak Allow-List Specification

## Mandatory Exclusions
The client-facing profile must NEVER contain:
- Internal candidate notes (`CandidateNote`)
- Confidential recruiter notes
- Internal salary notes
- Candidate current salary
- Candidate expected salary
- Recruiter commission or agency margin calculations
- Client commercial terms or placement fee percentages
- Private interview panel feedback
- Internal rejection feedback
- Other clients' information
- Private audit metadata (IP addresses, user agents)

## Enforcement Mechanism
Sanitization is enforced on the server-side via `buildClientFacingProfile()` which constructs an explicit allow-list DTO (`ClientFacingStandardProfileDTO`). Raw database objects are never returned directly to client endpoints.
