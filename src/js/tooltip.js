// Custom tooltips for every element carrying a title (toolbar buttons, menu items, list cells,
// plugin buttons). The native title is moved to data-tip on first hover so the browser tooltip
// never shows; aria-label is preserved for assistive tech. Gmail timing: 300ms in, instant out.
let tip;
let showTimer;
let current;

function ensure() {
  if (tip) return tip;
  tip = document.createElement('div');
  tip.className = 'gm-tooltip';
  tip.setAttribute('role', 'tooltip');
  document.body.append(tip);
  return tip;
}

// Plugins read/write `title` (hotkeys appends " [F1]"), so the attribute is only parked in
// data-tip while the tooltip is showing and restored on hide.
function textFor(el) {
  if (el.hasAttribute('title')) {
    const t = el.getAttribute('title');
    el.dataset.tip = t;
    el.removeAttribute('title');
    if (!el.hasAttribute('aria-label') && !el.textContent.trim()) el.setAttribute('aria-label', t);
  }
  return el.dataset.tip || '';
}

function restore(el) {
  if (el && el.dataset.tip !== undefined && !el.hasAttribute('title')) {
    el.setAttribute('title', el.dataset.tip);
  }
}

function place(el) {
  const r = el.getBoundingClientRect();
  const t = ensure();
  const w = t.offsetWidth;
  const h = t.offsetHeight;
  let left = r.left + r.width / 2 - w / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
  let top = r.bottom + 8;
  if (top + h > window.innerHeight - 8) top = r.top - h - 8;
  t.style.left = `${left}px`;
  t.style.top = `${top}px`;
}

function show(el) {
  const text = textFor(el);
  if (!text) return;
  current = el;
  clearTimeout(showTimer);
  showTimer = setTimeout(() => {
    if (current !== el || !el.isConnected) return;
    const t = ensure();
    t.textContent = text;
    t.classList.add('gm-visible');
    place(el);
  }, 320);
}

function hide() {
  clearTimeout(showTimer);
  restore(current);
  current = null;
  tip?.classList.remove('gm-visible');
}

const SELECTOR = '[title]:not(iframe):not(body):not(html), [data-tip]';

export const tooltip = {
  show,
  hide,
  init() {
    const noHover = window.matchMedia?.('(hover: none)');
    document.addEventListener('pointerover', (e) => {
      if (e.pointerType === 'touch' || noHover?.matches) return;
      const el = e.target.closest(SELECTOR);
      if (!el || el === current) return;
      if (el.closest('.tox, .gm-tooltip')) return; // TinyMCE has its own
      if (/^(IFRAME|HTML|BODY|FORM|TABLE|TBODY|THEAD|SECTION|MAIN)$/.test(el.tagName)) return;
      show(el);
    });
    document.addEventListener('pointerout', (e) => {
      if (current && !current.contains(e.relatedTarget)) hide();
    });
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('keydown', (e) => e.key === 'Escape' && hide());
    document.addEventListener('focusin', (e) => {
      const el = e.target.closest(SELECTOR);
      if (el && document.documentElement.classList.contains('kbd')) show(el);
    });
    document.addEventListener('focusout', hide);
    window.addEventListener('scroll', hide, true);
  },
};
