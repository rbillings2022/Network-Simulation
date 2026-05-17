const { test, expect } = require('@playwright/test');

test('Saving topology', async ({ page }) => {
    // Inject a fake logged-in user so the save button works
    await page.evaluate(() => {
        sessionStorage.setItem('user', JSON.stringify({
            id:    1,
            name:  'Test User',
            email: 'test@tracer.com'
        }));
    });

    // ── Arrange ───────────────────────────────────────────────
    await page.goto('/index.html');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('#cytoscape', { timeout: 10000 });

    // Add devices so there is something to save
    for (const type of ['PC', 'Switch']) {
        await page.click('#add-dropdown');
        await page.waitForSelector('#add-menu.open', { timeout: 5000 });
        await page.click(`a[data-type="${type}"]`);
        await page.waitForTimeout(600);
    }

    // ── Act ───────────────────────────────────────────────────
    // Register dialog handler BEFORE clicking save
    // This must come first so it's ready when the prompt appears
    page.once('dialog', async dialog => {
        console.log('Dialog appeared:', dialog.message());
        await dialog.accept('My Test Topology');
    });

    // Start watching for the API request
    const requestPromise = page.waitForRequest(req =>
        req.url().includes('/api/topologies') && req.method() === 'POST',
        { timeout: 10000 }
    );

    // Now click save — this triggers the prompt
    await page.click('#save-btn');

    // Wait for the API call to complete
    const request = await requestPromise;

    // ── Assert ────────────────────────────────────────────────
    const body = JSON.parse(request.postData() ?? '{}');
    expect(body).toHaveProperty('name', 'My Test Topology');
    expect(body.state.devices.length).toBeGreaterThan(0);
});