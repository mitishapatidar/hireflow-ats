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
- `feeBasis`: Fee structure model (`PERCENTAGE_CTC` or `FIXED_AMOUNT`).
- `ctcSnapshot`: Immutable snapshot of the accepted Annual CTC.
- `feePercentage`: Client contract fee percentage (e.g. 8.5%).
- `feeAmount`: Authoritative agency placement receivable calculated on the server.
- `adjustmentAmount` / `adjustmentReason`: Authoritative adjustments/discounts applied with justification.
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

## 3. Data Protection & Zero-Leakage Masking
To prevent internal margin leakage and maintain candidate/client privacy:
- **Client Portal**: Placement commercial fees, recruiter margins, and internal notes are strictly omitted from API responses and portal views via `serializePlacementForRole()`.
- **Candidate Portal**: Placements and fee agreements are completely inaccessible to candidates.
- **Role Scoping**: Recruiters without administrative or finance access see masked commercial values (`₹ ••••••`), while Admins, Directors, and Finance leads see complete monetary breakdowns and payment logs.

---

## 4. Installments & Payment Reconciliation
Each placement supports multiple installment payments (`PlacementPayment`):
- `amount`: Payment tranche amount.
- `paymentDate`: Date of receipt.
- `paymentMethod`: Wire Transfer, Cheque, NEFT/RTGS, UPI.
- `referenceNumber`: Bank UTR or transaction ID.
- `notes`: Auditor and reconciliation comments.
- Automatic status transitions:
  - When `amountReceived >= netFee`, status transitions to `PAID`.
  - When `0 < amountReceived < netFee`, status transitions to `PARTIALLY_PAID`.
  - Overdue payments past `dueDate` with balance remaining flag as `OVERDUE`.
