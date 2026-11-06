import { z } from 'zod';

export enum InterviewOutcome {
  SCHEDULED = 'SCHEDULED',
  COMPLETED = 'COMPLETED',
  NO_SHOW = 'NO_SHOW',
  RESCHEDULED = 'RESCHEDULED',
  CANCELLED = 'CANCELLED',
}

export enum InterviewMode {
  VIDEO = 'VIDEO',
  PHONE = 'PHONE',
  IN_PERSON = 'IN_PERSON',
}

export enum VideoProvider {
  GOOGLE_MEET = 'GOOGLE_MEET',
  ZOOM = 'ZOOM',
  TEAMS = 'TEAMS',
}

export enum PanelRecommendation {
  STRONG_YES = 'STRONG_YES',
  YES = 'YES',
  MAYBE = 'MAYBE',
  NO = 'NO',
  STRONG_NO = 'STRONG_NO',
}

export const RECOMMENDATION_LABELS: Record<PanelRecommendation, string> = {
  [PanelRecommendation.STRONG_YES]: 'Strong Yes',
  [PanelRecommendation.YES]: 'Yes',
  [PanelRecommendation.MAYBE]: 'Maybe',
  [PanelRecommendation.NO]: 'No',
  [PanelRecommendation.STRONG_NO]: 'Strong No',
};

// ==========================================
// IST / UTC DATE & TIMEZONE HELPERS
// ==========================================

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';
export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30

/**
 * Returns IST week boundaries (Monday 00:00:00 to Sunday 23:59:59.999) converted to UTC Date objects.
 */
export function getISTWeekBoundaries(referenceDate: Date = new Date()): {
  startOfWeekUtc: Date;
  endOfWeekUtc: Date;
  startOfWeekIST: string;
  endOfWeekIST: string;
  weekLabel: string;
  days: Array<{
    dateStr: string; // YYYY-MM-DD
    displayLabel: string; // "Mon, 10 Nov"
    dayName: string; // "Mon"
    dayNumber: number; // 10
    dayIndex: number; // 0..6
    isToday: boolean;
  }>;
} {
  // Convert referenceDate to IST timestamp
  const istTime = new Date(referenceDate.getTime() + IST_OFFSET_MS);
  const istYear = istTime.getUTCFullYear();
  const istMonth = istTime.getUTCMonth();
  const istDate = istTime.getUTCDate();
  const istDay = istTime.getUTCDay(); // 0 = Sun, 1 = Mon ... 6 = Sat

  // Distance from Monday (0 in our 0..6 index where Mon=0, Sun=6)
  const diffToMonday = (istDay + 6) % 7;

  // Monday 00:00:00 IST
  const mondayUtcTime = Date.UTC(istYear, istMonth, istDate - diffToMonday, 0, 0, 0, 0) - IST_OFFSET_MS;
  const startOfWeekUtc = new Date(mondayUtcTime);

  // Sunday 23:59:59.999 IST
  const sundayUtcTime = Date.UTC(istYear, istMonth, istDate - diffToMonday + 6, 23, 59, 59, 999) - IST_OFFSET_MS;
  const endOfWeekUtc = new Date(sundayUtcTime);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const days: Array<{
    dateStr: string;
    displayLabel: string;
    dayName: string;
    dayNumber: number;
    dayIndex: number;
    isToday: boolean;
  }> = [];

  const nowIst = new Date(Date.now() + IST_OFFSET_MS);
  const todayStr = `${nowIst.getUTCFullYear()}-${String(nowIst.getUTCMonth() + 1).padStart(2, '0')}-${String(nowIst.getUTCDate()).padStart(2, '0')}`;

  for (let i = 0; i < 7; i++) {
    const dayIst = new Date(mondayUtcTime + IST_OFFSET_MS + i * 24 * 60 * 60 * 1000);
    const y = dayIst.getUTCFullYear();
    const m = dayIst.getUTCMonth();
    const d = dayIst.getUTCDate();
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    days.push({
      dateStr,
      displayLabel: `${dayNames[i]}, ${d} ${months[m]}`,
      dayName: dayNames[i],
      dayNumber: d,
      dayIndex: i,
      isToday: dateStr === todayStr,
    });
  }

  const mon = days[0];
  const sun = days[6];
  const weekLabel = `${mon.dayNumber} ${months[new Date(mondayUtcTime + IST_OFFSET_MS).getUTCMonth()]} – ${sun.dayNumber} ${months[new Date(sundayUtcTime + IST_OFFSET_MS).getUTCMonth()]} ${istYear} (IST)`;

  return {
    startOfWeekUtc,
    endOfWeekUtc,
    startOfWeekIST: days[0].dateStr,
    endOfWeekIST: days[6].dateStr,
    weekLabel,
    days,
  };
}

