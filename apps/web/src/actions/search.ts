'use server';

import { prisma } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import { GlobalSearchQuerySchema, UserRole } from '@hireflow/shared';

export interface SearchResultItem {
  id: string;
  type: 'candidate' | 'job' | 'client';
  title: string;
  subtitle: string;
  badge?: string;
  href: string;
}

export interface GlobalSearchResponse {
  candidates: SearchResultItem[];
  jobs: SearchResultItem[];
  clients: SearchResultItem[];
  total: number;
}

export async function globalSearchAction(queryStr: string, limit = 8): Promise<GlobalSearchResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return { candidates: [], jobs: [], clients: [], total: 0 };
  }

  const parsed = GlobalSearchQuerySchema.safeParse({ q: queryStr, limit });
  if (!parsed.success) {
    return { candidates: [], jobs: [], clients: [], total: 0 };
  }

  const { q: query, limit: takeLimit } = parsed.data;
  const orgId = user.organizationId;
  const isInternal = user.role === UserRole.ADMIN || user.role === UserRole.MANAGER || user.role === UserRole.RECRUITER;
  const isClient = user.role === UserRole.CLIENT;

  const candidateResults: SearchResultItem[] = [];
  const jobResults: SearchResultItem[] = [];
  const clientResults: SearchResultItem[] = [];

  // 1. CANDIDATES SEARCH
  if (isInternal) {
    const candidates = await prisma.candidate.findMany({
      where: {
        organizationId: orgId,
        isArchived: false,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { skills: { hasSome: [query] } },
          { currentCompany: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: takeLimit,
      select: {
        id: true,
        name: true,
        email: true,
        currentTitle: true,
        currentCompany: true,
        location: true,
      },
    });

    candidates.forEach((c) => {
      candidateResults.push({
        id: c.id,
        type: 'candidate',
        title: c.name,
        subtitle: `${c.currentTitle || c.currentCompany || 'Candidate'} • ${c.location || 'Remote'}`,
        badge: 'Candidate',
        href: `/candidates/${c.id}`,
      });
    });
  } else if (isClient) {
    // Client only sees candidates who have been submitted to their jobs
    const clientAccess = await prisma.clientAccess.findFirst({
      where: { userId: user.id },
    });
    if (clientAccess) {
      const candidates = await prisma.candidate.findMany({
        where: {
          organizationId: orgId,
          isArchived: false,
          applications: {
            some: {
              job: { clientId: clientAccess.clientId },
            },
          },
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { skills: { hasSome: [query] } },
          ],
        },
        take: takeLimit,
        select: {
          id: true,
          name: true,
          currentTitle: true,
          location: true,
        },
      });

      candidates.forEach((c) => {
        candidateResults.push({
          id: c.id,
          type: 'candidate',
          title: c.name,
          subtitle: `${c.currentTitle || 'Submitted Candidate'} • ${c.location || 'Remote'}`,
          badge: 'Candidate',
          href: `/client-portal/candidates/${c.id}`,
        });
      });
    }
  }

  // 2. JOBS SEARCH
  if (isInternal) {
    const jobs = await prisma.job.findMany({
      where: {
        organizationId: orgId,
        isArchived: false,
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { code: { contains: query, mode: 'insensitive' } },
          { client: { legalName: { contains: query, mode: 'insensitive' } } },
        ],
      },
      take: takeLimit,
      select: {
        id: true,
        title: true,
        code: true,
        status: true,
        location: true,
        client: { select: { legalName: true } },
      },
    });

    jobs.forEach((j) => {
      jobResults.push({
        id: j.id,
        type: 'job',
        title: j.title,
        subtitle: `${j.code} • ${j.client?.legalName || 'Internal'} • ${j.location || 'Remote'}`,
        badge: j.status,
        href: `/jobs/${j.id}`,
      });
    });
  } else if (isClient) {
    const clientAccess = await prisma.clientAccess.findFirst({
      where: { userId: user.id },
    });
    if (clientAccess) {
      const jobs = await prisma.job.findMany({
        where: {
          organizationId: orgId,
          clientId: clientAccess.clientId,
          isArchived: false,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { code: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: takeLimit,
        select: {
          id: true,
          title: true,
          code: true,
          status: true,
          location: true,
        },
      });

      jobs.forEach((j) => {
        jobResults.push({
          id: j.id,
          type: 'job',
          title: j.title,
          subtitle: `${j.code} • ${j.location || 'Remote'}`,
          badge: j.status,
          href: `/client-portal/jobs/${j.id}`,
        });
      });
    }
  }

  // 3. CLIENTS SEARCH (Internal Roles Only - Zero Data Leak to Clients/Candidates)
  if (isInternal) {
    const clients = await prisma.client.findMany({
      where: {
        organizationId: orgId,
        isArchived: false,
        OR: [
          { legalName: { contains: query, mode: 'insensitive' } },
          { code: { contains: query, mode: 'insensitive' } },
          { industry: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: takeLimit,
      select: {
        id: true,
        legalName: true,
        code: true,
        industry: true,
        status: true,
        location: true,
      },
    });

    clients.forEach((cl) => {
      clientResults.push({
        id: cl.id,
        type: 'client',
        title: cl.legalName,
        subtitle: `${cl.code} • ${cl.industry || 'Technology'} • ${cl.location || 'India'}`,
        badge: cl.status,
        href: `/clients/${cl.id}`,
      });
    });
  }

  const total = candidateResults.length + jobResults.length + clientResults.length;

  return {
    candidates: candidateResults,
    jobs: jobResults,
    clients: clientResults,
    total,
  };
}
