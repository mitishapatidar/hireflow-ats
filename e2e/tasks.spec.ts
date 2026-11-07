import { test, expect } from '@playwright/test';

test.describe('Prompt 24: Follow-up Tasks (Figma Frame 35)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('hireflow_dev_role', 'RECRUITER'));
  });

  test('My Tasks: displays KPI cards, opens task modal and filters tasks', async ({ page }) => {
    await page.goto('/notifications');

    // Click My Tasks tab
    await page.getByRole('button', { name: 'My Tasks' }).click();

    // Verify Metric Cards
    await expect(page.getByText('Total Tasks')).toBeVisible();
    await expect(page.getByText('Due Today')).toBeVisible();
    await expect(page.getByText('Overdue Follow-ups')).toBeVisible();

    // Verify filter buttons
    await expect(page.getByRole('button', { name: 'all', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'today', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'overdue', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'completed', exact: true })).toBeVisible();

    // Open Create Task modal
    await page.getByRole('button', { name: 'Create Follow-up Task' }).click();
    await expect(page.getByRole('heading', { name: 'Create Follow-up Task' })).toBeVisible();
    await expect(page.getByPlaceholder('e.g. Follow up on technical round feedback')).toBeVisible();

    // Fill task title
    await page.getByPlaceholder('e.g. Follow up on technical round feedback').fill('E2E Verification Task');
    await page.getByRole('button', { name: 'Cancel' }).click();
  });
});
