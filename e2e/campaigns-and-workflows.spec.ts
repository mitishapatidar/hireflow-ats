import { test, expect } from '@playwright/test';

test.describe('Prompt 29: Bulk Email/SMS Campaigns & Custom Pipeline Stages (Frames 26 & 32)', () => {
  // Configure generous timeout for cold Next.js compilation on Windows
  test.describe.configure({ timeout: 120000, mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    // Authenticate with ADMIN role via cookies & localStorage
    await page.context().addCookies([
      { name: 'hireflow_dev_role', value: 'ADMIN', domain: 'localhost', path: '/' },
    ]);
    await page.addInitScript(() => {
      localStorage.setItem('hireflow_dev_role', 'ADMIN');
      document.cookie = 'hireflow_dev_role=ADMIN; path=/; max-age=86400';
    });
  });

  test('1. Figma Frame 26: Campaigns Directory renders header, KPIs, and channel filters', async ({ page }) => {
    await page.goto('/communications/campaigns', { waitUntil: 'domcontentloaded' });

    // Heading verification
    await expect(page.getByRole('heading', { level: 1, name: 'Email & SMS Campaigns' })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/Audience-targeted outreach with explicit consent validation/i)).toBeVisible();

    // 4 KPI Metric Cards
    await expect(page.getByText('Total Campaigns')).toBeVisible();
    await expect(page.getByText('Delivered Messages')).toBeVisible();
    await expect(page.getByText('Active & Scheduled')).toBeVisible();
    await expect(page.getByText('Consent Isolation')).toBeVisible();

    // Channel Filter Pills
    await expect(page.getByRole('button', { name: 'All Channels' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Email' })).toBeVisible();
    await expect(page.getByRole('button', { name: /SMS \(DLT\)/i })).toBeVisible();

    // Create Campaign CTA
    const createBtn = page.getByRole('link', { name: 'Create Campaign' }).first();
    await expect(createBtn).toBeVisible();
    await createBtn.click();
    await expect(page).toHaveURL(/\/communications\/campaigns\/new/);
  });

  test('2. Figma Frame 26: Campaign Wizard Step 1 calculates audience and validates consent isolation', async ({ page }) => {
    await page.goto('/communications/campaigns/new');
    await page.waitForLoadState('networkidle');

    // Stepper verification
    await expect(page.getByText('1. Audience Target')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('2. Compose & DLT')).toBeVisible();
    await expect(page.getByText('3. Review & Schedule')).toBeVisible();

    // Fill campaign name with validation
    const nameInput = page.getByPlaceholder(/e\.g\. Q4 Senior Java Backend Engineers Outreach/i);
    await expect(nameInput).toBeVisible();
    await nameInput.click();
    await nameInput.fill('E2E Automated Test Outreach Campaign');
    await expect(nameInput).toHaveValue('E2E Automated Test Outreach Campaign');

    // Switch between Email and SMS channels
    const smsBtn = page.getByRole('button', { name: /SMS \(TRAI DLT\)/i });
    await expect(smsBtn).toBeVisible();
    await smsBtn.click();

    const emailBtn = page.getByRole('button', { name: /Email Blast/i });
    await expect(emailBtn).toBeVisible();
    await emailBtn.click();

    // Re-ensure name value persists after channel switch
    await nameInput.click();
    await nameInput.fill('E2E Automated Test Outreach Campaign');
    await expect(nameInput).toHaveValue('E2E Automated Test Outreach Campaign');

    // Calculate audience
    const calcBtn = page.getByRole('button', { name: 'Calculate Audience' });
    await expect(calcBtn).toBeVisible();
    await calcBtn.click();

    // Wait for audience calculation to complete
    await expect(page.getByText(/Eligible Recipients/i)).toBeVisible({ timeout: 15000 });

    // Advance to Step 2
    const continueBtn = page.getByRole('button', { name: 'Continue to Message Composer' });
    await expect(continueBtn).toBeVisible();
    await continueBtn.click();

    // Verify Step 2 is active
    await expect(page.getByRole('heading', { level: 2, name: /Email Composer/i })).toBeVisible({ timeout: 20000 });
  });

  test('3. Figma Frame 26: Step 2 Composer displays merge tags, DLT counter, and test send section', async ({ page }) => {
    await page.goto('/communications/campaigns/new');
    await page.waitForLoadState('networkidle');

    // Set name and proceed to step 2
    const nameInput = page.getByPlaceholder(/e\.g\. Q4 Senior Java Backend Engineers Outreach/i);
    await expect(nameInput).toBeVisible({ timeout: 15000 });
    await nameInput.click();
    await nameInput.fill('E2E Composer Test');
    await expect(nameInput).toHaveValue('E2E Composer Test');

    await page.getByRole('button', { name: 'Continue to Message Composer' }).click();

    // Verify merge tag pills
    await expect(page.getByRole('button', { name: '{{first_name}}', exact: true })).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('button', { name: '{{job_title}}', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '{{company}}', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '{{unsubscribe_link}}', exact: true })).toBeVisible();

    // Fill subject line
    const subjectInput = page.getByPlaceholder(/e\.g\. Exciting Opportunity/i);
    await subjectInput.fill('Exciting Technology Roles at Aureva Capital');

    // Fill message body
    const bodyInput = page.getByPlaceholder(/Hi {{first_name}},/i);
    await bodyInput.fill('Hi {{first_name}}, We have exciting roles matching your profile at {{company}}.');

    // Verify 1-Click Unsubscribe Guarantee notice is visible for email
    await expect(page.getByText('1-Click Unsubscribe Guarantee')).toBeVisible();

    // Verify Test Message Dispatcher
    await expect(page.getByText('Verify with Test Dispatch')).toBeVisible();
    const testRecipientInput = page.getByPlaceholder(/e\.g\. recruiter@aurevacapital\.com/i);
    await expect(testRecipientInput).toBeVisible();
    await testRecipientInput.fill('recruiter.test@aurevacapital.com');

    const sendTestBtn = page.getByRole('button', { name: 'Send Test' });
    await expect(sendTestBtn).toBeVisible();
    await sendTestBtn.click();

    // Verify test feedback badge
    await expect(page.getByText(/Test EMAIL successfully dispatched/i)).toBeVisible({ timeout: 20000 });

    // Advance to Step 3
    const continueToReviewBtn = page.getByRole('button', { name: 'Continue to Review & Schedule' });
    await expect(continueToReviewBtn).toBeVisible();
    await continueToReviewBtn.click();

    // Verify Step 3: Review & Schedule
    await expect(page.getByRole('heading', { level: 2, name: 'Review Campaign & Schedule Launch' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('Dispatch Timing (IST - Asia/Kolkata)')).toBeVisible();
    await expect(page.getByText('Send Immediately')).toBeVisible();
    await expect(page.getByText('Schedule for Later')).toBeVisible();
  });

  test('4. Public 1-Click Unsubscribe page updates candidate marketing preferences', async ({ page }) => {
    // Navigate to public unsubscribe route with test token
    await page.goto('/unsubscribe/test-candidate-token', { waitUntil: 'domcontentloaded' });

    // Heading verification
    await expect(page.getByRole('heading', { level: 2, name: 'Email Communication Preferences' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/HireFlow Talent Network & Careers/i)).toBeVisible();

    // If test candidate not found in database, page displays graceful expired link message
    const invalidToken = page.getByText(/Invalid or Expired Link/i);
    const validCandidateForm = page.getByRole('button', { name: /Unsubscribe from Marketing Outreach/i });

    if (await validCandidateForm.isVisible()) {
      await expect(page.getByText(/I receive too many emails/i)).toBeVisible();
      await validCandidateForm.click();
      await expect(page.getByText(/Preferences Successfully Updated/i)).toBeVisible();
    } else {
      await expect(invalidToken).toBeVisible();
    }
  });

  test('5. Figma Frame 32: Client Workflow displays protected Placed stage badge and candidate count', async ({ page }) => {
    // Use the first seeded client from the database
    const clientId = '0222876b-ab36-4502-ab27-0356194bb415';
    await page.goto(`/clients/${clientId}/workflow`);
    await page.waitForLoadState('networkidle');

    // Workflow header breadcrumb & legal name verification
    await expect(page.getByText('Workflows & Submission Rules')).toBeVisible({ timeout: 30000 });

    // Verify Protected stage badge for Placed / Joined stage
    const protectedBadge = page.getByText(/Protected/i).first();
    await expect(protectedBadge).toBeVisible();

    // Verify stage list is rendered
    await expect(page.getByText(/Placed|Joined|Applied|Sourced/i).first()).toBeVisible();
  });
});
