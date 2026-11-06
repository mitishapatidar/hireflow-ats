# Opportunity Conversion to Job Mandate

**Module:** Sales CRM & Job Creation  
**Playbook Phase:** Phase 1 — Prompt 15  
**Figma Reference:** Frame 23 — Sales Opportunities & Meetings  

## 1. Objective

When a sales opportunity reaches the `WON` stage, recruiters can convert it directly into an active client relationship and instantiate a job mandate requisition.

## 2. Strict ATS Status Rule: Mandatory DRAFT

> [!IMPORTANT]
> **Converted jobs must ALWAYS be created with `status: 'DRAFT'`.**  
> Under no circumstances may a converted job automatically become `ACTIVE`. Jobs require explicit recruiter/manager assignment and round configuration before candidate sourcing commences.

## 3. Prerequisite Validations

Before executing conversion, `validateOpportunityConversionPrerequisites()` verifies:
1. **Stage Check**: Opportunity stage must be `WON`.
2. **Duplicate Conversion Prevention**: `convertedJobId` must be null.
3. **Contact Verification**: Primary contact name and valid email must exist.
4. **Commercial Terms**: Fee percentage (positive decimal, typically 8.33% to 25%) and payment terms (`NET_15`, `NET_30`, etc.) must be defined.
5. **Job Parameters**: Job title, openings (>= 1), location, and recruiter owner ID must be assigned.

## 4. Transactional Workflow

Conversion executes within an atomic database transaction (`prisma.$transaction`):

1. **Client Account Creation / Linking**:
   - If `opportunity.clientId` is null, a new `Client` record is generated with sequential client code `CL-100X` (e.g., `CL-1005`).
   - Status is set to `ACTIVE`, and a primary `ClientContact` record is created.
2. **Sequential Job Code Generation**:
   - The system finds the latest job code (`J-20X`) and increments it sequentially (e.g., `J-209`).
3. **Draft Job Creation**:
   - `status` set to `'DRAFT'`.
   - `clientId`, `ownerId`, `openings`, `location`, `employmentType`, and `description` are assigned.
4. **Opportunity Linkage**:
   - `Opportunity.convertedJobId` is set to the created job's ID.
   - `Opportunity.convertedAt` and `Opportunity.convertedById` are recorded.
5. **Audit Logging**:
   - `OpportunityHistory` logs `CONVERTED_TO_JOB`.
   - `AuditLog` writes `CONVERT_OPPORTUNITY_TO_JOB`.
