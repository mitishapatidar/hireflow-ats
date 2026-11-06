import Fastify from 'fastify';
import dotenv from 'dotenv';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import healthRoute from './routes/health.js';
import csrfPlugin from './plugins/csrf.js';
import authPlugin from './plugins/auth.js';
import authRoutes from './routes/auth.js';
import candidateRoutes from './routes/candidates.js';

dotenv.config();

export function buildServer() {
  const isTest = process.env.NODE_ENV === 'test';
  const server = Fastify({
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

  // Centralized error handler
  server.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      success: false,
      error: {
        code: error.code || 'INTERNAL_SERVER_ERROR',
        message: error.message || 'An unexpected error occurred',
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

  return server;
}

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

// Start if executed directly
if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  start();
}

export default server;
