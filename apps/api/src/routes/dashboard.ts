/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { UserRole } from '@hireflow/shared';
import { MetricsService } from '../services/metrics.js';

export const dashboardRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // Guard: Internal Staff Only
  function verifyInternalStaff(user: any) {
    if (!user || user.role === UserRole.CLIENT || user.role === UserRole.CANDIDATE) {
      const err: any = new Error('Access denied: Dashboards are restricted to internal agency team members');
      err.statusCode = 403;
      throw err;
    }
  }

  // 1. GET /recruiter (and GET /)
  const getDashboardHandler = async (request: any, reply: any) => {
    const user = request.user;
    verifyInternalStaff(user);

    const data = await MetricsService.getRecruiterDashboardData(
      user.id,
      user.role as UserRole,
      user.organizationId
    );

    return reply.status(200).send({
      success: true,
      data,
    });
  };

  server.get('/recruiter', { preHandler: [(server as any).authenticate] }, getDashboardHandler);
  server.get('/', { preHandler: [(server as any).authenticate] }, getDashboardHandler);
};
