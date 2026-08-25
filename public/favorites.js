// Favorites — saved locally on this device only (no account, no server).
// Shared by gallery.js and speakers.js.
window.CAC_FAV = (function () {
  const KEY = 'ebenezer_favorites';

  function getAll() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch (e) { return []; }
  }
  function isFav(id) { return getAll().includes(id); }
  function toggle(id) {
    const favs = getAll();
    const idx = favs.indexOf(id);
    if (idx > -1) favs.splice(idx, 1); else favs.push(id);
    localStorage.setItem(KEY, JSON.stringify(favs));
    return favs.includes(id);
  }
  function heartIcon() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>';
  }

  return { getAll, isFav, toggle, heartIcon };
})();
