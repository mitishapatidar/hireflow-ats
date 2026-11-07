# Client Report Delivery Engine

## Overview
The Client Report Delivery Engine (`apps/api/src/queue/client-report-queue.ts`) is built on BullMQ and Redis to execute scheduled client report dispatches reliably and idempotently.

## Architecture & Queue Setup
- **Queue Name**: `client-report-delivery`
- **Worker Configuration**:
  - Concurrency: 5 parallel workers.
  - Exponential backoff retry strategy with 3 attempts.
  - Job idempotency key derived from `scheduleId + deliveryDate` to prevent duplicate emails.
- **Repeatable Schedules**:
  - Powered by BullMQ's repeatable job mechanism using cron expressions in `Asia/Kolkata`.

## Execution Pipeline
1. **Trigger**:
   - Repeatable BullMQ cron fires or user clicks "Retry Delivery" / "Send Test".
2. **Delivery Record Creation**:
   - An initial `ClientReportDelivery` row is inserted with status `PENDING` and UTC timestamp.
3. **Delivery-Time Authorization Recheck**:
   - Executes the mandatory 13-point security verification before compiling email content.
4. **Data Aggregation**:
   - Calls `fetchClientReportData` to fetch only client-safe fields for the client's jobs, submissions, and interviews.
5. **Branded HTML Generation**:
   - Compiles a modern, responsive HTML email matching HireFlow and Aureva Capital branding.
   - Embeds clean summary tables for Job Progress, Submitted Profiles, and Next Steps.
6. **Provider Dispatch**:
   - Sends email via the configured email provider (Resend, SendGrid, or Mock Provider in test environments).
7. **Status Update & Audit**:
   - Marks `ClientReportDelivery` as `DELIVERED` or `FAILED` (with error message).
   - Updates `lastDeliveredAt` and `nextDeliveryAt` on `ClientReportSchedule`.
