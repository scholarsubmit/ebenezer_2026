// Emoji reactions — a lighter, more playful cousin of Favorites. Also
// stored only on this device (localStorage), same pattern as favorites.js.
// One reaction per photo; tapping the active emoji again clears it.
window.CAC_REACT = (function () {
  const KEY = 'ebenezer_reactions';
  const EMOJIS = ['🙌', '🔥', '🙏'];

  function getAll() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch (e) { return {}; }
  }
  function get(id) {
    return getAll()[id] || null;
  }
  function set(id, emoji) {
    const all = getAll();
    if (all[id] === emoji) delete all[id]; // tap again to clear
    else all[id] = emoji;
    localStorage.setItem(KEY, JSON.stringify(all));
    return all[id] || null;
  }

  return { EMOJIS, get, set };
})();
