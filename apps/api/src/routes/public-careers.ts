import { FastifyPluginAsync } from 'fastify';
import { prisma, Prisma, ApplicationStatus } from '@hireflow/db';
import {
  serializePublicJob,
  isJobPubliclyEligible,
  PublicApplySchema,
  SaveApplicationDraftSchema,
  PublicJobQuerySchema,
  generateDraftToken,
  generateApplicationReference,
  DEFAULT_CAREERS_BRANDING,
  CareersBrandingDTO,
  normalizeEmail,
  normalizePhone,
  validateFileSecurity,
  getStorageProvider,
  getAntivirusScanner,
  getCaptchaProvider,
  validateHoneypot,
} from '@hireflow/shared';

// In-memory sliding window rate limiter for public endpoints
const ipRequestCounts = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = ipRequestCounts.get(ip);
  if (!entry || entry.resetAt < now) {
    ipRequestCounts.set(ip, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) {
    return false;
  }
  entry.count += 1;
  return true;
}

export const publicCareersRoutes: FastifyPluginAsync = async (server) => {
  // -------------------------------------------------------------
  // 1. GET /api/public/careers/branding
  // -------------------------------------------------------------
  server.get('/branding', async (_request, reply) => {
    try {
      const org = await prisma.organization.findFirst({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, settings: true },
      });

      if (!org) {
        return reply.status(404).send({ success: false, error: 'Organization not found' });
      }

      const settings = (org.settings as any) || {};
      const customBranding = settings.careersBranding || {};

      const branding: CareersBrandingDTO & { orgName: string } = {
        ...DEFAULT_CAREERS_BRANDING,
        ...customBranding,
        orgName: org.name,
      };

      return reply.send({ success: true, data: branding });
    } catch (err: unknown) {
      server.log.error(err, 'Failed to fetch public careers branding');
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // -------------------------------------------------------------
  // 2. GET /api/public/careers/jobs (List active, published jobs)
  // -------------------------------------------------------------
  server.get('/jobs', async (request, reply) => {
    try {
      const parsedQuery = PublicJobQuerySchema.safeParse(request.query);
      if (!parsedQuery.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid query parameters',
          details: parsedQuery.error.format(),
        });
      }

      const { search, location, employmentType, page, limit } = parsedQuery.data;

      // Base public eligibility filters:
      // status = ACTIVE, isPublished = true, isArchived = false, organization.status = ACTIVE
      const where: Prisma.JobWhereInput = {
        status: 'ACTIVE',
        isPublished: true,
        isArchived: false,
        organization: { status: 'ACTIVE' },
        OR: [
          { deadline: null },
          { deadline: { gte: new Date() } },
        ],
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

      return reply.send({
        success: true,
        data: jobs,
        pagination: {
          total: totalCount,
          page,
          limit,
          totalPages: Math.ceil(totalCount / limit) || 1,
        },
      });
    } catch (err: unknown) {
      server.log.error(err, 'Failed to fetch public careers jobs');
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // -------------------------------------------------------------
  // 3. GET /api/public/careers/jobs/:slugOrId (Job Detail)
  // -------------------------------------------------------------
  server.get('/jobs/:slugOrId', async (request, reply) => {
    try {
      const { slugOrId } = request.params as { slugOrId: string };
      if (!slugOrId) {
        return reply.status(400).send({ success: false, error: 'Job identifier is required' });
      }

      // Find job by ID or Code (e.g. J-201)
      const rawJob = await prisma.job.findFirst({
        where: {
          OR: [
            { id: slugOrId },
            { code: { equals: slugOrId, mode: 'insensitive' } },
          ],
          organization: { status: 'ACTIVE' },
        },
        include: {
          client: { select: { legalName: true } },
        },
      });

      if (!rawJob || !isJobPubliclyEligible(rawJob)) {
        return reply.status(404).send({ success: false, error: 'Job not found or no longer available' });
      }

      const publicJob = serializePublicJob(rawJob);
      if (!publicJob) {
        return reply.status(404).send({ success: false, error: 'Job not found or no longer available' });
      }

      return reply.send({ success: true, data: publicJob });
    } catch (err: unknown) {
      server.log.error(err, 'Failed to fetch public job details');
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // -------------------------------------------------------------
  // 4. POST /api/public/careers/upload (Resume Upload)
  // -------------------------------------------------------------
  server.post('/upload', async (request, reply) => {
    const clientIp = request.ip || '127.0.0.1';
    if (!checkRateLimit(clientIp, 25, 5 * 60 * 1000)) {
      return reply.status(429).send({
        success: false,
        error: 'Too many upload attempts. Please wait a few minutes before trying again.',
      });
    }

    try {
      const body = request.body as any;
      if (!body || !body.fileBase64 || !body.fileName) {
        return reply.status(400).send({
          success: false,
          error: 'fileBase64 and fileName are required for public resume upload',
        });
      }

      const buffer = Buffer.from(body.fileBase64, 'base64');
      const fileName = String(body.fileName);
      const declaredMime = body.mimeType ? String(body.mimeType) : undefined;

      // 1. Security & Magic Bytes Check
      const secCheck = validateFileSecurity(buffer, fileName, declaredMime);
      if (!secCheck.valid) {
        return reply.status(400).send({ success: false, error: secCheck.error });
      }

      // 2. Antivirus Scan
      const avScanner = getAntivirusScanner();
      const avResult = await avScanner.scan(buffer, fileName);
      if (!avResult.clean) {
        return reply.status(400).send({
          success: false,
          error: `Security Alert: File flagged by security scan (${avResult.threatFound || 'Threat detected'}).`,
        });
      }

      // 3. Private Storage Upload
      const storage = getStorageProvider();
      const uploadResult = await storage.uploadFile(buffer, {
        fileName,
        mimeType: secCheck.detectedMime || declaredMime || 'application/pdf',
        fileSize: buffer.length,
      });

      return reply.send({
        success: true,
        data: {
          storageKey: uploadResult.storageKey,
          fileName,
          fileSize: uploadResult.fileSize,
          checksum: uploadResult.checksum,
          uploadedAt: uploadResult.uploadedAt,
        },
      });
    } catch (err: unknown) {
      server.log.error(err, 'Failed to process public resume upload');
      return reply.status(500).send({ success: false, error: 'Internal server error during upload' });
    }
  });

  // -------------------------------------------------------------
  // 5. POST /api/public/careers/applications/draft (Save Draft)
  // -------------------------------------------------------------
  server.post('/applications/draft', async (request, reply) => {
    const clientIp = request.ip || '127.0.0.1';
    if (!checkRateLimit(clientIp, 30, 5 * 60 * 1000)) {
      return reply.status(429).send({
        success: false,
        error: 'Too many draft requests. Please wait a few minutes before trying again.',
      });
    }

    try {
      const parsed = SaveApplicationDraftSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid draft data',
          details: parsed.error.format(),
        });
      }

      const { jobId, formData, resumeKey, draftToken: existingToken } = parsed.data;

      // Verify job exists and is eligible
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: { id: true, organizationId: true, status: true, isPublished: true, isArchived: true },
      });

      if (!job || !isJobPubliclyEligible(job)) {
        return reply.status(400).send({ success: false, error: 'Job is not open for applications' });
      }

      const token = existingToken && existingToken.trim().length === 64 ? existingToken : generateDraftToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30-day expiry

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

      return reply.send({
        success: true,
        data: {
          draftToken: draft.token,
          expiresAt: draft.expiresAt.toISOString(),
          jobId: draft.jobId,
        },
      });
    } catch (err: unknown) {
      server.log.error(err, 'Failed to save application draft');
      return reply.status(500).send({ success: false, error: 'Failed to save draft' });
    }
  });

  // -------------------------------------------------------------
  // 6. GET /api/public/careers/applications/draft/:token (Resume Draft)
  // -------------------------------------------------------------
  server.get('/applications/draft/:token', async (request, reply) => {
    try {
      const { token } = request.params as { token: string };
      if (!token || token.length !== 64) {
        return reply.status(400).send({ success: false, error: 'Invalid draft token format' });
      }

      const draft = await prisma.applicationDraft.findUnique({
        where: { token },
      });

      if (!draft) {
        return reply.status(404).send({ success: false, error: 'Application draft not found' });
      }

      if (draft.expiresAt.getTime() < Date.now()) {
        return reply.status(410).send({ success: false, error: 'Application draft has expired' });
      }

      return reply.send({
        success: true,
        data: {
          draftToken: draft.token,
          jobId: draft.jobId,
          formData: draft.formData,
          resumeKey: draft.resumeKey,
          expiresAt: draft.expiresAt.toISOString(),
        },
      });
    } catch (err: unknown) {
      server.log.error(err, 'Failed to retrieve application draft');
      return reply.status(500).send({ success: false, error: 'Internal server error' });
    }
  });

  // -------------------------------------------------------------
  // 7. POST /api/public/careers/applications/submit (Final Submission)
  // -------------------------------------------------------------
  server.post('/applications/submit', async (request, reply) => {
    const clientIp = request.ip || '127.0.0.1';
    if (!checkRateLimit(clientIp, 15, 5 * 60 * 1000)) {
      return reply.status(429).send({
        success: false,
        error: 'Too many application attempts. Please wait a few minutes before trying again.',
      });
    }

    try {
      const parsed = PublicApplySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error: please check required fields and consent',
          details: parsed.error.format(),
        });
      }

      const input = parsed.data;

      // 1. Anti-spam honeypot verification
      if (!validateHoneypot(input.website_url_hp)) {
        server.log.warn({ ip: clientIp }, 'Automated bot submission rejected by honeypot');
        return reply.status(400).send({ success: false, error: 'Submission rejected' });
      }

      // 2. CAPTCHA verification
      const captcha = getCaptchaProvider();
      const captchaResult = await captcha.verify(input.captchaToken, clientIp);
      if (!captchaResult.success) {
        return reply.status(400).send({
          success: false,
          error: captchaResult.error || 'CAPTCHA verification failed',
        });
      }

      // 3. Immediate pre-submission check: Job must exist, be ACTIVE, isPublished, unexpired
      const job = await prisma.job.findUnique({
        where: { id: input.jobId },
        include: {
          organization: true,
          client: true,
        },
      });

      if (!job || !isJobPubliclyEligible(job) || job.organization.status !== 'ACTIVE') {
        return reply.status(400).send({
          success: false,
          error: 'This position is no longer accepting applications',
        });
      }

      const normalizedEmail = normalizeEmail(input.email);
      const normalizedPhone = normalizePhone(input.phone);

      // 4. Atomic Execution inside Database Transaction
      const result = await prisma.$transaction(async (tx) => {
        // A. Candidate Resolution & Duplicate Matching
        // Search by normalized email within the organization scope
        const existingCandidates = await tx.candidate.findMany({
          where: {
            organizationId: job.organizationId,
            email: normalizedEmail,
            isArchived: false,
          },
        });

        let candidate: any;

        if (existingCandidates.length === 1) {
          // Unambiguous candidate match: update permitted contact fields and consent
          candidate = await tx.candidate.update({
            where: { id: existingCandidates[0].id },
            data: {
              phone: normalizedPhone,
              location: input.currentLocation,
              experienceYears: new Prisma.Decimal(input.experienceYears),
              consentRecordedAt: new Date(),
            },
          });
        } else if (existingCandidates.length > 1) {
          // Ambiguity: do not automatically merge. Select primary candidate and log flag
          candidate = existingCandidates[0];
          await tx.candidate.update({
            where: { id: candidate.id },
            data: {
              consentRecordedAt: new Date(),
            },
          });
        } else {
          // Create new Candidate with sequential code
          const count = await tx.candidate.count({ where: { organizationId: job.organizationId } });
          const code = `cand-c-${String(count + 1).padStart(4, '0')}`;

          candidate = await tx.candidate.create({
            data: {
              code,
              name: input.fullName.trim(),
              email: normalizedEmail,
              phone: normalizedPhone,
              location: input.currentLocation.trim(),
              experienceYears: new Prisma.Decimal(input.experienceYears),
              source: 'Careers site',
              organizationId: job.organizationId,
              consentRecordedAt: new Date(),
            },
          });
        }

        // B. Application Resolution (Playbook Rule: Re-application updates existing rather than duplicating)
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
          // Re-application: preserve existing reference number, update timestamps
          referenceNumber =
            application.referenceNumber || generateApplicationReference(job.code, application.id);

          application = await tx.application.update({
            where: { id: application.id },
            data: {
              appliedAt: new Date(),
              referenceNumber,
            },
          });

          // Log stage history event for re-application
          await tx.applicationStageHistory.create({
            data: {
              applicationId: application.id,
              toStage: 'Sourced (Re-applied via Careers site)',
              changedById: 'SYSTEM_PUBLIC_CAREERS',
              comments: `Candidate re-applied via Careers site. Experience: ${input.experienceYears} yrs. Note: ${input.additionalNote || 'None'}`,
            },
          });
        } else {
          // Initial Application: find default stage 'Sourced'
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
              comments: `Initial application submitted via Careers site. Experience: ${input.experienceYears} yrs. Note: ${input.additionalNote || 'None'}`,
            },
          });
        }

        // C. Record / Attach Resume Document
        await tx.candidateDocument.create({
          data: {
            candidateId: candidate.id,
            fileName: input.resumeFileName,
            fileUrl: input.resumeKey,
            storageBucket: 'resumes',
            documentType: 'RESUME',
            uploadedById: 'SYSTEM_PUBLIC_CAREERS',
          },
        });

        // D. Clean up consumed draft if token provided
        if (input.draftToken) {
          await tx.applicationDraft.deleteMany({
            where: { token: input.draftToken },
          });
        }

        // E. Structured Audit Log
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
            ipAddress: clientIp,
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

      // 5. Post-Commit: Send Confirmation Email (Mock Provider)
      try {
        const { MockEmailProvider } = await import('@hireflow/shared');
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
      } catch (emailErr) {
        server.log.warn(emailErr, 'Failed to dispatch confirmation email after commit');
      }

      return reply.send({
        success: true,
        data: {
          applicationId: result.applicationId,
          referenceNumber: result.referenceNumber,
          jobTitle: result.jobTitle,
          candidateName: result.candidateName,
          appliedAt: result.appliedAt,
        },
      });
    } catch (err: unknown) {
      server.log.error(err, 'Failed to process public application submission');
      return reply.status(500).send({ success: false, error: 'Internal server error during submission' });
    }
  });
};
