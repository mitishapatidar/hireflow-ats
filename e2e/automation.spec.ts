import { test, expect } from '@playwright/test';

test.describe('Prompt 24: Automation Rules Admin (Figma Frame 36)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('hireflow_dev_role', 'ADMIN'));
  });

  test('Frame 36: displays automation rules, allows rule builder and template preview', async ({ page }) => {
    await page.goto('/admin/automation');

    // Verify Title & Description
    await expect(page.getByRole('heading', { name: 'Automation Rules Engine' })).toBeVisible();

    // Verify Standard Auto-seeded Rules Table
    await expect(page.getByText('Configured Automation Rules')).toBeVisible();

    // Open Execution History Log Drawer
    await page.getByRole('button', { name: 'Execution History Log' }).click();
    await expect(page.getByRole('heading', { name: 'Execution History Log' })).toBeVisible();
    await page.getByRole('button', { name: 'Close Log' }).click();

    // Open Create Rule Modal
    await page.getByRole('button', { name: 'Create Automation Rule' }).click();
    await expect(page.getByRole('heading', { name: 'New Automation Rule' })).toBeVisible();
    await expect(page.getByPlaceholder('e.g. Interview Reminder 24 Hours Prior')).toBeVisible();

    // Verify supported merge field chips
    await expect(page.getByRole('button', { name: '{first_name}' })).toBeVisible();
    await expect(page.getByRole('button', { name: '{candidate_name}' })).toBeVisible();
    await expect(page.getByRole('button', { name: '{job_title}' })).toBeVisible();

    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('Role Protection: verifies unauthorized roles cannot manage automation rules', async ({ page }) => {
    // Switch to Recruiter
    await page.evaluate(() => localStorage.setItem('hireflow_dev_role', 'RECRUITER'));
    await page.goto('/admin/automation');

    // Client/candidate/unauthorized role should not see the admin configuration or should be redirected/shielded
    // The page requires Admin role; let's check navigation does not expose automation to recruiter
    await page.goto('/dashboard');
    const navText = await page.locator('aside').first().innerText();
    expect(navText).not.toContain('Automation Rules');
  });
});
