import { test, expect } from '@playwright/test';

test.describe('Prompt 23: Mobile-Optimised Web App & Viewports', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('hireflow_dev_role', 'RECRUITER'));
  });

  test('Figma Frame 46: Recruiter Mobile Overview (/mobile/today) on 390x844 viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/mobile/today');

    // 1. Recruiter Greeting Banner
    await expect(page.getByText("Today's Recruiter Agenda")).toBeVisible();
    await expect(page.getByRole('heading', { name: /Hello,/i })).toBeVisible();

    // 2. Urgent Action Chips
    await expect(page.getByText('Interviews Today')).toBeVisible();
    await expect(page.getByText('Pending Submissions')).toBeVisible();
    await expect(page.getByText('Awaiting Offer')).toBeVisible();

    // 3. Today's Interviews Timeline
    await expect(page.getByRole('heading', { name: "Today's Interviews" })).toBeVisible();

    // 4. Quick Actions
    await expect(page.getByRole('button', { name: 'Log Call' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Quick Note' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Share CV' })).toBeVisible();

    // 5. Mobile Bottom Navigation Bar
    const bottomNav = page.getByRole('navigation', { name: 'Mobile Navigation Bar' });
    await expect(bottomNav).toBeVisible();
    await expect(bottomNav.getByRole('link', { name: 'Today' })).toBeVisible();
    await expect(bottomNav.getByRole('link', { name: 'Jobs' })).toBeVisible();
    await expect(bottomNav.getByRole('link', { name: 'Candidates' })).toBeVisible();
    await expect(bottomNav.getByRole('button', { name: 'More' })).toBeVisible();
  });

  test('Mobile Bottom Navigation on 375x667 (iPhone SE) viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/mobile/today');

    const bottomNav = page.getByRole('navigation', { name: 'Mobile Navigation Bar' });
    await expect(bottomNav).toBeVisible();
  });

  test('Desktop viewport (1280x800) hides mobile bottom navigation', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/offers');

    const bottomNav = page.getByRole('navigation', { name: 'Mobile Navigation Bar' });
    await expect(bottomNav).not.toBeVisible();
  });
});
