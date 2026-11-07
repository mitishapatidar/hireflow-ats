'use server';

import { revalidatePath } from 'next/cache';
import crypto from 'node:crypto';
import { prisma, Prisma, ApplicationStatus } from '@hireflow/db';
import { getCurrentUser } from '@/lib/auth';
import {
  UserRole,
  isJobPubliclyEligible,
  serializePublicJob,
  PublicJobCardDTO,
  PublicJobDetailDTO,
  PublicJobQuerySchema,
  PublicJobQueryInput,
  PublicApplySchema,
  PublicApplyInput,
  SaveApplicationDraftSchema,
  SaveApplicationDraftInput,
  CareersBrandingSchema,
  CareersBrandingDTO,
  DEFAULT_CAREERS_BRANDING,
  generateDraftToken,
  generateApplicationReference,
  normalizeEmail,
  normalizePhone,
  validateFileSecurity,
  getStorageProvider,
  getAntivirusScanner,
  getCaptchaProvider,
  validateHoneypot,
  MockEmailProvider,
} from '@hireflow/shared';

// -------------------------------------------------------------
// 1. Branding: Get & Admin Update
// -------------------------------------------------------------
export async function getPublicCareersBrandingAction(): Promise<{
  success: boolean;
  data: CareersBrandingDTO & { orgName: string };
}> {
  try {
    const org = await prisma.organization.findFirst({
      where: { status: 'ACTIVE' },
      select: { name: true, settings: true },
    });

    const settings = (org?.settings as any) || {};
    const customBranding = settings.careersBranding || {};

    return {
      success: true,
      data: {
        ...DEFAULT_CAREERS_BRANDING,
        ...customBranding,
        orgName: org?.name || 'Aureva Capital',
      },
    };
  } catch (err: unknown) {
    console.error('[getPublicCareersBrandingAction] Error:', err);
    return {
      success: true,
      data: {
        ...DEFAULT_CAREERS_BRANDING,
        orgName: 'Aureva Capital',
      },
    };
  }
}

export async function updateCareersBrandingAction(input: CareersBrandingDTO) {
  const user = await getCurrentUser();
  if (!user || user.role !== UserRole.ADMIN) {
    return { success: false, error: 'Unauthorized: Admin role required to update careers branding' };
  }

  const parsed = CareersBrandingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Validation failed', details: parsed.error.format() };
  }

  try {
    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
    });

    if (!org) {
      return { success: false, error: 'Organization not found' };
    }

    const currentSettings = (org.settings as any) || {};
    const updatedSettings = {
      ...currentSettings,
      careersBranding: parsed.data,
    };

    await prisma.organization.update({
      where: { id: user.organizationId },
      data: {
        settings: updatedSettings,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: user.id,
        action: 'UPDATE_CAREERS_BRANDING',
        entity: 'Organization',
        entityId: user.organizationId,
        after: parsed.data,
      },
    });

    revalidatePath('/careers');
    return { success: true, data: parsed.data };
  } catch (err: unknown) {
    console.error('[updateCareersBrandingAction] Error:', err);
    return { success: false, error: 'Failed to update careers branding' };
  }
}

