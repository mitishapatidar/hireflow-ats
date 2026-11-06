import { UserRole } from './roles';

export type AuthAction = 'read' | 'create' | 'update' | 'delete' | 'approve' | 'export';

export type ResourceType =
  | 'candidate'
  | 'candidate_notes'
  | 'job'
  | 'application'
  | 'interview'
  | 'submission'
  | 'submission_approval'
  | 'offer'
  | 'placement'
  | 'commercial_terms'
  | 'organization'
  | 'user'
  | 'invitation'
  | 'audit_log'
  | 'report';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organizationId: string;
  managerId?: string | null;
  teamId?: string | null;
  status: string; // 'ACTIVE', 'DISABLED', 'SUSPENDED'
  subordinateIds?: string[]; // IDs of recruiters managed by this user
  clientAccess?: {
    clientId: string;
    authorizedJobIds: string[];
  } | null;
  candidateProfileId?: string | null;
  grants?: Record<string, boolean>;
  sessionId?: string;
  lastReverifiedAt?: Date | null;
}

export interface AuthResource {
  type: ResourceType;
  organizationId?: string;
  id?: string;
  ownerId?: string | null; // Recruiter or user who owns the record
  authorId?: string | null;
  teamId?: string | null;
  clientId?: string | null;
  candidateId?: string | null;
  jobId?: string | null;
  assignedRecruiterIds?: string[];
  isSubmittedToClient?: boolean;
  isInternal?: boolean;
}

/**
 * Centralized Role-Based & Resource-Level Authorization Engine
 * Enforces enterprise ATS security commandments:
 * 1. Strict tenant boundary (organizationId must match for internal users).
 * 2. Recruiter can only access assigned candidates/jobs (cross-owner = DENY).
 * 3. Manager can access reporting team scope & approve team submissions.
 * 4. Admin manages organization users, settings, and audits.
 * 5. Client can only access their authorized jobs/candidates, NEVER internal notes or margins.
 * 6. Candidate can only access their own profile and applications.
 */
