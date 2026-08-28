// Populates the home page "glimpses" grid with up to 10 recent photos,
// animates the real stats row (photos / sessions / speakers) counting up
// from 0, and shows skeleton cards while everything loads.
(async function () {
  const grid = document.getElementById("preview-grid");
  const section = document.getElementById("preview-section");
  const statPhotos = document.getElementById("stat-photos");
  const statSessions = document.getElementById("stat-sessions");
  const statSpeakers = document.getElementById("stat-speakers");
  const FAV = window.CAC_FAV;

  if (grid) {
    grid.innerHTML = Array.from({ length: 5 })
      .map(() => '<div class="skeleton-card"></div>')
      .join("");
  }

  function animateCount(el, target, duration = 900) {
    if (!el) return;
    if (target === 0) { el.textContent = "0"; return; }
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      el.textContent = Math.round(eased * target).toLocaleString();
      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = target.toLocaleString();
    }
    requestAnimationFrame(tick);
  }

  let galleryData = { albums: [] };
  let speakersData = { speakers: [] };
  let featuredData = { photos: [] };

  try {
    const [gRes, sRes, fRes] = await Promise.all([
      fetch("/api/gallery", { cache: "no-store" }),
      fetch("/api/speakers", { cache: "no-store" }),
      fetch("/api/featured", { cache: "no-store" }),
    ]);
    galleryData = await gRes.json();
    speakersData = await sRes.json();
    featuredData = await fRes.json();
  } catch (e) {
    // leave defaults
  }

  const albums = galleryData.albums || [];
  const photos = albums.flatMap((a) => a.photos);
  const speakers = speakersData.speakers || [];

  animateCount(statPhotos, photos.length);
  animateCount(statSessions, albums.length);
  animateCount(statSpeakers, speakers.length);

  if (!grid) return;

  const isFeatured = featuredData.photos && featuredData.photos.length > 0;
  const headingEl = document.getElementById("preview-heading");
  if (headingEl && isFeatured) headingEl.textContent = "Highlights from EBENEZER 2026";

  if (photos.length === 0) {
    if (section) section.style.display = "none";
    return;
  }

  const sample = (featuredData.photos && featuredData.photos.length > 0
    ? featuredData.photos
    : photos.slice().sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0))
  ).slice(0, 10);

  grid.innerHTML = sample
    .map(
      (p) => `
      <a class="card" href="/gallery.html">
        <div class="thumb"><img src="${p.src}" alt="${p.alt}" loading="lazy" /></div>
        ${FAV && FAV.isFav(p.pathname) ? `<span class="fav active">${FAV.heartIcon()}</span>` : ""}
      </a>`
    )
    .join("");
})();
