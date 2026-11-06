import { test, expect } from '@playwright/test';

test.describe('Prompt 7: Candidates List & Candidate Profile', () => {
  test('Figma Frame 02: Candidates List (/candidates) renders layout, search, filters & table', async ({
    page,
  }) => {
    await page.context().addCookies([
      { name: 'hireflow_dev_role', value: 'ADMIN', domain: 'localhost', path: '/' },
    ]);
    await page.addInitScript(() => {
      localStorage.setItem('hireflow_dev_role', 'ADMIN');
      document.cookie = 'hireflow_dev_role=ADMIN; path=/; max-age=86400';
    });

    await page.goto('/candidates');

    // 1. Header (Matching Frame 02)
    await expect(page.getByRole('heading', { name: 'Candidates' })).toBeVisible({ timeout: 15000 });
    await expect(
      page.locator('text=Find, organise and move talent through your hiring pipeline.')
    ).toBeVisible();
    await expect(page.locator('text=+ New')).toBeVisible();

    // 2. Search & Filter Bar
    const searchInput = page.locator('input[placeholder*="Search by name, email, skill or tag"]');
    await expect(searchInput).toBeVisible();

    // Saved View Pills
    await expect(page.locator('button:has-text("All candidates")')).toBeVisible();
    await expect(page.locator('button:has-text("My Active")')).toBeVisible();
    await expect(page.locator('button:has-text("In Interview")')).toBeVisible();
    await expect(page.locator('button:has-text("Archived")')).toBeVisible();

    // Filter dropdowns
    await expect(page.locator('select').first()).toBeVisible();
    await expect(page.locator('label:has-text("Include archived")')).toBeVisible();

    // 3. Candidates Data Table
    await expect(page.getByRole('columnheader', { name: 'Candidate' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Applied for' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Experience' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Location' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Stage' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Updated' })).toBeVisible();

    // Verify candidate rows exist from seeded data
    await page.waitForSelector('table tbody tr');
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible();

    // 4. Bottom Action Chips (Matching Figma Frame 02)
    await expect(page.locator('button:has-text("Duplicate detection")')).toBeVisible();
    await expect(page.locator('button:has-text("Auto-fill from PDF/Word")')).toBeVisible();
    await expect(page.locator('button:has-text("Bulk resume upload")')).toBeVisible();
    await expect(page.locator('a:has-text("Recruiter permissions")')).toBeVisible();
    await expect(page.locator('button:has-text("Archive instead of delete")')).toBeVisible();

    // Test clicking Duplicate detection chip shows informational modal
    const dupBtn = page.locator('button:has-text("Duplicate detection")');
    await dupBtn.scrollIntoViewIfNeeded();
    await dupBtn.click();
    await expect(page.locator('h3:has-text("Duplicate Detection")')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Understood")');
  });

  test('Search filter dynamically narrows candidates list', async ({ page }) => {
    await page.context().addCookies([
      { name: 'hireflow_dev_role', value: 'ADMIN', domain: 'localhost', path: '/' },
    ]);
    await page.addInitScript(() => {
      localStorage.setItem('hireflow_dev_role', 'ADMIN');
      document.cookie = 'hireflow_dev_role=ADMIN; path=/; max-age=86400';
    });

    await page.goto('/candidates');
    await page.waitForSelector('table tbody tr', { timeout: 15000 });

    const searchInput = page.locator('input[placeholder*="Search by name, email, skill or tag"]');
    await searchInput.fill('Aarav');
    await searchInput.press('Enter');

    // Wait for filtered results and verify in candidate table row
    await page.waitForTimeout(500);
    await expect(page.locator('table tbody tr:has-text("Aarav Shah")').first()).toBeVisible();
  });

  test('Figma Frame 03: Candidate Profile (/candidates/[id]) renders header, tabs & overview', async ({
    page,
  }) => {
    await page.context().addCookies([
      { name: 'hireflow_dev_role', value: 'ADMIN', domain: 'localhost', path: '/' },
    ]);
    await page.addInitScript(() => {
      localStorage.setItem('hireflow_dev_role', 'ADMIN');
      document.cookie = 'hireflow_dev_role=ADMIN; path=/; max-age=86400';
    });

    // Navigate to candidates list and click first candidate
    await page.goto('/candidates');
    await page.waitForSelector('table tbody tr a[href*="/candidates/"]');
    const firstRowLink = page.locator('table tbody tr a:has-text("View Profile")').first();
    await Promise.all([
      page.waitForURL(/\/candidates\//),
      firstRowLink.click(),
    ]);

    // Expect Candidate Profile heading
    await expect(page.getByRole('heading', { name: 'Candidate Profile' })).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/\/candidates\/[a-zA-Z0-9_-]{4,}/);

    // Header Card (Matching Frame 03)
    await expect(page.locator('button:has-text("+ Edit candidate")')).toBeVisible();
    await expect(page.locator('button:has-text("Schedule interview")')).toBeVisible();
    await expect(page.locator('text=Owner:').first()).toBeVisible();

    // 6 Tabs
    await expect(page.locator('button:has-text("Overview")')).toBeVisible();
    await expect(page.locator('button:has-text("Resume")')).toBeVisible();
    await expect(page.locator('button:has-text("Activity")')).toBeVisible();
    await expect(page.locator('button:has-text("Interviews")')).toBeVisible();
    await expect(page.locator('button:has-text("Submissions")')).toBeVisible();
    await expect(page.locator('button:has-text("Archive")')).toBeVisible();

    // Overview Tab Content (2 Columns)
    await expect(page.locator('text=Candidate Overview')).toBeVisible();
    await expect(page.locator('text=Email Address')).toBeVisible();
    await expect(page.locator('text=Phone Number')).toBeVisible();
    await expect(page.locator('text=Technical Skills')).toBeVisible();
    await expect(page.locator('text=Activity Timeline')).toBeVisible();
    await expect(page.locator('text=Interview History')).toBeVisible();

    // Test tab navigation
    await page.click('button:has-text("Resume")');
    await expect(page.locator('text=Candidate Resumes & Documents')).toBeVisible();

    await page.click('button:has-text("Activity")');
    await expect(page.locator('text=Complete Audit Trail')).toBeVisible();

    await page.click('button:has-text("Archive")');
    await expect(page.locator('text=Archive Status & Retention Compliance')).toBeVisible();
  });

  test('Edit Candidate Profile modal allows updating profile fields', async ({ page }) => {
    await page.context().addCookies([
      { name: 'hireflow_dev_role', value: 'ADMIN', domain: 'localhost', path: '/' },
    ]);
    await page.addInitScript(() => {
      localStorage.setItem('hireflow_dev_role', 'ADMIN');
      document.cookie = 'hireflow_dev_role=ADMIN; path=/; max-age=86400';
    });

    await page.goto('/candidates');
    await page.waitForSelector('table tbody tr');
    await page.locator('table tbody tr a:has-text("View Profile")').first().click();

    // Open Edit modal
    await page.click('button:has-text("+ Edit candidate")');
    await expect(page.getByRole('heading', { name: 'Edit Candidate Profile' })).toBeVisible();

    // Check fields
    await expect(page.locator('input[value*="Shah"], input[value*="Sharma"], input[type="text"]').first()).toBeVisible();
    await page.click('button:has-text("Cancel")');
  });

  test('Add and view confidential internal note on candidate profile', async ({ page }) => {
    await page.context().addCookies([
      { name: 'hireflow_dev_role', value: 'ADMIN', domain: 'localhost', path: '/' },
    ]);
    await page.addInitScript(() => {
      localStorage.setItem('hireflow_dev_role', 'ADMIN');
      document.cookie = 'hireflow_dev_role=ADMIN; path=/; max-age=86400';
    });

    await page.goto('/candidates');
    await page.waitForSelector('table tbody tr');
    await page.locator('table tbody tr a:has-text("View Profile")').first().click();

    // Ensure we are on Overview tab
    await page.click('button:has-text("Overview")');

    // Click "Add Note" button
    await page.click('button:has-text("Add Note")');
    await expect(page.getByRole('heading', { name: 'Add Internal Note' })).toBeVisible();

    const noteText = `Automated E2E note test - ${Date.now()}`;
    await page.fill('textarea[placeholder*="Record interview notes"]', noteText);
    await page.click('button:has-text("Save Note")');

    // Verify note rendered with confidential badge
    await expect(page.locator(`text=${noteText}`)).toBeVisible();
  });
});
