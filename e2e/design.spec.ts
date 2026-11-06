import { test, expect } from '@playwright/test';

test('design system showcase loads all component sections', async ({ page }) => {
  await page.goto('http://localhost:3000/design');
  await expect(page.locator('h1')).toContainText('HireFlow Design System');
  await expect(page.locator('body')).toContainText('Brand Color Palette');
  await expect(page.locator('body')).toContainText('Typography Hierarchy');
  await expect(page.locator('body')).toContainText('Status Badges & Stage Variants');
  await expect(page.locator('body')).toContainText('Kanban Pipeline Components');
});
