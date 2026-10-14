// kanban-comment-order: newest-first comments, as bubbles in their own scroll container, with the task
// title pinned beside the ticket id.
//
// The built-in kanban drawer has no plugin slots, so this finds the Comments
// section by structure (language-independent) and tags it; style.css does the
// ordering and layout. A toggle in the section header switches back to oldest-first and
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

  function hueOf(name) {
    let h = 0;
    for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h % 360;
  }

  // Per-row hooks for style.css: the position (newest-first uses it as the flex `order`) and the
  // author's initial and colour for the avatar badge. Inline custom properties on rows React never
  // sets itself, so re-renders leave them alone; new rows are caught by the next pass.
  function decorateRows(section) {
    section.querySelectorAll(":scope > .hermes-kanban-comment").forEach(function (row, i) {
      row.style.setProperty("--kco-i", String(i));
      const author = row.querySelector(".hermes-kanban-comment-author");
      if (!author) return;
      const name = author.textContent.trim() || "?";
      if (author.getAttribute("data-kco-name") === name) return;
      author.setAttribute("data-kco-name", name);
      author.setAttribute("data-kco-initial", Array.from(name)[0].toUpperCase());
      row.style.setProperty("--kco-hue", String(hueOf(name)));
    });
  }

  // The built-in drawer scrolls its whole body, title included. Show the title in the (fixed) header
  // beside the ticket id instead; clicking it opens the built-in title editor, which replaces the
  // in-body title while editing.
  function decorateHead(drawer) {
    const head = drawer.querySelector(":scope > .hermes-kanban-drawer-head");
    if (!head) return;
    let el = head.querySelector(".kco-head-title");
    const text = drawer.querySelector(".hermes-kanban-drawer-title-text");
    if (!text) {
      if (el) el.remove();
      drawer.removeAttribute("data-kco-pinned");
      return;
    }
    if (!el) {
      el = document.createElement("button");
      el.type = "button";
      el.className = "kco-head-title";
      el.setAttribute("data-testid", "kco-head-title");
      el.title = "Click to edit";
      el.append(document.createElement("span"), document.createElement("span"));
      el.lastChild.className = "kco-head-text";
      el.addEventListener("click", function (e) {
        e.stopPropagation();
        const t = drawer.querySelector(".hermes-kanban-drawer-title-text");
        if (t) t.click();
      });
      head.insertBefore(el, head.querySelector(".hermes-kanban-drawer-close"));
    }
    const dot = drawer.querySelector(".hermes-kanban-drawer-title > .hermes-kanban-dot");
    el.firstChild.className = "kco-head-dot " + (dot ? dot.className : "");
    const label = text.textContent;
    if (el.lastChild.textContent !== label) el.lastChild.textContent = label;
    drawer.setAttribute("data-kco-pinned", "1");
  }

  function decorate() {
    document.querySelectorAll(".hermes-kanban-drawer").forEach(decorateHead);
    document.querySelectorAll(".hermes-kanban-drawer .hermes-kanban-section").forEach(function (section) {
      if (!isCommentsSection(section)) return;
      if (!section.hasAttribute("data-kco-comments")) section.setAttribute("data-kco-comments", "1");
      decorateRows(section);
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
