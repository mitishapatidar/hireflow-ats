# HireFlow ATS — Chrome Extension (Manifest V3) Documentation

**Package:** `apps/extension` (`@hireflow/extension`)  
**Specification:** Google Chrome Manifest V3  
**Tenant:** Aureva Capital Private Limited  

---

## 1. Overview
The HireFlow Chrome Extension enables recruiters to clip candidate profiles from supported platforms (LinkedIn, Naukri, Foundit, and generic web pages) directly into the HireFlow Sourcing Workspace.

### Security & Privacy Commandments
1. **Visible DOM Extraction Only:** The extension parses only text visible to the recruiter in their browser viewport.
2. **Zero Background Scraping:** No automated site scraping, recursive link harvesting, or automated pagination.
3. **No Credential Access:** The extension **never** accesses browser cookies, session tokens of target websites, or stored passwords.
4. **No Direct Candidate Creation:** Clips are ingested into `SourcingItem` in status `PENDING_REVIEW`.

---

## 2. Manifest V3 Configuration (`apps/extension/manifest.json`)

```json
{
  "manifest_version": 3,
  "name": "HireFlow ATS Sourcing Clipper",
  "version": "1.0.0",
  "action": {
    "default_popup": "src/popup/index.html"
  },
  "background": {
    "service_worker": "src/background/service-worker.js",
    "type": "module"
  },
  "permissions": ["activeTab", "storage", "alarms"],
  "host_permissions": [
    "https://*.linkedin.com/*",
    "https://*.naukri.com/*",
    "https://*.foundit.in/*",
    "http://localhost:*/*"
  ]
}
```

---

## 3. Short-Lived Capture Token Authentication (`ExtensionCaptureToken`)

To authenticate without exposing persistent user passwords or long-lived JWTs:
1. Recruiter clicks **Chrome Clipper** in the HireFlow Web Sourcing Workspace (`/sourcing`).
2. Server generates a cryptographically random, high-entropy capture token:
   $$\text{Token: } \texttt{hfe\_[64 hex chars]}$$
3. Server stores SHA-256 hash in `ExtensionCaptureToken` with a **15-minute Time-To-Live (TTL)**:
   ```prisma
   model ExtensionCaptureToken {
     id             String    @id @default(uuid())
     organizationId String
     userId         String
     tokenHash      String    @unique
     expiresAt      DateTime
     revokedAt      DateTime?
     lastUsedAt     DateTime?
   }
   ```
4. Recruiter pastes the token into the extension popup.
5. Service worker and popup store the token in `chrome.storage.local`.
6. Requests to `POST /api/sourcing/extension/capture` include:
   $$\text{Authorization: Bearer } \texttt{hfe\_...}$$
7. Server validates hash and expiration (`expiresAt > now()`). If expired, returns `401 Unauthorized` and prompts re-authentication.

---

## 4. DOM Profile Extractor (`apps/extension/src/content/extractor.ts`)

- **Sanitization:** Strips `<script>`, `<style>`, and raw HTML tags.
- **Naukri Profiler:** Extracts `.cand-name`, `.current-desig`, `.current-company`, `.location`, `.key-skills .chip`, `.total-exp`.
- **Foundit Profiler:** Extracts `.candidate-name`, `.designation`, `.company-name`, `.skill-tag`.
- **LinkedIn Profiler:** Extracts `h1.text-heading-xlarge`, `.text-body-medium`, location, and skills tags.
- **Contact Detection:** Regular expression fallbacks for visible Indian phone numbers (`+91...`) and email addresses.
