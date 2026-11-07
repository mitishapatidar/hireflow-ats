import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../server.js';
import { prisma } from '@hireflow/db';

describe('Prompt 28: Public Careers & Application Workflow Integration Tests', () => {
  let server: FastifyInstance;
  let testJobId: string;
  let confidentialJobId: string;
  let unpublishedJobId: string;

  beforeAll(async () => {
    server = buildServer();
    await server.ready();

    // Verify or fetch seed jobs
    const publishedJob = await prisma.job.findFirst({
      where: { code: 'J-201', isPublished: true },
    });
    testJobId = publishedJob?.id || 'job-j201';

    const confJob = await prisma.job.findFirst({
      where: { code: 'J-203', hideClientName: true },
    });
    confidentialJobId = confJob?.id || 'job-j203';

    const unpubJob = await prisma.job.findFirst({
      where: { code: 'J-206' },
    });
    unpublishedJobId = unpubJob?.id || 'job-j206';
  });

  afterAll(async () => {
    await server.close();
  });

  it('1. GET /api/public/careers/branding returns public styling without internal credentials', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/public/careers/branding',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.brandPrimaryColor).toBe('#5B49D6');
    expect(body.data.brandSecondaryColor).toBe('#1E2A4A');
    expect(body.data.headline).toBe('Explore Open Technology Mandates');
    expect(body.data.orgName).toBe('Aureva Capital Private Limited');
    // Ensure no internal configuration keys leaked
    expect(body.data.databaseUrl).toBeUndefined();
    expect(body.data.smtpSecret).toBeUndefined();
  });

  it('2. GET /api/public/careers/jobs lists only eligible published jobs with permission masking', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/public/careers/jobs',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);

    // Verify J-201 is present
    const j201 = body.data.find((j: any) => j.code === 'J-201');
    expect(j201).toBeDefined();
    expect(j201.title).toBe('Staff Frontend Architect');
    expect(j201.isSalaryPublic).toBe(true);
    expect(j201.salaryMin).toBe(3500000);
    expect(j201.salaryMax).toBe(4500000);

    // Verify unpublished job J-206 is strictly NOT in the public response
    const j206 = body.data.find((j: any) => j.code === 'J-206');
    expect(j206).toBeUndefined();

    // Verify confidential client masking for J-203
    const j203 = body.data.find((j: any) => j.code === 'J-203');
    if (j203) {
      expect(j203.companyName).toBe('Confidential client');
      expect(j203.isClientConfidential).toBe(true);
      expect(JSON.stringify(j203)).not.toContain('Bright Labs');
    }

    // Verify zero data leak of internal recruiter information
    for (const job of body.data) {
      expect(job.ownerId).toBeUndefined();
      expect(job.ownerName).toBeUndefined();
      expect(job.commercialFeePercentage).toBeUndefined();
      expect(job.closingNote).toBeUndefined();
    }
  });

  it('3. GET /api/public/careers/jobs/:slugOrId returns job details or 404 for unpublished', async () => {
    // Eligible job
    const resPublished = await server.inject({
      method: 'GET',
      url: `/api/public/careers/jobs/${testJobId}`,
    });
    expect(resPublished.statusCode).toBe(200);
    expect(resPublished.json().data.code).toBe('J-201');

    // Ineligible unpublished job
    const resUnpublished = await server.inject({
      method: 'GET',
      url: `/api/public/careers/jobs/${unpublishedJobId}`,
    });
    expect(resUnpublished.statusCode).toBe(404);
  });

  it('4. POST /api/public/careers/upload validates magic bytes and rejects executables', async () => {
    // A. Valid PDF file (with %PDF- header)
    const validPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
    const resValid = await server.inject({
      method: 'POST',
      url: '/api/public/careers/upload',
      payload: {
        fileName: 'Resume_Candidate.pdf',
        mimeType: 'application/pdf',
        fileBase64: validPdfBuffer.toString('base64'),
      },
    });

    expect(resValid.statusCode).toBe(200);
    const body = resValid.json();
    expect(body.success).toBe(true);
    expect(body.data.storageKey).toMatch(/^resumes\//);

    // B. Malicious executable with disguised .pdf extension (MZ header)
    const maliciousBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    const resMalicious = await server.inject({
      method: 'POST',
      url: '/api/public/careers/upload',
      payload: {
        fileName: 'Malware_Disguised.pdf',
        mimeType: 'application/pdf',
        fileBase64: maliciousBuffer.toString('base64'),
      },
    });

    expect(resMalicious.statusCode).toBe(400);
    expect(resMalicious.json().error).toBeDefined();
  });

  it('5. POST and GET /api/public/careers/applications/draft saves and resumes draft by 64-char token', async () => {
    // Save Draft
    const resDraft = await server.inject({
      method: 'POST',
      url: '/api/public/careers/applications/draft',
      payload: {
        jobId: testJobId,
        formData: {
          fullName: 'Kavita Patel',
          email: 'kavita.patel@example.com',
          phone: '+91 99887 76655',
          currentLocation: 'Mumbai',
          experienceYears: 5,
        },
      },
    });

    expect(resDraft.statusCode).toBe(200);
    const draftToken = resDraft.json().data.draftToken;
    expect(draftToken).toBeDefined();
    expect(draftToken.length).toBe(64);

    // Retrieve Draft by Token
    const resGet = await server.inject({
      method: 'GET',
      url: `/api/public/careers/applications/draft/${draftToken}`,
    });

    expect(resGet.statusCode).toBe(200);
    const draftData = resGet.json().data;
    expect(draftData.formData.fullName).toBe('Kavita Patel');
    expect(draftData.formData.email).toBe('kavita.patel@example.com');
  });

  it('6. POST /api/public/careers/applications/submit creates candidate and application in Sourced stage', async () => {
    const candidateEmail = `public.applicant.${Date.now()}@example.com`;
    const res = await server.inject({
      method: 'POST',
      url: '/api/public/careers/applications/submit',
      payload: {
        jobId: testJobId,
        fullName: 'Vikram Malhotra',
        email: candidateEmail,
        phone: '+91 91234 56789',
        currentLocation: 'Hyderabad, India',
        experienceYears: 8,
        portfolioUrl: 'https://github.com/v-malhotra',
        resumeKey: 'resumes/vikram-resume-101.pdf',
        resumeFileName: 'Vikram_Malhotra_CV.pdf',
        resumeFileSize: 1024 * 400,
        additionalNote: 'Strong proficiency in TypeScript and high-scale frontends.',
        consentGiven: true,
        captchaToken: 'mock-captcha-token',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.applicationId).toBeDefined();
    expect(body.data.referenceNumber).toMatch(/^APP-J-201-/);
    expect(body.data.jobTitle).toBe('Staff Frontend Architect');

    // Verify in database: candidate exists with source 'Careers site'
    const candidate = await prisma.candidate.findFirst({
      where: { email: candidateEmail.toLowerCase() },
      include: { applications: true },
    });

    expect(candidate).toBeDefined();
    expect(candidate?.source).toBe('Careers site');
    expect(candidate?.applications.length).toBe(1);
    expect(candidate?.applications[0].status).toBe('SOURCED');
  });

  it('7. POST /api/public/careers/applications/submit handles re-application without duplicating candidate or application', async () => {
    const reapplyEmail = `reapply.candidate.${Date.now()}@example.com`;

    // 1st Application
    const firstRes = await server.inject({
      method: 'POST',
      url: '/api/public/careers/applications/submit',
      payload: {
        jobId: testJobId,
        fullName: 'Meera Sengupta',
        email: reapplyEmail,
        phone: '+91 98888 11111',
        currentLocation: 'Bengaluru',
        experienceYears: 4,
        resumeKey: 'resumes/meera-v1.pdf',
        resumeFileName: 'Meera_CV_v1.pdf',
        resumeFileSize: 250000,
        consentGiven: true,
        captchaToken: 'mock-captcha-token',
      },
    });

    expect(firstRes.statusCode).toBe(200);
    const firstRef = firstRes.json().data.referenceNumber;

    // 2nd Application (same email, same job, updated phone & resume v2)
    const secondRes = await server.inject({
      method: 'POST',
      url: '/api/public/careers/applications/submit',
      payload: {
        jobId: testJobId,
        fullName: 'Meera Sengupta',
        email: reapplyEmail,
        phone: '+91 98888 22222',
        currentLocation: 'Bengaluru / Remote',
        experienceYears: 4.5,
        resumeKey: 'resumes/meera-v2.pdf',
        resumeFileName: 'Meera_CV_v2.pdf',
        resumeFileSize: 260000,
        additionalNote: 'Updated CV with recent Next.js 14 project experience.',
        consentGiven: true,
        captchaToken: 'mock-captcha-token',
      },
    });

    expect(secondRes.statusCode).toBe(200);
    const secondRef = secondRes.json().data.referenceNumber;
    expect(secondRef).toBe(firstRef); // Preserves existing reference

    // Verify database: strictly 1 Candidate and 1 Application
    const candidates = await prisma.candidate.findMany({
      where: { email: reapplyEmail.toLowerCase() },
      include: { applications: true, documents: true },
    });

    expect(candidates.length).toBe(1);
    expect(candidates[0].applications.length).toBe(1);
    // Verified resume documents attached
    expect(candidates[0].documents.length).toBe(2);
  });

  it('8. POST /api/public/careers/applications/submit rejects bot honeypot submission', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/public/careers/applications/submit',
      payload: {
        jobId: testJobId,
        fullName: 'Spam Bot',
        email: 'bot@spammer.org',
        phone: '+1 555 123 4567',
        currentLocation: 'Unknown',
        experienceYears: 1,
        resumeKey: 'resumes/fake.pdf',
        resumeFileName: 'fake.pdf',
        resumeFileSize: 1000,
        consentGiven: true,
        captchaToken: 'mock-captcha-token',
        website_url_hp: 'http://buy-viagra-cheap.com', // Honeypot populated!
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('Submission rejected');
  });

  it('9. POST /api/public/careers/applications/submit rejects invalid or bot CAPTCHA token', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/public/careers/applications/submit',
      payload: {
        jobId: testJobId,
        fullName: 'Bot Applicant',
        email: 'bot@example.com',
        phone: '+91 90000 00000',
        currentLocation: 'Delhi',
        experienceYears: 2,
        resumeKey: 'resumes/bot.pdf',
        resumeFileName: 'bot.pdf',
        resumeFileSize: 1000,
        consentGiven: true,
        captchaToken: 'bot-token', // Flagged bot token
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('Automated bot detected');
  });
});
