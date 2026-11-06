# HireFlow ATS & Recruitment CRM — Client Document Management & Security

## 1. Overview

Enterprise recruitment relationships require strict governance over confidential legal contracts, Master Services Agreements (MSAs), role specifications, and fee proposals. The HireFlow document engine guarantees private storage, automatic versioning, signed short-lived downloads, and manager verification.

---

## 2. Storage & File Security Protocol

### A. Non-Traversable Private Storage
- Documents are never stored in public web paths.
- Uploads are processed through `StorageProvider` (`getStorageProvider()`), which assigns a cryptographically random storage key (`client-documents/${uuid}-${cleanFilename}`) within the isolated storage bucket.

### B. Magic Bytes & Format Verification
- All uploaded files are inspected using `validateFileSecurity(buffer, filename, mimeType)`.
- Rejects dangerous file extensions (e.g. `.exe`, `.sh`, `.bat`, `.js`, `.vbs`) and verifies binary signatures for supported types (PDF `%PDF-`, DOCX/ZIP `PK\x03\x04`).
- Strict 10MB size ceiling.

---

## 3. Document Versioning

When a new file is uploaded with the same filename as an existing document for that client:
```ts
const lastVersion = await prisma.clientDocument.findFirst({
  where: { clientId, fileName: file.name },
  orderBy: { version: 'desc' },
  select: { version: true },
});
const nextVersion = lastVersion ? lastVersion.version + 1 : 1;
```
- Old versions are never overwritten or deleted.
- Version history is displayed in the Documents tab (`v1`, `v2`, `v3`...).

---

## 4. Verification Workflow

Legal agreements and commercial proposals require explicit verification by agency leadership before being marked active for placements:
1. Newly uploaded documents start in `isVerified: false` state with an amber **Unverified** badge.
2. An authorized user (`ADMIN` or `MANAGER`) reviews the agreement and clicks **Verify**.
3. The server executes:
   ```ts
   await prisma.clientDocument.update({
     where: { id: docId },
     data: {
       isVerified: true,
       verifiedById: user.id,
       verifiedAt: new Date(),
     },
   });
   ```
4. Displays green **✓ Verified** badge with reviewer name and verification timestamp.
5. Action is recorded in `AuditLog` with before/after state.

---

## 5. Short-Lived Signed Download URLs

- Document endpoints and Server Actions never return static public URLs.
- When an authorized recruiter or administrator clicks **Download**:
  ```ts
  const signedUrl = await storage.getSignedUrl(doc.storageKey, 900); // 15 minutes
  ```
- The download link expires automatically after 15 minutes, preventing link forwarding or unauthorized leakage.
