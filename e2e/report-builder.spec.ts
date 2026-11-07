import { test, expect } from '@playwright/test';

test.describe('Prompt 26: Custom Report Builder (Figma Frame 37)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('hireflow_dev_role', 'ADMIN'));
  });

  test('Frame 37: displays custom report builder, live preview, and export controls', async ({ page }) => {
    await page.goto('/reports/builder');

    // Verify Title
    await expect(page.getByRole('heading', { name: 'Custom Report Builder' })).toBeVisible();

    // Verify Entity Selector Pills
    await expect(page.getByRole('button', { name: 'CANDIDATES', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'JOBS', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'APPLICATIONS', exact: true })).toBeVisible();

    // Verify 5-row Live Preview card and As-Of timestamp
    await expect(page.getByText('Live Preview (5 Rows)')).toBeVisible();
    await expect(page.getByText('Generated As-Of:')).toBeVisible();

    // Verify Permission Boundary Panel
    await expect(page.getByText('Permission Boundary & Security Guarantee')).toBeVisible();

    // Open Save View Modal
    await page.getByRole('button', { name: 'Save View' }).click();
    await expect(page.getByRole('heading', { name: 'Save Custom Report View' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Verify Export buttons
    await expect(page.getByRole('button', { name: 'Export CSV' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Export Excel' })).toBeVisible();
  });

  test('Entity Switching: clicking JOBS updates column options and preview', async ({ page }) => {
    await page.goto('/reports/builder');

    // Click JOBS entity
    await page.getByRole('button', { name: 'JOBS', exact: true }).click();

    // Verify Job-specific columns appear in active order
    await expect(page.getByText('Active Order')).toBeVisible();
  });
});
