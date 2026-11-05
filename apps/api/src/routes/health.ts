import { FastifyPluginAsync } from 'fastify';
import { prisma } from '@hireflow/db';
import { Redis } from 'ioredis';

let redisClient: Redis | null = null;
try {
  if (process.env.REDIS_URL) {
    redisClient = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }
} catch (e) {
  // ignore lazy connect initialization
}

const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (request, reply) => {
    let dbStatus: 'connected' | 'disconnected' | 'unknown' = 'unknown';
    let redisStatus: 'connected' | 'disconnected' | 'unknown' = 'unknown';

    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'disconnected';
    }

    try {
      if (redisClient) {
        if (redisClient.status !== 'ready') {
          await redisClient.connect();
        }
        await redisClient.ping();
        redisStatus = 'connected';
      }
    } catch {
      redisStatus = 'disconnected';
    }

    const payload = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: dbStatus,
        redis: redisStatus,
      },
    };

    return reply.status(200).send(payload);
  });
};

export default healthRoute;
