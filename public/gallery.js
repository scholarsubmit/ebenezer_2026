// Renders albums from the live gallery API into the gallery page, plus a
// professional sliding carousel lightbox with a filmstrip of nearby photos,
// keyboard nav, and touch swipe.

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

  // ---------------- Carousel Lightbox ----------------
  const lb = document.getElementById("lightbox");
  const viewport = document.getElementById("lightbox-viewport");
  const track = document.getElementById("lightbox-track");
  const filmstrip = document.getElementById("lightbox-filmstrip");
  const lbCaption = document.getElementById("lightbox-caption");
  const lbCounter = document.getElementById("lightbox-counter");

  let current = 0;
  let trackBuilt = false;

  function buildTrack() {
    // Build once per gallery load — cheap enough for a convention-sized
    // archive, and means slide transitions never need to re-fetch or
    // re-decode images once the lightbox is open.
    track.innerHTML = "";
    filmstrip.innerHTML = "";

    flatPhotos.forEach((photo, i) => {
      const slide = document.createElement("div");
      slide.className = "lightbox-slide";
      slide.innerHTML = `<img src="${photo.src}" alt="${photo.alt}" loading="${Math.abs(i - current) <= 2 ? "eager" : "lazy"}" />`;
      track.appendChild(slide);

      const thumb = document.createElement("button");
      thumb.type = "button";
      thumb.className = "filmstrip-thumb";
      thumb.dataset.idx = i;
      thumb.setAttribute("aria-label", `Go to photo ${i + 1}`);
      thumb.innerHTML = `<img src="${photo.src}" alt="" loading="lazy" />`;
      thumb.addEventListener("click", () => goTo(i));
      filmstrip.appendChild(thumb);
    });

    trackBuilt = true;
  }

  function updateTrackPosition(smooth = true) {
    track.style.transition = smooth ? "" : "none";
    track.style.transform = `translateX(-${current * 100}%)`;
    if (!smooth) {
      // force reflow so the next transform change re-enables the transition
      void track.offsetHeight;
      track.style.transition = "";
    }
  }

  function updateActiveStates() {
    track.querySelectorAll(".lightbox-slide").forEach((slide, i) => {
      slide.classList.toggle("is-active", i === current);
    });
    filmstrip.querySelectorAll(".filmstrip-thumb").forEach((thumb, i) => {
      const active = i === current;
      thumb.classList.toggle("active", active);
      if (active) {
        thumb.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    });
    const photo = flatPhotos[current];
    if (photo) lbCaption.textContent = photo.alt;
    if (lbCounter) lbCounter.textContent = `${current + 1} / ${flatPhotos.length}`;
  }

  function openLightbox(idx) {
    current = idx;
    if (!trackBuilt) buildTrack();
    updateTrackPosition(false);
    updateActiveStates();
    lb.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    lb.classList.remove("open");
    document.body.style.overflow = "";
  }

  function goTo(idx) {
    current = (idx + flatPhotos.length) % flatPhotos.length;
    updateTrackPosition(true);
    updateActiveStates();
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

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

  // Touch swipe support on the main stage
  let touchStartX = null;
  viewport.addEventListener("touchstart", (e) => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  viewport.addEventListener("touchend", (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) {
      if (dx < 0) next(); else prev();
    }
    touchStartX = null;
  });

  // Re-fit the track if the lightbox is opened after a resize (e.g. rotating a phone)
  window.addEventListener("resize", () => {
    if (lb.classList.contains("open")) updateTrackPosition(false);
  });
})();
