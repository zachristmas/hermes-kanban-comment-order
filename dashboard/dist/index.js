// kanban-comment-order: show kanban task comments newest-first.
//
// The built-in kanban drawer has no plugin slots, so this finds the Comments
// section by structure (language-independent) and tags it; style.css does the
// reordering. A toggle in the section header switches back to oldest-first and
// is remembered per browser.
(function () {
  "use strict";

  const LS_KEY = "hermes.kanban.commentOrder";
  const DEFAULT_ORDER = "newest";
  const root = document.documentElement;

  function readOrder() {
    try {
      const v = window.localStorage.getItem(LS_KEY);
      if (v === "newest" || v === "oldest") return v;
    } catch (_e) { /* storage blocked: fall through to default */ }
    return DEFAULT_ORDER;
  }

  function writeOrder(v) {
    try { window.localStorage.setItem(LS_KEY, v); } catch (_e) { /* ignore */ }
  }

  function label(order) {
    return order === "newest" ? "Newest first ↓" : "Oldest first ↑";
  }

  function applyOrder(order) {
    root.setAttribute("data-kco-order", order);
    document.querySelectorAll(".kco-toggle").forEach(function (b) {
      b.textContent = label(order);
    });
  }

  // Comments and "Child Results" share .hermes-kanban-comment rows. Only real
  // comments have a relative-time span and no per-row "Open" action button.
  function isCommentsSection(section) {
    const rows = section.querySelectorAll(":scope > .hermes-kanban-comment");
    if (rows.length === 0) return false;
    return !!section.querySelector(":scope > .hermes-kanban-comment .hermes-kanban-comment-ago") &&
      !section.querySelector(":scope > .hermes-kanban-comment .hermes-kanban-diag-action-btn");
  }

  function decorate() {
    document.querySelectorAll(".hermes-kanban-drawer .hermes-kanban-section").forEach(function (section) {
      if (!isCommentsSection(section)) return;
      if (!section.hasAttribute("data-kco-comments")) section.setAttribute("data-kco-comments", "1");
      const head = section.querySelector(":scope > .hermes-kanban-section-head");
      // React rewrites the header text when the comment count changes, which
      // drops our button; re-adding it here is idempotent.
      if (!head || head.querySelector(".kco-toggle")) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "kco-toggle";
      btn.setAttribute("data-testid", "kco-toggle");
      btn.title = "Change comment order";
      btn.textContent = label(readOrder());
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        const next = readOrder() === "newest" ? "oldest" : "newest";
        writeOrder(next);
        applyOrder(next);
      });
      head.appendChild(btn);
    });
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(function () {
      scheduled = false;
      decorate();
    });
  }

  applyOrder(readOrder());
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  schedule();

  // Hidden-tab placeholder so the dashboard registry sees a clean load.
  window.__HERMES_PLUGINS__.register("kanban-comment-order", function () { return null; });
})();