export function can(user: AuthUser, action: AuthAction, resource: AuthResource): boolean {
  // 1. Account status check: Inactive or suspended users cannot perform any action
  if (!user || user.status !== 'ACTIVE') {
    return false;
  }

  // 2. Strict Multi-Tenant Boundary:
  // If resource specifies organizationId and user is an internal staff member (ADMIN, MANAGER, RECRUITER),
  // organizations MUST match.
  if (
    resource.organizationId &&
    (user.role === UserRole.ADMIN || user.role === UserRole.MANAGER || user.role === UserRole.RECRUITER)
  ) {
    if (user.organizationId !== resource.organizationId) {
      return false; // Cross-organization access is strictly forbidden
    }
  }

  // 3. Role-Specific Evaluation
  switch (user.role) {
    // ------------------------------------------------------------------
    // A. RECRUITER
    // ------------------------------------------------------------------
    case UserRole.RECRUITER: {
      // Forbidden resources for Recruiter:
      if (
        resource.type === 'organization' ||
        resource.type === 'user' ||
        resource.type === 'invitation' ||
        resource.type === 'audit_log'
      ) {
        return false;
      }

      // Internal fees / commercial terms: by explicit grant only
      if (resource.type === 'commercial_terms') {
        return !!user.grants?.recruiterViewInternalFees && action === 'read';
      }

      // Submission approval cannot be self-approved by recruiter
      if (resource.type === 'submission_approval' || (resource.type === 'submission' && action === 'approve')) {
        return false;
      }

      // Candidate access: Must be owner or assigned recruiter, or creator
      if (resource.type === 'candidate') {
        if (action === 'create') {
          return !resource.ownerId || resource.ownerId === user.id;
        }
        return resource.ownerId === user.id;
      }

      // Candidate notes: Private to author or assigned recruiter
      if (resource.type === 'candidate_notes') {
        if (resource.authorId) {
          return resource.authorId === user.id;
        }
        return resource.ownerId === user.id;
      }

      // Job access: Must be job owner or assigned recruiter
      if (resource.type === 'job') {
        if (resource.ownerId === user.id) return true;
        if (resource.assignedRecruiterIds && resource.assignedRecruiterIds.includes(user.id)) return true;
        // Read-only overview allowed within organization for sourcing, but mutating is denied
        return action === 'read';
      }

      // Applications, Interviews, Submissions, Offers within assigned scope
      if (
        resource.type === 'application' ||
        resource.type === 'interview' ||
        resource.type === 'submission' ||
        resource.type === 'offer'
      ) {
        if (resource.ownerId) {
          return resource.ownerId === user.id;
        }
        return true;
      }

      // Placements: Recruiters can view their placed candidate status, but not edit commercial fee terms
      if (resource.type === 'placement') {
        return action === 'read' && resource.ownerId === user.id;
      }

      return action === 'read';
    }

    // ------------------------------------------------------------------
    // B. MANAGER
    // ------------------------------------------------------------------
    case UserRole.MANAGER: {
      // Forbidden resources for Manager:
      if (resource.type === 'organization' && (action === 'delete' || action === 'update')) {
        return false; // Global org settings are Admin only
      }
      if (resource.type === 'user' && action === 'delete') {
        return false;
      }

      // Team Scope: Can access records owned by themselves or their managed team members
      const isTeamScoped = () => {
        if (!resource.ownerId) return true;
        if (resource.ownerId === user.id) return true;
        if (resource.teamId && user.teamId && resource.teamId === user.teamId) return true;
        if (user.subordinateIds && user.subordinateIds.includes(resource.ownerId)) return true;
        return false;
      };

      if (resource.type === 'candidate' || resource.type === 'candidate_notes') {
        return isTeamScoped();
      }

      if (resource.type === 'job' || resource.type === 'application' || resource.type === 'interview') {
        return isTeamScoped();
      }

      if (resource.type === 'submission' || resource.type === 'submission_approval') {
        // Manager can approve submissions within team scope
        return isTeamScoped();
      }

      if (resource.type === 'offer' || resource.type === 'placement' || resource.type === 'commercial_terms') {
        return isTeamScoped();
      }

      if (resource.type === 'report' || resource.type === 'audit_log') {
        return action === 'read';
      }

      return true;
    }

    // ------------------------------------------------------------------
    // C. ADMIN
    // ------------------------------------------------------------------
    case UserRole.ADMIN: {
      // Full access across all resources within the organization
      return true;
    }

    // ------------------------------------------------------------------
    // D. CLIENT
    // ------------------------------------------------------------------
    case UserRole.CLIENT: {
      // Security Commandment: Never expose internal candidate notes, client commercial fees, or margins!
      if (
        resource.type === 'candidate_notes' ||
        resource.type === 'commercial_terms' ||
        resource.type === 'organization' ||
        resource.type === 'user' ||
        resource.type === 'invitation' ||
        resource.type === 'audit_log'
      ) {
        return false;
      }

      // Client must have ClientAccess record
      if (!user.clientAccess || !user.clientAccess.clientId) {
        return false;
      }

      // Client can only access records matching their specific clientId
      if (resource.clientId && resource.clientId !== user.clientAccess.clientId) {
        return false;
      }

      // Job Access: Must be an authorized job for this client
      if (resource.type === 'job') {
        if (resource.clientId && resource.clientId !== user.clientAccess.clientId) return false;
        if (user.clientAccess.authorizedJobIds && user.clientAccess.authorizedJobIds.length > 0) {
          if (resource.jobId && !user.clientAccess.authorizedJobIds.includes(resource.jobId)) {
            return false;
          }
        }
        return action === 'read';
      }

      // Candidate Profile: Can ONLY view profiles officially submitted to their organization
      if (resource.type === 'candidate') {
        if (!resource.isSubmittedToClient) {
          return false; // Unsubmitted candidates cannot be viewed by client
        }
        return action === 'read';
      }

      // Submissions and Interviews: Can view and give feedback
      if (resource.type === 'submission' || resource.type === 'interview') {
        if (action === 'delete') return false;
        return action === 'read' || action === 'update' || action === 'approve';
      }

      return action === 'read';
    }

    // ------------------------------------------------------------------
    // E. CANDIDATE
    // ------------------------------------------------------------------
    case UserRole.CANDIDATE: {
      // Forbidden resources for Candidate:
      if (
        resource.type === 'candidate_notes' ||
        resource.type === 'commercial_terms' ||
        resource.type === 'submission_approval' ||
        resource.type === 'organization' ||
        resource.type === 'user' ||
        resource.type === 'invitation' ||
        resource.type === 'audit_log' ||
        resource.type === 'report'
      ) {
        return false;
      }

      // Candidate can only access their own candidate profile
      if (resource.type === 'candidate') {
        const isSelf =
          (resource.id && resource.id === user.candidateProfileId) ||
          (resource.candidateId && resource.candidateId === user.candidateProfileId);
        if (!isSelf) return false;
        // Candidate can read and update permitted profile fields
        return action === 'read' || action === 'update';
      }

      // Applications & Interviews: Can only view their own
      if (resource.type === 'application' || resource.type === 'interview') {
        const isSelf = resource.candidateId === user.candidateProfileId;
        if (!isSelf) return false;
        // Cannot modify application decisions (e.g., status changes)
        if (action === 'update' && resource.type === 'application') return false;
        return action === 'read';
      }

      return false;
    }

    default:
      return false;
  }
}
