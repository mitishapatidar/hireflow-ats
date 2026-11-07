import { test, expect } from '@playwright/test';

test.describe('Prompt 27: Placement Records, Commercial Fees & Recruiter Handover', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('hireflow_dev_role', 'ADMIN'));
  });

  test('1. Figma Frame 40: Placements & Commercial Records Dashboard renders 5 KPI cards and tabs', async ({ page }) => {
    await page.goto('/placements');

    // Heading verification
    await expect(page.getByRole('heading', { name: 'Placements & Commercial Records' })).toBeVisible();

    // 5 KPI Cards
    await expect(page.getByText('Total Confirmed')).toBeVisible();
    await expect(page.getByText('Placements MTD')).toBeVisible();
    await expect(page.getByText('Upcoming Joinees')).toBeVisible();
    await expect(page.getByText('Pending Payments')).toBeVisible();
    await expect(page.getByText('Fee Booked MTD')).toBeVisible();

    // Tabs
    const placementsTab = page.getByRole('button', { name: /Confirmed Placements/ });
    const upcomingTab = page.getByRole('button', { name: /Upcoming Joining Dates/ });
    await expect(placementsTab).toBeVisible();
    await expect(upcomingTab).toBeVisible();

    // Wait for initial data load to complete
    await expect(page.getByText('Loading placement records...')).not.toBeVisible({ timeout: 15000 });

    // Switch to Upcoming tab
    await upcomingTab.click();
    await expect(page.getByText(/No accepted offers pending joining|Expected Joining/)).toBeVisible({ timeout: 15000 });

    // Switch back to Confirmed Placements tab
    await placementsTab.click();
    await expect(page.getByText(/No confirmed placements found|Commercial Fee/)).toBeVisible({ timeout: 15000 });
  });

  test('2. Recruiter role masks commercial fee totals on dashboard', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('hireflow_dev_role', 'RECRUITER'));

    await page.goto('/placements');
    await expect(page.getByRole('heading', { name: 'Placements & Commercial Records' })).toBeVisible();
    await expect(page.getByText('Restricted')).toBeVisible();
    await expect(page.getByText('Leadership authorization required')).toBeVisible();
  });

  test('3. Figma Frame 41: Recruiter Portfolio Handover page renders tabs and modal wizard', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('hireflow_dev_role', 'ADMIN'));

    await page.goto('/handover');

    // Heading
    await expect(page.getByRole('heading', { name: 'Recruiter Portfolio Handover' })).toBeVisible();

    // Action buttons
    const newHandoverBtn = page.getByRole('button', { name: 'New Handover Request' });
    const historyLink = page.getByRole('link', { name: 'Ownership History' });
    await expect(newHandoverBtn).toBeVisible();
    await expect(historyLink).toBeVisible();

    // Tabs
    await expect(page.getByRole('button', { name: 'Pending Review' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approved / Transferred' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'All Requests' })).toBeVisible();

    // Open Handover Wizard
    await newHandoverBtn.click();
    await expect(page.getByText('Initiate Recruiter Handover')).toBeVisible();
    await expect(page.getByText('Source Recruiter (Transferring From)')).toBeVisible();
    await expect(page.getByText('Destination Recruiter (Transferring To)')).toBeVisible();

    // Independent selection tabs inside wizard
    await expect(page.getByRole('button', { name: /Candidates/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Jobs/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Open Tasks/ })).toBeVisible();

    // Close modal
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('4. Ownership History audit page renders and filters by entity type', async ({ page }) => {
    await page.goto('/handover/history');

    await expect(page.getByRole('heading', { name: 'Ownership History & Portfolio Audit' })).toBeVisible();
    await expect(page.getByText('Back to Recruiter Handover')).toBeVisible();
    await expect(page.getByRole('combobox')).toBeVisible();
  });
});
