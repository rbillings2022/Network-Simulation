const { test, expect } = require("@playwright/test");

const INDEX_URL = "http://localhost:3000/index.html";

// ─── TC 1 ───────────────────────────────────────────────────────────────────
// Adding a PC device will create a node in canvas and display its network info
// ────────────────────────────────────────────────────────────────────────────
test("Adding a PC device creates a node in canvas and displays its network info", async ({ page }) => {
  await page.goto(INDEX_URL);

  // Open add-device dropdown then click PC
  await page.click("#add-dropdown");
  await page.click('#add-menu a[data-type="PC"]');

  // One node should now exist in Cytoscape
  const count = await page.evaluate(() => window.cy.nodes().length);
  expect(count).toBe(1);

  // Node labels are numbered (e.g. "PC-1") so use .first() to avoid
  // strict-mode failure when both "PC-1" and a sidebar "PC" span are matched
  const pcLabel = page.locator("#cytoscape").getByText("PC").first();
  await expect(pcLabel).toBeVisible();
});

// ─── TC 2 ───────────────────────────────────────────────────────────────────
// Adding PC, Router, Switch, Server creates all four nodes and displays info
// ────────────────────────────────────────────────────────────────────────────
test("Adding PC, Router, Switch, Server creates four nodes and displays their network info", async ({ page }) => {
  await page.goto(INDEX_URL);

  for (const type of ["PC", "Router", "Switch", "Server"]) {
    await page.click("#add-dropdown");
    await page.click(`#add-menu a[data-type="${type}"]`);
  }

  // Four nodes should exist in Cytoscape
  const count = await page.evaluate(() => window.cy.nodes().length);
  expect(count).toBe(4);

  // One node per type — .first() guards against sidebar text matches
  for (const type of ["PC", "Router", "Switch", "Server"]) {
    await expect(page.locator("#cytoscape").getByText(type).first()).toBeVisible();
  }
});

// ─── TC 3 ───────────────────────────────────────────────────────────────────
// Adding PC×2, Router×2, Switch, Server creates six nodes and displays info
// ────────────────────────────────────────────────────────────────────────────
test("Adding PC×2, Router×2, Switch, Server creates six nodes and displays their network info", async ({ page }) => {
  await page.goto(INDEX_URL);

  for (const type of ["PC", "PC", "Router", "Router", "Switch", "Server"]) {
    await page.click("#add-dropdown");
    await page.click(`#add-menu a[data-type="${type}"]`);
  }

  // Six nodes total
  const totalCount = await page.evaluate(() => window.cy.nodes().length);
  expect(totalCount).toBe(6);

  // Count each device type directly through Cytoscape's data to avoid DOM
  // text collisions (e.g. "PC" matching "PC-1", "PC-2", and sidebar spans)
  const pcCount     = await page.evaluate(() => window.cy.nodes().filter(n => n.data("label")?.startsWith("PC")).length);
  const routerCount = await page.evaluate(() => window.cy.nodes().filter(n => n.data("label")?.startsWith("Router")).length);
  const switchCount = await page.evaluate(() => window.cy.nodes().filter(n => n.data("label")?.startsWith("Switch")).length);
  const serverCount = await page.evaluate(() => window.cy.nodes().filter(n => n.data("label")?.startsWith("Server")).length);

  expect(pcCount).toBe(2);
  expect(routerCount).toBe(2);
  expect(switchCount).toBe(1);
  expect(serverCount).toBe(1);
});