// Mobile nav toggle + active link highlight — shared across all pages
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", () => links.classList.toggle("open"));
  }

  const here = location.pathname.replace(/\/index\.html$/, "/");
  document.querySelectorAll(".nav-links a").forEach((a) => {
    const target = a.getAttribute("href");
    if (target === here || (target === "/" && here === "/")) {
      a.classList.add("active");
    }
  });
});
