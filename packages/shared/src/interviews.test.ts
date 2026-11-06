import { describe, it, expect } from 'vitest';
import {
  InterviewOutcome,
  InterviewMode,
  VideoProvider,
  PanelRecommendation,
  getISTWeekBoundaries,
  formatToISTTime,
  formatToISTDate,
  isTimeOverlapping,
  MockCalendarAvailabilityProvider,
  MockVideoMeetingProvider,
  buildReminderConfig,
  validateInterviewTransition,
  serializeInterviewForClient,
  ScheduleInterviewInputSchema,
  PanelFeedbackInputSchema,
} from './interviews';

describe('HireFlow Interviews Domain Engine', () => {
  describe('IST / UTC Week Boundaries & Timezone', () => {
    it('calculates 7 days with Monday start and Sunday end in IST', () => {
      // 2026-11-06 is a Friday in IST
      const refDate = new Date('2026-11-06T15:00:00Z'); // 8:30 PM IST
      const week = getISTWeekBoundaries(refDate);

      expect(week.days).toHaveLength(7);
      expect(week.days[0].dayName).toBe('Mon');
      expect(week.days[6].dayName).toBe('Sun');
      expect(week.weekLabel).toContain('IST');
      expect(week.startOfWeekUtc.getTime()).toBeLessThan(week.endOfWeekUtc.getTime());
    });

    it('formats UTC dates into human-readable IST strings', () => {
      // 2026-11-06T09:00:00Z + 5:30 = 14:30 (2:30 PM)
      const dateUtc = new Date('2026-11-06T09:00:00Z');
      const timeStr = formatToISTTime(dateUtc);
      expect(timeStr).toBe('2:30 PM IST');

      const dateStr = formatToISTDate(dateUtc);
      expect(dateStr).toContain('Nov 2026');
    });
  });

  describe('Conflict Detection & Double-Booking Prevention', () => {
    it('accurately identifies overlapping time windows', () => {
      const startA = new Date('2026-11-10T10:00:00Z');
      const startB = new Date('2026-11-10T10:30:00Z');
      const startC = new Date('2026-11-10T11:00:00Z');

      // Slot A (10:00-11:00) overlaps Slot B (10:30-11:15)
      expect(isTimeOverlapping(startA, 60, startB, 45)).toBe(true);

      // Slot A (10:00-11:00) does not overlap Slot C (11:00-12:00)
      expect(isTimeOverlapping(startA, 60, startC, 60)).toBe(false);
    });

    it('checks panel availability with mock provider and strictly masks private details', () => {
      const proposedStart = new Date('2026-11-10T10:00:00Z');
      const panelMembers = [
        { id: 'user-1', name: 'Vikram Joshi' },
        { id: 'user-2', name: 'Priya Sharma' },
      ];

      const existingInterviews = [
        {
          id: 'int-existing-1',
          scheduledAt: new Date('2026-11-10T09:30:00Z'),
          duration: 60, // 09:30 - 10:30 -> overlaps with 10:00
          outcome: InterviewOutcome.SCHEDULED,
          panelUserIds: ['user-1'],
        },
      ];

      const result = MockCalendarAvailabilityProvider.checkAvailability(
        proposedStart,
        45,
        panelMembers,
        existingInterviews
      );

      expect(result.isAvailable).toBe(false);
      expect(result.providerStatus).toBe('NOT_CONNECTED');

      const user1 = result.panelMembers.find((m) => m.userId === 'user-1');
      expect(user1?.isConflict).toBe(true);
      expect(user1?.status).toBe('BUSY');

      const user2 = result.panelMembers.find((m) => m.userId === 'user-2');
      expect(user2?.isConflict).toBe(false);
      expect(user2?.status).toBe('FREE');

      // Ensure alternative slots are suggested
      expect(result.alternativeSlotsSuggested.length).toBeGreaterThan(0);

      // Verify strict privacy mask (no internal titles or private calendar notes)
      expect(JSON.stringify(result)).not.toContain('confidential');
      expect(JSON.stringify(result)).not.toContain('Salary discussion');
    });
  });

  describe('Mock Video Providers', () => {
    it('generates demo Google Meet link with clear DEMO_MODE label', () => {
      const link = MockVideoMeetingProvider.generateMeetingLink(
        VideoProvider.GOOGLE_MEET,
        '123e4567-e89b-12d3-a456-426614174000'
      );
      expect(link.provider).toBe(VideoProvider.GOOGLE_MEET);
      expect(link.meetingUrl).toContain('meet.google.com/demo-hf-123e4567');
      expect(link.providerStatus).toBe('DEMO_MODE');
    });

    it('generates demo Zoom and Teams links with clear DEMO_MODE label', () => {
      const zoom = MockVideoMeetingProvider.generateMeetingLink(
        VideoProvider.ZOOM,
        'abcdef12-1234-5678-90ab-cdef12345678'
      );
      expect(zoom.meetingUrl).toContain('zoom.us/j/demo-hf-abcdef12');

      const teams = MockVideoMeetingProvider.generateMeetingLink(
        VideoProvider.TEAMS,
        'abcdef12-1234-5678-90ab-cdef12345678'
      );
      expect(teams.meetingUrl).toContain('teams.microsoft.com');
    });
  });

  describe('Reminder Configuration', () => {
    it('calculates 24h and 30m UTC dispatch timestamps', () => {
      const scheduledAt = new Date('2026-11-10T14:00:00Z');
      const reminders = buildReminderConfig(scheduledAt, true, true);

      expect(reminders.reminder24h).toBe(true);
      expect(reminders.reminder30m).toBe(true);
      expect(reminders.scheduledDispatches).toHaveLength(2);

      const d24 = new Date(reminders.scheduledDispatches[0].dispatchAtUtc);
      expect(d24.getTime()).toBe(scheduledAt.getTime() - 24 * 60 * 60 * 1000);

      const d30 = new Date(reminders.scheduledDispatches[1].dispatchAtUtc);
      expect(d30.getTime()).toBe(scheduledAt.getTime() - 30 * 60 * 1000);
    });
  });

  describe('Interview State Machine & Outcome Transition Rules', () => {
    it('allows valid lifecycle transitions from SCHEDULED', () => {
      expect(validateInterviewTransition(InterviewOutcome.SCHEDULED, InterviewOutcome.COMPLETED).valid).toBe(true);
      expect(validateInterviewTransition(InterviewOutcome.SCHEDULED, InterviewOutcome.NO_SHOW).valid).toBe(true);
      expect(validateInterviewTransition(InterviewOutcome.SCHEDULED, InterviewOutcome.RESCHEDULED).valid).toBe(true);
      expect(validateInterviewTransition(InterviewOutcome.SCHEDULED, InterviewOutcome.CANCELLED).valid).toBe(true);
    });

    it('allows rescheduling from NO_SHOW', () => {
      expect(validateInterviewTransition(InterviewOutcome.NO_SHOW, InterviewOutcome.RESCHEDULED).valid).toBe(true);
    });

    it('blocks invalid transitions from terminal states', () => {
      // Completed interviews cannot be marked no-show or rescheduled
      expect(validateInterviewTransition(InterviewOutcome.COMPLETED, InterviewOutcome.NO_SHOW).valid).toBe(false);
      expect(validateInterviewTransition(InterviewOutcome.COMPLETED, InterviewOutcome.RESCHEDULED).valid).toBe(false);

      // Cancelled interviews cannot be marked completed directly
      expect(validateInterviewTransition(InterviewOutcome.CANCELLED, InterviewOutcome.COMPLETED).valid).toBe(false);
    });
  });

  describe('Anti-Leak Serialization for Client & Candidate', () => {
    it('strictly omits panel feedback, outcome notes, and internal comments', () => {
      const internalInterview = {
        id: 'inv-123',
        scheduledAt: new Date('2026-11-10T10:00:00Z'),
        duration: 45,
        timezone: 'Asia/Kolkata',
        mode: 'VIDEO',
        outcome: InterviewOutcome.COMPLETED,
        outcomeNotes: 'Candidate demonstrated strong React expertise but weak SQL',
        feedbacks: [
          {
            rating: 4,
            recommendation: PanelRecommendation.YES,
            feedback: 'Hire him immediately, top talent!',
            strengths: 'Architecture',
            concerns: 'Salary expectations high',
          },
        ],
      };

      const clientDto = serializeInterviewForClient(internalInterview);
      expect(clientDto.id).toBe('inv-123');
      expect((clientDto as any).feedbacks).toBeUndefined();
      expect((clientDto as any).outcomeNotes).toBeUndefined();
      expect(JSON.stringify(clientDto)).not.toContain('Hire him immediately');
    });
  });

  describe('Zod Validation Schemas', () => {
    it('validates a correct scheduling payload', () => {
      const valid = {
        applicationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        scheduledAt: '2026-11-10T10:00:00Z',
        duration: 45,
        panelMemberIds: ['b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22'],
      };
      const parsed = ScheduleInterviewInputSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it('rejects an empty panel list', () => {
      const invalid = {
        applicationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        scheduledAt: '2026-11-10T10:00:00Z',
        duration: 45,
        panelMemberIds: [], // Empty
      };
      const parsed = ScheduleInterviewInputSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it('validates panel feedback rating between 1 and 5', () => {
      const validFeedback = {
        rating: 5,
        recommendation: PanelRecommendation.STRONG_YES,
        feedback: 'Outstanding interview performance across system design and architecture.',
      };
      expect(PanelFeedbackInputSchema.safeParse(validFeedback).success).toBe(true);

      const invalidFeedback = {
        rating: 6, // out of range
        recommendation: PanelRecommendation.STRONG_YES,
        feedback: 'Good',
      };
      expect(PanelFeedbackInputSchema.safeParse(invalidFeedback).success).toBe(false);
    });
  });
});
