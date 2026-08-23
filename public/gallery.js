// Renders albums from gallery-manifest.json into the gallery page,
// plus a simple dependency-free lightbox with keyboard + swipe-free nav.

(async function () {
  const container = document.getElementById("gallery-root");
  const toolbar = document.getElementById("gallery-toolbar");
  if (!container) return;

  let data;
  try {
    const res = await fetch("/api/gallery", { cache: "no-store" });
    data = await res.json();
  } catch (e) {
    data = { albums: [] };
  }

  const albums = (data.albums || []).filter((a) => a.photos && a.photos.length);

  if (albums.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No photos yet — the archive is warming up</h3>
        <p>Once the convention media team uploads photos from the admin page, they'll appear here
        automatically, grouped by day.</p>
      </div>`;
    return;
  }

  // Build a flat list for the lightbox to page through, across all visible albums
  let flatPhotos = [];

  function renderAlbums(filterSlug) {
    flatPhotos = [];
    container.innerHTML = "";
    const toRender = filterSlug ? albums.filter((a) => a.slug === filterSlug) : albums;

    toRender.forEach((album) => {
      const block = document.createElement("section");
      block.className = "album-block";
      block.innerHTML = `
        <div class="album-head">
          <h3>${album.title}</h3>
          <span>${album.count} photo${album.count === 1 ? "" : "s"}</span>
        </div>
        <div class="photo-grid"></div>
      `;
      const grid = block.querySelector(".photo-grid");
      album.photos.forEach((photo) => {
        const idx = flatPhotos.length;
        flatPhotos.push(photo);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.setAttribute("aria-label", `Open photo: ${photo.alt}`);
        btn.innerHTML = `<img src="${photo.src}" alt="${photo.alt}" loading="lazy" />`;
        btn.addEventListener("click", () => openLightbox(idx));
        grid.appendChild(btn);
      });
      container.appendChild(block);
    });
  }

  renderAlbums(null);

  if (toolbar) {
    const allChip = document.createElement("button");
    allChip.className = "chip active";
    allChip.textContent = "All Days";
    allChip.addEventListener("click", () => setActive(allChip, null));
    toolbar.appendChild(allChip);

    albums.forEach((album) => {
      const chip = document.createElement("button");
      chip.className = "chip";
      chip.textContent = album.title;
      chip.addEventListener("click", () => setActive(chip, album.slug));
      toolbar.appendChild(chip);
    });

    function setActive(chip, slug) {
      toolbar.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      renderAlbums(slug);
    }
  }

  // ---------------- Lightbox ----------------
  const lb = document.getElementById("lightbox");
  const lbImg = document.getElementById("lightbox-img");
  const lbCaption = document.getElementById("lightbox-caption");
  let current = 0;

  function openLightbox(idx) {
    current = idx;
    showCurrent();
    lb.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    lb.classList.remove("open");
    document.body.style.overflow = "";
  }

  function showCurrent() {
    const photo = flatPhotos[current];
    if (!photo) return;
    lbImg.src = photo.src;
    lbImg.alt = photo.alt;
    lbCaption.textContent = photo.alt;
  }

  function next() {
    current = (current + 1) % flatPhotos.length;
    showCurrent();
  }

  function prev() {
    current = (current - 1 + flatPhotos.length) % flatPhotos.length;
    showCurrent();
  }

  document.getElementById("lightbox-close").addEventListener("click", closeLightbox);
  document.getElementById("lightbox-next").addEventListener("click", next);
  document.getElementById("lightbox-prev").addEventListener("click", prev);
  lb.addEventListener("click", (e) => {
    if (e.target === lb) closeLightbox();
  });
  document.addEventListener("keydown", (e) => {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") prev();
  });
})();
