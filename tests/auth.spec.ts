import { test, expect } from '@playwright/test';

test.describe('Authentication & Routing', () => {
  test('unauthenticated users are redirected to login from admin route', async ({ page }) => {
    // Attempt to access admin page
    await page.goto('/admin');
    
    // Should be redirected to login
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('navigation to signup page works', async ({ page }) => {
    await page.goto('/login');
    
    // Click on "Sign up" link
    await page.getByRole('link', { name: 'Sign up' }).click();
    
    // Should navigate to signup
    await expect(page).toHaveURL(/.*\/signup/);
    await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
  });
});
