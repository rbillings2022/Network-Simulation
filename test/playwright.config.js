const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './',
    timeout: 600000,          // ← increase from 30000 to 60000

    webServer: {
        command:             'node ../server/server.js',
        url:                 'http://localhost:3000',
        reuseExistingServer: true,
        timeout:             15000   // ← give server more time to start
    },

    reporter: [
        ['html', { outputFolder: '../results/html-report', open: 'never' }],
        ['json', { outputFile:   '../results/results.json' }],
        ['list']
    ],

    use: {
        baseURL:              'http://localhost:3000',
        headless:             false,
        screenshot:           'on',
        video:                'retain-on-failure',
        trace:                'retain-on-failure',
        actionTimeout:        15000,   // ← how long to wait for each click/fill
        navigationTimeout:    15000    // ← how long to wait for page loads
    },

    outputDir: '../test-results/artifacts'
});