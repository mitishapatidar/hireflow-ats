import { test } from '@playwright/test';

test.describe('Role Screenshots', () => {
  test('Capture all role views', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // 1. Recruiter View
    await page.goto('http://localhost:3000/dashboard');
    await page.evaluate(() => localStorage.setItem('hireflow_dev_role', 'RECRUITER'));
    await page.reload();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'C:/Users/Mitisha/.gemini/antigravity/brain/51647501-f834-41db-a57f-d8ccee742a91/recruiter-dashboard.png', fullPage: true });

    // 2. Manager View
    await page.goto('http://localhost:3000/approvals');
    await page.evaluate(() => localStorage.setItem('hireflow_dev_role', 'MANAGER'));
    await page.reload();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'C:/Users/Mitisha/.gemini/antigravity/brain/51647501-f834-41db-a57f-d8ccee742a91/manager-approvals.png', fullPage: true });

    // 3. Admin View
    await page.goto('http://localhost:3000/admin');
    await page.evaluate(() => localStorage.setItem('hireflow_dev_role', 'ADMIN'));
    await page.reload();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'C:/Users/Mitisha/.gemini/antigravity/brain/51647501-f834-41db-a57f-d8ccee742a91/admin-control.png', fullPage: true });

    // 4. Client Portal View
    await page.goto('http://localhost:3000/portal');
    await page.evaluate(() => localStorage.setItem('hireflow_dev_role', 'CLIENT'));
    await page.reload();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'C:/Users/Mitisha/.gemini/antigravity/brain/51647501-f834-41db-a57f-d8ccee742a91/client-portal.png', fullPage: true });

    // 5. Candidate Portal View
    await page.goto('http://localhost:3000/my-dashboard');
    await page.evaluate(() => localStorage.setItem('hireflow_dev_role', 'CANDIDATE'));
    await page.reload();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'C:/Users/Mitisha/.gemini/antigravity/brain/51647501-f834-41db-a57f-d8ccee742a91/candidate-portal.png', fullPage: true });

    // 6. No Permission View
    await page.goto('http://localhost:3000/no-permission');
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'C:/Users/Mitisha/.gemini/antigravity/brain/51647501-f834-41db-a57f-d8ccee742a91/no-permission-guard.png', fullPage: true });

    // 7. Mobile View
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:3000/dashboard');
    await page.evaluate(() => localStorage.setItem('hireflow_dev_role', 'RECRUITER'));
    await page.reload();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'C:/Users/Mitisha/.gemini/antigravity/brain/51647501-f834-41db-a57f-d8ccee742a91/mobile-view.png', fullPage: false });
  });
});
