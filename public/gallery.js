// Gallery page: shows albums as cover cards, and paginates each album's
// photos at 30 per page. The lightbox carousel browses every photo in the
// current filtered/sorted set regardless of which page the grid is on.

(async function () {
  const albumsGrid = document.getElementById("albums-grid");
  if (!albumsGrid) return;

  const PAGE_SIZE = 30;

  const albumFilter = document.getElementById("album-filter");
  const sortSelect = document.getElementById("sort-select");
  const searchInput = document.getElementById("search-input");
  const breadcrumb = document.getElementById("breadcrumb");
  const backBtn = document.getElementById("back-to-albums");
  const detailTitle = document.getElementById("album-detail-title");
  const detailCount = document.getElementById("album-detail-count");
  const photoGridWrap = document.getElementById("photo-grid-wrap");
  const pagedGrid = document.getElementById("paged-photo-grid");
  const paginationEl = document.getElementById("pagination");

  let data;
  try {
    const res = await fetch("/api/gallery", { cache: "no-store" });
    data = await res.json();
  } catch (e) {
    data = { albums: [] };
  }

  const albums = (data.albums || []).filter((a) => a.photos && a.photos.length);

  // ---------------- state ----------------
  let viewMode = "albums"; // "albums" | "detail"
  let activeAlbum = null;
  let currentPage = 1;
  let sortOrder = "newest";
  let searchTerm = "";
  let flatPhotos = []; // the photo set currently loaded into the lightbox carousel

  if (albums.length === 0) {
    albumsGrid.innerHTML = `
      <div class="empty-state">
        <h3>No photos yet — the archive is warming up</h3>
        <p>Once the convention media team uploads photos from the admin page, sessions will appear
        here automatically.</p>
      </div>`;
    return;
  }

  // Populate the "jump to session" dropdown
  albums.forEach((a) => {
    const opt = document.createElement("option");
    opt.value = a.slug;
    opt.textContent = `${a.title} (${a.count})`;
    albumFilter.appendChild(opt);
  });

  function coverPhoto(album) {
    return album.photos[album.photos.length - 1] || album.photos[0];
  }

  // ---------------- Albums (cover cards) view ----------------
  function renderAlbumsView() {
    viewMode = "albums";
    breadcrumb.style.display = "none";
    photoGridWrap.style.display = "none";
    albumsGrid.style.display = "";
    albumFilter.value = "";

    const term = searchTerm.trim().toLowerCase();
    const visible = term ? albums.filter((a) => a.title.toLowerCase().includes(term)) : albums;

    if (visible.length === 0) {
      albumsGrid.innerHTML = `<div class="empty-state"><h3>No sessions match "${searchTerm}"</h3></div>`;
      return;
    }

    albumsGrid.innerHTML = "";
    visible.forEach((album) => {
      const cover = coverPhoto(album);
      const card = document.createElement("button");
      card.type = "button";
      card.className = "album-card";
      card.innerHTML = `
        <div class="cover"><img src="${cover.src}" alt="${album.title} cover" loading="lazy" /></div>
        <div class="meta">
          <h3>${album.title}</h3>
          <span>${album.count} photo${album.count === 1 ? "" : "s"}</span>
        </div>
      `;
      card.addEventListener("click", () => openAlbum(album.slug));
      albumsGrid.appendChild(card);
    });
  }

  // ---------------- Album detail (paginated) view ----------------
  function getFilteredSortedPhotos(album) {
    const term = searchTerm.trim().toLowerCase();
    let list = term ? album.photos.filter((p) => p.alt.toLowerCase().includes(term)) : album.photos.slice();
    list.sort((a, b) => {
      const diff = new Date(a.uploadedAt) - new Date(b.uploadedAt);
      return sortOrder === "newest" ? -diff : diff;
    });
    return list;
  }

  function openAlbum(slug) {
    const album = albums.find((a) => a.slug === slug);
    if (!album) return;
    activeAlbum = album;
    viewMode = "detail";
    currentPage = 1;
    searchInput.value = "";
    searchTerm = "";
    albumFilter.value = slug;
    albumsGrid.style.display = "none";
    breadcrumb.style.display = "flex";
    photoGridWrap.style.display = "";
    renderAlbumDetail();
    window.scrollTo({ top: breadcrumb.offsetTop - 90, behavior: "smooth" });
  }

  function backToAlbums() {
    activeAlbum = null;
    searchInput.value = "";
    searchTerm = "";
    renderAlbumsView();
  }

  function renderAlbumDetail() {
    if (!activeAlbum) return;
    const filtered = getFilteredSortedPhotos(activeAlbum);
    flatPhotos = filtered; // lightbox carousel spans the full filtered/sorted album, not just this page

    detailTitle.textContent = activeAlbum.title;
    detailCount.textContent = `${filtered.length} photo${filtered.length === 1 ? "" : "s"}`;

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (currentPage > totalPages) currentPage = totalPages;

    if (filtered.length === 0) {
      pagedGrid.innerHTML = `<div class="empty-state"><h3>No photos match "${searchTerm}" in this session</h3></div>`;
      paginationEl.innerHTML = "";
      return;
    }

    const start = (currentPage - 1) * PAGE_SIZE;
    const pagePhotos = filtered.slice(start, start + PAGE_SIZE);

    pagedGrid.innerHTML = "";
    pagePhotos.forEach((photo, localIdx) => {
      const globalIdx = start + localIdx;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("aria-label", `Open photo: ${photo.alt}`);
      btn.innerHTML = `<img src="${photo.src}" alt="${photo.alt}" loading="lazy" />`;
      btn.addEventListener("click", () => openLightbox(globalIdx));
      pagedGrid.appendChild(btn);
    });

    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    paginationEl.innerHTML = "";
    if (totalPages <= 1) return;

    const makeBtn = (label, page, opts = {}) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      if (opts.active) b.classList.add("active");
      if (opts.disabled) b.disabled = true;
      b.addEventListener("click", () => {
        currentPage = page;
        renderAlbumDetail();
        window.scrollTo({ top: breadcrumb.offsetTop - 90, behavior: "smooth" });
      });
      return b;
    };

    paginationEl.appendChild(makeBtn("‹ Prev", currentPage - 1, { disabled: currentPage === 1 }));

    const windowSize = 2;
    const pages = new Set([1, totalPages]);
    for (let p = currentPage - windowSize; p <= currentPage + windowSize; p++) {
      if (p >= 1 && p <= totalPages) pages.add(p);
    }
    const sortedPages = Array.from(pages).sort((a, b) => a - b);

    let last = 0;
    sortedPages.forEach((p) => {
      if (p - last > 1) {
        const dots = document.createElement("span");
        dots.className = "pg-ellipsis";
        dots.textContent = "…";
        paginationEl.appendChild(dots);
      }
      paginationEl.appendChild(makeBtn(String(p), p, { active: p === currentPage }));
      last = p;
    });

    paginationEl.appendChild(makeBtn("Next ›", currentPage + 1, { disabled: currentPage === totalPages }));
  }

  // ---------------- toolbar wiring ----------------
  albumFilter.addEventListener("change", () => {
    if (albumFilter.value) openAlbum(albumFilter.value);
    else backToAlbums();
  });

  sortSelect.addEventListener("change", () => {
    sortOrder = sortSelect.value;
    if (viewMode === "detail") {
      currentPage = 1;
      renderAlbumDetail();
    }
  });

  let searchDebounce;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      searchTerm = searchInput.value;
      if (viewMode === "detail") {
        currentPage = 1;
        renderAlbumDetail();
      } else {
        renderAlbumsView();
      }
    }, 150);
  });

  backBtn.addEventListener("click", backToAlbums);

  renderAlbumsView();

  // ---------------- Carousel Lightbox ----------------
  const lb = document.getElementById("lightbox");
  const viewport = document.getElementById("lightbox-viewport");
  const track = document.getElementById("lightbox-track");
  const filmstrip = document.getElementById("lightbox-filmstrip");
  const lbCaption = document.getElementById("lightbox-caption");
  const lbCounter = document.getElementById("lightbox-counter");

  let current = 0;

  function buildTrack() {
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
  }

  function updateTrackPosition(smooth = true) {
    track.style.transition = smooth ? "" : "none";
    track.style.transform = `translateX(-${current * 100}%)`;
    if (!smooth) {
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
      if (active) thumb.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    });
    const photo = flatPhotos[current];
    if (photo) lbCaption.textContent = photo.alt;
    if (lbCounter) lbCounter.textContent = `${current + 1} / ${flatPhotos.length}`;
  }

  function openLightbox(idx) {
    current = idx;
    buildTrack(); // rebuilt each open since flatPhotos changes with album/search/sort
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
    // If navigating past the current grid page's boundary, keep the grid's
    // page in sync so re-opening from the grid stays consistent.
    const newPage = Math.floor(current / PAGE_SIZE) + 1;
    if (viewMode === "detail" && newPage !== currentPage) {
      currentPage = newPage;
      renderAlbumDetail();
    }
    updateTrackPosition(true);
    updateActiveStates();
  }

  function next() { goTo(current + 1); }
  function prev() { goTo(current - 1); }

  document.getElementById("lightbox-close").addEventListener("click", closeLightbox);
  document.getElementById("lightbox-next").addEventListener("click", next);
  document.getElementById("lightbox-prev").addEventListener("click", prev);
  lb.addEventListener("click", (e) => { if (e.target === lb) closeLightbox(); });
  document.addEventListener("keydown", (e) => {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") prev();
  });

  let touchStartX = null;
  viewport.addEventListener("touchstart", (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
  viewport.addEventListener("touchend", (e) => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) { if (dx < 0) next(); else prev(); }
    touchStartX = null;
  });

  window.addEventListener("resize", () => {
    if (lb.classList.contains("open")) updateTrackPosition(false);
  });
})();
