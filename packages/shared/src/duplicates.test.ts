import { describe, it, expect } from 'vitest';
import {
  normalizeCandidateEmail,
  normalizeCandidatePhone,
  normalizeCompanyForMatching,
  normalizeNameForMatching,
  levenshteinDistance,
  stringSimilarity,
  tokenOverlapRatio,
  evaluateCandidateDuplicate,
} from './duplicates';
import {
  validateMergeEligibility,
  mergeCandidateSkills,
} from './merges';
import {
  generateExtensionCaptureToken,
  hashExtensionCaptureToken,
  isExtensionTokenExpired,
} from './sourcing';
import {
  NaukriIntegrationProvider,
  FounditIntegrationProvider,
  InboundEmailProvider,
} from './sourcing-integrations';

describe('Prompt 20: Duplicate Detection Engine Tests', () => {
  it('normalizes email addresses by trimming and lowercasing', () => {
    expect(normalizeCandidateEmail('  Test.Candidate@Example.COM  ')).toBe('test.candidate@example.com');
    expect(normalizeCandidateEmail('')).toBe('');
    expect(normalizeCandidateEmail(null)).toBe('');
  });

  it('normalizes Indian phone numbers stripping +91, 0 prefixes and non-digits to 10 digits', () => {
    expect(normalizeCandidatePhone('+91 98765 43210')).toBe('9876543210');
    expect(normalizeCandidatePhone('09876543210')).toBe('9876543210');
    expect(normalizeCandidatePhone('98765-43210')).toBe('9876543210');
    expect(normalizeCandidatePhone('')).toBe(null);
    expect(normalizeCandidatePhone(null)).toBe(null);
  });

  it('normalizes company names by removing legal forms and punctuation', () => {
    expect(normalizeCompanyForMatching('Tata Consultancy Services Ltd.')).toBe('tata consultancy');
    expect(normalizeCompanyForMatching('Infosys Technologies Private Limited')).toBe('infosys');
    expect(normalizeCompanyForMatching('Razorpay Software Pvt Ltd')).toBe('razorpay software');
  });

  it('normalizes candidate names by removing honorifics and symbols', () => {
    expect(normalizeNameForMatching('Dr. Rajesh Sharma, Ph.D.')).toBe('rajesh sharma ph d');
    expect(normalizeNameForMatching('Mr. Priya Patel')).toBe('priya patel');
  });

  it('calculates string similarity and Levenshtein distance correctly', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
    expect(stringSimilarity('Rajesh Sharma', 'Rajesh Sharma')).toBe(1.0);
    expect(stringSimilarity('Rajesh Sharma', 'Rajesh Verma')).toBeGreaterThan(0.7);
    expect(stringSimilarity('Rajesh', 'Suresh')).toBeGreaterThan(0.4);
    expect(stringSimilarity('Apple', 'Banana')).toBeLessThan(0.3);
  });

  it('computes token overlap ratio for word order variances', () => {
    expect(tokenOverlapRatio('Priya Patel', 'Patel Priya')).toBe(1.0);
    expect(tokenOverlapRatio('Infosys Technologies', 'Infosys Pvt Ltd')).toBe(0.4);
  });

  it('detects exact email duplicate with score 1.0 and category EXACT_DUPLICATE', () => {
    const existing = {
      id: 'c-1',
      code: 'CAN-101',
      name: 'Rohan Mehta',
      email: 'rohan.mehta@acme.com',
      phone: '+91 99999 88888',
      currentCompany: 'Google India',
      isArchived: false,
    };

    const res = evaluateCandidateDuplicate(
      { name: 'Rohan M', email: 'rohan.mehta@acme.com', phone: null, company: 'Google' },
      existing
    );

    expect(res.isDuplicate).toBe(true);
    expect(res.category).toBe('EXACT_DUPLICATE');
    expect(res.score).toBe(1.0);
    expect(res.reasons).toContain('EXACT_EMAIL_MATCH');
  });

  it('detects exact phone duplicate even if email is completely different', () => {
    const existing = {
      id: 'c-2',
      code: 'CAN-102',
      name: 'Aarti Shah',
      email: 'aarti.old@gmail.com',
      phone: '+91 98200 12345',
      currentCompany: 'Wipro',
      isArchived: false,
    };

    const res = evaluateCandidateDuplicate(
      { name: 'Aarti Shah', email: 'aarti.new@yahoo.com', phone: '09820012345', company: 'Wipro' },
      existing
    );

    expect(res.isDuplicate).toBe(true);
    expect(res.category).toBe('EXACT_DUPLICATE');
    expect(res.score).toBe(1.0);
    expect(res.reasons).toContain('EXACT_PHONE_MATCH');
  });

  it('detects fuzzy duplicate on strong name + company match', () => {
    const existing = {
      id: 'c-3',
      code: 'CAN-103',
      name: 'Vikramaditya Singhania',
      email: 'vikram.singh@corporate.in',
      phone: '+91 91111 22222',
      currentCompany: 'Reliance Jio Infocomm Limited',
      isArchived: false,
    };

    const res = evaluateCandidateDuplicate(
      {
        name: 'Vikramaditya Singhania',
        email: 'unlisted@unknown.com',
        phone: '+91 97777 66666',
        company: 'Reliance Jio Infocomm',
      },
      existing
    );

    expect(res.isDuplicate).toBe(true);
    expect(res.category).toBe('POSSIBLE_DUPLICATE');
    expect(res.score).toBeGreaterThanOrEqual(0.85);
    expect(res.reasons).toContain('STRONG_NAME_COMPANY_MATCH');
  });

  it('returns NO_MATCH when candidates have distinct names, emails, phones, and companies', () => {
    const existing = {
      id: 'c-4',
      code: 'CAN-104',
      name: 'Sneha Kulkarni',
      email: 'sneha@pune.org',
      phone: '+91 93333 44444',
      currentCompany: 'Capgemini',
      isArchived: false,
    };

    const res = evaluateCandidateDuplicate(
      {
        name: 'Arjun Nambiar',
        email: 'arjun.n@kerala.net',
        phone: '+91 95555 66666',
        company: 'Zoho Corporation',
      },
      existing
    );

    expect(res.isDuplicate).toBe(false);
    expect(res.category).toBe('NO_MATCH');
    expect(res.score).toBeLessThan(0.6);
  });
});

