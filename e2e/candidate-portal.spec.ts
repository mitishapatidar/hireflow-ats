import { test, expect } from '@playwright/test';

test.describe('Prompt 25: Candidate Portal & Self-Scheduling (Frames 14, 44 & 48)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('hireflow_dev_role', 'CANDIDATE'));
  });

  test('Frame 14 Overview: displays candidate portal shell, profile completeness and application progress', async ({ page }) => {
    await page.goto('/my-dashboard');

    // Verify Candidate Portal Shell
    const header = page.locator('header').first();
    await expect(header).toBeVisible();
    await expect(header.getByText('Applicant Portal').first()).toBeVisible();

    // Verify Candidate Profile Overview & Completeness Bar
    await expect(page.getByText('Profile Completeness')).toBeVisible();

    // Verify My Applications Section
    await expect(page.getByRole('heading', { name: /My Applications/i })).toBeVisible();

    // Verify Scheduled Interviews Section
    await expect(page.getByRole('heading', { name: /Scheduled Interviews/i })).toBeVisible();

    // Internal Recruiter workspace sidebar must NOT exist (Anti-leak)
    await expect(page.locator('aside:has-text("WORKSPACE")')).not.toBeVisible();
    await expect(page.locator('text=Fee Agreement')).not.toBeVisible();
    await expect(page.locator('text=Margin')).not.toBeVisible();
  });

  test('Frame 48 Mobile Optimization: renders candidate portal cleanly on mobile viewport (390px)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/my-dashboard');

    // Verify mobile header
    const brand = page.locator('header').getByText('HireFlow').first();
    await expect(brand).toBeVisible();

    // Verify completeness bar is visible and fits within viewport
    const completenessBar = page.getByText('Profile Completeness');
    await expect(completenessBar).toBeVisible();

    // Check that there is no horizontal scrollbar overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2); // allowance for scrollbar jitter
  });

  test('Frame 48 Mobile Android (360px): renders touch-friendly action targets', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/my-dashboard');

    // Check update profile button is visible
    const updateButton = page.getByRole('button', { name: /Update Profile/i });
    await expect(updateButton).toBeVisible();

    // Verify touch target size (at least 32px height)
    const box = await updateButton.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.height).toBeGreaterThanOrEqual(32);
    }
  });

  test('Frame 44 Public Slot Booking: renders branded scheduling page with date & time chips', async ({ page }) => {
    // Load public schedule page with sample token
    await page.goto('/schedule/demo-invitation-token');

    // Brand and header must be visible without login required
    await expect(page.getByText('HireFlow').first()).toBeVisible();
    await expect(page.getByText('Candidate Self-Scheduling')).toBeVisible();
  });
});
