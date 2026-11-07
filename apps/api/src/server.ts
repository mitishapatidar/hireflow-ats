import Fastify from 'fastify';
import dotenv from 'dotenv';
import crypto from 'node:crypto';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { monitoring } from '@hireflow/shared';
import healthRoute from './routes/health.js';
import csrfPlugin from './plugins/csrf.js';
import authPlugin from './plugins/auth.js';
import authRoutes from './routes/auth.js';
import candidateRoutes from './routes/candidates.js';
import adminRoutes from './routes/admin.js';
import { clientRoutes } from './routes/clients.js';
import { jobRoutes } from './routes/jobs.js';
import { pipelineRoutes } from './routes/pipeline.js';
import { submissionRoutes } from './routes/submissions.js';
import { interviewRoutes } from './routes/interviews.js';
import { communicationRoutes } from './routes/communications.js';
import { salesRoutes } from './routes/sales.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { activityRoutes } from './routes/activity.js';
import { approvalRoutes } from './routes/approvals.js';
import { managerRoutes } from './routes/manager.js';
import { clientWorkflowRoutes } from './routes/client-workflows.js';
import { governanceRoutes } from './routes/governance.js';
import { sourcingRoutes } from './routes/sourcing.js';
import { clientPortalRoutes } from './routes/client-portal.js';
import { notificationRoutes } from './routes/notifications.js';
import { taskRoutes } from './routes/tasks.js';
import { automationRoutes } from './routes/automation.js';
import { slotInvitationRoutes } from './routes/slot-invitations.js';
import { candidatePortalRoutes } from './routes/candidate-portal.js';

dotenv.config();

export function buildServer() {
  const isTest = process.env.NODE_ENV === 'test';
  const server = Fastify({
    requestIdHeader: 'x-request-id',
    genReqId: (req) => {
      const incoming = req.headers['x-request-id'];
      if (typeof incoming === 'string' && incoming.trim().length > 0) {
        return incoming.trim();
      }
      return crypto.randomUUID();
    },
    logger: isTest
      ? false
      : {
          level: process.env.LOG_LEVEL || 'info',
          transport:
            process.env.NODE_ENV !== 'production'
              ? {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    translateTime: 'SYS:standard',
                    ignore: 'pid,hostname',
                  },
                }
              : undefined,
        },
  });

  // Request ID Header Propagation
  server.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  // Centralized Error Handler
  server.setErrorHandler((error, request, reply) => {
    let statusCode = error.statusCode || 500;
    let code = error.code || 'INTERNAL_SERVER_ERROR';
    let message = error.message || 'An unexpected error occurred';
    let details: any = undefined;

    // Prisma error mappings
    if (code === 'P2002') {
      statusCode = 409;
      code = 'CONFLICT';
      message = 'A record with this unique identifier already exists';
    } else if (code === 'P2025') {
      statusCode = 404;
      code = 'NOT_FOUND';
      message = 'Requested record not found';
    }

    // Fastify / Zod validation error mappings
    if (error.validation || (error as any).issues) {
      statusCode = 400;
      code = 'VALIDATION_ERROR';
      message = error.message;
      details = (error as any).issues || error.validation;
    }

    // In production, mask unhandled 500 server errors
    if (statusCode >= 500) {
      monitoring.captureException(error, {
        requestId: request.id,
        url: request.url,
        method: request.method,
      });

      if (process.env.NODE_ENV === 'production') {
        message = 'An unexpected internal server error occurred';
      }
    }

    reply.status(statusCode).send({
      success: false,
      error: {
        code,
        message,
        details,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  // Register Core Plugins
  server.register(cookie);
  server.register(cors, {
    origin: process.env.APP_BASE_URL || 'http://localhost:3000',
    credentials: true,
  });
  server.register(csrfPlugin);

  // Register Auth Plugin
  server.register(authPlugin);

  // Register Routes
  server.register(healthRoute);
  server.register(authRoutes);
  server.register(candidateRoutes);
  server.register(adminRoutes);
  server.register(clientRoutes);
  server.register(jobRoutes);
  server.register(pipelineRoutes);
  server.register(submissionRoutes);
  server.register(interviewRoutes, { prefix: '/api/interviews' });
  server.register(communicationRoutes, { prefix: '/api/communications' });
  server.register(salesRoutes, { prefix: '/api/sales' });
  server.register(dashboardRoutes, { prefix: '/api/dashboard' });
  server.register(activityRoutes, { prefix: '/api/activity' });
  server.register(approvalRoutes, { prefix: '/api/approvals' });
  server.register(managerRoutes, { prefix: '/api/manager' });
  server.register(clientWorkflowRoutes, { prefix: '/api/clients' });
  server.register(governanceRoutes);
  server.register(sourcingRoutes);
  server.register(clientPortalRoutes);
  server.register(notificationRoutes, { prefix: '/api/notifications' });
  server.register(taskRoutes, { prefix: '/api/tasks' });
  server.register(automationRoutes, { prefix: '/api/automation' });
  server.register(slotInvitationRoutes, { prefix: '/api/slot-invitations' });
  server.register(candidatePortalRoutes, { prefix: '/api/candidate-portal' });

  return server;
}

// Start if executed directly
if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  const server = buildServer();
  const start = async () => {
    try {
      const port = Number(process.env.PORT) || 4000;
      const host = process.env.HOST || '0.0.0.0';
      await server.listen({ port, host });
      server.log.info(`🚀 HireFlow API server listening at http://${host}:${port}`);
    } catch (err) {
      server.log.error(err);
      process.exit(1);
    }
  };
  start();
}
