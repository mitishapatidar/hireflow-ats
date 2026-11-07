# Offers & Placements Lifecycle Architecture (Prompt 21)

## Overview
HireFlow enforces an agency-grade contract where candidate offer generation and milestone placements are decoupled. An accepted offer is **not** a placement. Only when a candidate actually joins the client organization does an authorized internal user (Admin, Manager, or assigned Recruiter) trigger `confirmJoiningAction`, creating the immutable commercial `Placement` record inside a database transaction.

---

## 1. State Machine Transitions

| From Status | Allowed Target Statuses | Trigger Action / Role |
| :--- | :--- | :--- |
| `DRAFT` | `RELEASED`, `WITHDRAWN` | `releaseOfferAction` (Admin, Manager, Recruiter) |
| `RELEASED` | `ACCEPTED`, `DECLINED`, `EXPIRED`, `WITHDRAWN` | `acceptOfferAction`, `declineOfferAction` |
| `ACCEPTED` | `JOINED`, `DECLINED`, `WITHDRAWN` | `confirmJoiningAction` (Admin, Manager, Recruiter) |
| `JOINED` | Terminal (Placement created) | Locked in transactional audit record |

---

## 2. Commercial Placement Contract & Duplicate Prevention

When candidate joining is confirmed:
1. **Transaction Isolation**:
   ```ts
   await prisma.$transaction(async (tx) => {
     // 1. Create Placement record
     const placement = await tx.placement.create({ ... });
     // 2. Lock offer status to JOINED with placement link
     await tx.offer.update({ where: { id: offerId }, data: { status: 'JOINED', placementId: placement.id } });
     // 3. Mark Application status as PLACED
     await tx.application.update({ where: { id: offer.applicationId }, data: { status: 'PLACED' } });
   });
   ```
2. **Duplicate Placement Prevention**:
   - `Offer.placementId` carries a `@unique` foreign key constraint.
   - `Placement.applicationId` is `@unique`.
   - Before transaction execution, HireFlow verifies no existing placement exists for this offer or application.

---

## 3. Data Leak Prevention (Anti-AI-Slop Serialization)

External personas (`CLIENT`, `CANDIDATE`) must never observe recruiter margin margins or internal notes:
- `serializeOfferForRole(offer, role)` scrubs `agencyMarginAmount`, `agencyMarginPercent`, `notes`, and `declineReason` from client/candidate responses.
- Client responses contain only verified offer status, offered CTC, candidate name, and job title.
