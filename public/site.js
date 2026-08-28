// Mobile nav toggle, active link highlight, and page fade transitions —
// shared across all pages.

// Fade in as soon as possible (don't wait for full DOMContentLoaded —
// that can lag on slow connections and the CSS fallback already
// guarantees visibility within 500ms regardless).
document.body.classList.add("page-loaded");

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => links.classList.toggle("open"));
  }

  const here = location.pathname.replace(/\/index\.html$/, "/");
  document.querySelectorAll(".nav-links a, .mobile-tabbar a").forEach((a) => {
    const target = a.getAttribute("href");
    if (target === here || (target === "/" && here === "/")) {
      a.classList.add("active");
    }
  });

  // Soft fade-out before navigating to another page on this site. Only
  // intercepts plain same-origin .html links — never download links,
  // hash anchors, new-tab links, or links to other origins.
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a) return;
    if (a.hasAttribute("download")) return;
    if (a.target && a.target !== "_self") return;
    const href = a.getAttribute("href") || "";
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    if (/^[a-z]+:\/\//i.test(href) && !href.startsWith(location.origin)) return; // external link
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // let the user open in new tab/window normally

    e.preventDefault();
    document.body.classList.remove("page-loaded");
    document.body.classList.add("page-leaving");
    setTimeout(() => { window.location.href = href; }, 140);
  });
});
