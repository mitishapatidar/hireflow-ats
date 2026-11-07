/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import React from 'react';
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { UserRole } from '@hireflow/shared';
import { prisma } from '@hireflow/db';
import { getDuplicatePairsAction } from '@/actions/sourcing';
import { DuplicateReviewClientView } from './DuplicateReviewClientView';

export default async function DuplicateReviewPage() {
  const user = await getCurrentUser();
  if (
    !user ||
    (user.role !== UserRole.ADMIN &&
      user.role !== UserRole.MANAGER &&
      user.role !== UserRole.RECRUITER)
  ) {
    redirect('/no-permission');
  }

  const [pairsRes, rawCandidates] = await Promise.all([
    getDuplicatePairsAction(),
    prisma.candidate.findMany({
      where: {
        organizationId: user.organizationId,
        isArchived: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        currentCompany: true,
        currentTitle: true,
      },
      orderBy: { name: 'asc' },
      take: 200,
    }),
  ]);

  const candidates = rawCandidates.map((c) => ({
    id: c.id,
    fullName: c.name,
    email: c.email,
    phone: c.phone,
    currentCompany: c.currentCompany,
    currentTitle: c.currentTitle,
  }));

  const duplicatePairs = pairsRes.success ? pairsRes.data : [];

  return (
    <DuplicateReviewClientView
      initialPairs={duplicatePairs as any}
      availableCandidates={candidates}
      currentUser={{
        id: user.id,
        name: user.name,
        role: user.role,
      }}
    />
  );
}
