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

  // The sandbox task may carry other comments too; only the relative order of the seeded three matters.
  const at = (order, s) => order.findIndex((t) => t.includes(s));
  let order = await commentTops(page);
  expect(at(order, "third comment")).toBeLessThan(at(order, "second comment"));
  expect(at(order, "second comment")).toBeLessThan(at(order, "first comment"));

  await page.getByTestId("kco-toggle").click();
  order = await commentTops(page);
  expect(at(order, "first comment")).toBeLessThan(at(order, "second comment"));
  expect(at(order, "second comment")).toBeLessThan(at(order, "third comment"));

  await page.reload();
  await page.locator(`[data-task-id="${TASK}"]`).first().click();
  await expect(page.getByTestId("kco-toggle")).toHaveText(/Oldest first/); // drawer loaded
  order = await commentTops(page);
  expect(at(order, "first comment")).toBeLessThan(at(order, "third comment")); // choice survived reload
});


test("title is pinned in the header next to the ticket id and stays there while the body scrolls", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 520 });
  await openDrawer(page);
  const pinned = page.getByTestId("kco-head-title");
  await expect(pinned).toBeVisible();
  const head = page.locator(".hermes-kanban-drawer-head");
  const [idBox, titleBox, headBox] = await Promise.all([
    head.locator("> span").first().boundingBox(), pinned.boundingBox(), head.boundingBox()]);
  expect(titleBox.x).toBeGreaterThan(idBox.x + idBox.width - 1); // to the right of the ticket id
  expect(Math.abs((titleBox.y + titleBox.height / 2) - (idBox.y + idBox.height / 2))).toBeLessThan(headBox.height / 2); // same row
  const realTitle = await page.locator(".hermes-kanban-drawer-title-text").evaluate((n) => n.textContent);
  await expect(pinned).toContainText(realTitle.trim());
  await expect(page.locator(".hermes-kanban-drawer-title")).toBeHidden(); // not shown twice

  await page.locator(".hermes-kanban-drawer-body").evaluate((n) => { n.scrollTop = n.scrollHeight; });
  await expect(pinned).toBeVisible();
  expect((await pinned.boundingBox()).y).toBeLessThan(headBox.y + headBox.height);
});

test("clicking the pinned title edits it, and Cancel brings the pinned title back", async ({ page }) => {
  await openDrawer(page);
  await page.getByTestId("kco-head-title").click();
  await expect(page.locator(".hermes-kanban-drawer-title input, .hermes-kanban-drawer-title textarea")).toBeVisible();
  await expect(page.getByTestId("kco-head-title")).toHaveCount(0); // editor replaces it while editing
  await page.locator(".hermes-kanban-drawer-title").getByRole("button", { name: /cancel/i }).click();
  await expect(page.getByTestId("kco-head-title")).toBeVisible();
  await expect(page.locator(".hermes-kanban-drawer-title")).toBeHidden();
});

test("comments scroll inside their own container with a sticky header", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 420 }); // small enough that three comments overflow
  await openDrawer(page);
  const box = page.locator(".hermes-kanban-section[data-kco-comments]");
  const m = await box.evaluate((n) => ({ overflowY: getComputedStyle(n).overflowY, scroll: n.scrollHeight, client: n.clientHeight }));
  expect(m.overflowY).toBe("auto");
  expect(m.scroll).toBeGreaterThan(m.client);

  await box.evaluate((n) => { n.scrollTop = n.scrollHeight; });
  const head = box.locator("> .hermes-kanban-section-head");
  const [hb, bb] = await Promise.all([head.boundingBox(), box.boundingBox()]);
  expect(Math.abs(hb.y - bb.y)).toBeLessThan(2); // header still at the top of the container
  // newest-first starts at the top of the scroller
  await box.evaluate((n) => { n.scrollTop = 0; });
  const order = await commentTops(page);
  expect(order.findIndex((t) => t.includes("third comment"))).toBeLessThan(order.findIndex((t) => t.includes("first comment")));
});

test("each comment is its own bubble with a prominent author", async ({ page }) => {
  await openDrawer(page);
  const row = page.locator(".hermes-kanban-section[data-kco-comments] > .hermes-kanban-comment").first();
  const s = await row.evaluate((n) => {
    const c = getComputedStyle(n);
    const a = getComputedStyle(n.querySelector(".hermes-kanban-comment-author"));
    const ago = getComputedStyle(n.querySelector(".hermes-kanban-comment-ago"));
    const badge = getComputedStyle(n.querySelector(".hermes-kanban-comment-author"), "::before");
    return { radius: parseFloat(c.borderTopLeftRadius), border: parseFloat(c.borderTopWidth), bg: c.backgroundColor,
      author: parseFloat(a.fontSize), weight: parseInt(a.fontWeight, 10), ago: parseFloat(ago.fontSize),
      badge: badge.content, badgeW: parseFloat(badge.width) };
  });
  expect(s.radius).toBeGreaterThanOrEqual(8);
  expect(s.border).toBeGreaterThanOrEqual(1);
  expect(s.bg).not.toBe("rgba(0, 0, 0, 0)");
  expect(s.author).toBeGreaterThan(s.ago);
  expect(s.weight).toBeGreaterThanOrEqual(700);
  expect(s.badge).toMatch(/\S/); // initial badge
  expect(s.badgeW).toBeGreaterThan(16);
  // bubbles are separated, not touching
  const tops = await page.locator(".hermes-kanban-section[data-kco-comments] > .hermes-kanban-comment")
    .evaluateAll((rows) => rows.map((r) => r.getBoundingClientRect()).sort((a, b) => a.top - b.top));
  for (let i = 1; i < tops.length; i++) expect(tops[i].top - tops[i - 1].bottom).toBeGreaterThanOrEqual(4);
});
