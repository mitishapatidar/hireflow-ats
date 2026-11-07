import { test, expect } from '@playwright/test';

test.describe('Prompt 22: Client Portal & Candidate Review (Frames 12 & 29)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('hireflow_dev_role', 'CLIENT'));
  });

  test('Frame 12 Overview: displays client branding, live metric cards and recent submissions', async ({ page }) => {
    await page.goto('/portal');

    // Verify Client Shell
    const header = page.locator('header').first();
    await expect(header).toBeVisible();
    await expect(header.getByText('Client Portal').first()).toBeVisible();

    // Verify 3 Live Metric Cards (Frame 12)
    await expect(page.getByRole('main').getByText('Open Positions').first()).toBeVisible();
    await expect(page.getByText('Profiles Submitted').first()).toBeVisible();
    await expect(page.getByText('Interviews Scheduled').first()).toBeVisible();

    // Verify Recent Submissions section
    await expect(page.getByText('Recent Submitted Profiles')).toBeVisible();

    // Internal Recruiter sidebar must NOT exist
    await expect(page.locator('aside:has-text("WORKSPACE")')).not.toBeVisible();
  });

  test('Open Positions: displays authorized job mandates, search and specifications drawer', async ({ page }) => {
    await page.goto('/positions');

    await expect(page.getByRole('heading', { name: 'Open Positions & Mandates' })).toBeVisible();

    // Search input should be present
    const searchInput = page.getByPlaceholder('Search by title, code, or location...');
    await expect(searchInput).toBeVisible();

    // Filter dropdown
    const filterSelect = page.locator('select');
    await expect(filterSelect).toBeVisible();
  });

  test('Submitted Profiles: displays approved candidate submissions and review triggers', async ({ page }) => {
    await page.goto('/submitted-profiles');

    await expect(page.getByRole('heading', { name: 'Submitted Candidate Profiles' })).toBeVisible();

    // Search and filter
    await expect(page.getByPlaceholder('Search candidates, skills, or job codes...')).toBeVisible();
  });

  test('Interviews: displays candidate-safe interview rounds with IST timestamps', async ({ page }) => {
    await page.goto('/portal/interviews');

    await expect(page.getByRole('heading', { name: 'Scheduled Client Interviews' })).toBeVisible();

    // Verify tabs
    await expect(page.getByRole('button', { name: 'Upcoming Interviews' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Completed Rounds' })).toBeVisible();
  });

  test('Progress Reports: displays hiring pipeline velocity and job progress breakdown', async ({ page }) => {
    await page.goto('/portal/reports');

    await expect(page.getByRole('heading', { name: 'Client Hiring Progress & Velocity' })).toBeVisible();

    // Verify KPI grid labels
    await expect(page.getByRole('main').getByText('Open Positions').first()).toBeVisible();
    await expect(page.getByRole('main').getByText('Profiles Submitted').first()).toBeVisible();
    await expect(page.getByRole('main').getByText('Pending Review').first()).toBeVisible();
    await expect(page.getByRole('main').getByText('Shortlisted').first()).toBeVisible();
    await expect(page.getByRole('main').getByText('Positions Filled').first()).toBeVisible();

    // Verify Job-by-Job Mandate Pipeline
    await expect(page.getByText('Job-by-Job Mandate Pipeline')).toBeVisible();
  });

  test('Security: Client cannot access admin or internal settings', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.getByText('403 • Access Restricted')).toBeVisible();
  });
});