/**
 * Converts a UTC Date or ISO string to an IST formatted string.
 */
export function formatToISTTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const istDate = new Date(d.getTime() + IST_OFFSET_MS);
  let hours = istDate.getUTCHours();
  const minutes = istDate.getUTCMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hours}:${minStr} ${ampm} IST`;
}

export function formatToISTDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const istDate = new Date(d.getTime() + IST_OFFSET_MS);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${istDate.getUTCDate()} ${months[istDate.getUTCMonth()]} ${istDate.getUTCFullYear()}`;
}

export function getISTDayIndex(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date;
  const istDate = new Date(d.getTime() + IST_OFFSET_MS);
  const day = istDate.getUTCDay(); // 0 = Sun, 1 = Mon ...
  return (day + 6) % 7; // 0 = Mon, 6 = Sun
}

// ==========================================
// DOUBLE-BOOKING & CONFLICT DETECTION
// ==========================================

export function isTimeOverlapping(
  startA: Date,
  durationMinutesA: number,
  startB: Date,
  durationMinutesB: number
): boolean {
  const endA = new Date(startA.getTime() + durationMinutesA * 60 * 1000);
  const endB = new Date(startB.getTime() + durationMinutesB * 60 * 1000);

  // Overlap condition: startA < endB AND startB < endA
  return startA.getTime() < endB.getTime() && startB.getTime() < endA.getTime();
}

// ==========================================
// AVAILABILITY PROVIDER ABSTRACTION
// ==========================================

export interface PanelMemberAvailability {
  userId: string;
  userName: string;
  status: 'FREE' | 'BUSY';
  isConflict: boolean;
  // STRICT PRIVACY GUARANTEE: Never reveal private calendar event descriptions, titles, or notes!
  slot?: {
    startTimeIST: string;
    endTimeIST: string;
  };
}

export interface AvailabilityCheckResult {
  isAvailable: boolean;
  providerStatus: 'CONNECTED' | 'NOT_CONNECTED' | 'SETUP_REQUIRED';
  panelMembers: PanelMemberAvailability[];
  alternativeSlotsSuggested: Array<{
    startTimeUtc: string;
    startTimeIST: string;
    endTimeIST: string;
  }>;
}

export class MockCalendarAvailabilityProvider {
  /**
   * Checks panel availability against known scheduled interviews.
   * Enforces strict privacy masking.
   */
  static checkAvailability(
    proposedStartUtc: Date,
    durationMinutes: number,
    panelMembers: Array<{ id: string; name: string }>,
    existingInterviews: Array<{
      id: string;
      scheduledAt: Date;
      duration: number;
      outcome: InterviewOutcome;
      panelUserIds: string[];
    }>,
    excludeInterviewId?: string
  ): AvailabilityCheckResult {
    const endUtc = new Date(proposedStartUtc.getTime() + durationMinutes * 60 * 1000);

    const activeInterviews = existingInterviews.filter(
      (inv) =>
        inv.id !== excludeInterviewId &&
        inv.outcome !== InterviewOutcome.CANCELLED &&
        inv.outcome !== InterviewOutcome.COMPLETED
    );

    const memberResults: PanelMemberAvailability[] = panelMembers.map((member) => {
      // Find conflicting interviews for this specific panel member
      const conflict = activeInterviews.find(
        (inv) =>
          inv.panelUserIds.includes(member.id) &&
          isTimeOverlapping(proposedStartUtc, durationMinutes, inv.scheduledAt, inv.duration)
      );

      if (conflict) {
        return {
          userId: member.id,
          userName: member.name,
          status: 'BUSY',
          isConflict: true,
          slot: {
            startTimeIST: formatToISTTime(conflict.scheduledAt),
            endTimeIST: formatToISTTime(
              new Date(conflict.scheduledAt.getTime() + conflict.duration * 60 * 1000)
            ),
          },
        };
      }

      return {
        userId: member.id,
        userName: member.name,
        status: 'FREE',
        isConflict: false,
      };
    });

    const hasAnyConflict = memberResults.some((m) => m.isConflict);

    // Suggest 2 alternative slots (+1 hour, +2 hours) if conflict exists
    const alternatives: Array<{ startTimeUtc: string; startTimeIST: string; endTimeIST: string }> = [];
    if (hasAnyConflict) {
      for (const offsetHours of [1, 2, 3]) {
        const altStart = new Date(proposedStartUtc.getTime() + offsetHours * 60 * 60 * 1000);
        const altEnd = new Date(altStart.getTime() + durationMinutes * 60 * 1000);
        // Check if all members are free at altStart
        const altConflict = activeInterviews.some(
          (inv) =>
            inv.panelUserIds.some((pId) => panelMembers.some((m) => m.id === pId)) &&
            isTimeOverlapping(altStart, durationMinutes, inv.scheduledAt, inv.duration)
        );
        if (!altConflict) {
          alternatives.push({
            startTimeUtc: altStart.toISOString(),
            startTimeIST: formatToISTTime(altStart),
            endTimeIST: formatToISTTime(altEnd),
          });
          if (alternatives.length >= 2) break;
        }
      }
    }

    return {
      isAvailable: !hasAnyConflict,
      providerStatus: 'NOT_CONNECTED', // Accurately reflects that external Google/Outlook is not linked
      panelMembers: memberResults,
      alternativeSlotsSuggested: alternatives,
    };
  }
}

