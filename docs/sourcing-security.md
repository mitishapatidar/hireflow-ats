# HireFlow ATS — Sourcing Security & Compliance Documentation

**Module:** Sourcing & Ingestion (Prompt 20)  
**Security Scope:** Bulk Import, Duplicate Review, Chrome Extension, Sourcing Queue  
**Tenant:** Aureva Capital Private Limited  

---

## 1. Zero-Trust Access Control & Route Guarding

### Role Matrix
| Feature / Route | `ADMIN` | `MANAGER` | `RECRUITER` | `CLIENT` | `CANDIDATE` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Sourcing Workspace** (`/sourcing`) | Allowed | Allowed | Allowed | **403 Forbidden** | **403 Forbidden** |
| **Bulk Resume Import** (`/sourcing/import`) | Allowed | Allowed | Allowed | **403 Forbidden** | **403 Forbidden** |
| **Duplicate Review** (`/sourcing/duplicates`) | Allowed | Allowed | Allowed | **403 Forbidden** | **403 Forbidden** |
| **Candidate Merge** (`/api/sourcing/merges`) | Allowed | Allowed | Allowed | **403 Forbidden** | **403 Forbidden** |
| **Extension Token Issuance** | Allowed | Allowed | Allowed | **403 Forbidden** | **403 Forbidden** |
| **Provider Credentials Config** | Allowed | Allowed | Forbidden | **403 Forbidden** | **403 Forbidden** |

---

## 2. ATS Security Commandments Applied to Sourcing

1. **No Automatic Candidate Creation:** Sourced items remain in `SourcingItem` or `ImportItem` until explicit human approval creates the `Candidate` record.
2. **Never Hard Delete During Merge:** Candidate merging soft-archives secondary profiles (`isArchived: true, isMerged: true, mergedIntoCandidateId: master.id`). No applications, notes, or documents are discarded.
3. **Short-Lived Extension Tokens:** Chrome extension does not use passwords or permanent API keys. Tokens expire strictly after 15 minutes (`ExtensionCaptureToken`).
4. **DOM Extraction Sanitization:** All text scraped via extension is stripped of `<script>`, `<style>`, and raw HTML before ingestion.
5. **Job Board Credential Encryption:** External API secrets are encrypted at rest using AES-256-GCM.
6. **Immutable Audit Logging:** Every batch creation, cancellation, item review, candidate merge, extension clip, and duplicate resolution writes to `AuditLog`.
