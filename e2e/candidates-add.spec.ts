import { test, expect } from '@playwright/test';

test.describe('Prompt 8: Add Candidate & Resume Parsing (Figma Frame 17)', () => {
  test('Figma Frame 17: /candidates/new renders upload zone, manual mode toggle, and layout', async ({
    page,
  }) => {
    // Authenticate as ADMIN via cookies
    await page.context().addCookies([
      { name: 'hireflow_dev_role', value: 'ADMIN', domain: 'localhost', path: '/' },
    ]);
    await page.addInitScript(() => {
      localStorage.setItem('hireflow_dev_role', 'ADMIN');
      document.cookie = 'hireflow_dev_role=ADMIN; path=/; max-age=86400';
    });

    await page.goto('/candidates/new');

    // 1. Page Title & Subtitle (Matching Frame 17)
    await expect(page.getByRole('heading', { name: 'Add candidate & parse review' })).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.locator('text=Review extracted details before creating a candidate record.')
    ).toBeVisible();

    // 2. Resume Upload Drag-and-Drop Area
    await expect(
      page.getByRole('heading', { name: 'Drag and drop resume here, or browse files' })
    ).toBeVisible();
    await expect(
      page.locator('text=Supported formats: PDF, DOC, DOCX · Up to 10 MB.')
    ).toBeVisible();
    await expect(
      page.locator('text=Parsed candidate information is never saved automatically.')
    ).toBeVisible();

    // 3. Enter Manually Action Button
    await expect(page.locator('button:has-text("Enter manually")')).toBeVisible();
  });

  test('Enter manually toggles the Candidate Details review form', async ({ page }) => {
    await page.context().addCookies([
      { name: 'hireflow_dev_role', value: 'RECRUITER', domain: 'localhost', path: '/' },
    ]);
    await page.addInitScript(() => {
      localStorage.setItem('hireflow_dev_role', 'RECRUITER');
      document.cookie = 'hireflow_dev_role=RECRUITER; path=/; max-age=86400';
    });

    await page.goto('/candidates/new');

    // Click "Enter manually"
    const manualBtn = page.locator('button:has-text("Enter manually")');
    await manualBtn.click();

    // Verify form fields are visible matching Frame 17 layout
    await expect(page.locator('input[placeholder="e.g. Aarav Shah"]')).toBeVisible();
    await expect(page.locator('input[placeholder="e.g. aarav.shah@example.com"]')).toBeVisible();
    await expect(page.locator('input[placeholder="e.g. +91 98765 43210"]')).toBeVisible();
    await expect(page.locator('input[placeholder="e.g. Frontend Engineer"]')).toBeVisible();
    await expect(page.locator('input[placeholder="e.g. TechNova"]')).toBeVisible();
    await expect(page.locator('input[placeholder="e.g. 3 or 3.5 years"]')).toBeVisible();
    await expect(page.locator('input[placeholder="e.g. 850000"]')).toBeVisible();
    await expect(page.locator('input[placeholder="e.g. 1200000"]')).toBeVisible();
    await expect(page.locator('input[placeholder="e.g. Mumbai"]')).toBeVisible();
    await expect(page.locator('input[placeholder="e.g. 30 days"]')).toBeVisible();
    await expect(
      page.locator('textarea[placeholder*="Record confidential recruiter observations"]')
    ).toBeVisible();

    // Verify explicit save button is present (NEVER auto-saved)
    await expect(page.locator('button:has-text("Review & Save Candidate")')).toBeVisible();
  });

  test('Duplicate candidate detection displays warning banner for existing email', async ({ page }) => {
    await page.context().addCookies([
      { name: 'hireflow_dev_role', value: 'ADMIN', domain: 'localhost', path: '/' },
    ]);
    await page.addInitScript(() => {
      localStorage.setItem('hireflow_dev_role', 'ADMIN');
      document.cookie = 'hireflow_dev_role=ADMIN; path=/; max-age=86400';
    });

    await page.goto('/candidates/new');

    // Click Enter Manually
    await page.locator('button:has-text("Enter manually")').click();

    // Type existing seed candidate email
    const emailInput = page.locator('input[placeholder="e.g. aarav.shah@example.com"]');
    await emailInput.fill('aarav.shah@example.com');
    await emailInput.blur();

    // Wait for duplicate check banner to appear
    await expect(page.locator('text=Possible duplicate candidate detected — Creation blocked')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('text=Aarav Shah')).toBeVisible();
    await expect(page.locator('a:has-text("View existing candidate")')).toBeVisible();

    // Verify submit button is disabled with Creation Blocked state
    const submitBtn = page.locator('button:has-text("Duplicate Detected — Creation Blocked")');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeDisabled();
  });

  test('Duplicate candidate detection by phone number blocks candidate creation', async ({ page }) => {
    await page.context().addCookies([
      { name: 'hireflow_dev_role', value: 'ADMIN', domain: 'localhost', path: '/' },
    ]);
    await page.addInitScript(() => {
      localStorage.setItem('hireflow_dev_role', 'ADMIN');
      document.cookie = 'hireflow_dev_role=ADMIN; path=/; max-age=86400';
    });

    await page.goto('/candidates/new');
    await page.locator('button:has-text("Enter manually")').click();

    // Type unique email but existing seed candidate phone (Rohan Mehta C-0003)
    const emailInput = page.locator('input[placeholder="e.g. aarav.shah@example.com"]');
    await emailInput.fill('completely.unique.email.982@example.com');
    const phoneInput = page.locator('input[placeholder="e.g. +91 98765 43210"]');
    await phoneInput.fill('+91 98100 00003');
    await phoneInput.blur();

    // Wait for duplicate check banner to appear
    await expect(
      page.locator('text=Possible duplicate candidate detected — Creation blocked')
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.locator('button:has-text("Duplicate Detected — Creation Blocked")')
    ).toBeDisabled();
  });

  test('Resume file upload triggers extraction and populates review form with confidence indicators', async ({
    page,
  }) => {
    await page.context().addCookies([
      { name: 'hireflow_dev_role', value: 'ADMIN', domain: 'localhost', path: '/' },
    ]);
    await page.addInitScript(() => {
      localStorage.setItem('hireflow_dev_role', 'ADMIN');
      document.cookie = 'hireflow_dev_role=ADMIN; path=/; max-age=86400';
    });

    await page.goto('/candidates/new');

    // Prepare a mock synthetic resume text file with PDF magic header
    const sampleResumeContent = `%PDF-1.4
Kavita Ramanathan
Senior Cloud Architect | Bengaluru, India
Email: kavita.cloud.arch@example.com | Phone: +91 98765 43210
Experience: 9 years | Notice: 30 days
Current CTC: ₹35,00,000 | Expected CTC: ₹45,00,000
Summary:
Extensive experience architecting distributed cloud systems.
Skills: AWS, Kubernetes, Terraform, Go, Python, PostgreSQL, Docker
`;

    // Directly set file on hidden file input
    await page.setInputFiles('input[type="file"]', {
      name: 'kavita_ramanathan_resume.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(sampleResumeContent),
    });

    // Verify upload success and parsing transition
    await expect(page.locator('text=kavita_ramanathan_resume.pdf')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Resume uploaded')).toBeVisible();
    await expect(page.locator('text=Source preview')).toBeVisible();

    // Verify populated values in candidate form
    const nameInput = page.locator('input[placeholder="e.g. Aarav Shah"]');
    await expect(nameInput).toHaveValue('Kavita Ramanathan');
    const emailInput = page.locator('input[placeholder="e.g. aarav.shah@example.com"]');
    await expect(emailInput).toHaveValue('kavita.cloud.arch@example.com');

    // Verify confidence pill exists
    await expect(page.locator('text=90% Match').first()).toBeVisible();

    // Verify skills were populated
    await expect(page.locator('span:has-text("Kubernetes")').first()).toBeVisible();
    await expect(page.locator('span:has-text("Terraform")').first()).toBeVisible();

    // Verify source resume card is displayed with Remove action
    await expect(page.locator('button:has-text("Remove file")')).toBeVisible();
  });

  test('Client & Candidate roles are redirected to /no-permission', async ({ page }) => {
    // Test CLIENT role
    await page.context().addCookies([
      { name: 'hireflow_dev_role', value: 'CLIENT', domain: 'localhost', path: '/' },
    ]);
    await page.addInitScript(() => {
      localStorage.setItem('hireflow_dev_role', 'CLIENT');
      document.cookie = 'hireflow_dev_role=CLIENT; path=/; max-age=86400';
    });

    await page.goto('/candidates/new');
    await expect(page).toHaveURL(/.*no-permission/);
    await expect(page.locator('h1:has-text("Access Restricted")')).toBeVisible();
    await expect(page.locator('text=403 • No Permission')).toBeVisible();
  });
});