describe('Prompt 20: Candidate Merge Validation Tests', () => {
  it('blocks self-merge attempts with code SELF_MERGE_PROHIBITED', () => {
    const candidate = {
      id: 'cand-1',
      code: 'CAN-1',
      name: 'Test Candidate',
      organizationId: 'org-1',
      isArchived: false,
    };

    const res = validateMergeEligibility(candidate, candidate);
    expect(res.eligible).toBe(false);
    expect(res.code).toBe('SELF_MERGE_PROHIBITED');
  });

  it('blocks cross-organization merge attempts', () => {
    const master = {
      id: 'cand-1',
      code: 'CAN-1',
      name: 'Test 1',
      organizationId: 'org-aureva',
      isArchived: false,
    };
    const secondary = {
      id: 'cand-2',
      code: 'CAN-2',
      name: 'Test 2',
      organizationId: 'org-other',
      isArchived: false,
    };

    const res = validateMergeEligibility(master, secondary);
    expect(res.eligible).toBe(false);
    expect(res.code).toBe('CROSS_ORG_MERGE_FORBIDDEN');
  });

  it('blocks merging into an archived master candidate', () => {
    const master = {
      id: 'cand-1',
      code: 'CAN-1',
      name: 'Archived Master',
      organizationId: 'org-1',
      isArchived: true,
    };
    const secondary = {
      id: 'cand-2',
      code: 'CAN-2',
      name: 'Active Secondary',
      organizationId: 'org-1',
      isArchived: false,
    };

    const res = validateMergeEligibility(master, secondary);
    expect(res.eligible).toBe(false);
    expect(res.code).toBe('MASTER_ARCHIVED');
  });

  it('blocks merge if secondary was already merged previously', () => {
    const master = {
      id: 'cand-1',
      code: 'CAN-1',
      name: 'Master',
      organizationId: 'org-1',
      isArchived: false,
    };
    const secondary = {
      id: 'cand-2',
      code: 'CAN-2',
      name: 'Already Merged',
      organizationId: 'org-1',
      isArchived: true,
      isMerged: true,
      mergedIntoCandidateId: 'cand-0',
    };

    const res = validateMergeEligibility(master, secondary);
    expect(res.eligible).toBe(false);
    expect(res.code).toBe('SECONDARY_ALREADY_MERGED');
  });

  it('flags conflicting job applications between master and secondary', () => {
    const master = {
      id: 'cand-1',
      code: 'CAN-1',
      name: 'Master',
      organizationId: 'org-1',
      isArchived: false,
      applications: [{ id: 'app-1', jobId: 'job-frontend', status: 'INTERVIEW' }],
    };
    const secondary = {
      id: 'cand-2',
      code: 'CAN-2',
      name: 'Secondary',
      organizationId: 'org-1',
      isArchived: false,
      applications: [
        { id: 'app-2', jobId: 'job-frontend', status: 'SCREENING' },
        { id: 'app-3', jobId: 'job-backend', status: 'APPLIED' },
      ],
    };

    const res = validateMergeEligibility(master, secondary);
    expect(res.eligible).toBe(true);
    expect(res.conflictingJobIds).toContain('job-frontend');
    expect(res.conflictingJobIds).not.toContain('job-backend');
  });

  it('merges candidate skills lists without case-insensitive duplicates', () => {
    const merged = mergeCandidateSkills(['React', 'TypeScript', 'Node.js'], ['react', 'Docker', 'TYPESCRIPT', 'AWS']);
    expect(merged).toHaveLength(5);
    expect(merged).toContain('React');
    expect(merged).toContain('TypeScript');
    expect(merged).toContain('Node.js');
    expect(merged).toContain('Docker');
    expect(merged).toContain('AWS');
  });
});

