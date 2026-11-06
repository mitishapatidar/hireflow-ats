# Sales CRM & Mandate Pipeline

**Module:** Sales CRM & Mandate Management  
**Playbook Phase:** Phase 1 — Prompt 15  
**Figma Reference:** Frame 23 — Sales Opportunities & Meetings  
**Route:** `/sales`  
**Tenant:** Aureva Capital Private Limited  

## 1. Overview

The Sales CRM module enables recruiters, business development managers, and agency administrators to track prospective clients, manage sales opportunities, coordinate client discovery meetings, and convert won mandates directly into active client accounts and draft job requisitions.

## 2. Key Capabilities

- **Sales Pipeline Kanban**: 4-stage Kanban board displaying opportunities across `PROSPECTING`, `MEETING`, `PROPOSAL`, and `WON`, with support for archiving and filtering `LOST` deals.
- **Financial & Mandate Summary**: Real-time aggregated pipeline value formatted in Indian Rupees (INR ₹) and active opportunity counts.
- **Client Discovery Meetings**: Dedicated meeting scheduler and tracker supporting duration, contact alignment, next action items, and IST meeting slots.
- **Transactional Job Conversion**: Atomic database conversion of won opportunities into active `Client` records and `DRAFT` status `Job` records.
- **Audit History**: Every stage movement, new meeting, and opportunity creation generates an immutable `OpportunityHistory` and `AuditLog` entry.

## 3. Architecture

- **Backend Route**: Fastify plugin `/api/sales` with role guards restricting access to internal staff (`RECRUITER`, `MANAGER`, `ADMIN`).
- **Next.js Server Actions**: `apps/web/src/actions/sales.ts`.
- **Client View**: `apps/web/src/components/sales/SalesCrmClientView.tsx`.
- **Domain Logic**: `@hireflow/shared/src/sales.ts` enforcing state transitions, anti-leak serialization, and Zod input validation schemas.
