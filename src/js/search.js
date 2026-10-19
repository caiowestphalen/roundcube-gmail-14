// Search options panel: the header search pill's "tune" button toggles the task's #searchmenu
// (advanced search form rendered by mail.html / addressbook.html). Closes on outside click,
// Escape, or when the Search button inside the panel is used.
export const search = {
  init() {
    const btn = document.querySelector('.gm-search .button.options');
    const panel = document.getElementById('searchmenu');
    if (!btn || !panel) return;

    const isOpen = () => !panel.classList.contains('hidden');
    const set = (open) => {
      panel.classList.toggle('hidden', !open);
      btn.classList.toggle('gm-active', open);
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) panel.querySelector('input, select, button')?.focus({ preventScroll: true });
    };

    btn.setAttribute('aria-controls', 'searchmenu');
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      set(!isOpen());
    });
    panel.querySelector('.formbuttons button.search')?.addEventListener('click', () => set(false));
    document.addEventListener('pointerdown', (e) => {
      if (isOpen() && !e.target.closest('#searchmenu, .gm-search, .gm-select-list')) set(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen()) {
        set(false);
        btn.focus();
      }
    });
    // core hides the panel itself after a search (rcmail.command('search') → hide_menu('searchmenu'))
    window.rcmail?.addEventListener('menu-close', (p) => {
      if (p?.name === 'searchmenu') set(false);
    });
  },
};
