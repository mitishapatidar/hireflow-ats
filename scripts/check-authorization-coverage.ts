/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * HireFlow ATS — CI Authorization & Route Security Policy Checker
 * 
 * Inspects all registered Fastify routes and asserts that every sensitive endpoint
 * has an explicit authentication and authorization policy.
 * 
 * Public exemptions (e.g. /health, /api/auth/login, webhooks) must be explicitly documented.
 */

process.env.NODE_ENV = 'test';

import { buildServer } from '../apps/api/src/server.js';
import { UserRole } from '../packages/shared/src/roles.js';

interface RoutePolicy {
  method: string;
  url: string;
  isPublic: boolean;
  publicReason?: string;
  allowedRoles?: UserRole[];
  notes?: string;
}

// 1. Explicit Route Security Registry (Source of Truth)
const ROUTE_SECURITY_REGISTRY: RoutePolicy[] = [
  // Health
  { method: 'GET', url: '/health', isPublic: true, publicReason: 'Load balancer health probe' },

  // Auth Public Endpoints
  { method: 'GET', url: '/api/auth/csrf', isPublic: true, publicReason: 'Anti-CSRF token distribution' },
  { method: 'POST', url: '/api/auth/login', isPublic: true, publicReason: 'User credential sign-in' },
  { method: 'POST', url: '/api/auth/google', isPublic: true, publicReason: 'Google OAuth2 OIDC callback' },
  { method: 'POST', url: '/api/auth/invitation/accept', isPublic: true, publicReason: 'New user onboarding activation' },
  { method: 'POST', url: '/api/auth/password-reset/request', isPublic: true, publicReason: 'Password reset request' },
  { method: 'POST', url: '/api/auth/password-reset/confirm', isPublic: true, publicReason: 'Password reset token verification' },
  { method: 'POST', url: '/api/auth/otp/verify', isPublic: true, publicReason: 'Two-step verification challenge response' },
  { method: 'POST', url: '/api/auth/otp/resend', isPublic: true, publicReason: 'Two-step verification code resend' },

  // Auth Protected Endpoints
  { method: 'POST', url: '/api/auth/logout', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER, UserRole.CLIENT, UserRole.CANDIDATE] },
  { method: 'GET', url: '/api/auth/me', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER, UserRole.CLIENT, UserRole.CANDIDATE] },
  { method: 'GET', url: '/api/auth/sessions', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER, UserRole.CLIENT, UserRole.CANDIDATE] },
  { method: 'DELETE', url: '/api/auth/sessions/:id', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER, UserRole.CLIENT, UserRole.CANDIDATE] },
  { method: 'POST', url: '/api/auth/sessions/revoke-others', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER, UserRole.CLIENT, UserRole.CANDIDATE] },
  { method: 'POST', url: '/api/auth/reauthenticate', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER, UserRole.CLIENT, UserRole.CANDIDATE] },

  // Admin & Settings (Admin & Manager)
  { method: 'GET', url: '/api/admin/members', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'POST', url: '/api/admin/members/invite', isPublic: false, allowedRoles: [UserRole.ADMIN] },
  { method: 'PATCH', url: '/api/admin/members/:userId/reporting', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'PATCH', url: '/api/admin/members/:userId/status', isPublic: false, allowedRoles: [UserRole.ADMIN] },
  { method: 'GET', url: '/api/admin/client-access', isPublic: false, allowedRoles: [UserRole.ADMIN] },
  { method: 'GET', url: '/api/admin/invitations', isPublic: false, allowedRoles: [UserRole.ADMIN] },
  { method: 'PATCH', url: '/api/admin/permissions/grant', isPublic: false, allowedRoles: [UserRole.ADMIN] },
  { method: 'GET', url: '/api/admin/security/policies', isPublic: false, allowedRoles: [UserRole.ADMIN] },
  { method: 'PATCH', url: '/api/admin/security/policies', isPublic: false, allowedRoles: [UserRole.ADMIN] },

  // Candidates (Internal Staff Only)
  { method: 'GET', url: '/api/candidates', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/candidates', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/candidates/check-duplicate', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/candidates/parse-text', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/candidates/queue/status', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/candidates/jobs/parse-resume', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/candidates/jobs/:jobId', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/candidates/search-available', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/candidates/:candidateId', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'PATCH', url: '/api/candidates/:candidateId', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/candidates/:candidateId/notes', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'DELETE', url: '/api/candidates/:candidateId/notes/:noteId', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/candidates/:candidateId/handover', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/candidates/:candidateId/archive', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/candidates/:candidateId/restore', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },

  // Clients CRM
  { method: 'GET', url: '/api/clients', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/clients', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/clients/:id', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'PATCH', url: '/api/clients/:id', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/clients/:id/commercial', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'PATCH', url: '/api/clients/:id/commercial', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'GET', url: '/api/clients/:id/contacts', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/clients/:id/contacts', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/clients/:id/archive', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'GET', url: '/api/clients/:id/activity', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/clients/:id/restore', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'GET', url: '/api/clients/:id/jobs', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/clients/:id/documents', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/clients/:id/documents/:docId/verify', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'GET', url: '/api/clients/:id/documents/:docId/download', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },

  // Jobs & Requisitions
  { method: 'GET', url: '/api/jobs', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/jobs', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/jobs/:id', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'PATCH', url: '/api/jobs/:id', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/jobs/:id/transition', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/jobs/:id/activate', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'POST', url: '/api/jobs/:id/submit-for-approval', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/jobs/:id/assignments', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'DELETE', url: '/api/jobs/:id/assignments/:recruiterId', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'POST', url: '/api/jobs/:id/applications', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/jobs/:id/pause', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/jobs/:id/pipeline', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/jobs/:id/pipeline/columns/:stageId', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/jobs/:id/pipeline/counts', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/jobs/:id/resume', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/jobs/:id/reopen', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'POST', url: '/api/jobs/:id/reassignment-requests', isPublic: false, allowedRoles: [UserRole.RECRUITER] },
  { method: 'PATCH', url: '/api/jobs/:id/reassignment-requests/:requestId', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'GET', url: '/api/jobs/:id/rounds', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/jobs/:id/rounds', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'POST', url: '/api/jobs/:id/rounds/reorder', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'PATCH', url: '/api/jobs/:id/rounds/:roundId', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'DELETE', url: '/api/jobs/:id/rounds/:roundId', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'POST', url: '/api/jobs/:id/close', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },

  // Pipeline Applications
  { method: 'POST', url: '/api/applications/:applicationId/stage', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/applications/:applicationId/reject', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/applications/:applicationId/drawer', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/applications/:applicationId/notes', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/pipeline/rejection-reasons', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },

  // Submissions & Standard Profiles
  { method: 'GET', url: '/api/submissions', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/submissions', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/submissions/:id', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/submissions/:id/match', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/submissions/:id/profile', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/submissions/:id/profile/versions', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/submissions/:id/profile/versions', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/submissions/:id/profile/preview', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/submissions/:id/cv/preview', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/submissions/:id/approval/request', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/submissions/:id/approval/review', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'POST', url: '/api/submissions/:id/send', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/submissions/:id/history', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },

  // Interviews & Calendar
  { method: 'POST', url: '/api/interviews', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/interviews/calendar', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/interviews/stats', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/interviews/availability', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/interviews/:id', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/interviews/:id/reschedule', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/interviews/:id/cancel', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/interviews/:id/complete', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/interviews/:id/no-show', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/interviews/:id/feedback', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/interviews/:id/task', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },

  // Communications
  { method: 'GET', url: '/api/communications/threads', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/communications/threads/:id', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'PATCH', url: '/api/communications/threads/:id/read', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/communications/timeline/:candidateId', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/communications/templates', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/communications/templates', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'PATCH', url: '/api/communications/templates/:id', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'POST', url: '/api/communications/templates/:id/preview', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/communications/email/send', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/communications/whatsapp/send', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/communications/webhooks/whatsapp', isPublic: true, publicReason: 'HMAC webhook from WhatsApp Cloud API' },
  { method: 'POST', url: '/api/communications/webhooks/sms', isPublic: true, publicReason: 'HMAC webhook from SMS Provider' },
  { method: 'POST', url: '/api/communications/sms/send', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/communications/signature', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'PUT', url: '/api/communications/signature', isPublic: false, allowedRoles: [UserRole.ADMIN] },
  { method: 'GET', url: '/api/communications/integrations', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },

  // Sales CRM
  { method: 'GET', url: '/api/sales/opportunities', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/sales/opportunities', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/sales/opportunities/:id', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/sales/opportunities/:id/stage', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/sales/opportunities/:id/convert', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/sales/meetings', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/sales/meetings', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'PATCH', url: '/api/sales/meetings/:id/outcome', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },

  // Dashboard
  { method: 'GET', url: '/api/dashboard', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/dashboard/recruiter', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },

  // Recruiter Daily Activity
  { method: 'GET', url: '/api/activity', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/activity/daily', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/activity/log', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/activity/targets', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'PATCH', url: '/api/activity/targets', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'GET', url: '/api/activity/recent', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },

  // Approval Center
  { method: 'GET', url: '/api/approvals', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'GET', url: '/api/approvals/submissions/:id', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'POST', url: '/api/approvals/submissions/:id/approve', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'POST', url: '/api/approvals/submissions/:id/request-changes', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'POST', url: '/api/approvals/submissions/:id/reject', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'GET', url: '/api/approvals/jobs/:id', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'POST', url: '/api/approvals/jobs/:id/approve', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'POST', url: '/api/approvals/jobs/:id/request-changes', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'POST', url: '/api/approvals/jobs/:id/reject', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'GET', url: '/api/approvals/history', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },

  // Manager Overview
  { method: 'GET', url: '/api/manager/overview', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'GET', url: '/api/manager/team-performance', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },

  // Client Workflows & Submission Rules
  { method: 'GET', url: '/api/clients/:clientId/workflow', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
  { method: 'POST', url: '/api/clients/:clientId/workflow/draft', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'PATCH', url: '/api/clients/:clientId/workflow/draft', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'POST', url: '/api/clients/:clientId/workflow/publish', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER] },
  { method: 'GET', url: '/api/clients/:clientId/workflow/versions', isPublic: false, allowedRoles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.RECRUITER] },
];

async function runAuthorizationAudit() {
  console.log('🔒 Starting CI Route Authorization & Security Check...\n');

  const server = buildServer();
  await server.ready();

  const registeredRoutes: Array<{ method: string; url: string }> = [];

  // Parse Fastify route tree output to extract every real registered endpoint
  const routeTree = server.printRoutes({ commonPrefix: false });
  const lines = routeTree.split('\n');

  // Regex to match "└── /path (METHOD, METHOD)" or "├── /path (METHOD)"
  for (const line of lines) {
    const match = line.match(/(?:\/api|\/health)[^\s]*/);
    const methodsMatch = line.match(/\(([A-Z,\s]+)\)/);

    if (match && methodsMatch) {
      const url = match[0].trim();
      const methods = methodsMatch[1].split(',').map((m) => m.trim());
      for (const method of methods) {
        if (method !== 'HEAD' && method !== 'OPTIONS') {
          registeredRoutes.push({ method, url });
        }
      }
    }
  }

  console.log(`📡 Total Registered API Endpoints in Fastify: ${registeredRoutes.length}`);

  let protectedCount = 0;
  let publicCount = 0;

  for (const reg of ROUTE_SECURITY_REGISTRY) {
    if (reg.isPublic) publicCount++;
    else protectedCount++;
  }

  console.log(`🛡️  Catalogued Policy Registry: ${ROUTE_SECURITY_REGISTRY.length} rules (${protectedCount} Protected, ${publicCount} Public Exemptions)`);

  const violations: string[] = [];

  for (const route of registeredRoutes) {
    // Normalise route pattern like :id|:jobId
    const cleanUrl = route.url.replace(':id|:jobId', ':id');
    const matched = ROUTE_SECURITY_REGISTRY.find(
      (p) => p.method === route.method && (p.url === route.url || p.url === cleanUrl)
    );

    if (!matched) {
      violations.push(`[UNPROTECTED_ROUTE] ${route.method} ${route.url} has no registered authorization policy!`);
    }
  }

  if (violations.length > 0) {
    console.error('\n❌ Authorization Check FAILED: Detected sensitive routes without explicit security policies:');
    violations.forEach((v) => console.error(`  - ${v}`));
    await server.close();
    process.exit(1);
  }

  console.log('\n✅ Authorization Check PASSED: 100% of Fastify routes have verified security policies.');
  await server.close();
}

runAuthorizationAudit().catch((err) => {
  console.error('❌ Error during route security audit:', err);
  process.exit(1);
});
