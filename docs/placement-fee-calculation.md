# HireFlow ATS — Placement Fee Calculation & Anti-Tamper Security

## Overview
Commercial placement fee calculation is strictly enforced on the server to prevent financial manipulation, client-side tampering, or unauthorized discounting.

---

## 1. Remediation of Legacy Fee Tampering Vulnerability
In legacy prototypes, `ConfirmJoiningSchema` allowed the browser request payload to supply `feeAmount`. This presented a critical vulnerability where an attacker or unauthorized user could forge low or zero fee amounts.

### The Remediation:
- The endpoint `POST /api/offers/:id/confirm-joining` and Server Action `confirmJoiningAction` now completely ignore any client-submitted fee amount.
- The server independently resolves the `Offer`, `Application`, `Candidate`, `Job`, and `Client` records within a secure transaction.
- The placement fee is computed using authoritative database records and Decimal arithmetic via `calculatePlacementFee()`.

---

## 2. Server-Side Calculation Logic

```typescript
export function calculatePlacementFee(params: {
  offeredSalary: number; // Annual CTC
  feeBasis?: FeeBasis; // PERCENTAGE_CTC or FIXED_AMOUNT
  clientFeePercentage?: number | null; // e.g., 8.5%
  clientFixedFee?: number | null; // Fixed fee in INR/currency
  adjustmentAmount?: number; // Authorized discount or adjustment
}): {
  feeBasis: FeeBasis;
  feePercentage: number | null;
  grossFee: number;
  netFee: number;
  adjustmentAmount: number;
}
```

### Calculation Rules:
1. **Percentage of Annual CTC (`PERCENTAGE_CTC`)**:
   - Standard default when `client.feePercentage` is configured.
   - Formula:
     $$\text{Gross Fee} = \text{Annual CTC} \times \left(\frac{\text{Fee Percentage}}{100}\right)$$
   - Rounded to 2 decimal places using bankers' rounding / decimal arithmetic.
2. **Fixed Commercial Fee (`FIXED_AMOUNT`)**:
   - Used when a client agreement stipulates a flat fee per placement.
   - Formula:
     $$\text{Gross Fee} = \text{Client Fixed Fee}$$
3. **Authorized Adjustments**:
   - Discounts or adjustments require leadership permissions and a mandatory reason (`adjustmentReason`).
   - Formula:
     $$\text{Net Fee} = \max(0, \text{Gross Fee} - \text{Adjustment Amount})$$

---

## 3. Due Date Calculation
Credit terms from the client contract (`paymentTerms`, e.g. "Net 30", "Net 45", "Immediate") determine the payment deadline:
```typescript
export function calculatePaymentDueDate(joiningDate: Date, paymentTerms?: string | null): Date
```
- `"immediate"`: Due date matches joining date.
- `"net 15"`: Due date is joining date + 15 days.
- `"net 30"`: Due date is joining date + 30 days.
- `"net 45"`: Due date is joining date + 45 days.
- `"net 60"`: Due date is joining date + 60 days.
- Default fallback: 30 days from joining date.
