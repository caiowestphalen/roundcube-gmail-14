// Layout engine: maintains the <html> class contract (touch, layout-{phone,small,normal,large},
// nav-collapsed) and responsive panels. Up to 1024px, use a drawer and one main panel.
const BREAKPOINTS = [
  ['phone', 0, 480],
  ['small', 481, 1024],
  ['normal', 1025, 1200],
  ['large', 1201, Infinity],
];

const html = document.documentElement;

function screenMode() {
  const w = window.innerWidth;
  const mode = BREAKPOINTS.find(([, min, max]) => w >= min && w <= max)[0];
  for (const [name] of BREAKPOINTS) html.classList.toggle(`layout-${name}`, name === mode);
  return mode;
}

function detectTouch() {
  const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  html.classList.toggle('touch', touch);
  return touch;
}

// Phones/tablets: the folder / address-book list (#layout-sidebar) moves inside the nav drawer
// (#layout-menu) so the hamburger shows folders like Gmail's; back on wide screens it returns to
// its grid slot. Same DOM nodes → Roundcube's tree widgets keep working. Settings keeps its
// sections list as the main panel.
function placeSidebar(mode) {
  const sidebar = document.getElementById('layout-sidebar');
  const menu = document.getElementById('layout-menu');
  const layoutEl = document.getElementById('layout');
  if (!sidebar || !menu || !layoutEl || document.body.classList.contains('task-settings')) return;
  const small = mode === 'phone' || mode === 'small';
  if (small && sidebar.parentElement !== menu) {
    menu.append(sidebar);
    sidebar.classList.add('gm-in-drawer');
  } else if (!small && sidebar.parentElement === menu) {
    const list = document.getElementById('layout-list');
    if (list) layoutEl.insertBefore(sidebar, list);
    else layoutEl.append(sidebar);
    sidebar.classList.remove('gm-in-drawer');
  }
}

export const layout = {
  mode: null,
  touch: false,
  placeSidebar,

  init() {
    // html.kbd = the user is navigating with the keyboard → show focus rings; mouse hides them
    document.addEventListener('keydown', (e) => {
      if (
        ['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter', ' '].includes(e.key)
      ) {
        html.classList.add('kbd');
      }
    });
    document.addEventListener('pointerdown', () => html.classList.remove('kbd'), true);
    this.touch = detectTouch();
    this.mode = screenMode();
    placeSidebar(this.mode);
    window.addEventListener('resize', () => {
      const m = screenMode();
      if (m !== this.mode) {
        this.mode = m;
        placeSidebar(m);
        document.dispatchEvent(new CustomEvent('gm:layout', { detail: { mode: m } }));
      }
    });
    try {
      if (localStorage.getItem('gm.nav') === 'collapsed') html.classList.add('nav-collapsed');
    } catch {
      /* storage unavailable (private mode) — default expanded */
    }
  },

  toggleNav(force) {
    if (this.mode === 'phone' || this.mode === 'small') {
      html.classList.toggle('nav-open', force === undefined ? undefined : !force);
      return false;
    }
    const collapsed = html.classList.toggle('nav-collapsed', force);
    try {
      localStorage.setItem('gm.nav', collapsed ? 'collapsed' : 'expanded');
    } catch {
      /* ignore */
    }
    return collapsed;
  },
};
