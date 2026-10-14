import { test, expect } from "@playwright/test";

const TASK = process.env.KANBAN_E2E_TASK; // seeded task id with comments first/second/third + 4 attachments

test.skip(!TASK, "set KANBAN_E2E_TASK to the seeded sandbox task id");

async function openDrawer(page) {
  await page.goto("/kanban");
  await page.locator(`[data-task-id="${TASK}"]`).first().click();
  await expect(page.locator(".hermes-kanban-drawer")).toBeVisible();
}

const commentTops = (page) =>
  page.locator(".hermes-kanban-section[data-kco-comments] > .hermes-kanban-comment").evaluateAll((rows) =>
    rows.map((r) => ({ text: r.textContent, top: r.getBoundingClientRect().top })).sort((a, b) => a.top - b.top).map((r) => r.text));

test("comments render newest first by default and the toggle flips and persists", async ({ page }) => {
  await openDrawer(page);
  await expect(page.getByTestId("kco-toggle")).toBeVisible();

  let order = await commentTops(page);
  expect(order[0]).toContain("third comment");
  expect(order[2]).toContain("first comment");

  await page.getByTestId("kco-toggle").click();
  order = await commentTops(page);
  expect(order[0]).toContain("first comment");
  expect(order[2]).toContain("third comment");

  await page.reload();
  await page.locator(`[data-task-id="${TASK}"]`).first().click();
  await expect(page.getByTestId("kco-toggle")).toHaveText(/Oldest first/); // drawer loaded
  order = await commentTops(page);
  expect(order[0]).toContain("first comment"); // choice survived reload
});

