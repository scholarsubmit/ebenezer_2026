// Shared "Share" behavior for lightbox photos — tries the native device
// share sheet first (which includes WhatsApp on virtually every phone),
// and falls back to a direct wa.me link on desktop browsers that don't
// support navigator.share.
window.CAC_SHARE = async function share(url, caption) {
  if (navigator.share) {
    try {
      await navigator.share({ title: "EBENEZER 2026", text: caption, url });
      return;
    } catch (e) {
      // user cancelled the share sheet, or it failed — fall through to WhatsApp link
      if (e && e.name === "AbortError") return;
    }
  }
  const text = encodeURIComponent(`${caption} ${url}`);
  window.open(`https://wa.me/?text=${text}`, "_blank", "noopener");
};
