import { test, expect } from '@playwright/test';

test.describe('Prompt 21: Offers, Global Search, Reports & MIS', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('hireflow_dev_role', 'ADMIN'));
  });

  test('Figma Frame 08: Offers & Placements dashboard with 4 live KPI cards and table', async ({ page }) => {
    await page.goto('/offers');

    // Heading verification
    await expect(page.getByRole('heading', { name: 'Offers & Placements' })).toBeVisible();

    // 4 KPI Cards
    await expect(page.getByText('Offers Released (MTD)')).toBeVisible();
    await expect(page.getByText('Offers Accepted')).toBeVisible();
    await expect(page.getByText('Awaiting Signature')).toBeVisible();
    await expect(page.getByText('Closed Placements')).toBeVisible();

    // Generate Offer button
    await expect(page.getByRole('button', { name: 'Generate Offer' })).toBeVisible();

    // Filter pills
    await expect(page.getByRole('button', { name: 'All Offers' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'RELEASED' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ACCEPTED' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'JOINED' })).toBeVisible();
  });

  test('Figma Frame 45: Global Command Search (Ctrl+K) with entity tabs', async ({ page }) => {
    await page.goto('/offers');

    // Trigger Command Palette via top bar trigger or keyboard shortcut
    const trigger = page.getByRole('button', { name: /Search candidates, jobs/i });
    if (await trigger.isVisible()) {
      await trigger.click();
    } else {
      await page.keyboard.press('Control+k');
    }

    // Verify search input
    const searchInput = page.getByPlaceholder('Search candidates, jobs, clients, pages, or shortcuts... (Ctrl+K)');
    await expect(searchInput).toBeVisible();

    // Type query
    await searchInput.fill('Senior');
    await page.waitForTimeout(500);

    // Verify entity tabs appear
    await expect(page.getByRole('button', { name: /^All \(/ })).toBeVisible();

    // Close via ESC
    await page.keyboard.press('Escape');
    await expect(searchInput).not.toBeVisible();
  });

  test('Figma Frame 10: Recruitment Reports & Conversion Funnel', async ({ page }) => {
    await page.goto('/reports');

    // Heading verification
    await expect(page.getByRole('heading', { name: 'Agency Reports & Analytics' })).toBeVisible();

    // 4 Core Efficiency KPIs
    await expect(page.getByText('Avg Time to Hire')).toBeVisible();
    await expect(page.getByText('Submission-to-Interview')).toBeVisible();
    await expect(page.getByText('Interview-to-Offer')).toBeVisible();
    await expect(page.getByText('Offer Acceptance Rate')).toBeVisible();

    // Conversion Funnel
    await expect(page.getByText('Recruitment Conversion Funnel')).toBeVisible();
    await expect(page.getByText('Candidates Sourced')).toBeVisible();
    await expect(page.getByText('Confirmed Placement', { exact: true })).toBeVisible();

    // Recruiter Leaderboard
    await expect(page.getByRole('heading', { name: 'Recruiter Leaderboard' })).toBeVisible();
  });

  test('Figma Frame 39: Recruiter Daily Activity & Manager MIS', async ({ page }) => {
    await page.goto('/reports/mis');

    // Heading verification
    await expect(page.getByRole('heading', { name: 'Recruiter Daily Activity & Manager MIS' })).toBeVisible();

    // IST Banner
    await expect(page.getByText('IST Boundaries Enforced')).toBeVisible();

    // 6 Team Rollup metrics
    await expect(page.getByText('Total Sourced')).toBeVisible();
    await expect(page.getByText('Submissions', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Interviews', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Offers Released', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Placements', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Total Agency Fee')).toBeVisible();

    // Recruiter breakdown table
    await expect(page.getByText('Recruiter Actuals vs Target Attainment')).toBeVisible();
  });
});