describe('Prompt 20: Extension Token & Integrations Tests', () => {
  it('generates high-entropy extension capture token with sha256 hash and 15m expiration', () => {
    const { rawToken, tokenHash, expiresAt } = generateExtensionCaptureToken();
    expect(rawToken.startsWith('hfe_')).toBe(true);
    expect(tokenHash).toBe(hashExtensionCaptureToken(rawToken));
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + 14 * 60 * 1000);
    expect(isExtensionTokenExpired(expiresAt)).toBe(false);
  });

  it('detects expired extension token correctly', () => {
    const past = new Date(Date.now() - 1000);
    expect(isExtensionTokenExpired(past)).toBe(true);
  });

  it('Naukri integration provider reports SETUP_REQUIRED when credentials missing and CONNECTED in mock mode', async () => {
    const provider = new NaukriIntegrationProvider();
    const statusNoCreds = await provider.checkStatus();
    expect(statusNoCreds.status).toBe('SETUP_REQUIRED');

    const statusMock = await provider.checkStatus('demo-token');
    expect(statusMock.status).toBe('CONNECTED');
    expect(statusMock.isMock).toBe(true);

    const candidates = await provider.fetchAvailableCandidates('demo-token');
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].candidateName).toBe('Aditya Deshmukh');
  });

  it('Foundit integration provider reports SETUP_REQUIRED and validates credentials', async () => {
    const provider = new FounditIntegrationProvider();
    const status = await provider.checkStatus();
    expect(status.status).toBe('SETUP_REQUIRED');

    const validCheck = await provider.validateCredentials({ clientId: 'cl-1', clientSecret: 'sec-1' });
    expect(validCheck.valid).toBe(true);

    const invalidCheck = await provider.validateCredentials({});
    expect(invalidCheck.valid).toBe(false);
  });

  it('Inbound Email provider reports setup requirement or mock status', async () => {
    const provider = new InboundEmailProvider();
    const status = await provider.checkStatus();
    expect(status.status).toBe('SETUP_REQUIRED');

    const validEmail = await provider.validateCredentials({ mailboxAddress: 'cv@hireflow.in' });
    expect(validEmail.valid).toBe(true);
  });
});
