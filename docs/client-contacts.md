# HireFlow ATS & Recruitment CRM — Client Contacts & Portal Access

## 1. Overview

Client contacts represent the business stakeholders at client corporations—including hiring managers, heads of talent, technical interview leads, and billing administrators.

Model: `ClientContact` (Prisma)
- Associated with a single `Client` (`clientId`).
- Fields: `name`, `designation`, `email`, `phone`, `contactType`, `isPrimary`, `createdById`.

---

## 2. Primary Contact Management

- A client account can have multiple contacts, but only **one primary contact** at any given time.
- **Atomic Transition:** When setting `isPrimary: true` on creation or update, the system executes an atomic transaction in Prisma:
  ```ts
  await tx.clientContact.updateMany({
    where: { clientId, isPrimary: true },
    data: { isPrimary: false },
  });
  await tx.clientContact.create({
    data: { clientId, isPrimary: true, ... },
  });
  ```
- The primary contact is automatically surfaced on the Clients CRM landing table (Figma Frame 09) and in client summary DTOs.

---

## 3. Integration with Prompt 6 Client Portal Access (`ClientAccess`)

HireFlow distinguishes between **CRM contact directories** and **authenticated Client Portal accounts**:
- A hiring manager can exist as a contact without having portal credentials.
- In Prompt 6, the `ClientAccess` model was established to link authenticated `User` accounts (with `UserRole.CLIENT`) to specific `Client` records.

### Portal Access Resolution Algorithm:
When fetching client contacts:
1. Extract all contact emails for the client.
2. Query `prisma.user` for matching emails having `role: 'CLIENT'` and an active link in `clientAccesses`:
   ```ts
   const portalUsers = await prisma.user.findMany({
     where: {
       email: { in: contactEmails },
       role: UserRole.CLIENT,
       clientAccesses: { some: { clientId, status: 'ACTIVE' } },
     },
     select: { id: true, email: true, status: true },
   });
   ```
3. Map to contact DTO:
   - `hasPortalAccess: true` if an active portal user exists.
   - `portalUserId: string | null`
   - `portalUserStatus: string | null`

### UI Visualization:
- **Active:** Emerald pill `● Portal Access Active` with checkmark icon.
- **Inactive:** Slate pill `○ No Portal Access`.
- Prevents duplication of portal access credentials and ensures seamless coordination between agency recruiters and external client users.