// ==========================================
// MOCK VIDEO MEETING PROVIDERS
// ==========================================

export interface GeneratedMeetingLink {
  provider: VideoProvider;
  meetingUrl: string;
  providerStatus: 'DEMO_MODE';
  instructions: string;
}

export class MockVideoMeetingProvider {
  static generateMeetingLink(
    provider: VideoProvider,
    interviewId: string
  ): GeneratedMeetingLink {
    const shortCode = interviewId.slice(0, 8);

    switch (provider) {
      case VideoProvider.ZOOM:
        return {
          provider: VideoProvider.ZOOM,
          meetingUrl: `https://zoom.us/j/demo-hf-${shortCode}`,
          providerStatus: 'DEMO_MODE',
          instructions: 'Demo Zoom link generated. Production Zoom API connects in Prompt 25.',
        };
      case VideoProvider.TEAMS:
        return {
          provider: VideoProvider.TEAMS,
          meetingUrl: `https://teams.microsoft.com/l/meetup-join/demo-hf-${shortCode}`,
          providerStatus: 'DEMO_MODE',
          instructions: 'Demo MS Teams link generated. Production Teams API connects in Prompt 25.',
        };
      case VideoProvider.GOOGLE_MEET:
      default:
        return {
          provider: VideoProvider.GOOGLE_MEET,
          meetingUrl: `https://meet.google.com/demo-hf-${shortCode}`,
          providerStatus: 'DEMO_MODE',
          instructions: 'Demo Google Meet link generated. Production Google Workspace connects in Prompt 25.',
        };
    }
  }
}

// ==========================================
// REMINDER CONFIGURATION HELPER
// ==========================================

export interface ReminderConfig {
  reminder24h: boolean;
  reminder30m: boolean;
  recipients: {
    candidate: boolean;
    panel: boolean;
    recruiter: boolean;
  };
  scheduledDispatches: Array<{
    type: '24H_BEFORE' | '30M_BEFORE';
    dispatchAtUtc: string;
    status: 'QUEUED_MOCK';
  }>;
}

export function buildReminderConfig(
  scheduledAtUtc: Date,
  reminder24h: boolean = true,
  reminder30m: boolean = true,
  recipients: { candidate: boolean; panel: boolean; recruiter: boolean } = {
    candidate: true,
    panel: true,
    recruiter: true,
  }
): ReminderConfig {
  const dispatches: ReminderConfig['scheduledDispatches'] = [];

  if (reminder24h) {
    const dispatchTime = new Date(scheduledAtUtc.getTime() - 24 * 60 * 60 * 1000);
    dispatches.push({
      type: '24H_BEFORE',
      dispatchAtUtc: dispatchTime.toISOString(),
      status: 'QUEUED_MOCK',
    });
  }

  if (reminder30m) {
    const dispatchTime = new Date(scheduledAtUtc.getTime() - 30 * 60 * 1000);
    dispatches.push({
      type: '30M_BEFORE',
      dispatchAtUtc: dispatchTime.toISOString(),
      status: 'QUEUED_MOCK',
    });
  }

  return {
    reminder24h,
    reminder30m,
    recipients,
    scheduledDispatches: dispatches,
  };
}

// ==========================================
// INTERVIEW STATE MACHINE & ATS RULES
// ==========================================

