import { test, expect } from '@playwright/test';

test.describe('Prompt 5: Authentication & Session Verification (Figma Frame 15)', () => {
  test('Login Page: renders Figma Frame 15 navy hero panel and form components', async ({ page }) => {
    await page.goto('/login');

    // Verify left brand hero panel
    await expect(page.locator('text=Good hiring starts with a clear view.').first()).toBeVisible();
    await expect(page.locator('text=One secure place for your candidates, clients and every next step.').first()).toBeVisible();

    // Verify right login form
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.locator('text=Sign in to your organization')).toBeVisible();
    await expect(page.locator('button:has-text("Continue with Google")')).toBeVisible();

    // Verify input fields
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('text=Remember this device')).toBeVisible();
    await expect(page.locator('a:has-text("Forgot password?")')).toBeVisible();

    // Verify submit button & security banner
    await expect(page.locator('button:has-text("Sign in securely")')).toBeVisible();
    await expect(page.locator('text=Two-step verification may be required by your organization')).toBeVisible();
  });

  test('Login Page: displays error banner on invalid work email or password', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'unknown.user@hireflow.io');
    await page.fill('input[type="password"]', 'WrongPassword!123');
    await page.click('button:has-text("Sign in securely")');

    // Generic security error message
    await expect(page.locator('text=Invalid work email or password')).toBeVisible({ timeout: 10000 });
  });

  test('Forgot Password Page: renders request flow with work email validation', async ({ page }) => {
    await page.goto('/forgot-password');

    await expect(page.getByRole('heading', { name: 'Reset your password' })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send Reset Instructions' })).toBeVisible();

    // Submit valid email
    await page.fill('input[type="email"]', 'anika.rao@hireflow.io');
    await page.click('button:has-text("Send Reset Instructions")');

    await expect(page.locator('text=Instructions Sent')).toBeVisible({ timeout: 10000 });
  });

  test('Accept Invitation Page: renders password setup form with policy guidance', async ({ page }) => {
    await page.goto('/accept-invitation?token=mock-invitation-token');

    await expect(page.getByRole('heading', { name: 'Welcome to HireFlow' })).toBeVisible();
    await expect(page.locator('text=Must be at least 8 characters with uppercase, lowercase, numbers, and symbols.')).toBeVisible();
    await expect(page.locator('button:has-text("Activate Account & Sign In")')).toBeVisible();
  });

  test('Reset Password Page: renders token confirmation form', async ({ page }) => {
    await page.goto('/reset-password?token=mock-reset-token');

    await expect(page.getByRole('heading', { name: 'Create new password' })).toBeVisible();
    await expect(page.locator('button:has-text("Update Password & Sign In")')).toBeVisible();
  });

  test('Recruiter Login & Session: successful sign in with Argon2id credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'rahul.s@hireflow.io');
    await page.fill('input[type="password"]', 'HireFlow@2026!');
    await page.click('button:has-text("Sign in securely")');

    // Wait for server action to create session and redirect to /dashboard
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    await expect(page).toHaveURL(/.*dashboard/);

    // Verify dashboard renders for authenticated recruiter
    await expect(page.locator('aside:has-text("WORKSPACE")')).toBeVisible();
    await expect(page.locator('text=Overview').first()).toBeVisible();
  });
});
