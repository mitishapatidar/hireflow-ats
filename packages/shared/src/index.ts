import { z } from 'zod';

// Product User Roles
export * from './roles';

// Common API Response Schema
export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        details: z.any().optional(),
      })
      .optional(),
    meta: z
      .object({
        timestamp: z.string(),
        requestId: z.string().optional(),
      })
      .optional(),
  });

// Health Check Response
export const HealthCheckResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string(),
  uptime: z.number(),
  environment: z.string(),
  services: z.object({
    database: z.enum(['connected', 'disconnected', 'unknown']),
    redis: z.enum(['connected', 'disconnected', 'unknown']),
  }),
});

export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

// Pagination Schema
export const PaginationParamsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type PaginationParams = z.infer<typeof PaginationParamsSchema>;

// Navigation & Permissions
export * from './navigation';

// Authentication & Centralized Authorization Engine
export * from './auth';
export * from './authorization';

// Admin, Hierarchy & Team Management
export * from './admin';
export * from './hierarchy';

// Candidates List & Profile Management
export * from './candidates';

// Clients CRM & Client Record Management (Prompt 9)
export * from './clients';

// Jobs & Job Lifecycle Management (Prompt 10)
export * from './jobs';

// Job Pipeline (Kanban Board) & Applications (Prompt 11)
export * from './pipeline';

// Candidate-Job Match Scoring & Client Submissions (Prompt 13)
export * from './match-scoring';
export * from './submissions';

// Interviews Calendar & Scheduling (Prompt 12)
export * from './interviews';

// Communications, Integrations & Templates (Prompt 14)
export * from './communications';

// Sales CRM, Recruiter Dashboards & Shared Metrics (Prompt 15)
export * from './sales';
export * from './metrics';

// Storage, Security & Resume Parsing Pipeline (Prompt 8)
export * from './storage';
export * from './security/antivirus';
export * from './extraction';
export * from './parser';

// Monitoring, Telemetry & Sentry Integration (Prompt 16)
export * from './monitoring';

// Two-Step Login, Session Policies & OTP (Prompt 17)
export * from './otp';



