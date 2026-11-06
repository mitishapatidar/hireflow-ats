import { describe, it, expect } from 'vitest';
import { can, AuthUser, AuthResource } from './authorization';
import { UserRole } from './roles';

describe('Centralized Authorization Engine - can(user, action, resource)', () => {
  const orgA = 'org-aureva-1';
  const orgB = 'org-competitor-2';

  const recruiter1: AuthUser = {
    id: 'user-recruiter-1',
    email: 'karan.sharma@aurevacapital.com',
    name: 'Karan Sharma',
    role: UserRole.RECRUITER,
    organizationId: orgA,
    status: 'ACTIVE',
    teamId: 'team-engineering',
  };

  const recruiter2: AuthUser = {
    id: 'user-recruiter-2',
    email: 'sneha.patel@aurevacapital.com',
    name: 'Sneha Patel',
    role: UserRole.RECRUITER,
    organizationId: orgA,
    status: 'ACTIVE',
    teamId: 'team-engineering',
  };

  const manager: AuthUser = {
    id: 'user-manager-riya',
    email: 'riya.desai@aurevacapital.com',
    name: 'Riya Desai',
    role: UserRole.MANAGER,
    organizationId: orgA,
    status: 'ACTIVE',
    teamId: 'team-engineering',
    subordinateIds: ['user-recruiter-1', 'user-recruiter-2'],
  };

  const admin: AuthUser = {
    id: 'user-admin-anika',
    email: 'anika.rao@aurevacapital.com',
    name: 'Anika Rao',
    role: UserRole.ADMIN,
    organizationId: orgA,
    status: 'ACTIVE',
  };

  const clientUser: AuthUser = {
    id: 'user-client-priya',
    email: 'priya.g@acmetech.com',
    name: 'Priya Gupta',
    role: UserRole.CLIENT,
    organizationId: orgA,
    status: 'ACTIVE',
    clientAccess: {
      clientId: 'client-acme-tech',
      authorizedJobIds: ['job-frontend-arch', 'job-backend-lead'],
    },
  };

  const candidateUser: AuthUser = {
    id: 'user-candidate-aarav',
    email: 'aarav.shah@example.com',
    name: 'Aarav Shah',
    role: UserRole.CANDIDATE,
    organizationId: orgA,
    status: 'ACTIVE',
    candidateProfileId: 'cand-aarav-shah',
  };

  // -------------------------------------------------------------
  // 1. RECRUITER POLICIES
  // -------------------------------------------------------------
  describe('Recruiter Permissions', () => {
    it('ALLOW: Recruiter can access own assigned candidate', () => {
      const ownCandidate: AuthResource = {
        type: 'candidate',
        id: 'cand-1',
        ownerId: recruiter1.id,
        organizationId: orgA,
      };
      expect(can(recruiter1, 'read', ownCandidate)).toBe(true);
      expect(can(recruiter1, 'update', ownCandidate)).toBe(true);
    });

    it('CRITICAL TEST (DENY): Recruiter requesting another recruiter unassigned candidate returns false', () => {
      const otherRecruiterCandidate: AuthResource = {
        type: 'candidate',
        id: 'cand-2',
        ownerId: recruiter2.id, // Owned by Sneha
        organizationId: orgA,
      };
      // Karan cannot read or update Sneha's candidate!
      expect(can(recruiter1, 'read', otherRecruiterCandidate)).toBe(false);
      expect(can(recruiter1, 'update', otherRecruiterCandidate)).toBe(false);
    });

    it('DENY: Recruiter cannot access another recruiter private notes', () => {
      const privateNote: AuthResource = {
        type: 'candidate_notes',
        id: 'note-2',
        authorId: recruiter2.id,
        organizationId: orgA,
      };
      expect(can(recruiter1, 'read', privateNote)).toBe(false);
    });

    it('DENY: Recruiter cannot self-approve their own submissions', () => {
      const submission: AuthResource = {
        type: 'submission',
        id: 'sub-1',
        ownerId: recruiter1.id,
        organizationId: orgA,
      };
      expect(can(recruiter1, 'approve', submission)).toBe(false);
    });

    it('DENY: Recruiter cannot access client commercial margins or fee rates', () => {
      const commercialTerms: AuthResource = {
        type: 'commercial_terms',
        organizationId: orgA,
      };
      expect(can(recruiter1, 'read', commercialTerms)).toBe(false);
    });

    it('DENY: Recruiter cannot modify organization settings or manage users', () => {
      const orgSettings: AuthResource = {
        type: 'organization',
        organizationId: orgA,
      };
      const userManagement: AuthResource = {
        type: 'user',
        organizationId: orgA,
      };
      expect(can(recruiter1, 'update', orgSettings)).toBe(false);
      expect(can(recruiter1, 'create', userManagement)).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // 2. MANAGER POLICIES
  // -------------------------------------------------------------
  describe('Manager Permissions', () => {
    it('ALLOW: Manager can review candidate and job activity of their team members', () => {
      const teamCandidate: AuthResource = {
        type: 'candidate',
        id: 'cand-1',
        ownerId: recruiter1.id, // subordinate
        teamId: 'team-engineering',
        organizationId: orgA,
      };
      expect(can(manager, 'read', teamCandidate)).toBe(true);
      expect(can(manager, 'update', teamCandidate)).toBe(true);
    });

    it('ALLOW: Manager can approve candidate submissions for team members', () => {
      const teamSubmission: AuthResource = {
        type: 'submission',
        id: 'sub-team-1',
        ownerId: recruiter1.id,
        teamId: 'team-engineering',
        organizationId: orgA,
      };
      expect(can(manager, 'approve', teamSubmission)).toBe(true);
    });

    it('DENY: Manager cannot access records from an unrelated organization', () => {
      const otherOrgCandidate: AuthResource = {
        type: 'candidate',
        id: 'cand-foreign',
        organizationId: orgB,
      };
      expect(can(manager, 'read', otherOrgCandidate)).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // 3. ADMIN POLICIES
  // -------------------------------------------------------------
  describe('Admin Permissions', () => {
    it('ALLOW: Admin has full management access within their organization', () => {
      const userRecord: AuthResource = { type: 'user', organizationId: orgA };
      const auditLog: AuthResource = { type: 'audit_log', organizationId: orgA };
      const settings: AuthResource = { type: 'organization', organizationId: orgA };

      expect(can(admin, 'create', userRecord)).toBe(true);
      expect(can(admin, 'read', auditLog)).toBe(true);
      expect(can(admin, 'update', settings)).toBe(true);
    });

    it('DENY: Admin cannot access records from a different organization', () => {
      const otherOrgRecord: AuthResource = { type: 'user', organizationId: orgB };
      expect(can(admin, 'read', otherOrgRecord)).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // 4. CLIENT POLICIES
  // -------------------------------------------------------------
  describe('Client Permissions', () => {
    it('ALLOW: Client can access authorized jobs and submitted candidate profiles', () => {
      const authorizedJob: AuthResource = {
        type: 'job',
        jobId: 'job-frontend-arch',
        clientId: 'client-acme-tech',
      };
      const submittedCandidate: AuthResource = {
        type: 'candidate',
        id: 'cand-submitted-1',
        clientId: 'client-acme-tech',
        isSubmittedToClient: true,
      };

      expect(can(clientUser, 'read', authorizedJob)).toBe(true);
      expect(can(clientUser, 'read', submittedCandidate)).toBe(true);
    });

    it('DENY: Client CANNOT view unsubmitted candidate profiles', () => {
      const unsubmittedCandidate: AuthResource = {
        type: 'candidate',
        id: 'cand-unsubmitted-99',
        clientId: 'client-acme-tech',
        isSubmittedToClient: false,
      };
      expect(can(clientUser, 'read', unsubmittedCandidate)).toBe(false);
    });

    it('DENY: Client CANNOT view internal candidate notes or internal recruiter notes', () => {
      const internalNote: AuthResource = {
        type: 'candidate_notes',
        clientId: 'client-acme-tech',
        isInternal: true,
      };
      expect(can(clientUser, 'read', internalNote)).toBe(false);
    });

    it('DENY: Client CANNOT view internal commercial margins or recruiter fee percentages', () => {
      const margins: AuthResource = {
        type: 'commercial_terms',
        clientId: 'client-acme-tech',
      };
      expect(can(clientUser, 'read', margins)).toBe(false);
    });

    it('DENY: Client CANNOT access jobs from another client organization', () => {
      const otherClientJob: AuthResource = {
        type: 'job',
        jobId: 'job-bright-labs-1',
        clientId: 'client-bright-labs',
      };
      expect(can(clientUser, 'read', otherClientJob)).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // 5. CANDIDATE POLICIES
  // -------------------------------------------------------------
  describe('Candidate Permissions', () => {
    it('ALLOW: Candidate can access their own candidate profile and application progress', () => {
      const ownProfile: AuthResource = {
        type: 'candidate',
        candidateId: 'cand-aarav-shah',
      };
      const ownApp: AuthResource = {
        type: 'application',
        candidateId: 'cand-aarav-shah',
      };

      expect(can(candidateUser, 'read', ownProfile)).toBe(true);
      expect(can(candidateUser, 'update', ownProfile)).toBe(true);
      expect(can(candidateUser, 'read', ownApp)).toBe(true);
    });

    it('DENY: Candidate CANNOT view another candidate profile', () => {
      const otherCandidate: AuthResource = {
        type: 'candidate',
        candidateId: 'cand-rohan-mehta',
      };
      expect(can(candidateUser, 'read', otherCandidate)).toBe(false);
    });

    it('DENY: Candidate CANNOT access internal recruiter notes or decisions', () => {
      const recruiterNotes: AuthResource = {
        type: 'candidate_notes',
        candidateId: 'cand-aarav-shah',
      };
      expect(can(candidateUser, 'read', recruiterNotes)).toBe(false);
    });

    it('DENY: Candidate CANNOT modify application hiring decisions or statuses', () => {
      const ownApp: AuthResource = {
        type: 'application',
        candidateId: 'cand-aarav-shah',
      };
      expect(can(candidateUser, 'update', ownApp)).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // 6. INACTIVE / SUSPENDED USER
  // -------------------------------------------------------------
  describe('Inactive User Safety', () => {
    it('DENY: Inactive or suspended user is rejected on all requests', () => {
      const suspendedUser: AuthUser = {
        ...recruiter1,
        status: 'SUSPENDED',
      };
      const ownCandidate: AuthResource = {
        type: 'candidate',
        ownerId: recruiter1.id,
        organizationId: orgA,
      };
      expect(can(suspendedUser, 'read', ownCandidate)).toBe(false);
    });
  });
});
