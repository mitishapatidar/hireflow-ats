# Panel Feedback & Confidential Evaluation

## 1. Overview
The panel feedback module allows assigned interviewers, managers, and administrators to submit structured evaluations following completed rounds.

## 2. Evaluation Fields
- **Overall Rating:** 1 to 5 Stars
- **Hiring Recommendation:** `Strong Yes`, `Yes`, `Maybe`, `No`, `Strong No`
- **Technical Competency Score:** 1 to 10
- **Strengths & Concerns:** Key observations
- **Internal Evaluation Notes:** Detailed technical synthesis

## 3. Strict Data Isolation (Anti-Leak Guarantee)
- Panel feedback is internal recruitment agency intellectual property.
- Feedback records are **strictly omitted** from all Client Portal (`/portal/*`) and Candidate-facing API responses.
- Feedback is never embedded in client-facing standard profiles or shared PDFs.
