import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PIPELINE_STAGES,
  DEFAULT_REJECTION_REASONS,
  TransitionApplicationStageSchema,
  RejectApplicationSchema,
  AddCandidateToJobSchema,
  CreateApplicationNoteSchema,
  canTransitionApplicationStage,
  serializePipelineCard,
  ApplicationStatus,
  JobStatus,
} from './pipeline';
import { UserRole } from './roles';

describe('Job Pipeline Shared Logic & Validation (Prompt 11)', () => {
  describe('Constants & Default Definitions', () => {
    it('defines 8 ordered default pipeline stages', () => {
      expect(DEFAULT_PIPELINE_STAGES).toHaveLength(8);
      expect(DEFAULT_PIPELINE_STAGES[0].name).toBe('Sourced');
      expect(DEFAULT_PIPELINE_STAGES[7].name).toBe('Rejected');

      // Verify strict sequential ordering 1..8
      DEFAULT_PIPELINE_STAGES.forEach((st, idx) => {
        expect(st.order).toBe(idx + 1);
      });
    });

    it('defines standard recruitment rejection reasons', () => {
      expect(DEFAULT_REJECTION_REASONS.length).toBeGreaterThanOrEqual(8);
      const codes = DEFAULT_REJECTION_REASONS.map((r) => r.code);
      expect(codes).toContain('SKILLS_MISMATCH');
      expect(codes).toContain('SALARY_EXPECTATION');
      expect(codes).toContain('NOTICE_PERIOD');
      expect(codes).toContain('OTHER');
    });
  });

  describe('Zod Validation Schemas', () => {
    it('validates TransitionApplicationStageSchema', () => {
      const valid = TransitionApplicationStageSchema.parse({
        targetStageId: 'stage-technical',
        comments: 'Passed preliminary screening',
      });
      expect(valid.targetStageId).toBe('stage-technical');

      expect(() =>
        TransitionApplicationStageSchema.parse({ targetStageId: '' })
      ).toThrow();
    });

    it('validates RejectApplicationSchema with mandatory reason and feedback', () => {
      const valid = RejectApplicationSchema.parse({
        rejectionReasonId: 'SKILLS_MISMATCH',
        rejectionFeedback: 'Candidate does not have sufficient Next.js architecture experience.',
      });
      expect(valid.rejectionReasonId).toBe('SKILLS_MISMATCH');

      // Fails when feedback is too short
      expect(() =>
        RejectApplicationSchema.parse({
          rejectionReasonId: 'SKILLS_MISMATCH',
          rejectionFeedback: 'no',
        })
      ).toThrow();

      // Fails when rejection reason is missing
      expect(() =>
        RejectApplicationSchema.parse({
          rejectionReasonId: '',
          rejectionFeedback: 'Valid feedback text here',
        })
      ).toThrow();
    });

    it('validates AddCandidateToJobSchema', () => {
      const valid = AddCandidateToJobSchema.parse({
        candidateId: 'cand-123',
        initialStageId: 'stage-sourced',
      });
      expect(valid.candidateId).toBe('cand-123');

      expect(() =>
        AddCandidateToJobSchema.parse({ candidateId: '' })
      ).toThrow();
    });

    it('validates CreateApplicationNoteSchema', () => {
      const valid = CreateApplicationNoteSchema.parse({
        content: 'Solid communication during intro call.',
      });
      expect(valid.content).toBe('Solid communication during intro call.');

      expect(() =>
        CreateApplicationNoteSchema.parse({ content: '' })
      ).toThrow();
    });
  });

  describe('canTransitionApplicationStage (State Machine Rules)', () => {
    it('blocks transitions when job is PAUSED', () => {
      const result = canTransitionApplicationStage(
        ApplicationStatus.SOURCED,
        ApplicationStatus.SCREENING,
        JobStatus.PAUSED
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('PAUSED');
    });

    it('blocks transitions when job is CLOSED', () => {
      const result = canTransitionApplicationStage(
        ApplicationStatus.INTERVIEW,
        ApplicationStatus.TECHNICAL,
        JobStatus.CLOSED
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('CLOSED');
    });

    it('blocks transitions when job is in DRAFT status', () => {
      const result = canTransitionApplicationStage(
        ApplicationStatus.SOURCED,
        ApplicationStatus.SCREENING,
        JobStatus.DRAFT
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('DRAFT');
    });

    it('allows valid progression when job is ACTIVE', () => {
      const result = canTransitionApplicationStage(
        ApplicationStatus.SOURCED,
        ApplicationStatus.SCREENING,
        JobStatus.ACTIVE
      );
      expect(result.allowed).toBe(true);
    });

    it('allows moving active candidate to REJECTED', () => {
      const result = canTransitionApplicationStage(
        ApplicationStatus.TECHNICAL,
        ApplicationStatus.REJECTED,
        JobStatus.ACTIVE
      );
      expect(result.allowed).toBe(true);
    });

    it('blocks casually moving PLACED candidates back to early stages', () => {
      const result = canTransitionApplicationStage(
        ApplicationStatus.PLACED,
        ApplicationStatus.SOURCED,
        JobStatus.ACTIVE
      );
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('PLACED');
    });

    it('allows no-op transition (same stage)', () => {
      const result = canTransitionApplicationStage(
        ApplicationStatus.SCREENING,
        ApplicationStatus.SCREENING,
        JobStatus.ACTIVE
      );
      expect(result.allowed).toBe(true);
    });
  });

  describe('serializePipelineCard (Anti-Leak Protection)', () => {
    const mockApp = {
      id: 'app-001',
      candidateId: 'cand-001',
      stageId: 'stage-technical',
      status: ApplicationStatus.TECHNICAL,
      appliedAt: new Date(),
      updatedAt: new Date(),
      candidate: {
        id: 'cand-001',
        code: 'C-0001',
        name: 'Aarav Shah',
        currentTitle: 'Staff Architect',
        currentCompany: 'Secret Tech Corp',
        experienceYears: 8.5,
        expectedSalary: 4200000,
        location: 'Bengaluru',
        skills: ['TypeScript', 'Next.js'],
        owner: { name: 'Mitisha Patidar' },
      },
    };

    it('includes full card data for internal RECRUITER', () => {
      const card = serializePipelineCard(mockApp, UserRole.RECRUITER);
      expect(card.name).toBe('Aarav Shah');
      expect(card.expectedSalary).toBe('₹42.0 LPA');
      expect(card.currentCompany).toBe('Secret Tech Corp');
    });

    it('redacts expected salary for CLIENT role', () => {
      const card = serializePipelineCard(mockApp, UserRole.CLIENT);
      expect(card.name).toBe('Aarav Shah');
      expect(card.expectedSalary).toBeNull();
    });

    it('redacts current company for CANDIDATE role', () => {
      const card = serializePipelineCard(mockApp, UserRole.CANDIDATE);
      expect(card.currentCompany).toBeNull();
    });
  });
});
