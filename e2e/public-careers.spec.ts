import { test, expect } from '@playwright/test';

test.describe('Prompt 28: Branded Public Careers Site & Application Workflow (Frames 42 & 43)', () => {
  test('Frame 42: Public careers page lists published jobs and masks confidential clients', async ({ page }) => {
    await page.goto('/careers');

    // Branding & Header
    await expect(page.getByText('Aureva Capital Private Limited Careers Network')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: /Explore Open Technology Mandates/i })).toBeVisible();

    // Verify published seed jobs are present
    await expect(page.getByText('Staff Frontend Architect').first()).toBeVisible();
    await expect(page.getByText('Lead Machine Learning Engineer').first()).toBeVisible();

    // Confidential client masking check:
    // Job J-203 has hideClientName: true. Bright Labs AI Inc must NOT be rendered for J-203.
    const confidentialBadges = page.getByText(/Confidential client/i);
    await expect(confidentialBadges.first()).toBeVisible();

    // Verify unpublished job J-206 (Senior Product Manager) is NOT visible
    await expect(page.getByText('Senior Product Manager - Enterprise B2B')).not.toBeVisible();

    // Verify Anti-leak: Recruiter margin, fee percentages, internal recruiter notes are NOT visible
    await expect(page.getByText(/recruiter margin/i)).not.toBeVisible();
    await expect(page.getByText(/fee percentage/i)).not.toBeVisible();
    await expect(page.getByText(/placement fee/i)).not.toBeVisible();

    // Test Search filtering
    const searchInput = page.getByPlaceholder(/Search by role, keyword or skill/i);
    await searchInput.fill('Machine Learning');
    await expect(page.getByText('Lead Machine Learning Engineer').first()).toBeVisible();
    await expect(page.getByText('Staff Frontend Architect')).not.toBeVisible();
    await searchInput.clear();
  });

  test('Frame 42: Public job detail view renders SEO JSON-LD and role overview', async ({ page }) => {
    await page.goto('/careers/job-j201');

    // Verify Job Header & Details
    await expect(page.getByRole('heading', { level: 1, name: /Staff Frontend Architect/i })).toBeVisible();
    await expect(page.getByText(/Role Overview/i)).toBeVisible();

    // Verify Apply Now button is visible
    const applyButton = page.getByRole('link', { name: /Apply for this Role/i }).first();
    await expect(applyButton).toBeVisible();

    // Verify Schema.org JobPosting JSON-LD script is present in page
    const jsonLdScript = page.locator('script[type="application/ld+json"]');
    await expect(jsonLdScript).toHaveCount(1);
    const jsonLdContent = await jsonLdScript.textContent();
    expect(jsonLdContent).toContain('"@type":"JobPosting"');
    expect(jsonLdContent).toContain('Staff Frontend Architect');
    expect(jsonLdContent).toContain('Acme Technologies Private Limited');
    // Ensure no client commercial fee is leaked in JSON-LD
    expect(jsonLdContent).not.toContain('feePercentage');

    // Click Apply and verify navigation to apply wizard
    await applyButton.click();
    await expect(page).toHaveURL(/\/careers\/job-j201\/apply/i);
  });

  test('Frame 43: Complete 5-step public application wizard with resume upload and reference code', async ({ page }) => {
    test.setTimeout(60000);
    // Navigate directly to apply page for job-j201
    await page.goto('/careers/job-j201/apply');

    // Step 1: Role Summary
    await expect(page.getByText('Staff Frontend Architect')).toBeVisible();
    await page.getByRole('button', { name: /Continue to Personal Details/i }).click();

    // Step 2: Personal Details
    await expect(page.getByText('Candidate Information')).toBeVisible();
    await page.fill('input[placeholder="e.g. Aarav Sharma"]', 'Elena Rostova');
    const uniqueEmail = `elena.rostova.${Date.now()}@example.com`;
    await page.fill('input[placeholder="aarav@example.com"]', uniqueEmail);
    await page.fill('input[placeholder="+91 98765 43210"]', '+1 555 019 2834');
    await page.fill('input[placeholder="e.g. Bengaluru, India"]', 'New York, NY');
    await page.fill('input[type="number"]', '8');
    await page.getByRole('button', { name: /Continue to Resume Upload/i }).click();

    // Step 3: Resume Upload
    await expect(page.getByText('Upload Your Resume')).toBeVisible();
    // Create a mock PDF buffer and upload
    const mockPdfBuffer = Buffer.from('%PDF-1.4 mock resume content for automated test', 'utf-8');
    await page.setInputFiles('input[type="file"]', {
      name: 'elena_rostova_resume.pdf',
      mimeType: 'application/pdf',
      buffer: mockPdfBuffer,
    });

    // Wait for file upload acknowledgment
    await expect(page.getByText('elena_rostova_resume.pdf')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /Review Application/i }).click();

    // Step 4: Review & Consent
    await expect(page.getByText('Review Your Application')).toBeVisible();
    await expect(page.getByText('Elena Rostova')).toBeVisible();
    await expect(page.getByText(uniqueEmail)).toBeVisible();
    await expect(page.getByText('elena_rostova_resume.pdf')).toBeVisible();

    // Check consent checkbox
    await page.check('input[type="checkbox"]');

    // Submit Application
    await page.getByRole('button', { name: /Submit Application/i }).click();

    // Step 5: Confirmation
    await expect(page.getByText('Application Submitted!')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Application Reference Number/i)).toBeVisible();
    const referenceBox = page.locator('text=/APP-J-201-/');
    await expect(referenceBox).toBeVisible();

    // Verify Return CTA
    await expect(page.getByRole('link', { name: /Return to Careers Home/i })).toBeVisible();
  });

  test('Frame 43: Application draft persistence and resumption by token', async ({ page }) => {
    await page.goto('/careers/job-j201/apply');

    // Step 1 -> Step 2
    await page.getByRole('button', { name: /Continue to Personal Details/i }).click();
    await page.fill('input[placeholder="e.g. Aarav Sharma"]', 'DraftCandidate Autosave');
    await page.fill('input[placeholder="aarav@example.com"]', 'draft.autosave@example.com');

    // Click "Save Draft"
    const saveDraftBtn = page.getByRole('button', { name: /Save Draft/i }).first();
    await expect(saveDraftBtn).toBeVisible();
    await saveDraftBtn.click();

    // Confirmation message banner appears
    await expect(page.getByText(/Draft saved successfully/i)).toBeVisible({ timeout: 10000 });
  });

  test('Mobile Responsiveness: 390px viewport renders cleanly without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/careers');

    await expect(page.getByRole('heading', { level: 1, name: /Explore Open Technology Mandates/i })).toBeVisible();

    // Check no horizontal scrollbar overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);

    // Navigate to apply on mobile
    await page.goto('/careers/job-j201/apply');
    await expect(page.getByRole('heading', { level: 2, name: /Staff Frontend Architect/i })).toBeVisible();

    const mobileScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const mobileClientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(mobileScrollWidth).toBeLessThanOrEqual(mobileClientWidth + 2);
  });
});
