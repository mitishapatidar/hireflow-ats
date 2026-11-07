# Scheduled Client Reports (Frame 38)

## Overview
Scheduled Client Reports provide automated, branded periodic reporting directly to verified client contacts at specified cadences.

## Navigation & Access
- **Route**: `/reports/client-schedules`
- **Navigation**: Under Management navigation -> Client Schedules (`CalendarClock` icon)
- **Role Permissions**: Restricted to `MANAGER` and `ADMIN`.

## Features & Configurations
1. **Client Locking**:
   - Each schedule is strictly locked to a single client (`clientId`).
   - Cross-client data aggregation is structurally prevented.
2. **Verified Recipients Only**:
   - Recipient selection is strictly restricted to active, verified `ClientContact` records belonging to the selected client.
   - Arbitrary external email addresses are blocked.
3. **Flexible Cadence**:
   - `DAILY`: Dispatched every business morning (08:30 IST).
   - `WEEKLY`: Dispatched every Monday morning (08:30 IST).
   - `MONTHLY`: Dispatched on the 1st of every month (08:30 IST).
   - Times are configured and displayed in `Asia/Kolkata` (IST) and stored in UTC cron syntax.
4. **Allowed Content Sections**:
   - **Job Progress**: Status, open roles, total candidates screened and in pipeline.
   - **Submitted Profiles**: Profiles submitted to the client, submission date, current client status.
   - **Next Steps**: Scheduled interviews, upcoming rounds, pending client feedback.
5. **Interactive Controls**:
   - Live Email HTML Preview modal.
   - "Send Test Preview" button: sends an instantaneous test report to verified contacts without advancing the scheduled cron timer.
   - Activate / Pause toggle.
   - Full Delivery History table with status, delivery timestamp, recipient count, and retry button.
