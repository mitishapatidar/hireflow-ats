import { test, expect } from '@playwright/test';

test.describe('Prompt 3: Application Shell & Role-Based Navigation', () => {
  test('Home page renders role selector cards and design system link', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Role-Based Application Shell');
    await expect(page.getByRole('heading', { name: 'Recruiter Dashboard' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Manager Dashboard' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Admin Control Center' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Client Portal' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Candidate Portal' })).toBeVisible();
  });

  test('Recruiter Shell: renders dark navy sidebar with recruiter items', async ({ page }) => {
    await page.goto('/dashboard');
    await page.evaluate(() => localStorage.setItem('hireflow_dev_role', 'RECRUITER'));
    await page.reload();

    // Verify Dark Navy Sidebar
    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toContainText('HireFlow');
    await expect(sidebar).toContainText('WORKSPACE');

    // Recruiter items
    await expect(sidebar.getByRole('link', { name: 'Overview' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Candidates' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Jobs' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Interviews' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Submissions' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Offers & Placements' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Clients CRM' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Reports' })).toBeVisible();

    // Manager only items should NOT be in recruiter sidebar
    await expect(sidebar.getByRole('link', { name: 'Approvals' })).not.toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Pipelines' })).not.toBeVisible();

    // TopBar features
    await expect(page.getByText('Search candidates, jobs...')).toBeVisible();
    await expect(page.getByText('HireFlow Agency • US-East').first()).toBeVisible();
  });

  test('Manager Shell: renders management items', async ({ page }) => {
    await page.goto('/dashboard');
    await page.evaluate(() => localStorage.setItem('hireflow_dev_role', 'MANAGER'));
    await page.reload();

    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeVisible();

    // Manager items
    await expect(sidebar.getByRole('link', { name: 'Overview' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Approvals' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Assignments' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Pipelines' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Performance' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Admin & Settings' })).toBeVisible();

    // Recruiter-only items should NOT be present
    await expect(sidebar.getByRole('link', { name: 'Candidates' })).not.toBeVisible();
  });

  test('Client Portal: separate client header and layout', async ({ page }) => {
    await page.goto('/portal');
    await page.evaluate(() => localStorage.setItem('hireflow_dev_role', 'CLIENT'));
    await page.reload();

    // Client top nav bar
    const clientHeader = page.locator('header').first();
    await expect(clientHeader.getByText('Client Portal').first()).toBeVisible();
    await expect(clientHeader.getByRole('link', { name: 'Overview' })).toBeVisible();
    await expect(clientHeader.getByRole('link', { name: 'Open Positions' })).toBeVisible();
    await expect(clientHeader.getByRole('link', { name: 'Submitted Profiles' })).toBeVisible();
    await expect(clientHeader.getByRole('link', { name: 'Interviews' })).toBeVisible();
    await expect(clientHeader.getByRole('link', { name: 'Progress Reports' })).toBeVisible();

    // Internal sidebar should NOT exist
    await expect(page.locator('aside:has-text("WORKSPACE")')).not.toBeVisible();
  });

  test('Candidate Portal: top navigation and no internal sidebar', async ({ page }) => {
    await page.goto('/my-dashboard');
    await page.evaluate(() => localStorage.setItem('hireflow_dev_role', 'CANDIDATE'));
    await page.reload();

    // Candidate branding and tabs
    await expect(page.getByText('Applicant Portal')).toBeVisible();
    await expect(page.getByRole('link', { name: 'My Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'My Applications' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Interviews' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'My Profile' })).toBeVisible();

    // Internal sidebar should NOT exist
    await expect(page.locator('aside:has-text("WORKSPACE")')).not.toBeVisible();
  });

  test('Route Guard: shows 403 No Permission when accessing restricted route', async ({ page }) => {
    await page.goto('/admin');
    await page.evaluate(() => localStorage.setItem('hireflow_dev_role', 'CLIENT'));
    await page.reload();

    await expect(page.getByText('403 • Access Restricted')).toBeVisible();
    await expect(page.getByText('Role Permission Required')).toBeVisible();
    await expect(page.getByText('CLIENT does not have permission')).toBeVisible();
  });

  test('Design system route /design remains fully functional', async ({ page }) => {
    await page.goto('/design');
    await expect(page.locator('h1')).toContainText('HireFlow Design System');
    await expect(page.getByText('1. Brand Color Palette (Single Source of Truth)')).toBeVisible();
  });
});
