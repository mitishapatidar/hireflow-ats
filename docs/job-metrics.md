# Job Live Metrics & "Filled This Month" Calculation

## Overview
The Jobs module computes live, real-time aggregate statistics displayed in the Figma Frame 04 metrics cards.

## Live Cards & Formulas

### 1. Open Jobs
- **Definition**: Active requisitions currently accepting candidates.
- **Formula**:
  ```ts
  prisma.job.count({
    where: {
      organizationId,
      status: 'ACTIVE',
      isArchived: false,
    },
  });
  ```

### 2. On Hold
- **Definition**: Requisitions placed on temporary hold.
- **Formula**:
  ```ts
  prisma.job.count({
    where: {
      organizationId,
      status: 'PAUSED',
      isArchived: false,
    },
  });
  ```

### 3. Filled This Month
- **Definition**: Headcount successfully filled during the current calendar month. Merely closing a job for budget cancellation or withdrawal does NOT count as filled.
- **Timezone Boundary**:
  - Month boundaries are computed using the agency's operational time zone (`Asia/Kolkata`, UTC+5:30) and translated to exact UTC query timestamps (`startUtc` to `endUtc`).
- **Formula**:
  A job counts as filled this month if within the current month's UTC range:
  1. An associated `Application` has a confirmed `Placement` created within `[startUtc, endUtc]`, OR
  2. The job has a `JobStatusHistory` transition where `newStatus = 'CLOSED'` and `reason = 'POSITION_FILLED'` created within `[startUtc, endUtc]`.
  ```ts
  prisma.job.count({
    where: {
      organizationId,
      OR: [
        {
          statusHistories: {
            some: {
              newStatus: 'CLOSED',
              reason: 'POSITION_FILLED',
              createdAt: { gte: startUtc, lte: endUtc },
            },
          },
        },
        {
          applications: {
            some: {
              placement: {
                createdAt: { gte: startUtc, lte: endUtc },
              },
            },
          },
        },
      ],
    },
  });
  ```

### 4. Total Mandates
- **Definition**: Total count of active or filtered job requisitions in the current view.
