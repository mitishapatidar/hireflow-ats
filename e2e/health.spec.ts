import { test, expect } from '@playwright/test';

test('landing page loads and confirms frontend status', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await expect(page.locator('h1')).toContainText('Role-Based Application Shell');
  await expect(page.locator('body')).toContainText('HireFlow ATS & Recruitment CRM');
});
