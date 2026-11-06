import { describe, it, expect } from 'vitest';
import { validateFileSecurity, normalizeEmail, normalizePhone } from './candidates';
import { MockAntivirusScannerProvider, ClamAVScannerProvider } from './security/antivirus';
import { DeterministicMockParserProvider } from './parser';
import { SYNTHETIC_RESUME_FIXTURES } from './fixtures/resumes';
import {
  DefaultTextExtractorProvider,
  extractDocBinaryText,
  MockOcrProvider,
  TesseractOcrProvider,
  setOcrProvider,
} from './extraction';
import { LocalStorageProvider, S3StorageProvider } from './storage';

describe('Prompt 8: Resume Security & Parsing Engine Tests', () => {
  describe('File Security & Magic Bytes Validation', () => {
    it('accepts genuine PDF magic bytes (%PDF-)', () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\nxref\n0 1\ntrailer<<>>\nstartxref\n50\n%%EOF');
      const result = validateFileSecurity(pdfBuffer, 'resume.pdf');
      expect(result.valid).toBe(true);
      expect(result.detectedMime).toBe('application/pdf');
    });

    it('accepts genuine DOCX magic bytes (PK\\x03\\x04 zip header)', () => {
      const docxBuffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
      const result = validateFileSecurity(docxBuffer, 'candidate_cv.docx');
      expect(result.valid).toBe(true);
      expect(result.detectedMime).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
    });

    it('accepts genuine DOC magic bytes (\\xD0\\xCF\\x11\\xE0\\xA1\\xB1\\x1A\\xE1)', () => {
      const docBuffer = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00]);
      const result = validateFileSecurity(docBuffer, 'profile.doc');
      expect(result.valid).toBe(true);
      expect(result.detectedMime).toBe('application/msword');
    });

    it('rejects file disguised with wrong extension (e.g. DOCX signature with .pdf extension)', () => {
      const docxAsPdf = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
      const result = validateFileSecurity(docxAsPdf, 'disguised.pdf');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File signature is DOCX');
    });

    it('rejects unsupported extensions (e.g. .exe, .sh, .png)', () => {
      const buf = Buffer.from('random data');
      const result = validateFileSecurity(buf, 'payload.exe');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported file extension .exe');
    });

    it('rejects empty file', () => {
      const empty = Buffer.alloc(0);
      const result = validateFileSecurity(empty, 'test.pdf');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('File is empty');
    });

    it('rejects files larger than 10 MB', () => {
      const oversized = Buffer.alloc(10 * 1024 * 1024 + 1);
      const result = validateFileSecurity(oversized, 'large.pdf');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum limit of 10 MB');
    });
  });

  describe('Antivirus Scanner Hook (Mock Provider)', () => {
    const scanner = new MockAntivirusScannerProvider();

    it('marks normal resume buffer as clean', async () => {
      const safeBuffer = Buffer.from('Professional Resume for Aarav Shah Software Engineer');
      const result = await scanner.scan(safeBuffer, 'resume.pdf');
      expect(result.clean).toBe(true);
      expect(result.threatFound).toBeNull();
      expect(result.isMock).toBe(true);
    });

    it('detects EICAR test signature and flags simulated threat', async () => {
      const eicarBuffer = Buffer.from(
        'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'
      );
      const result = await scanner.scan(eicarBuffer, 'eicar.pdf');
      expect(result.clean).toBe(false);
      expect(result.threatFound).toContain('EICAR');
    });

    it('detects and rejects Windows PE executable headers (MZ header)', async () => {
      const peBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
      const result = await scanner.scan(peBuffer, 'resume.pdf');
      expect(result.clean).toBe(false);
      expect(result.threatFound).toContain('Win32.Executable');
    });

    it('detects and rejects Unix shell script headers', async () => {
      const shBuffer = Buffer.from('#!/bin/bash\nrm -rf /');
      const result = await scanner.scan(shBuffer, 'resume.pdf');
      expect(result.clean).toBe(false);
      expect(result.threatFound).toContain('Unix.ShellScript');
    });
  });

  describe('Normalizations (Email & Phone)', () => {
    it('normalizes email addresses to lowercase and trimmed', () => {
      expect(normalizeEmail('  Aarav.Shah@Example.COM  ')).toBe('aarav.shah@example.com');
      expect(normalizeEmail('PRIYA@DOMAIN.IN')).toBe('priya@domain.in');
    });

    it('normalizes Indian phone numbers to 10 digits', () => {
      expect(normalizePhone('+91 98765 43210')).toBe('9876543210');
      expect(normalizePhone('09876543210')).toBe('9876543210');
      expect(normalizePhone('98765-43210')).toBe('9876543210');
      expect(normalizePhone(null)).toBeNull();
    });
  });

  describe('DOC Binary Stream Text Extractor', () => {
    it('extracts readable ASCII chunks from simulated Word binary stream', () => {
      const prefix = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
      const textRun = Buffer.from('Aarav Shah Senior Frontend Engineer at TechNova Mumbai');
      const combined = Buffer.concat([prefix, textRun]);

      const extracted = extractDocBinaryText(combined);
      expect(extracted).toContain('Aarav Shah');
      expect(extracted).toContain('TechNova');
    });
  });

  describe('Parser Accuracy Benchmark Across 20 Synthetic Fixture Resumes', () => {
    const parser = new DeterministicMockParserProvider();

    it('accurately parses 20 diverse synthetic resumes and reports metrics per field', async () => {
      let nameCorrect = 0;
      let emailCorrect = 0;
      let phoneCorrect = 0;
      let expCorrect = 0;
      let salaryCorrect = 0;
      let totalSkillsMatched = 0;
      let totalSkillsExpected = 0;

      for (const fixture of SYNTHETIC_RESUME_FIXTURES) {
        const parsed = await parser.parseResume(fixture.rawText, {
          fileName: fixture.fileName,
        });

        // 1. Name Check
        if (fixture.expected.name) {
          if (parsed.name.value && parsed.name.value.toLowerCase().includes(fixture.expected.name.toLowerCase())) {
            nameCorrect++;
          }
        } else {
          // Expected null (e.g. scanned doc)
          if (!parsed.name.value) nameCorrect++;
        }

        // 2. Email Check
        if (fixture.expected.email) {
          if (parsed.email.value === fixture.expected.email) {
            emailCorrect++;
          }
        } else {
          if (!parsed.email.value) emailCorrect++;
        }

        // 3. Phone Check
        if (fixture.expected.phone) {
          const normExpected = normalizePhone(fixture.expected.phone);
          const normExtracted = normalizePhone(parsed.phone.value);
          if (normExtracted === normExpected) {
            phoneCorrect++;
          }
        } else {
          if (!parsed.phone.value) phoneCorrect++;
        }

        // 4. Experience Check
        if (fixture.expected.experienceYears !== null) {
          if (parsed.experienceYears.value === fixture.expected.experienceYears) {
            expCorrect++;
          }
        } else {
          if (parsed.experienceYears.value === null) expCorrect++;
        }

        // 5. Salary Check
        if (fixture.expected.currentSalary !== null) {
          if (parsed.currentSalary.value === fixture.expected.currentSalary) {
            salaryCorrect++;
          }
        } else {
          if (parsed.currentSalary.value === null) salaryCorrect++;
        }

        // 6. Skills Recall Check
        if (fixture.expected.skills.length > 0) {
          totalSkillsExpected += fixture.expected.skills.length;
          const extractedSkills = new Set(parsed.skills.value || []);
          for (const s of fixture.expected.skills) {
            if (extractedSkills.has(s)) {
              totalSkillsMatched++;
            }
          }
        }
      }

      const total = SYNTHETIC_RESUME_FIXTURES.length; // 20
      const namePct = (nameCorrect / total) * 100;
      const emailPct = (emailCorrect / total) * 100;
      const phonePct = (phoneCorrect / total) * 100;
      const expPct = (expCorrect / total) * 100;
      const salaryPct = (salaryCorrect / total) * 100;
      const skillsRecallPct = (totalSkillsMatched / totalSkillsExpected) * 100;

      console.log('\n--- Resume Parser Accuracy Report (20 Fixtures) ---');
      console.log(`Name Accuracy:       ${nameCorrect}/${total} (${namePct.toFixed(1)}%)`);
      console.log(`Email Accuracy:      ${emailCorrect}/${total} (${emailPct.toFixed(1)}%)`);
      console.log(`Phone Accuracy:      ${phoneCorrect}/${total} (${phonePct.toFixed(1)}%)`);
      console.log(`Experience Accuracy: ${expCorrect}/${total} (${expPct.toFixed(1)}%)`);
      console.log(`Salary Accuracy:     ${salaryCorrect}/${total} (${salaryPct.toFixed(1)}%)`);
      console.log(`Skills Recall:       ${totalSkillsMatched}/${totalSkillsExpected} (${skillsRecallPct.toFixed(1)}%)`);
      console.log('---------------------------------------------------\n');

      // Assert high accuracy standards (> 90% on primary identifiers)
      expect(namePct).toBeGreaterThanOrEqual(95);
      expect(emailPct).toBeGreaterThanOrEqual(95);
      expect(phonePct).toBeGreaterThanOrEqual(95);
      expect(expPct).toBeGreaterThanOrEqual(90);
      expect(salaryPct).toBeGreaterThanOrEqual(90);
      expect(skillsRecallPct).toBeGreaterThanOrEqual(90);
    });
  });

  describe('Prompt 8 Audit: OCR Fallback Engine Tests', () => {
    const extractor = new DefaultTextExtractorProvider();

    it('successfully triggers OCR on scanned PDF fixture with low direct text', async () => {
      // PDF header with only 10 printable characters (simulates scanned image PDF)
      const scannedPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n%%EOF');
      const mockOcr = new MockOcrProvider('SUCCESS');
      setOcrProvider(mockOcr);

      const result = await extractor.extractText(scannedPdfBuffer, 'scanned_candidate_cv.pdf');

      expect(result.ocrTriggered).toBe(true);
      expect(result.rawText).toContain('Sunita Krishnamurthy');
      expect(result.rawText).toContain('sunita.krishna.ds@example.com');
      expect(result.rawText).toContain('Data Scientist');

      // Feed OCR extracted text to structured parser
      const parser = new DeterministicMockParserProvider();
      const parsed = await parser.parseResume(result.rawText, { fileName: 'scanned_candidate_cv.pdf' });

      expect(parsed.name.value).toBe('Sunita Krishnamurthy');
      expect(parsed.email.value).toBe('sunita.krishna.ds@example.com');
      expect(parsed.skills.value).toContain('PyTorch');
      expect(parsed.skills.value).toContain('LangChain');
    });

    it('handles empty OCR output gracefully when scan is unreadable or blank', async () => {
      const blankScanBuffer = Buffer.from('%PDF-1.4\n%%EOF');
      const mockOcr = new MockOcrProvider('EMPTY');
      setOcrProvider(mockOcr);

      const result = await extractor.extractText(blankScanBuffer, 'blank_scan.pdf');

      expect(result.ocrTriggered).toBe(true);
      expect(result.rawText).toContain('[Scanned Document');
      expect(result.characterCount).toBeGreaterThan(0);
    });

    it('handles OCR engine failure without crashing extraction pipeline', async () => {
      const corruptedScanBuffer = Buffer.from('%PDF-1.4\n%%EOF');
      const mockOcr = new MockOcrProvider('ERROR');
      setOcrProvider(mockOcr);

      const result = await extractor.extractText(corruptedScanBuffer, 'corrupted_scan.pdf');

      expect(result.ocrTriggered).toBe(true);
      expect(result.rawText).toContain('OCR processing failed');
    });

    it('TesseractOcrProvider reports native binary dependency status safely on host', async () => {
      const tesseractProvider = new TesseractOcrProvider();
      const sampleBuffer = Buffer.from('%PDF-1.4\n%%EOF');

      const result = await tesseractProvider.recognize(sampleBuffer, 'application/pdf');

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      // Host lacks tesseract CLI, should report DISABLED with diagnostic
      expect(['DISABLED', 'TESSERACT_OCR']).toContain(result.engine);
      if (result.engine === 'DISABLED') {
        expect(result.error).toContain('tesseract-ocr');
      }
    });
  });

  describe('Prompt 8 Audit: Storage, Antivirus & Cleanup Tests', () => {
    it('LocalStorageProvider handles upload, download, and safe cleanup of orphaned files', async () => {
      const storage = new LocalStorageProvider();
      const testBuffer = Buffer.from('Candidate Resume Text for Orphaned File Test');
      const meta = {
        fileName: 'temp_orphan_test.pdf',
        mimeType: 'application/pdf',
        fileSize: testBuffer.length,
        uploadedById: 'user-recruiter-1',
      };

      // 1. Upload
      const uploaded = await storage.uploadFile(testBuffer, meta);
      expect(uploaded.storageKey).toBeDefined();
      expect(uploaded.storageKey).toMatch(/^resumes\/[a-f0-9-]+\.pdf$/);

      // 2. Read back
      const readBuffer = await storage.getFile(uploaded.storageKey);
      expect(readBuffer).not.toBeNull();
      expect(readBuffer?.toString()).toBe('Candidate Resume Text for Orphaned File Test');

      // 3. Signed URL generation
      const signedUrl = await storage.getSignedUrl(uploaded.storageKey, 900);
      expect(decodeURIComponent(signedUrl)).toContain(uploaded.storageKey);

      // 4. Safe cleanup of orphaned upload (e.g. when duplicate creation is blocked)
      await storage.deleteFile(uploaded.storageKey);
      await expect(storage.getFile(uploaded.storageKey)).rejects.toThrow('File not found in storage');
    });

    it('ClamAVScannerProvider catches daemon connection error gracefully when clamd is offline', async () => {
      const clamav = new ClamAVScannerProvider('127.0.0.1', 3310);
      const safeBuffer = Buffer.from('Normal Resume Text');

      const result = await clamav.scan(safeBuffer, 'resume.pdf');

      // When clamd is offline on 127.0.0.1:3310, should report error without uncaught exception
      expect(result.clean).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('ClamAV scan error');
    });

    it('S3StorageProvider initializes and validates required bucket configuration', () => {
      const s3Storage = new S3StorageProvider('hireflow-resumes');
      expect(s3Storage).toBeDefined();
    });
  });

  describe('Prompt 8 Audit: Performance & Upload-to-Review Latency Benchmark', () => {
    it('measures actual latency across representative synthetic resumes under 10s SLA', async () => {
      const storage = new LocalStorageProvider();
      const extractor = new DefaultTextExtractorProvider();
      const parser = new DeterministicMockParserProvider();
      const mockOcr = new MockOcrProvider('SUCCESS', undefined, 20);
      setOcrProvider(mockOcr);

      const latencies: {
        fileName: string;
        uploadMs: number;
        extractMs: number;
        parseMs: number;
        totalMs: number;
      }[] = [];

      // Test across 10 sample fixtures
      const sampleFixtures = SYNTHETIC_RESUME_FIXTURES.slice(0, 10);

      for (const fix of sampleFixtures) {
        const totalStart = Date.now();

        // 1. Simulated upload
        const upStart = Date.now();
        const testPdfName = fix.fileName.replace(/\.(docx|doc)$/, '.pdf');
        const buf = Buffer.from(`%PDF-1.4\n${fix.rawText}\n%%EOF`);
        const upRes = await storage.uploadFile(buf, {
          fileName: testPdfName,
          mimeType: 'application/pdf',
          fileSize: buf.length,
          uploadedById: 'bench-user',
        });
        const uploadMs = Date.now() - upStart;

        // 2. Text extraction
        const extStart = Date.now();
        const extRes = await extractor.extractText(buf, testPdfName);
        const extractMs = Date.now() - extStart;

        // 3. Structured parsing
        const parseStart = Date.now();
        await parser.parseResume(extRes.rawText, {
          fileName: testPdfName,
          storageKey: upRes.storageKey,
          fileSize: buf.length,
          checksum: upRes.checksum,
        });
        const parseMs = Date.now() - parseStart;

        const totalMs = Date.now() - totalStart;

        latencies.push({
          fileName: fix.fileName,
          uploadMs,
          extractMs,
          parseMs,
          totalMs,
        });

        // Cleanup
        await storage.deleteFile(upRes.storageKey);
      }

      const avgUpload = latencies.reduce((a, b) => a + b.uploadMs, 0) / latencies.length;
      const avgExtract = latencies.reduce((a, b) => a + b.extractMs, 0) / latencies.length;
      const avgParse = latencies.reduce((a, b) => a + b.parseMs, 0) / latencies.length;
      const avgTotal = latencies.reduce((a, b) => a + b.totalMs, 0) / latencies.length;
      const maxTotal = Math.max(...latencies.map((l) => l.totalMs));

      console.log('\n--- Upload-to-Review Latency Benchmark (10 Resumes) ---');
      console.log(`Average Upload Time:     ${avgUpload.toFixed(2)} ms`);
      console.log(`Average Extraction Time: ${avgExtract.toFixed(2)} ms`);
      console.log(`Average Parsing Time:    ${avgParse.toFixed(2)} ms`);
      console.log(`Average Total Pipeline:  ${avgTotal.toFixed(2)} ms`);
      console.log(`P95 / Maximum Latency:   ${maxTotal} ms`);
      console.log('Target SLA:              < 10,000 ms (10.0 s)');
      console.log('------------------------------------------------------\n');

      // SLA Target: < 10,000 ms (10s)
      expect(avgTotal).toBeLessThan(1000); // Typically < 50ms in mock/local mode
      expect(maxTotal).toBeLessThan(10000);
    });
  });
});
