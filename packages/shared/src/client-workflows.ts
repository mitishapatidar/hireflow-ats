import { z } from 'zod';

// ==========================================
// 1. CLIENT WORKFLOW ENUMS & TYPES
// ==========================================

export enum WorkflowStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum InterviewRoundType {
  SCREENING = 'SCREENING',
  TECHNICAL = 'TECHNICAL',
  HIRING_MANAGER = 'HIRING_MANAGER',
  CULTURE_FIT = 'CULTURE_FIT',
  FINAL = 'FINAL',
}

export const ClientStageInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Stage name must be at least 2 characters'),
  order: z.number().int().min(1),
  stageType: z.string().default('CUSTOM'),
  isActive: z.boolean().default(true),
});

export const ClientInterviewRoundInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Round name must be at least 2 characters'),
  order: z.number().int().min(1),
  type: z.string().default('TECHNICAL'),
  isTechnical: z.boolean().default(false),
  isHiringManager: z.boolean().default(false),
  isRequired: z.boolean().default(true),
  defaultDuration: z.number().int().min(15).max(180).default(45),
  isActive: z.boolean().default(true),
});

export const SubmissionRuleInputSchema = z.object({
  requiredFields: z.array(z.string()).optional().default([]),
  profileFormat: z.string().default('STANDARDIZED_ANONYMIZED'),
  requiresManagerApproval: z.boolean().default(true),
  requirePortfolioUrl: z.boolean().default(false),
  requireExpectedSalary: z.boolean().default(false),
  requireNoticePeriod: z.boolean().default(false),
  requireCandidateConsent: z.boolean().default(true),
  requireCvDocument: z.boolean().default(true),
  requireCompleteProfile: z.boolean().default(true),
});

export const UpdateClientWorkflowDraftSchema = z.object({
  clientId: z.string().uuid('Invalid client ID').optional(),
  stages: z.array(ClientStageInputSchema).optional(),
  rounds: z.array(ClientInterviewRoundInputSchema).optional(),
  submissionRule: SubmissionRuleInputSchema.optional(),
  rules: SubmissionRuleInputSchema.optional(),
  changeSummary: z.string().max(500).optional(),
});
export type UpdateClientWorkflowDraftInput = z.infer<typeof UpdateClientWorkflowDraftSchema>;

export const PublishClientWorkflowSchema = z.object({
  clientId: z.string().uuid('Invalid client ID').optional(),
  changeSummary: z.string().min(3, 'A summary of workflow changes is required for audit compliance'),
});
export type PublishClientWorkflowInput = z.infer<typeof PublishClientWorkflowSchema>;
