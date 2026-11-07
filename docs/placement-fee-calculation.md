# HireFlow ATS — Placement Fee Calculation & Anti-Tamper Security

## Overview
Commercial placement fee calculation is strictly enforced on the server to prevent financial manipulation, client-side tampering, or unauthorized discounting.

---

## 1. Remediation of Legacy Fee Tampering Vulnerability
In legacy prototypes, `ConfirmJoiningSchema` allowed the browser request payload to supply `feeAmount`. This presented a critical vulnerability where an attacker or unauthorized user could forge low or zero fee amounts.

### The Remediation:
- The endpoint `POST /api/offers/:id/confirm-joining` and Server Action `confirmJoiningAction` completely ignore and omit any client-submitted commercial figures (`feeAmount`, `grossFee`, `netFee`, `feePercentage`, `ctcSnapshot`, `feeBasis`, or calculated totals).
- The server independently resolves the `Offer`, `Application`, `Candidate`, `Job`, and `Client` records within a secure atomic transaction.
- If the associated client has no valid agreed `feePercentage` configured, the server rejects the request with HTTP 400 (`CLIENT_FEE_AGREEMENT_MISSING`). It will never accept a client-provided fallback amount or fabricate a fee.
- The placement fee is computed strictly using authoritative database records and Decimal-grade integer cents arithmetic via `calculatePlacementFee()`.

---

## 2. Authoritative Server-Side Calculation Logic

```typescript
export function calculatePlacementFee(params: {
  offeredSalary: number | string | Prisma.Decimal; // Annual CTC
  feePercentage?: number | string | Prisma.Decimal | null; // e.g., 8.5%
  adjustmentAmount?: number | string | Prisma.Decimal; // Authorized discount or adjustment
  adjustmentReason?: string | null; // Mandatory if adjustmentAmount > 0
}): {
  isValid: boolean;
  error?: string;
  feeBasis: FeeBasis;
  feePercentage: number;
  grossFee: number;
  adjustmentAmount: number;
  netFee: number;
}
```

### Commercial Calculation Rules:
1. **Gross Fee Calculation (`PERCENTAGE_CTC`)**:
   - Formula:
     $$\text{Gross Fee} = \text{Annual CTC} \times \left(\frac{\text{Client Fee Percentage}}{100}\right)$$
   - Computed via integer cents arithmetic (multiplying CTC by fee percentage, scaled to cents and rounded to two decimal places) to eliminate JavaScript IEEE 754 floating-point inaccuracies.
2. **Authorized Commercial Adjustments**:
   - Discounts or adjustments require leadership permissions (`ADMIN` or `MANAGER`). Recruiters cannot apply or modify adjustments.
   - **Adjustment Constraints**:
     - Adjustment amount must be non-negative ($\ge 0$).
     - Adjustment amount cannot exceed the gross fee ($\le \text{Gross Fee}$).
     - Any adjustment greater than zero strictly requires a non-empty `adjustmentReason`.
   - Formula:
     $$\text{Net Fee} = \text{Gross Fee} - \text{Authorized Adjustment}$$
3. **Missing Agreement Protection**:
   - If `client.feePercentage` is null, undefined, or $\le 0$, `calculatePlacementFee` flags `isValid: false` and the endpoint aborts with HTTP 400 (`CLIENT_FEE_AGREEMENT_MISSING`).

---

## 3. Due Date Calculation
Credit terms from the authoritative client contract (`paymentTerms`, e.g. "Net 30", "Net 45", "Immediate") determine the payment deadline:
```typescript
export function calculatePaymentDueDate(joiningDate: Date, paymentTerms?: string | null): Date
```
- `"immediate"`: Due date matches joining date.
- `"net 15"`: Due date is joining date + 15 days.
- `"net 30"`: Due date is joining date + 30 days.
- `"net 45"`: Due date is joining date + 45 days.
- `"net 60"`: Due date is joining date + 60 days.
- Default fallback: 30 days from joining date.
- Arbitrary browser-supplied due dates are ignored in favor of contractual terms.
