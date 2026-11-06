import { FastifyPluginAsync } from 'fastify';
import { prisma } from '@hireflow/db';
import { requirePermission } from '../plugins/auth.js';

const candidateRoutes: FastifyPluginAsync = async (server) => {
  // GET /api/candidates/:candidateId
  server.get(
    '/api/candidates/:candidateId',
    {
      preHandler: [
        (server as any).authenticate,
        requirePermission('read', async (request) => {
          const { candidateId } = request.params as { candidateId: string };
          const candidate = await prisma.candidate.findUnique({
            where: { id: candidateId },
            select: { id: true, ownerId: true, organizationId: true },
          });

          if (!candidate) {
            // Non-existent candidate policy
            return {
              type: 'candidate',
              id: candidateId,
              organizationId: request.user?.organizationId,
            };
          }

          return {
            type: 'candidate',
            id: candidate.id,
            ownerId: candidate.ownerId,
            organizationId: candidate.organizationId,
          };
        }),
      ],
    },
    async (request, reply) => {
      const { candidateId } = request.params as { candidateId: string };
      const candidate = await prisma.candidate.findUnique({
        where: { id: candidateId },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          tags: true,
          documents: true,
        },
      });

      if (!candidate) {
        return reply.status(404).send({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Candidate not found' },
        });
      }

      return reply.status(200).send({
        success: true,
        data: { candidate },
      });
    }
  );
};

export default candidateRoutes;
