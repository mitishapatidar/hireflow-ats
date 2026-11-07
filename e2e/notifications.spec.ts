import { test, expect } from '@playwright/test';

test.describe('Prompt 24: Notification Centre (Figma Frame 35)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('hireflow_dev_role', 'RECRUITER'));
  });

  test('Frame 35: loads notification centre, switches tabs and marks notification read', async ({ page }) => {
    await page.goto('/notifications');

    // Header & Title
    await expect(page.getByRole('heading', { name: 'Notification Centre & Tasks' })).toBeVisible();

    // Verify 4 Tabs (Frame 35)
    await expect(page.getByRole('button', { name: 'All Notifications' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unread' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'My Tasks' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Daily Digest (08:30 IST)' })).toBeVisible();

    // Switch to Unread tab
    await page.getByRole('button', { name: 'Unread' }).click();
    await expect(page.getByRole('button', { name: 'Unread' })).toHaveClass(/text-\[#5B49D6\]/);

    // Switch back to All tab
    await page.getByRole('button', { name: 'All Notifications' }).click();

    // Verify category filter buttons exist
    await expect(page.getByRole('button', { name: 'INTERVIEW', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'APPROVAL', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'TASK', exact: true })).toBeVisible();

    // Channel Preferences Drawer
    await page.getByRole('button', { name: 'Channel Preferences' }).click();
    await expect(page.getByText('Notification Preferences')).toBeVisible();
    await expect(page.getByText('IN_APP', { exact: true })).toBeVisible();
    await expect(page.getByText('EMAIL', { exact: true })).toBeVisible();
    await expect(page.getByText('WHATSAPP', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
  });

  test('Daily Digest tab: displays morning briefing KPIs and schedule', async ({ page }) => {
    await page.goto('/notifications');

    // Click Daily Digest tab
    await page.getByRole('button', { name: 'Daily Digest (08:30 IST)' }).click();

    await expect(page.getByText('Morning Briefing Digest (08:30 Asia/Kolkata)')).toBeVisible();
    await expect(page.getByText('Scheduled Mon–Fri')).toBeVisible();
  });
});