export function validateInterviewTransition(
  currentOutcome: InterviewOutcome,
  newOutcome: InterviewOutcome
): { valid: boolean; error?: string } {
  if (currentOutcome === newOutcome) {
    return { valid: true };
  }

  switch (currentOutcome) {
    case InterviewOutcome.SCHEDULED:
      if (
        [
          InterviewOutcome.COMPLETED,
          InterviewOutcome.NO_SHOW,
          InterviewOutcome.RESCHEDULED,
          InterviewOutcome.CANCELLED,
        ].includes(newOutcome)
      ) {
        return { valid: true };
      }
      return {
        valid: false,
        error: `Cannot transition interview from SCHEDULED to ${newOutcome}`,
      };

    case InterviewOutcome.RESCHEDULED:
      if (
        [
          InterviewOutcome.COMPLETED,
          InterviewOutcome.NO_SHOW,
          InterviewOutcome.CANCELLED,
          InterviewOutcome.RESCHEDULED,
        ].includes(newOutcome)
      ) {
        return { valid: true };
      }
      return {
        valid: false,
        error: `Cannot transition interview from RESCHEDULED to ${newOutcome}`,
      };

    case InterviewOutcome.COMPLETED:
      return {
        valid: false,
        error: 'Completed interviews are immutable and cannot be rescheduled or marked no-show.',
      };

    case InterviewOutcome.CANCELLED:
      return {
        valid: false,
        error: 'Cancelled interviews cannot be modified without a formal recovery workflow.',
      };

    case InterviewOutcome.NO_SHOW:
      if (newOutcome === InterviewOutcome.RESCHEDULED) {
        return { valid: true }; // Recruiter can decide to reschedule a no-show
      }
      return {
        valid: false,
        error: 'A no-show interview cannot be marked completed directly. It must be rescheduled first.',
      };

    default:
      return { valid: false, error: 'Unknown interview outcome' };
  }
}

// ==========================================
// ANTI-LEAK PRIVACY DTO SERIALIZER
// ==========================================

export interface ClientSafeInterviewDTO {
  id: string;
  roundName: string;
  scheduledAt: string;
  duration: number;
  timezone: string;
  mode: string;
  outcome: string;
  // STRICT ATS DATA PRIVACY:
  // - NO internal panel feedback
  // - NO internal rejection or outcome notes
  // - NO recruiter commercial margins
}

export function serializeInterviewForClient(interview: any): ClientSafeInterviewDTO {
  return {
    id: interview.id,
    roundName: interview.round?.name || 'Interview Round',
    scheduledAt: interview.scheduledAt instanceof Date ? interview.scheduledAt.toISOString() : interview.scheduledAt,
    duration: interview.duration,
    timezone: interview.timezone || DEFAULT_TIMEZONE,
    mode: interview.mode || 'VIDEO',
    outcome: interview.outcome,
  };
}

// ==========================================
// ZOD VALIDATION SCHEMAS
// ==========================================

export const ScheduleInterviewInputSchema = z.object({
  applicationId: z.string().min(1, 'Valid application ID is required'),
  roundId: z.string().optional().nullable(),
  scheduledAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Valid ISO scheduled date-time is required',
  }),
  duration: z.number().int().min(15).max(240).default(45),
  timezone: z.string().default(DEFAULT_TIMEZONE),
  mode: z.nativeEnum(InterviewMode).default(InterviewMode.VIDEO),
  provider: z.nativeEnum(VideoProvider).default(VideoProvider.GOOGLE_MEET),
  panelMemberIds: z.array(z.string().min(1)).min(1, 'At least one panel member is required'),
  reminder24h: z.boolean().default(true),
  reminder30m: z.boolean().default(true),
  recipients: z
    .object({
      candidate: z.boolean().default(true),
      panel: z.boolean().default(true),
      recruiter: z.boolean().default(true),
    })
    .default({ candidate: true, panel: true, recruiter: true }),
});

export const RescheduleInterviewInputSchema = z.object({
  newScheduledAt: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Valid ISO scheduled date-time is required',
  }),
  duration: z.number().int().min(15).max(240).optional(),
  rescheduleReason: z.string().min(3, 'Reschedule reason is mandatory and must be at least 3 characters'),
});

export const CancelInterviewInputSchema = z.object({
  cancellationReason: z.string().min(3, 'Cancellation reason is mandatory and must be at least 3 characters'),
});

export const CompleteInterviewInputSchema = z.object({
  outcomeNotes: z.string().optional().nullable(),
});

export const NoShowInterviewInputSchema = z.object({
  noShowReason: z.string().optional().nullable(),
});

export const PanelFeedbackInputSchema = z.object({
  rating: z.number().int().min(1).max(5, 'Rating must be between 1 and 5 stars'),
  recommendation: z.nativeEnum(PanelRecommendation),
  strengths: z.string().optional().nullable(),
  concerns: z.string().optional().nullable(),
  technicalScore: z.number().int().min(1).max(10).optional().nullable(),
  feedback: z.string().min(5, 'Feedback comments must be at least 5 characters'),
});

export const CreateFollowUpTaskInputSchema = z.object({
  title: z.string().min(3, 'Task title is required'),
  description: z.string().optional().nullable(),
  assignedToId: z.string().min(1, 'Valid assignee ID is required'),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  relatedApplicationId: z.string().optional().nullable(),
});
