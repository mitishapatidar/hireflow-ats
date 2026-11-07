# Recruiter Daily Activity & Manager MIS (Prompt 21, Frame 39)

## Overview
Manager MIS delivers operational visibility across agency recruiter daily actuals, target attainment, and cohort velocity computed strictly using Indian Standard Time (IST / Asia/Kolkata) boundaries.

---

## 1. 6 Team Rollup Metrics
1. **Total Sourced**: Active candidate pool sourced during the reporting cohort.
2. **Submissions**: Number of candidate submissions presented to clients.
3. **Interviews**: Completed client and agency interview rounds.
4. **Offers Released**: Formal candidate offers extended.
5. **Placements**: Confirmed joined placements.
6. **Total Agency Fee**: Aggregate commercial placement fee booked in INR.

---

## 2. Recruiter Target Attainment
- Target benchmark: 2 Confirmed Placements / Recruiter / Month.
- Attainment formula: `min(100, round((confirmedPlacements / 2) * 100))`.
- Color coding:
  - $\ge 100\%$: Emerald Green (`#12B76A`)
  - $\ge 50\%$: Purple (`#5B49D6`)
  - $< 50\%$: Amber (`#F59E0B`)
