import { test, expect } from '@playwright/test';

test.describe('Prompt 10: Jobs List & Job Lifecycle Experience', () => {
  test.beforeEach(async ({ page }) => {
    // Simulate ADMIN role
    await page.context().addCookies([
      { name: 'hireflow_dev_role', value: 'ADMIN', domain: 'localhost', path: '/' },
    ]);
    await page.addInitScript(() => {
      localStorage.setItem('hireflow_dev_role', 'ADMIN');
      document.cookie = 'hireflow_dev_role=ADMIN; path=/; max-age=86400';
    });
  });

  test('Figma Frame 04: Jobs List (/jobs) displays live stats, search, table, and Create Job modal', async ({
    page,
  }) => {
    await page.goto('/jobs');

    // 1. Header
    await expect(page.getByRole('heading', { name: 'Jobs' })).toBeVisible({ timeout: 15000 });
    await expect(
      page.locator('text=Manage client mandates, interview pipelines, recruiter ownership, and requisition lifecycles.')
    ).toBeVisible();

    // 2. Live Statistics Cards
    await expect(page.getByTestId('stat-open-jobs')).toBeVisible();
    await expect(page.getByTestId('stat-on-hold')).toBeVisible();
    await expect(page.getByTestId('stat-filled-month')).toBeVisible();
    await expect(page.getByTestId('stat-total-jobs')).toBeVisible();

    // 3. Search & Filters
    const searchInput = page.getByTestId('jobs-search-input');
    await expect(searchInput).toBeVisible();
    await expect(page.getByTestId('jobs-status-filter')).toBeVisible();
    await expect(page.getByTestId('jobs-client-filter')).toBeVisible();
    await expect(page.getByTestId('jobs-owner-filter')).toBeVisible();

    // 4. Data Table
    const table = page.getByTestId('jobs-table');
    await expect(table).toBeVisible();
    await expect(table.locator('th:has-text("Job Title & Code")')).toBeVisible();
    await expect(table.locator('th:has-text("Client Company")')).toBeVisible();
    await expect(table.locator('th:has-text("Owner / Recruiter")')).toBeVisible();
    await expect(table.locator('th:has-text("Status")')).toBeVisible();
    await expect(table.locator('th:has-text("Actions")')).toBeVisible();

    // 5. Verify seeded jobs appear (e.g. J-201)
    await expect(page.getByTestId('job-row-J-201')).toBeVisible();
    await expect(page.locator('text=J-201')).toBeVisible();

    // 6. Test Search Filtering
    await searchInput.fill('J-201');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await expect(page.getByTestId('job-row-J-201')).toBeVisible();

    // Clear search
    await searchInput.fill('');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // 7. Test Add / Create Job Modal
    const createBtn = page.getByTestId('create-job-button');
    await expect(createBtn).toBeVisible();
    await createBtn.click();

    const modal = page.getByTestId('create-job-modal');
    await expect(modal).toBeVisible();

    // Fill form
    await page.getByTestId('job-input-title').fill('Playwright Lead Automation Architect');
    // Select first client
    const clientSelect = page.getByTestId('job-select-client');
    const firstClientVal = await clientSelect.locator('option:nth-child(2)').getAttribute('value');
    if (firstClientVal) {
      await clientSelect.selectOption(firstClientVal);
    }
    await page.getByTestId('job-input-openings').fill('2');

    // Submit
    await page.getByTestId('job-submit-create-btn').click();

    // Verify redirection to the new job record
    await expect(page).toHaveURL(/\/jobs\/[a-zA-Z0-9-]+/, { timeout: 15000 });
    await expect(page.locator('text=Playwright Lead Automation Architect')).toBeVisible();
  });

  test('Figma Frame 21: Job Configuration & Lifecycle (/jobs/[id]) all 4 tabs and transitions', async ({
    page,
  }) => {
    // 1. Go to jobs list and click the first job
    await page.goto('/jobs');
    const firstJobRow = page.locator('tbody tr').first();
    await firstJobRow.click();

    await expect(page).toHaveURL(/\/jobs\/[a-zA-Z0-9-]+/, { timeout: 15000 });

    // 2. Verify Header & Underline Tabs
    await expect(page.getByTestId('tab-config')).toBeVisible();
    await expect(page.getByTestId('tab-rounds')).toBeVisible();
    await expect(page.getByTestId('tab-history')).toBeVisible();
    await expect(page.getByTestId('tab-assignments')).toBeVisible();

    // 3. Tab 1: Configuration Form
    await expect(page.getByRole('button', { name: 'Save Configuration Changes' })).toBeVisible();
    const locationInput = page.locator('input[placeholder="e.g. Bangalore / Remote"]');
    await locationInput.fill('Hybrid - Cyber City, Gurgaon');
    await page.getByTestId('btn-save-config').click();
    await expect(page.locator('text=Job configuration updated successfully')).toBeVisible({ timeout: 10000 });

    // 4. Tab 2: Interview Rounds
    await page.getByTestId('tab-rounds').click();
    await expect(page.locator('text=Interview Pipeline Sequence')).toBeVisible();
    await expect(page.getByTestId('btn-add-round')).toBeVisible();

    // Add round
    await page.getByTestId('btn-add-round').click();
    await page.locator('input[placeholder="e.g. System Design Architecture"]').fill('Executive Culture Fit');
    await page.getByRole('button', { name: 'Add Round' }).click();
    await expect(page.locator('text=Interview round added')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Executive Culture Fit')).toBeVisible();

    // 5. Tab 3: Lifecycle History
    await page.getByTestId('tab-history').click();
    await expect(page.locator('text=Requisition State Transition Audit')).toBeVisible();

    // 6. Tab 4: Assignments
    await page.getByTestId('tab-assignments').click();
    await expect(page.getByRole('heading', { name: 'Assigned Recruiters' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reassignment Requests' })).toBeVisible();

    // 7. Lifecycle Action: Pause and Resume if Active
    const pauseBtn = page.getByTestId('btn-pause-job');
    if (await pauseBtn.isVisible()) {
      await pauseBtn.click();
      await page.getByRole('button', { name: 'Confirm' }).click();
      await expect(page.locator('text=Job status updated to PAUSED')).toBeVisible({ timeout: 10000 });

      // Now Resume
      const resumeBtn = page.getByTestId('btn-resume-job');
      await expect(resumeBtn).toBeVisible();
      await resumeBtn.click();
      await expect(page.locator('text=Job requisition resumed and is now accepting candidates')).toBeVisible({ timeout: 10000 });
    }
  });
});
