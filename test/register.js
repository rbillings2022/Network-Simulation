const { test, expect } = require('@playwright/test');

test('User cannot register a new account without confirming password', async ({ page }) => {

    await page.goto('/src/pages/register/register.html');

    // Wait for the page to fully load before trying to fill fields
    await page.waitForLoadState('domcontentloaded');

    // Confirm the form is actually visible before proceeding
    await page.waitForSelector('#name', { timeout: 1000 });

    await page.fill('#name',     'Test User');
    await page.fill('#email',    `testuser_${Date.now()}@tracer.com`);
    await page.fill('#password', 'SecurePass123');

    await page.click('#register-btn');

    await expect(page).toHaveURL(/sign_in/, { timeout: 1000 });
});