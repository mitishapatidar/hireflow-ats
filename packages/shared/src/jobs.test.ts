import { describe, it, expect } from 'vitest';
import {
  generateJobCode,
  isValidJobStatusTransition,
  canJobAcceptApplications,
  getCurrentMonthDateRange,
  JobStatus,
  EmploymentType,
  CreateJobInputSchema,
  CreateJobRoundSchema,
  ReorderJobRoundsSchema,
  CreateReassignmentRequestSchema,
  serializeJob,
} from './jobs';
import { UserRole } from './roles';

describe('Prompt 10: Jobs & Job Lifecycle Shared Module', () => {
  describe('generateJobCode', () => {
    it('generates J-201 when no existing codes are provided', () => {
      expect(generateJobCode([])).toBe('J-201');
    });

    it('generates next sequential code after J-208', () => {
      const existing = ['J-201', 'J-202', 'J-203', 'J-204', 'J-205', 'J-206', 'J-207', 'J-208'];
      expect(generateJobCode(existing)).toBe('J-209');
    });

    it('handles unordered and non-standard codes correctly', () => {
      const existing = ['J-205', 'OTHER-1', 'j-212', null as any, ''];
      expect(generateJobCode(existing)).toBe('J-213');
    });
  });

  describe('isValidJobStatusTransition State Machine', () => {
    it('allows direct activation from DRAFT to ACTIVE when approval is not required (default)', () => {
      const res = isValidJobStatusTransition(JobStatus.DRAFT, JobStatus.ACTIVE, false);
      expect(res.valid).toBe(true);
    });

    it('blocks direct activation from DRAFT to ACTIVE when requireJobApproval is true', () => {
      const res = isValidJobStatusTransition(JobStatus.DRAFT, JobStatus.ACTIVE, true);
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('approval is required');
    });

    it('allows DRAFT to PENDING_APPROVAL when approval is required', () => {
      const res = isValidJobStatusTransition(JobStatus.DRAFT, JobStatus.PENDING_APPROVAL, true);
      expect(res.valid).toBe(true);
    });

    it('allows ACTIVE to PAUSED and ACTIVE to CLOSED', () => {
      expect(isValidJobStatusTransition(JobStatus.ACTIVE, JobStatus.PAUSED).valid).toBe(true);
      expect(isValidJobStatusTransition(JobStatus.ACTIVE, JobStatus.CLOSED).valid).toBe(true);
      expect(isValidJobStatusTransition(JobStatus.ACTIVE, JobStatus.DRAFT).valid).toBe(false);
    });

    it('allows PAUSED to ACTIVE (resume) and PAUSED to CLOSED', () => {
      expect(isValidJobStatusTransition(JobStatus.PAUSED, JobStatus.ACTIVE).valid).toBe(true);
      expect(isValidJobStatusTransition(JobStatus.PAUSED, JobStatus.CLOSED).valid).toBe(true);
      expect(isValidJobStatusTransition(JobStatus.PAUSED, JobStatus.PENDING_APPROVAL).valid).toBe(false);
    });

    it('allows CLOSED to ACTIVE (reopen)', () => {
      expect(isValidJobStatusTransition(JobStatus.CLOSED, JobStatus.ACTIVE).valid).toBe(true);
      expect(isValidJobStatusTransition(JobStatus.CLOSED, JobStatus.DRAFT).valid).toBe(true);
      expect(isValidJobStatusTransition(JobStatus.CLOSED, JobStatus.PAUSED).valid).toBe(false);
    });

    it('rejects self-transitions', () => {
      expect(isValidJobStatusTransition(JobStatus.ACTIVE, JobStatus.ACTIVE).valid).toBe(false);
      expect(isValidJobStatusTransition(JobStatus.DRAFT, JobStatus.DRAFT).valid).toBe(false);
    });
  });

  describe('canJobAcceptApplications', () => {
    it('only permits ACTIVE jobs to accept candidate applications', () => {
      expect(canJobAcceptApplications(JobStatus.ACTIVE)).toBe(true);
      expect(canJobAcceptApplications(JobStatus.PAUSED)).toBe(false);
      expect(canJobAcceptApplications(JobStatus.CLOSED)).toBe(false);
      expect(canJobAcceptApplications(JobStatus.DRAFT)).toBe(false);
      expect(canJobAcceptApplications(JobStatus.PENDING_APPROVAL)).toBe(false);
    });
  });

  describe('getCurrentMonthDateRange', () => {
    it('returns a valid UTC date range for Asia/Kolkata', () => {
      const { startUtc, endUtc } = getCurrentMonthDateRange('Asia/Kolkata');
      expect(startUtc instanceof Date).toBe(true);
      expect(endUtc instanceof Date).toBe(true);
      expect(startUtc.getTime()).toBeLessThan(endUtc.getTime());
    });
  });

  describe('Zod Schemas', () => {
    it('validates valid CreateJobInput', () => {
      const input = {
        title: 'Senior Fullstack Engineer',
        clientId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        openings: 2,
        employmentType: EmploymentType.FULL_TIME,
        salaryMin: 1200000,
        salaryMax: 1800000,
        assignedRecruiterIds: [],
      };
      const parsed = CreateJobInputSchema.safeParse(input);
      expect(parsed.success).toBe(true);
    });

    it('rejects salaryMax < salaryMin in CreateJobInput', () => {
      const input = {
        title: 'Senior Engineer',
        clientId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        salaryMin: 2000000,
        salaryMax: 1500000,
        assignedRecruiterIds: [],
      };
      const parsed = CreateJobInputSchema.safeParse(input);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.errors[0]?.message).toContain('Maximum salary must be greater');
      }
    });

    it('validates CreateJobRoundSchema and ReorderJobRoundsSchema', () => {
      const roundInput = {
        name: 'Technical Screening',
        roundOrder: 1,
        interviewType: 'VIDEO',
        durationMinutes: 45,
        panelMembers: ['Tech Lead'],
      };
      expect(CreateJobRoundSchema.safeParse(roundInput).success).toBe(true);

      const reorderInput = {
        roundIds: [
          'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
          'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        ],
      };
      expect(ReorderJobRoundsSchema.safeParse(reorderInput).success).toBe(true);
    });

    it('validates CreateReassignmentRequestSchema requiring at least 5 chars reason', () => {
      expect(CreateReassignmentRequestSchema.safeParse({ reason: 'abc' }).success).toBe(false);
      expect(
        CreateReassignmentRequestSchema.safeParse({
          reason: 'Workload capacity limit reached',
        }).success
      ).toBe(true);
    });
  });

  describe('serializeJob Anti-Leak Security', () => {
    const rawJob = {
      id: 'job-1',
      code: 'J-201',
      title: 'DevOps Lead',
      clientId: 'client-1',
      client: { legalName: 'Acme Corp', code: 'CL-1001' },
      ownerId: 'user-recruiter-1',
      owner: { name: 'Recruiter Bob', email: 'bob@example.com' },
      hiringManagerContactId: 'hm-1',
      hiringManagerContact: { name: 'Alice Manager', email: 'alice@acme.com' },
      openings: 1,
      salaryMin: 1500000,
      salaryMax: 2000000,
      status: 'ACTIVE',
      closingReason: null,
      closingNote: 'Client cancelled budget unexpectedly',
      pauseReason: 'Client review',
      resumeReason: 'Approved to resume',
      reopenReason: null,
      isArchived: false,
      createdAt: new Date('2026-11-01T10:00:00Z'),
      updatedAt: new Date('2026-11-01T10:00:00Z'),
      applications: [{ id: 'app-1' }],
      assignments: [
        {
          id: 'asg-1',
          recruiterId: 'user-recruiter-1',
          recruiter: { name: 'Recruiter Bob', email: 'bob@example.com' },
          assignedById: 'user-admin',
          assignedBy: { name: 'Admin Jane' },
          status: 'ACTIVE',
          createdAt: new Date('2026-11-01T10:00:00Z'),
        },
      ],
      statusHistories: [
        {
          id: 'hist-1',
          previousStatus: 'DRAFT',
          newStatus: 'ACTIVE',
          changedById: 'user-admin',
          note: 'Direct activation',
          createdAt: new Date('2026-11-01T10:00:00Z'),
        },
      ],
    };

    it('includes internal details for RECRUITER', () => {
      const dto = serializeJob(rawJob, UserRole.RECRUITER);
      expect(dto.closingNote).toBe('Client cancelled budget unexpectedly');
      expect(dto.assignments).toBeDefined();
      expect(dto.assignments?.length).toBe(1);
      expect(dto.statusHistories).toBeDefined();
      expect(dto.ownerEmail).toBe('bob@example.com');
    });

    it('masks internal details for CLIENT and CANDIDATE', () => {
      const clientDto = serializeJob(rawJob, UserRole.CLIENT);
      expect(clientDto.closingNote).toBeNull();
      expect(clientDto.assignments).toBeUndefined();
      expect(clientDto.statusHistories).toBeUndefined();
      expect(clientDto.ownerEmail).toBeNull();

      const candDto = serializeJob(rawJob, UserRole.CANDIDATE);
      expect(candDto.closingNote).toBeNull();
      expect(candDto.assignments).toBeUndefined();
      expect(candDto.statusHistories).toBeUndefined();
    });
  });
});
