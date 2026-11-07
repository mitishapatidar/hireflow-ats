/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod';

export enum HandoverStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum HandoverEntityType {
  CANDIDATE = 'CANDIDATE',
  JOB = 'JOB',
  TASK = 'TASK',
}

export const CreateHandoverRequestSchema = z.object({
  fromUserId: z.string().min(1, 'Source recruiter ID is required'),
  toUserId: z.string().min(1, 'Destination recruiter ID is required'),
  candidateIds: z.array(z.string()).default([]),
  jobIds: z.array(z.string()).default([]),
  taskIds: z.array(z.string()).default([]),
  reason: z.string().min(3, 'A valid reason for handover is required'),
  notes: z.string().optional().nullable(),
}).refine(
  data => data.candidateIds.length > 0 || data.jobIds.length > 0 || data.taskIds.length > 0,
  {
    message: 'At least one candidate, job, or task must be selected for handover',
    path: ['candidateIds'],
  }
).refine(
  data => data.fromUserId !== data.toUserId,
  {
    message: 'Source and destination recruiters must be different',
    path: ['toUserId'],
  }
);

export type CreateHandoverRequestInput = z.infer<typeof CreateHandoverRequestSchema>;

export const ReviewHandoverRequestSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'CANCEL']),
  rejectionReason: z.string().optional().nullable(),
});

export type ReviewHandoverRequestInput = z.infer<typeof ReviewHandoverRequestSchema>;
