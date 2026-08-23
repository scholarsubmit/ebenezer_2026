// Populates the home page "glimpses" grid with up to 8 photos pulled
// from the generated manifest, and hides the section gracefully if
// no photos have been added yet.
(async function () {
  const grid = document.getElementById("preview-grid");
  const section = document.getElementById("preview-section");
  if (!grid) return;

  let data;
  try {
    const res = await fetch("/api/gallery", { cache: "no-store" });
    data = await res.json();
  } catch (e) {
    data = { albums: [] };
  }

  const photos = (data.albums || []).flatMap((a) => a.photos);

  if (photos.length === 0) {
    if (section) section.style.display = "none";
    return;
  }

  const sample = photos.slice(0, 8);
  grid.innerHTML = sample
    .map(
      (p) => `<a href="/gallery.html"><img src="${p.src}" alt="${p.alt}" loading="lazy" /></a>`
    )
    .join("");
})();
