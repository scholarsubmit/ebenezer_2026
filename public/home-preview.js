// Populates the home page "glimpses" grid with up to 10 recent photos,
// and fills in the real stats row (photos / sessions / speakers) from
// the live APIs. No fabricated numbers.
(async function () {
  const grid = document.getElementById("preview-grid");
  const section = document.getElementById("preview-section");
  const statPhotos = document.getElementById("stat-photos");
  const statSessions = document.getElementById("stat-sessions");
  const statSpeakers = document.getElementById("stat-speakers");
  const FAV = window.CAC_FAV;

  let galleryData = { albums: [] };
  let speakersData = { speakers: [] };

  try {
    const [gRes, sRes] = await Promise.all([
      fetch("/api/gallery", { cache: "no-store" }),
      fetch("/api/speakers", { cache: "no-store" }),
    ]);
    galleryData = await gRes.json();
    speakersData = await sRes.json();
  } catch (e) {
    // leave defaults
  }

  const albums = galleryData.albums || [];
  const photos = albums.flatMap((a) => a.photos);
  const speakers = speakersData.speakers || [];

  if (statPhotos) statPhotos.textContent = photos.length.toLocaleString();
  if (statSessions) statSessions.textContent = albums.length.toLocaleString();
  if (statSpeakers) statSpeakers.textContent = speakers.length.toLocaleString();

  if (!grid) return;

  if (photos.length === 0) {
    if (section) section.style.display = "none";
    return;
  }

  const sample = photos
    .slice()
    .sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0))
    .slice(0, 10);

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
