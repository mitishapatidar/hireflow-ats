import { test, expect } from '@playwright/test';

test.describe('Prompt 26: Scheduled Client Reports (Figma Frame 38)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('hireflow_dev_role', 'ADMIN'));
  });

  test('Frame 38: displays scheduled client reports list and security guarantee', async ({ page }) => {
    await page.goto('/reports/client-schedules');

    // Verify Title
    await expect(page.getByRole('heading', { name: 'Scheduled Client Reports' })).toBeVisible();

    // Verify Security Guarantee Banner
    await expect(page.getByText('Client Report Security Guarantee')).toBeVisible();

    // Verify Table container
    await expect(page.getByText('Active Client Schedules')).toBeVisible();

    // Open Create Modal
    await page.getByRole('button', { name: 'New Scheduled Report' }).click();
    await expect(page.getByRole('heading', { name: 'Create Scheduled Client Report' })).toBeVisible();

    // Verify content toggles in modal
    await expect(page.getByText('1. Active Job Mandates & Progress')).toBeVisible();
    await expect(page.getByText('2. Submitted Candidate Profiles')).toBeVisible();
    await expect(page.getByText('3. Scheduled Next Steps & Interviews')).toBeVisible();

    // Close modal
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('Hub Navigation: verifies /reports links to Report Builder and Client Schedules', async ({ page }) => {
    await page.goto('/reports');

    await expect(page.getByRole('heading', { name: 'Agency Reports & Analytics' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Launch Report Builder' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Manage Client Schedules' })).toBeVisible();
  });
});
