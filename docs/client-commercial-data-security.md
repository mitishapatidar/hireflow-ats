# HireFlow ATS & Recruitment CRM — Commercial Data Security & Isolation

## 1. Core Security Principle & Compliance Requirement

In an agency recruitment model, commercial contract details—such as placement fee percentages (e.g. `18.5%`), payment terms (`NET_30`), replacement guarantee periods, and internal margin notes—represent sensitive proprietary business intelligence.

**MANDATORY ATS COMMANDMENT:**
> Under no circumstances may client commercial terms, fee percentages, payment terms, or internal relationship notes be exposed in generic Client responses, Candidate responses, Client Portal views, or nested candidate application queries.

---

## 2. Multi-Layer Defense Architecture

### Layer 1: Strict Response DTO Serialization
Commercial fields are completely removed from standard client DTO definitions:
- `ClientSummaryDTO` (used for `/clients` directory): Contains `id`, `code`, `legalName`, `industry`, `location`, `status`, `primaryContact`, `openJobsCount`, `relationshipOwner`. Zero commercial fields.
- `ClientDetailDTO` (used for `/clients/[id]` header & tabs): Zero commercial fields.

### Layer 2: Dedicated, Authorized Commercial Endpoint
Commercial terms are accessible only through a dedicated, protected endpoint and Server Action:
- Fastify: `GET /api/clients/:id/commercial` & `PATCH /api/clients/:id/commercial`
- Server Action: `getClientCommercialAction(id)` & `updateClientCommercialAction(id, input)`

### Layer 3: Role-Based Authorization Engine
1. **ADMIN Role:** Full read and write permissions. Can edit fee percentages, payment terms, and relationship notes.
2. **MANAGER Role:** Read-only access for pipeline and budget reviews.
3. **RECRUITER Role:** Read access granted ONLY if the user has `user.grants?.recruiterViewInternalFees === true`.
4. **CLIENT Role:** **HTTP 403 Forbidden**. Client hiring managers can never inspect agency margin structures.
5. **CANDIDATE Role:** **HTTP 403 Forbidden**. Candidates are blocked from all client CRM and commercial endpoints.

---

## 3. Automated Security Contract Verification

The codebase includes automated contract tests in `apps/api/src/routes/clients.test.ts` and `packages/shared/src/clients.test.ts`:
```ts
it('CONTRACT TEST: GET /api/clients summary DTO NEVER leaks commercial fee fields', async () => {
  const res = await server.inject({
    method: 'GET',
    url: '/api/clients',
    headers: { authorization: `Bearer ${adminToken}` },
  });
  const data = res.json();
  for (const client of data.clients) {
    expect(client.feePercentage).toBeUndefined();
    expect(client.commercialTerms).toBeUndefined();
    expect(client.paymentTerms).toBeUndefined();
    expect(client.relationshipNotes).toBeUndefined();
  }
});
```
These automated tests run on every pull request and build, preventing regression or inadvertent data leaks.
