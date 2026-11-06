# Metrics Engine & Mathematical Formulas

**Module:** Metrics & Analytics Engine  
**Playbook Phase:** Phase 1 — Prompt 15  
**Package:** `@hireflow/shared/src/metrics.ts`  

## 1. Overview

The HireFlow ATS metrics engine provides zero-division safe calculations, precise Indian Standard Time (IST) calendar boundary utilities, and target progress evaluators.

## 2. Zero-Baseline Safe Delta Formula

Traditional percentage change calculations fail when the previous period baseline is zero:
$$\text{Percentage Change} = \frac{\text{Current} - \text{Previous}}{\text{Previous}} \times 100$$
If $\text{Previous} = 0$ and $\text{Current} > 0$, naive calculation yields `Infinity` or `NaN`.

`calculateMonthOverMonthDelta(current, previous, label)` implements safe fallback logic:

- If `previous === 0 && current > 0`: Returns `"+N new vs last month"`
- If `previous === 0 && current === 0`: Returns `"0 vs last month"`
- If `previous > 0`: Returns signed percentage delta:
  $$\Delta = \text{round}\left(\frac{\text{current} - \text{previous}}{\text{previous}} \times 100\right)$$
  e.g. `"+15% vs last month"` or `"-8% vs last month"`

## 3. IST Calendar Boundary Formulas

All temporal grouping strictly respects Indian Standard Time (`UTC + 5.5 hours`):

- **Day Boundaries**: From `00:00:00.000 IST` to `23:59:59.999 IST`.
- **Month Boundaries**: From 1st day of month `00:00:00.000 IST` to last day `23:59:59.999 IST`.
- **Week Boundaries**: Monday `00:00:00.000 IST` to Sunday `23:59:59.999 IST`.

## 4. Target Progress Evaluation

$$\text{Progress} = \text{min}\left(100, \text{round}\left(\frac{\text{count}}{\text{target}} \times 100\right)\right)$$
- If target is 0 or unassigned, progress defaults to `0%`.
- If count exceeds target, progress caps at `100%` while reporting the actual overflow count.
