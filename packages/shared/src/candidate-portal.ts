import { z } from 'zod';

export const CandidateApplicationDTOSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  jobTitle: z.string(),
  companyName: z.string(),
  location: z.string(),
  appliedAt: z.string(),
  status: z.string(),
  statusPillVariant: z.enum(['purple', 'blue', 'amber', 'emerald', 'gray', 'red']),
  nextStep: z.string(),
  activeSlotInvitation: z
    .object({
      id: z.string(),
      token: z.string(),
      expiresAt: z.string(),
      roundName: z.string(),
    })
    .optional()
    .nullable(),
});

export type CandidateApplicationDTO = z.infer<typeof CandidateApplicationDTOSchema>;

export const CandidateInterviewDTOSchema = z.object({
  id: z.string(),
  jobTitle: z.string(),
  roundName: z.string(),
  scheduledAt: z.string(),
  duration: z.number(),
  timezone: z.string(),
  mode: z.string(),
  provider: z.string(),
  meetingLink: z.string().nullable().optional(),
  providerStatus: z.string(),
  canReschedule: z.boolean(),
});

export type CandidateInterviewDTO = z.infer<typeof CandidateInterviewDTOSchema>;

export const CandidateProfileDTOSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable().optional(),
  currentTitle: z.string().nullable().optional(),
  currentCompany: z.string().nullable().optional(),
  experienceYears: z.number().nullable().optional(),
  location: z.string().nullable().optional(),
  skills: z.array(z.string()),
  completenessScore: z.number().int().min(0).max(100),
});

export type CandidateProfileDTO = z.infer<typeof CandidateProfileDTOSchema>;

export interface CandidatePortalPayload {
  profile: CandidateProfileDTO;
  applications: CandidateApplicationDTO[];
  upcomingInterviews: CandidateInterviewDTO[];
}

export const UpdateCandidateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
  currentTitle: z.string().max(100).optional().nullable(),
  currentCompany: z.string().max(100).optional().nullable(),
  location: z.string().max(100).optional().nullable(),
  skills: z.array(z.string()).optional(),
});

export type UpdateCandidateProfileInput = z.infer<typeof UpdateCandidateProfileSchema>;

/**
 * Calculates candidate profile completeness score (0-100%).
 */
export function calculateProfileCompleteness(candidate: {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  currentTitle?: string | null;
  currentCompany?: string | null;
  experienceYears?: any;
  location?: string | null;
  skills?: string[] | null;
}): number {
  let score = 0;
  if (candidate.name) score += 20;
  if (candidate.email) score += 20;
  if (candidate.phone) score += 15;
  if (candidate.currentTitle) score += 15;
  if (candidate.currentCompany) score += 10;
  if (candidate.location) score += 10;
  if (candidate.skills && candidate.skills.length > 0) score += 10;
  return Math.min(score, 100);
}

/**
 * Anti-leak serializer for Candidate Application records.
 * Strips internal recruiter notes, fee structures, margin rates, and reviewer feedback.
 */
