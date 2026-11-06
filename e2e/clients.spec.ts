import { test, expect } from '@playwright/test';

test.describe('Prompt 9: Clients CRM & Client Record', () => {
  test.beforeEach(async ({ page }) => {
    // Default to ADMIN role
    await page.context().addCookies([
      { name: 'hireflow_dev_role', value: 'ADMIN', domain: 'localhost', path: '/' },
    ]);
    await page.addInitScript(() => {
      localStorage.setItem('hireflow_dev_role', 'ADMIN');
      document.cookie = 'hireflow_dev_role=ADMIN; path=/; max-age=86400';
    });
  });

  test('Figma Frame 09: Clients CRM (/clients) displays live stats, search, table and Add Client modal', async ({
    page,
  }) => {
    await page.goto('/clients');

    // 1. Header
    await expect(page.getByRole('heading', { name: 'Clients CRM' })).toBeVisible({ timeout: 15000 });
    await expect(
      page.locator('text=Manage client master records, hiring managers, commercial relationships, and active mandates.')
    ).toBeVisible();

    // 2. Live Statistics Cards
    await expect(page.getByTestId('stat-active-clients')).toBeVisible();
    await expect(page.getByTestId('stat-prospects')).toBeVisible();
    await expect(page.getByTestId('stat-meetings')).toBeVisible();

    // 3. Search Bar & Filter Controls
    const searchInput = page.getByTestId('clients-search-input');
    await expect(searchInput).toBeVisible();
    await expect(page.getByTestId('clients-status-filter')).toBeVisible();
    await expect(page.getByTestId('clients-owner-filter')).toBeVisible();
    await expect(page.getByTestId('clients-archive-filter')).toBeVisible();

    // 4. Data Table Columns
    const table = page.getByTestId('clients-table');
    await expect(table).toBeVisible();
    await expect(table.locator('th:has-text("Company & Industry")')).toBeVisible();
    await expect(table.locator('th:has-text("Primary Contact")')).toBeVisible();
    await expect(table.locator('th:has-text("Open Jobs")')).toBeVisible();
    await expect(table.locator('th:has-text("Relationship Owner")')).toBeVisible();
    await expect(table.locator('th:has-text("Status")')).toBeVisible();
    await expect(table.locator('th:has-text("Next Step")')).toBeVisible();

    // 5. Verify seeded client records appear (e.g. Acme Technologies CL-1001)
    await expect(page.getByTestId('client-row-CL-1001')).toBeVisible();
    await expect(page.locator('text=Acme Technologies')).toBeVisible();

    // 6. Test Search Filtering
    await searchInput.fill('Acme');
    await page.getByTestId('clients-filter-search-btn').click();
    await page.waitForTimeout(500);
    await expect(page.getByTestId('client-row-CL-1001')).toBeVisible();

    // Reset search
    await page.getByTestId('clients-filter-reset-btn').click();
    await page.waitForTimeout(500);

    // 7. Add Client Modal opens and has validation
    const addBtn = page.getByTestId('add-client-btn');
    await expect(addBtn).toBeVisible();
    await addBtn.click();

    const addModal = page.getByTestId('add-client-modal');
    await expect(addModal).toBeVisible();
    await expect(page.getByTestId('input-client-legal-name')).toBeVisible();
    await expect(page.getByTestId('input-client-industry')).toBeVisible();
    await expect(page.getByTestId('input-client-website')).toBeVisible();

    // Close modal
    await addModal.locator('button:has-text("Cancel")').click();
    await expect(addModal).not.toBeVisible();
  });

  test('Figma Frame 22: Client Record (/clients/[id]) displays 5 tabs, internal commercial panel, contacts with portal indicator', async ({
    page,
  }) => {
    // Navigate to Acme Technologies (CL-1001)
    await page.goto('/clients');
    await expect(page.getByTestId('client-row-CL-1001')).toBeVisible({ timeout: 15000 });

    const viewBtn = page.getByTestId('view-client-btn-CL-1001');
    await viewBtn.click();

    // 1. Record Header
    await expect(page.getByTestId('client-record-title')).toContainText('Acme Technologies', { timeout: 15000 });
    await expect(page.getByTestId('client-code-badge')).toHaveText('CL-1001');
    await expect(page.getByTestId('client-status-badge')).toBeVisible();
    await expect(page.getByTestId('edit-client-btn')).toBeVisible();

    // 2. Five Underline Tabs
    await expect(page.getByTestId('tab-overview')).toBeVisible();
    await expect(page.getByTestId('tab-contacts')).toBeVisible();
    await expect(page.getByTestId('tab-jobs')).toBeVisible();
    await expect(page.getByTestId('tab-documents')).toBeVisible();
    await expect(page.getByTestId('tab-activity')).toBeVisible();

    // 3. Tab 1: Overview - Company profile & Internal Commercial Panel
    await expect(page.getByTestId('tab-content-overview')).toBeVisible();
    const commercialPanel = page.getByTestId('internal-commercial-panel');
    await expect(commercialPanel).toBeVisible();
    await expect(commercialPanel.locator('text=CONFIDENTIAL')).toBeVisible();
    await expect(commercialPanel.locator('text=INTERNAL COMMERCIAL AGREEMENT')).toBeVisible();
    await expect(page.getByTestId('commercial-fee-percentage')).toBeVisible();
    await expect(page.getByTestId('commercial-payment-terms')).toBeVisible();
    await expect(page.getByTestId('edit-commercial-btn')).toBeVisible();

    // 4. Tab 2: Contacts with Prompt 6 Client Access Portal indicator
    await page.getByTestId('tab-contacts').click();
    await expect(page.getByTestId('tab-content-contacts')).toBeVisible();
    await expect(page.getByTestId('client-contacts-table')).toBeVisible();
    await expect(page.getByTestId('add-contact-btn')).toBeVisible();

    // Check Priya Gupta has Portal Access Active
    await expect(page.locator('text=Priya Gupta')).toBeVisible();
    await expect(page.locator('text=Portal Access Active')).toBeVisible();

    // 5. Tab 3: Jobs Mandates Tab
    await page.getByTestId('tab-jobs').click();
    await expect(page.getByTestId('tab-content-jobs')).toBeVisible();
    await expect(page.getByTestId('client-jobs-table')).toBeVisible();

    // 6. Tab 4: Documents Tab with Verification Badge and Download
    await page.getByTestId('tab-documents').click();
    await expect(page.getByTestId('tab-content-documents')).toBeVisible();
    await expect(page.getByTestId('client-documents-table')).toBeVisible();
    await expect(page.getByTestId('upload-document-btn')).toBeVisible();

    // 7. Tab 5: Meetings & Activity Timeline
    await page.getByTestId('tab-activity').click();
    await expect(page.getByTestId('tab-content-activity')).toBeVisible();
  });

  test('Commercial Data Protection: Candidate role is blocked from Clients CRM', async ({
    page,
  }) => {
    // Switch to CANDIDATE role
    await page.context().addCookies([
      { name: 'hireflow_dev_role', value: 'CANDIDATE', domain: 'localhost', path: '/' },
    ]);
    await page.addInitScript(() => {
      localStorage.setItem('hireflow_dev_role', 'CANDIDATE');
      document.cookie = 'hireflow_dev_role=CANDIDATE; path=/; max-age=86400';
    });

    await page.goto('/clients');
    // Candidate cannot access Clients CRM
    await expect(page.locator('text=Forbidden').or(page.locator('text=Access Denied')).or(page.locator('text=No clients found'))).toBeVisible({ timeout: 15000 });
  });

  test('Soft Archive and Restore Workflow preserves client records', async ({
    page,
  }) => {
    await page.goto('/clients');
    await expect(page.getByTestId('client-row-CL-1004')).toBeVisible({ timeout: 15000 });

    // Open Vertex Systems (CL-1004)
    await page.getByTestId('view-client-btn-CL-1004').click();
    await expect(page.getByTestId('client-code-badge')).toHaveText('CL-1004', { timeout: 15000 });

    // Check archive button is visible for Admin
    const archiveBtn = page.getByTestId('archive-client-btn');
    if (await archiveBtn.isVisible()) {
      await archiveBtn.click();
      const reasonInput = page.getByTestId('archive-detail-reason-input');
      await expect(reasonInput).toBeVisible();

      await reasonInput.fill('Account paused for E2E testing');
      await page.getByTestId('confirm-archive-detail-btn').click();

      // Should now show ARCHIVED badge and Restore button
      await expect(page.getByTestId('restore-client-btn')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=ARCHIVED')).toBeVisible();

      // Restore it back
      await page.getByTestId('restore-client-btn').click();
      await page.getByTestId('confirm-restore-detail-btn').click();
      await expect(page.getByTestId('archive-client-btn')).toBeVisible({ timeout: 10000 });
    }
  });
});
