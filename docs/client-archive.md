# HireFlow ATS & Recruitment CRM — Client Soft-Archive & Non-Destructive Retention

## 1. Statutory ATS Principle: Never Hard Delete

In enterprise ATS and CRM software, client corporate entities maintain historical links to job requisitions, candidate submissions, candidate interview notes, and fee billings. 

**PERMANENT HARD DELETION IS STRICTLY PROHIBITED.**

Instead, HireFlow implements a non-destructive **Soft-Archive and Restore lifecycle**.

---

## 2. Schema Architecture & Governance

The `Client` table incorporates the following governance attributes:
- `isArchived`: Boolean flag (indexed, default `false`).
- `archivedAt`: Timestamp marking when archival took place.
- `archiveReason`: Mandatory textual explanation detailing why the client relationship was suspended or archived.

---

## 3. Mandatory Archival Protocol

1. **Permission Check:** Archival is restricted strictly to users with the `ADMIN` role.
2. **Mandatory Reason Requirement:**
   - Both client-side forms and server-side validation (`ArchiveClientSchema`) enforce a non-empty explanation of at least 3 characters.
   - Example reasons: *"Account merged into parent enterprise"*, *"Temporary hiring freeze during H2"*, *"Contract ended after successfully filling all mandates"*.
3. **Execution & Event Auditing:**
   ```ts
   await prisma.client.update({
     where: { id },
     data: {
       isArchived: true,
       archivedAt: new Date(),
       archiveReason: reason.trim(),
     },
   });
   await logClientEvent(adminUser.id, 'CLIENT_ARCHIVED', id, { isArchived: false }, { isArchived: true, reason });
   ```
4. **Referential Integrity:** Existing jobs, candidate placement records, documents, and historical notes remain completely intact.

---

## 4. Restoration Lifecycle

An administrator can restore an archived client to active status at any time:
1. Click **Restore Client** in the client table menu or on the client record header.
2. The server executes:
   ```ts
   await prisma.client.update({
     where: { id },
     data: {
       isArchived: false,
       archivedAt: null,
       archiveReason: null,
     },
   });
   ```
3. A `CLIENT_RESTORED` event is logged to the audit table.
4. The client immediately reappears in active pipeline filters and statistics cards.
