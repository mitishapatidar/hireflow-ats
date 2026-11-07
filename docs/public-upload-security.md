# HireFlow ATS & Recruitment CRM — Public Upload Security

## 1. Overview
Public file uploads represent a primary threat vector for malicious payload injection, malware propagation, and Denial of Service (DoS). This document details the defense-in-depth security model protecting the HireFlow ATS public careers endpoints.

---

## 2. File Verification & Upload Guardrails

Every file submitted via `POST /api/public/careers/upload` or Server Action undergoes strict sequential validation:

### A. Strict Size Thresholds
- **Maximum File Size**: 10 Megabytes (`10 * 1024 * 1024` bytes).
- Uploads exceeding this threshold are immediately rejected with HTTP 400 (`File size exceeds 10MB limit`).

### B. Extension Whitelisting
- Only `.pdf`, `.docx`, and `.doc` extensions are permitted.
- Double extensions (e.g., `resume.pdf.exe`) are explicitly stripped and blocked.

### C. Magic Byte Inspection
MIME types declared in HTTP headers are untrusted. The binary content is inspected for authentic magic bytes:
- **PDF**: `%PDF-` (`0x25 0x50 0x44 0x46 0x2D`)
- **DOCX**: `PK\x03\x04` (`0x50 0x4B 0x03 0x04` — Zip container format)
- **DOC**: `\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1` (Compound File Binary format)

Uploads with mismatched MIME/content are rejected immediately with `Invalid file signature`.

---

## 3. Antivirus & Malware Scanning Hooks

The public upload workflow integrates with `getAntivirusScanner()`:
- **Interface**:
  ```typescript
  interface AntivirusScanner {
    scanBuffer(buffer: Buffer, filename: string): Promise<{ isClean: boolean; threatName?: string }>;
  }
  ```
- **Execution Hook**: All uploaded binary buffers are scanned prior to storage persistence.
- **Action on Detection**:
  - Malicious files are immediately rejected.
  - An audit warning is logged with the threat identifier.
  - The file is purged from memory and never written to disk or object storage.

---

## 4. Cryptographic Storage Isolation

- **Storage Key Generation**:
  - Uploaded files are **never** stored using client-provided filenames.
  - A cryptographically random UUID v4 or v7 is generated: `resumes/${crypto.randomUUID()}.${ext}`.
  - Example: `resumes/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d.pdf`.
- **Private Bucket Isolation**:
  - Files are written to the private, non-public `resumes` storage bucket.
  - Public HTTP access is blocked; candidate resumes can only be accessed by authenticated recruiters via signed URLs with 15-minute expirations.

---

## 5. Anti-Abuse & Rate Limiting

1. **Honeypot Trap**:
   - The application form includes a hidden input `website_url_hp` positioned offscreen with `tabIndex={-1}` and `aria-hidden="true"`.
   - Legitimate applicants never fill this input. Automated bots filling this field are silently rejected with HTTP 400 without triggering processing or database overhead.
2. **CAPTCHA Provider Hook**:
   - `MockCaptchaProvider` validates `captchaToken`. In production environments, this delegates to Cloudflare Turnstile or Google reCAPTCHA Enterprise.
3. **Draft Cleanup**:
   - Application drafts have a strict 30-day TTL to prevent unbounded database growth.
