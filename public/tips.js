// First-visit tips — small dismissible hints shown once per device, ever
// (each tip has its own key so multiple tips don't all fire the same visit).
window.CAC_TIP = {
  showOnce(container, key, message) {
    if (!container) return;
    const storageKey = `ebenezer_tip_seen_${key}`;
    try {
      if (localStorage.getItem(storageKey)) return;
      localStorage.setItem(storageKey, '1');
    } catch (e) { return; }

    const el = document.createElement('div');
    el.className = 'first-visit-tip';
    el.innerHTML = `<span>${message}</span><button type="button" aria-label="Dismiss tip">✕</button>`;
    el.querySelector('button').addEventListener('click', () => el.remove());
    container.prepend(el);
  },
};