// -------------------------------------------------------------
// 2. Public Jobs: List & Detail
// -------------------------------------------------------------
export async function getPublicJobsAction(filters: PublicJobQueryInput): Promise<{
  success: boolean;
  data: PublicJobCardDTO[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}> {
  try {
    const { search, location, employmentType, page, limit } = PublicJobQuerySchema.parse(filters);

    const where: Prisma.JobWhereInput = {
      status: 'ACTIVE',
      isPublished: true,
      isArchived: false,
      organization: { status: 'ACTIVE' },
      OR: [{ deadline: null }, { deadline: { gte: new Date() } }],
    };

    if (location && location.trim().length > 0) {
      where.location = { contains: location.trim(), mode: 'insensitive' };
    }

    if (employmentType && employmentType.trim().length > 0) {
      where.employmentType = employmentType.trim();
    }

    if (search && search.trim().length > 0) {
      const q = search.trim();
      where.AND = [
        {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
            { requirements: { contains: q, mode: 'insensitive' } },
            { requiredSkills: { hasSome: [q] } },
          ],
        },
      ];
    }

    const skip = (page - 1) * limit;

    const [totalCount, rawJobs] = await Promise.all([
      prisma.job.count({ where }),
      prisma.job.findMany({
        where,
        include: {
          client: { select: { legalName: true } },
        },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const jobs = rawJobs
      .map((j) => serializePublicJob(j))
      .filter((j): j is NonNullable<typeof j> => j !== null);

    return {
      success: true,
      data: jobs,
      pagination: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit) || 1,
      },
    };
  } catch (err: unknown) {
    console.error('[getPublicJobsAction] Error:', err);
    return {
      success: false,
      data: [],
      pagination: { total: 0, page: 1, limit: 10, totalPages: 1 },
    };
  }
}

export async function getPublicJobDetailsAction(slugOrId: string): Promise<{
  success: boolean;
  data?: PublicJobDetailDTO;
  error?: string;
}> {
  try {
    if (!slugOrId) {
      return { success: false, error: 'Job identifier is required' };
    }

    const rawJob = await prisma.job.findFirst({
      where: {
        OR: [{ id: slugOrId }, { code: { equals: slugOrId, mode: 'insensitive' } }],
        organization: { status: 'ACTIVE' },
      },
      include: {
        client: { select: { legalName: true } },
      },
    });

    if (!rawJob || !isJobPubliclyEligible(rawJob)) {
      return { success: false, error: 'Job not found or no longer available' };
    }

    const publicJob = serializePublicJob(rawJob);
    if (!publicJob) {
      return { success: false, error: 'Job not found or no longer available' };
    }

    return { success: true, data: publicJob };
  } catch (err: unknown) {
    console.error('[getPublicJobDetailsAction] Error:', err);
    return { success: false, error: 'Failed to fetch job details' };
  }
}

// -------------------------------------------------------------
// 3. Public Resume Upload Action
// -------------------------------------------------------------
export async function uploadPublicResumeAction(formData: FormData) {
  const file = formData.get('file') as File | null;
  if (!file) {
    return { success: false, error: 'No file uploaded' };
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Security & Magic Bytes Check
    const securityCheck = validateFileSecurity(buffer, file.name, file.type);
    if (!securityCheck.valid) {
      return { success: false, error: securityCheck.error };
    }

    // 2. Antivirus Scan Hook
    const avScanner = getAntivirusScanner();
    const avResult = await avScanner.scan(buffer, file.name);
    if (!avResult.clean) {
      return {
        success: false,
        error: `Security Alert: File flagged by security scan (${avResult.threatFound || 'Threat detected'}).`,
      };
    }

    // 3. Private Storage Upload
    const storage = getStorageProvider();
    const uploadResult = await storage.uploadFile(buffer, {
      fileName: file.name,
      mimeType: securityCheck.detectedMime || file.type,
      fileSize: buffer.length,
    });

    return {
      success: true,
      data: {
        storageKey: uploadResult.storageKey,
        fileName: file.name,
        fileSize: uploadResult.fileSize,
        checksum: uploadResult.checksum,
        uploadedAt: uploadResult.uploadedAt,
      },
    };
  } catch (err: unknown) {
    console.error('[uploadPublicResumeAction] Error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to process resume upload',
    };
  }
}

// -------------------------------------------------------------
// 4. Draft Management Actions
// -------------------------------------------------------------
export async function saveApplicationDraftAction(input: SaveApplicationDraftInput) {
  try {
    const parsed = SaveApplicationDraftSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, error: 'Invalid draft data', details: parsed.error.format() };
    }

    const { jobId, formData, resumeKey, draftToken: existingToken } = parsed.data;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, organizationId: true, status: true, isPublished: true, isArchived: true },
    });

    if (!job || !isJobPubliclyEligible(job)) {
      return { success: false, error: 'Position is not open for applications' };
    }

    const token = existingToken && existingToken.trim().length === 64 ? existingToken : generateDraftToken();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const draft = await prisma.applicationDraft.upsert({
      where: { token },
      update: {
        formData: formData as any,
        resumeKey: resumeKey || null,
        expiresAt,
      },
      create: {
        token,
        jobId: job.id,
        organizationId: job.organizationId,
        formData: formData as any,
        resumeKey: resumeKey || null,
        expiresAt,
      },
    });

    return {
      success: true,
      data: {
        draftToken: draft.token,
        expiresAt: draft.expiresAt.toISOString(),
        jobId: draft.jobId,
      },
    };
  } catch (err: unknown) {
    console.error('[saveApplicationDraftAction] Error:', err);
    return { success: false, error: 'Failed to save application draft' };
  }
}

