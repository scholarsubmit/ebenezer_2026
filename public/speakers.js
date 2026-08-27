// Speakers page: fetches real speaker records from the API, renders cards
// with a favorite heart, and opens a carousel lightbox with Download +
// Favorite actions.

(async function () {
  const grid = document.getElementById("grid-speakers");
  if (!grid) return;

  const countMeta = document.getElementById("count-meta");
  const searchInput = document.getElementById("search-input");
  const sortSelect = document.getElementById("sort-select");
  const FAV = window.CAC_FAV;

  let speakers = [];
  try {
    const res = await fetch("/api/speakers", { cache: "no-store" });
    const data = await res.json();
    speakers = data.speakers || [];
  } catch (e) {
    speakers = [];
  }

  let currentList = speakers.slice();

  function render(list) {
    currentList = list;
    countMeta.textContent = `${list.length} Speaker${list.length === 1 ? "" : "s"}`;

    if (list.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <h3>No speakers added yet</h3>
          <p>Once the media team adds speakers from the admin page, they'll appear here.</p>
        </div>`;
      return;
    }

    grid.innerHTML = "";
    list.forEach((s, idx) => {
      const card = document.createElement("article");
      card.className = "card speaker-card";
      card.innerHTML = `
        <button type="button" class="thumb" aria-label="View ${s.name}">
          <img src="${s.photoUrl}" alt="${s.name}" loading="lazy" />
        </button>
        <span class="badge">${s.tag}</span>
        <button type="button" class="fav" data-id="${s.id}" aria-label="Toggle favorite">${FAV.heartIcon()}</button>
        <div class="cap">
          <p class="t">${s.name}</p>
          <p class="s">${s.title || ""}</p>
        </div>
      `;
      card.querySelector(".thumb").addEventListener("click", () => openLightbox(idx));
      const favBtn = card.querySelector(".fav");
      favBtn.classList.toggle("active", FAV.isFav(s.id));
      favBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const active = FAV.toggle(s.id);
        favBtn.classList.toggle("active", active);
      });
      grid.appendChild(card);
    });
  }

  render(speakers);

  function applyFilters() {
    const q = searchInput.value.trim().toLowerCase();
    let list = q
      ? speakers.filter((s) => s.name.toLowerCase().includes(q) || (s.title || "").toLowerCase().includes(q) || (s.tag || "").toLowerCase().includes(q))
      : speakers.slice();
    if (sortSelect.value === "az") list.sort((a, b) => a.name.localeCompare(b.name));
    render(list);
  }
  searchInput.addEventListener("input", applyFilters);
  sortSelect.addEventListener("change", applyFilters);

  // ---------------- Carousel lightbox (mirrors gallery.js) ----------------
  const lb = document.getElementById("lightbox");
  const viewport = document.getElementById("lightbox-viewport");
  const track = document.getElementById("lightbox-track");
  const filmstrip = document.getElementById("lightbox-filmstrip");
  const lbCaption = document.getElementById("lightbox-caption");
  const lbBio = document.getElementById("lightbox-bio");
  const lbCounter = document.getElementById("lightbox-counter");
  const lbDownload = document.getElementById("lightbox-download");
  const lbFav = document.getElementById("lightbox-fav");
  const lbShare = document.getElementById("lightbox-share");

  let current = 0;

  function buildTrack() {
    track.innerHTML = "";
    filmstrip.innerHTML = "";
    currentList.forEach((s, i) => {
      const slide = document.createElement("div");
      slide.className = "lightbox-slide";
      slide.innerHTML = `<img src="${s.photoUrl}" alt="${s.name}" loading="${Math.abs(i - current) <= 2 ? "eager" : "lazy"}" />`;
      track.appendChild(slide);

      const thumb = document.createElement("button");
      thumb.type = "button";
      thumb.className = "filmstrip-thumb";
      thumb.setAttribute("aria-label", `Go to ${s.name}`);
      thumb.innerHTML = `<img src="${s.photoUrl}" alt="" loading="lazy" />`;
      thumb.addEventListener("click", () => goTo(i));
      filmstrip.appendChild(thumb);
    });
  }

  function updateTrackPosition(smooth = true) {
    track.style.transition = smooth ? "" : "none";
    track.style.transform = `translateX(-${current * 100}%)`;
    if (!smooth) { void track.offsetHeight; track.style.transition = ""; }
  }

  function updateActiveStates() {
    track.querySelectorAll(".lightbox-slide").forEach((slide, i) => slide.classList.toggle("is-active", i === current));
    filmstrip.querySelectorAll(".filmstrip-thumb").forEach((thumb, i) => {
      const active = i === current;
      thumb.classList.toggle("active", active);
      if (active) thumb.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    });
    const s = currentList[current];
    if (!s) return;
    lbCaption.textContent = [s.name, s.title].filter(Boolean).join(" — ");
    if (lbBio) lbBio.textContent = s.bio || "";
    lbCounter.textContent = `${current + 1} / ${currentList.length}`;
    lbDownload.href = s.photoUrl;
    lbDownload.setAttribute("download", `${s.name.replace(/\s+/g, "-").toLowerCase()}.jpg`);
    if (lbShare) {
      lbShare.onclick = () => window.CAC_SHARE(s.photoUrl, `${s.name} — EBENEZER 2026 Unity Convention`);
    }
    const setFavState = () => {
      const active2 = FAV.isFav(s.id);
      lbFav.classList.toggle("btn-gold", active2);
      lbFav.classList.toggle("btn-ghost", !active2);
      lbFav.textContent = active2 ? "Saved to Favorites" : "Save to Favorites";
    };
    setFavState();
    lbFav.onclick = () => {
      FAV.toggle(s.id);
      setFavState();
      const cardBtn = grid.querySelector(`.fav[data-id="${s.id}"]`);
      if (cardBtn) cardBtn.classList.toggle("active", FAV.isFav(s.id));
    };
  }

  function openLightbox(idx) {
    current = idx;
    buildTrack();
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
    current = (idx + currentList.length) % currentList.length;
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
})();
