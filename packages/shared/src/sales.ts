import { z } from 'zod';

// ==========================================
// ENUMS & STAGES
// ==========================================

export enum OpportunityStage {
  PROSPECTING = 'PROSPECTING',
  MEETING = 'MEETING',
  QUALIFICATION = 'QUALIFICATION',
  PROPOSAL = 'PROPOSAL',
  NEGOTIATION = 'NEGOTIATION',
  WON = 'WON',
  LOST = 'LOST',
}

export enum MeetingStatus {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  RESCHEDULED = 'RESCHEDULED',
  CANCELLED = 'CANCELLED',
}

export enum RecruiterActivityType {
  CALL = 'CALL',
  MEETING = 'MEETING',
  TASK = 'TASK',
  NOTE = 'NOTE',
}

export const VALID_OPPORTUNITY_STAGES = [
  OpportunityStage.PROSPECTING,
  OpportunityStage.MEETING,
  OpportunityStage.PROPOSAL,
  OpportunityStage.WON,
  OpportunityStage.LOST,
] as const;

// Allowed transitions state machine
export const ALLOWED_STAGE_TRANSITIONS: Record<OpportunityStage, OpportunityStage[]> = {
  [OpportunityStage.PROSPECTING]: [
    OpportunityStage.MEETING,
    OpportunityStage.PROPOSAL,
    OpportunityStage.LOST,
  ],
  [OpportunityStage.MEETING]: [
    OpportunityStage.PROPOSAL,
    OpportunityStage.PROSPECTING,
    OpportunityStage.LOST,
  ],
  [OpportunityStage.QUALIFICATION]: [
    OpportunityStage.MEETING,
    OpportunityStage.PROPOSAL,
    OpportunityStage.LOST,
  ],
  [OpportunityStage.PROPOSAL]: [
    OpportunityStage.NEGOTIATION,
    OpportunityStage.WON,
    OpportunityStage.LOST,
    OpportunityStage.MEETING,
  ],
  [OpportunityStage.NEGOTIATION]: [
    OpportunityStage.WON,
    OpportunityStage.LOST,
    OpportunityStage.PROPOSAL,
  ],
  [OpportunityStage.WON]: [
    // Terminal unless manager explicitly reopens to negotiation/lost
    OpportunityStage.LOST,
  ],
  [OpportunityStage.LOST]: [
    OpportunityStage.PROSPECTING,
    OpportunityStage.MEETING,
  ],
};

export function isValidStageTransition(current: OpportunityStage, target: OpportunityStage): boolean {
  if (current === target) return true;
  const allowed = ALLOWED_STAGE_TRANSITIONS[current] || [];
  return allowed.includes(target);
}

// ==========================================
// CONVERSION PREREQUISITE VALIDATION
// ==========================================

export interface ConvertOpportunityInput {
  opportunityId: string;
  opportunityStage: OpportunityStage | string;
  isAlreadyConverted: boolean;
  companyName: string;
  primaryContact: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  commercialTerms?: {
    feePercentage?: number | string | null;
    paymentTerms?: string | null;
    commercialNotes?: string | null;
  } | null;
  jobDetails: {
    title: string;
    recruiterOwnerId: string;
    openings: number;
    location?: string | null;
    employmentType?: string | null;
    description?: string | null;
  };
}

export interface ConversionValidationResult {
  allowed: boolean;
  errors: string[];
}

/**
 * Validates whether an opportunity satisfies all strict prerequisites
 * required to convert into an active Client relationship and a DRAFT Job.
 */
export function validateOpportunityConversionPrerequisites(
  input: ConvertOpportunityInput
): ConversionValidationResult {
  const errors: string[] = [];

  // 1. Stage must be WON
  if (input.opportunityStage !== OpportunityStage.WON) {
    errors.push(`Opportunity must be in '${OpportunityStage.WON}' stage before converting to a Job.`);
  }

  // 2. Race-safe idempotency: Cannot convert more than once
  if (input.isAlreadyConverted) {
    errors.push('This opportunity has already been converted into a Job mandate.');
  }

  // 3. Primary Contact required
  if (!input.primaryContact || !input.primaryContact.name || input.primaryContact.name.trim().length === 0) {
    errors.push('A valid primary client contact person with a name is required.');
  } else if (!input.primaryContact.email && !input.primaryContact.phone) {
    errors.push('Primary contact must have at least an email address or phone number.');
  }

  // 4. Commercial terms must be recorded
  const hasFee =
    input.commercialTerms?.feePercentage !== undefined &&
    input.commercialTerms?.feePercentage !== null &&
    Number(input.commercialTerms.feePercentage) > 0;
  const hasTerms =
    input.commercialTerms?.paymentTerms !== undefined &&
    input.commercialTerms?.paymentTerms !== null &&
    input.commercialTerms.paymentTerms.trim().length > 0;

  if (!hasFee && !hasTerms) {
    errors.push('Accepted client commercial terms (placement fee % or payment terms) must be recorded before conversion.');
  }

  // 5. Recruiter Owner required
  if (!input.jobDetails.recruiterOwnerId || input.jobDetails.recruiterOwnerId.trim().length === 0) {
    errors.push('A designated recruiter owner must be assigned to the new job.');
  }

  // 6. Job details required
  if (!input.jobDetails.title || input.jobDetails.title.trim().length === 0) {
    errors.push('Job mandate title is required.');
  }
  if (!input.jobDetails.openings || Number(input.jobDetails.openings) < 1) {
    errors.push('Number of openings must be at least 1.');
  }

  return {
    allowed: errors.length === 0,
    errors,
  };
}

