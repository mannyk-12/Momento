import { test, expect } from '@playwright/test';

// Because we need authentication to actually view the event creation page,
// testing the real page in E2E requires bypassing auth or using a test token.
// Since Firebase Auth is complex to mock in Playwright without a setup script,
// we will verify that the routing works properly.

test.describe('Events Page Routing', () => {
  test('unauthenticated users see access denied on event creation', async ({ page }) => {
    await page.goto('/events/new');
    
    // Should show access denied message
    await expect(page.getByRole('heading', { name: 'Access Denied' })).toBeVisible();
  });
  
  test('unauthenticated users are redirected to login from event dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Should be redirected to login
    await expect(page).toHaveURL(/.*\/login/);
  });
});
