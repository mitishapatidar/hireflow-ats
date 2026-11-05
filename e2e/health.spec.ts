import { test, expect } from '@playwright/test';

test('landing page loads and confirms frontend status', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await expect(page.locator('h1')).toContainText('HireFlow ATS');
  await expect(page.locator('body')).toContainText('Frontend Application Online');
});