export function serializeCandidateApplication(app: any): CandidateApplicationDTO {
  let statusText = 'Application Received';
  let pillVariant: CandidateApplicationDTO['statusPillVariant'] = 'blue';
  let nextStep = 'Your application is under review by the hiring team.';

  const rawStatus = (app.status || '').toUpperCase();
  if (rawStatus === 'SCREENING') {
    statusText = 'Under Review';
    pillVariant = 'blue';
    nextStep = 'Recruiting team is reviewing your profile credentials.';
  } else if (rawStatus === 'INTERVIEW') {
    statusText = 'Interview Stage';
    pillVariant = 'purple';
    nextStep = 'Interview round scheduled or awaiting slot selection.';
  } else if (rawStatus === 'CLIENT_SUBMISSION') {
    statusText = 'Client Review';
    pillVariant = 'amber';
    nextStep = 'Your profile is currently under review with the client hiring manager.';
  } else if (rawStatus === 'OFFER' || rawStatus === 'HIRED') {
    statusText = 'Offer Extended';
    pillVariant = 'emerald';
    nextStep = 'Congratulations! Your offer details are being finalized.';
  } else if (rawStatus === 'REJECTED') {
    statusText = 'Archived';
    pillVariant = 'gray';
    nextStep = 'This role is currently filled or closed. We will notify you of future matches.';
  }

  // Active slot invitation if available
  let activeSlot: CandidateApplicationDTO['activeSlotInvitation'] = null;
  if (app.slotInvitations && app.slotInvitations.length > 0) {
    const pending = app.slotInvitations.find((si: any) => si.status === 'PENDING' && new Date(si.expiresAt) > new Date());
    if (pending) {
      activeSlot = {
        id: pending.id,
        token: pending.token,
        expiresAt: new Date(pending.expiresAt).toISOString(),
        roundName: pending.roundId || 'Technical Round',
      };
      statusText = 'Action Required';
      pillVariant = 'purple';
      nextStep = 'Please select your preferred interview time slot.';
    }
  }

  return {
    id: app.id,
    jobId: app.job?.id || app.jobId,
    jobTitle: app.job?.title || 'Open Mandate',
    companyName: app.job?.client?.name || 'Aureva Capital Partner',
    location: app.job?.location || 'Remote',
    appliedAt: app.appliedAt ? new Date(app.appliedAt).toISOString() : new Date().toISOString(),
    status: statusText,
    statusPillVariant: pillVariant,
    nextStep,
    activeSlotInvitation: activeSlot,
  };
}

/**
 * Anti-leak serializer for Candidate Interview records.
 * Strips internal panel reviewer scorecards, private feedback, and confidential recruiter notes.
 */
export function serializeCandidateInterview(interview: any): CandidateInterviewDTO {
  const roundName = interview.round?.name || 'Interview Round';
  const meetingLink = interview.videoMeeting?.joinUrl || interview.meetingLink || null;
  const providerStatus = interview.videoMeeting?.status || 'CREATED';
  const isPast = new Date(interview.scheduledAt).getTime() < Date.now();
  const canReschedule = !isPast && interview.outcome === 'SCHEDULED';

  return {
    id: interview.id,
    jobTitle: interview.application?.job?.title || 'Mandate Interview',
    roundName,
    scheduledAt: new Date(interview.scheduledAt).toISOString(),
    duration: interview.duration || 45,
    timezone: interview.timezone || 'Asia/Kolkata',
    mode: interview.mode || 'VIDEO',
    provider: interview.provider || 'GOOGLE_MEET',
    meetingLink,
    providerStatus,
    canReschedule,
  };
}

/**
 * Anti-leak serializer for Candidate Profile.
 * Completely strips expectedSalary, currentSalary, ownerId, internal notes, tags, and archive reasons.
 */
export function serializeCandidateProfile(cand: any): CandidateProfileDTO {
  return {
    id: cand.id,
    code: cand.code,
    name: cand.name,
    email: cand.email,
    phone: cand.phone || null,
    currentTitle: cand.currentTitle || null,
    currentCompany: cand.currentCompany || null,
    experienceYears: cand.experienceYears ? Number(cand.experienceYears) : null,
    location: cand.location || null,
    skills: cand.skills || [],
    completenessScore: calculateProfileCompleteness(cand),
  };
}

/**
 * Verification contract: ensures serialized DTO has zero prohibited internal keywords.
 */
export function assertCandidateSafe(payload: any): void {
  const json = JSON.stringify(payload).toLowerCase();
  const forbidden = [
    'feepercentage',
    'paymentterms',
    'commercialterms',
    'currentsalary',
    'expectedsalary',
    'recruitermargin',
    'internalnote',
    'reviewerfeedback',
    'scorecard',
    'technicalscore',
    'archivereason',
  ];

  for (const word of forbidden) {
    if (json.includes(word)) {
      throw new Error(`CANDIDATE_DATA_LEAK_DETECTED: Forbidden keyword '${word}' detected in candidate payload!`);
    }
  }
}
