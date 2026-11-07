import { z } from 'zod';
import { ClientFacingStandardProfileDTO } from './submissions';

// ==========================================
// CLIENT DECISION ENUMS & SCHEMAS
// ==========================================

export enum ClientDecisionType {
  SHORTLIST = 'SHORTLIST',
  REJECT = 'REJECT',
  NEED_DETAILS = 'NEED_DETAILS',
}

export const ClientShortlistSchema = z.object({
  comments: z.string().max(1000).optional(),
});
export type ClientShortlistInput = z.infer<typeof ClientShortlistSchema>;

export const ClientRejectSchema = z.object({
  reason: z
    .string({ required_error: 'Rejection reason is mandatory' })
    .min(5, 'Rejection reason must be at least 5 characters')
    .max(1000, 'Rejection reason cannot exceed 1000 characters'),
  feedback: z.string().max(2000).optional(),
});
export type ClientRejectInput = z.infer<typeof ClientRejectSchema>;

export const ClientRequestDetailsSchema = z.object({
  informationRequired: z
    .string({ required_error: 'Information requested is mandatory' })
    .min(5, 'Information requested must be at least 5 characters')
    .max(1000),
  additionalContext: z.string().max(2000).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
});
export type ClientRequestDetailsInput = z.infer<typeof ClientRequestDetailsSchema>;

export const ClientTeamFeedbackSchema = z.object({
  category: z.enum(['GENERAL', 'SKILLS', 'INTERVIEW_PREP', 'SUITABILITY']).default('GENERAL'),
  content: z
    .string({ required_error: 'Feedback message is mandatory' })
    .min(5, 'Feedback must be at least 5 characters')
    .max(2000),
});
export type ClientTeamFeedbackInput = z.infer<typeof ClientTeamFeedbackSchema>;

// ==========================================
// ALLOW-LIST CLIENT DTO DEFINITIONS
// (Guaranteed Zero Internal Margins or Private Data)
// ==========================================

export interface ClientSubmissionRowDTO {
  id: string;
  code: string;
  candidateName: string;
  candidateCode: string;
  jobId: string;
  jobTitle: string;
  jobCode: string;
  submittedAt: string | null;
  experienceSummary: string;
  skills: string[];
  currentStatus: string;
  clientDecision: string | null;
  clientDecisionAt: string | null;
  clientDecisionReason?: string | null;
  currentVersionTag: string;
  matchScore: number | null;
}

export interface ClientDecisionHistoryItem {
  decision: string;
  reason?: string | null;
  feedback?: string | null;
  informationRequired?: string | null;
  decidedAt: string;
  clientUserName: string;
}

export interface ClientRecruitmentFeedbackItem {
  id: string;
  category: string;
  content: string;
  createdAt: string;
  authorName: string;
}

export interface ClientSubmissionDetailDTO {
  submission: ClientSubmissionRowDTO;
  profile: ClientFacingStandardProfileDTO;
  decisionHistory: ClientDecisionHistoryItem[];
  recruitmentFeedback: ClientRecruitmentFeedbackItem[];
  cv: {
    hasCv: boolean;
    fileName: string;
    documentVersion: number;
    watermarkPreview: string;
    dailyLimit: number;
    usedToday: number;
    remainingToday: number;
  };
}

export interface ClientPositionDTO {
  id: string;
  code: string;
  title: string;
  location: string | null;
  employmentType: string | null;
  openings: number;
  descriptionSummary: string | null;
  requiredSkills: string[];
  experienceMin: number | null;
  experienceMax: number | null;
  status: string;
  candidatesSubmittedCount: number;
  interviewsActiveCount: number;
  createdAt: string;
}

export interface ClientInterviewDTO {
  id: string;
  candidateName: string;
  candidateCode: string;
  jobTitle: string;
  jobCode: string;
  roundName: string;
  scheduledAt: string;
  scheduledAtIST: string;
  duration: number;
  mode: string;
  status: string;
  meetingLink: string | null;
  participants: string[];
}

export interface ClientJobProgressItem {
  jobId: string;
  jobCode: string;
  jobTitle: string;
  status: string;
  profilesSubmitted: number;
  pendingReview: number;
  shortlisted: number;
  interviewed: number;
  filled: number;
}

export interface ClientProgressReportDTO {
  asOf: string;
  reportingPeriod: string;
  summary: {
    openPositions: number;
    profilesSubmitted: number;
    pendingReview: number;
    shortlisted: number;
    interviewsScheduled: number;
    interviewsCompleted: number;
    positionsFilled: number;
  };
  jobProgress: ClientJobProgressItem[];
}

export interface ClientPortalOverviewDTO {
  asOf: string;
  clientLegalName: string;
  clientContactName: string;
  metrics: {
    openPositions: number;
    profilesSubmitted: number;
    interviewsScheduled: number;
  };
  recentSubmissions: ClientSubmissionRowDTO[];
}