// ==========================================
// ZOD VALIDATION SCHEMAS
// ==========================================

export const CreateOpportunitySchema = z.object({
  title: z.string().min(2, 'Opportunity title must be at least 2 characters'),
  companyName: z.string().min(2, 'Company name is required'),
  clientId: z.string().optional().nullable(),
  primaryContactId: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  contactEmail: z.string().email('Invalid contact email').optional().nullable().or(z.literal('')),
  contactPhone: z.string().optional().nullable(),
  industry: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  estimatedOpenings: z.coerce.number().int().positive().default(1),
  estimatedValue: z.coerce.number().positive().optional().nullable(),
  expectedCloseDate: z.string().optional().nullable(),
  nextFollowUpAt: z.string().optional().nullable(),
  stage: z.nativeEnum(OpportunityStage).default(OpportunityStage.PROSPECTING),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  notes: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
});

export const UpdateOpportunitySchema = CreateOpportunitySchema.partial();

export const ChangeOpportunityStageSchema = z.object({
  stage: z.nativeEnum(OpportunityStage),
  reason: z.string().optional().nullable(),
});

export const ConvertOpportunityToJobSchema = z.object({
  opportunityId: z.string().min(1, 'Opportunity ID is required'),
  contactName: z.string().min(1, 'Primary contact name is required'),
  contactEmail: z.string().email('Invalid email').optional().nullable().or(z.literal('')),
  contactPhone: z.string().optional().nullable(),
  feePercentage: z.coerce.number().min(1).max(100).default(8.33),
  paymentTerms: z.string().default('NET_30'),
  jobTitle: z.string().min(2, 'Job title is required'),
  recruiterOwnerId: z.string().min(1, 'Recruiter owner is required'),
  openings: z.coerce.number().int().positive().default(1),
  location: z.string().optional().nullable(),
  employmentType: z.string().default('FULL_TIME'),
  description: z.string().optional().nullable(),
});

export const ScheduleClientMeetingSchema = z.object({
  clientId: z.string().optional().nullable(),
  opportunityId: z.string().optional().nullable(),
  contactName: z.string().min(1, 'Contact person name is required'),
  contactEmail: z.string().email('Invalid contact email').optional().nullable().or(z.literal('')),
  title: z.string().min(2, 'Meeting title is required'),
  description: z.string().optional().nullable(),
  meetingType: z.string().default('CLIENT_DISCOVERY'),
  scheduledAt: z.string().min(1, 'Meeting date and time is required'),
  durationMinutes: z.coerce.number().int().positive().default(30),
  calendarProvider: z.string().default('DEMO_MODE'),
  notes: z.string().optional().nullable(),
});

export const UpdateMeetingOutcomeSchema = z.object({
  status: z.nativeEnum(MeetingStatus),
  outcome: z.string().min(2, 'Outcome summary is required'),
  notes: z.string().optional().nullable(),
  nextAction: z.string().optional().nullable(),
  nextFollowUpAt: z.string().optional().nullable(),
});

export const LogRecruiterActivitySchema = z.object({
  type: z.nativeEnum(RecruiterActivityType),
  relatedCandidateId: z.string().optional().nullable(),
  relatedClientId: z.string().optional().nullable(),
  relatedOpportunityId: z.string().optional().nullable(),
  durationMinutes: z.coerce.number().int().nonnegative().optional().nullable(),
  outcome: z.string().optional().nullable(),
  notes: z.string().min(1, 'Activity notes or summary is required'),
  date: z.string().optional().nullable(),
});

export const UpdateRecruiterTargetSchema = z.object({
  period: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).default('DAILY'),
  targetCandidatesSourced: z.coerce.number().int().nonnegative().default(10),
  targetCalls: z.coerce.number().int().nonnegative().default(20),
  targetEmails: z.coerce.number().int().nonnegative().default(15),
  targetSubmissions: z.coerce.number().int().nonnegative().default(3),
  targetInterviews: z.coerce.number().int().nonnegative().default(2),
});

// ==========================================
// ANTI-LEAK PRIVACY DTO SERIALIZERS
// ==========================================

export function serializeOpportunitySafe(opp: any) {
  return {
    id: opp.id,
    title: opp.title,
    companyName: opp.companyName,
    ownerId: opp.ownerId,
    clientId: opp.clientId,
    stage: opp.stage,
    priority: opp.priority,
    estimatedValue: opp.estimatedValue ? Number(opp.estimatedValue) : null,
    estimatedOpenings: opp.estimatedOpenings || 1,
    industry: opp.industry,
    location: opp.location,
    nextFollowUpAt: opp.nextFollowUpAt ? new Date(opp.nextFollowUpAt).toISOString() : null,
    expectedCloseDate: opp.expectedCloseDate ? new Date(opp.expectedCloseDate).toISOString() : null,
    notes: opp.notes,
    isConverted: Boolean(opp.convertedJobId),
    convertedJobId: opp.convertedJobId,
    convertedAt: opp.convertedAt ? new Date(opp.convertedAt).toISOString() : null,
    owner: opp.owner
      ? {
          id: opp.owner.id,
          name: opp.owner.name,
          email: opp.owner.email,
        }
      : null,
    primaryContact: {
      id: opp.primaryContactId,
      name: opp.contactName || opp.primaryContact?.name,
      email: opp.contactEmail || opp.primaryContact?.email,
      phone: opp.contactPhone || opp.primaryContact?.phone,
    },
    client: opp.client
      ? {
          id: opp.client.id,
          legalName: opp.client.legalName,
          status: opp.client.status,
        }
      : null,
    createdAt: opp.createdAt ? new Date(opp.createdAt).toISOString() : null,
  };
}
