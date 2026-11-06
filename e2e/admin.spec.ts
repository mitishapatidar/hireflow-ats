import { test, expect } from '@playwright/test';

test.describe('Prompt 6: Admin, Team Structure, Reporting Lines & Permissions', () => {
  test('Figma Frame 11: Admin & Settings Landing Page renders correctly', async ({ page }) => {
    // Set developer role to ADMIN before navigation
    await page.addInitScript(() => {
      localStorage.setItem('hireflow_dev_role', 'ADMIN');
      document.cookie = 'hireflow_dev_role=ADMIN; path=/; max-age=86400';
    });

    await page.goto('/admin');

    // Header & Brand
    await expect(page.getByRole('heading', { name: 'Admin & Settings' })).toBeVisible();
    await expect(page.locator('text=Aureva Capital').first()).toBeVisible();
    await expect(
      page.locator('text=Manage teams, permissions, integrations, workflows and brand controls.')
    ).toBeVisible();

    // Action buttons & pills
    await expect(page.locator('text=Branded careers preview')).toBeVisible();
    await expect(page.locator('button:has-text("Open audit log")')).toBeVisible();

    // 6 Section Cards
    await expect(page.getByRole('heading', { name: 'Teams & reporting lines' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Role & client permissions' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Google / email login & OTP' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Integrations' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Email & WhatsApp templates' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Custom fields & exports' })).toBeVisible();

    // Open and verify Audit Log modal
    await page.click('button:has-text("Open audit log")');
    await expect(page.locator('text=Enterprise Audit Trail')).toBeVisible();
    await expect(page.locator('button:has-text("Close")')).toBeVisible();
    await page.click('button:has-text("Close")');

    // Clicking "Teams & reporting lines" navigates to /admin/team
    await page.getByRole('link', { name: 'Teams & reporting lines' }).click();
    await expect(page).toHaveURL(/\/admin\/team/);
  });

  test('Figma Frame 30: Team & Permissions Page renders all 4 tabs and layout', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('hireflow_dev_role', 'ADMIN');
      document.cookie = 'hireflow_dev_role=ADMIN; path=/; max-age=86400';
    });

    await page.goto('/admin/team');

    // Header & Phase Badge
    await expect(page.locator('text=PHASE 1 + 2 · ACCESS / 30')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Team, reporting & permissions' })).toBeVisible();
    await expect(
      page.locator('text=Manage reporting lines, role permissions and explicit client access.')
    ).toBeVisible();
    await expect(page.locator('button:has-text("+ Invite member")')).toBeVisible();

    // 4 Tabs
    await expect(page.locator('button:has-text("Team & reporting")')).toBeVisible();
    await expect(page.locator('button:has-text("Role permissions")')).toBeVisible();
    await expect(page.locator('button:has-text("Client access")')).toBeVisible();
    await expect(page.locator('button:has-text("Invitations")')).toBeVisible();

    // Main Roster Table
    await expect(page.locator('text=Recruitment team · reporting lines')).toBeVisible();
    await expect(page.getByText('Anika Rao').first()).toBeVisible({ timeout: 15000 });

    // Role Permission Matrix
    await expect(page.locator('text=Role permission matrix')).toBeVisible();
    await expect(page.locator('text=Candidate records')).toBeVisible();
    await expect(page.locator('text=Internal fees & margins')).toBeVisible();

    // Right Rail Cards
    await expect(page.locator('text=Invite client user')).toBeVisible();
    await expect(page.locator('text=Active access · Priya Gupta')).toBeVisible();
    await expect(page.locator('text=Acme scoped')).toBeVisible();
    await expect(page.locator('text=watermarked CV · 10 per day.')).toBeVisible();
  });

  test('Team & Permissions: Tab Switching & Modals', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('hireflow_dev_role', 'ADMIN');
      document.cookie = 'hireflow_dev_role=ADMIN; path=/; max-age=86400';
    });

    await page.goto('/admin/team');

    // Switch to Role Permissions Tab
    await page.click('button:has-text("Role permissions")');
    await expect(page.locator('text=Enterprise Role Capabilities')).toBeVisible();
    await expect(page.locator('text=Admin Fee Visibility Grant:')).toBeVisible();

    // Switch to Client Access Tab
    await page.click('button:has-text("Client access")');
    await expect(page.locator('text=Active Client User Access')).toBeVisible();

    // Switch to Invitations Tab
    await page.click('button:has-text("Invitations")');
    await expect(page.locator('text=Pending & Sent Invitations')).toBeVisible();

    // Open Invite Member Modal
    await page.click('button:has-text("+ Invite member")');
    await expect(page.getByRole('heading', { name: 'Invite Team Member' })).toBeVisible();
    await expect(page.locator('input[placeholder="e.g. Vikram Malhotra"]')).toBeVisible();
    await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
    await page.click('button:has-text("Cancel")');
  });

  test('Access Guard: Recruiter cannot access Admin & Settings (/admin)', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('hireflow_dev_role', 'RECRUITER');
      document.cookie = 'hireflow_dev_role=RECRUITER; path=/; max-age=86400';
    });

    await page.goto('/admin');
    await expect(page.locator('text=Role Permission Required')).toBeVisible();
    await expect(page.locator('text=403 • Access Restricted')).toBeVisible();
  });
});
