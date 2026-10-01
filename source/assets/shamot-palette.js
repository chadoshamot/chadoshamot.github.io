(() => {
  'use strict';
  const key = 'shamot.palette';
  const palettes = new Set(['beige', 'navy', 'green']);
  const root = document.documentElement;
  const read = () => {
    try {
      const saved = localStorage.getItem(key);
      if (palettes.has(saved)) return saved;
      return localStorage.getItem('Stellar.colorScheme') === 'dark' ? 'navy' : 'beige';
    } catch { return 'beige'; }
  };
  const syncControls = () => document.querySelectorAll('[data-shamot-palette]').forEach(select => {
    select.value = root.dataset.palette;
  });
  const apply = (palette, persist) => {
    if (!palettes.has(palette)) return;
    root.dataset.palette = palette;
    root.dataset.theme = palette === 'beige' ? 'light' : 'dark';
    if (persist) {
      try { localStorage.setItem(key, palette); } catch {}
    }
    syncControls();
  };
  window.setShamotPalette = palette => apply(palette, true);
  apply(read(), false);
  document.addEventListener('DOMContentLoaded', syncControls, {once:true});
  window.addEventListener('storage', event => {
    if (event.key === key) apply(read(), false);
  });
})();
