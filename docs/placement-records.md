# HireFlow ATS — Placement Records & Commercial Management

## Overview
Placement Records (Figma Frame 40) manage post-offer commercial tracking, candidate joining verification, fee receivables, invoice tracking, and payment installment reconciliation.

---

## 1. Core Architecture
A `Placement` record is the authoritative commercial contract created upon formal verification of candidate onboarding:
- `applicationId`: Unique one-to-one link to the originating `Application`.
- `offerId`: One-to-one relation with the accepted `Offer` (`Offer.placementId`).
- `clientId`: Client organization billed for the placement.
- `organizationId`: Multi-tenant boundary (`Aureva Capital Private Limited`).
- `joiningDate`: Confirmed date of employment commencement.
- `feeBasis`: Fee structure model (`PERCENTAGE_CTC`).
- `ctcSnapshot`: Immutable snapshot of the accepted Annual CTC.
- `feePercentage`: Client contract fee percentage (e.g. 8.5%).
- `feeAmount`: Authoritative agency placement receivable calculated on the server.
- `adjustmentAmount` / `adjustmentReason`: Authoritative adjustments/discounts applied with leadership justification.
- `paymentStatus`: Commercial receivable lifecycle (`PENDING`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`, `WAIVED`).
- `dueDate`: Calculated payment due date based on client credit terms.
- `amountReceived`: Reconciled sum of all completed installments.

---

## 2. Dashboard KPIs (Figma Frame 40)
The Placement Dashboard at `/placements` displays 5 real-time KPI metrics:
1. **Total Confirmed Placements**: Lifetime total of joined candidates.
2. **Placements MTD**: Placements confirmed within the active calendar month.
3. **Upcoming Joinees**: Candidates who have accepted offers (`OfferStatus.ACCEPTED`) awaiting formal joining verification. Excluded from booked revenue until joining is confirmed.
4. **Pending Receivables**: Total outstanding fee balance for all unpaid or partially paid placements.
5. **Fee Booked MTD**: Total commercial fee revenue secured within the active calendar month.

---

## 3. Strict Role-Based Access Control & Anti-Data-Leak Protection
To prevent internal margin leakage and maintain candidate/client privacy:
- **Client Portal**:
  - Placements are scoped strictly to jobs the client contact is authorized to see via `ClientAccess.authorizedJobIds`. Attempts to view unassigned placements return HTTP 403.
  - Placement commercial fees, fee percentages, recruiter margins, and internal notes are scrubbed from responses via `serializePlacementForRole()`.
- **Candidate Portal**:
  - Candidates can only view their own placement record (`candidate.userId === user.id`).
  - All commercial fee amounts, recruiter margins, fee percentages, and billing terms are completely scrubbed from the response.
- **Recruiter Role**:
  - In list and detail views, commercial financial figures are scrubbed (`₹ ••••••`). Recruiters can view operational onboarding status, joinee details, and joining dates, but cannot view commercial fees or margins.
- **Admin & Manager Roles**:
  - Full access to commercial fee amounts, discounts/adjustments, billing terms, and payment ledger history.

---

## 4. Installments & Payment Ledger Reconciliation
Each placement supports multiple installment payments (`PlacementPayment`):
- `amount`: Payment tranche amount.
- `paymentDate`: Date of receipt.
- `paymentMethod`: Wire Transfer, Cheque, NEFT/RTGS, UPI.
- `referenceNumber`: Mandatory Bank UTR or transaction reference ID.
- `notes`: Auditor and reconciliation comments.

### Financial Integrity Rules:
1. **Ledger-Recomputed Balance**:
   - `amountReceived` on the Placement record is strictly derived from the sum of all confirmed `PlacementPayment` ledger entries.
2. **Overpayment Prevention**:
   - Installments that would cause the total paid amount to exceed `netFee` are rejected with HTTP 400 (`OVERPAYMENT_NOT_PERMITTED`).
3. **Status Contradiction Prevention**:
   - Direct status updates to `PAID` are rejected if the ledger shows an outstanding balance (`amountReceived < netFee`).
   - Direct status updates to `PARTIALLY_PAID` are rejected if zero payments have been recorded (`amountReceived <= 0`).
4. **Waiver Justification**:
   - Setting `paymentStatus` to `WAIVED` strictly requires a non-empty `waiverReason` explaining why the receivable balance was written off.
