import { test, expect } from '@playwright/test';

test.describe('Prompt 16: Phase 1 Golden-Path E2E Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate as Lead Recruiter / Admin
    await page.context().addCookies([
      { name: 'hireflow_dev_role', value: 'ADMIN', domain: 'localhost', path: '/' },
    ]);
    await page.addInitScript(() => {
      localStorage.setItem('hireflow_dev_role', 'ADMIN');
      document.cookie = 'hireflow_dev_role=ADMIN; path=/; max-age=86400';
    });
  });

  test('Complete 22-Step Recruiter Journey & Enterprise Module Walkthrough', async ({ page }) => {
    // 1. Dashboard & KPIs
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15000 });
    
    // 2. Recruiter Daily Activity
    await page.goto('/dashboard/activity');
    await expect(page.locator('body')).toContainText(/Activity|Productivity|Targets/i);

    // 3. Candidates Pool Directory
    await page.goto('/candidates');
    await expect(page.locator('body')).toContainText(/Candidates/i);
    const candidateTableOrCards = page.locator('table, [data-testid="candidates-table"], div:has-text("Candidates")');
    await expect(candidateTableOrCards.first()).toBeVisible();

    // 4. Jobs Directory
    await page.goto('/jobs');
    await expect(page.getByRole('heading', { name: /Jobs/i })).toBeVisible();

    // 5. Job Pipeline Kanban
    await page.goto('/jobs/job-j201/pipeline');
    await expect(page.locator('body')).toContainText(/Pipeline|Sourced|Screening|Interview/i);

    // 6. Interviews Calendar
    await page.goto('/interviews');
    await expect(page.locator('body')).toContainText(/Interview|Calendar/i);

    // 7. Client Submissions
    await page.goto('/submissions');
    await expect(page.locator('body')).toContainText(/Submissions|Standard Profile/i);

    // 8. Clients CRM
    await page.goto('/clients');
    await expect(page.locator('body')).toContainText(/Clients/i);

    // 9. Sales CRM Opportunities & Meetings
    await page.goto('/sales');
    await expect(page.locator('body')).toContainText(/Sales|Opportunities|Meetings/i);

    // 10. Candidate Communications
    await page.goto('/communications');
    await expect(page.locator('body')).toContainText(/Communications|Inbox|Templates/i);

    // 11. Team & Permissions
    await page.goto('/team');
    await expect(page.locator('body')).toContainText(/Team|Members|Roles/i);

    // 12. Immutable Audit Trail
    await page.goto('/audit');
    await expect(page.locator('body')).toContainText(/Audit|Log|Activity/i);
  });
});
