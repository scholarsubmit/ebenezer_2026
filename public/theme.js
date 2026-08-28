// Light/dark theme toggle. The instant dark/light class is applied by a
// tiny inline script in each page's <head> (before CSS paints, to avoid
// a flash of the wrong theme) — this file just wires up the visible
// toggle button once the page has loaded.
(function () {
  const KEY = 'ebenezer_theme';

  function setLabel(btn) {
    const isLight = document.documentElement.classList.contains('light-theme');
    btn.textContent = isLight ? '🌙' : '☀️';
    btn.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to light mode');
    btn.title = isLight ? 'Switch to dark mode' : 'Switch to light mode';
  }

  document.querySelectorAll('.theme-toggle-btn').forEach((btn) => {
    setLabel(btn);
    btn.addEventListener('click', () => {
      const isLight = document.documentElement.classList.toggle('light-theme');
      try { localStorage.setItem(KEY, isLight ? 'light' : 'dark'); } catch (e) { /* ignore */ }
      setLabel(btn);
    });
  });
})();