export async function getApplicationDraftAction(token: string) {
  try {
    if (!token || token.length !== 64) {
      return { success: false, error: 'Invalid draft token format' };
    }

    const draft = await prisma.applicationDraft.findUnique({
      where: { token },
    });

    if (!draft) {
      return { success: false, error: 'Application draft not found' };
    }

    if (draft.expiresAt.getTime() < Date.now()) {
      return { success: false, error: 'Application draft has expired' };
    }

    return {
      success: true,
      data: {
        draftToken: draft.token,
        jobId: draft.jobId,
        formData: draft.formData,
        resumeKey: draft.resumeKey,
        expiresAt: draft.expiresAt.toISOString(),
      },
    };
  } catch (err: unknown) {
    console.error('[getApplicationDraftAction] Error:', err);
    return { success: false, error: 'Failed to retrieve application draft' };
  }
}

// -------------------------------------------------------------
// 5. Final Public Application Submission Action
// -------------------------------------------------------------
export async function submitPublicApplicationAction(input: PublicApplyInput) {
  try {
    const parsed = PublicApplySchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: 'Validation error: please check required fields and consent',
        details: parsed.error.format(),
      };
    }

    const data = parsed.data;

    // 1. Anti-spam honeypot
    if (!validateHoneypot(data.website_url_hp)) {
      return { success: false, error: 'Submission rejected' };
    }

    // 2. CAPTCHA verification
    const captcha = getCaptchaProvider();
    const captchaResult = await captcha.verify(data.captchaToken);
    if (!captchaResult.success) {
      return { success: false, error: captchaResult.error || 'CAPTCHA verification failed' };
    }

    // 3. Verify Job status
    const job = await prisma.job.findUnique({
      where: { id: data.jobId },
      include: {
        organization: true,
        client: true,
      },
    });

    if (!job || !isJobPubliclyEligible(job) || job.organization.status !== 'ACTIVE') {
      return { success: false, error: 'This position is no longer accepting applications' };
    }

    const normalizedEmail = normalizeEmail(data.email);
    const normalizedPhone = normalizePhone(data.phone);

    // 4. Database Transaction
    const result = await prisma.$transaction(async (tx) => {
      // Find candidate
      const existingCandidates = await tx.candidate.findMany({
        where: {
          organizationId: job.organizationId,
          email: normalizedEmail,
          isArchived: false,
        },
      });

      let candidate: any;

      if (existingCandidates.length === 1) {
        candidate = await tx.candidate.update({
          where: { id: existingCandidates[0].id },
          data: {
            phone: normalizedPhone,
            location: data.currentLocation,
            experienceYears: new Prisma.Decimal(data.experienceYears),
            consentRecordedAt: new Date(),
          },
        });
      } else if (existingCandidates.length > 1) {
        candidate = existingCandidates[0];
        await tx.candidate.update({
          where: { id: candidate.id },
          data: { consentRecordedAt: new Date() },
        });
      } else {
        const count = await tx.candidate.count({ where: { organizationId: job.organizationId } });
        const code = `cand-c-${String(count + 1).padStart(4, '0')}`;

        candidate = await tx.candidate.create({
          data: {
            code,
            name: data.fullName.trim(),
            email: normalizedEmail,
            phone: normalizedPhone,
            location: data.currentLocation.trim(),
            experienceYears: new Prisma.Decimal(data.experienceYears),
            source: 'Careers site',
            organizationId: job.organizationId,
            consentRecordedAt: new Date(),
          },
        });
      }

      // Find or create Application (Playbook rule: Re-application updates rather than duplicates)
      let application = await tx.application.findUnique({
        where: {
          candidateId_jobId: {
            candidateId: candidate.id,
            jobId: job.id,
          },
        },
      });

      let referenceNumber: string;

      if (application) {
        referenceNumber =
          application.referenceNumber || generateApplicationReference(job.code, application.id);

        application = await tx.application.update({
          where: { id: application.id },
          data: {
            appliedAt: new Date(),
            referenceNumber,
          },
        });

        await tx.applicationStageHistory.create({
          data: {
            applicationId: application.id,
            toStage: 'Sourced (Re-applied via Careers site)',
            changedById: 'SYSTEM_PUBLIC_CAREERS',
            comments: `Candidate re-applied via Careers site. Experience: ${data.experienceYears} yrs. Note: ${data.additionalNote || 'None'}`,
          },
        });
      } else {
        let defaultStage = await tx.stage.findFirst({
          where: {
            organizationId: job.organizationId,
            name: { equals: 'Sourced', mode: 'insensitive' },
            isArchived: false,
          },
        });

        if (!defaultStage) {
          defaultStage = await tx.stage.findFirst({
            where: { organizationId: job.organizationId, isArchived: false },
            orderBy: { order: 'asc' },
          });
        }

        const appId = crypto.randomUUID();
        referenceNumber = generateApplicationReference(job.code, appId);

        application = await tx.application.create({
          data: {
            id: appId,
            candidateId: candidate.id,
            jobId: job.id,
            stageId: defaultStage?.id || null,
            status: ApplicationStatus.SOURCED,
            referenceNumber,
            appliedAt: new Date(),
          },
        });

        await tx.applicationStageHistory.create({
          data: {
            applicationId: application.id,
            toStage: defaultStage?.name || 'Sourced',
            changedById: 'SYSTEM_PUBLIC_CAREERS',
            comments: `Initial application submitted via Careers site. Experience: ${data.experienceYears} yrs. Note: ${data.additionalNote || 'None'}`,
          },
        });
      }

      // Attach Resume
      await tx.candidateDocument.create({
        data: {
          candidateId: candidate.id,
          fileName: data.resumeFileName,
          fileUrl: data.resumeKey,
          storageBucket: 'resumes',
          documentType: 'RESUME',
          uploadedById: 'SYSTEM_PUBLIC_CAREERS',
        },
      });

      // Cleanup draft if token provided
      if (data.draftToken) {
        await tx.applicationDraft.deleteMany({
          where: { token: data.draftToken },
        });
      }

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId: 'SYSTEM_PUBLIC_CAREERS',
          action: 'PUBLIC_CAREERS_APPLICATION_SUBMITTED',
          entity: 'Application',
          entityId: application.id,
          after: {
            candidateId: candidate.id,
            candidateEmail: normalizedEmail,
            jobId: job.id,
            jobCode: job.code,
            jobTitle: job.title,
            referenceNumber,
            source: 'Careers site',
          },
        },
      });

      return {
        applicationId: application.id,
        referenceNumber,
        jobTitle: job.title,
        candidateName: candidate.name,
        candidateEmail: candidate.email,
        appliedAt: application.appliedAt.toISOString(),
      };
    });

    // Confirmation Email
    try {
      MockEmailProvider.sendEmail({
        to: result.candidateEmail,
        subject: `Application Received: ${result.jobTitle} (${result.referenceNumber})`,
        bodyHtml: `
          <div style="font-family: sans-serif; color: #1B2236; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #5B49D6;">Application Received</h2>
            <p>Dear ${result.candidateName},</p>
            <p>Thank you for applying for the <strong>${result.jobTitle}</strong> position.</p>
            <div style="background-color: #EEEBFB; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #5B49D6; font-weight: bold;">Application Reference Number:</p>
              <p style="margin: 4px 0 0; font-size: 20px; font-weight: 800; letter-spacing: 1px;">${result.referenceNumber}</p>
            </div>
            <p>Our recruitment team is reviewing your profile and will be in touch with next steps.</p>
            <p style="color: #6B7490; font-size: 12px; margin-top: 30px;">HireFlow ATS • Aureva Capital Private Limited</p>
          </div>
        `,
      });
    } catch (e) {
      console.warn('[submitPublicApplicationAction] Email delivery skipped/warn:', e);
    }

    return {
      success: true,
      data: {
        applicationId: result.applicationId,
        referenceNumber: result.referenceNumber,
        jobTitle: result.jobTitle,
        candidateName: result.candidateName,
        appliedAt: result.appliedAt,
      },
    };
  } catch (err: unknown) {
    console.error('[submitPublicApplicationAction] Error:', err);
    return { success: false, error: 'Failed to submit application. Please try again.' };
  }
}
