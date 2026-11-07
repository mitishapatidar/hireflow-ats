# HireFlow ATS — Inbound Email Sourcing Documentation

**Module:** Sourcing & Ingestion (Prompt 20)  
**Provider:** `InboundEmailProvider` (`packages/shared/src/sourcing-integrations/inbound-email-provider.ts`)  
**Tenant:** Aureva Capital Private Limited  

---

## 1. Overview
Inbound Email Sourcing allows agencies to automatically capture candidate resumes emailed directly to dedicated recruiter or jobs mailboxes (e.g., `careers@aurevacapital.internal`, `jobs@aurevacapital.internal`).

---

## 2. Ingestion Pipeline

```
[Inbound Email Received]
          │
          ▼
[Spam & SPF/DKIM Verification] ──── (Discards unverified or marketing emails)
          │
          ▼
[Attachment Inspection] ──── (Extracts .pdf, .docx, .doc resume attachments)
          │
          ▼
[Antivirus & Magic Byte Scan] ──── (Discards malicious payloads)
          │
          ▼
[Resume Parsing Pipeline] ──── (Extracts Candidate Name, Contact, Skills, Exp)
          │
          ▼
[Duplicate Check Engine] ──── (Scores against existing database records)
          │
          ▼
[SourcingItem Staged] ──── (Status: PENDING_REVIEW, source: INBOUND_EMAIL)
          │
          ▼
[Recruiter Verification & Approval in Sourcing Workspace]
```

---

## 3. Metadata & Communication Links
When an inbound email is ingested:
- `source`: Stored as `INBOUND_EMAIL`.
- `sourceMetadata`: Contains:
  - `senderEmail`: Candidate email address.
  - `emailSubject`: Subject line.
  - `messageId`: RFC 2822 message ID.
  - `receivedAt`: ISO timestamp.
- The resume attachment is persisted to encrypted S3 storage (`storageBucket: "resumes"`).
- Candidate does not become active until approved by recruiter.
