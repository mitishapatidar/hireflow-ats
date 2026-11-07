import { describe, it, expect } from 'vitest';
import {
  getVideoMeetingProvider,
  MockVideoMeetingProvider,
  VideoProvider,
  generateSlotInvitationToken,
  hashSlotToken,
  generateIcsCalendarInvite,
  serializeCandidateApplication,
  serializeCandidateInterview,
  serializeCandidateProfile,
  assertCandidateSafe,
  calculateProfileCompleteness,
} from './index';

describe('Prompt 25: Video Meeting Providers', () => {
  it('creates deterministic mock meetings for Google Meet, Zoom, and Teams', async () => {
    const meetProvider = getVideoMeetingProvider(VideoProvider.GOOGLE_MEET);
    const zoomProvider = getVideoMeetingProvider(VideoProvider.ZOOM);
    const teamsProvider = getVideoMeetingProvider(VideoProvider.TEAMS);

    const meetRes = await meetProvider.createMeeting({
      interviewId: 'int-12345678-abcd',
      topic: 'Technical Interview',
      startTimeUtc: new Date('2026-11-10T10:00:00Z'),
      durationMinutes: 45,
      timezone: 'Asia/Kolkata',
      attendeeEmails: ['cand@example.com'],
      idempotencyKey: 'idem-1',
    });
    expect(meetRes.status).toBe('MOCK_MODE');
    expect(meetRes.joinUrl).toContain('meet.google.com/mock-aureva-int-1234');

    const zoomRes = await zoomProvider.createMeeting({
      interviewId: 'int-87654321-efgh',
      topic: 'HR Round',
      startTimeUtc: new Date('2026-11-10T11:00:00Z'),
      durationMinutes: 30,
      timezone: 'Asia/Kolkata',
      attendeeEmails: ['cand@example.com'],
      idempotencyKey: 'idem-2',
    });
    expect(zoomRes.status).toBe('MOCK_MODE');
    expect(zoomRes.joinUrl).toContain('zoom.us/j/');

    const teamsRes = await teamsProvider.createMeeting({
      interviewId: 'int-11223344-ijkl',
      topic: 'Final Round',
      startTimeUtc: new Date('2026-11-10T12:00:00Z'),
      durationMinutes: 60,
      timezone: 'Asia/Kolkata',
      attendeeEmails: ['cand@example.com'],
      idempotencyKey: 'idem-3',
    });
    expect(teamsRes.status).toBe('MOCK_MODE');
    expect(teamsRes.joinUrl).toContain('teams.microsoft.com');
  });

  it('reports setup required when live credentials are unconfigured without fallback', async () => {
    const meetProvider = getVideoMeetingProvider(VideoProvider.GOOGLE_MEET, { allowMockFallback: false });
    const res = await meetProvider.createMeeting({
      interviewId: 'int-live-fail',
      topic: 'System Test',
      startTimeUtc: new Date(),
      durationMinutes: 45,
      timezone: 'Asia/Kolkata',
      attendeeEmails: ['test@example.com'],
      idempotencyKey: 'idem-fail',
    });
    expect(res.status).toBe('SETUP_REQUIRED');
    expect(res.errorMessage).toContain('credentials missing');
  });
});

describe('Prompt 25: Slot Invitations & Token Security', () => {
  it('generates a 64-char hex token and consistent SHA-256 hash', () => {
    const { token, tokenHash } = generateSlotInvitationToken();
    expect(token).toHaveLength(64);
    expect(tokenHash).toHaveLength(64);
    expect(hashSlotToken(token)).toBe(tokenHash);
  });
});

describe('Prompt 25: RFC-5545 ICS Calendar Generator', () => {
  it('generates a valid calendar invite with UTC timestamps and UID', () => {
    const ics = generateIcsCalendarInvite({
      interviewId: 'int-999',
      summary: 'Frontend Architect Interview - Round 1',
      description: 'Interview with Aureva Capital.\nJoin Link: https://meet.google.com/test',
      startTimeUtc: new Date('2026-11-15T09:30:00Z'),
      durationMinutes: 45,
      meetingLink: 'https://meet.google.com/test',
      candidateName: 'Aarav Shah',
      candidateEmail: 'aarav.shah@example.com',
      sequence: 0,
      method: 'REQUEST',
    });

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('VERSION:2.0');
    expect(ics).toContain('METHOD:REQUEST');
    expect(ics).toContain('UID:interview-int-999@hireflow.aurevacapital.com');
    expect(ics).toContain('DTSTART:20261115T093000Z');
    expect(ics).toContain('DTEND:20261115T101500Z');
    expect(ics).toContain('LOCATION:https://meet.google.com/test');
    expect(ics).toContain('END:VCALENDAR');
  });

  it('generates a valid cancellation invite on cancel', () => {
    const ics = generateIcsCalendarInvite({
      interviewId: 'int-999',
      summary: 'Cancelled: Frontend Architect Interview',
      description: 'Interview cancelled.',
      startTimeUtc: new Date('2026-11-15T09:30:00Z'),
      durationMinutes: 45,
      candidateName: 'Aarav Shah',
      candidateEmail: 'aarav.shah@example.com',
      sequence: 1,
      status: 'CANCELLED',
      method: 'CANCEL',
    });

    expect(ics).toContain('METHOD:CANCEL');
    expect(ics).toContain('STATUS:CANCELLED');
    expect(ics).toContain('SEQUENCE:1');
  });
});

describe('Prompt 25: Candidate Portal Anti-Leak Serialization', () => {
  it('calculates profile completeness accurately', () => {
    const score = calculateProfileCompleteness({
      name: 'Aarav Shah',
      email: 'aarav@example.com',
      phone: '+91 9876543210',
      currentTitle: 'Staff Engineer',
      currentCompany: 'Razorpay',
      location: 'Bengaluru',
      skills: ['React', 'TypeScript'],
    });
    expect(score).toBe(100);

    const partial = calculateProfileCompleteness({
      name: 'Aarav Shah',
      email: 'aarav@example.com',
    });
    expect(partial).toBe(40);
  });

  it('sanitizes candidate application and strips confidential internal data', () => {
    const rawApp = {
      id: 'app-1',
      jobId: 'job-1',
      status: 'INTERVIEW',
      appliedAt: new Date('2026-11-01'),
      job: {
        id: 'job-1',
        title: 'Staff Frontend Architect',
        location: 'Bengaluru',
        client: { name: 'Acme Corp' },
      },
      // Confidential internal fields that MUST be stripped:
      feePercentage: 15,
      recruiterMargin: 25,
      internalNotes: 'Candidate was demanding higher bonus',
      feedback: 'Panel was skeptical on distributed locks',
    };

    const serialized = serializeCandidateApplication(rawApp);
    expect(serialized.jobTitle).toBe('Staff Frontend Architect');
    expect(serialized.companyName).toBe('Acme Corp');
    expect(serialized.status).toBe('Interview Stage');

    // Contract verification
    expect(assertCandidateSafe(serialized)).toBeUndefined();
    expect((serialized as any).feePercentage).toBeUndefined();
    expect((serialized as any).internalNotes).toBeUndefined();
  });

  it('detects and prevents candidate data leaks with assertCandidateSafe', () => {
    const leakyPayload = {
      jobTitle: 'Engineer',
      recruiterMargin: 20,
    };
    expect(() => assertCandidateSafe(leakyPayload)).toThrow(/CANDIDATE_DATA_LEAK_DETECTED/);
  });
});
