import { describe, it, expect } from 'vitest';
import {
  validateSubmissionAgainstClientRules,
  assertNotSelfApproval,
  SelfApprovalError,
  isSubmissionApprovalValid,
} from './approvals';
import { can, AuthUser } from './authorization';
import { UserRole } from './roles';

describe('Prompt 18: Approvals, Client Rules & Self-Approval Prevention Tests', () => {
  const completeCandidate = {
    id: 'cand-1',
    fullName: 'Aarav Shah',
    headline: 'Senior Full Stack Engineer',
    location: 'Mumbai, India',
    summary: 'Over 8 years of experience building distributed web apps.',
    coreSkills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
    experienceYears: 8,
    portfolioUrl: 'https://github.com/aaravshah',
    expectedSalary: '2800000',
    noticePeriodDays: 30,
    consentGiven: true,
    hasCv: true,
    hasExperience: true,
    hasEducation: true,
  };

  const defaultSubmission = {
    id: 'sub-1',
    portfolioUrl: 'https://github.com/aaravshah',
    standardProfileVersion: '1.0',
  };

  describe('Client Rule Validation Engine', () => {
    it('should PASS all checks when candidate satisfies all mandatory and optional client requirements', () => {
      const report = validateSubmissionAgainstClientRules({
        candidate: completeCandidate,
        submission: defaultSubmission,
        rules: {
          requirePortfolioUrl: true,
          requireExpectedSalary: true,
          requireNoticePeriod: true,
          requireCandidateConsent: true,
          requireCvDocument: true,
          requireCompleteProfile: true,
        },
      });

      expect(report.allPassed).toBe(true);
      expect(report.checks.length).toBe(7);
      expect(report.checks.every((c) => c.passed)).toBe(true);
    });

    it('should FAIL when required CV is missing', () => {
      const report = validateSubmissionAgainstClientRules({
        candidate: { ...completeCandidate, hasCv: false },
        submission: defaultSubmission,
        rules: { requireCvDocument: true },
      });

      expect(report.allPassed).toBe(false);
      const cvCheck = report.checks.find((c) => c.rule === 'CV_ATTACHED');
      expect(cvCheck?.passed).toBe(false);
      expect(cvCheck?.explanation).toContain('PDF/DOCX resume file must be attached');
    });

    it('should FAIL when client mandates portfolio URL and none is provided', () => {
      const report = validateSubmissionAgainstClientRules({
        candidate: { ...completeCandidate, portfolioUrl: '' },
        submission: { ...defaultSubmission, portfolioUrl: '' },
        rules: { requirePortfolioUrl: true },
      });

      expect(report.allPassed).toBe(false);
      const portCheck = report.checks.find((c) => c.rule === 'PORTFOLIO_URL');
      expect(portCheck?.passed).toBe(false);
      expect(portCheck?.required).toBe(true);
    });

    it('should PASS portfolio check when optional even if not provided', () => {
      const report = validateSubmissionAgainstClientRules({
        candidate: { ...completeCandidate, portfolioUrl: '' },
        submission: { ...defaultSubmission, portfolioUrl: '' },
        rules: { requirePortfolioUrl: false },
      });

      expect(report.allPassed).toBe(true);
      const portCheck = report.checks.find((c) => c.rule === 'PORTFOLIO_URL');
      expect(portCheck?.passed).toBe(true);
      expect(portCheck?.required).toBe(false);
    });

    it('should FAIL when client requires expected salary and it is not documented', () => {
      const report = validateSubmissionAgainstClientRules({
        candidate: { ...completeCandidate, expectedSalary: null },
        submission: defaultSubmission,
        rules: { requireExpectedSalary: true },
      });

      expect(report.allPassed).toBe(false);
      const salCheck = report.checks.find((c) => c.rule === 'EXPECTED_SALARY');
      expect(salCheck?.passed).toBe(false);
    });

    it('should FAIL when client requires notice period and it is not recorded', () => {
      const report = validateSubmissionAgainstClientRules({
        candidate: { ...completeCandidate, noticePeriodDays: null },
        submission: defaultSubmission,
        rules: { requireNoticePeriod: true },
      });

      expect(report.allPassed).toBe(false);
      const noticeCheck = report.checks.find((c) => c.rule === 'NOTICE_PERIOD');
      expect(noticeCheck?.passed).toBe(false);
    });

    it('should FAIL when candidate representation consent is missing', () => {
      const report = validateSubmissionAgainstClientRules({
        candidate: { ...completeCandidate, consentGiven: false },
        submission: defaultSubmission,
        rules: { requireCandidateConsent: true },
      });

      expect(report.allPassed).toBe(false);
      const consentCheck = report.checks.find((c) => c.rule === 'CANDIDATE_CONSENT');
      expect(consentCheck?.passed).toBe(false);
    });
  });

  describe('Recruiter Self-Approval Prevention Check', () => {
    it('should throw SelfApprovalError when reviewer is the submitting user', () => {
      expect(() => {
        assertNotSelfApproval({
          reviewerId: 'user-recruiter-1',
          submittingUserId: 'user-recruiter-1',
        });
      }).toThrow(SelfApprovalError);
    });

    it('should throw SelfApprovalError when reviewer is the record owner', () => {
      expect(() => {
        assertNotSelfApproval({
          reviewerId: 'user-manager-1',
          ownerId: 'user-manager-1',
        });
      }).toThrow(SelfApprovalError);
    });

    it('should throw SelfApprovalError when reviewer is the creator', () => {
      expect(() => {
        assertNotSelfApproval({
          reviewerId: 'user-admin-1',
          createdById: 'user-admin-1',
        });
      }).toThrow(SelfApprovalError);
    });

    it('should allow review when reviewer is different from submitter, owner, and creator', () => {
      expect(() => {
        assertNotSelfApproval({
          reviewerId: 'user-manager-2',
          submittingUserId: 'user-recruiter-1',
          ownerId: 'user-recruiter-1',
          createdById: 'user-recruiter-1',
        });
      }).not.toThrow();
    });
  });

  describe('Version Binding & Invalidation', () => {
    it('should validate matching version and non-invalidated approval', () => {
      const valid = isSubmissionApprovalValid({
        isInvalidated: false,
        approvalProfileVersion: 2,
        currentProfileVersion: 2,
        approvalSubmissionVersion: 1,
        currentSubmissionVersion: 1,
      });
      expect(valid).toBe(true);
    });

    it('should reject when approval is marked invalidated', () => {
      const valid = isSubmissionApprovalValid({
        isInvalidated: true,
        approvalProfileVersion: 2,
        currentProfileVersion: 2,
      });
      expect(valid).toBe(false);
    });

    it('should reject when profile version has bumped since approval', () => {
      const valid = isSubmissionApprovalValid({
        isInvalidated: false,
        approvalProfileVersion: 1,
        currentProfileVersion: 2, // New profile version created
      });
      expect(valid).toBe(false);
    });

    it('should reject when submission version has changed', () => {
      const valid = isSubmissionApprovalValid({
        isInvalidated: false,
        approvalProfileVersion: 1,
        currentProfileVersion: 1,
        approvalSubmissionVersion: 1,
        currentSubmissionVersion: 2,
      });
      expect(valid).toBe(false);
    });
  });

  describe('Authorization Engine Enforcement for Approvals', () => {
    const recruiter: AuthUser = {
      id: 'user-rec-1',
      email: 'rec@hireflow.io',
      name: 'Recruiter One',
      role: UserRole.RECRUITER,
      organizationId: 'org-1',
      status: 'ACTIVE',
    };

    const manager: AuthUser = {
      id: 'user-mgr-1',
      email: 'mgr@hireflow.io',
      name: 'Manager One',
      role: UserRole.MANAGER,
      organizationId: 'org-1',
      subordinateIds: ['user-rec-1'],
      status: 'ACTIVE',
    };

    const admin: AuthUser = {
      id: 'user-adm-1',
      email: 'adm@hireflow.io',
      name: 'Admin One',
      role: UserRole.ADMIN,
      organizationId: 'org-1',
      status: 'ACTIVE',
    };

    it('RECRUITER can never approve submissions or jobs', () => {
      expect(can(recruiter, 'approve', { type: 'submission', ownerId: 'user-rec-1' })).toBe(false);
      expect(can(recruiter, 'approve', { type: 'job', ownerId: 'user-rec-1' })).toBe(false);
      expect(can(recruiter, 'update', { type: 'client_workflow' })).toBe(false);
    });

    it('MANAGER can approve team member submission but CANNOT self-approve', () => {
      // Team member submission -> allowed
      expect(
        can(manager, 'approve', {
          type: 'submission',
          ownerId: 'user-rec-1',
        })
      ).toBe(true);

      // Self-submitted record -> strictly blocked!
      expect(
        can(manager, 'approve', {
          type: 'submission',
          ownerId: 'user-mgr-1',
        })
      ).toBe(false);
    });

    it('ADMIN has full approval permission across organization but CANNOT self-approve own record', () => {
      expect(
        can(admin, 'approve', {
          type: 'submission',
          ownerId: 'user-rec-1',
        })
      ).toBe(true);

      // Self-submitted -> blocked!
      expect(
        can(admin, 'approve', {
          type: 'submission',
          ownerId: 'user-adm-1',
        })
      ).toBe(false);
    });

    it('CLIENT and CANDIDATE are strictly barred from internal approvals and client workflows', () => {
      const clientUser: AuthUser = {
        id: 'user-client-1',
        email: 'client@acme.com',
        name: 'Client User',
        role: UserRole.CLIENT,
        organizationId: 'org-1',
        status: 'ACTIVE',
        clientAccess: { clientId: 'cl-1', authorizedJobIds: [], allowDirectFeedback: true, dailyCvDownloadLimit: 10 },
      };

      const candidateUser: AuthUser = {
        id: 'user-cand-1',
        email: 'cand@gmail.com',
        name: 'Candidate User',
        role: UserRole.CANDIDATE,
        organizationId: 'org-1',
        status: 'ACTIVE',
        candidateProfileId: 'cand-1',
      };

      expect(can(clientUser, 'read', { type: 'submission_approval' })).toBe(false);
      expect(can(clientUser, 'read', { type: 'job_approval' })).toBe(false);
      expect(can(clientUser, 'read', { type: 'client_workflow' })).toBe(false);

      expect(can(candidateUser, 'read', { type: 'submission_approval' })).toBe(false);
      expect(can(candidateUser, 'read', { type: 'job_approval' })).toBe(false);
      expect(can(candidateUser, 'read', { type: 'client_workflow' })).toBe(false);
    });
  });
});
