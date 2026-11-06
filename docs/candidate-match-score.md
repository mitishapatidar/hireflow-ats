# Deterministic Candidate-Job Match Percentage Calculator

## Architectural Philosophy
**Never use an LLM to calculate candidate match scores.**
The HireFlow ATS match calculation engine is 100% deterministic, mathematically reproducible from the same candidate and job input attributes, and versioned under `1.0.0`.

## Component Weights
The match score aggregates four weighted components:

| Component | Weight | Deterministic Formula / Scoring Rule |
|---|---:|---|
| **Skills Overlap** | 50% | `matchedRequiredSkills / totalRequiredSkills * 100`. Normalized casing, trailing `.js` stripping, alias mapping. |
| **Experience Fit** | 25% | Full 100% within `[min, max]`. Partial ratio `candidateYears / min` if below. Scaled overqualification penalty `100 - (diff * 5)` if above. Explicit 0 if missing. |
| **Location Fit** | 15% | 100% for Remote or exact city match. 70% for domestic tech hub relocation. 30% for mismatch. 50% neutral for unspecified. |
| **Salary Fit** | 10% | 100% within or below target budget. 80% if within 10% above budget ceiling. 50% if within 25% above budget ceiling. 20% if >25% above budget ceiling. |

## Versioning & Explanations
Every calculation persists:
- `overallScore` (0-100 integer)
- `algorithmVersion` (`1.0.0`)
- `calculatedAt` (ISO timestamp)
- `breakdown` object detailing exact scores and matched/missing attributes
- `explanation` array powering the recruiter UI tooltip
