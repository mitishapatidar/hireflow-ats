/* eslint-disable @typescript-eslint/no-explicit-any */
import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '@hireflow/db';
import {
  UserRole,
  GlobalSearchQuerySchema,
} from '@hireflow/shared';
import { requireRole } from '../plugins/auth.js';

export const searchRoutes: FastifyPluginAsync = async (server: FastifyInstance) => {
  // 1. GET /api/search - Multi-entity global search with strict role-level security (Frame 45)
  server.get(
    '/',
    {
      preHandler: [
        (server as any).authenticate,
        requireRole(
          UserRole.ADMIN,
          UserRole.MANAGER,
          UserRole.RECRUITER,
          UserRole.CLIENT,
          UserRole.CANDIDATE
        ),
      ],
    },
    async (request: any, reply) => {
      const { id: userId, role, organizationId, clientAccess } = request.user;
      const parseResult = GlobalSearchQuerySchema.safeParse(request.query);

      if (!parseResult.success) {
        return reply.status(400).send({ success: false, error: parseResult.error.flatten() });
      }

      const { q, type, includeArchived, limit } = parseResult.data;
      const queryStr = q.trim();

      const results: {
        candidates: any[];
        jobs: any[];
        clients: any[];
        totalMatches: number;
      } = {
        candidates: [],
        jobs: [],
        clients: [],
        totalMatches: 0,
      };

      // ----------------------------------------------------
      // A. CANDIDATE SEARCH (Restricted by Role)
      // ----------------------------------------------------
      if (type === 'ALL' || type === 'CANDIDATES') {
        const candidateWhere: any = {
          organizationId,
          ...(includeArchived ? {} : { isArchived: false }),
          OR: [
            { name: { contains: queryStr, mode: 'insensitive' } },
            { email: { contains: queryStr, mode: 'insensitive' } },
            { code: { contains: queryStr, mode: 'insensitive' } },
            { currentTitle: { contains: queryStr, mode: 'insensitive' } },
            { skills: { hasSome: [queryStr] } },
          ],
        };

        if (role === UserRole.RECRUITER) {
          candidateWhere.ownerId = userId;
        } else if (role === UserRole.CLIENT) {
          if (!clientAccess?.clientId) {
            candidateWhere.id = 'unauthorized';
          } else {
            // Clients can only see candidates formally submitted to them
            candidateWhere.applications = {
              some: {
                submissions: {
                  some: { clientId: clientAccess.clientId },
                },
              },
            };
          }
        } else if (role === UserRole.CANDIDATE) {
          // Candidates can only search/see their own profile
          candidateWhere.userId = userId;
        }

        const candidates = await prisma.candidate.findMany({
          where: candidateWhere,
          take: limit,
          select: {
            id: true,
            code: true,
            name: true,
            currentTitle: true,
            skills: true,
            location: true,
            experienceYears: true,
            // Only internal roles receive email & phone
            email: role !== UserRole.CLIENT,
            isArchived: true,
          },
        });

        results.candidates = candidates;
      }

      // ----------------------------------------------------
      // B. JOB SEARCH (Restricted by Role)
      // ----------------------------------------------------
      if (type === 'ALL' || type === 'JOBS') {
        const jobWhere: any = {
          organizationId,
          ...(includeArchived ? {} : { isArchived: false }),
          OR: [
            { title: { contains: queryStr, mode: 'insensitive' } },
            { code: { contains: queryStr, mode: 'insensitive' } },
            { location: { contains: queryStr, mode: 'insensitive' } },
          ],
        };

        if (role === UserRole.RECRUITER) {
          jobWhere.ownerId = userId;
        } else if (role === UserRole.CLIENT) {
          if (!clientAccess?.clientId) {
            jobWhere.id = 'unauthorized';
          } else {
            jobWhere.clientId = clientAccess.clientId;
          }
        } else if (role === UserRole.CANDIDATE) {
          jobWhere.status = 'ACTIVE';
        }

        const jobs = await prisma.job.findMany({
          where: jobWhere,
          take: limit,
          select: {
            id: true,
            code: true,
            title: true,
            status: true,
            location: true,
            client: { select: { id: true, legalName: true } },
            isArchived: true,
          },
        });

        results.jobs = jobs;
      }

      // ----------------------------------------------------
      // C. CLIENT SEARCH (Restricted by Role)
      // ----------------------------------------------------
      if ((type === 'ALL' || type === 'CLIENTS') && role !== UserRole.CANDIDATE) {
        const clientWhere: any = {
          organizationId,
          ...(includeArchived ? {} : { isArchived: false }),
          OR: [
            { legalName: { contains: queryStr, mode: 'insensitive' } },
            { code: { contains: queryStr, mode: 'insensitive' } },
            { industry: { contains: queryStr, mode: 'insensitive' } },
          ],
        };

        if (role === UserRole.CLIENT) {
          if (!clientAccess?.clientId) {
            clientWhere.id = 'unauthorized';
          } else {
            clientWhere.id = clientAccess.clientId;
          }
        } else if (role === UserRole.RECRUITER) {
          // Recruiters see clients they have active jobs with
          clientWhere.jobs = {
            some: { ownerId: userId },
          };
        }

        const clients = await prisma.client.findMany({
          where: clientWhere,
          take: limit,
          select: {
            id: true,
            code: true,
            legalName: true,
            industry: true,
            website: true,
            status: true,
            isArchived: true,
          },
        });

        results.clients = clients;
      }

      results.totalMatches = results.candidates.length + results.jobs.length + results.clients.length;

      return reply.send({
        success: true,
        data: results,
      });
    }
  );
};
