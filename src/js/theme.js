// Theme (light / dark / auto). Cookie `colorMode` is the persisted preference — cookies, not
// localStorage, because the pre-paint script in layout.html must read it synchronously and the
// value must reach every iframe (preview pane, prefs frame, editor) on the same host.
const html = document.documentElement;
const MODES = ['auto', 'light', 'dark'];
const media = window.matchMedia('(prefers-color-scheme: dark)');

function readMode() {
  return (document.cookie.match(/(?:^|;\s*)colorMode=(dark|light|auto)/) || [])[1] || 'auto';
}

function isDark(mode) {
  return mode === 'dark' || (mode === 'auto' && media.matches);
}

function paint(mode) {
  const dark = isDark(mode);
  html.classList.toggle('dark-mode', dark);
  html.setAttribute('data-theme', mode);
  // propagate into every same-origin iframe (message preview, settings frame, TinyMCE)
  for (const f of document.querySelectorAll('iframe')) {
    try {
      f.contentDocument?.documentElement?.classList.toggle('dark-mode', dark);
    } catch {
      /* cross-origin — ignore */
    }
  }
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    const i = btn.querySelector('.ico');
    if (i) {
      i.className = `ico ico-lg ${mode === 'auto' ? 'ico-theme-auto' : dark ? 'ico-light-mode' : 'ico-dark-mode'}`;
    }
    btn.dataset.mode = mode;
  }
  document.dispatchEvent(new CustomEvent('gm:theme', { detail: { mode, dark } }));
}

export const theme = {
  get mode() {
    return readMode();
  },
  get dark() {
    return isDark(readMode());
  },

  set(mode) {
    if (!MODES.includes(mode)) mode = 'auto';
    if (window.rcmail?.set_cookie) rcmail.set_cookie('colorMode', mode, false);
    else document.cookie = `colorMode=${mode}; path=/; max-age=31536000; SameSite=Lax`;
    paint(mode);
    return false;
  },

  // header button: auto → light → dark → auto …
  cycle() {
    const i = MODES.indexOf(readMode());
    return this.set(MODES[(i + 1) % MODES.length]);
  },

  init() {
    paint(readMode());
    media.addEventListener('change', () => {
      if (readMode() === 'auto') paint('auto');
    });
    // keep newly loaded frames in sync
    document.addEventListener(
      'load',
      (e) => {
        if (e.target.tagName === 'IFRAME') paint(readMode());
      },
      true
    );
  },
};
