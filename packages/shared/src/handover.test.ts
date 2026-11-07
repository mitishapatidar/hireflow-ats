import { describe, it, expect } from 'vitest';
import {
  CreateHandoverRequestSchema,
  ReviewHandoverRequestSchema,
  HandoverStatus,
  HandoverEntityType,
} from './handover';

describe('Handover Domain & Validation', () => {
  it('validates successful handover request with candidates, jobs, and tasks', () => {
    const input = {
      fromUserId: 'user-recruiter-1',
      toUserId: 'user-recruiter-2',
      candidateIds: ['cand-1', 'cand-2'],
      jobIds: ['job-1'],
      taskIds: ['task-10'],
      reason: 'Recruiter going on maternity leave',
      notes: 'Please prioritize job-1 client calls',
    };

    const parsed = CreateHandoverRequestSchema.safeParse(input);
    expect(parsed.success).toBe(true);
  });

  it('allows independent selection (only candidates, or only jobs, or only tasks)', () => {
    const onlyCandidates = {
      fromUserId: 'user-recruiter-1',
      toUserId: 'user-recruiter-2',
      candidateIds: ['cand-1'],
      jobIds: [],
      taskIds: [],
      reason: 'Rebalancing candidate pipeline',
    };
    expect(CreateHandoverRequestSchema.safeParse(onlyCandidates).success).toBe(true);

    const onlyJobs = {
      fromUserId: 'user-recruiter-1',
      toUserId: 'user-recruiter-2',
      candidateIds: [],
      jobIds: ['job-42'],
      taskIds: [],
      reason: 'Transferring engineering portfolio',
    };
    expect(CreateHandoverRequestSchema.safeParse(onlyJobs).success).toBe(true);
  });

  it('rejects handover request when no entities are selected', () => {
    const emptySelection = {
      fromUserId: 'user-recruiter-1',
      toUserId: 'user-recruiter-2',
      candidateIds: [],
      jobIds: [],
      taskIds: [],
      reason: 'No work selected',
    };
    const parsed = CreateHandoverRequestSchema.safeParse(emptySelection);
    expect(parsed.success).toBe(false);
  });

  it('rejects handover request if fromUserId and toUserId are identical', () => {
    const selfTransfer = {
      fromUserId: 'user-recruiter-1',
      toUserId: 'user-recruiter-1',
      candidateIds: ['cand-1'],
      jobIds: [],
      taskIds: [],
      reason: 'Self transfer',
    };
    const parsed = CreateHandoverRequestSchema.safeParse(selfTransfer);
    expect(parsed.success).toBe(false);
  });

  it('validates review actions', () => {
    expect(ReviewHandoverRequestSchema.safeParse({ action: 'APPROVE' }).success).toBe(true);
    expect(ReviewHandoverRequestSchema.safeParse({ action: 'REJECT', rejectionReason: 'Target recruiter is at max capacity' }).success).toBe(true);
    expect(ReviewHandoverRequestSchema.safeParse({ action: 'CANCEL' }).success).toBe(true);
    expect(ReviewHandoverRequestSchema.safeParse({ action: 'INVALID' }).success).toBe(false);
  });

  it('defines correct status and entity type enums', () => {
    expect(HandoverStatus.PENDING).toBe('PENDING');
    expect(HandoverStatus.APPROVED).toBe('APPROVED');
    expect(HandoverEntityType.CANDIDATE).toBe('CANDIDATE');
    expect(HandoverEntityType.JOB).toBe('JOB');
    expect(HandoverEntityType.TASK).toBe('TASK');
  });
});
