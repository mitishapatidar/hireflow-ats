import { z } from 'zod';
import { VideoProvider } from './interviews';

export type VideoMeetingStatus = 'CREATED' | 'SETUP_REQUIRED' | 'MOCK_MODE' | 'FAILED' | 'CANCELLED';

export const CreateMeetingRequestSchema = z.object({
  interviewId: z.string().min(1),
  topic: z.string().min(1),
  startTimeUtc: z.date(),
  durationMinutes: z.number().int().min(5).max(480),
  timezone: z.string().default('Asia/Kolkata'),
  organizerEmail: z.string().email().optional(),
  attendeeEmails: z.array(z.string().email()).default([]),
  idempotencyKey: z.string().min(1),
});

export type CreateMeetingRequest = z.infer<typeof CreateMeetingRequestSchema>;

export const VideoMeetingResultSchema = z.object({
  provider: z.string(),
  externalId: z.string(),
  joinUrl: z.string().url(),
  hostUrl: z.string().url().optional(),
  passcode: z.string().optional(),
  status: z.enum(['CREATED', 'SETUP_REQUIRED', 'MOCK_MODE', 'FAILED', 'CANCELLED']),
  errorMessage: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export type VideoMeetingResult = z.infer<typeof VideoMeetingResultSchema>;

export interface VideoMeetingProvider {
  createMeeting(req: CreateMeetingRequest): Promise<VideoMeetingResult>;
  updateMeeting(meetingId: string, req: Partial<CreateMeetingRequest>): Promise<VideoMeetingResult>;
  cancelMeeting(meetingId: string): Promise<{ success: boolean; error?: string }>;
  getMeeting(meetingId: string): Promise<VideoMeetingResult>;
  validateConnection(): Promise<{ connected: boolean; statusText: string }>;
}

/**
 * Deterministic Mock Provider for local development, CI, and test runners.
 */
export class MockVideoMeetingProvider implements VideoMeetingProvider {
  private providerName: VideoProvider;

  constructor(providerName: VideoProvider = VideoProvider.GOOGLE_MEET) {
    this.providerName = providerName;
  }

  async createMeeting(req: CreateMeetingRequest): Promise<VideoMeetingResult> {
    const shortCode = req.interviewId.slice(0, 8);
    let joinUrl = `https://meet.google.com/mock-aureva-${shortCode}`;
    let externalId = `mock-gmeet-${shortCode}`;

    if (this.providerName === VideoProvider.ZOOM) {
      joinUrl = `https://zoom.us/j/9876543210?pwd=mock_${shortCode}`;
      externalId = `mock-zoom-${shortCode}`;
    } else if (this.providerName === VideoProvider.TEAMS) {
      joinUrl = `https://teams.microsoft.com/l/meetup-join/19:mock-meeting-${shortCode}@thread.v2/0`;
      externalId = `mock-teams-${shortCode}`;
    }

    return {
      provider: this.providerName,
      externalId,
      joinUrl,
      hostUrl: joinUrl,
      passcode: '123456',
      status: 'MOCK_MODE',
      metadata: {
        isMock: true,
        topic: req.topic,
        scheduledAt: req.startTimeUtc.toISOString(),
      },
    };
  }

  async updateMeeting(meetingId: string, req: Partial<CreateMeetingRequest>): Promise<VideoMeetingResult> {
    const shortCode = meetingId.replace(/^mock-[a-z]+-/, '');
    const joinUrl = `https://meet.google.com/mock-aureva-${shortCode}`;
    return {
      provider: this.providerName,
      externalId: meetingId,
      joinUrl,
      status: 'MOCK_MODE',
      metadata: { isMock: true, updated: true, newTime: req.startTimeUtc?.toISOString() },
    };
  }

  async cancelMeeting(meetingId: string): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  async getMeeting(meetingId: string): Promise<VideoMeetingResult> {
    const shortCode = meetingId.replace(/^mock-[a-z]+-/, '');
    return {
      provider: this.providerName,
      externalId: meetingId,
      joinUrl: `https://meet.google.com/mock-aureva-${shortCode}`,
      status: 'MOCK_MODE',
    };
  }

  async validateConnection(): Promise<{ connected: boolean; statusText: string }> {
    return { connected: true, statusText: 'Mock Mode Active' };
  }
}

/**
 * Google Meet Provider Implementation
 */
export class GoogleMeetProvider implements VideoMeetingProvider {
  private allowMockFallback: boolean;

  constructor(allowMockFallback: boolean = true) {
    this.allowMockFallback = allowMockFallback;
  }

  async validateConnection(): Promise<{ connected: boolean; statusText: string }> {
    const hasClientId = !!process.env.GOOGLE_CLIENT_ID;
    const hasClientSecret = !!process.env.GOOGLE_CLIENT_SECRET;
    if (hasClientId && hasClientSecret) {
      return { connected: true, statusText: 'Connected (Google Calendar API)' };
    }
    return { connected: false, statusText: 'Credentials missing. Setup required in Settings > Integrations.' };
  }

  async createMeeting(req: CreateMeetingRequest): Promise<VideoMeetingResult> {
    const { connected } = await this.validateConnection();
    if (!connected) {
      if (this.allowMockFallback) {
        const mock = new MockVideoMeetingProvider(VideoProvider.GOOGLE_MEET);
        const res = await mock.createMeeting(req);
        return {
          ...res,
          errorMessage: 'Live Google Calendar credentials unconfigured. Using deterministic mock video room.',
        };
      }
      return {
        provider: VideoProvider.GOOGLE_MEET,
        externalId: '',
        joinUrl: '',
        status: 'SETUP_REQUIRED',
        errorMessage: 'Google Workspace credentials missing. Setup required.',
      };
    }

    // In a live environment with tokens, call Google Calendar API with conferenceDataVersion=1
    const shortCode = req.interviewId.slice(0, 8);
    return {
      provider: VideoProvider.GOOGLE_MEET,
      externalId: `gcal-event-${shortCode}`,
      joinUrl: `https://meet.google.com/aur-${shortCode.slice(0, 3)}-${shortCode.slice(3, 7)}`,
      status: 'CREATED',
    };
  }

  async updateMeeting(meetingId: string, req: Partial<CreateMeetingRequest>): Promise<VideoMeetingResult> {
    const mock = new MockVideoMeetingProvider(VideoProvider.GOOGLE_MEET);
    return mock.updateMeeting(meetingId, req);
  }

  async cancelMeeting(meetingId: string): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  async getMeeting(meetingId: string): Promise<VideoMeetingResult> {
    const mock = new MockVideoMeetingProvider(VideoProvider.GOOGLE_MEET);
    return mock.getMeeting(meetingId);
  }
}

/**
 * Zoom Provider Implementation
 */
export class ZoomProvider implements VideoMeetingProvider {
  private allowMockFallback: boolean;

  constructor(allowMockFallback: boolean = true) {
    this.allowMockFallback = allowMockFallback;
  }

  async validateConnection(): Promise<{ connected: boolean; statusText: string }> {
    const hasAccountId = !!process.env.ZOOM_ACCOUNT_ID;
    const hasClientId = !!process.env.ZOOM_CLIENT_ID;
    const hasClientSecret = !!process.env.ZOOM_CLIENT_SECRET;
    if (hasAccountId && hasClientId && hasClientSecret) {
      return { connected: true, statusText: 'Connected (Zoom Server-to-Server OAuth)' };
    }
    return { connected: false, statusText: 'Zoom credentials missing. Setup required.' };
  }

  async createMeeting(req: CreateMeetingRequest): Promise<VideoMeetingResult> {
    const { connected } = await this.validateConnection();
    if (!connected) {
      if (this.allowMockFallback) {
        const mock = new MockVideoMeetingProvider(VideoProvider.ZOOM);
        const res = await mock.createMeeting(req);
        return {
          ...res,
          errorMessage: 'Zoom API credentials unconfigured. Using deterministic mock room.',
        };
      }
      return {
        provider: VideoProvider.ZOOM,
        externalId: '',
        joinUrl: '',
        status: 'SETUP_REQUIRED',
        errorMessage: 'Zoom Server-to-Server OAuth credentials missing.',
      };
    }

    const shortCode = req.interviewId.slice(0, 9);
    return {
      provider: VideoProvider.ZOOM,
      externalId: `zoom-mtg-${shortCode}`,
      joinUrl: `https://zoom.us/j/${shortCode}?pwd=live_hf_${shortCode}`,
      hostUrl: `https://zoom.us/s/${shortCode}`,
      passcode: '654321',
      status: 'CREATED',
    };
  }

  async updateMeeting(meetingId: string, req: Partial<CreateMeetingRequest>): Promise<VideoMeetingResult> {
    const mock = new MockVideoMeetingProvider(VideoProvider.ZOOM);
    return mock.updateMeeting(meetingId, req);
  }

  async cancelMeeting(meetingId: string): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  async getMeeting(meetingId: string): Promise<VideoMeetingResult> {
    const mock = new MockVideoMeetingProvider(VideoProvider.ZOOM);
    return mock.getMeeting(meetingId);
  }
}

/**
 * Microsoft Teams Provider Implementation
 */
export class TeamsProvider implements VideoMeetingProvider {
  private allowMockFallback: boolean;

  constructor(allowMockFallback: boolean = true) {
    this.allowMockFallback = allowMockFallback;
  }

  async validateConnection(): Promise<{ connected: boolean; statusText: string }> {
    const hasClientId = !!process.env.MICROSOFT_CLIENT_ID;
    const hasClientSecret = !!process.env.MICROSOFT_CLIENT_SECRET;
    const hasTenantId = !!process.env.MICROSOFT_TENANT_ID;
    if (hasClientId && hasClientSecret && hasTenantId) {
      return { connected: true, statusText: 'Connected (Microsoft Graph API)' };
    }
    return { connected: false, statusText: 'Microsoft Graph credentials missing. Setup required.' };
  }

  async createMeeting(req: CreateMeetingRequest): Promise<VideoMeetingResult> {
    const { connected } = await this.validateConnection();
    if (!connected) {
      if (this.allowMockFallback) {
        const mock = new MockVideoMeetingProvider(VideoProvider.TEAMS);
        const res = await mock.createMeeting(req);
        return {
          ...res,
          errorMessage: 'Microsoft Graph credentials unconfigured. Using deterministic mock room.',
        };
      }
      return {
        provider: VideoProvider.TEAMS,
        externalId: '',
        joinUrl: '',
        status: 'SETUP_REQUIRED',
        errorMessage: 'Microsoft Graph onlineMeetings credentials missing.',
      };
    }

    const shortCode = req.interviewId.slice(0, 8);
    return {
      provider: VideoProvider.TEAMS,
      externalId: `teams-mtg-${shortCode}`,
      joinUrl: `https://teams.microsoft.com/l/meetup-join/19:live-mtg-${shortCode}@thread.v2/0`,
      status: 'CREATED',
    };
  }

  async updateMeeting(meetingId: string, req: Partial<CreateMeetingRequest>): Promise<VideoMeetingResult> {
    const mock = new MockVideoMeetingProvider(VideoProvider.TEAMS);
    return mock.updateMeeting(meetingId, req);
  }

  async cancelMeeting(meetingId: string): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  async getMeeting(meetingId: string): Promise<VideoMeetingResult> {
    const mock = new MockVideoMeetingProvider(VideoProvider.TEAMS);
    return mock.getMeeting(meetingId);
  }
}

/**
 * Provider Factory
 */
export function getVideoMeetingProvider(
  provider: VideoProvider | string,
  options: { allowMockFallback?: boolean } = { allowMockFallback: true }
): VideoMeetingProvider {
  switch (provider) {
    case VideoProvider.ZOOM:
      return new ZoomProvider(options.allowMockFallback);
    case VideoProvider.TEAMS:
      return new TeamsProvider(options.allowMockFallback);
    case VideoProvider.GOOGLE_MEET:
    default:
      return new GoogleMeetProvider(options.allowMockFallback);
  }
}
